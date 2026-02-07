import {
  count,
  eq,
  and,
  desc,
  asc,
  gte,
  lte,
  ilike,
  getTableColumns,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../config/db.js";
import {
  expenseCategories,
  expenses,
  expenseHistory,
  expenseReceipts,
} from "../drizzle/schema/expenses.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";

// ============================
// Expense Categories
// ============================

export async function getExpenseCategories(
  _organizationId: string | undefined,
  offset: number,
  limit: number,
  filters?: Record<string, unknown>,
) {
  const whereConditions = [eq(expenseCategories.isDeleted, false)];
  if (filters?.search) {
    whereConditions.push(
      ilike(expenseCategories.name, `%${String(filters.search)}%`),
    );
  }
  if (filters?.expenseType) {
    whereConditions.push(
      eq(expenseCategories.expenseType, filters.expenseType as string),
    );
  }
  if (filters?.isActive === true) {
    whereConditions.push(eq(expenseCategories.isActive, true));
  }
  if (filters?.isActive === false) {
    whereConditions.push(eq(expenseCategories.isActive, false));
  }

  const orderBy =
    filters?.sortBy === "name"
      ? asc(expenseCategories.name)
      : desc(expenseCategories.createdAt);
  const sortOrder = filters?.sortOrder as "asc" | "desc" | undefined;
  const finalOrder =
    sortOrder === "asc" ? asc(expenseCategories.name) : orderBy;

  const [totalRow] = await db
    .select({ total: count() })
    .from(expenseCategories)
    .where(and(...whereConditions));

  const data = await db
    .select()
    .from(expenseCategories)
    .where(and(...whereConditions))
    .orderBy(finalOrder)
    .limit(limit)
    .offset(offset);

  const total = totalRow?.total ?? 0;
  return {
    data,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getExpenseCategoryById(
  _organizationId: string | undefined,
  id: string,
) {
  const [row] = await db
    .select()
    .from(expenseCategories)
    .where(
      and(eq(expenseCategories.id, id), eq(expenseCategories.isDeleted, false)),
    )
    .limit(1);
  return row ?? null;
}

export async function createExpenseCategory(
  _organizationId: string | undefined,
  body: Record<string, unknown>,
  _userId: string,
) {
  const result = await db
    .insert(expenseCategories)
    .values({
      name: body.name as string,
      description: (body.description as string) ?? null,
      code: body.code as string,
      expenseType: body.expenseType as string,
      requiresReceipt: (body.requiresReceipt as boolean) ?? true,
      requiresApproval: (body.requiresApproval as boolean) ?? true,
      isTaxDeductible: (body.isTaxDeductible as boolean) ?? true,
      isActive: (body.isActive as boolean) ?? true,
    })
    .returning();
  const row = Array.isArray(result) ? result[0] : undefined;
  return row ?? null;
}

export async function updateExpenseCategory(
  _organizationId: string | undefined,
  id: string,
  body: Record<string, unknown>,
) {
  const [row] = await db
    .update(expenseCategories)
    .set({
      ...(body.name != null && { name: body.name as string }),
      ...(body.description !== undefined && {
        description: body.description as string | null,
      }),
      ...(body.code != null && { code: body.code as string }),
      ...(body.expenseType != null && {
        expenseType: body.expenseType as string,
      }),
      ...(body.isActive !== undefined && {
        isActive: body.isActive as boolean,
      }),
      updatedAt: new Date(),
    })
    .where(
      and(eq(expenseCategories.id, id), eq(expenseCategories.isDeleted, false)),
    )
    .returning();
  return row ?? null;
}

export async function deleteExpenseCategory(
  _organizationId: string | undefined,
  id: string,
) {
  const [row] = await db
    .update(expenseCategories)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(
      and(eq(expenseCategories.id, id), eq(expenseCategories.isDeleted, false)),
    )
    .returning();
  return row ?? null;
}

// ============================
// Expenses
// ============================

// Aliases for joining users table multiple times (createdBy, approvedBy, rejectedBy, uploadedBy)
const createdByUser = alias(users, "created_by_user");
const approvedByUser = alias(users, "approved_by_user");
const rejectedByUser = alias(users, "rejected_by_user");
const uploadedByUser = alias(users, "uploaded_by_user");

export function generateExpenseNumber(): string {
  const year = new Date().getFullYear();
  const r = Math.floor(Math.random() * 99999) + 1;
  return `EXP-${year}-${r.toString().padStart(5, "0")}`;
}

export async function getExpenses(
  organizationId: string | undefined,
  offset: number,
  limit: number,
  filters?: Record<string, unknown>,
) {
  const whereConditions = [eq(expenses.isDeleted, false)];
  // organization_id not on org.expenses; scope via employee/category/job if needed
  if (filters?.status) {
    whereConditions.push(
      eq(
        expenses.status,
        filters.status as (typeof expenses.$inferSelect)["status"],
      ),
    );
  }
  if (filters?.categoryId) {
    whereConditions.push(eq(expenses.categoryId, filters.categoryId as string));
  }
  if (filters?.jobId) {
    whereConditions.push(eq(expenses.jobId, filters.jobId as string));
  }
  if (filters?.sourceId) {
    whereConditions.push(eq(expenses.sourceId, filters.sourceId as string));
  }
  if (filters?.startDate) {
    whereConditions.push(
      gte(expenses.expenseDate, filters.startDate as string),
    );
  }
  if (filters?.endDate) {
    whereConditions.push(lte(expenses.expenseDate, filters.endDate as string));
  }

  const [totalRow] = await db
    .select({ total: count() })
    .from(expenses)
    .where(and(...whereConditions));

  const data = await db
    .select()
    .from(expenses)
    .where(and(...whereConditions))
    .orderBy(desc(expenses.createdAt))
    .limit(limit)
    .offset(offset);

  const total = totalRow?.total ?? 0;
  return {
    data,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getExpenseById(
  _organizationId: string | undefined,
  id: string,
  _options?: {
    includeReceipts?: boolean;
    includeAllocations?: boolean;
    includeApprovals?: boolean;
    includeHistory?: boolean;
  },
) {
  const conditions = [eq(expenses.id, id), eq(expenses.isDeleted, false)];
  const [row] = await db
    .select({
      ...getTableColumns(expenses),
      createdByName: createdByUser.fullName,
      approvedByName: approvedByUser.fullName,
      rejectedByName: rejectedByUser.fullName,
    })
    .from(expenses)
    .leftJoin(createdByUser, eq(expenses.createdBy, createdByUser.id))
    .leftJoin(approvedByUser, eq(expenses.approvedBy, approvedByUser.id))
    .leftJoin(rejectedByUser, eq(expenses.rejectedBy, rejectedByUser.id))
    .where(and(...conditions))
    .limit(1);

  if (!row) return null;

  const { createdByName, approvedByName, rejectedByName, ...record } = row;
  return {
    ...record,
    createdByName: createdByName ?? null,
    approvedByName: approvedByName ?? null,
    rejectedByName: rejectedByName ?? null,
  };
}

export async function createExpense(
  _organizationId: string | null | undefined,
  body: Record<string, unknown>,
  userId: string,
) {
  const amount = String(body.amount ?? "0");
  const result = await db
    .insert(expenses)
    .values({
      expenseNumber: generateExpenseNumber(),
      categoryId: body.categoryId as string,
      jobId: (body.jobId as string) ?? null,
      sourceId: (body.sourceId as string) ?? null,
      title: (body.title as string) ?? "Untitled",
      description: (body.description as string) ?? null,
      expenseType: body.expenseType as string,
      paymentMethod: (body.paymentMethod as string) ?? "other",
      amount,
      amountInBaseCurrency: amount,
      expenseDate: body.expenseDate as string,
      vendor: (body.vendor as string) ?? null,
      createdBy: userId,
    } as typeof expenses.$inferInsert)
    .returning();
  const row = Array.isArray(result) ? result[0] : undefined;
  return row ?? null;
}

/**
 * Get default expense category ID (first active category). Used by fleet, inventory, job flows.
 */
export async function getDefaultExpenseCategoryId(): Promise<string> {
  const [row] = await db
    .select({ id: expenseCategories.id })
    .from(expenseCategories)
    .where(eq(expenseCategories.isDeleted, false))
    .limit(1);
  if (!row?.id) throw new Error("No expense category found");
  return row.id;
}

/** Map job expense type string to org.expenses expense_type_enum (job_* for source tracking) */
function mapJobExpenseTypeToExpenseType(jobExpenseType: string): string {
  const lower = (jobExpenseType ?? "").toLowerCase();
  const map: Record<string, string> = {
    materials: "job_material",
    material: "job_material",
    labor: "job_labor",
    labour: "job_labor",
    travel: "job_travel",
    service: "job_service",
    equipment: "job_material",
    tools: "job_material",
    subcontractor: "job_service",
  };
  return map[lower] ?? "job_material";
}

/**
 * Create org.expenses record when a job expense is created (source_id = job_expense.id, expense_type = job_*).
 * Used by job.service, fleet, inventory flows.
 */
export async function createExpenseFromSource(data: {
  sourceId: string;
  jobId?: string | null;
  categoryId: string;
  expenseType: string;
  amount: string;
  expenseDate: string;
  description: string;
  title?: string;
  vendor?: string | null;
  createdBy: string;
  source: "job" | "fleet" | "inventory";
}): Promise<{ id: string } | null> {
  const expenseTypeMapped =
    data.source === "job"
      ? mapJobExpenseTypeToExpenseType(data.expenseType)
      : data.expenseType;
  const [row] = await db
    .insert(expenses)
    .values({
      expenseNumber: generateExpenseNumber(),
      categoryId: data.categoryId,
      jobId: data.jobId ?? null,
      sourceId: data.sourceId,
      expenseType:
        expenseTypeMapped as typeof expenses.$inferSelect.expenseType,
      paymentMethod: "other",
      status: "draft",
      title: data.title ?? data.description?.slice(0, 255) ?? "Expense",
      description: data.description ?? null,
      vendor: data.vendor ?? null,
      amount: data.amount,
      amountInBaseCurrency: data.amount,
      expenseDate: data.expenseDate,
      createdBy: data.createdBy,
    } as typeof expenses.$inferInsert)
    .returning({ id: expenses.id });
  return row ?? null;
}

export async function updateExpense(
  _organizationId: string | undefined,
  id: string,
  body: Record<string, unknown>,
  _userId: string,
) {
  const conditions = [eq(expenses.id, id), eq(expenses.isDeleted, false)];
  type Status = (typeof expenses.$inferSelect)["status"];
  const [row] = await db
    .update(expenses)
    .set({
      ...(body.title != null && { title: body.title as string }),
      ...(body.description !== undefined && {
        description: body.description as string | null,
      }),
      ...(body.amount != null && {
        amount: String(body.amount),
        amountInBaseCurrency: String(body.amount),
      }),
      ...(body.expenseDate != null && {
        expenseDate: body.expenseDate as string,
      }),
      ...(body.status != null && { status: body.status as Status }),
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning();
  return row ?? null;
}

export async function deleteExpense(
  _organizationId: string | undefined,
  id: string,
) {
  const conditions = [eq(expenses.id, id), eq(expenses.isDeleted, false)];
  const [row] = await db
    .update(expenses)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(and(...conditions))
    .returning();
  return row ?? null;
}

export async function submitExpense(
  _organizationId: string | undefined,
  id: string,
  _userId: string,
  _notes?: string,
) {
  const conditions = [
    eq(expenses.id, id),
    eq(expenses.status, "draft"),
    eq(expenses.isDeleted, false),
  ];
  const [row] = await db
    .update(expenses)
    .set({
      status: "submitted",
      submittedDate: new Date(),
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning();
  return row ?? null;
}

export async function approveExpense(
  _organizationId: string | undefined,
  id: string,
  userId: string,
  _comments?: string,
) {
  const conditions = [eq(expenses.id, id), eq(expenses.isDeleted, false)];
  const [row] = await db
    .update(expenses)
    .set({
      status: "approved",
      approvedBy: userId,
      approvedDate: new Date(),
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning();
  return row ?? null;
}

export async function rejectExpense(
  _organizationId: string | undefined,
  id: string,
  userId: string,
  reason?: string,
) {
  const conditions = [eq(expenses.id, id), eq(expenses.isDeleted, false)];
  const [row] = await db
    .update(expenses)
    .set({
      status: "rejected",
      rejectedBy: userId,
      rejectionReason: reason ?? null,
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning();
  return row ?? null;
}

export async function logExpenseHistory(
  _organizationId: string,
  expenseId: string,
  action: string,
  description: string,
  submittedBy: string,
): Promise<void> {
  await db.insert(expenseHistory).values({
    expenseId,
    action,
    description,
    performedBy: submittedBy,
  });
}

// ============================
// Expense Receipts
// ============================

export async function getExpenseReceipts(expenseId: string) {
  const list = await db
    .select()
    .from(expenseReceipts)
    .where(
      and(
        eq(expenseReceipts.expenseId, expenseId),
        eq(expenseReceipts.isDeleted, false),
      ),
    )
    .orderBy(desc(expenseReceipts.createdAt));
  return list;
}

export async function getExpenseReceiptById(
  expenseId: string,
  receiptId: string,
) {
  const [row] = await db
    .select({
      ...getTableColumns(expenseReceipts),
      uploadedByName: uploadedByUser.fullName,
    })
    .from(expenseReceipts)
    .leftJoin(uploadedByUser, eq(expenseReceipts.uploadedBy, uploadedByUser.id))
    .where(
      and(
        eq(expenseReceipts.expenseId, expenseId),
        eq(expenseReceipts.id, receiptId),
        eq(expenseReceipts.isDeleted, false),
      ),
    )
    .limit(1);

  if (!row) return null;

  const { uploadedByName, ...record } = row;
  return {
    ...record,
    uploadedByName: uploadedByName ?? null,
  };
}

export async function createExpenseReceipt(
  expenseId: string,
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  },
  uploadedBy: string,
  options?: {
    description?: string;
    receiptDate?: string;
    receiptNumber?: string;
    receiptTotal?: string;
    vendor?: string;
  },
) {
  const { uploadToSpaces } = await import("./storage.service.js");
  const uploadResult = await uploadToSpaces(
    file.buffer,
    file.originalname,
    "expense-receipts",
  );
  const [receipt] = await db
    .insert(expenseReceipts)
    .values({
      expenseId,
      fileName: file.originalname,
      filePath: uploadResult.url,
      fileType: file.mimetype,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedBy,
      description: options?.description ?? null,
      receiptDate: options?.receiptDate ?? null,
      receiptNumber: options?.receiptNumber ?? null,
      receiptTotal: options?.receiptTotal ?? null,
      vendor: options?.vendor ?? null,
    })
    .returning();
  if (receipt) {
    await db
      .update(expenses)
      .set({ hasReceipt: true, updatedAt: new Date() })
      .where(and(eq(expenses.id, expenseId), eq(expenses.isDeleted, false)));
  }
  return receipt ?? null;
}

export async function updateExpenseReceipt(
  expenseId: string,
  receiptId: string,
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  },
  options?: {
    description?: string;
    receiptDate?: string;
    receiptNumber?: string;
    receiptTotal?: string;
    vendor?: string;
  },
) {
  const existing = await getExpenseReceiptById(expenseId, receiptId);
  if (!existing) return null;
  const { uploadToSpaces, deleteFromSpaces } =
    await import("./storage.service.js");
  await deleteFromSpaces(existing.filePath);
  const uploadResult = await uploadToSpaces(
    file.buffer,
    file.originalname,
    "expense-receipts",
  );
  const [receipt] = await db
    .update(expenseReceipts)
    .set({
      fileName: file.originalname,
      filePath: uploadResult.url,
      fileType: file.mimetype,
      fileSize: file.size,
      mimeType: file.mimetype,
      ...(options?.description !== undefined && {
        description: options.description,
      }),
      ...(options?.receiptDate !== undefined && {
        receiptDate: options.receiptDate,
      }),
      ...(options?.receiptNumber !== undefined && {
        receiptNumber: options.receiptNumber,
      }),
      ...(options?.receiptTotal !== undefined && {
        receiptTotal: options.receiptTotal,
      }),
      ...(options?.vendor !== undefined && { vendor: options.vendor }),
    })
    .where(
      and(
        eq(expenseReceipts.expenseId, expenseId),
        eq(expenseReceipts.id, receiptId),
        eq(expenseReceipts.isDeleted, false),
      ),
    )
    .returning();
  return receipt ?? null;
}

export async function deleteExpenseReceipt(
  expenseId: string,
  receiptId: string,
) {
  const existing = await getExpenseReceiptById(expenseId, receiptId);
  if (!existing) return null;
  const { deleteFromSpaces } = await import("./storage.service.js");
  await deleteFromSpaces(existing.filePath);
  const [receipt] = await db
    .update(expenseReceipts)
    .set({ isDeleted: true })
    .where(
      and(
        eq(expenseReceipts.expenseId, expenseId),
        eq(expenseReceipts.id, receiptId),
        eq(expenseReceipts.isDeleted, false),
      ),
    )
    .returning();
  if (receipt) {
    const remaining = await db
      .select({ id: expenseReceipts.id })
      .from(expenseReceipts)
      .where(
        and(
          eq(expenseReceipts.expenseId, expenseId),
          eq(expenseReceipts.isDeleted, false),
        ),
      );
    if (remaining.length === 0) {
      await db
        .update(expenses)
        .set({ hasReceipt: false, updatedAt: new Date() })
        .where(and(eq(expenses.id, expenseId), eq(expenses.isDeleted, false)));
    }
  }
  return receipt ?? null;
}
