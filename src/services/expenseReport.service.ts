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
  ilike,
  inArray,
} from "drizzle-orm";
import { db } from "../config/db.js";
import {
  expenseReports,
  expenseReportItems,
  expenses,
  expenseCategories,
} from "../drizzle/schema/expenses.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { logExpenseHistory } from "./expense.service.js";

// ============================
// Expense Reports
// ============================

export const getExpenseReports = async (
  organizationId: string,
  offset: number,
  limit: number,
  filters?: {
    status?: string;
    employeeId?: number;
    startDate?: string;
    endDate?: string;
    submittedStartDate?: string;
    submittedEndDate?: string;
    approvedBy?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    includeDeleted?: boolean;
  },
) => {
  let whereConditions = [eq(expenseReports.organizationId, organizationId)];

  // Include deleted filter
  if (!filters?.includeDeleted) {
    whereConditions.push(eq(expenseReports.isDeleted, false));
  }

  // Apply filters
  if (filters?.status) {
    whereConditions.push(eq(expenseReports.status, filters.status as any));
  }

  if (filters?.employeeId) {
    whereConditions.push(eq(expenseReports.employeeId, filters.employeeId));
  }

  if (filters?.startDate) {
    whereConditions.push(
      gte(expenseReports.reportPeriodStart, filters.startDate),
    );
  }

  if (filters?.endDate) {
    whereConditions.push(lte(expenseReports.reportPeriodEnd, filters.endDate));
  }

  if (filters?.submittedStartDate) {
    whereConditions.push(
      gte(expenseReports.submittedDate, new Date(filters.submittedStartDate)),
    );
  }

  if (filters?.submittedEndDate) {
    whereConditions.push(
      lte(expenseReports.submittedDate, new Date(filters.submittedEndDate)),
    );
  }

  if (filters?.approvedBy) {
    whereConditions.push(eq(expenseReports.approvedBy, filters.approvedBy));
  }

  if (filters?.search) {
    whereConditions.push(
      or(
        ilike(expenseReports.title, `%${filters.search}%`),
        ilike(expenseReports.description, `%${filters.search}%`),
        ilike(expenseReports.reportNumber, `%${filters.search}%`),
      )!,
    );
  }

  // Determine sort order
  const sortField = filters?.sortBy || "createdAt";
  const sortDirection = filters?.sortOrder === "asc" ? asc : desc;
  let orderBy;

  switch (sortField) {
    case "reportPeriodStart":
      orderBy = sortDirection(expenseReports.reportPeriodStart);
      break;
    case "reportPeriodEnd":
      orderBy = sortDirection(expenseReports.reportPeriodEnd);
      break;
    case "submittedDate":
      orderBy = sortDirection(expenseReports.submittedDate);
      break;
    case "totalAmount":
      orderBy = sortDirection(expenseReports.totalAmount);
      break;
    default:
      orderBy = sortDirection(expenseReports.createdAt);
  }

  // Get reports with related data
  const result = await db
    .select({
      // Report data
      id: expenseReports.id,
      reportNumber: expenseReports.reportNumber,
      organizationId: expenseReports.organizationId,
      employeeId: expenseReports.employeeId,
      status: expenseReports.status,
      title: expenseReports.title,
      description: expenseReports.description,
      reportPeriodStart: expenseReports.reportPeriodStart,
      reportPeriodEnd: expenseReports.reportPeriodEnd,
      totalExpenses: expenseReports.totalExpenses,
      totalAmount: expenseReports.totalAmount,
      totalReimbursable: expenseReports.totalReimbursable,
      totalNonReimbursable: expenseReports.totalNonReimbursable,
      totalMileage: expenseReports.totalMileage,
      totalMileageAmount: expenseReports.totalMileageAmount,
      submittedDate: expenseReports.submittedDate,
      approvedDate: expenseReports.approvedDate,
      paidDate: expenseReports.paidDate,
      approvedBy: expenseReports.approvedBy,
      rejectedBy: expenseReports.rejectedBy,
      rejectionReason: expenseReports.rejectionReason,
      notes: expenseReports.notes,
      internalNotes: expenseReports.internalNotes,
      createdBy: expenseReports.createdBy,
      createdAt: expenseReports.createdAt,
      updatedAt: expenseReports.updatedAt,
      // Employee data
      employeeFullName: users.fullName,
      employeeEmail: users.email,
    })
    .from(expenseReports)
    .leftJoin(employees, eq(expenseReports.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(...whereConditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(expenseReports)
    .where(and(...whereConditions));

  const total = totalResult[0]?.count || 0;

  // Get unique user IDs and fetch their names in batch
  const userIds = Array.from(
    new Set([
      ...result.map((r) => r.createdBy).filter((id): id is string => !!id),
      ...result.map((r) => r.approvedBy).filter((id): id is string => !!id),
      ...result.map((r) => r.rejectedBy).filter((id): id is string => !!id),
    ]),
  );
  const userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const usersResult = await db
      .select({
        id: users.id,
        fullName: users.fullName,
      })
      .from(users)
      .where(inArray(users.id, userIds));
    usersResult.forEach((u) => userMap.set(u.id, u.fullName));
  }

  // Add employee info and user names to results
  const reportsWithEmployee = result.map((report) => ({
    ...report,
    createdByName: report.createdBy
      ? userMap.get(report.createdBy) || null
      : null,
    approvedByName: report.approvedBy
      ? userMap.get(report.approvedBy) || null
      : null,
    rejectedByName: report.rejectedBy
      ? userMap.get(report.rejectedBy) || null
      : null,
    employee: report.employeeFullName
      ? {
          id: report.employeeId,
          fullName: report.employeeFullName,
          email: report.employeeEmail,
        }
      : undefined,
  }));

  return {
    data: reportsWithEmployee,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getExpenseReportById = async (
  organizationId: string | undefined,
  id: string,
) => {
  // Get main report data
  const reportResult = await db
    .select({
      // All report fields
      id: expenseReports.id,
      reportNumber: expenseReports.reportNumber,
      organizationId: expenseReports.organizationId,
      employeeId: expenseReports.employeeId,
      status: expenseReports.status,
      title: expenseReports.title,
      description: expenseReports.description,
      reportPeriodStart: expenseReports.reportPeriodStart,
      reportPeriodEnd: expenseReports.reportPeriodEnd,
      totalExpenses: expenseReports.totalExpenses,
      totalAmount: expenseReports.totalAmount,
      totalReimbursable: expenseReports.totalReimbursable,
      totalNonReimbursable: expenseReports.totalNonReimbursable,
      totalMileage: expenseReports.totalMileage,
      totalMileageAmount: expenseReports.totalMileageAmount,
      submittedDate: expenseReports.submittedDate,
      approvedDate: expenseReports.approvedDate,
      paidDate: expenseReports.paidDate,
      approvedBy: expenseReports.approvedBy,
      rejectedBy: expenseReports.rejectedBy,
      rejectionReason: expenseReports.rejectionReason,
      notes: expenseReports.notes,
      internalNotes: expenseReports.internalNotes,
      createdBy: expenseReports.createdBy,
      createdAt: expenseReports.createdAt,
      updatedAt: expenseReports.updatedAt,
      // Employee data
      employeeFullName: users.fullName,
      employeeEmail: users.email,
    })
    .from(expenseReports)
    .leftJoin(employees, eq(expenseReports.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(() => {
      const conditions = [
        eq(expenseReports.id, id),
        organizationId
          ? eq(expenseReports.organizationId, organizationId)
          : undefined,
        eq(expenseReports.isDeleted, false),
      ].filter(Boolean) as any[];

      return conditions.length > 0 ? and(...conditions) : undefined;
    })
    .limit(1);

  if (!reportResult[0]) {
    return null;
  }

  const report = reportResult[0];

  // Get user names for createdBy, approvedBy, rejectedBy
  const userIds = [
    report.createdBy,
    report.approvedBy,
    report.rejectedBy,
  ].filter((id): id is string => !!id);

  const userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const usersResult = await db
      .select({
        id: users.id,
        fullName: users.fullName,
      })
      .from(users)
      .where(inArray(users.id, userIds));
    usersResult.forEach((u) => userMap.set(u.id, u.fullName));
  }

  // Get report items (expenses)
  const itemsResult = await db
    .select({
      // Report item data
      id: expenseReportItems.id,
      reportId: expenseReportItems.reportId,
      expenseId: expenseReportItems.expenseId,
      addedAt: expenseReportItems.addedAt,
      sortOrder: expenseReportItems.sortOrder,
      // Expense data
      expenseNumber: expenses.expenseNumber,
      title: expenses.title,
      description: expenses.description,
      amount: expenses.amount,
      expenseDate: expenses.expenseDate,
      status: expenses.status,
      expenseType: expenses.expenseType,
      vendor: expenses.vendor,
      // Category data
      categoryName: expenseCategories.name,
      categoryCode: expenseCategories.code,
    })
    .from(expenseReportItems)
    .leftJoin(expenses, eq(expenseReportItems.expenseId, expenses.id))
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(
      and(
        eq(expenseReportItems.reportId, id),
        organizationId
          ? eq(expenseReportItems.organizationId, organizationId)
          : undefined,
        eq(expenseReportItems.isDeleted, false),
      ),
    )
    .orderBy(
      asc(expenseReportItems.sortOrder),
      asc(expenseReportItems.addedAt),
    );

  return {
    ...report,
    createdByName: report.createdBy
      ? userMap.get(report.createdBy) || null
      : null,
    approvedByName: report.approvedBy
      ? userMap.get(report.approvedBy) || null
      : null,
    rejectedByName: report.rejectedBy
      ? userMap.get(report.rejectedBy) || null
      : null,
    employee: report.employeeFullName
      ? {
          id: report.employeeId,
          fullName: report.employeeFullName,
          email: report.employeeEmail,
        }
      : undefined,
    items: itemsResult.map((item) => ({
      id: item.id,
      reportId: item.reportId,
      expenseId: item.expenseId,
      addedAt: item.addedAt,
      sortOrder: item.sortOrder,
      expense: {
        id: item.expenseId,
        expenseNumber: item.expenseNumber,
        title: item.title,
        description: item.description,
        amount: item.amount,
        expenseDate: item.expenseDate,
        status: item.status,
        expenseType: item.expenseType,
        vendor: item.vendor,
        category: item.categoryName
          ? {
              name: item.categoryName,
              code: item.categoryCode,
            }
          : undefined,
      },
    })),
  };
};

export const createExpenseReport = async (
  organizationId: string,
  employeeId: number,
  reportData: any,
  createdBy: string,
) => {
  // Generate report number
  const reportNumber = await generateReportNumber(organizationId);

  // Validate that all expenses belong to the employee and are in draft/submitted status
  const expenseValidation = await db
    .select({
      id: expenses.id,
      employeeId: expenses.employeeId,
      status: expenses.status,
      amount: expenses.amount,
      isReimbursable: expenses.isReimbursable,
      isMileageExpense: expenses.isMileageExpense,
      miles: expenses.miles,
      mileageRate: expenses.mileageRate,
    })
    .from(expenses)
    .where(
      and(
        sql`${expenses.id} = ANY(${reportData.expenseIds})`,
        eq(expenses.organizationId, organizationId),
        eq(expenses.isDeleted, false),
      ),
    );

  // Validate expenses
  const invalidExpenses = expenseValidation.filter(
    (exp) =>
      exp.employeeId !== employeeId ||
      !["draft", "submitted"].includes(exp.status),
  );

  if (invalidExpenses.length > 0) {
    throw new Error("Some expenses are not valid for this report");
  }

  // Calculate totals
  const totals = calculateReportTotals(expenseValidation);

  // Create the report
  const newReport = await db
    .insert(expenseReports)
    .values({
      reportNumber,
      organizationId,
      employeeId,
      ...reportData,
      ...totals,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const report = newReport[0];

  // Create report items
  const items = await Promise.all(
    reportData.expenseIds.map((expenseId: string, index: number) =>
      db
        .insert(expenseReportItems)
        .values({
          organizationId,
          reportId: report!.id,
          expenseId,
          sortOrder: index,
          addedAt: new Date(),
          createdAt: new Date(),
        })
        .returning(),
    ),
  );

  return { report, items: items.map((item) => item[0]) };
};

export const updateExpenseReport = async (
  organizationId: string,
  id: string,
  updateData: any,
  _updatedBy: string,
) => {
  // If expenseIds are being updated, recalculate totals
  if (updateData.expenseIds) {
    const expenseValidation = await db
      .select({
        id: expenses.id,
        amount: expenses.amount,
        isReimbursable: expenses.isReimbursable,
        isMileageExpense: expenses.isMileageExpense,
        miles: expenses.miles,
        mileageRate: expenses.mileageRate,
      })
      .from(expenses)
      .where(
        and(
          sql`${expenses.id} = ANY(${updateData.expenseIds})`,
          eq(expenses.organizationId, organizationId),
          eq(expenses.isDeleted, false),
        ),
      );

    const totals = calculateReportTotals(expenseValidation);
    Object.assign(updateData, totals);

    // Update report items
    await db
      .update(expenseReportItems)
      .set({ isDeleted: true })
      .where(
        and(
          eq(expenseReportItems.reportId, id),
          eq(expenseReportItems.organizationId, organizationId),
        ),
      );

    // Create new items
    await Promise.all(
      updateData.expenseIds.map((expenseId: string, index: number) =>
        db.insert(expenseReportItems).values({
          organizationId,
          reportId: id,
          expenseId,
          sortOrder: index,
          addedAt: new Date(),
          createdAt: new Date(),
        }),
      ),
    );
  }

  const updated = await db
    .update(expenseReports)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(expenseReports.id, id),
        eq(expenseReports.organizationId, organizationId),
        eq(expenseReports.isDeleted, false),
      ),
    )
    .returning();

  return updated[0] || null;
};

export const deleteExpenseReport = async (
  organizationId: string,
  id: string,
) => {
  const deleted = await db
    .update(expenseReports)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(expenseReports.id, id),
        eq(expenseReports.organizationId, organizationId),
      ),
    )
    .returning();

  return deleted[0] || null;
};

export const submitExpenseReport = async (
  organizationId: string,
  id: string,
  submittedBy: string,
  notes?: string,
) => {
  const updated = await db
    .update(expenseReports)
    .set({
      status: "submitted",
      submittedDate: new Date(),
      notes: notes || undefined,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(expenseReports.id, id),
        eq(expenseReports.organizationId, organizationId),
        eq(expenseReports.status, "draft"),
        eq(expenseReports.isDeleted, false),
      ),
    )
    .returning();

  if (updated[0]) {
    // Update all expenses in the report to submitted status
    const reportItems = await db
      .select({ expenseId: expenseReportItems.expenseId })
      .from(expenseReportItems)
      .where(
        and(
          eq(expenseReportItems.reportId, id),
          eq(expenseReportItems.organizationId, organizationId),
          eq(expenseReportItems.isDeleted, false),
        ),
      );

    await Promise.all(
      reportItems.map((item) =>
        db
          .update(expenses)
          .set({
            status: "submitted",
            submittedDate: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(expenses.id, item.expenseId),
              eq(expenses.organizationId, organizationId),
              eq(expenses.status, "draft"),
            ),
          ),
      ),
    );

    // Log history for each expense
    await Promise.all(
      reportItems.map((item) =>
        logExpenseHistory(
          organizationId,
          item.expenseId,
          "submitted_via_report",
          `Expense submitted via report ${updated[0]?.reportNumber}`,
          submittedBy,
        ),
      ),
    );
  }

  return { report: updated[0] || null };
};

// ============================
// Helper Functions
// ============================

const generateReportNumber = async (
  organizationId: string,
): Promise<string> => {
  const year = new Date().getFullYear();
  const month = (new Date().getMonth() + 1).toString().padStart(2, "0");
  const prefix = `RPT-${year}${month}-`;

  const lastReport = await db
    .select({ reportNumber: expenseReports.reportNumber })
    .from(expenseReports)
    .where(
      and(
        eq(expenseReports.organizationId, organizationId),
        ilike(expenseReports.reportNumber, `${prefix}%`),
      ),
    )
    .orderBy(desc(expenseReports.reportNumber))
    .limit(1);

  let nextNumber = 1;
  if (lastReport[0]) {
    const lastNumber =
      parseInt(lastReport[0]?.reportNumber?.split("-")[2] || "0") || 0;
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(4, "0")}`;
};

const calculateReportTotals = (expenses: any[]) => {
  let totalExpenses = expenses.length;
  let totalAmount = 0;
  let totalReimbursable = 0;
  let totalNonReimbursable = 0;
  let totalMileage = 0;
  let totalMileageAmount = 0;

  expenses.forEach((expense) => {
    const amount = parseFloat(expense.amount);
    totalAmount += amount;

    if (expense.isReimbursable) {
      totalReimbursable += amount;
    } else {
      totalNonReimbursable += amount;
    }

    if (expense.isMileageExpense && expense.miles && expense.mileageRate) {
      const miles = parseFloat(expense.miles);
      const rate = parseFloat(expense.mileageRate);
      totalMileage += miles;
      totalMileageAmount += miles * rate;
    }
  });

  return {
    totalExpenses,
    totalAmount: totalAmount.toString(),
    totalReimbursable: totalReimbursable.toString(),
    totalNonReimbursable: totalNonReimbursable.toString(),
    totalMileage: totalMileage.toString(),
    totalMileageAmount: totalMileageAmount.toString(),
  };
};
