import {
  count,
  eq,
  desc,
  asc,
  and,
  or,
  sql,
  gte,
  lte,
  sum,
  ilike,
  isNull,
  isNotNull,
} from "drizzle-orm";
import { db } from "../config/db.js";
import {
  expenseCategories,
  expenses,
  expenseReports,
  expenseReportItems,
  expenseReceipts,
  expenseApprovals,
  expenseAllocations,
  mileageLogs,
  expenseReimbursements,
  expenseReimbursementItems,
  expenseBudgets,
  expenseHistory,
} from "../drizzle/schema/expenses.schema.js";
import {
  employees,
  departments,
  organizations,
} from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";

// ============================
// Expense Categories
// ============================

export const getExpenseCategories = async (
  organizationId: string,
  offset: number,
  limit: number,
  filters?: {
    search?: string;
    expenseType?: string;
    parentCategoryId?: string;
    isActive?: boolean;
    requiresReceipt?: boolean;
    requiresApproval?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    includeDeleted?: boolean;
  }
) => {
  let whereConditions = [eq(expenseCategories.organizationId, organizationId)];

  // Include deleted filter
  if (!filters?.includeDeleted) {
    whereConditions.push(eq(expenseCategories.isDeleted, false));
  }

  // Apply filters
  if (filters?.search) {
    whereConditions.push(
      or(
        ilike(expenseCategories.name, `%${filters.search}%`),
        ilike(expenseCategories.description, `%${filters.search}%`),
        ilike(expenseCategories.code, `%${filters.search}%`)
      )!
    );
  }

  if (filters?.expenseType) {
    whereConditions.push(eq(expenseCategories.expenseType, filters.expenseType as any));
  }

  if (filters?.parentCategoryId) {
    whereConditions.push(eq(expenseCategories.parentCategoryId, filters.parentCategoryId));
  }

  if (filters?.isActive !== undefined) {
    whereConditions.push(eq(expenseCategories.isActive, filters.isActive));
  }

  if (filters?.requiresReceipt !== undefined) {
    whereConditions.push(eq(expenseCategories.requiresReceipt, filters.requiresReceipt));
  }

  if (filters?.requiresApproval !== undefined) {
    whereConditions.push(eq(expenseCategories.requiresApproval, filters.requiresApproval));
  }

  // Determine sort order
  const sortField = filters?.sortBy || "name";
  const sortDirection = filters?.sortOrder === "desc" ? desc : asc;
  let orderBy;

  switch (sortField) {
    case "code":
      orderBy = sortDirection(expenseCategories.code);
      break;
    case "expenseType":
      orderBy = sortDirection(expenseCategories.expenseType);
      break;
    case "sortOrder":
      orderBy = sortDirection(expenseCategories.sortOrder);
      break;
    case "createdAt":
      orderBy = sortDirection(expenseCategories.createdAt);
      break;
    default:
      orderBy = sortDirection(expenseCategories.name);
  }

  // Get categories with parent category info
  const result = await db
    .select({
      id: expenseCategories.id,
      organizationId: expenseCategories.organizationId,
      name: expenseCategories.name,
      description: expenseCategories.description,
      code: expenseCategories.code,
      expenseType: expenseCategories.expenseType,
      parentCategoryId: expenseCategories.parentCategoryId,
      requiresReceipt: expenseCategories.requiresReceipt,
      requiresApproval: expenseCategories.requiresApproval,
      isReimbursable: expenseCategories.isReimbursable,
      isTaxDeductible: expenseCategories.isTaxDeductible,
      dailyLimit: expenseCategories.dailyLimit,
      monthlyLimit: expenseCategories.monthlyLimit,
      yearlyLimit: expenseCategories.yearlyLimit,
      approvalThreshold: expenseCategories.approvalThreshold,
      requiresManagerApproval: expenseCategories.requiresManagerApproval,
      requiresFinanceApproval: expenseCategories.requiresFinanceApproval,
      isActive: expenseCategories.isActive,
      sortOrder: expenseCategories.sortOrder,
      createdAt: expenseCategories.createdAt,
      updatedAt: expenseCategories.updatedAt,
      // Parent category info
      parentCategoryName: sql<string>`parent_cat.name`,
      parentCategoryCode: sql<string>`parent_cat.code`,
    })
    .from(expenseCategories)
    .leftJoin(
      sql`${expenseCategories} as parent_cat`,
      sql`parent_cat.id = ${expenseCategories.parentCategoryId}`
    )
    .where(and(...whereConditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(expenseCategories)
    .where(and(...whereConditions));

  const total = totalResult[0]?.count || 0;

  // Get subcategories count for each category
  const categoriesWithCounts = await Promise.all(
    result.map(async (category) => {
      const subcategoriesResult = await db
        .select({ count: count() })
        .from(expenseCategories)
        .where(
          and(
            eq(expenseCategories.parentCategoryId, category.id),
            eq(expenseCategories.isDeleted, false)
          )
        );

      return {
        ...category,
        parentCategory: category.parentCategoryName
          ? {
              id: category.parentCategoryId!,
              name: category.parentCategoryName,
              code: category.parentCategoryCode,
            }
          : undefined,
        subcategoriesCount: subcategoriesResult[0]?.count || 0,
      };
    })
  );

  return {
    data: categoriesWithCounts,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getExpenseCategoryById = async (organizationId: string, id: string) => {
  const result = await db
    .select()
    .from(expenseCategories)
    .where(
      and(
        eq(expenseCategories.id, id),
        eq(expenseCategories.organizationId, organizationId),
        eq(expenseCategories.isDeleted, false)
      )
    )
    .limit(1);

  return result[0] || null;
};

export const createExpenseCategory = async (
  organizationId: string,
  categoryData: any,
  createdBy: string
) => {
  const newCategory = await db
    .insert(expenseCategories)
    .values({
      organizationId,
      ...categoryData,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return (newCategory as any[])[0];
};

export const updateExpenseCategory = async (
  organizationId: string,
  id: string,
  updateData: any
) => {
  const updated = await db
    .update(expenseCategories)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(expenseCategories.id, id),
        eq(expenseCategories.organizationId, organizationId),
        eq(expenseCategories.isDeleted, false)
      )
    )
    .returning();

  return updated[0] || null;
};

export const deleteExpenseCategory = async (organizationId: string, id: string) => {
  const deleted = await db
    .update(expenseCategories)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(expenseCategories.id, id),
        eq(expenseCategories.organizationId, organizationId)
      )
    )
    .returning();

  return deleted[0] || null;
};

// ============================
// Expenses
// ============================

export const getExpenses = async (
  organizationId: string,
  offset: number,
  limit: number,
  filters?: {
    status?: string;
    expenseType?: string;
    paymentMethod?: string;
    employeeId?: number;
    categoryId?: string;
    jobId?: string;
    bidId?: string;
    startDate?: string;
    endDate?: string;
    submittedStartDate?: string;
    submittedEndDate?: string;
    approvedBy?: string;
    reimbursementStatus?: string;
    hasReceipt?: boolean;
    isReimbursable?: boolean;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    includeDeleted?: boolean;
  }
) => {
  let whereConditions = [eq(expenses.organizationId, organizationId)];

  // Include deleted filter
  if (!filters?.includeDeleted) {
    whereConditions.push(eq(expenses.isDeleted, false));
  }

  // Apply filters
  if (filters?.status) {
    whereConditions.push(eq(expenses.status, filters.status as any));
  }

  if (filters?.expenseType) {
    whereConditions.push(eq(expenses.expenseType, filters.expenseType as any));
  }

  if (filters?.paymentMethod) {
    whereConditions.push(eq(expenses.paymentMethod, filters.paymentMethod as any));
  }

  if (filters?.employeeId) {
    whereConditions.push(eq(expenses.employeeId, filters.employeeId));
  }

  if (filters?.categoryId) {
    whereConditions.push(eq(expenses.categoryId, filters.categoryId));
  }

  if (filters?.jobId) {
    whereConditions.push(eq(expenses.jobId, filters.jobId));
  }

  if (filters?.bidId) {
    whereConditions.push(eq(expenses.bidId, filters.bidId));
  }

  if (filters?.startDate) {
    whereConditions.push(gte(expenses.expenseDate, filters.startDate));
  }

  if (filters?.endDate) {
    whereConditions.push(lte(expenses.expenseDate, filters.endDate));
  }

  if (filters?.submittedStartDate) {
    whereConditions.push(gte(expenses.submittedDate, new Date(filters.submittedStartDate)));
  }

  if (filters?.submittedEndDate) {
    whereConditions.push(lte(expenses.submittedDate, new Date(filters.submittedEndDate)));
  }

  if (filters?.approvedBy) {
    whereConditions.push(eq(expenses.approvedBy, filters.approvedBy));
  }

  if (filters?.reimbursementStatus) {
    whereConditions.push(eq(expenses.reimbursementStatus, filters.reimbursementStatus as any));
  }

  if (filters?.hasReceipt !== undefined) {
    whereConditions.push(eq(expenses.hasReceipt, filters.hasReceipt));
  }

  if (filters?.isReimbursable !== undefined) {
    whereConditions.push(eq(expenses.isReimbursable, filters.isReimbursable));
  }

  if (filters?.search) {
    whereConditions.push(
      or(
        ilike(expenses.title, `%${filters.search}%`),
        ilike(expenses.description, `%${filters.search}%`),
        ilike(expenses.vendor, `%${filters.search}%`),
        ilike(expenses.expenseNumber, `%${filters.search}%`)
      )!
    );
  }

  // Determine sort order
  const sortField = filters?.sortBy || "createdAt";
  const sortDirection = filters?.sortOrder === "asc" ? asc : desc;
  let orderBy;

  switch (sortField) {
    case "expenseDate":
      orderBy = sortDirection(expenses.expenseDate);
      break;
    case "submittedDate":
      orderBy = sortDirection(expenses.submittedDate);
      break;
    case "amount":
      orderBy = sortDirection(expenses.amount);
      break;
    case "status":
      orderBy = sortDirection(expenses.status);
      break;
    default:
      orderBy = sortDirection(expenses.createdAt);
  }

  // Get expenses with related data
  const result = await db
    .select({
      // Expense data
      id: expenses.id,
      expenseNumber: expenses.expenseNumber,
      organizationId: expenses.organizationId,
      employeeId: expenses.employeeId,
      categoryId: expenses.categoryId,
      jobId: expenses.jobId,
      bidId: expenses.bidId,
      status: expenses.status,
      expenseType: expenses.expenseType,
      paymentMethod: expenses.paymentMethod,
      title: expenses.title,
      description: expenses.description,
      vendor: expenses.vendor,
      location: expenses.location,
      amount: expenses.amount,
      currency: expenses.currency,
      exchangeRate: expenses.exchangeRate,
      amountInBaseCurrency: expenses.amountInBaseCurrency,
      taxStatus: expenses.taxStatus,
      taxAmount: expenses.taxAmount,
      taxRate: expenses.taxRate,
      expenseDate: expenses.expenseDate,
      submittedDate: expenses.submittedDate,
      approvedDate: expenses.approvedDate,
      paidDate: expenses.paidDate,
      receiptStatus: expenses.receiptStatus,
      receiptNumber: expenses.receiptNumber,
      hasReceipt: expenses.hasReceipt,
      receiptTotal: expenses.receiptTotal,
      isMileageExpense: expenses.isMileageExpense,
      mileageType: expenses.mileageType,
      miles: expenses.miles,
      mileageRate: expenses.mileageRate,
      startLocation: expenses.startLocation,
      endLocation: expenses.endLocation,
      isReimbursable: expenses.isReimbursable,
      reimbursementAmount: expenses.reimbursementAmount,
      reimbursementStatus: expenses.reimbursementStatus,
      reimbursedDate: expenses.reimbursedDate,
      requiresApproval: expenses.requiresApproval,
      approvedBy: expenses.approvedBy,
      rejectedBy: expenses.rejectedBy,
      rejectionReason: expenses.rejectionReason,
      businessPurpose: expenses.businessPurpose,
      attendees: expenses.attendees,
      notes: expenses.notes,
      internalNotes: expenses.internalNotes,
      createdBy: expenses.createdBy,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
      // Employee data
      employeeFullName: users.fullName,
      employeeEmail: users.email,
      // Category data
      categoryName: expenseCategories.name,
      categoryCode: expenseCategories.code,
      // Job data
      jobNumber: jobs.jobNumber,
      jobName: jobs.name,
    })
    .from(expenses)
    .leftJoin(employees, eq(expenses.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .leftJoin(jobs, eq(expenses.jobId, jobs.id))
    .where(and(...whereConditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(expenses)
    .where(and(...whereConditions));

  const total = totalResult[0]?.count || 0;

  // Get receipts and allocations count for each expense
  const expensesWithCounts = await Promise.all(
    result.map(async (expense) => {
      const [receiptsResult, allocationsResult] = await Promise.all([
        db
          .select({ count: count() })
          .from(expenseReceipts)
          .where(
            and(
              eq(expenseReceipts.expenseId, expense.id),
              eq(expenseReceipts.isDeleted, false)
            )
          ),
        db
          .select({ count: count() })
          .from(expenseAllocations)
          .where(
            and(
              eq(expenseAllocations.expenseId, expense.id),
              eq(expenseAllocations.isDeleted, false)
            )
          ),
      ]);

      return {
        ...expense,
        employee: expense.employeeFullName
          ? {
              id: expense.employeeId,
              fullName: expense.employeeFullName,
              email: expense.employeeEmail,
            }
          : undefined,
        category: expense.categoryName
          ? {
              id: expense.categoryId,
              name: expense.categoryName,
              code: expense.categoryCode,
              expenseType: expense.expenseType,
            }
          : undefined,
        job: expense.jobNumber
          ? {
              id: expense.jobId!,
              jobNumber: expense.jobNumber,
              name: expense.jobName,
            }
          : undefined,
        receiptsCount: receiptsResult[0]?.count || 0,
        allocationsCount: allocationsResult[0]?.count || 0,
      };
    })
  );

  return {
    data: expensesWithCounts,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getExpenseById = async (
  organizationId: string,
  id: string,
  options?: {
    includeReceipts?: boolean;
    includeAllocations?: boolean;
    includeApprovals?: boolean;
    includeHistory?: boolean;
  }
) => {
  // Get main expense data
  const expenseResult = await db
    .select({
      // All expense fields
      id: expenses.id,
      expenseNumber: expenses.expenseNumber,
      organizationId: expenses.organizationId,
      employeeId: expenses.employeeId,
      categoryId: expenses.categoryId,
      jobId: expenses.jobId,
      bidId: expenses.bidId,
      status: expenses.status,
      expenseType: expenses.expenseType,
      paymentMethod: expenses.paymentMethod,
      title: expenses.title,
      description: expenses.description,
      vendor: expenses.vendor,
      location: expenses.location,
      amount: expenses.amount,
      currency: expenses.currency,
      exchangeRate: expenses.exchangeRate,
      amountInBaseCurrency: expenses.amountInBaseCurrency,
      taxStatus: expenses.taxStatus,
      taxAmount: expenses.taxAmount,
      taxRate: expenses.taxRate,
      expenseDate: expenses.expenseDate,
      submittedDate: expenses.submittedDate,
      approvedDate: expenses.approvedDate,
      paidDate: expenses.paidDate,
      receiptStatus: expenses.receiptStatus,
      receiptNumber: expenses.receiptNumber,
      hasReceipt: expenses.hasReceipt,
      receiptTotal: expenses.receiptTotal,
      isMileageExpense: expenses.isMileageExpense,
      mileageType: expenses.mileageType,
      miles: expenses.miles,
      mileageRate: expenses.mileageRate,
      startLocation: expenses.startLocation,
      endLocation: expenses.endLocation,
      isReimbursable: expenses.isReimbursable,
      reimbursementAmount: expenses.reimbursementAmount,
      reimbursementStatus: expenses.reimbursementStatus,
      reimbursedDate: expenses.reimbursedDate,
      requiresApproval: expenses.requiresApproval,
      approvedBy: expenses.approvedBy,
      rejectedBy: expenses.rejectedBy,
      rejectionReason: expenses.rejectionReason,
      businessPurpose: expenses.businessPurpose,
      attendees: expenses.attendees,
      notes: expenses.notes,
      internalNotes: expenses.internalNotes,
      createdBy: expenses.createdBy,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
      // Related data
      employeeFullName: users.fullName,
      employeeEmail: users.email,
      categoryName: expenseCategories.name,
      categoryCode: expenseCategories.code,
      jobNumber: jobs.jobNumber,
      jobName: jobs.name,
    })
    .from(expenses)
    .leftJoin(employees, eq(expenses.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .leftJoin(jobs, eq(expenses.jobId, jobs.id))
    .where(
      and(
        eq(expenses.id, id),
        eq(expenses.organizationId, organizationId),
        eq(expenses.isDeleted, false)
      )
    )
    .limit(1);

  if (!expenseResult[0]) {
    return null;
  }

  const expense = expenseResult[0];
  const result: any = {
    ...expense,
    employee: expense.employeeFullName
      ? {
          id: expense.employeeId,
          fullName: expense.employeeFullName,
          email: expense.employeeEmail,
        }
      : undefined,
    category: expense.categoryName
      ? {
          id: expense.categoryId,
          name: expense.categoryName,
          code: expense.categoryCode,
          expenseType: expense.expenseType,
        }
      : undefined,
    job: expense.jobNumber
      ? {
          id: expense.jobId!,
          jobNumber: expense.jobNumber,
          name: expense.jobName,
        }
      : undefined,
  };

  // Include optional related data
  if (options?.includeReceipts !== false) {
    result.receipts = await getExpenseReceipts(organizationId, id);
  }

  if (options?.includeAllocations !== false) {
    result.allocations = await getExpenseAllocations(organizationId, id);
  }

  if (options?.includeApprovals !== false) {
    result.approvals = await getExpenseApprovals(organizationId, id);
  }

  if (options?.includeHistory) {
    result.history = await getExpenseHistory(organizationId, id);
  }

  // Include mileage log if it's a mileage expense
  if (expense.isMileageExpense) {
    const mileageResult = await db
      .select()
      .from(mileageLogs)
      .where(
        and(
          eq(mileageLogs.expenseId, id),
          eq(mileageLogs.organizationId, organizationId),
          eq(mileageLogs.isDeleted, false)
        )
      )
      .limit(1);

    result.mileageLog = mileageResult[0] || null;
  }

  return result;
};

export const createExpense = async (
  organizationId: string,
  employeeId: number,
  expenseData: any,
  createdBy: string
) => {
  // Generate expense number
  const expenseNumber = await generateExpenseNumber(organizationId);

  // Calculate amounts
  const amount = parseFloat(expenseData.amount);
  const exchangeRate = parseFloat(expenseData.exchangeRate || "1");
  const amountInBaseCurrency = amount * exchangeRate;
  const taxAmount = parseFloat(expenseData.taxAmount || "0");
  const reimbursementAmount = expenseData.isReimbursable !== false ? amount : 0;

  const newExpense = await db
    .insert(expenses)
    .values({
      expenseNumber,
      organizationId,
      employeeId,
      ...expenseData,
      amount: amount.toString(),
      exchangeRate: exchangeRate.toString(),
      amountInBaseCurrency: amountInBaseCurrency.toString(),
      taxAmount: taxAmount.toString(),
      reimbursementAmount: reimbursementAmount.toString(),
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const expense = newExpense[0];

  // Create allocations if provided
  if (expenseData.allocations && expenseData.allocations.length > 0) {
    const allocations = await Promise.all(
      expenseData.allocations.map((allocation: any) =>
        createExpenseAllocation(organizationId, expense!.id, allocation)
      )
    );
    return { expense, allocations };
  }

  return { expense };
};

export const updateExpense = async (
  organizationId: string,
  id: string,
  updateData: any,
  updatedBy: string
) => {
  // Recalculate amounts if amount or exchange rate changed
  if (updateData.amount || updateData.exchangeRate) {
    const currentExpense = await getExpenseById(organizationId, id);
    if (!currentExpense) return null;

    const amount = parseFloat(updateData.amount || currentExpense.amount);
    const exchangeRate = parseFloat(updateData.exchangeRate || currentExpense.exchangeRate);
    updateData.amountInBaseCurrency = (amount * exchangeRate).toString();

    if (updateData.isReimbursable !== false && currentExpense.isReimbursable !== false) {
      updateData.reimbursementAmount = amount.toString();
    }
  }

  const updated = await db
    .update(expenses)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(expenses.id, id),
        eq(expenses.organizationId, organizationId),
        eq(expenses.isDeleted, false)
      )
    )
    .returning();

  if (updated[0]) {
    // Log the update
    await logExpenseHistory(
      organizationId,
      id,
      "updated",
      "Expense updated",
      updatedBy
    );
  }

  return updated[0] || null;
};

export const deleteExpense = async (organizationId: string, id: string) => {
  const deleted = await db
    .update(expenses)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(expenses.id, id),
        eq(expenses.organizationId, organizationId)
      )
    )
    .returning();

  return deleted[0] || null;
};

export const submitExpense = async (
  organizationId: string,
  id: string,
  submittedBy: string,
  notes?: string
) => {
  const updated = await db
    .update(expenses)
    .set({
      status: "submitted",
      submittedDate: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(expenses.id, id),
        eq(expenses.organizationId, organizationId),
        eq(expenses.status, "draft"),
        eq(expenses.isDeleted, false)
      )
    )
    .returning();

  if (updated[0]) {
    // Log the submission
    await logExpenseHistory(
      organizationId,
      id,
      "submitted",
      notes || "Expense submitted for approval",
      submittedBy
    );

    // Create approval workflow if required
    if (updated[0].requiresApproval) {
      const approvals = await createExpenseApprovalWorkflow(
        organizationId,
        id,
        submittedBy
      );
      return { expense: updated[0], approvals };
    }
  }

  return { expense: updated[0] || null };
};

export const approveExpense = async (
  organizationId: string,
  id: string,
  approvedBy: string,
  comments?: string
) => {
  const updated = await db
    .update(expenses)
    .set({
      status: "approved",
      approvedBy,
      approvedDate: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(expenses.id, id),
        eq(expenses.organizationId, organizationId),
        eq(expenses.status, "submitted"),
        eq(expenses.isDeleted, false)
      )
    )
    .returning();

  if (updated[0]) {
    // Log the approval
    await logExpenseHistory(
      organizationId,
      id,
      "approved",
      comments || "Expense approved",
      approvedBy
    );

    // Update approval record
    const approval = await updateExpenseApprovalStatus(
      organizationId,
      id,
      approvedBy,
      "approved",
      comments
    );

    return { expense: updated[0], approval };
  }

  return { expense: null, approval: null };
};

export const rejectExpense = async (
  organizationId: string,
  id: string,
  rejectedBy: string,
  rejectionReason: string,
  comments?: string
) => {
  const updated = await db
    .update(expenses)
    .set({
      status: "rejected",
      rejectedBy,
      rejectionReason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(expenses.id, id),
        eq(expenses.organizationId, organizationId),
        eq(expenses.status, "submitted"),
        eq(expenses.isDeleted, false)
      )
    )
    .returning();

  if (updated[0]) {
    // Log the rejection
    await logExpenseHistory(
      organizationId,
      id,
      "rejected",
      rejectionReason,
      rejectedBy
    );

    // Update approval record
    const approval = await updateExpenseApprovalStatus(
      organizationId,
      id,
      rejectedBy,
      "rejected",
      comments,
      rejectionReason
    );

    return { expense: updated[0], approval };
  }

  return { expense: null, approval: null };
};

// ============================
// Helper Functions
// ============================

const generateExpenseNumber = async (organizationId: string): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `EXP-${year}-`;

  const lastExpense = await db
    .select({ expenseNumber: expenses.expenseNumber })
    .from(expenses)
    .where(
      and(
        eq(expenses.organizationId, organizationId),
        ilike(expenses.expenseNumber, `${prefix}%`)
      )
    )
    .orderBy(desc(expenses.expenseNumber))
    .limit(1);

  let nextNumber = 1;
  if (lastExpense[0]) {
    const lastNumber = parseInt(lastExpense[0]?.expenseNumber?.split("-")[2] || "0") || 0;
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(6, "0")}`;
};

const getExpenseReceipts = async (organizationId: string, expenseId: string) => {
  return await db
    .select()
    .from(expenseReceipts)
    .where(
      and(
        eq(expenseReceipts.expenseId, expenseId),
        eq(expenseReceipts.organizationId, organizationId),
        eq(expenseReceipts.isDeleted, false)
      )
    )
    .orderBy(desc(expenseReceipts.createdAt));
};

const getExpenseAllocations = async (organizationId: string, expenseId: string) => {
  return await db
    .select()
    .from(expenseAllocations)
    .where(
      and(
        eq(expenseAllocations.expenseId, expenseId),
        eq(expenseAllocations.organizationId, organizationId),
        eq(expenseAllocations.isDeleted, false)
      )
    );
};

const getExpenseApprovals = async (organizationId: string, expenseId: string) => {
  return await db
    .select()
    .from(expenseApprovals)
    .where(
      and(
        eq(expenseApprovals.expenseId, expenseId),
        eq(expenseApprovals.organizationId, organizationId),
        eq(expenseApprovals.isDeleted, false)
      )
    )
    .orderBy(asc(expenseApprovals.approvalLevel));
};

const getExpenseHistory = async (organizationId: string, expenseId: string) => {
  return await db
    .select()
    .from(expenseHistory)
    .where(
      and(
        eq(expenseHistory.expenseId, expenseId),
        eq(expenseHistory.organizationId, organizationId)
      )
    )
    .orderBy(desc(expenseHistory.createdAt));
};

const createExpenseAllocation = async (
  organizationId: string,
  expenseId: string,
  allocationData: any
) => {
  const percentage = parseFloat(allocationData.percentage || "100");
  const expense = await db
    .select({ amount: expenses.amount })
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .limit(1);

  const allocatedAmount = expense[0] ? (parseFloat(expense[0].amount) * percentage) / 100 : 0;

  return await db
    .insert(expenseAllocations)
    .values({
      organizationId,
      expenseId,
      ...allocationData,
      percentage: percentage.toString(),
      allocatedAmount: allocatedAmount.toString(),
      createdAt: new Date(),
    })
    .returning();
};

const createExpenseApprovalWorkflow = async (
  organizationId: string,
  expenseId: string,
  requestedBy: string
) => {
  // This would implement the approval workflow logic
  // For now, create a basic manager approval
  return await db
    .insert(expenseApprovals)
    .values({
      organizationId,
      expenseId,
      approvalLevel: 1,
      approverId: requestedBy, // Would be replaced with actual manager ID
      approverRole: "manager",
      status: "pending",
      requestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
};

const updateExpenseApprovalStatus = async (
  organizationId: string,
  expenseId: string,
  approverId: string,
  status: "approved" | "rejected",
  comments?: string,
  rejectionReason?: string
) => {
  return await db
    .update(expenseApprovals)
    .set({
      status,
      respondedAt: new Date(),
      comments,
      rejectionReason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(expenseApprovals.expenseId, expenseId),
        eq(expenseApprovals.organizationId, organizationId),
        eq(expenseApprovals.approverId, approverId),
        eq(expenseApprovals.status, "pending")
      )
    )
    .returning();
};

const logExpenseHistory = async (
  organizationId: string,
  expenseId: string,
  action: string,
  description: string,
  performedBy: string,
  oldValue?: string,
  newValue?: string
) => {
  return await db
    .insert(expenseHistory)
    .values({
      organizationId,
      expenseId,
      action,
      description,
      oldValue,
      newValue,
      performedBy,
      createdAt: new Date(),
    });
};

// Export additional functions that will be used by other services
export {
  getExpenseReceipts,
  getExpenseAllocations,
  getExpenseApprovals,
  getExpenseHistory,
  createExpenseAllocation,
  logExpenseHistory,
};
