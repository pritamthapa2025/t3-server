import {
  count,
  eq,
  desc,
  asc,
  and,
  or,
  like,
  ilike,
  gte,
  lte,
  sql,
  max,
  inArray,
} from "drizzle-orm";
import { db } from "../config/db.js";
import {
  invoices,
  invoiceLineItems,
  payments,
  paymentAllocations,
  invoiceDocuments,
  paymentDocuments,
  invoiceHistory,
  paymentHistory,
} from "../drizzle/schema/invoicing.schema.js";
import { organizations } from "../drizzle/schema/client.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";

// ============================
// Helper Functions
// ============================

/**
 * Generate invoice number using atomic database function
 * Format: INV-YYYY-#####
 */
const generateInvoiceNumber = async (organizationId: string): Promise<string> => {
  try {
    const result = await db.execute<{ next_value: string }>(
      sql.raw(`SELECT org.get_next_counter('${organizationId}'::uuid, 'invoice_number') as next_value`)
    );
    const nextNumber = parseInt(result.rows[0]?.next_value || "1");
    const year = new Date().getFullYear();
    return `INV-${year}-${nextNumber.toString().padStart(5, "0")}`;
  } catch (error) {
    console.warn("Counter function not found, using fallback method:", error);
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const maxResult = await db
      .select({ maxInvoiceNumber: max(invoices.invoiceNumber) })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          like(invoices.invoiceNumber, `${prefix}%`)
        )
      );
    const maxInvoiceNumber = maxResult[0]?.maxInvoiceNumber;
    let nextNumber = 1;
    if (maxInvoiceNumber) {
      const match = maxInvoiceNumber.match(new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)`));
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    return `${prefix}${nextNumber.toString().padStart(5, "0")}`;
  }
};

/**
 * Generate payment number using atomic database function
 * Format: PAY-YYYY-#####
 */
const generatePaymentNumber = async (organizationId: string): Promise<string> => {
  try {
    const result = await db.execute<{ next_value: string }>(
      sql.raw(`SELECT org.get_next_counter('${organizationId}'::uuid, 'payment_number') as next_value`)
    );
    const nextNumber = parseInt(result.rows[0]?.next_value || "1");
    const year = new Date().getFullYear();
    return `PAY-${year}-${nextNumber.toString().padStart(5, "0")}`;
  } catch (error) {
    console.warn("Counter function not found, using fallback method:", error);
    const year = new Date().getFullYear();
    const prefix = `PAY-${year}-`;
    const maxResult = await db
      .select({ maxPaymentNumber: max(payments.paymentNumber) })
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, organizationId),
          like(payments.paymentNumber, `${prefix}%`)
        )
      );
    const maxPaymentNumber = maxResult[0]?.maxPaymentNumber;
    let nextNumber = 1;
    if (maxPaymentNumber) {
      const match = maxPaymentNumber.match(new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)`));
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    return `${prefix}${nextNumber.toString().padStart(5, "0")}`;
  }
};

/**
 * Calculate line item totals
 */
const calculateLineItemTotal = (
  quantity: string,
  unitPrice: string,
  discountAmount: string,
  taxRate: string
): { lineTotal: string; taxAmount: string } => {
  const qty = parseFloat(quantity || "1");
  const price = parseFloat(unitPrice || "0");
  const discount = parseFloat(discountAmount || "0");
  const tax = parseFloat(taxRate || "0");

  const subtotal = qty * price - discount;
  const taxAmt = subtotal * tax;
  const total = subtotal + taxAmt;

  return {
    lineTotal: total.toFixed(2),
    taxAmount: taxAmt.toFixed(2),
  };
};

/**
 * Recalculate invoice totals
 */
const recalculateInvoiceTotals = async (invoiceId: string) => {
  const lineItems = await db
    .select()
    .from(invoiceLineItems)
    .where(
      and(eq(invoiceLineItems.invoiceId, invoiceId), eq(invoiceLineItems.isDeleted, false))
    );

  let subtotal = 0;
  let totalTax = 0;

  for (const item of lineItems) {
    const qty = parseFloat(item.quantity || "1");
    const price = parseFloat(item.unitPrice || "0");
    const discount = parseFloat(item.discountAmount || "0");
    const tax = parseFloat(item.taxRate || "0");

    const itemSubtotal = qty * price - discount;
    const itemTax = itemSubtotal * tax;

    subtotal += itemSubtotal;
    totalTax += itemTax;
  }

  // Get invoice to check for invoice-level discount
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId));

  if (!invoice) return;

  let discountAmount = 0;
  
  // Apply invoice-level discount if exists
  if (invoice.discountType === "percentage" && invoice.discountValue) {
    const discountPercent = parseFloat(invoice.discountValue);
    discountAmount = subtotal * (discountPercent / 100);
  } else if (invoice.discountType === "fixed" && invoice.discountValue) {
    discountAmount = parseFloat(invoice.discountValue);
  }

  const finalSubtotal = subtotal - discountAmount;
  const finalTax = totalTax;
  const totalAmount = finalSubtotal + finalTax;

  // Get total payments
  const paymentsResult = await db
    .select({
      totalPaid: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.invoiceId, invoiceId),
        eq(payments.isDeleted, false),
        or(
          eq(payments.status, "completed"),
          eq(payments.status, "processing")
        )
      )
    );

  const amountPaid = parseFloat(paymentsResult[0]?.totalPaid || "0");
  const balanceDue = Math.max(0, totalAmount - amountPaid);

  // Update invoice
  await db
    .update(invoices)
    .set({
      subtotal: finalSubtotal.toFixed(2),
      taxAmount: finalTax.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      balanceDue: balanceDue.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  // Update status based on balance
  let newStatus = invoice.status;
  if (balanceDue === 0 && amountPaid > 0) {
    newStatus = "paid";
  } else if (amountPaid > 0 && balanceDue > 0) {
    newStatus = "partial";
  } else if (balanceDue > 0 && new Date(invoice.dueDate) < new Date()) {
    newStatus = "overdue";
  }

  if (newStatus !== invoice.status) {
    await db
      .update(invoices)
      .set({ status: newStatus as any })
      .where(eq(invoices.id, invoiceId));
  }
};

/**
 * Create invoice history entry
 */
const createInvoiceHistoryEntry = async (
  invoiceId: string,
  organizationId: string,
  performedBy: string,
  action: string,
  oldValue?: string,
  newValue?: string,
  description?: string
) => {
  return await db.insert(invoiceHistory).values({
    invoiceId,
    organizationId,
    performedBy,
    action,
    oldValue: oldValue || null,
    newValue: newValue || null,
    description: description || null,
  });
};

// ============================
// INVOICE SERVICES
// ============================

/**
 * Get invoices with pagination and filters
 */
export const getInvoices = async (
  organizationId: string,
  options: {
    page?: number;
    limit?: number;
    status?: string;
    invoiceType?: string;
    clientId?: string;
    jobId?: string;
    bidId?: string;
    startDate?: string;
    endDate?: string;
    dueDateStart?: string;
    dueDateEnd?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    includeDeleted?: boolean;
  }
) => {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 10, 100);
  const offset = (page - 1) * limit;

  let whereConditions: any[] = [eq(invoices.organizationId, organizationId)];

  if (!options.includeDeleted) {
    whereConditions.push(eq(invoices.isDeleted, false));
  }

  if (options.status) {
    whereConditions.push(eq(invoices.status, options.status as any));
  }

  if (options.invoiceType) {
    whereConditions.push(eq(invoices.invoiceType, options.invoiceType as any));
  }

  if (options.clientId) {
    whereConditions.push(eq(invoices.clientId, options.clientId));
  }

  if (options.jobId) {
    whereConditions.push(eq(invoices.jobId, options.jobId));
  }

  if (options.bidId) {
    whereConditions.push(eq(invoices.bidId, options.bidId));
  }

  if (options.startDate) {
    whereConditions.push(gte(invoices.invoiceDate, options.startDate));
  }

  if (options.endDate) {
    whereConditions.push(lte(invoices.invoiceDate, options.endDate));
  }

  if (options.dueDateStart) {
    whereConditions.push(gte(invoices.dueDate, options.dueDateStart));
  }

  if (options.dueDateEnd) {
    whereConditions.push(lte(invoices.dueDate, options.dueDateEnd));
  }

  if (options.search) {
    const searchTerm = `%${options.search}%`;
    const clientSubquery = db
      .select({ id: organizations.id })
      .from(organizations)
      .where(ilike(organizations.name, searchTerm));

    whereConditions.push(
      or(
        ilike(invoices.invoiceNumber, searchTerm),
        sql`${invoices.clientId} IN (${clientSubquery})`
      )!
    );
  }

  const orderBy =
    options.sortBy === "invoiceDate"
      ? options.sortOrder === "asc"
        ? asc(invoices.invoiceDate)
        : desc(invoices.invoiceDate)
      : options.sortBy === "dueDate"
      ? options.sortOrder === "asc"
        ? asc(invoices.dueDate)
        : desc(invoices.dueDate)
      : options.sortBy === "totalAmount"
      ? options.sortOrder === "asc"
        ? asc(invoices.totalAmount)
        : desc(invoices.totalAmount)
      : desc(invoices.createdAt);

  const [invoicesList, totalResult] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(and(...whereConditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(invoices)
      .where(and(...whereConditions)),
  ]);

  // Get unique creator IDs and fetch their names in batch
  const creatorIds = Array.from(new Set(invoicesList.map(i => i.createdBy).filter((id): id is string => !!id)));
  const creators = creatorIds.length > 0
    ? await db
        .select({
          id: users.id,
          fullName: users.fullName,
        })
        .from(users)
        .where(inArray(users.id, creatorIds))
    : [];
  const creatorMap = new Map(creators.map(c => [c.id, c.fullName]));

  // Get related data (client, job) for each invoice
  const invoicesWithRelations = await Promise.all(
    invoicesList.map(async (invoice) => {
      const [client, job, lineItemsCount] = await Promise.all([
        db
          .select({
            id: organizations.id,
            name: organizations.name,
          })
          .from(organizations)
          .where(eq(organizations.id, invoice.clientId))
          .limit(1),
        invoice.jobId
          ? db
              .select({
                id: jobs.id,
                jobNumber: jobs.jobNumber,
                name: jobs.name,
              })
              .from(jobs)
              .where(eq(jobs.id, invoice.jobId))
              .limit(1)
          : Promise.resolve([]),
        db
          .select({ count: count() })
          .from(invoiceLineItems)
          .where(
            and(
              eq(invoiceLineItems.invoiceId, invoice.id),
              eq(invoiceLineItems.isDeleted, false)
            )
          ),
      ]);

      return {
        ...invoice,
        createdByName: invoice.createdBy ? (creatorMap.get(invoice.createdBy) || null) : null,
        client: client[0] || null,
        job: job[0] || null,
        lineItemsCount: lineItemsCount[0]?.count || 0,
      };
    })
  );

  const total = totalResult[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    invoices: invoicesWithRelations,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

/**
 * Get invoice by ID
 */
export const getInvoiceById = async (
  invoiceId: string,
  organizationId: string,
  options?: {
    includeLineItems?: boolean;
    includePayments?: boolean;
    includeDocuments?: boolean;
    includeHistory?: boolean;
  }
) => {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, invoiceId),
        eq(invoices.organizationId, organizationId),
        eq(invoices.isDeleted, false)
      )
    )
    .limit(1);

  if (!invoice) return null;

  // Get createdBy user name
  let createdByName: string | null = null;
  if (invoice.createdBy) {
    const [creator] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, invoice.createdBy))
      .limit(1);
    createdByName = creator?.fullName || null;
  }

  const result: any = { ...invoice, createdByName };

  if (options?.includeLineItems !== false) {
    result.lineItems = await db
      .select()
      .from(invoiceLineItems)
      .where(
        and(
          eq(invoiceLineItems.invoiceId, invoiceId),
          eq(invoiceLineItems.isDeleted, false)
        )
      )
      .orderBy(invoiceLineItems.sortOrder);
  }

  if (options?.includePayments !== false) {
    result.payments = await db
      .select({
        id: payments.id,
        paymentNumber: payments.paymentNumber,
        amount: payments.amount,
        paymentDate: payments.paymentDate,
        status: payments.status,
        paymentMethod: payments.paymentMethod,
      })
      .from(payments)
      .where(
        and(
          eq(payments.invoiceId, invoiceId),
          eq(payments.isDeleted, false)
        )
      )
      .orderBy(desc(payments.paymentDate));
  }

  if (options?.includeDocuments !== false) {
    result.documents = await db
      .select()
      .from(invoiceDocuments)
      .where(
        and(
          eq(invoiceDocuments.invoiceId, invoiceId),
          eq(invoiceDocuments.isDeleted, false)
        )
      )
      .orderBy(desc(invoiceDocuments.createdAt));
  }

  if (options?.includeHistory) {
    result.history = await db
      .select()
      .from(invoiceHistory)
      .where(eq(invoiceHistory.invoiceId, invoiceId))
      .orderBy(desc(invoiceHistory.createdAt));
  }

  return result;
};

/**
 * Create invoice
 */
export const createInvoice = async (
  organizationId: string,
  data: {
    clientId: string;
    jobId?: string;
    bidId?: string;
    invoiceType?: string;
    invoiceDate: string;
    dueDate: string;
    paymentTerms?: string;
    paymentTermsDays?: number;
    taxRate?: string;
    discountType?: "percentage" | "fixed";
    discountValue?: string;
    notes?: string;
    termsAndConditions?: string;
    internalNotes?: string;
    billingAddressLine1?: string;
    billingAddressLine2?: string;
    billingCity?: string;
    billingState?: string;
    billingZipCode?: string;
    billingCountry?: string;
    isRecurring?: boolean;
    recurringFrequency?: string;
    recurringStartDate?: string;
    recurringEndDate?: string;
    lineItems: Array<{
      description: string;
      itemType?: string;
      quantity?: string;
      unitPrice: string;
      discountAmount?: string;
      taxRate?: string;
      jobId?: string;
      bidId?: string;
      inventoryItemId?: string;
      notes?: string;
      sortOrder?: number;
    }>;
    createdBy: string;
  }
) => {
  return await db.transaction(async (tx) => {
    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(organizationId);

    // Create invoice
    const invoiceResult = await tx
      .insert(invoices)
      .values({
        invoiceNumber,
        organizationId,
        clientId: data.clientId,
        jobId: data.jobId || null,
        bidId: data.bidId || null,
        invoiceType: (data.invoiceType as any) || "standard",
        status: "draft",
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        paymentTerms: data.paymentTerms || null,
        paymentTermsDays: data.paymentTermsDays || null,
        taxRate: data.taxRate || "0",
        discountType: data.discountType || null,
        discountValue: data.discountValue || null,
        notes: data.notes || null,
        termsAndConditions: data.termsAndConditions || null,
        internalNotes: data.internalNotes || null,
        billingAddressLine1: data.billingAddressLine1 || null,
        billingAddressLine2: data.billingAddressLine2 || null,
        billingCity: data.billingCity || null,
        billingState: data.billingState || null,
        billingZipCode: data.billingZipCode || null,
        billingCountry: data.billingCountry || null,
        isRecurring: data.isRecurring || false,
        recurringFrequency: (data.recurringFrequency as any) || null,
        recurringStartDate: data.recurringStartDate || null,
        recurringEndDate: data.recurringEndDate || null,
        createdBy: data.createdBy,
        subtotal: "0",
        taxAmount: "0",
        discountAmount: "0",
        totalAmount: "0",
        amountPaid: "0",
        balanceDue: "0",
      })
      .returning();
    
    const invoice = Array.isArray(invoiceResult) ? invoiceResult[0] : invoiceResult as any;
    if (!invoice) {
      throw new Error("Failed to create invoice");
    }

    // Create line items
    for (const item of data.lineItems) {
      const { lineTotal, taxAmount } = calculateLineItemTotal(
        item.quantity || "1",
        item.unitPrice,
        item.discountAmount || "0",
        item.taxRate || "0"
      );

      await tx
        .insert(invoiceLineItems)
        .values({
          organizationId,
          invoiceId: invoice.id,
          description: item.description,
          itemType: item.itemType || null,
          quantity: item.quantity || "1",
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount || "0",
          taxRate: item.taxRate || "0",
          taxAmount,
          lineTotal,
          jobId: item.jobId || null,
          bidId: item.bidId || null,
          inventoryItemId: item.inventoryItemId || null,
          notes: item.notes || null,
          sortOrder: item.sortOrder || 0,
        });
    }

    return invoice.id;
  });
};

/**
 * Update invoice
 */
export const updateInvoice = async (
  invoiceId: string,
  organizationId: string,
  data: any,
  _updatedBy: string
) => {
  const invoice = await getInvoiceById(invoiceId, organizationId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const updateData: any = { updatedAt: new Date() };
  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      updateData[key] = data[key];
    }
  });

  await db.update(invoices).set(updateData).where(eq(invoices.id, invoiceId));

  // Recalculate totals if financial fields changed
  if (data.taxRate !== undefined || data.discountType !== undefined || data.discountValue !== undefined) {
    await recalculateInvoiceTotals(invoiceId);
  }

  return await getInvoiceById(invoiceId, organizationId);
};

/**
 * Delete invoice (soft delete)
 */
export const deleteInvoice = async (
  invoiceId: string,
  organizationId: string,
  deletedBy: string
) => {
  await db
    .update(invoices)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));

  await createInvoiceHistoryEntry(
    invoiceId,
    organizationId,
    deletedBy,
    "deleted",
    undefined,
    undefined,
    "Invoice deleted"
  );

  return { success: true };
};

/**
 * Mark invoice as paid
 */
export const markInvoiceAsPaid = async (
  invoiceId: string,
  organizationId: string,
  data: { paidDate?: string; notes?: string },
  performedBy: string
) => {
  const paidDateStr = data.paidDate || new Date().toISOString().split('T')[0];
  
  await db
    .update(invoices)
    .set({
      status: "paid",
      paidDate: paidDateStr ? new Date(paidDateStr) : null,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  await createInvoiceHistoryEntry(
    invoiceId,
    organizationId,
    performedBy,
    "marked_paid",
    undefined,
    paidDateStr,
    data.notes || "Invoice marked as paid"
  );

  return await getInvoiceById(invoiceId, organizationId);
};

/**
 * Void invoice
 */
export const voidInvoice = async (
  invoiceId: string,
  organizationId: string,
  data: { reason: string; notes?: string },
  performedBy: string
) => {
  await db
    .update(invoices)
    .set({
      status: "void",
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  await createInvoiceHistoryEntry(
    invoiceId,
    organizationId,
    performedBy,
    "voided",
    undefined,
    data.reason,
    data.notes || `Invoice voided: ${data.reason}`
  );

  return await getInvoiceById(invoiceId, organizationId);
};

// ============================
// PAYMENT SERVICES
// ============================

/**
 * Get payments with pagination and filters
 */
export const getPayments = async (
  organizationId: string,
  options: {
    page?: number;
    limit?: number;
    status?: string;
    paymentMethod?: string;
    paymentType?: string;
    clientId?: string;
    invoiceId?: string;
    startDate?: string;
    endDate?: string;
    paymentDateStart?: string;
    paymentDateEnd?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    includeDeleted?: boolean;
  }
) => {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 10, 100);
  const offset = (page - 1) * limit;

  let whereConditions: any[] = [eq(payments.organizationId, organizationId)];

  if (!options.includeDeleted) {
    whereConditions.push(eq(payments.isDeleted, false));
  }

  if (options.status) {
    whereConditions.push(eq(payments.status, options.status as any));
  }

  if (options.paymentMethod) {
    whereConditions.push(eq(payments.paymentMethod, options.paymentMethod as any));
  }

  if (options.paymentType) {
    whereConditions.push(eq(payments.paymentType, options.paymentType as any));
  }

  if (options.clientId) {
    whereConditions.push(eq(payments.clientId, options.clientId));
  }

  if (options.invoiceId) {
    whereConditions.push(eq(payments.invoiceId, options.invoiceId));
  }

  if (options.startDate) {
    whereConditions.push(gte(payments.paymentDate, options.startDate));
  }

  if (options.endDate) {
    whereConditions.push(lte(payments.paymentDate, options.endDate));
  }

  if (options.paymentDateStart) {
    whereConditions.push(gte(payments.paymentDate, options.paymentDateStart));
  }

  if (options.paymentDateEnd) {
    whereConditions.push(lte(payments.paymentDate, options.paymentDateEnd));
  }

  if (options.search) {
    const searchTerm = `%${options.search}%`;
    whereConditions.push(
      or(
        ilike(payments.paymentNumber, searchTerm),
        ilike(payments.checkNumber, searchTerm),
        ilike(payments.transactionId, searchTerm)
      )!
    );
  }

  const orderBy = options.sortBy === "paymentDate"
    ? options.sortOrder === "asc" ? asc(payments.paymentDate) : desc(payments.paymentDate)
    : options.sortBy === "receivedDate"
    ? options.sortOrder === "asc" ? asc(payments.receivedDate) : desc(payments.receivedDate)
    : options.sortBy === "amount"
    ? options.sortOrder === "asc" ? asc(payments.amount) : desc(payments.amount)
    : desc(payments.createdAt);

  const [paymentsList, totalResult] = await Promise.all([
    db
      .select()
      .from(payments)
      .where(and(...whereConditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(payments)
      .where(and(...whereConditions)),
  ]);

  const total = totalResult[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    payments: paymentsList,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

/**
 * Get payment by ID
 */
export const getPaymentById = async (
  paymentId: string,
  organizationId: string,
  options?: {
    includeAllocations?: boolean;
    includeDocuments?: boolean;
    includeHistory?: boolean;
  }
) => {
  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.id, paymentId),
        eq(payments.organizationId, organizationId),
        eq(payments.isDeleted, false)
      )
    )
    .limit(1);

  if (!payment) return null;

  const result: any = { ...payment };

  if (options?.includeAllocations !== false) {
    result.allocations = await db
      .select()
      .from(paymentAllocations)
      .where(
        and(
          eq(paymentAllocations.paymentId, paymentId),
          eq(paymentAllocations.isDeleted, false)
        )
      );
  }

  if (options?.includeDocuments !== false) {
    result.documents = await db
      .select()
      .from(paymentDocuments)
      .where(
        and(
          eq(paymentDocuments.paymentId, paymentId),
          eq(paymentDocuments.isDeleted, false)
        )
      )
      .orderBy(desc(paymentDocuments.createdAt));
  }

  if (options?.includeHistory) {
    result.history = await db
      .select()
      .from(paymentHistory)
      .where(eq(paymentHistory.paymentId, paymentId))
      .orderBy(desc(paymentHistory.createdAt));
  }

  return result;
};

/**
 * Create payment
 */
export const createPayment = async (
  organizationId: string,
  data: any,
  createdBy: string
) => {
  return await db.transaction(async (tx) => {
    const paymentNumber = await generatePaymentNumber(organizationId);

    // Get invoice to validate and get client
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, data.invoiceId));

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    const paymentResult = await tx
      .insert(payments)
      .values({
        paymentNumber,
        organizationId,
        clientId: invoice.clientId,
        invoiceId: data.invoiceId,
        paymentType: data.paymentType || "full",
        paymentMethod: data.paymentMethod,
        status: "pending",
        amount: data.amount,
        currency: data.currency || "USD",
        exchangeRate: data.exchangeRate || "1",
        paymentDate: data.paymentDate,
        receivedDate: data.receivedDate || null,
        checkNumber: data.checkNumber || null,
        transactionId: data.transactionId || null,
        referenceNumber: data.referenceNumber || null,
        bankName: data.bankName || null,
        accountLastFour: data.accountLastFour || null,
        processingFee: data.processingFee || "0",
        lateFee: data.lateFee || "0",
        discountApplied: data.discountApplied || "0",
        adjustmentAmount: data.adjustmentAmount || "0",
        adjustmentReason: data.adjustmentReason || null,
        notes: data.notes || null,
        internalNotes: data.internalNotes || null,
        createdBy,
      })
      .returning();

    const payment = Array.isArray(paymentResult) ? paymentResult[0] : paymentResult as any;
    if (!payment) {
      throw new Error("Failed to create payment");
    }

    // Create allocations if provided
    if (data.allocations && data.allocations.length > 0) {
      for (const allocation of data.allocations) {
        await tx.insert(paymentAllocations).values({
          organizationId,
          paymentId: payment.id,
          invoiceId: allocation.invoiceId,
          allocatedAmount: allocation.allocatedAmount,
          notes: allocation.notes || null,
        });
      }
    } else {
      // Default allocation to the invoice
      await tx.insert(paymentAllocations).values({
        organizationId,
        paymentId: payment.id,
        invoiceId: data.invoiceId,
        allocatedAmount: data.amount,
      });
    }

    return payment.id;
  });
};

/**
 * Update payment
 */
export const updatePayment = async (
  paymentId: string,
  organizationId: string,
  data: any,
  _updatedBy: string
) => {
  const updateData: any = { updatedAt: new Date() };
  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      updateData[key] = data[key];
    }
  });

  await db.update(payments).set(updateData).where(eq(payments.id, paymentId));

  return await getPaymentById(paymentId, organizationId);
};

/**
 * Delete payment (soft delete)
 */
export const deletePayment = async (
  paymentId: string,
  _organizationId: string,
  _deletedBy: string
) => {
  await db
    .update(payments)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(payments.id, paymentId));

  return { success: true };
};

// ============================
// REPORTS
// ============================

/**
 * Get invoice summary
 */
export const getInvoiceSummary = async (
  organizationId: string,
  options: {
    startDate?: string;
    endDate?: string;
    clientId?: string;
    status?: string;
  }
) => {
  let whereConditions: any[] = [
    eq(invoices.organizationId, organizationId),
    eq(invoices.isDeleted, false)
  ];

  if (options.startDate) {
    whereConditions.push(gte(invoices.invoiceDate, options.startDate));
  }

  if (options.endDate) {
    whereConditions.push(lte(invoices.invoiceDate, options.endDate));
  }

  if (options.clientId) {
    whereConditions.push(eq(invoices.clientId, options.clientId));
  }

  if (options.status) {
    whereConditions.push(eq(invoices.status, options.status as any));
  }

  const summary = await db
    .select({
      totalInvoices: count(),
      totalAmount: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
      totalPaid: sql<string>`COALESCE(SUM(${invoices.amountPaid}), 0)`,
      totalOutstanding: sql<string>`COALESCE(SUM(${invoices.balanceDue}), 0)`,
    })
    .from(invoices)
    .where(and(...whereConditions));

  return summary[0];
};

/**
 * Get payment summary
 */
export const getPaymentSummary = async (
  organizationId: string,
  options: {
    startDate?: string;
    endDate?: string;
    clientId?: string;
    paymentMethod?: string;
  }
) => {
  let whereConditions: any[] = [
    eq(payments.organizationId, organizationId),
    eq(payments.isDeleted, false)
  ];

  if (options.startDate) {
    whereConditions.push(gte(payments.paymentDate, options.startDate));
  }

  if (options.endDate) {
    whereConditions.push(lte(payments.paymentDate, options.endDate));
  }

  if (options.clientId) {
    whereConditions.push(eq(payments.clientId, options.clientId));
  }

  if (options.paymentMethod) {
    whereConditions.push(eq(payments.paymentMethod, options.paymentMethod as any));
  }

  const summary = await db
    .select({
      totalPayments: count(),
      totalAmount: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(and(...whereConditions));

  return summary[0];
};
