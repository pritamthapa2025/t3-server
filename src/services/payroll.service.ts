import {
  count,
  eq,
  desc,
  and,
  or,
  sql,
  gte,
  lte,
  ilike,
  ne,
} from "drizzle-orm";
import { db } from "../config/db.js";
import {
  payPeriods,
  payrollRuns,
  payrollEntries,
  payrollAuditLog,
  payrollTimesheetEntries,
} from "../drizzle/schema/payroll.schema.js";
import { employees, positions } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { timesheets } from "../drizzle/schema/timesheet.schema.js";
import { alias } from "drizzle-orm/pg-core";
import { logger } from "../utils/logger.js";

interface PayrollDashboardFilters {
  payPeriodId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

interface PayrollEntriesFilters {
  search?: string | undefined;
  payPeriodId?: string | undefined;
  status?: string | undefined;
  employeeId?: string | undefined;
}

interface PayrollRunsFilters {
  search?: string | undefined;
  status?: string | undefined;
}

// Dashboard Service (T3 internal - no organizationId)
export const getPayrollDashboard = async (filters: PayrollDashboardFilters) => {
  let whereConditions = [eq(payrollEntries.isDeleted, false)];

  // Add filters
  if (filters.payPeriodId) {
    whereConditions.push(eq(payrollRuns.payPeriodId, filters.payPeriodId));
  }

  if (filters.dateFrom && filters.dateTo) {
    whereConditions.push(
      gte(payrollEntries.scheduledDate, filters.dateFrom),
      lte(payrollEntries.scheduledDate, filters.dateTo),
    );
  }

  // Get summary statistics
  const summaryResult = await db
    .select({
      totalNetPayout: sql<number>`COALESCE(SUM(${payrollEntries.netPay}), 0)`,
      totalGrossPay: sql<number>`COALESCE(SUM(${payrollEntries.grossPay}), 0)`,
      totalDeductions: sql<number>`COALESCE(SUM(${payrollEntries.totalDeductions}), 0)`,
      totalEmployees: sql<number>`COUNT(DISTINCT ${payrollEntries.employeeId})`,
      totalHours: sql<number>`COALESCE(SUM(${payrollEntries.totalHours}), 0)`,
      totalRegularHours: sql<number>`COALESCE(SUM(${payrollEntries.regularHours}), 0)`,
      totalOvertimeHours: sql<number>`COALESCE(SUM(${payrollEntries.overtimeHours}), 0)`,
      totalDoubleOvertimeHours: sql<number>`COALESCE(SUM(${payrollEntries.doubleOvertimeHours}), 0)`,
      totalBonuses: sql<number>`COALESCE(SUM(${payrollEntries.bonuses}), 0)`,
      totalPtoHours: sql<number>`COALESCE(SUM(${payrollEntries.ptoHours}), 0)`,
      totalSickHours: sql<number>`COALESCE(SUM(${payrollEntries.sickHours}), 0)`,
      totalHolidayHours: sql<number>`COALESCE(SUM(${payrollEntries.holidayHours}), 0)`,
    })
    .from(payrollEntries)
    .leftJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
    .where(and(...whereConditions));

  // Get payment status breakdown
  const paymentStatusResult = await db
    .select({
      status: payrollEntries.status,
      count: count(),
    })
    .from(payrollEntries)
    .leftJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
    .where(and(...whereConditions))
    .groupBy(payrollEntries.status);

  // Count payroll entries by status
  const statusCounts = paymentStatusResult.reduce(
    (acc, item) => {
      acc[item.status] = item.count;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    summary: summaryResult[0] || {
      totalNetPayout: 0,
      totalGrossPay: 0,
      totalDeductions: 0,
      totalEmployees: 0,
      totalHours: 0,
      totalRegularHours: 0,
      totalOvertimeHours: 0,
      totalDoubleOvertimeHours: 0,
      totalBonuses: 0,
      totalPtoHours: 0,
      totalSickHours: 0,
      totalHolidayHours: 0,
    },
    paymentStatus: {
      draft: statusCounts.draft || 0,
      pending_approval: statusCounts.pending_approval || 0,
      approved: statusCounts.approved || 0,
      processed: statusCounts.processed || 0,
      paid: statusCounts.paid || 0,
      failed: statusCounts.failed || 0,
      cancelled: statusCounts.cancelled || 0,
    },
  };
};

// Payroll Entries Service (T3 internal - no organizationId filter)
// Aliases for joining users table multiple times
const createdByUser = alias(users, "created_by_user");
const approvedByUser = alias(users, "approved_by_user");

export const getPayrollEntries = async (
  offset: number,
  limit: number,
  filters: PayrollEntriesFilters,
) => {
  let whereConditions = [eq(payrollEntries.isDeleted, false)];

  // Add search filter
  if (filters.search) {
    whereConditions.push(
      or(
        ilike(users.fullName, `%${filters.search}%`),
        ilike(employees.employeeId, `%${filters.search}%`),
        ilike(payrollEntries.entryNumber, `%${filters.search}%`),
      )!,
    );
  }

  // Add filters
  if (filters.payPeriodId) {
    whereConditions.push(eq(payrollRuns.payPeriodId, filters.payPeriodId));
  }

  if (filters.status) {
    whereConditions.push(eq(payrollEntries.status, filters.status as any));
  }

  if (filters.employeeId) {
    whereConditions.push(
      eq(payrollEntries.employeeId, parseInt(filters.employeeId)),
    );
  }

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(payrollEntries)
    .leftJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
    .leftJoin(employees, eq(payrollEntries.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(...whereConditions));

  const total = totalResult[0]?.count || 0;

  // Get paginated data
  const data = await db
    .select({
      // Payroll Entry Data
      id: payrollEntries.id,
      entryNumber: payrollEntries.entryNumber,
      status: payrollEntries.status,
      sourceType: payrollEntries.sourceType,

      // Hours Data
      regularHours: payrollEntries.regularHours,
      overtimeHours: payrollEntries.overtimeHours,
      doubleOvertimeHours: payrollEntries.doubleOvertimeHours,
      ptoHours: payrollEntries.ptoHours,
      sickHours: payrollEntries.sickHours,
      holidayHours: payrollEntries.holidayHours,
      totalHours: payrollEntries.totalHours,

      // Pay Data
      hourlyRate: payrollEntries.hourlyRate,
      regularPay: payrollEntries.regularPay,
      overtimePay: payrollEntries.overtimePay,
      doubleOvertimePay: payrollEntries.doubleOvertimePay,
      ptoPay: payrollEntries.ptoPay,
      sickPay: payrollEntries.sickPay,
      holidayPay: payrollEntries.holidayPay,
      bonuses: payrollEntries.bonuses,
      grossPay: payrollEntries.grossPay,
      totalDeductions: payrollEntries.totalDeductions,
      netPay: payrollEntries.netPay,

      // Payment Details
      paymentMethod: payrollEntries.paymentMethod,
      scheduledDate: payrollEntries.scheduledDate,
      processedDate: payrollEntries.processedDate,
      paidDate: payrollEntries.paidDate,

      // Employee Data
      employeeId: employees.id,
      employeeNumber: employees.employeeId,
      employeeName: users.fullName,

      // Pay Period Data
      payPeriodId: payPeriods.id,
      payPeriodStart: payPeriods.startDate,
      payPeriodEnd: payPeriods.endDate,
      payDate: payPeriods.payDate,
      frequency: payPeriods.frequency,

      // Run Data (for createdByName and approvedByName)
      createdByName: createdByUser.fullName,
      approvedByName: approvedByUser.fullName,

      // Audit fields
      createdAt: payrollEntries.createdAt,
      updatedAt: payrollEntries.updatedAt,
    })
    .from(payrollEntries)
    .leftJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
    .leftJoin(payPeriods, eq(payrollRuns.payPeriodId, payPeriods.id))
    .leftJoin(employees, eq(payrollEntries.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(createdByUser, eq(payrollRuns.createdBy, createdByUser.id))
    .leftJoin(approvedByUser, eq(payrollRuns.approvedBy, approvedByUser.id))
    .where(and(...whereConditions))
    .orderBy(desc(payrollEntries.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    data: data.map((entry) => ({
      ...entry,
      createdByName: entry.createdByName ?? null,
      approvedByName: entry.approvedByName ?? null,
    })),
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getPayrollEntryById = async (id: string) => {
  const [row] = await db
    .select({
      // Payroll Entry Data
      id: payrollEntries.id,
      entryNumber: payrollEntries.entryNumber,
      status: payrollEntries.status,
      sourceType: payrollEntries.sourceType,
      timesheetIntegrationStatus: payrollEntries.timesheetIntegrationStatus,
      autoApprovalReason: payrollEntries.autoApprovalReason,
      approvalWorkflow: payrollEntries.approvalWorkflow,
      isLocked: payrollEntries.isLocked,
      lockedReason: payrollEntries.lockedReason,

      // Hours Data
      regularHours: payrollEntries.regularHours,
      overtimeHours: payrollEntries.overtimeHours,
      doubleOvertimeHours: payrollEntries.doubleOvertimeHours,
      ptoHours: payrollEntries.ptoHours,
      sickHours: payrollEntries.sickHours,
      holidayHours: payrollEntries.holidayHours,
      totalHours: payrollEntries.totalHours,

      // Pay Rates
      hourlyRate: payrollEntries.hourlyRate,
      overtimeMultiplier: payrollEntries.overtimeMultiplier,
      doubleOvertimeMultiplier: payrollEntries.doubleOvertimeMultiplier,
      holidayMultiplier: payrollEntries.holidayMultiplier,

      // Pay Breakdown
      regularPay: payrollEntries.regularPay,
      overtimePay: payrollEntries.overtimePay,
      doubleOvertimePay: payrollEntries.doubleOvertimePay,
      ptoPay: payrollEntries.ptoPay,
      sickPay: payrollEntries.sickPay,
      holidayPay: payrollEntries.holidayPay,
      bonuses: payrollEntries.bonuses,
      grossPay: payrollEntries.grossPay,
      totalDeductions: payrollEntries.totalDeductions,
      netPay: payrollEntries.netPay,

      // Payment Details
      paymentMethod: payrollEntries.paymentMethod,
      bankAccountId: payrollEntries.bankAccountId,
      checkNumber: payrollEntries.checkNumber,
      scheduledDate: payrollEntries.scheduledDate,
      processedDate: payrollEntries.processedDate,
      paidDate: payrollEntries.paidDate,

      // Employee Data
      employeeId: employees.id,
      employeeNumber: employees.employeeId,
      employeeName: users.fullName,

      // Pay Period Data
      payPeriodId: payPeriods.id,
      payPeriodStart: payPeriods.startDate,
      payPeriodEnd: payPeriods.endDate,
      payDate: payPeriods.payDate,
      frequency: payPeriods.frequency,

      // Run Data
      payrollRunId: payrollRuns.id,
      runNumber: payrollRuns.runNumber,
      runType: payrollRuns.runType,
      runStatus: payrollRuns.status,
      createdByName: createdByUser.fullName,
      approvedByName: approvedByUser.fullName,

      // Notes and timestamps
      notes: payrollEntries.notes,
      createdAt: payrollEntries.createdAt,
      updatedAt: payrollEntries.updatedAt,
    })
    .from(payrollEntries)
    .leftJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
    .leftJoin(payPeriods, eq(payrollRuns.payPeriodId, payPeriods.id))
    .leftJoin(employees, eq(payrollEntries.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(createdByUser, eq(payrollRuns.createdBy, createdByUser.id))
    .leftJoin(approvedByUser, eq(payrollRuns.approvedBy, approvedByUser.id))
    .where(eq(payrollEntries.id, id))
    .limit(1);

  if (!row) return null;

  const { createdByName, approvedByName, ...record } = row;
  return {
    ...record,
    createdByName: createdByName ?? null,
    approvedByName: approvedByName ?? null,
  };
};

export const createPayrollEntry = async (data: any) => {
  // Check for existing entry for the same employee and pay period
  const existingEntry = await db
    .select({ id: payrollEntries.id })
    .from(payrollEntries)
    .leftJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
    .where(
      and(
        eq(payrollEntries.employeeId, data.employeeId),
        eq(payrollRuns.payPeriodId, data.payPeriodId),
        eq(payrollEntries.isDeleted, false),
      ),
    )
    .limit(1);

  if (existingEntry.length > 0) {
    const error = new Error("Payroll entry already exists") as any;
    error.code = "DUPLICATE_ENTRY";
    throw error;
  }

  // Calculate pay amounts
  const calculatedData = calculatePayAmounts(data);

  // Generate entry number (T3 internal - no organizationId needed)
  const entryNumber = await generatePayrollEntryNumber();

  const result = await db.transaction(async (tx) => {
    // Insert payroll entry
    const [newEntry] = await tx
      .insert(payrollEntries)
      .values({
        ...calculatedData,
        entryNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create audit log
    await tx.insert(payrollAuditLog).values({
      referenceType: "payroll_entry",
      referenceId: newEntry!.id,
      action: "created",
      description: "Payroll entry created",
      performedBy: data.createdBy,
      isAutomatedAction: false,
      createdAt: new Date(),
    });

    return newEntry;
  });

  return result;
};

export const updatePayrollEntry = async (id: string, data: any) => {
  // Check if entry is locked
  const entry = await db
    .select({ isLocked: payrollEntries.isLocked })
    .from(payrollEntries)
    .where(eq(payrollEntries.id, id))
    .limit(1);

  if (!entry[0]) {
    return null;
  }

  if (entry[0].isLocked) {
    const error = new Error("Entry is locked") as any;
    error.code = "ENTRY_LOCKED";
    throw error;
  }

  // Get old values for audit
  const oldValues = await getPayrollEntryById(id);

  // Calculate pay amounts
  const calculatedData = calculatePayAmounts(data);

  const result = await db.transaction(async (tx) => {
    // Update payroll entry
    const [updatedEntry] = await tx
      .update(payrollEntries)
      .set({
        ...calculatedData,
        updatedAt: new Date(),
      })
      .where(eq(payrollEntries.id, id))
      .returning();

    // Create audit log
    await tx.insert(payrollAuditLog).values({
      referenceType: "payroll_entry",
      referenceId: id,
      action: "updated",
      description: "Payroll entry updated",
      oldValues: oldValues,
      newValues: updatedEntry,
      performedBy: data.updatedBy,
      isAutomatedAction: false,
      createdAt: new Date(),
    });

    return updatedEntry;
  });

  return result;
};

export const deletePayrollEntry = async (id: string, deletedBy: string) => {
  // Check if entry is locked
  const entry = await db
    .select({
      isLocked: payrollEntries.isLocked,
    })
    .from(payrollEntries)
    .where(eq(payrollEntries.id, id))
    .limit(1);

  if (!entry[0]) {
    return null;
  }

  if (entry[0].isLocked) {
    const error = new Error("Entry is locked") as any;
    error.code = "ENTRY_LOCKED";
    throw error;
  }

  const result = await db.transaction(async (tx) => {
    // Soft delete payroll entry
    const [deletedEntry] = await tx
      .update(payrollEntries)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(payrollEntries.id, id))
      .returning();

    // Create audit log
    if (entry[0]) {
      await tx.insert(payrollAuditLog).values({
        referenceType: "payroll_entry",
        referenceId: id,
        action: "deleted",
        description: "Payroll entry deleted",
        performedBy: deletedBy,
        isAutomatedAction: false,
        createdAt: new Date(),
      });
    }

    return deletedEntry;
  });

  return result;
};

export const approvePayrollEntry = async (
  id: string,
  approvedBy: string,
  notes?: string,
) => {
  const entry = await db
    .select({
      status: payrollEntries.status,
    })
    .from(payrollEntries)
    .where(eq(payrollEntries.id, id))
    .limit(1);

  if (!entry[0]) {
    return null;
  }

  if (
    entry[0].status === "approved" ||
    entry[0].status === "processed" ||
    entry[0].status === "paid"
  ) {
    const error = new Error("Entry is already approved") as any;
    error.code = "ALREADY_APPROVED";
    throw error;
  }

  const result = await db.transaction(async (tx) => {
    // Update status to approved
    const [approvedEntry] = await tx
      .update(payrollEntries)
      .set({
        status: "approved",
        updatedAt: new Date(),
      })
      .where(eq(payrollEntries.id, id))
      .returning();

    // Create audit log
    if (entry[0]) {
      await tx.insert(payrollAuditLog).values({
        referenceType: "payroll_entry",
        referenceId: id,
        action: "approved",
        description: notes || "Payroll entry approved",
        performedBy: approvedBy,
        isAutomatedAction: false,
        createdAt: new Date(),
      });
    }

    return approvedEntry;
  });

  return result;
};

export const rejectPayrollEntry = async (
  id: string,
  rejectedBy: string,
  reason: string,
) => {
  const entry = await db
    .select({
      status: payrollEntries.status,
    })
    .from(payrollEntries)
    .where(eq(payrollEntries.id, id))
    .limit(1);

  if (!entry[0]) {
    return null;
  }

  if (entry[0].status === "processed" || entry[0].status === "paid") {
    const error = new Error("Cannot reject processed entry") as any;
    error.code = "ALREADY_PROCESSED";
    throw error;
  }

  const result = await db.transaction(async (tx) => {
    // Update status to draft and add rejection reason
    const [rejectedEntry] = await tx
      .update(payrollEntries)
      .set({
        status: "draft",
        notes: reason,
        updatedAt: new Date(),
      })
      .where(eq(payrollEntries.id, id))
      .returning();

    // Create audit log
    if (entry[0]) {
      await tx.insert(payrollAuditLog).values({
        referenceType: "payroll_entry",
        referenceId: id,
        action: "rejected",
        description: `Payroll entry rejected: ${reason}`,
        performedBy: rejectedBy,
        isAutomatedAction: false,
        createdAt: new Date(),
      });
    }

    return rejectedEntry;
  });

  return result;
};

// Payroll Runs Service (T3 internal - no organizationId filter)
export const getPayrollRuns = async (
  offset: number,
  limit: number,
  filters: PayrollRunsFilters,
) => {
  let whereConditions = [eq(payrollRuns.isDeleted, false)];

  if (filters.search) {
    whereConditions.push(
      or(
        ilike(payrollRuns.runNumber, `%${filters.search}%`),
        ilike(payrollRuns.runType, `%${filters.search}%`),
      )!,
    );
  }

  if (filters.status) {
    whereConditions.push(eq(payrollRuns.status, filters.status as any));
  }

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(payrollRuns)
    .where(and(...whereConditions));

  const total = totalResult[0]?.count || 0;

  // Get data
  const data = await db
    .select({
      id: payrollRuns.id,
      runNumber: payrollRuns.runNumber,
      runType: payrollRuns.runType,
      status: payrollRuns.status,
      totalEmployees: payrollRuns.totalEmployees,
      totalGrossPay: payrollRuns.totalGrossPay,
      totalDeductions: payrollRuns.totalDeductions,
      totalNetPay: payrollRuns.totalNetPay,
      totalRegularHours: payrollRuns.totalRegularHours,
      totalOvertimeHours: payrollRuns.totalOvertimeHours,
      totalBonuses: payrollRuns.totalBonuses,
      calculatedAt: payrollRuns.calculatedAt,
      approvedAt: payrollRuns.approvedAt,
      processedAt: payrollRuns.processedAt,
      paidAt: payrollRuns.paidAt,
      payPeriodId: payPeriods.id,
      payPeriodStart: payPeriods.startDate,
      payPeriodEnd: payPeriods.endDate,
      payDate: payPeriods.payDate,
      frequency: payPeriods.frequency,
      createdByName: createdByUser.fullName,
      approvedByName: approvedByUser.fullName,
      createdAt: payrollRuns.createdAt,
      updatedAt: payrollRuns.updatedAt,
    })
    .from(payrollRuns)
    .leftJoin(payPeriods, eq(payrollRuns.payPeriodId, payPeriods.id))
    .leftJoin(createdByUser, eq(payrollRuns.createdBy, createdByUser.id))
    .leftJoin(approvedByUser, eq(payrollRuns.approvedBy, approvedByUser.id))
    .where(and(...whereConditions))
    .orderBy(desc(payrollRuns.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    data: data.map((run) => ({
      ...run,
      createdByName: run.createdByName ?? null,
      approvedByName: run.approvedByName ?? null,
    })),
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getPayrollRunById = async (id: string) => {
  const [row] = await db
    .select({
      id: payrollRuns.id,
      runNumber: payrollRuns.runNumber,
      runType: payrollRuns.runType,
      status: payrollRuns.status,
      totalEmployees: payrollRuns.totalEmployees,
      totalGrossPay: payrollRuns.totalGrossPay,
      totalDeductions: payrollRuns.totalDeductions,
      totalNetPay: payrollRuns.totalNetPay,
      totalEmployerTaxes: payrollRuns.totalEmployerTaxes,
      totalRegularHours: payrollRuns.totalRegularHours,
      totalOvertimeHours: payrollRuns.totalOvertimeHours,
      totalBonuses: payrollRuns.totalBonuses,
      calculatedAt: payrollRuns.calculatedAt,
      approvedAt: payrollRuns.approvedAt,
      processedAt: payrollRuns.processedAt,
      paidAt: payrollRuns.paidAt,
      notes: payrollRuns.notes,
      payPeriodId: payPeriods.id,
      payPeriodStart: payPeriods.startDate,
      payPeriodEnd: payPeriods.endDate,
      payDate: payPeriods.payDate,
      frequency: payPeriods.frequency,
      createdByName: createdByUser.fullName,
      approvedByName: approvedByUser.fullName,
      createdAt: payrollRuns.createdAt,
      updatedAt: payrollRuns.updatedAt,
    })
    .from(payrollRuns)
    .leftJoin(payPeriods, eq(payrollRuns.payPeriodId, payPeriods.id))
    .leftJoin(createdByUser, eq(payrollRuns.createdBy, createdByUser.id))
    .leftJoin(approvedByUser, eq(payrollRuns.approvedBy, approvedByUser.id))
    .where(eq(payrollRuns.id, id))
    .limit(1);

  if (!row) return null;

  const { createdByName, approvedByName, ...record } = row;
  return {
    ...record,
    createdByName: createdByName ?? null,
    approvedByName: approvedByName ?? null,
  };
};

export const createPayrollRun = async (data: any) => {
  // Check for duplicate run (T3 internal - no organizationId filter)
  const existingRun = await db
    .select({ id: payrollRuns.id })
    .from(payrollRuns)
    .where(
      and(
        eq(payrollRuns.payPeriodId, data.payPeriodId),
        ne(payrollRuns.status, "cancelled"),
        eq(payrollRuns.isDeleted, false),
      ),
    )
    .limit(1);

  if (existingRun.length > 0) {
    const error = new Error("Payroll run already exists") as any;
    error.code = "DUPLICATE_RUN";
    throw error;
  }

  // Generate run number (T3 internal - no organizationId needed)
  const runNumber = await generatePayrollRunNumber();

  const result = await db.transaction(async (tx) => {
    const [newRun] = await tx
      .insert(payrollRuns)
      .values({
        ...data,
        runNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create audit log
    await tx.insert(payrollAuditLog).values({
      referenceType: "payroll_run",
      referenceId: newRun!.id,
      action: "created",
      description: "Payroll run created",
      performedBy: data.createdBy,
      isAutomatedAction: false,
      createdAt: new Date(),
    });

    return newRun;
  });

  return result;
};

export const processPayrollRun = async (id: string, processedBy: string) => {
  const run = await db
    .select({
      status: payrollRuns.status,
    })
    .from(payrollRuns)
    .where(eq(payrollRuns.id, id))
    .limit(1);

  if (!run[0]) {
    return null;
  }

  if (run[0].status === "processed" || run[0].status === "paid") {
    const error = new Error("Run already processed") as any;
    error.code = "ALREADY_PROCESSED";
    throw error;
  }

  const result = await db.transaction(async (tx) => {
    // Update run status and timestamps
    const [processedRun] = await tx
      .update(payrollRuns)
      .set({
        status: "processed",
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payrollRuns.id, id))
      .returning();

    // Update all entries in this run to processed
    await tx
      .update(payrollEntries)
      .set({
        status: "processed",
        processedDate: new Date().toISOString().split("T")[0],
        processedBy: processedBy,
        updatedAt: new Date(),
      })
      .where(eq(payrollEntries.payrollRunId, id));

    // Create audit log
    if (run[0]) {
      await tx.insert(payrollAuditLog).values({
        referenceType: "payroll_run",
        referenceId: id,
        action: "processed",
        description: "Payroll run processed",
        performedBy: processedBy,
        isAutomatedAction: false,
        createdAt: new Date(),
      });
    }

    return processedRun;
  });

  return result;
};

// --- Weekly pay period and payroll sync from timesheets (hourly) ---

/** Get Monday and Sunday of the week containing the given date (ISO week Mon–Sun). */
function getWeekStartEnd(date: Date): { startDate: string; endDate: string } {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun, 1 Mon, ... 6 Sat
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const start = new Date(d);
  start.setDate(d.getDate() - daysFromMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    startDate: start.toISOString().split("T")[0]!,
    endDate: end.toISOString().split("T")[0]!,
  };
}

/** Get ISO week number (1–53) for a date. */
function getISOWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/** Calendar month start (YYYY-MM-01) and end (last day of month). */
function getMonthStartEnd(date: Date): { startDate: string; endDate: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return {
    startDate: start.toISOString().split("T")[0]!,
    endDate: end.toISOString().split("T")[0]!,
  };
}

/** Get or create a monthly pay period for the month containing the given date. (T3 internal: no organizationId.) */
export const getOrCreatePayPeriodForMonth = async (date: Date) => {
  const { startDate, endDate } = getMonthStartEnd(date);
  const periodNumber = date.getMonth() + 1; // 1–12
  // Pay date = 5th of next month
  const payDate = new Date(date.getFullYear(), date.getMonth() + 1, 5);
  const payDateStr = payDate.toISOString().split("T")[0]!;

  const [existing] = await db
    .select()
    .from(payPeriods)
    .where(
      and(
        eq(payPeriods.frequency, "monthly"),
        eq(payPeriods.startDate, startDate),
        eq(payPeriods.endDate, endDate),
        eq(payPeriods.isDeleted, false),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(payPeriods)
    .values({
      frequency: "monthly",
      startDate,
      endDate,
      payDate: payDateStr,
      periodNumber,
      status: "draft",
      approvalWorkflow: "auto_from_timesheet",
      autoGenerateFromTimesheets: true,
      isDeleted: false,
    })
    .returning();

  return created!;
};

/** Get or create a weekly pay period for the week containing the given date. (T3 internal: no organizationId.) */
export const getOrCreatePayPeriodForWeek = async (date: Date) => {
  const { startDate, endDate } = getWeekStartEnd(date);
  const periodNumber = getISOWeekNumber(new Date(startDate));
  // Pay date = Friday after week end (end + 5 days)
  const end = new Date(endDate);
  end.setDate(end.getDate() + 5);
  const payDate = end.toISOString().split("T")[0]!;

  const [existing] = await db
    .select()
    .from(payPeriods)
    .where(
      and(
        eq(payPeriods.frequency, "weekly"),
        eq(payPeriods.startDate, startDate),
        eq(payPeriods.endDate, endDate),
        eq(payPeriods.isDeleted, false),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(payPeriods)
    .values({
      frequency: "weekly",
      startDate,
      endDate,
      payDate,
      periodNumber,
      status: "draft",
      approvalWorkflow: "auto_from_timesheet",
      autoGenerateFromTimesheets: true,
      isDeleted: false,
    })
    .returning();

  return created!;
};

/** Get or create a payroll run for the given pay period. (T3 internal: no organizationId.) */
export const getOrCreatePayrollRunForPeriod = async (payPeriodId: string) => {
  const [existing] = await db
    .select()
    .from(payrollRuns)
    .where(
      and(
        eq(payrollRuns.payPeriodId, payPeriodId),
        eq(payrollRuns.isDeleted, false),
        ne(payrollRuns.status, "cancelled"),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const runNumber = await generatePayrollRunNumber();
  const [created] = await db
    .insert(payrollRuns)
    .values({
      payPeriodId,
      runNumber,
      runType: "regular",
      status: "draft",
      isDeleted: false,
    })
    .returning();

  return created!;
};

export type SyncPayrollResult = { synced: boolean; reason?: string };

/**
 * Sync payroll from an approved timesheet: create or update the payroll entry for that
 * employee. Hourly: week period, aggregate approved timesheets. Salary: month period,
 * gross = position pay rate (when position pay type is salary).
 */
export const syncPayrollFromApprovedTimesheet = async (
  timesheetId: number,
): Promise<SyncPayrollResult> => {
  const [timesheet] = await db
    .select({
      id: timesheets.id,
      employeeId: timesheets.employeeId,
      sheetDate: timesheets.sheetDate,
      totalHours: timesheets.totalHours,
      overtimeHours: timesheets.overtimeHours,
      status: timesheets.status,
    })
    .from(timesheets)
    .where(eq(timesheets.id, timesheetId))
    .limit(1);

  if (!timesheet || timesheet.status !== "approved") {
    return { synced: false, reason: "Timesheet not found or not approved" };
  }

  const [row] = await db
    .select({
      id: employees.id,
      userId: employees.userId,
      hourlyRate: employees.hourlyRate,
      payType: employees.payType,
      positionPayType: positions.payType,
      positionPayRate: positions.payRate,
    })
    .from(employees)
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .where(eq(employees.id, timesheet.employeeId))
    .limit(1);

  if (!row) {
    logger.warn(`Payroll sync skipped: employee not found (timesheet ${timesheetId}, employeeId ${timesheet.employeeId})`);
    return { synced: false, reason: "Employee not found" };
  }

  const sheetDate =
    typeof timesheet.sheetDate === "string"
      ? new Date(timesheet.sheetDate)
      : timesheet.sheetDate;

  const positionPayType = row.positionPayType?.trim().toLowerCase();
  const isSalary =
    positionPayType === "salary" &&
    row.positionPayRate != null &&
    Number(row.positionPayRate) > 0;
  const salaryAmount = isSalary ? parseFloat(String(row.positionPayRate)) : 0;

  if (isSalary) {
    await syncSalaryPayrollForMonth(row.id, sheetDate, salaryAmount, timesheetId);
    return { synced: true };
  }

  // Effective pay: employee overrides, else fall back to position (for existing records)
  const payType = row.payType?.trim().toLowerCase() ?? positionPayType ?? null;
  const employeeHourlyRate =
    row.hourlyRate != null && Number(row.hourlyRate) > 0
      ? parseFloat(String(row.hourlyRate))
      : null;
  const positionHourlyRate =
    positionPayType === "hourly" &&
    row.positionPayRate != null &&
    Number(row.positionPayRate) > 0
      ? parseFloat(String(row.positionPayRate))
      : null;
  const hourlyRate = employeeHourlyRate ?? positionHourlyRate ?? 0;
  const hasHourlyRate = hourlyRate > 0;

  if (payType === "salary" || !hasHourlyRate) {
    const reason =
      "Employee must be hourly with an hourly rate set to create payroll from timesheet";
    logger.warn(
      `Payroll sync skipped (timesheet ${timesheetId}, employeeId ${row.id}): ${reason}. payType=${row.payType ?? "null"}, hourlyRate=${row.hourlyRate ?? "null"}`,
    );
    return { synced: false, reason };
  }

  const period = await getOrCreatePayPeriodForWeek(sheetDate);
  const run = await getOrCreatePayrollRunForPeriod(period.id);

  const approvedInPeriod = await db
    .select({
      id: timesheets.id,
      totalHours: timesheets.totalHours,
      overtimeHours: timesheets.overtimeHours,
    })
    .from(timesheets)
    .where(
      and(
        eq(timesheets.employeeId, row.id),
        eq(timesheets.status, "approved"),
        gte(timesheets.sheetDate, period.startDate),
        lte(timesheets.sheetDate, period.endDate),
      ),
    );

  let regularHours = 0;
  let overtimeHours = 0;
  for (const t of approvedInPeriod) {
    const total = parseFloat(String(t.totalHours ?? 0)) || 0;
    const ot = parseFloat(String(t.overtimeHours ?? 0)) || 0;
    regularHours += Math.max(0, total - ot);
    overtimeHours += ot;
  }
  const defaultDeductionRate =
    parseFloat(process.env.T3_PAYROLL_DEFAULT_DEDUCTION_RATE || "0") || 0;

  const payData = {
    payrollRunId: run.id,
    payPeriodId: period.id,
    employeeId: row.id,
    regularHours,
    overtimeHours,
    doubleOvertimeHours: 0,
    ptoHours: 0,
    sickHours: 0,
    holidayHours: 0,
    bonuses: 0,
    hourlyRate,
    overtimeMultiplier: 1.5,
    doubleOvertimeMultiplier: 2.0,
    holidayMultiplier: 1.5,
    totalDeductions: 0,
    deductionRate:
      defaultDeductionRate > 0 && defaultDeductionRate <= 1
        ? defaultDeductionRate
        : undefined,
    sourceType: "timesheet_auto",
    approvalWorkflow: "auto_from_timesheet",
    timesheetIntegrationStatus: "auto_generated",
    createdBy: undefined as string | undefined,
  };

  const calculatedData = calculatePayAmounts(payData);

  const [existingEntry] = await db
    .select({ id: payrollEntries.id })
    .from(payrollEntries)
    .where(
      and(
        eq(payrollEntries.payrollRunId, run.id),
        eq(payrollEntries.employeeId, row.id),
        eq(payrollEntries.isDeleted, false),
      ),
    )
    .limit(1);

  if (existingEntry) {
    await db
      .update(payrollEntries)
      .set({
        ...calculatedData,
        sourceType: "timesheet_auto",
        timesheetIntegrationStatus: "auto_generated",
        updatedAt: new Date(),
      })
      .where(eq(payrollEntries.id, existingEntry.id));

    await db
      .delete(payrollTimesheetEntries)
      .where(eq(payrollTimesheetEntries.payrollEntryId, existingEntry.id));
    for (const t of approvedInPeriod) {
      await db.insert(payrollTimesheetEntries).values({
        payrollEntryId: existingEntry.id,
        timesheetId: t.id,
        hoursIncluded: String(parseFloat(String(t.totalHours ?? 0)) || 0),
        overtimeHours: String(parseFloat(String(t.overtimeHours ?? 0)) || 0),
        doubleOvertimeHours: "0",
        includedInPayroll: true,
      });
    }
    return { synced: true };
  }

  const entryNumber = await generatePayrollEntryNumber();
  const [newEntry] = await db
    .insert(payrollEntries)
    .values({
      payrollRunId: run.id,
      employeeId: row.id,
      entryNumber,
      status: "draft",
      sourceType: "timesheet_auto",
      timesheetIntegrationStatus: "auto_generated",
      approvalWorkflow: "auto_from_timesheet",
      ...calculatedData,
      hourlyRate: String(hourlyRate),
      paymentMethod: "direct_deposit",
      isDeleted: false,
    })
    .returning();

  if (newEntry) {
    for (const t of approvedInPeriod) {
      await db.insert(payrollTimesheetEntries).values({
        payrollEntryId: newEntry.id,
        timesheetId: t.id,
        hoursIncluded: String(parseFloat(String(t.totalHours ?? 0)) || 0),
        overtimeHours: String(parseFloat(String(t.overtimeHours ?? 0)) || 0),
        doubleOvertimeHours: "0",
        includedInPayroll: true,
      });
    }
  }
  return { synced: true };
};

/** Sync monthly salary payroll: one entry per employee per month, gross = position pay rate. */
async function syncSalaryPayrollForMonth(
  employeeId: number,
  sheetDate: Date,
  salaryAmount: number,
  _timesheetId: number,
): Promise<void> {
  const period = await getOrCreatePayPeriodForMonth(sheetDate);
  const run = await getOrCreatePayrollRunForPeriod(period.id);

  const approvedInPeriod = await db
    .select({
      id: timesheets.id,
      totalHours: timesheets.totalHours,
      overtimeHours: timesheets.overtimeHours,
    })
    .from(timesheets)
    .where(
      and(
        eq(timesheets.employeeId, employeeId),
        eq(timesheets.status, "approved"),
        gte(timesheets.sheetDate, period.startDate),
        lte(timesheets.sheetDate, period.endDate),
      ),
    );

  const defaultDeductionRate =
    parseFloat(process.env.T3_PAYROLL_DEFAULT_DEDUCTION_RATE || "0") || 0;

  const payData = {
    payrollRunId: run.id,
    payPeriodId: period.id,
    employeeId,
    regularHours: 0,
    overtimeHours: 0,
    doubleOvertimeHours: 0,
    ptoHours: 0,
    sickHours: 0,
    holidayHours: 0,
    bonuses: salaryAmount,
    hourlyRate: 0,
    overtimeMultiplier: 1.5,
    doubleOvertimeMultiplier: 2.0,
    holidayMultiplier: 1.5,
    totalDeductions: 0,
    deductionRate:
      defaultDeductionRate > 0 && defaultDeductionRate <= 1
        ? defaultDeductionRate
        : undefined,
    sourceType: "timesheet_auto",
    approvalWorkflow: "auto_from_timesheet",
    timesheetIntegrationStatus: "auto_generated",
    createdBy: undefined as string | undefined,
  };

  const calculatedData = calculatePayAmounts(payData);

  const [existingEntry] = await db
    .select({ id: payrollEntries.id })
    .from(payrollEntries)
    .where(
      and(
        eq(payrollEntries.payrollRunId, run.id),
        eq(payrollEntries.employeeId, employeeId),
        eq(payrollEntries.isDeleted, false),
      ),
    )
    .limit(1);

  if (existingEntry) {
    await db
      .update(payrollEntries)
      .set({
        ...calculatedData,
        sourceType: "timesheet_auto",
        timesheetIntegrationStatus: "auto_generated",
        updatedAt: new Date(),
      })
      .where(eq(payrollEntries.id, existingEntry.id));

    await db
      .delete(payrollTimesheetEntries)
      .where(eq(payrollTimesheetEntries.payrollEntryId, existingEntry.id));
    for (const t of approvedInPeriod) {
      await db.insert(payrollTimesheetEntries).values({
        payrollEntryId: existingEntry.id,
        timesheetId: t.id,
        hoursIncluded: String(parseFloat(String(t.totalHours ?? 0)) || 0),
        overtimeHours: String(parseFloat(String(t.overtimeHours ?? 0)) || 0),
        doubleOvertimeHours: "0",
        includedInPayroll: true,
      });
    }
    return;
  }

  const entryNumber = await generatePayrollEntryNumber();
  const [newEntry] = await db
    .insert(payrollEntries)
    .values({
      payrollRunId: run.id,
      employeeId,
      entryNumber,
      status: "draft",
      sourceType: "timesheet_auto",
      timesheetIntegrationStatus: "auto_generated",
      approvalWorkflow: "auto_from_timesheet",
      ...calculatedData,
      hourlyRate: "0",
      paymentMethod: "direct_deposit",
      isDeleted: false,
    })
    .returning();

  if (newEntry) {
    for (const t of approvedInPeriod) {
      await db.insert(payrollTimesheetEntries).values({
        payrollEntryId: newEntry.id,
        timesheetId: t.id,
        hoursIncluded: String(parseFloat(String(t.totalHours ?? 0)) || 0),
        overtimeHours: String(parseFloat(String(t.overtimeHours ?? 0)) || 0),
        doubleOvertimeHours: "0",
        includedInPayroll: true,
      });
    }
  }
}

/**
 * Recalculate payroll for an hourly employee for the week containing sheetDate.
 * Used when a timesheet is rejected so the payroll entry is updated to exclude that day.
 * Aggregates only approved timesheets; if none remain, entry is updated to 0 hours / 0 pay.
 */
export const recalcPayrollForEmployeeWeek = async (
  employeeId: number,
  sheetDate: Date | string,
): Promise<void> => {
  const [employee] = await db
    .select({
      id: employees.id,
      hourlyRate: employees.hourlyRate,
      payType: employees.payType,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!employee) return;

  const payType = employee.payType?.trim().toLowerCase();
  if (payType === "salary" || !employee.hourlyRate) return;

  const date =
    typeof sheetDate === "string" ? new Date(sheetDate) : sheetDate;
  const period = await getOrCreatePayPeriodForWeek(date);
  const run = await getOrCreatePayrollRunForPeriod(period.id);

  const approvedInPeriod = await db
    .select({
      id: timesheets.id,
      totalHours: timesheets.totalHours,
      overtimeHours: timesheets.overtimeHours,
    })
    .from(timesheets)
    .where(
      and(
        eq(timesheets.employeeId, employee.id),
        eq(timesheets.status, "approved"),
        gte(timesheets.sheetDate, period.startDate),
        lte(timesheets.sheetDate, period.endDate),
      ),
    );

  let regularHours = 0;
  let overtimeHours = 0;
  for (const row of approvedInPeriod) {
    const total = parseFloat(String(row.totalHours ?? 0)) || 0;
    const ot = parseFloat(String(row.overtimeHours ?? 0)) || 0;
    regularHours += Math.max(0, total - ot);
    overtimeHours += ot;
  }

  const hourlyRate = parseFloat(String(employee.hourlyRate)) || 0;
  const defaultDeductionRate =
    parseFloat(process.env.T3_PAYROLL_DEFAULT_DEDUCTION_RATE || "0") || 0;

  const payData = {
    payrollRunId: run.id,
    payPeriodId: period.id,
    employeeId: employee.id,
    regularHours,
    overtimeHours,
    doubleOvertimeHours: 0,
    ptoHours: 0,
    sickHours: 0,
    holidayHours: 0,
    bonuses: 0,
    hourlyRate,
    overtimeMultiplier: 1.5,
    doubleOvertimeMultiplier: 2.0,
    holidayMultiplier: 1.5,
    totalDeductions: 0,
    deductionRate:
      defaultDeductionRate > 0 && defaultDeductionRate <= 1
        ? defaultDeductionRate
        : undefined,
    sourceType: "timesheet_auto",
    approvalWorkflow: "auto_from_timesheet",
    timesheetIntegrationStatus: "auto_generated",
    createdBy: undefined as string | undefined,
  };

  const calculatedData = calculatePayAmounts(payData);

  const [existingEntry] = await db
    .select({ id: payrollEntries.id })
    .from(payrollEntries)
    .where(
      and(
        eq(payrollEntries.payrollRunId, run.id),
        eq(payrollEntries.employeeId, employee.id),
        eq(payrollEntries.isDeleted, false),
      ),
    )
    .limit(1);

  if (!existingEntry) {
    return;
  }

  await db
    .update(payrollEntries)
    .set({
      ...calculatedData,
      sourceType: "timesheet_auto",
      timesheetIntegrationStatus: "auto_generated",
      updatedAt: new Date(),
    })
    .where(eq(payrollEntries.id, existingEntry.id));

  await db
    .delete(payrollTimesheetEntries)
    .where(eq(payrollTimesheetEntries.payrollEntryId, existingEntry.id));
  for (const row of approvedInPeriod) {
    await db.insert(payrollTimesheetEntries).values({
      payrollEntryId: existingEntry.id,
      timesheetId: row.id,
      hoursIncluded: String(
        parseFloat(String(row.totalHours ?? 0)) || 0,
      ),
      overtimeHours: String(parseFloat(String(row.overtimeHours ?? 0)) || 0),
      doubleOvertimeHours: "0",
      includedInPayroll: true,
    });
  }
};

// Helper Functions
const calculatePayAmounts = (data: any) => {
  const regularHours = parseFloat(data.regularHours) || 0;
  const overtimeHours = parseFloat(data.overtimeHours) || 0;
  const doubleOvertimeHours = parseFloat(data.doubleOvertimeHours) || 0;
  const ptoHours = parseFloat(data.ptoHours) || 0;
  const sickHours = parseFloat(data.sickHours) || 0;
  const holidayHours = parseFloat(data.holidayHours) || 0;
  const bonuses = parseFloat(data.bonuses) || 0;

  const hourlyRate = parseFloat(data.hourlyRate) || 0;
  const overtimeMultiplier = parseFloat(data.overtimeMultiplier) || 1.5;
  const doubleOvertimeMultiplier =
    parseFloat(data.doubleOvertimeMultiplier) || 2.0;
  const holidayMultiplier = parseFloat(data.holidayMultiplier) || 1.5;

  const regularPay = regularHours * hourlyRate;
  const overtimePay = overtimeHours * hourlyRate * overtimeMultiplier;
  const doubleOvertimePay =
    doubleOvertimeHours * hourlyRate * doubleOvertimeMultiplier;
  const ptoPay = ptoHours * hourlyRate;
  const sickPay = sickHours * hourlyRate;
  const holidayPay = holidayHours * hourlyRate * holidayMultiplier;

  const grossPay =
    regularPay +
    overtimePay +
    doubleOvertimePay +
    ptoPay +
    sickPay +
    holidayPay +
    bonuses;
  const totalHours =
    regularHours +
    overtimeHours +
    doubleOvertimeHours +
    ptoHours +
    sickHours +
    holidayHours;

  // Optional default deduction: deductionRate (0–1) applied to gross, or explicit totalDeductions
  let totalDeductions = parseFloat(data.totalDeductions) || 0;
  if (
    data.deductionRate != null &&
    Number(data.deductionRate) >= 0 &&
    Number(data.deductionRate) <= 1
  ) {
    totalDeductions = grossPay * Number(data.deductionRate);
  }
  const netPay = grossPay - totalDeductions;

  return {
    ...data,
    totalHours,
    regularPay,
    overtimePay,
    doubleOvertimePay,
    ptoPay,
    sickPay,
    holidayPay,
    grossPay,
    totalDeductions,
    netPay,
  };
};

const generatePayrollEntryNumber = async (): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const currentWeek = getWeekNumber(new Date());

  // Get count of entries this week (T3 internal - no organizationId filter)
  const countResult = await db
    .select({ count: count() })
    .from(payrollEntries)
    .where(gte(payrollEntries.createdAt, new Date(currentYear, 0, 1)));

  const sequence = (countResult[0]?.count || 0) + 1;
  return `PAY-${currentYear}-W${currentWeek.toString().padStart(2, "0")}-${sequence.toString().padStart(3, "0")}`;
};

const generatePayrollRunNumber = async (): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const currentWeek = getWeekNumber(new Date());

  // Get count of runs this week (T3 internal - no organizationId filter)
  const countResult = await db
    .select({ count: count() })
    .from(payrollRuns)
    .where(gte(payrollRuns.createdAt, new Date(currentYear, 0, 1)));

  const sequence = (countResult[0]?.count || 0) + 1;
  return `RUN-${currentYear}-W${currentWeek.toString().padStart(2, "0")}-${sequence.toString().padStart(3, "0")}`;
};

const getWeekNumber = (date: Date): number => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};
