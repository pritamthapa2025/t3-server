import {
  count,
  eq,
  desc,
  and,
  or,
  gte,
  lte,
  ilike,
} from "drizzle-orm";
import { db } from "../config/db.js";
import {
  employeeCompensation,
  payPeriods,
  employeeBenefits,
  employeeLeaveBalances,
  payrollAuditLog,
} from "../drizzle/schema/payroll.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";

interface EmployeeCompensationFilters {
  search?: string | undefined;
  employeeId?: string | undefined;
  isActive?: boolean | undefined;
}

interface PayPeriodFilters {
  frequency?: string | undefined;
  year?: number | undefined;
  status?: string | undefined;
}

interface EmployeeBenefitFilters {
  employeeId?: number | undefined;
  benefitType?: string | undefined;
  isActive?: boolean | undefined;
}

// Employee Compensation Services
export const getEmployeeCompensations = async (
  offset: number,
  limit: number,
  filters: EmployeeCompensationFilters
) => {
  let whereConditions = [eq(employeeCompensation.isDeleted, false)];

  // Add search filter
  if (filters.search) {
    whereConditions.push(
      or(
        ilike(users.fullName, `%${filters.search}%`),
        ilike(employees.employeeId, `%${filters.search}%`)
      )!
    );
  }

  // Add filters
  if (filters.employeeId) {
    whereConditions.push(eq(employeeCompensation.employeeId, parseInt(filters.employeeId)));
  }

  if (filters.isActive !== undefined) {
    whereConditions.push(eq(employeeCompensation.isActive, filters.isActive));
  }

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(employeeCompensation)
    .leftJoin(employees, eq(employeeCompensation.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(...whereConditions));

  const total = totalResult[0]?.count || 0;

  // Get paginated data
  const data = await db
    .select({
      // Compensation Data
      id: employeeCompensation.id,
      baseSalary: employeeCompensation.baseSalary,
      hourlyRate: employeeCompensation.hourlyRate,
      payType: employeeCompensation.payType,
      payFrequency: employeeCompensation.payFrequency,

      // Overtime Rules
      overtimeMultiplier: employeeCompensation.overtimeMultiplier,
      doubleOvertimeMultiplier: employeeCompensation.doubleOvertimeMultiplier,
      overtimeThresholdDaily: employeeCompensation.overtimeThresholdDaily,
      overtimeThresholdWeekly: employeeCompensation.overtimeThresholdWeekly,

      // Holiday & PTO Rules
      holidayMultiplier: employeeCompensation.holidayMultiplier,
      ptoAccrualRate: employeeCompensation.ptoAccrualRate,
      sickAccrualRate: employeeCompensation.sickAccrualRate,

      // Effective Dates
      effectiveDate: employeeCompensation.effectiveDate,
      endDate: employeeCompensation.endDate,
      isActive: employeeCompensation.isActive,

      // Employee Data
      employeeId: employees.id,
      employeeNumber: employees.employeeId,
      employeeName: users.fullName,

      // Audit Fields
      notes: employeeCompensation.notes,
      createdAt: employeeCompensation.createdAt,
      updatedAt: employeeCompensation.updatedAt,
    })
    .from(employeeCompensation)
    .leftJoin(employees, eq(employeeCompensation.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(...whereConditions))
    .orderBy(desc(employeeCompensation.effectiveDate))
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

export const getEmployeeCompensationById = async (id: string) => {
  const result = await db
    .select({
      // Compensation Data
      id: employeeCompensation.id,
      baseSalary: employeeCompensation.baseSalary,
      hourlyRate: employeeCompensation.hourlyRate,
      payType: employeeCompensation.payType,
      payFrequency: employeeCompensation.payFrequency,

      // Overtime Rules
      overtimeMultiplier: employeeCompensation.overtimeMultiplier,
      doubleOvertimeMultiplier: employeeCompensation.doubleOvertimeMultiplier,
      overtimeThresholdDaily: employeeCompensation.overtimeThresholdDaily,
      overtimeThresholdWeekly: employeeCompensation.overtimeThresholdWeekly,

      // Holiday & PTO Rules
      holidayMultiplier: employeeCompensation.holidayMultiplier,
      ptoAccrualRate: employeeCompensation.ptoAccrualRate,
      sickAccrualRate: employeeCompensation.sickAccrualRate,

      // Effective Dates
      effectiveDate: employeeCompensation.effectiveDate,
      endDate: employeeCompensation.endDate,
      isActive: employeeCompensation.isActive,

      // Employee Data
      employeeId: employees.id,
      employeeNumber: employees.employeeId,
      employeeName: users.fullName,

      // Audit Fields
      notes: employeeCompensation.notes,
      createdAt: employeeCompensation.createdAt,
      updatedAt: employeeCompensation.updatedAt,
    })
    .from(employeeCompensation)
    .leftJoin(employees, eq(employeeCompensation.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(eq(employeeCompensation.id, id))
    .limit(1);

  return result[0] || null;
};

export const createEmployeeCompensation = async (data: any) => {
  // Check for existing active compensation
  const existingActive = await db
    .select({ id: employeeCompensation.id })
    .from(employeeCompensation)
    .where(
      and(
        eq(employeeCompensation.employeeId, data.employeeId),
        eq(employeeCompensation.isActive, true),
        eq(employeeCompensation.isDeleted, false)
      )
    )
    .limit(1);

  if (existingActive.length > 0) {
    const error = new Error("Active compensation already exists") as any;
    error.code = "DUPLICATE_ACTIVE_COMPENSATION";
    throw error;
  }

  const { organizationId: _omitOrg, ...compensationData } = data;
  const result = await db.transaction(async (tx) => {
    // Create new compensation
    const [newCompensation] = await tx
      .insert(employeeCompensation)
      .values({
        ...compensationData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create audit log
    await tx.insert(payrollAuditLog).values({
      referenceType: "employee_compensation",
      referenceId: newCompensation!.id,
      action: "created",
      description: "Employee compensation created",
      performedBy: data.createdBy,
      isAutomatedAction: false,
      createdAt: new Date(),
    });

    return newCompensation;
  });

  return result;
};

export const updateEmployeeCompensation = async (id: string, data: any) => {
  // Get old values for audit
  const oldValues = await getEmployeeCompensationById(id);
  
  if (!oldValues) {
    return null;
  }

  const { organizationId: _omitOrg, ...updateData } = data || {};
  const result = await db.transaction(async (tx) => {
    // Update compensation
    const [updatedCompensation] = await tx
      .update(employeeCompensation)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(employeeCompensation.id, id))
      .returning();

    // Create audit log
    await tx.insert(payrollAuditLog).values({
      referenceType: "employee_compensation",
      referenceId: id,
      action: "updated",
      description: "Employee compensation updated",
      oldValues: oldValues,
      newValues: updatedCompensation,
      performedBy: data.updatedBy || data.createdBy,
      isAutomatedAction: false,
      createdAt: new Date(),
    });

    return updatedCompensation;
  });

  return result;
};

export const deleteEmployeeCompensation = async (id: string) => {
  const compensation = await db
    .select({ id: employeeCompensation.id })
    .from(employeeCompensation)
    .where(eq(employeeCompensation.id, id))
    .limit(1);

  if (!compensation[0]) {
    return null;
  }

  const result = await db.transaction(async (tx) => {
    // Soft delete compensation
    const [deletedCompensation] = await tx
      .update(employeeCompensation)
      .set({
        isDeleted: true,
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(employeeCompensation.id, id))
      .returning();

    // Create audit log
    if (compensation[0]) {
      await tx.insert(payrollAuditLog).values({
        referenceType: "employee_compensation",
      referenceId: id,
      action: "deleted",
      description: "Employee compensation deleted",
      performedBy: "system", // Would need to pass user ID
      isAutomatedAction: false,
        createdAt: new Date(),
      });
    }

    return deletedCompensation;
  });

  return result;
};

export const getEmployeeCompensationHistory = async (
  employeeId: number,
  offset: number,
  limit: number
) => {
  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(employeeCompensation)
    .where(
      and(
        eq(employeeCompensation.employeeId, employeeId),
        eq(employeeCompensation.isDeleted, false)
      )
    );

  const total = totalResult[0]?.count || 0;

  // Get history data
  const data = await db
    .select({
      id: employeeCompensation.id,
      baseSalary: employeeCompensation.baseSalary,
      hourlyRate: employeeCompensation.hourlyRate,
      payType: employeeCompensation.payType,
      payFrequency: employeeCompensation.payFrequency,
      effectiveDate: employeeCompensation.effectiveDate,
      endDate: employeeCompensation.endDate,
      isActive: employeeCompensation.isActive,
      notes: employeeCompensation.notes,
      createdAt: employeeCompensation.createdAt,
      updatedAt: employeeCompensation.updatedAt,
    })
    .from(employeeCompensation)
    .where(
      and(
        eq(employeeCompensation.employeeId, employeeId),
        eq(employeeCompensation.isDeleted, false)
      )
    )
    .orderBy(desc(employeeCompensation.effectiveDate))
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

// Pay Periods Services
export const getPayPeriods = async (
  offset: number,
  limit: number,
  filters: PayPeriodFilters
) => {
  let whereConditions = [eq(payPeriods.isDeleted, false)];

  // Add filters
  if (filters.frequency) {
    whereConditions.push(eq(payPeriods.frequency, filters.frequency as any));
  }

  if (filters.year !== undefined) {
    const yearStart = `${filters.year}-01-01`;
    const yearEnd = `${filters.year + 1}-01-01`;
    whereConditions.push(
      gte(payPeriods.startDate, yearStart),
      lte(payPeriods.startDate, yearEnd)
    );
  }

  if (filters.status) {
    whereConditions.push(eq(payPeriods.status, filters.status as any));
  }

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(payPeriods)
    .where(and(...whereConditions));

  const total = totalResult[0]?.count || 0;

  // Get data
  const data = await db
    .select({
      id: payPeriods.id,
      periodNumber: payPeriods.periodNumber,
      frequency: payPeriods.frequency,
      startDate: payPeriods.startDate,
      endDate: payPeriods.endDate,
      payDate: payPeriods.payDate,
      status: payPeriods.status,
      isHolidayPeriod: payPeriods.isHolidayPeriod,
      timesheetCutoffDate: payPeriods.timesheetCutoffDate,
      approvalDeadline: payPeriods.approvalDeadline,
      approvalWorkflow: payPeriods.approvalWorkflow,
      lockStatus: payPeriods.lockStatus,
      lockedAt: payPeriods.lockedAt,
      timesheetCutoffEnforced: payPeriods.timesheetCutoffEnforced,
      autoGenerateFromTimesheets: payPeriods.autoGenerateFromTimesheets,
      notes: payPeriods.notes,
      createdAt: payPeriods.createdAt,
      updatedAt: payPeriods.updatedAt,
    })
    .from(payPeriods)
    .where(and(...whereConditions))
    .orderBy(desc(payPeriods.startDate))
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

export const getPayPeriodById = async (id: string) => {
  const result = await db
    .select({
      id: payPeriods.id,
      periodNumber: payPeriods.periodNumber,
      frequency: payPeriods.frequency,
      startDate: payPeriods.startDate,
      endDate: payPeriods.endDate,
      payDate: payPeriods.payDate,
      status: payPeriods.status,
      isHolidayPeriod: payPeriods.isHolidayPeriod,
      timesheetCutoffDate: payPeriods.timesheetCutoffDate,
      approvalDeadline: payPeriods.approvalDeadline,
      approvalWorkflow: payPeriods.approvalWorkflow,
      lockStatus: payPeriods.lockStatus,
      lockedAt: payPeriods.lockedAt,
      timesheetCutoffEnforced: payPeriods.timesheetCutoffEnforced,
      autoGenerateFromTimesheets: payPeriods.autoGenerateFromTimesheets,
      notes: payPeriods.notes,
      createdAt: payPeriods.createdAt,
      updatedAt: payPeriods.updatedAt,
    })
    .from(payPeriods)
    .where(eq(payPeriods.id, id))
    .limit(1);

  return result[0] || null;
};

export const createPayPeriod = async (data: any) => {
  // Check for duplicate periods
  const existingPeriod = await db
    .select({ id: payPeriods.id })
    .from(payPeriods)
    .where(
      and(
        eq(payPeriods.frequency, data.frequency),
        eq(payPeriods.startDate, data.startDate),
        eq(payPeriods.endDate, data.endDate),
        eq(payPeriods.isDeleted, false)
      )
    )
    .limit(1);

  if (existingPeriod.length > 0) {
    const error = new Error("Pay period already exists") as any;
    error.code = "DUPLICATE_PAY_PERIOD";
    throw error;
  }

  const { organizationId: _omitOrg, ...periodData } = data;
  const result = await db.transaction(async (tx) => {
    // Create pay period
    const [newPeriod] = await tx
      .insert(payPeriods)
      .values({
        ...periodData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create audit log
    await tx.insert(payrollAuditLog).values({
      referenceType: "pay_period",
      referenceId: newPeriod!.id,
      action: "created",
      description: "Pay period created",
      performedBy: data.createdBy,
      isAutomatedAction: false,
      createdAt: new Date(),
    });

    return newPeriod;
  });

  return result;
};

export const updatePayPeriod = async (id: string, data: any) => {
  // Check if period is locked
  const period = await db
    .select({ lockStatus: payPeriods.lockStatus })
    .from(payPeriods)
    .where(eq(payPeriods.id, id))
    .limit(1);

  if (!period[0]) {
    return null;
  }

  if (period[0].lockStatus !== "unlocked") {
    const error = new Error("Period is locked") as any;
    error.code = "PERIOD_LOCKED";
    throw error;
  }

  // Get old values for audit
  const oldValues = await getPayPeriodById(id);

  const { organizationId: _omitOrg, ...updateData } = data || {};
  const result = await db.transaction(async (tx) => {
    // Update pay period
    const [updatedPeriod] = await tx
      .update(payPeriods)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(payPeriods.id, id))
      .returning();

    // Create audit log
    if (period[0]) {
      await tx.insert(payrollAuditLog).values({
        referenceType: "pay_period",
        referenceId: id,
        action: "updated",
      description: "Pay period updated",
      oldValues: oldValues,
      newValues: updatedPeriod,
      performedBy: data.updatedBy || "system",
        isAutomatedAction: false,
        createdAt: new Date(),
      });
    }

    return updatedPeriod;
  });

  return result;
};

export const deletePayPeriod = async (id: string) => {
  // Check for existing payroll entries
  // This would require importing payrollRuns and checking
  // For now, we'll just do a basic check

  const period = await db
    .select({ id: payPeriods.id })
    .from(payPeriods)
    .where(eq(payPeriods.id, id))
    .limit(1);

  if (!period[0]) {
    return null;
  }

  // TODO: Add check for existing payroll runs
  // const existingRuns = await db.select...

  const result = await db.transaction(async (tx) => {
    // Soft delete pay period
    const [deletedPeriod] = await tx
      .update(payPeriods)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(payPeriods.id, id))
      .returning();

    // Create audit log
    if (period[0]) {
      await tx.insert(payrollAuditLog).values({
        referenceType: "pay_period",
        referenceId: id,
        action: "deleted",
      description: "Pay period deleted",
      performedBy: "system",
        isAutomatedAction: false,
        createdAt: new Date(),
      });
    }

    return deletedPeriod;
  });

  return result;
};

// Employee Leave Balances Services
export const getEmployeeLeaveBalances = async (employeeId: number) => {
  const data = await db
    .select({
      id: employeeLeaveBalances.id,
      leaveType: employeeLeaveBalances.leaveType,
      currentBalance: employeeLeaveBalances.currentBalance,
      accrualRate: employeeLeaveBalances.accrualRate,
      maxBalance: employeeLeaveBalances.maxBalance,
      ytdAccrued: employeeLeaveBalances.ytdAccrued,
      ytdUsed: employeeLeaveBalances.ytdUsed,
      balanceAsOfDate: employeeLeaveBalances.balanceAsOfDate,
      lastAccrualDate: employeeLeaveBalances.lastAccrualDate,
      updatedAt: employeeLeaveBalances.updatedAt,
    })
    .from(employeeLeaveBalances)
    .where(
      and(
        eq(employeeLeaveBalances.employeeId, employeeId),
        eq(employeeLeaveBalances.isDeleted, false)
      )
    )
    .orderBy(employeeLeaveBalances.leaveType);

  return data;
};

export const updateEmployeeLeaveBalance = async (id: string, data: any) => {
  const result = await db
    .update(employeeLeaveBalances)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(employeeLeaveBalances.id, id))
    .returning();

  return result[0] || null;
};

// Employee Benefits Services
export const getEmployeeBenefits = async (
  offset: number,
  limit: number,
  filters: EmployeeBenefitFilters
) => {
  let whereConditions = [eq(employeeBenefits.isDeleted, false)];

  // Add filters
  if (filters.employeeId) {
    whereConditions.push(eq(employeeBenefits.employeeId, filters.employeeId));
  }

  if (filters.benefitType) {
    whereConditions.push(eq(employeeBenefits.benefitType, filters.benefitType as any));
  }

  if (filters.isActive !== undefined) {
    whereConditions.push(eq(employeeBenefits.isActive, filters.isActive));
  }

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(employeeBenefits)
    .leftJoin(employees, eq(employeeBenefits.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(...whereConditions));

  const total = totalResult[0]?.count || 0;

  // Get data
  const data = await db
    .select({
      id: employeeBenefits.id,
      benefitType: employeeBenefits.benefitType,
      planName: employeeBenefits.planName,
      description: employeeBenefits.description,
      employeeContribution: employeeBenefits.employeeContribution,
      employerContribution: employeeBenefits.employerContribution,
      isPercentage: employeeBenefits.isPercentage,
      coverageLevel: employeeBenefits.coverageLevel,
      effectiveDate: employeeBenefits.effectiveDate,
      endDate: employeeBenefits.endDate,
      isActive: employeeBenefits.isActive,
      employeeId: employees.id,
      employeeName: users.fullName,
      createdAt: employeeBenefits.createdAt,
      updatedAt: employeeBenefits.updatedAt,
    })
    .from(employeeBenefits)
    .leftJoin(employees, eq(employeeBenefits.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(...whereConditions))
    .orderBy(desc(employeeBenefits.effectiveDate))
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

export const createEmployeeBenefit = async (data: any) => {
  const { organizationId: _omitOrg, ...benefitData } = data || {};
  // Check for duplicate benefits
  const existingBenefit = await db
    .select({ id: employeeBenefits.id })
    .from(employeeBenefits)
    .where(
      and(
        eq(employeeBenefits.employeeId, data.employeeId),
        eq(employeeBenefits.benefitType, data.benefitType),
        eq(employeeBenefits.isActive, true),
        eq(employeeBenefits.isDeleted, false)
      )
    )
    .limit(1);

  if (existingBenefit.length > 0) {
    const error = new Error("Benefit already exists") as any;
    error.code = "DUPLICATE_BENEFIT";
    throw error;
  }

  const result = await db
    .insert(employeeBenefits)
    .values({
      ...benefitData,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result[0];
};

export const updateEmployeeBenefit = async (id: string, data: any) => {
  const { organizationId: _omitOrg, ...updateData } = data || {};
  const result = await db
    .update(employeeBenefits)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(eq(employeeBenefits.id, id))
    .returning();

  return result[0] || null;
};

export const deleteEmployeeBenefit = async (id: string) => {
  const result = await db
    .update(employeeBenefits)
    .set({
      isDeleted: true,
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(employeeBenefits.id, id))
    .returning();

  return result[0] || null;
};
