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
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { alias } from "drizzle-orm/pg-core";

// ============================
// Helper Functions
// ============================

/**
 * Generate invoice number using atomic database function
 * Format: INV-YYYY-#####
 */
const generateInvoiceNumber = async (
  organizationId: string,
): Promise<string> => {
  try {
    const result = await db.execute<{ next_value: string }>(
      sql.raw(
        `SELECT org.get_next_counter('${organizationId}'::uuid, 'invoice_number') as next_value`,
      ),
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
      .where(like(invoices.invoiceNumber, `${prefix}%`));
    const maxInvoiceNumber = maxResult[0]?.maxInvoiceNumber;
    let nextNumber = 1;
    if (maxInvoiceNumber) {
      const match = maxInvoiceNumber.match(
        new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)`),
      );
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
const generatePaymentNumber = async (
  organizationId: string,
): Promise<string> => {
  try {
    const result = await db.execute<{ next_value: string }>(
      sql.raw(
        `SELECT org.get_next_counter('${organizationId}'::uuid, 'payment_number') as next_value`,
      ),
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
      .where(like(payments.paymentNumber, `${prefix}%`));
    const maxPaymentNumber = maxResult[0]?.maxPaymentNumber;
    let nextNumber = 1;
    if (maxPaymentNumber) {
      const match = maxPaymentNumber.match(
        new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)`),
      );
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
  taxRate: string,
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
      and(
        eq(invoiceLineItems.invoiceId, invoiceId),
        eq(invoiceLineItems.isDeleted, false),
      ),
    );

  // Get invoice first to get taxRate
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId));

  if (!invoice) return;

  // Use invoice-level taxRate for all line items
  const invoiceTaxRate = parseFloat(invoice.taxRate || "0");

  let subtotal = 0;
  let totalTax = 0;

  for (const item of lineItems) {
    const qty = parseFloat(item.quantity || "1");
    const price = parseFloat(item.unitPrice || "0");
    const discount = parseFloat(item.discountAmount || "0");

    const itemSubtotal = qty * price - discount;
    const itemTax = itemSubtotal * invoiceTaxRate;

    subtotal += itemSubtotal;
    totalTax += itemTax;
  }

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
        or(eq(payments.status, "completed"), eq(payments.status, "processing")),
      ),
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
  performedBy: string,
  action: string,
  oldValue?: string,
  newValue?: string,
  description?: string,
) => {
  return await db.insert(invoiceHistory).values({
    invoiceId,
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
 * Get invoices with line items and pagination
 */
export const getInvoices = async (
  organizationId?: string,
  options?: {
    page?: number;
    limit?: number;
  },
) => {
  const page = options?.page || 1;
  const limit = Math.min(options?.limit || 10, 100);
  const offset = (page - 1) * limit;

  let whereConditions: any[] = [eq(invoices.isDeleted, false)];

  // Filter by organizationId through job → bid → organizationId
  if (organizationId) {
    // Get job IDs for this organization through job → bid relationship
    const jobIdsResult = await db
      .select({ id: jobs.id })
      .from(jobs)
      .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(eq(bidsTable.organizationId, organizationId));

    const jobIds = jobIdsResult.map((j) => j.id);

    if (jobIds.length > 0) {
      whereConditions.push(inArray(invoices.jobId, jobIds));
    } else {
      // If no jobs found for this organization, return empty result
      return {
        invoices: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
  }

  const whereClause = and(...whereConditions);

  // Aliases for joining users table multiple times
  const createdByUser = alias(users, "created_by_user");
  const approvedByUser = alias(users, "approved_by_user");

  // Select invoices with user names
  const [invoicesResult, totalResult] = await Promise.all([
    db
      .select({
        invoice: {
          ...invoices,
          createdByName: createdByUser.fullName,
          approvedByName: approvedByUser.fullName,
        },
      })
      .from(invoices)
      .leftJoin(createdByUser, eq(invoices.createdBy, createdByUser.id))
      .leftJoin(approvedByUser, eq(invoices.approvedBy, approvedByUser.id))
      .where(whereClause)
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(invoices).where(whereClause),
  ]);

  // Extract invoices from wrapped result
  const invoicesList = invoicesResult.map((item) => {
    const { createdByName, approvedByName, ...invoice } = item.invoice;
    return {
      ...invoice,
      createdByName: createdByName ?? null,
      approvedByName: approvedByName ?? null,
    };
  });

  // Get line items for each invoice
  const invoicesWithLineItems = await Promise.all(
    invoicesList.map(async (invoice: any) => {
      const lineItems = await db
        .select()
        .from(invoiceLineItems)
        .where(
          and(
            eq(invoiceLineItems.invoiceId, invoice.id),
            eq(invoiceLineItems.isDeleted, false),
          ),
        )
        .orderBy(invoiceLineItems.sortOrder);

      return {
        ...invoice,
        lineItems,
      };
    }),
  );

  const total = totalResult[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    invoices: invoicesWithLineItems,
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
  organizationId?: string,
  options?: {
    includeLineItems?: boolean;
    includePayments?: boolean;
    includeDocuments?: boolean;
    includeHistory?: boolean;
  },
) => {
  // Get organizationId from invoice's job → bid
  const invoiceWithOrg = await db
    .select({
      invoice: invoices,
      organizationId: bidsTable.organizationId,
    })
    .from(invoices)
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.isDeleted, false)))
    .limit(1);

  if (!invoiceWithOrg[0] || !invoiceWithOrg[0].invoice) {
    return null;
  }

  // Verify organizationId matches if provided
  if (organizationId && invoiceWithOrg[0].organizationId !== organizationId) {
    return null;
  }

  const _invoice = invoiceWithOrg[0].invoice;
  const invoiceOrganizationId = invoiceWithOrg[0].organizationId;

  // Aliases for joining users table multiple times
  const createdByUser = alias(users, "created_by_user");
  const approvedByUser = alias(users, "approved_by_user");

  // Get invoice with user names
  const [invoiceWithNames] = await db
    .select({
      ...invoices,
      createdByName: createdByUser.fullName,
      approvedByName: approvedByUser.fullName,
    })
    .from(invoices)
    .leftJoin(createdByUser, eq(invoices.createdBy, createdByUser.id))
    .leftJoin(approvedByUser, eq(invoices.approvedBy, approvedByUser.id))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.isDeleted, false)))
    .limit(1);

  if (!invoiceWithNames) {
    return null;
  }

  const { createdByName, approvedByName, ...invoiceData } = invoiceWithNames;

  const result: any = {
    ...invoiceData,
    createdByName: createdByName ?? null,
    approvedByName: approvedByName ?? null,
    organizationId: invoiceOrganizationId,
  };

  if (options?.includeLineItems !== false) {
    result.lineItems = await db
      .select()
      .from(invoiceLineItems)
      .where(
        and(
          eq(invoiceLineItems.invoiceId, invoiceId),
          eq(invoiceLineItems.isDeleted, false),
        ),
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
        and(eq(payments.invoiceId, invoiceId), eq(payments.isDeleted, false)),
      )
      .orderBy(desc(payments.paymentDate));
  }

  if (options?.includeDocuments !== false) {
    const documentsResult = await db
      .select({
        document: invoiceDocuments,
        uploadedByName: users.fullName,
      })
      .from(invoiceDocuments)
      .leftJoin(users, eq(invoiceDocuments.uploadedBy, users.id))
      .where(
        and(
          eq(invoiceDocuments.invoiceId, invoiceId),
          eq(invoiceDocuments.isDeleted, false),
        ),
      )
      .orderBy(desc(invoiceDocuments.createdAt));

    result.documents = documentsResult.map((doc) => ({
      ...doc.document,
      uploadedByName: doc.uploadedByName || null,
    }));
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
export const createInvoice = async (data: {
  jobId: string;
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
    title: string;
    description: string;
    itemType?: string;
    quantity?: string;
    unitPrice: string;
    discountAmount?: string;
    notes?: string;
    sortOrder?: number;
  }>;
  createdBy: string;
}) => {
  return await db.transaction(async (tx) => {
    // Get organizationId from job → bid → organizationId
    const [job] = await tx
      .select({ bidId: jobs.bidId })
      .from(jobs)
      .where(eq(jobs.id, data.jobId))
      .limit(1);

    if (!job?.bidId) {
      throw new Error("Job not found or job does not have a valid bidId");
    }

    const [bid] = await tx
      .select({ organizationId: bidsTable.organizationId })
      .from(bidsTable)
      .where(eq(bidsTable.id, job.bidId))
      .limit(1);

    if (!bid?.organizationId) {
      throw new Error(
        "Bid not found or bid does not have a valid organizationId",
      );
    }

    const organizationId = bid.organizationId;

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(organizationId);

    // Create invoice
    const invoiceResult = await tx
      .insert(invoices)
      .values({
        invoiceNumber,
        jobId: data.jobId,
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

    const invoice = Array.isArray(invoiceResult)
      ? invoiceResult[0]
      : (invoiceResult as any);
    if (!invoice) {
      throw new Error("Failed to create invoice");
    }

    // Get invoice tax rate (use invoice-level taxRate for all line items)
    const invoiceTaxRate = data.taxRate || "0";

    // Create line items
    for (const item of data.lineItems) {
      const { lineTotal, taxAmount } = calculateLineItemTotal(
        item.quantity || "1",
        item.unitPrice,
        item.discountAmount || "0",
        invoiceTaxRate,
      );

      await tx.insert(invoiceLineItems).values({
        invoiceId: invoice.id,
        title: item.title,
        description: item.description,
        itemType: item.itemType || null,
        quantity: item.quantity || "1",
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount || "0",
        taxAmount,
        lineTotal,
        notes: item.notes || null,
        sortOrder: item.sortOrder || 0,
      });
    }

    return { invoiceId: invoice.id, organizationId };
  });
};

/**
 * Update invoice
 */
export const updateInvoice = async (
  invoiceId: string,
  organizationId: string,
  data: any,
  _updatedBy: string,
) => {
  const invoice = await getInvoiceById(invoiceId, organizationId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const updateData: any = { updatedAt: new Date() };
  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined) {
      updateData[key] = data[key];
    }
  });

  await db.update(invoices).set(updateData).where(eq(invoices.id, invoiceId));

  // Recalculate totals if financial fields changed
  if (
    data.taxRate !== undefined ||
    data.discountType !== undefined ||
    data.discountValue !== undefined
  ) {
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
  deletedBy: string,
) => {
  await db
    .update(invoices)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));

  await createInvoiceHistoryEntry(
    invoiceId,
    deletedBy,
    "deleted",
    undefined,
    undefined,
    "Invoice deleted",
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
  performedBy: string,
) => {
  const paidDateStr = data.paidDate || new Date().toISOString().split("T")[0];

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
    performedBy,
    "marked_paid",
    undefined,
    paidDateStr,
    data.notes || "Invoice marked as paid",
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
  performedBy: string,
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
    performedBy,
    "voided",
    undefined,
    data.reason,
    data.notes || `Invoice voided: ${data.reason}`,
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
  organizationId: string | undefined,
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
  },
) => {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 10, 100);
  const offset = (page - 1) * limit;

  // Get invoice IDs for this organization through invoice → job → bid relationship
  let whereConditions: any[] = [];

  if (organizationId) {
    // Validate organizationId is a valid UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(organizationId)) {
      throw new Error(
        `Invalid organizationId format: "${organizationId}". Expected a valid UUID.`,
      );
    }

    // Get job IDs for this organization
    const jobIdsResult = await db
      .select({ id: jobs.id })
      .from(jobs)
      .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(eq(bidsTable.organizationId, organizationId));

    const jobIds = jobIdsResult.map((j) => j.id);

    if (jobIds.length > 0) {
      // Get invoice IDs for these jobs
      const invoiceIdsResult = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(inArray(invoices.jobId, jobIds));

      const invoiceIds = invoiceIdsResult.map((i) => i.id);

      if (invoiceIds.length > 0) {
        whereConditions.push(inArray(payments.invoiceId, invoiceIds));
      } else {
        // No invoices for this organization, return empty result
        return {
          payments: [],
          pagination: {
            page: 1,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }
    } else {
      // No jobs for this organization, return empty result
      return {
        payments: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
  }

  if (!options.includeDeleted) {
    whereConditions.push(eq(payments.isDeleted, false));
  }

  if (options.status) {
    whereConditions.push(eq(payments.status, options.status as any));
  }

  if (options.paymentMethod) {
    whereConditions.push(
      eq(payments.paymentMethod, options.paymentMethod as any),
    );
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
        ilike(payments.transactionId, searchTerm),
      )!,
    );
  }

  const orderBy =
    options.sortBy === "paymentDate"
      ? options.sortOrder === "asc"
        ? asc(payments.paymentDate)
        : desc(payments.paymentDate)
      : options.sortBy === "receivedDate"
        ? options.sortOrder === "asc"
          ? asc(payments.receivedDate)
          : desc(payments.receivedDate)
        : options.sortBy === "amount"
          ? options.sortOrder === "asc"
            ? asc(payments.amount)
            : desc(payments.amount)
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

  // Get unique creator IDs and fetch their names in batch
  const creatorIds = Array.from(
    new Set(
      paymentsList.map((p) => p.createdBy).filter((id): id is string => !!id),
    ),
  );
  const creators =
    creatorIds.length > 0
      ? await db
          .select({
            id: users.id,
            fullName: users.fullName,
          })
          .from(users)
          .where(inArray(users.id, creatorIds))
      : [];
  const creatorMap = new Map(creators.map((c) => [c.id, c.fullName]));

  return {
    payments: paymentsList.map((payment) => ({
      ...payment,
      createdByName: payment.createdBy
        ? creatorMap.get(payment.createdBy) || null
        : null,
    })),
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
  organizationId?: string,
  options?: {
    includeAllocations?: boolean;
    includeDocuments?: boolean;
    includeHistory?: boolean;
  },
) => {
  // Get payment and verify it belongs to the organization through invoice → job → bid
  const [payment] = await db
    .select({
      payment: payments,
      organizationId: bidsTable.organizationId,
    })
    .from(payments)
    .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(payments.id, paymentId), eq(payments.isDeleted, false)))
    .limit(1);

  if (!payment || !payment.payment) return null;

  // Verify organizationId matches if provided
  if (organizationId && payment.organizationId !== organizationId) {
    return null;
  }

  // Get createdBy user name
  let createdByName: string | null = null;
  if (payment.payment.createdBy) {
    const [creator] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, payment.payment.createdBy))
      .limit(1);
    createdByName = creator?.fullName || null;
  }

  const result: any = {
    ...payment.payment,
    createdByName,
  };

  if (options?.includeAllocations !== false) {
    result.allocations = await db
      .select()
      .from(paymentAllocations)
      .where(
        and(
          eq(paymentAllocations.paymentId, paymentId),
          eq(paymentAllocations.isDeleted, false),
        ),
      );
  }

  if (options?.includeDocuments !== false) {
    const documentsResult = await db
      .select({
        document: paymentDocuments,
        uploadedByName: users.fullName,
      })
      .from(paymentDocuments)
      .leftJoin(users, eq(paymentDocuments.uploadedBy, users.id))
      .where(
        and(
          eq(paymentDocuments.paymentId, paymentId),
          eq(paymentDocuments.isDeleted, false),
        ),
      )
      .orderBy(desc(paymentDocuments.createdAt));

    result.documents = documentsResult.map((doc) => ({
      ...doc.document,
      uploadedByName: doc.uploadedByName || null,
    }));
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
export const createPayment = async (data: any, createdBy: string) => {
  return await db.transaction(async (tx) => {
    // Get invoice to validate and get client/organization
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, data.invoiceId));

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (!invoice.jobId) {
      throw new Error(
        "Invoice must be associated with a job to create payment",
      );
    }

    // Get organizationId and clientId from job's bid
    const [job] = await tx
      .select({ bidId: jobs.bidId })
      .from(jobs)
      .where(eq(jobs.id, invoice.jobId))
      .limit(1);

    if (!job?.bidId) {
      throw new Error("Job must have a valid bid to create payment");
    }

    const [bid] = await tx
      .select({ organizationId: bidsTable.organizationId })
      .from(bidsTable)
      .where(eq(bidsTable.id, job.bidId))
      .limit(1);

    if (!bid?.organizationId) {
      throw new Error(
        "Cannot determine organizationId. Bid must have a valid organizationId.",
      );
    }

    const clientId = bid.organizationId; // Client is the organization
    const organizationId = bid.organizationId; // For payment number generation

    const paymentNumber = await generatePaymentNumber(organizationId);

    const paymentResult = await tx
      .insert(payments)
      .values({
        paymentNumber,
        clientId,
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

    const payment = Array.isArray(paymentResult)
      ? paymentResult[0]
      : (paymentResult as any);
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
  organizationId: string | undefined,
  data: any,
  _updatedBy: string,
) => {
  const updateData: any = { updatedAt: new Date() };
  Object.keys(data).forEach((key) => {
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
  _organizationId: string | undefined,
  _deletedBy: string,
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
 * Get invoice KPIs
 */
export const getInvoiceKPIs = async (
  organizationId: string | undefined,
  options: {
    startDate?: string;
    endDate?: string;
    status?: string;
  },
) => {
  let whereConditions: any[] = [eq(invoices.isDeleted, false)];

  // Filter by organizationId if provided
  if (organizationId) {
    // Validate organizationId is a valid UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(organizationId)) {
      throw new Error(
        `Invalid organizationId format: "${organizationId}". Expected a valid UUID.`,
      );
    }

    // Get job IDs for this organization through job → bid relationship
    const jobIdsResult = await db
      .select({ id: jobs.id })
      .from(jobs)
      .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(eq(bidsTable.organizationId, organizationId));

    const jobIds = jobIdsResult.map((j) => j.id);

    // Filter by jobIds if we have any
    if (jobIds.length > 0) {
      whereConditions.push(inArray(invoices.jobId, jobIds));
    } else {
      // If no jobs found for this organization, return empty KPIs
      return {
        totalInvoiced: "0",
        invoiceCount: 0,
        totalPaid: "0",
        collectionRate: "0.0",
        outstanding: "0",
        overdue: "0",
        overdueCount: 0,
        avgInvoice: "0",
      };
    }
  }
  // If organizationId is not provided, return KPIs for all invoices

  if (options.startDate) {
    whereConditions.push(gte(invoices.invoiceDate, options.startDate));
  }

  if (options.endDate) {
    whereConditions.push(lte(invoices.invoiceDate, options.endDate));
  }

  if (options.status) {
    whereConditions.push(eq(invoices.status, options.status as any));
  }

  // Get current date for overdue calculation
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all KPIs in parallel
  const [summary, overdueResult] = await Promise.all([
    // Main summary
    db
      .select({
        totalInvoices: count(),
        totalAmount: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
        totalPaid: sql<string>`COALESCE(SUM(${invoices.amountPaid}), 0)`,
        totalOutstanding: sql<string>`COALESCE(SUM(${invoices.balanceDue}), 0)`,
      })
      .from(invoices)
      .where(and(...whereConditions)),
    // Overdue invoices (due date is in the past and status is not paid/cancelled/void)
    db
      .select({
        overdueCount: count(),
        overdueAmount: sql<string>`COALESCE(SUM(${invoices.balanceDue}), 0)`,
      })
      .from(invoices)
      .where(
        and(
          ...whereConditions,
          lte(invoices.dueDate, today.toISOString().split("T")[0]!),
          sql`${invoices.status} NOT IN ('paid', 'cancelled', 'void')`,
        ),
      ),
  ]);

  // count() returns a number, sql<string> returns a string
  // count() returns number, sql<string> returns string - handle accordingly
  const totalInvoices = summary[0]?.totalInvoices ?? 0;
  const totalAmount = parseFloat(summary[0]?.totalAmount ?? "0");
  const totalPaid = parseFloat(summary[0]?.totalPaid ?? "0");
  const totalOutstanding = parseFloat(summary[0]?.totalOutstanding ?? "0");
  const overdueCount = overdueResult[0]?.overdueCount ?? 0;
  const overdueAmount = parseFloat(overdueResult[0]?.overdueAmount ?? "0");

  // Calculate collection rate
  const collectionRate = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;

  // Calculate average invoice
  const avgInvoice = totalInvoices > 0 ? totalAmount / totalInvoices : 0;

  return {
    totalInvoiced: totalAmount.toFixed(2),
    invoiceCount: totalInvoices,
    totalPaid: totalPaid.toFixed(2),
    collectionRate: collectionRate.toFixed(1),
    outstanding: totalOutstanding.toFixed(2),
    overdue: overdueAmount.toFixed(2),
    overdueCount: overdueCount,
    avgInvoice: avgInvoice.toFixed(2),
  };
};

/**
 * Get payment summary
 */
export const getPaymentSummary = async (
  organizationId: string | undefined,
  options: {
    startDate?: string;
    endDate?: string;
    clientId?: string;
    paymentMethod?: string;
  },
) => {
  // Get invoice IDs for this organization through invoice → job → bid relationship
  const jobIdsResult = await db
    .select({ id: jobs.id })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(eq(bidsTable.organizationId, organizationId));

  const jobIds = jobIdsResult.map((j) => j.id);

  let whereConditions: any[] = [eq(payments.isDeleted, false)];

  // Filter by invoice IDs if we have any
  if (jobIds.length > 0) {
    const invoiceIdsResult = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(inArray(invoices.jobId, jobIds));

    const invoiceIds = invoiceIdsResult.map((i) => i.id);

    if (invoiceIds.length > 0) {
      whereConditions.push(inArray(payments.invoiceId, invoiceIds));
    } else {
      // No invoices for this organization, return empty summary
      return {
        totalPayments: 0,
        totalAmount: "0",
      };
    }
  } else {
    // No jobs for this organization, return empty summary
    return {
      totalPayments: 0,
      totalAmount: "0",
    };
  }

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
    whereConditions.push(
      eq(payments.paymentMethod, options.paymentMethod as any),
    );
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
