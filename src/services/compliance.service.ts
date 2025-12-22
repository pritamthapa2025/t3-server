import { db } from "../config/db.js";
import {
  employeeComplianceCases,
  employeeViolationHistory,
} from "../drizzle/schema/compliance.schema.js";
import { employees, organizations } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import {
  eq,
  and,
  desc,
  asc,
  count,
  sql,
  isNull,
  isNotNull,
  gte,
  lte,
  like,
  or,
} from "drizzle-orm";
import type {
  ComplianceCase,
  CreateComplianceCaseData,
  UpdateComplianceCaseData,
  DashboardKPIs,
  ViolationWatchlistItem,
  ViolationCounts,
} from "../types/compliance.types.js";

// Dashboard KPIs Service
export const getDashboardKPIs = async (filters: {
  organizationId?: string;
  jobId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<DashboardKPIs> => {
  const { organizationId, jobId, dateFrom, dateTo } = filters;

  // Base query conditions
  const conditions = [
    eq(employeeComplianceCases.isDeleted, false),
    ...(organizationId
      ? [eq(employeeComplianceCases.organizationId, organizationId)]
      : []),
    ...(jobId ? [eq(employeeComplianceCases.jobId, jobId)] : []),
    ...(dateFrom
      ? [gte(employeeComplianceCases.createdAt, new Date(dateFrom))]
      : []),
    ...(dateTo
      ? [lte(employeeComplianceCases.createdAt, new Date(dateTo))]
      : []),
  ];

  // Active Cases
  const activeCasesResult = await db
    .select({ count: count() })
    .from(employeeComplianceCases)
    .where(
      and(
        ...conditions,
        or(
          eq(employeeComplianceCases.status, "open"),
          eq(employeeComplianceCases.status, "investigating")
        )
      )
    );

  // High Severity Cases
  const highSeverityResult = await db
    .select({ count: count() })
    .from(employeeComplianceCases)
    .where(
      and(
        ...conditions,
        or(
          eq(employeeComplianceCases.severity, "high"),
          eq(employeeComplianceCases.severity, "critical")
        )
      )
    );

  // Suspended Staff (employees with critical violations)
  const suspendedStaffResult = await db
    .select({ count: count() })
    .from(employeeViolationHistory)
    .innerJoin(employees, eq(employeeViolationHistory.employeeId, employees.id))
    .where(
      and(
        eq(employeeViolationHistory.isDeleted, false),
        eq(employeeViolationHistory.severity, "critical"),
        eq(employeeViolationHistory.isResolved, false),
        ...(organizationId
          ? [eq(employeeViolationHistory.organizationId, organizationId)]
          : [])
      )
    );

  // Average Resolution Time (in days)
  const avgResolutionResult = await db
    .select({
      avgDays: sql<number>`AVG(EXTRACT(DAY FROM (resolved_date - opened_on)))`,
    })
    .from(employeeComplianceCases)
    .where(
      and(
        ...conditions,
        eq(employeeComplianceCases.status, "resolved"),
        isNotNull(employeeComplianceCases.resolvedDate)
      )
    );

  return {
    activeCases: activeCasesResult[0]?.count || 0,
    highSeverity: highSeverityResult[0]?.count || 0,
    suspendedStaff: suspendedStaffResult[0]?.count || 0,
    avgResolutionDays: Math.round(avgResolutionResult[0]?.avgDays || 0),
  };
};

// Get Compliance Cases with Pagination
export const getComplianceCases = async (
  offset: number,
  limit: number,
  filters: {
    search?: string;
    organizationId: string;
    jobId?: string;
    employeeId?: number;
    type?: string;
    severity?: string;
    status?: string;
    assignedTo?: string;
    dueFrom?: string;
    dueTo?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }
) => {
  const {
    search,
    organizationId,
    jobId,
    employeeId,
    type,
    severity,
    status,
    assignedTo,
    dueFrom,
    dueTo,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  // Build conditions
  const conditions = [
    eq(employeeComplianceCases.isDeleted, false),
    eq(employeeComplianceCases.organizationId, organizationId),
    ...(jobId ? [eq(employeeComplianceCases.jobId, jobId)] : []),
    ...(employeeId ? [eq(employeeComplianceCases.employeeId, employeeId)] : []),
    ...(type ? [eq(employeeComplianceCases.type, type as any)] : []),
    ...(severity
      ? [eq(employeeComplianceCases.severity, severity as any)]
      : []),
    ...(status ? [eq(employeeComplianceCases.status, status as any)] : []),
    ...(assignedTo ? [eq(employeeComplianceCases.assignedTo, assignedTo)] : []),
    ...(dueFrom
      ? [gte(employeeComplianceCases.dueDate, dueFrom)]
      : []),
    ...(dueTo ? [lte(employeeComplianceCases.dueDate, dueTo)] : []),
  ];

  // Add search conditions
  if (search) {
    conditions.push(
      or(
        like(employeeComplianceCases.caseNumber, `%${search}%`),
        like(employeeComplianceCases.title, `%${search}%`),
        like(employeeComplianceCases.description, `%${search}%`)
      )!
    );
  }

  // Build sort order
  let orderBy: any;
  if (sortBy === "createdAt") {
    orderBy = sortOrder === "asc" ? asc(employeeComplianceCases.createdAt) : desc(employeeComplianceCases.createdAt);
  } else if (sortBy === "dueDate") {
    orderBy = sortOrder === "asc" ? asc(employeeComplianceCases.dueDate) : desc(employeeComplianceCases.dueDate);
  } else if (sortBy === "severity") {
    orderBy = sortOrder === "asc" ? asc(employeeComplianceCases.severity) : desc(employeeComplianceCases.severity);
  } else if (sortBy === "status") {
    orderBy = sortOrder === "asc" ? asc(employeeComplianceCases.status) : desc(employeeComplianceCases.status);
  } else {
    orderBy = desc(employeeComplianceCases.createdAt);
  }

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(employeeComplianceCases)
    .leftJoin(employees, eq(employeeComplianceCases.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(...conditions));

  const total = totalResult[0]?.count || 0;

  // Get paginated results with joins
  const cases = await db
    .select({
      id: employeeComplianceCases.id,
      caseNumber: employeeComplianceCases.caseNumber,
      type: employeeComplianceCases.type,
      severity: employeeComplianceCases.severity,
      status: employeeComplianceCases.status,
      title: employeeComplianceCases.title,
      description: employeeComplianceCases.description,
      notes: employeeComplianceCases.notes,
      openedOn: employeeComplianceCases.openedOn,
      dueDate: employeeComplianceCases.dueDate,
      resolvedDate: employeeComplianceCases.resolvedDate,
      impactLevel: employeeComplianceCases.impactLevel,
      correctiveAction: employeeComplianceCases.correctiveAction,
      preventiveAction: employeeComplianceCases.preventiveAction,
      attachments: employeeComplianceCases.attachments,
      evidencePhotos: employeeComplianceCases.evidencePhotos,
      createdAt: employeeComplianceCases.createdAt,
      updatedAt: employeeComplianceCases.updatedAt,
      // Employee info
      employeeId: employees.id,
      employeeName: users.fullName,
      employeeEmail: users.email,
      // Assignment info
      assignedTo: employeeComplianceCases.assignedTo,
      reportedBy: employeeComplianceCases.reportedBy,
      resolvedBy: employeeComplianceCases.resolvedBy,
    })
    .from(employeeComplianceCases)
    .leftJoin(employees, eq(employeeComplianceCases.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data: cases,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get Compliance Case by ID
export const getComplianceCaseById = async (id: string) => {
  const caseResult = await db
    .select({
      id: employeeComplianceCases.id,
      organizationId: employeeComplianceCases.organizationId,
      jobId: employeeComplianceCases.jobId,
      employeeId: employeeComplianceCases.employeeId,
      caseNumber: employeeComplianceCases.caseNumber,
      type: employeeComplianceCases.type,
      severity: employeeComplianceCases.severity,
      status: employeeComplianceCases.status,
      title: employeeComplianceCases.title,
      description: employeeComplianceCases.description,
      notes: employeeComplianceCases.notes,
      openedOn: employeeComplianceCases.openedOn,
      dueDate: employeeComplianceCases.dueDate,
      resolvedDate: employeeComplianceCases.resolvedDate,
      reportedBy: employeeComplianceCases.reportedBy,
      assignedTo: employeeComplianceCases.assignedTo,
      resolvedBy: employeeComplianceCases.resolvedBy,
      impactLevel: employeeComplianceCases.impactLevel,
      correctiveAction: employeeComplianceCases.correctiveAction,
      preventiveAction: employeeComplianceCases.preventiveAction,
      attachments: employeeComplianceCases.attachments,
      evidencePhotos: employeeComplianceCases.evidencePhotos,
      isDeleted: employeeComplianceCases.isDeleted,
      createdAt: employeeComplianceCases.createdAt,
      updatedAt: employeeComplianceCases.updatedAt,
      // Employee info
      employeeName: users.fullName,
      employeeEmail: users.email,
    })
    .from(employeeComplianceCases)
    .leftJoin(employees, eq(employeeComplianceCases.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(
      and(
        eq(employeeComplianceCases.id, id),
        eq(employeeComplianceCases.isDeleted, false)
      )
    );

  return caseResult[0] || null;
};

// Create Compliance Case
export const createComplianceCase = async (data: CreateComplianceCaseData) => {
  const insertData: any = {
    organizationId: data.organizationId,
    employeeId: data.employeeId,
    caseNumber: data.caseNumber,
    type: data.type,
    severity: data.severity,
    status: data.status || "open",
    title: data.title,
    description: data.description,
    openedOn: data.openedOn instanceof Date ? data.openedOn.toISOString().split('T')[0] : data.openedOn,
  };

  if (data.jobId) insertData.jobId = data.jobId;
  if (data.notes) insertData.notes = data.notes;
  if (data.dueDate) insertData.dueDate = data.dueDate instanceof Date ? data.dueDate.toISOString().split('T')[0] : data.dueDate;
  if (data.reportedBy) insertData.reportedBy = data.reportedBy;
  if (data.assignedTo) insertData.assignedTo = data.assignedTo;
  if (data.impactLevel) insertData.impactLevel = data.impactLevel;
  if (data.correctiveAction) insertData.correctiveAction = data.correctiveAction;
  if (data.preventiveAction) insertData.preventiveAction = data.preventiveAction;
  if (data.attachments) insertData.attachments = data.attachments;
  if (data.evidencePhotos) insertData.evidencePhotos = data.evidencePhotos;

  const result = await db
    .insert(employeeComplianceCases)
    .values(insertData)
    .returning();

  return result[0];
};

// Update Compliance Case
export const updateComplianceCase = async (
  id: string,
  data: UpdateComplianceCaseData
) => {
  const result = await db
    .update(employeeComplianceCases)
    .set({
      ...data,
      dueDate: data.dueDate instanceof Date ? data.dueDate.toISOString().split('T')[0] : data.dueDate,
      resolvedDate: data.resolvedDate instanceof Date ? data.resolvedDate.toISOString().split('T')[0] : data.resolvedDate,
    })
    .where(
      and(
        eq(employeeComplianceCases.id, id),
        eq(employeeComplianceCases.isDeleted, false)
      )
    )
    .returning();

  return result[0] || null;
};

// Soft Delete Compliance Case
export const deleteComplianceCase = async (id: string) => {
  const result = await db
    .update(employeeComplianceCases)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(employeeComplianceCases.id, id),
        eq(employeeComplianceCases.isDeleted, false)
      )
    )
    .returning();

  return result[0] || null;
};

// Update Case Status
export const updateCaseStatus = async (
  id: string,
  status: string,
  notes?: string,
  resolvedBy?: string,
  resolvedDate?: Date
) => {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };

  if (notes) updateData.notes = notes;
  if (resolvedBy) updateData.resolvedBy = resolvedBy;
  if (resolvedDate) updateData.resolvedDate = resolvedDate instanceof Date ? resolvedDate.toISOString().split('T')[0] : resolvedDate;

  const result = await db
    .update(employeeComplianceCases)
    .set(updateData)
    .where(
      and(
        eq(employeeComplianceCases.id, id),
        eq(employeeComplianceCases.isDeleted, false)
      )
    )
    .returning();

  return result[0] || null;
};

// Get Violation Watchlist
export const getViolationWatchlist = async (
  offset: number,
  limit: number,
  filters: {
    organizationId: string;
    minViolations?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }
): Promise<{
  data: ViolationWatchlistItem[];
  total: number;
  pagination: any;
}> => {
  const {
    organizationId,
    minViolations = 3,
    sortBy = "violationCount",
    sortOrder = "desc",
  } = filters;

  // Get employees with violation counts
  const watchlistQuery = db
    .select({
      employeeId: employees.id,
      employeeName: users.fullName,
      employeeEmail: users.email,
      department: sql<string>`departments.name`,
      violationCount: count(employeeViolationHistory.id),
      status: employees.status,
      lastViolationDate: sql<Date>`MAX(${employeeViolationHistory.violationDate})`,
    })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(sql`departments`, sql`departments.id = employees.department_id`)
    .leftJoin(
      employeeViolationHistory,
      and(
        eq(employeeViolationHistory.employeeId, employees.id),
        eq(employeeViolationHistory.organizationId, organizationId),
        eq(employeeViolationHistory.isDeleted, false)
      )
    )
    .where(eq(employees.isDeleted, false))
    .groupBy(employees.id, users.id, sql`departments.name`)
    .having(sql`COUNT(${employeeViolationHistory.id}) >= ${minViolations}`);

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(watchlistQuery.as("watchlist"));

  const total = totalResult[0]?.count || 0;

  // Get paginated results
  const orderColumn =
    sortBy === "employeeName"
      ? users.fullName
      : sortBy === "department"
      ? sql`departments.name`
      : count(employeeViolationHistory.id);

  const orderBy = sortOrder === "asc" ? asc(orderColumn) : desc(orderColumn);

  const data = await watchlistQuery
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data: data as ViolationWatchlistItem[],
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get Violation Counts
export const getViolationCounts = async (filters: {
  organizationId: string;
  jobId?: string;
  employeeId?: number;
  dateFrom?: string;
  dateTo?: string;
  groupBy?: string;
}): Promise<ViolationCounts[]> => {
  const {
    organizationId,
    jobId,
    employeeId,
    dateFrom,
    dateTo,
    groupBy = "type",
  } = filters;

  // Base conditions
  const conditions = [
    eq(employeeViolationHistory.isDeleted, false),
    eq(employeeViolationHistory.organizationId, organizationId),
    ...(jobId ? [eq(employeeComplianceCases.jobId, jobId)] : []),
    ...(employeeId
      ? [eq(employeeViolationHistory.employeeId, employeeId)]
      : []),
    ...(dateFrom
      ? [gte(employeeViolationHistory.violationDate, dateFrom)]
      : []),
    ...(dateTo
      ? [lte(employeeViolationHistory.violationDate, dateTo)]
      : []),
  ];

  // Build query based on groupBy
  let selectFields: any = { count: count() };
  let groupByFields: any[] = [];

  switch (groupBy) {
    case "type":
      selectFields.type = employeeViolationHistory.violationType;
      groupByFields = [employeeViolationHistory.violationType];
      break;
    case "severity":
      selectFields.severity = employeeViolationHistory.severity;
      groupByFields = [employeeViolationHistory.severity];
      break;
    case "employee":
      selectFields.employeeId = employees.id;
      selectFields.employeeName = users.fullName;
      groupByFields = [employees.id, users.fullName];
      break;
    case "department":
      selectFields.department = sql<string>`departments.name`;
      groupByFields = [sql`departments.name`];
      break;
    case "job":
      selectFields.jobId = employeeComplianceCases.jobId;
      groupByFields = [employeeComplianceCases.jobId];
      break;
  }

  const query = db
    .select(selectFields)
    .from(employeeViolationHistory)
    .leftJoin(employees, eq(employeeViolationHistory.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(sql`departments`, sql`departments.id = employees.department_id`)
    .leftJoin(
      employeeComplianceCases,
      eq(employeeViolationHistory.complianceCaseId, employeeComplianceCases.id)
    )
    .where(and(...conditions))
    .groupBy(...groupByFields)
    .orderBy(desc(count()));

  const results = await query;
  return results.map((r: any) => ({
    count: Number(r.count || 0),
    type: r.type,
    severity: r.severity,
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    department: r.department,
    jobId: r.jobId,
  })) as ViolationCounts[];
};
