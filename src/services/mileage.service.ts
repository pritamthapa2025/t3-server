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
import { db } from "../config/db.js";
import {
  mileageLogs,
  expenses,
} from "../drizzle/schema/expenses.schema.js";
import {
  employees,
  organizations,
} from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";

// ============================
// Mileage Logs
// ============================

export const getMileageLogs = async (
  organizationId: string,
  offset: number,
  limit: number,
  filters?: {
    employeeId?: number;
    expenseId?: string;
    jobId?: string;
    bidId?: string;
    mileageType?: string;
    startDate?: string;
    endDate?: string;
    isVerified?: boolean;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    includeDeleted?: boolean;
  }
) => {
  let whereConditions = [eq(mileageLogs.organizationId, organizationId)];

  // Include deleted filter
  if (!filters?.includeDeleted) {
    whereConditions.push(eq(mileageLogs.isDeleted, false));
  }

  // Apply filters
  if (filters?.employeeId) {
    whereConditions.push(eq(mileageLogs.employeeId, filters.employeeId));
  }

  if (filters?.expenseId) {
    whereConditions.push(eq(mileageLogs.expenseId, filters.expenseId));
  }

  if (filters?.jobId) {
    whereConditions.push(eq(mileageLogs.jobId, filters.jobId));
  }

  if (filters?.bidId) {
    whereConditions.push(eq(mileageLogs.bidId, filters.bidId));
  }

  if (filters?.mileageType) {
    whereConditions.push(eq(mileageLogs.mileageType, filters.mileageType as any));
  }

  if (filters?.startDate) {
    whereConditions.push(gte(mileageLogs.date, filters.startDate));
  }

  if (filters?.endDate) {
    whereConditions.push(lte(mileageLogs.date, filters.endDate));
  }

  if (filters?.isVerified !== undefined) {
    whereConditions.push(eq(mileageLogs.isVerified, filters.isVerified));
  }

  if (filters?.search) {
    whereConditions.push(
      or(
        ilike(mileageLogs.purpose, `%${filters.search}%`),
        ilike(mileageLogs.startLocation, `%${filters.search}%`),
        ilike(mileageLogs.endLocation, `%${filters.search}%`)
      )!
    );
  }

  // Determine sort order
  const sortField = filters?.sortBy || "date";
  const sortDirection = filters?.sortOrder === "asc" ? asc : desc;
  let orderBy;

  switch (sortField) {
    case "miles":
      orderBy = sortDirection(mileageLogs.miles);
      break;
    case "amount":
      orderBy = sortDirection(mileageLogs.amount);
      break;
    case "createdAt":
      orderBy = sortDirection(mileageLogs.createdAt);
      break;
    default:
      orderBy = sortDirection(mileageLogs.date);
  }

  // Get mileage logs with related data
  const result = await db
    .select({
      // Mileage log data
      id: mileageLogs.id,
      organizationId: mileageLogs.organizationId,
      employeeId: mileageLogs.employeeId,
      expenseId: mileageLogs.expenseId,
      date: mileageLogs.date,
      startLocation: mileageLogs.startLocation,
      endLocation: mileageLogs.endLocation,
      purpose: mileageLogs.purpose,
      mileageType: mileageLogs.mileageType,
      miles: mileageLogs.miles,
      rate: mileageLogs.rate,
      amount: mileageLogs.amount,
      vehicleId: mileageLogs.vehicleId,
      vehicleLicense: mileageLogs.vehicleLicense,
      odometerStart: mileageLogs.odometerStart,
      odometerEnd: mileageLogs.odometerEnd,
      jobId: mileageLogs.jobId,
      bidId: mileageLogs.bidId,
      gpsStartCoordinates: mileageLogs.gpsStartCoordinates,
      gpsEndCoordinates: mileageLogs.gpsEndCoordinates,
      routeData: mileageLogs.routeData,
      isVerified: mileageLogs.isVerified,
      verifiedBy: mileageLogs.verifiedBy,
      verifiedAt: mileageLogs.verifiedAt,
      notes: mileageLogs.notes,
      createdAt: mileageLogs.createdAt,
      updatedAt: mileageLogs.updatedAt,
      // Employee data
      employeeFullName: users.fullName,
      employeeEmail: users.email,
      // Job data
      jobNumber: jobs.jobNumber,
      jobName: jobs.name,
      // Expense data
      expenseNumber: expenses.expenseNumber,
      expenseTitle: expenses.title,
    })
    .from(mileageLogs)
    .leftJoin(employees, eq(mileageLogs.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(jobs, eq(mileageLogs.jobId, jobs.id))
    .leftJoin(expenses, eq(mileageLogs.expenseId, expenses.id))
    .where(and(...whereConditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(mileageLogs)
    .where(and(...whereConditions));

  const total = totalResult[0]?.count || 0;

  // Add related data to results
  const logsWithRelatedData = result.map((log) => ({
    ...log,
    employee: log.employeeFullName
      ? {
          id: log.employeeId,
          fullName: log.employeeFullName,
          email: log.employeeEmail,
        }
      : undefined,
    job: log.jobNumber
      ? {
          id: log.jobId!,
          jobNumber: log.jobNumber,
          name: log.jobName,
        }
      : undefined,
    expense: log.expenseNumber
      ? {
          id: log.expenseId!,
          expenseNumber: log.expenseNumber,
          title: log.expenseTitle,
        }
      : undefined,
  }));

  return {
    data: logsWithRelatedData,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getMileageLogById = async (organizationId: string, id: string) => {
  const result = await db
    .select({
      // All mileage log fields
      id: mileageLogs.id,
      organizationId: mileageLogs.organizationId,
      employeeId: mileageLogs.employeeId,
      expenseId: mileageLogs.expenseId,
      date: mileageLogs.date,
      startLocation: mileageLogs.startLocation,
      endLocation: mileageLogs.endLocation,
      purpose: mileageLogs.purpose,
      mileageType: mileageLogs.mileageType,
      miles: mileageLogs.miles,
      rate: mileageLogs.rate,
      amount: mileageLogs.amount,
      vehicleId: mileageLogs.vehicleId,
      vehicleLicense: mileageLogs.vehicleLicense,
      odometerStart: mileageLogs.odometerStart,
      odometerEnd: mileageLogs.odometerEnd,
      jobId: mileageLogs.jobId,
      bidId: mileageLogs.bidId,
      gpsStartCoordinates: mileageLogs.gpsStartCoordinates,
      gpsEndCoordinates: mileageLogs.gpsEndCoordinates,
      routeData: mileageLogs.routeData,
      isVerified: mileageLogs.isVerified,
      verifiedBy: mileageLogs.verifiedBy,
      verifiedAt: mileageLogs.verifiedAt,
      notes: mileageLogs.notes,
      createdAt: mileageLogs.createdAt,
      updatedAt: mileageLogs.updatedAt,
      // Related data
      employeeFullName: users.fullName,
      employeeEmail: users.email,
      jobNumber: jobs.jobNumber,
      jobName: jobs.name,
      expenseNumber: expenses.expenseNumber,
      expenseTitle: expenses.title,
    })
    .from(mileageLogs)
    .leftJoin(employees, eq(mileageLogs.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(jobs, eq(mileageLogs.jobId, jobs.id))
    .leftJoin(expenses, eq(mileageLogs.expenseId, expenses.id))
    .where(
      and(
        eq(mileageLogs.id, id),
        eq(mileageLogs.organizationId, organizationId),
        eq(mileageLogs.isDeleted, false)
      )
    )
    .limit(1);

  if (!result[0]) {
    return null;
  }

  const log = result[0];
  return {
    ...log,
    employee: log.employeeFullName
      ? {
          id: log.employeeId,
          fullName: log.employeeFullName,
          email: log.employeeEmail,
        }
      : undefined,
    job: log.jobNumber
      ? {
          id: log.jobId!,
          jobNumber: log.jobNumber,
          name: log.jobName,
        }
      : undefined,
    expense: log.expenseNumber
      ? {
          id: log.expenseId!,
          expenseNumber: log.expenseNumber,
          title: log.expenseTitle,
        }
      : undefined,
  };
};

export const createMileageLog = async (
  organizationId: string,
  employeeId: number,
  logData: any
) => {
  // Calculate amount
  const miles = parseFloat(logData.miles);
  const rate = parseFloat(logData.rate);
  const amount = miles * rate;

  const newLog = await db
    .insert(mileageLogs)
    .values({
      organizationId,
      employeeId,
      ...logData,
      miles: miles.toString(),
      rate: rate.toString(),
      amount: amount.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return newLog[0];
};

export const updateMileageLog = async (
  organizationId: string,
  id: string,
  updateData: any
) => {
  // Recalculate amount if miles or rate changed
  if (updateData.miles || updateData.rate) {
    const currentLog = await getMileageLogById(organizationId, id);
    if (!currentLog) return null;

    const miles = parseFloat(updateData.miles || currentLog.miles);
    const rate = parseFloat(updateData.rate || currentLog.rate);
    updateData.amount = (miles * rate).toString();
  }

  const updated = await db
    .update(mileageLogs)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mileageLogs.id, id),
        eq(mileageLogs.organizationId, organizationId),
        eq(mileageLogs.isDeleted, false)
      )
    )
    .returning();

  return updated[0] || null;
};

export const deleteMileageLog = async (organizationId: string, id: string) => {
  const deleted = await db
    .update(mileageLogs)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mileageLogs.id, id),
        eq(mileageLogs.organizationId, organizationId)
      )
    )
    .returning();

  return deleted[0] || null;
};

export const verifyMileageLog = async (
  organizationId: string,
  id: string,
  verifiedBy: string
) => {
  const updated = await db
    .update(mileageLogs)
    .set({
      isVerified: true,
      verifiedBy,
      verifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mileageLogs.id, id),
        eq(mileageLogs.organizationId, organizationId),
        eq(mileageLogs.isDeleted, false)
      )
    )
    .returning();

  return updated[0] || null;
};

// ============================
// Mileage Analytics
// ============================

export const getMileageSummary = async (
  organizationId: string,
  filters?: {
    employeeId?: number;
    startDate?: string;
    endDate?: string;
    mileageType?: string;
  }
) => {
  let whereConditions = [
    eq(mileageLogs.organizationId, organizationId),
    eq(mileageLogs.isDeleted, false),
  ];

  // Apply filters
  if (filters?.employeeId) {
    whereConditions.push(eq(mileageLogs.employeeId, filters.employeeId));
  }

  if (filters?.startDate) {
    whereConditions.push(gte(mileageLogs.date, filters.startDate));
  }

  if (filters?.endDate) {
    whereConditions.push(lte(mileageLogs.date, filters.endDate));
  }

  if (filters?.mileageType) {
    whereConditions.push(eq(mileageLogs.mileageType, filters.mileageType as any));
  }

  const summaryResult = await db
    .select({
      totalLogs: count(),
      totalMiles: sql<string>`COALESCE(SUM(CAST(${mileageLogs.miles} AS DECIMAL)), 0)`,
      totalAmount: sql<string>`COALESCE(SUM(CAST(${mileageLogs.amount} AS DECIMAL)), 0)`,
      averageMiles: sql<string>`COALESCE(AVG(CAST(${mileageLogs.miles} AS DECIMAL)), 0)`,
      averageRate: sql<string>`COALESCE(AVG(CAST(${mileageLogs.rate} AS DECIMAL)), 0)`,
    })
    .from(mileageLogs)
    .where(and(...whereConditions));

  // Get breakdown by mileage type
  const typeBreakdown = await db
    .select({
      mileageType: mileageLogs.mileageType,
      count: count(),
      totalMiles: sql<string>`COALESCE(SUM(CAST(${mileageLogs.miles} AS DECIMAL)), 0)`,
      totalAmount: sql<string>`COALESCE(SUM(CAST(${mileageLogs.amount} AS DECIMAL)), 0)`,
    })
    .from(mileageLogs)
    .where(and(...whereConditions))
    .groupBy(mileageLogs.mileageType);

  // Get monthly breakdown
  const monthlyBreakdown = await db
    .select({
      month: sql<string>`TO_CHAR(${mileageLogs.date}, 'YYYY-MM')`,
      count: count(),
      totalMiles: sql<string>`COALESCE(SUM(CAST(${mileageLogs.miles} AS DECIMAL)), 0)`,
      totalAmount: sql<string>`COALESCE(SUM(CAST(${mileageLogs.amount} AS DECIMAL)), 0)`,
    })
    .from(mileageLogs)
    .where(and(...whereConditions))
    .groupBy(sql`TO_CHAR(${mileageLogs.date}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${mileageLogs.date}, 'YYYY-MM')`);

  return {
    summary: summaryResult[0] || {
      totalLogs: 0,
      totalMiles: "0",
      totalAmount: "0",
      averageMiles: "0",
      averageRate: "0",
    },
    byType: typeBreakdown,
    byMonth: monthlyBreakdown,
  };
};
