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
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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

// Aliases for joining users table multiple times (createdBy, approvedBy, rejectedBy)
const createdByUser = alias(users, "created_by_user");
const approvedByUser = alias(users, "approved_by_user");
const rejectedByUser = alias(users, "rejected_by_user");

export const getExpenseReports = async (
  organizationId: string | undefined,
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
  const whereConditions = [];
  if (organizationId != null) {
    whereConditions.push(eq(expenseReports.organizationId, organizationId));
  }

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

  // Add employee info to results
  const reportsWithEmployee = result.map((report) => ({
    ...report,
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
  const conditions = [
    eq(expenseReports.id, id),
    eq(expenseReports.isDeleted, false),
  ];
  if (organizationId != null) {
    conditions.push(eq(expenseReports.organizationId, organizationId));
  }
  // Employee user alias (for employee data)
  const employeeUser = alias(users, "employee_user");

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
      employeeFullName: employeeUser.fullName,
      employeeEmail: employeeUser.email,
      // User name fields
      createdByName: createdByUser.fullName,
      approvedByName: approvedByUser.fullName,
      rejectedByName: rejectedByUser.fullName,
    })
    .from(expenseReports)
    .leftJoin(employees, eq(expenseReports.employeeId, employees.id))
    .leftJoin(employeeUser, eq(employees.userId, employeeUser.id))
    .leftJoin(createdByUser, eq(expenseReports.createdBy, createdByUser.id))
    .leftJoin(approvedByUser, eq(expenseReports.approvedBy, approvedByUser.id))
    .leftJoin(rejectedByUser, eq(expenseReports.rejectedBy, rejectedByUser.id))
    .where(and(...conditions))
    .limit(1);

  if (!reportResult[0]) {
    return null;
  }

  const report = reportResult[0];

  const itemConditions = [
    eq(expenseReportItems.reportId, id),
    eq(expenseReportItems.isDeleted, false),
  ];
  if (organizationId != null) {
    itemConditions.push(eq(expenseReportItems.organizationId, organizationId));
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
    .where(and(...itemConditions))
    .orderBy(
      asc(expenseReportItems.sortOrder),
      asc(expenseReportItems.addedAt),
    );

  const {
    createdByName,
    approvedByName,
    rejectedByName,
    employeeFullName,
    employeeEmail,
    ...reportData
  } = report;

  return {
    ...reportData,
    createdByName: createdByName ?? null,
    approvedByName: approvedByName ?? null,
    rejectedByName: rejectedByName ?? null,
    employee: employeeFullName
      ? {
          id: report.employeeId,
          fullName: employeeFullName,
          email: employeeEmail,
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
  organizationId: string | undefined,
  employeeId: number,
  reportData: any,
  createdBy: string,
) => {
  // organization_id is not on org.expenses; caller must pass organizationId when creating a report
  const resolvedOrgId = organizationId;
  if (resolvedOrgId == null) {
    throw new Error(
      "Organization ID is required when creating an expense report.",
    );
  }

  // Generate report number
  const reportNumber = await generateReportNumber(resolvedOrgId);

  // Validate that all expenses exist and are in draft/submitted status
  const expenseValidation = await db
    .select({
      id: expenses.id,
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
        eq(expenses.isDeleted, false),
      ),
    );

  // Filter to expenses that are draft/submitted
  const validForReport = expenseValidation.filter((exp) =>
    ["draft", "submitted"].includes(exp.status),
  );
  if (validForReport.length !== expenseValidation.length) {
    throw new Error("Some expenses are not valid for this report");
  }

  // Calculate totals
  const totals = calculateReportTotals(expenseValidation);

  // Create the report
  const newReport = await db
    .insert(expenseReports)
    .values({
      reportNumber,
      organizationId: resolvedOrgId,
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
          organizationId: resolvedOrgId,
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
  organizationId: string | undefined,
  id: string,
  updateData: any,
  _updatedBy: string,
) => {
  const reportConditions = [
    eq(expenseReports.id, id),
    eq(expenseReports.isDeleted, false),
  ];
  if (organizationId != null) {
    reportConditions.push(eq(expenseReports.organizationId, organizationId));
  }

  // When organizationId undefined and expenseIds are being updated, derive from existing report
  let resolvedOrgId = organizationId;
  if (updateData.expenseIds && resolvedOrgId == null) {
    const [existing] = await db
      .select({ organizationId: expenseReports.organizationId })
      .from(expenseReports)
      .where(and(...reportConditions))
      .limit(1);
    resolvedOrgId = existing?.organizationId ?? undefined;
  }

  // If expenseIds are being updated, recalculate totals
  if (updateData.expenseIds && resolvedOrgId != null) {
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
          eq(expenses.isDeleted, false),
        ),
      );

    const totals = calculateReportTotals(expenseValidation);
    Object.assign(updateData, totals);

    const itemConditions = [eq(expenseReportItems.reportId, id)];
    if (resolvedOrgId != null) {
      itemConditions.push(eq(expenseReportItems.organizationId, resolvedOrgId));
    }
    // Update report items
    await db
      .update(expenseReportItems)
      .set({ isDeleted: true })
      .where(and(...itemConditions));

    // Create new items
    await Promise.all(
      updateData.expenseIds.map((expenseId: string, index: number) =>
        db.insert(expenseReportItems).values({
          organizationId: resolvedOrgId,
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
    .where(and(...reportConditions))
    .returning();

  return updated[0] || null;
};

export const deleteExpenseReport = async (
  organizationId: string | undefined,
  id: string,
) => {
  const conditions = [eq(expenseReports.id, id)];
  if (organizationId != null) {
    conditions.push(eq(expenseReports.organizationId, organizationId));
  }
  const deleted = await db
    .update(expenseReports)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning();

  return deleted[0] || null;
};

export const submitExpenseReport = async (
  organizationId: string | undefined,
  id: string,
  submittedBy: string,
  notes?: string,
) => {
  const conditions = [
    eq(expenseReports.id, id),
    eq(expenseReports.status, "draft"),
    eq(expenseReports.isDeleted, false),
  ];
  if (organizationId != null) {
    conditions.push(eq(expenseReports.organizationId, organizationId));
  }
  const updated = await db
    .update(expenseReports)
    .set({
      status: "submitted",
      submittedDate: new Date(),
      notes: notes || undefined,
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning();

  const resolvedOrgId = organizationId ?? updated[0]?.organizationId;
  if (updated[0] && resolvedOrgId != null) {
    const itemConditions = [
      eq(expenseReportItems.reportId, id),
      eq(expenseReportItems.isDeleted, false),
    ];
    itemConditions.push(eq(expenseReportItems.organizationId, resolvedOrgId));
    // Update all expenses in the report to submitted status
    const reportItems = await db
      .select({ expenseId: expenseReportItems.expenseId })
      .from(expenseReportItems)
      .where(and(...itemConditions));

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
            and(eq(expenses.id, item.expenseId), eq(expenses.status, "draft")),
          ),
      ),
    );

    // Log history for each expense
    await Promise.all(
      reportItems.map((item) =>
        logExpenseHistory(
          resolvedOrgId,
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
