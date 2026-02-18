import {
  count,
  eq,
  and,
  desc,
  gte,
  lte,
  getTableColumns,
  sql,
  or,
  inArray,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../config/db.js";
import {
  expenses,
  expenseHistory,
  expenseReceipts,
} from "../drizzle/schema/expenses.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";

/** Expense category enum values with display labels (for dropdown) */
const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: "materials", label: "Materials" },
  { value: "equipment", label: "Equipment" },
  { value: "transportation", label: "Transportation" },
  { value: "permits", label: "Permits" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "utilities", label: "Utilities" },
  { value: "tools", label: "Tools" },
  { value: "safety", label: "Safety" },
  { value: "fleet", label: "Fleet" },
  { value: "maintenance", label: "Maintenance" },
  { value: "fuel", label: "Fuel" },
  { value: "tires", label: "Tires" },
  { value: "registration", label: "Registration" },
  { value: "repairs", label: "Repairs" },
  { value: "insurance", label: "Insurance" },
  { value: "office_supplies", label: "Office Supplies" },
  { value: "rent", label: "Rent" },
  { value: "internet", label: "Internet" },
  { value: "other", label: "Other" },
];

// ============================
// Expense Categories (enum list)
// ============================

export async function getExpenseCategories(
  _organizationId: string | undefined,
  offset: number,
  limit: number,
  filters?: Record<string, unknown>,
) {
  let data = EXPENSE_CATEGORIES;
  if (filters?.search) {
    const search = String(filters.search).toLowerCase();
    data = data.filter(
      (c) =>
        c.label.toLowerCase().includes(search) ||
        c.value.toLowerCase().includes(search),
    );
  }
  const total = data.length;
  const paginated = data.slice(offset, offset + limit);
  return {
    data: paginated,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
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
  if (filters?.expenseType) {
    whereConditions.push(
      eq(
        expenses.expenseType,
        filters.expenseType as (typeof expenses.$inferSelect)["expenseType"],
      ),
    );
  }
  if (filters?.paymentMethod) {
    whereConditions.push(
      eq(
        expenses.paymentMethod,
        filters.paymentMethod as (typeof expenses.$inferSelect)["paymentMethod"],
      ),
    );
  }
  if (filters?.vendor) {
    whereConditions.push(
      sql`LOWER(${expenses.vendor}) LIKE LOWER(${`%${filters.vendor}%`})`,
    );
  }
  if (filters?.category) {
    whereConditions.push(
      eq(expenses.category, filters.category as typeof expenses.$inferSelect.category),
    );
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

  // If filtering by employeeId, we need to join through createdBy → users → employees
  const needsEmployeeJoin = !!filters?.employeeId;

  if (needsEmployeeJoin) {
    whereConditions.push(eq(employees.id, filters.employeeId as number));

    const [totalRow] = await db
      .select({ total: count() })
      .from(expenses)
      .innerJoin(users, eq(expenses.createdBy, users.id))
      .innerJoin(employees, eq(users.id, employees.userId))
      .where(and(...whereConditions));

    const data = await db
      .select({ ...getTableColumns(expenses) })
      .from(expenses)
      .innerJoin(users, eq(expenses.createdBy, users.id))
      .innerJoin(employees, eq(users.id, employees.userId))
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

  // Standard query without employee join
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
      category: body.category as string,
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

/** Default expense category (enum value). Used by fleet, inventory, job flows. */
export const DEFAULT_EXPENSE_CATEGORY = "other";

export function getDefaultExpenseCategory(): string {
  return DEFAULT_EXPENSE_CATEGORY;
}

/**
 * Map job expense type (UI: Materials, Equipment, Transportation, Permits, Subcontractor, Utilities, Tools, Safety Equipment, Other)
 * to org.expenses expense_type_enum (job_material, job_travel, job_service). Labor is not a job expense type.
 */
function mapJobExpenseTypeToExpenseType(jobExpenseType: string): string {
  const lower = (jobExpenseType ?? "").toLowerCase().trim().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    materials: "job_material",
    equipment: "job_material",
    transportation: "job_travel",
    permits: "job_material",
    subcontractor: "job_service",
    utilities: "job_material",
    tools: "job_material",
    safety_equipment: "job_material",
    other: "job_material",
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
  category: string;
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
      category: data.category as typeof expenses.$inferSelect.category,
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
      ...(body.category != null && {
        category: body.category as typeof expenses.$inferSelect.category,
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
  deletedBy?: string,
) {
  const now = new Date();
  const conditions = [eq(expenses.id, id), eq(expenses.isDeleted, false)];
  const [row] = await db
    .update(expenses)
    .set({
      isDeleted: true,
      deletedAt: now,
      ...(deletedBy ? { deletedBy } : {}),
      updatedAt: now,
    })
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

// ============================
// Expenses KPIs
// ============================

export async function getExpensesKPIs() {
  // Total expenses amount (sum of all expenses)
  const [totalExpensesRow] = await db
    .select({
      totalAmount: sql<string>`COALESCE(SUM(CAST(${expenses.amountInBaseCurrency} AS NUMERIC)), 0)`,
    })
    .from(expenses)
    .where(eq(expenses.isDeleted, false));

  // Materials & Equipment (expenseType: materials, equipment, tools)
  const [materialsRow] = await db
    .select({
      totalAmount: sql<string>`COALESCE(SUM(CAST(${expenses.amountInBaseCurrency} AS NUMERIC)), 0)`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.isDeleted, false),
        or(
          eq(expenses.expenseType, "materials"),
          eq(expenses.expenseType, "equipment"),
          eq(expenses.expenseType, "tools"),
          eq(expenses.expenseType, "job_material")
        )
      )
    );

  // Labor Costs (expenseType: job_labor, subcontractor, professional_services)
  const [laborRow] = await db
    .select({
      totalAmount: sql<string>`COALESCE(SUM(CAST(${expenses.amountInBaseCurrency} AS NUMERIC)), 0)`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.isDeleted, false),
        or(
          eq(expenses.expenseType, "job_labor"),
          eq(expenses.expenseType, "subcontractor"),
          eq(expenses.expenseType, "professional_services")
        )
      )
    );

  // Travel & Fleet (expenseType: travel, fuel, vehicle_maintenance, job_travel, fleet_*)
  const [travelRow] = await db
    .select({
      totalAmount: sql<string>`COALESCE(SUM(CAST(${expenses.amountInBaseCurrency} AS NUMERIC)), 0)`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.isDeleted, false),
        or(
          eq(expenses.expenseType, "travel"),
          eq(expenses.expenseType, "fuel"),
          eq(expenses.expenseType, "vehicle_maintenance"),
          eq(expenses.expenseType, "job_travel"),
          eq(expenses.expenseType, "fleet_repair"),
          eq(expenses.expenseType, "fleet_maintenance"),
          eq(expenses.expenseType, "fleet_fuel"),
          eq(expenses.expenseType, "fleet_purchase")
        )
      )
    );

  // Operating Expenses (all other types: utilities, insurance, permits, licenses, office_supplies, etc.)
  const [operatingRow] = await db
    .select({
      totalAmount: sql<string>`COALESCE(SUM(CAST(${expenses.amountInBaseCurrency} AS NUMERIC)), 0)`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.isDeleted, false),
        or(
          eq(expenses.expenseType, "meals"),
          eq(expenses.expenseType, "accommodation"),
          eq(expenses.expenseType, "permits"),
          eq(expenses.expenseType, "licenses"),
          eq(expenses.expenseType, "insurance"),
          eq(expenses.expenseType, "office_supplies"),
          eq(expenses.expenseType, "utilities"),
          eq(expenses.expenseType, "marketing"),
          eq(expenses.expenseType, "training"),
          eq(expenses.expenseType, "software"),
          eq(expenses.expenseType, "subscriptions"),
          eq(expenses.expenseType, "other"),
          eq(expenses.expenseType, "manual")
        )
      )
    );

  const totalExpenses = Number(totalExpensesRow?.totalAmount || 0);
  const materialsExpenses = Number(materialsRow?.totalAmount || 0);
  const laborExpenses = Number(laborRow?.totalAmount || 0);
  const travelExpenses = Number(travelRow?.totalAmount || 0);
  const operatingExpenses = Number(operatingRow?.totalAmount || 0);

  return {
    totalExpenses: totalExpenses.toFixed(2),
    materialsEquipment: materialsExpenses.toFixed(2),
    laborCosts: laborExpenses.toFixed(2),
    travelFleet: travelExpenses.toFixed(2),
    operatingExpenses: operatingExpenses.toFixed(2),
  };
}

// ===========================================================================
// Bulk Delete
// ===========================================================================

export const bulkDeleteExpenses = async (ids: string[], deletedBy: string) => {
  const now = new Date();
  const result = await db
    .update(expenses)
    .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
    .where(and(inArray(expenses.id, ids), eq(expenses.isDeleted, false)))
    .returning({ id: expenses.id });
  return { deleted: result.length, skipped: ids.length - result.length };
};
