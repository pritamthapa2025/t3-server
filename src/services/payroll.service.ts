import {
  count,
  eq,
  desc,
  and,
  or,
  sql,
  gte,
  lte,
  sum,
  ilike,
  isNull,
  ne,
} from "drizzle-orm";
import { db } from "../config/db.js";
import {
  payPeriods,
  payrollRuns,
  payrollEntries,
  payrollDeductions,
  payrollTimesheetEntries,
  timesheetPayrollIntegrationLog,
  payrollAuditLog,
  employeeCompensation,
} from "../drizzle/schema/payroll.schema.js";
import { employees, organizations } from "../drizzle/schema/org.schema.js";
import { timesheets } from "../drizzle/schema/timesheet.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";

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

// T3 internal organization ID for audit logs
const T3_ORGANIZATION_ID = process.env.T3_ORGANIZATION_ID || "00000000-0000-0000-0000-000000000000";

// Dashboard Service (T3 internal - no organizationId filter)
export const getPayrollDashboard = async (
  filters: PayrollDashboardFilters
) => {
  let whereConditions = [
    eq(payrollEntries.isDeleted, false),
  ];

  // Add filters
  if (filters.payPeriodId) {
    whereConditions.push(
      eq(payrollRuns.payPeriodId, filters.payPeriodId)
    );
  }

  if (filters.dateFrom && filters.dateTo) {
    whereConditions.push(
      gte(payrollEntries.scheduledDate, filters.dateFrom),
      lte(payrollEntries.scheduledDate, filters.dateTo)
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
  const statusCounts = paymentStatusResult.reduce((acc, item) => {
    acc[item.status] = item.count;
    return acc;
  }, {} as Record<string, number>);

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
export const getPayrollEntries = async (
  offset: number,
  limit: number,
  filters: PayrollEntriesFilters
) => {
  let whereConditions = [
    eq(payrollEntries.isDeleted, false),
  ];

  // Add search filter
  if (filters.search) {
    whereConditions.push(
      or(
        ilike(users.fullName, `%${filters.search}%`),
        ilike(employees.employeeId, `%${filters.search}%`),
        ilike(payrollEntries.entryNumber, `%${filters.search}%`)
      )!
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
    whereConditions.push(eq(payrollEntries.employeeId, parseInt(filters.employeeId)));
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

      // Audit fields
      createdAt: payrollEntries.createdAt,
      updatedAt: payrollEntries.updatedAt,
    })
    .from(payrollEntries)
    .leftJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
    .leftJoin(payPeriods, eq(payrollRuns.payPeriodId, payPeriods.id))
    .leftJoin(employees, eq(payrollEntries.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(...whereConditions))
    .orderBy(desc(payrollEntries.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    data,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getPayrollEntryById = async (id: string) => {
  const result = await db
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
    .where(eq(payrollEntries.id, id))
    .limit(1);

  return result[0] || null;
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
        eq(payrollEntries.isDeleted, false)
      )
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
        organizationId: T3_ORGANIZATION_ID, // T3 internal - default organization
        entryNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create audit log (T3 internal - use default organization)
    await tx.insert(payrollAuditLog).values({
      organizationId: T3_ORGANIZATION_ID, // T3 internal - default organization
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

    // Create audit log (T3 internal - use default organization)
    await tx.insert(payrollAuditLog).values({
      organizationId: T3_ORGANIZATION_ID, // T3 internal - default organization
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

    // Create audit log (T3 internal - use default organization)
    if (entry[0]) {
      await tx.insert(payrollAuditLog).values({
        organizationId: T3_ORGANIZATION_ID, // T3 internal - default organization
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

export const approvePayrollEntry = async (id: string, approvedBy: string, notes?: string) => {
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

  if (entry[0].status === "approved" || entry[0].status === "processed" || entry[0].status === "paid") {
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

    // Create audit log (T3 internal - use default organization)
    if (entry[0]) {
      await tx.insert(payrollAuditLog).values({
        organizationId: T3_ORGANIZATION_ID, // T3 internal - default organization
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

export const rejectPayrollEntry = async (id: string, rejectedBy: string, reason: string) => {
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

    // Create audit log (T3 internal - use default organization)
    if (entry[0]) {
      await tx.insert(payrollAuditLog).values({
        organizationId: T3_ORGANIZATION_ID, // T3 internal - default organization
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
  filters: PayrollRunsFilters
) => {
  let whereConditions = [
    eq(payrollRuns.isDeleted, false),
  ];

  if (filters.search) {
    whereConditions.push(
      or(
        ilike(payrollRuns.runNumber, `%${filters.search}%`),
        ilike(payrollRuns.runType, `%${filters.search}%`)
      )!
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
      createdAt: payrollRuns.createdAt,
      updatedAt: payrollRuns.updatedAt,
    })
    .from(payrollRuns)
    .leftJoin(payPeriods, eq(payrollRuns.payPeriodId, payPeriods.id))
    .where(and(...whereConditions))
    .orderBy(desc(payrollRuns.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    data,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getPayrollRunById = async (id: string) => {
  const result = await db
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
      createdAt: payrollRuns.createdAt,
      updatedAt: payrollRuns.updatedAt,
    })
    .from(payrollRuns)
    .leftJoin(payPeriods, eq(payrollRuns.payPeriodId, payPeriods.id))
    .where(eq(payrollRuns.id, id))
    .limit(1);

  return result[0] || null;
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
        eq(payrollRuns.isDeleted, false)
      )
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
        organizationId: T3_ORGANIZATION_ID, // T3 internal - default organization
        runNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create audit log (T3 internal - use default organization)
    await tx.insert(payrollAuditLog).values({
      organizationId: T3_ORGANIZATION_ID, // T3 internal - default organization
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
        processedDate: new Date().toISOString().split('T')[0],
        processedBy: processedBy,
        updatedAt: new Date(),
      })
      .where(eq(payrollEntries.payrollRunId, id));

    // Create audit log (T3 internal - use default organization)
    if (run[0]) {
      await tx.insert(payrollAuditLog).values({
        organizationId: T3_ORGANIZATION_ID, // T3 internal - default organization
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
  const doubleOvertimeMultiplier = parseFloat(data.doubleOvertimeMultiplier) || 2.0;
  const holidayMultiplier = parseFloat(data.holidayMultiplier) || 1.5;

  const regularPay = regularHours * hourlyRate;
  const overtimePay = overtimeHours * hourlyRate * overtimeMultiplier;
  const doubleOvertimePay = doubleOvertimeHours * hourlyRate * doubleOvertimeMultiplier;
  const ptoPay = ptoHours * hourlyRate;
  const sickPay = sickHours * hourlyRate;
  const holidayPay = holidayHours * hourlyRate * holidayMultiplier;

  const grossPay = regularPay + overtimePay + doubleOvertimePay + ptoPay + sickPay + holidayPay + bonuses;
  const totalHours = regularHours + overtimeHours + doubleOvertimeHours + ptoHours + sickHours + holidayHours;
  
  // Note: totalDeductions would be calculated from deductions in a separate process
  const totalDeductions = parseFloat(data.totalDeductions) || 0;
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
    .where(
      gte(payrollEntries.createdAt, new Date(currentYear, 0, 1))
    );

  const sequence = (countResult[0]?.count || 0) + 1;
  return `PAY-${currentYear}-W${currentWeek.toString().padStart(2, '0')}-${sequence.toString().padStart(3, '0')}`;
};

const generatePayrollRunNumber = async (): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const currentWeek = getWeekNumber(new Date());
  
  // Get count of runs this week (T3 internal - no organizationId filter)
  const countResult = await db
    .select({ count: count() })
    .from(payrollRuns)
    .where(
      gte(payrollRuns.createdAt, new Date(currentYear, 0, 1))
    );

  const sequence = (countResult[0]?.count || 0) + 1;
  return `RUN-${currentYear}-W${currentWeek.toString().padStart(2, '0')}-${sequence.toString().padStart(3, '0')}`;
};

const getWeekNumber = (date: Date): number => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};
