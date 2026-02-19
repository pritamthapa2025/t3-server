import {
  count,
  eq,
  desc,
  and,
  or,
  like,
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
  invoiceDocuments,
  invoiceHistory,
} from "../drizzle/schema/invoicing.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";
import { organizations } from "../drizzle/schema/client.schema.js";
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
    const price = parseFloat(item.quotedPrice || "0");

    const itemSubtotal = qty * price;
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

  // Get total payments (all non-deleted payments count as completed)
  const paymentsResult = await db
    .select({
      totalPaid: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.invoiceId, invoiceId),
        eq(payments.isDeleted, false),
      ),
    );

  const amountPaid = parseFloat(paymentsResult[0]?.totalPaid || "0");
  const balanceDue = Math.max(0, totalAmount - amountPaid);

  // Update invoice
  await db
    .update(invoices)
    .set({
      lineItemSubTotal: finalSubtotal.toFixed(2),
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
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    dueDateStart?: string;
    dueDateEnd?: string;
    jobId?: string;
  },
) => {
  const page = options?.page || 1;
  const limit = Math.min(options?.limit || 10, 100);
  const offset = (page - 1) * limit;

  let whereConditions: any[] = [eq(invoices.isDeleted, false)];

  // Filter by status
  if (options?.status) {
    whereConditions.push(eq(invoices.status, options.status as any));
  }

  // Filter by date range (invoice date)
  if (options?.startDate) {
    whereConditions.push(gte(invoices.invoiceDate, options.startDate));
  }
  if (options?.endDate) {
    whereConditions.push(lte(invoices.invoiceDate, options.endDate));
  }

  // Filter by due date range
  if (options?.dueDateStart) {
    whereConditions.push(gte(invoices.dueDate, options.dueDateStart));
  }
  if (options?.dueDateEnd) {
    whereConditions.push(lte(invoices.dueDate, options.dueDateEnd));
  }

  // Filter by jobId
  if (options?.jobId) {
    whereConditions.push(eq(invoices.jobId, options.jobId));
  }

  // Filter by search (invoice number or billing address)
  if (options?.search) {
    whereConditions.push(
      or(
        like(invoices.invoiceNumber, `%${options.search}%`),
        like(invoices.billingAddressLine1, `%${options.search}%`),
        like(invoices.billingCity, `%${options.search}%`),
      ),
    );
  }

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

  // Select invoices with user names and organization name (job → bid → organization)
  const [invoicesResult, totalResult] = await Promise.all([
    db
      .select({
        invoice: {
          ...invoices,
          createdByName: createdByUser.fullName,
          approvedByName: approvedByUser.fullName,
          organizationName: organizations.name,
        },
      })
      .from(invoices)
      .leftJoin(createdByUser, eq(invoices.createdBy, createdByUser.id))
      .leftJoin(approvedByUser, eq(invoices.approvedBy, approvedByUser.id))
      .leftJoin(jobs, eq(invoices.jobId, jobs.id))
      .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .leftJoin(organizations, eq(bidsTable.organizationId, organizations.id))
      .where(whereClause)
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(invoices).where(whereClause),
  ]);

  // Extract invoices from wrapped result
  const invoicesList = invoicesResult.map((item) => {
    const { createdByName, approvedByName, organizationName, ...invoice } = item.invoice;
    return {
      ...invoice,
      createdByName: createdByName ?? null,
      approvedByName: approvedByName ?? null,
      organizationName: organizationName ?? null,
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
  // Get organizationId and organization name from invoice's job → bid → organization
  const invoiceWithOrg = await db
    .select({
      invoice: invoices,
      organizationId: bidsTable.organizationId,
      organizationName: organizations.name,
    })
    .from(invoices)
    .leftJoin(jobs, eq(invoices.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(organizations, eq(bidsTable.organizationId, organizations.id))
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
  const organizationName = invoiceWithOrg[0].organizationName ?? null;

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
    organizationName,
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
  organizationId?: string;
  clientId?: string;
  jobId?: string;
  bidId?: string;
  invoiceType?: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms?: string;
  paymentTermsDays?: number;
  // Financial fields - all passed from body (no auto-calculation)
  lineItemSubTotal?: string;
  poSubTotal?: string;
  jobSubtotal?: string;
  taxRate?: string;
  taxAmount?: string;
  discountAmount?: string;
  discountType?: "percentage" | "fixed";
  discountValue?: string;
  totalAmount?: string;
  amountPaid?: string;
  balanceDue?: string;
  
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
  purchaseOrderIds?: string[] | null;
  isLabor?: boolean;
  isTravel?: boolean;
  isOperatingExpense?: boolean;
  isMaterial?: boolean;
  lineItems: Array<{
    title: string;
    istitledisabled?: boolean;
    description: string;
    itemType?: string;
    quantity?: string;
    quotedPrice: string;
    billingPercentage?: string;
    billedTotal?: string;
    notes?: string;
    sortOrder?: number;
  }>;
  createdBy: string;
}) => {
  return await db.transaction(async (tx) => {
    let organizationId = data.organizationId;
    let clientId = data.clientId;
    let finalJobId = data.jobId;

    // Derive organizationId and clientId if not provided
    if (!organizationId || !clientId) {
      if (data.jobId) {
        // Get from job → bid
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

        organizationId = bid.organizationId;
        clientId = bid.organizationId; // In this system, organizationId from bid IS the clientId
      } else if (data.bidId) {
        // Get from bid directly
        const [bid] = await tx
          .select({ organizationId: bidsTable.organizationId })
          .from(bidsTable)
          .where(eq(bidsTable.id, data.bidId))
          .limit(1);

        if (!bid?.organizationId) {
          throw new Error(
            "Bid not found or bid does not have a valid organizationId",
          );
        }

        organizationId = bid.organizationId;
        clientId = bid.organizationId; // In this system, organizationId from bid IS the clientId
      } else {
        throw new Error(
          "Either jobId or bidId must be provided to derive organizationId and clientId",
        );
      }
    }

    if (!organizationId) {
      throw new Error(
        "Unable to determine organizationId. Please provide jobId, bidId, or organizationId explicitly.",
      );
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(organizationId);

    // Create invoice
    const invoiceResult = await tx
      .insert(invoices)
      .values({
        invoiceNumber,
        jobId: finalJobId || null,
        invoiceType: (data.invoiceType as any) || "standard",
        status: "draft",
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        paymentTerms: data.paymentTerms || null,
        paymentTermsDays: data.paymentTermsDays || null,
        
        // All financial and linked IDs from body (no auto-calculation)
        lineItemSubTotal: data.lineItemSubTotal || "0",
        poSubTotal: data.poSubTotal || "0",
        jobSubtotal: data.jobSubtotal || "0",
        taxRate: data.taxRate || "0",
        taxAmount: data.taxAmount || "0",
        discountAmount: data.discountAmount || "0",
        discountType: data.discountType || null,
        discountValue: data.discountValue || null,
        totalAmount: data.totalAmount || "0",
        amountPaid: data.amountPaid || "0",
        balanceDue: data.balanceDue || "0",
        purchaseOrderIds: data.purchaseOrderIds ?? null,
        isLabor: data.isLabor ?? false,
        isTravel: data.isTravel ?? false,
        isOperatingExpense: data.isOperatingExpense ?? false,
        isMaterial: data.isMaterial ?? false,
        
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
      })
      .returning();

    const invoice = Array.isArray(invoiceResult)
      ? invoiceResult[0]
      : (invoiceResult as any);
    if (!invoice) {
      throw new Error("Failed to create invoice");
    }

    // Create line items (store exactly what is passed, no calculation)
    for (const item of data.lineItems) {
      await tx.insert(invoiceLineItems).values({
        invoiceId: invoice.id,
        title: item.title,
        istitledisabled: item.istitledisabled ?? false,
        description: item.description,
        itemType: item.itemType || null,
        quantity: item.quantity || "1",
        quotedPrice: item.quotedPrice,
        billingPercentage: item.billingPercentage ?? "100",
        billedTotal: item.billedTotal ?? item.quotedPrice,
        notes: item.notes || null,
        sortOrder: item.sortOrder || 0,
      });
    }

    // No auto-calculation: all data is passed from body

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

  // Return invoice with line items included
  return await getInvoiceById(invoiceId, organizationId, {
    includeLineItems: true,
    includePayments: false,
    includeDocuments: false,
    includeHistory: false,
  });
};

/**
 * Create invoice line item
 */
export const createInvoiceLineItem = async (
  invoiceId: string,
  organizationId: string,
  data: {
    description: string;
    istitledisabled?: boolean;
    itemType?: string;
    quantity?: string;
    quotedPrice: string;
    notes?: string;
    sortOrder?: number;
  },
) => {
  const invoice = await getInvoiceById(invoiceId, organizationId, {
    includeLineItems: false,
    includePayments: false,
    includeDocuments: false,
  });
  if (!invoice) {
    return null;
  }

  const title = (data.description || "").slice(0, 255) || "Line item";
  const quantity = data.quantity ?? "1";
  const quotedPrice = data.quotedPrice;

  const [inserted] = await db
    .insert(invoiceLineItems)
    .values({
      invoiceId,
      title,
      istitledisabled: data.istitledisabled ?? false,
      description: data.description ?? null,
      itemType: data.itemType ?? null,
      quantity,
      quotedPrice: quotedPrice,
      billedTotal: quotedPrice,
      notes: data.notes ?? null,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();

  await recalculateInvoiceTotals(invoiceId);
  return inserted ?? null;
};

/**
 * Update invoice line item
 */
export const updateInvoiceLineItem = async (
  invoiceId: string,
  lineItemId: string,
  organizationId: string,
  data: Partial<{
    description: string;
    istitledisabled: boolean;
    itemType: string;
    quantity: string;
    quotedPrice: string;
    notes: string;
    sortOrder: number;
  }>,
) => {
  const invoice = await getInvoiceById(invoiceId, organizationId, {
    includeLineItems: true,
    includePayments: false,
    includeDocuments: false,
  });
  if (!invoice) {
    return null;
  }

  const existing = (invoice.lineItems as any[]).find(
    (li: { id: string }) => li.id === lineItemId,
  );
  if (!existing) {
    return null;
  }

  const quantity = data.quantity ?? existing.quantity ?? "1";
  const quotedPrice = data.quotedPrice ?? existing.quotedPrice ?? "0";

  const updatePayload: Record<string, unknown> = {
    quantity,
    quotedPrice: quotedPrice,
    billedTotal: quotedPrice,
    updatedAt: new Date(),
  };
  if (data.description !== undefined) {
    updatePayload.title = data.description.slice(0, 255) || existing.title;
    updatePayload.description = data.description;
  }
  if (data.istitledisabled !== undefined) updatePayload.istitledisabled = data.istitledisabled;
  if (data.itemType !== undefined) updatePayload.itemType = data.itemType;
  if (data.notes !== undefined) updatePayload.notes = data.notes;
  if (data.sortOrder !== undefined) updatePayload.sortOrder = data.sortOrder;

  const [updated] = await db
    .update(invoiceLineItems)
    .set(updatePayload as any)
    .where(
      and(
        eq(invoiceLineItems.id, lineItemId),
        eq(invoiceLineItems.invoiceId, invoiceId),
        eq(invoiceLineItems.isDeleted, false),
      ),
    )
    .returning();

  await recalculateInvoiceTotals(invoiceId);
  return updated ?? null;
};

/**
 * Delete invoice line item (soft delete)
 */
export const deleteInvoiceLineItem = async (
  invoiceId: string,
  lineItemId: string,
  organizationId: string,
) => {
  const invoice = await getInvoiceById(invoiceId, organizationId, {
    includeLineItems: true,
    includePayments: false,
    includeDocuments: false,
  });
  if (!invoice) {
    return null;
  }

  const existing = (invoice.lineItems as any[]).find(
    (li: { id: string }) => li.id === lineItemId,
  );
  if (!existing) {
    return null;
  }

  const [updated] = await db
    .update(invoiceLineItems)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(
      and(
        eq(invoiceLineItems.id, lineItemId),
        eq(invoiceLineItems.invoiceId, invoiceId),
      ),
    )
    .returning();

  await recalculateInvoiceTotals(invoiceId);
  return updated ?? null;
};

/**
 * Delete invoice (soft delete)
 */
export const deleteInvoice = async (
  invoiceId: string,
  organizationId: string,
  deletedBy: string,
) => {
  const now = new Date();

  // Cascade soft-delete line items and documents (in parallel)
  await Promise.all([
    db.update(invoiceLineItems).set({ isDeleted: true, updatedAt: now }).where(and(eq(invoiceLineItems.invoiceId, invoiceId), eq(invoiceLineItems.isDeleted, false))),
    db.update(invoiceDocuments).set({ isDeleted: true }).where(and(eq(invoiceDocuments.invoiceId, invoiceId), eq(invoiceDocuments.isDeleted, false))),
  ]);

  await db
    .update(invoices)
    .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
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
    totalInvoiced: parseFloat(totalAmount.toFixed(2)),
    invoiceCount: totalInvoices,
    totalPaid: parseFloat(totalPaid.toFixed(2)),
    collectionRate: parseFloat(collectionRate.toFixed(1)),
    outstanding: parseFloat(totalOutstanding.toFixed(2)),
    overdue: parseFloat(overdueAmount.toFixed(2)),
    overdueCount: overdueCount,
    avgInvoice: parseFloat(avgInvoice.toFixed(2)),
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

// ============================
// SIMPLIFIED PAYMENT SERVICES (for Invoice-scoped payments)
// ============================

/**
 * Get all payments for an invoice
 */
export const getPaymentsByInvoice = async (
  invoiceId: string,
  organizationId?: string,
) => {
  // Verify invoice exists and belongs to organization
  const invoice = await getInvoiceById(invoiceId, organizationId, {
    includeLineItems: false,
    includePayments: false,
    includeDocuments: false,
    includeHistory: false,
  });

  if (!invoice) {
    return null;
  }

  // Alias for createdBy user
  const createdByUser = alias(users, "created_by_user");

  const paymentsResult = await db
    .select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      invoiceId: payments.invoiceId,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      paymentMethod: payments.paymentMethod,
      referenceNumber: payments.referenceNumber,
      notes: payments.notes,
      createdBy: payments.createdBy,
      isDeleted: payments.isDeleted,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
      createdByName: createdByUser.fullName,
    })
    .from(payments)
    .leftJoin(createdByUser, eq(payments.createdBy, createdByUser.id))
    .where(and(eq(payments.invoiceId, invoiceId), eq(payments.isDeleted, false)))
    .orderBy(desc(payments.paymentDate));

  return paymentsResult.map((p) => ({
    ...p,
    createdByName: p.createdByName ?? null,
  }));
};

/**
 * Create payment for an invoice
 */
export const createPaymentForInvoice = async (
  invoiceId: string,
  organizationId: string | undefined,
  data: {
    amount: string;
    paymentDate: string;
    paymentMethod: string;
    referenceNumber?: string;
    notes?: string;
  },
  createdBy: string,
) => {
  const payment = await db.transaction(async (tx) => {
    // Get invoice to validate and get client/organization
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.isDeleted, false)));

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (!invoice.jobId) {
      throw new Error("Invoice must be associated with a job to create payment");
    }

    // Get organizationId from job's bid
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
      throw new Error("Cannot determine organizationId. Bid must have a valid organizationId.");
    }

    // Verify organization matches if provided
    if (organizationId && bid.organizationId !== organizationId) {
      throw new Error("Organization mismatch");
    }

    const paymentNumber = await generatePaymentNumber(bid.organizationId);

    // Create payment
    const [payment] = await tx
      .insert(payments)
      .values({
        paymentNumber,
        invoiceId,
        amount: data.amount,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod as any,
        referenceNumber: data.referenceNumber || null,
        notes: data.notes || null,
        createdBy,
      })
      .returning();

    return payment;
  });

  // Recalculate invoice totals AFTER transaction commits
  await recalculateInvoiceTotals(invoiceId);

  return payment;
};

/**
 * Get payment by ID (scoped to invoice)
 */
export const getPaymentByIdForInvoice = async (
  paymentId: string,
  invoiceId: string,
  organizationId?: string,
) => {
  // Verify invoice exists and belongs to organization
  const invoice = await getInvoiceById(invoiceId, organizationId, {
    includeLineItems: false,
    includePayments: false,
    includeDocuments: false,
    includeHistory: false,
  });

  if (!invoice) {
    return null;
  }

  const createdByUser = alias(users, "created_by_user");

  const [payment] = await db
    .select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      invoiceId: payments.invoiceId,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      paymentMethod: payments.paymentMethod,
      referenceNumber: payments.referenceNumber,
      notes: payments.notes,
      createdBy: payments.createdBy,
      isDeleted: payments.isDeleted,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
      createdByName: createdByUser.fullName,
    })
    .from(payments)
    .leftJoin(createdByUser, eq(payments.createdBy, createdByUser.id))
    .where(
      and(
        eq(payments.id, paymentId),
        eq(payments.invoiceId, invoiceId),
        eq(payments.isDeleted, false),
      ),
    )
    .limit(1);

  if (!payment) {
    return null;
  }

  return {
    ...payment,
    createdByName: payment.createdByName ?? null,
  };
};

/**
 * Update payment for an invoice
 */
export const updatePaymentForInvoice = async (
  paymentId: string,
  invoiceId: string,
  organizationId: string | undefined,
  data: Partial<{
    amount: string;
    paymentDate: string;
    paymentMethod: string;
    referenceNumber: string;
    notes: string;
  }>,
) => {
  // Verify payment exists and belongs to invoice
  const payment = await getPaymentByIdForInvoice(paymentId, invoiceId, organizationId);

  if (!payment) {
    return null;
  }

  const updateData: any = { updatedAt: new Date() };
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.paymentDate !== undefined) updateData.paymentDate = data.paymentDate;
  if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
  if (data.referenceNumber !== undefined) updateData.referenceNumber = data.referenceNumber;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const [updated] = await db
    .update(payments)
    .set(updateData)
    .where(eq(payments.id, paymentId))
    .returning();

  // Recalculate invoice totals if amount changed
  if (data.amount !== undefined) {
    await recalculateInvoiceTotals(invoiceId);
  }

  return updated;
};

/**
 * Delete payment for an invoice (soft delete)
 */
export const deletePaymentForInvoice = async (
  paymentId: string,
  invoiceId: string,
  organizationId: string | undefined,
) => {
  // Verify payment exists and belongs to invoice
  const payment = await getPaymentByIdForInvoice(paymentId, invoiceId, organizationId);

  if (!payment) {
    return null;
  }

  await db
    .update(payments)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(payments.id, paymentId));

  // Recalculate invoice totals AFTER deletion
  await recalculateInvoiceTotals(invoiceId);

  return { success: true };
};

// ===========================================================================
// Bulk Delete
// ===========================================================================

export const bulkDeleteInvoices = async (ids: string[], deletedBy: string) => {
  const now = new Date();
  const result = await db
    .update(invoices)
    .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
    .where(and(inArray(invoices.id, ids), eq(invoices.isDeleted, false)))
    .returning({ id: invoices.id });
  return { deleted: result.length, skipped: ids.length - result.length };
};
