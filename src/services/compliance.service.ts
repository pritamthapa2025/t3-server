import { db } from "../config/db.js";
import {
  employeeComplianceCases,
  employeeViolationHistory,
} from "../drizzle/schema/compliance.schema.js";
import { employees, departments } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { alias } from "drizzle-orm/pg-core";
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
  getTableColumns,
} from "drizzle-orm";
import type {
  CreateComplianceCaseData,
  UpdateComplianceCaseData,
  DashboardKPIs,
  ViolationWatchlistItem,
  ViolationCounts,
} from "../types/compliance.types.js";

// Helper function to validate organizationId (client ID) - returns UUID or null
// organizationId is optional and only used to track which client the compliance case relates to
const validateOrganizationId = (
  organizationId: string | undefined,
): string | null => {
  if (!organizationId) {
    return null; // No client association - T3 internal case
  }

  // Check if it's a valid UUID format (client ID)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(organizationId)) {
    return organizationId; // Valid client UUID
  }

  // If not a valid UUID (e.g., "t3-org-default"), return null (no client association)
  return null;
};

// Dashboard KPIs Service
export const getDashboardKPIs = async (filters: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<DashboardKPIs> => {
  const { dateFrom, dateTo } = filters;

  // Base query conditions - only filter by date and deleted status
  const conditions = [
    eq(employeeComplianceCases.isDeleted, false),
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
          eq(employeeComplianceCases.status, "investigating"),
        ),
      ),
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
          eq(employeeComplianceCases.severity, "critical"),
        ),
      ),
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
      ),
    );

  // Average Resolution Time (in days)
  const avgResolutionResult = await db
    .select({
      avgDays: sql<number>`AVG(resolved_date - opened_on)`,
    })
    .from(employeeComplianceCases)
    .where(
      and(
        ...conditions,
        eq(employeeComplianceCases.status, "resolved"),
        isNotNull(employeeComplianceCases.resolvedDate),
      ),
    );

  return {
    activeCases: activeCasesResult[0]?.count || 0,
    highSeverity: highSeverityResult[0]?.count || 0,
    suspendedStaff: suspendedStaffResult[0]?.count || 0,
    avgResolutionDays: Math.round(avgResolutionResult[0]?.avgDays || 0),
  };
};

// Aliases for joining users table multiple times (reportedBy, assignedTo, resolvedBy)
const reportedByUser = alias(users, "reported_by_user");
const assignedToUser = alias(users, "assigned_to_user");
const resolvedByUser = alias(users, "resolved_by_user");

// Get Compliance Cases with Pagination
export const getComplianceCases = async (
  offset: number,
  limit: number,
  filters: {
    search?: string;
    organizationId?: string;
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
  },
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
    ...(organizationId
      ? [eq(employeeComplianceCases.organizationId, organizationId)]
      : []),
    ...(jobId ? [eq(employeeComplianceCases.jobId, jobId)] : []),
    ...(employeeId ? [eq(employeeComplianceCases.employeeId, employeeId)] : []),
    ...(type ? [eq(employeeComplianceCases.type, type as any)] : []),
    ...(severity
      ? [eq(employeeComplianceCases.severity, severity as any)]
      : []),
    ...(status ? [eq(employeeComplianceCases.status, status as any)] : []),
    ...(assignedTo ? [eq(employeeComplianceCases.assignedTo, assignedTo)] : []),
    ...(dueFrom ? [gte(employeeComplianceCases.dueDate, dueFrom)] : []),
    ...(dueTo ? [lte(employeeComplianceCases.dueDate, dueTo)] : []),
  ];

  // Add search conditions
  if (search) {
    conditions.push(
      or(
        like(employeeComplianceCases.caseNumber, `%${search}%`),
        like(employeeComplianceCases.title, `%${search}%`),
        like(employeeComplianceCases.description, `%${search}%`),
      )!,
    );
  }

  // Build sort order
  let orderBy: any;
  if (sortBy === "createdAt") {
    orderBy =
      sortOrder === "asc"
        ? asc(employeeComplianceCases.createdAt)
        : desc(employeeComplianceCases.createdAt);
  } else if (sortBy === "dueDate") {
    orderBy =
      sortOrder === "asc"
        ? asc(employeeComplianceCases.dueDate)
        : desc(employeeComplianceCases.dueDate);
  } else if (sortBy === "severity") {
    orderBy =
      sortOrder === "asc"
        ? asc(employeeComplianceCases.severity)
        : desc(employeeComplianceCases.severity);
  } else if (sortBy === "status") {
    orderBy =
      sortOrder === "asc"
        ? asc(employeeComplianceCases.status)
        : desc(employeeComplianceCases.status);
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
  const casesResult = await db
    .select({
      ...getTableColumns(employeeComplianceCases),
      employeeName: users.fullName,
      employeeEmail: users.email,
      reportedByName: reportedByUser.fullName,
      assignedToName: assignedToUser.fullName,
      resolvedByName: resolvedByUser.fullName,
    })
    .from(employeeComplianceCases)
    .leftJoin(employees, eq(employeeComplianceCases.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(
      reportedByUser,
      eq(employeeComplianceCases.reportedBy, reportedByUser.id),
    )
    .leftJoin(
      assignedToUser,
      eq(employeeComplianceCases.assignedTo, assignedToUser.id),
    )
    .leftJoin(
      resolvedByUser,
      eq(employeeComplianceCases.resolvedBy, resolvedByUser.id),
    )
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  // Map results to include name fields with null fallback
  const cases = casesResult.map((row) => {
    const {
      reportedByName,
      assignedToName,
      resolvedByName,
      employeeName,
      employeeEmail,
      ...record
    } = row;
    return {
      ...record,
      employeeName: employeeName ?? null,
      employeeEmail: employeeEmail ?? null,
      reportedByName: reportedByName ?? null,
      assignedToName: assignedToName ?? null,
      resolvedByName: resolvedByName ?? null,
    };
  });

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

// Get Compliance Case by ID (with reportedByName, assignedToName, resolvedByName)
export const getComplianceCaseById = async (id: string) => {
  const [row] = await db
    .select({
      ...getTableColumns(employeeComplianceCases),
      employeeName: users.fullName,
      employeeEmail: users.email,
      reportedByName: reportedByUser.fullName,
      assignedToName: assignedToUser.fullName,
      resolvedByName: resolvedByUser.fullName,
    })
    .from(employeeComplianceCases)
    .leftJoin(employees, eq(employeeComplianceCases.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(
      reportedByUser,
      eq(employeeComplianceCases.reportedBy, reportedByUser.id),
    )
    .leftJoin(
      assignedToUser,
      eq(employeeComplianceCases.assignedTo, assignedToUser.id),
    )
    .leftJoin(
      resolvedByUser,
      eq(employeeComplianceCases.resolvedBy, resolvedByUser.id),
    )
    .where(
      and(
        eq(employeeComplianceCases.id, id),
        eq(employeeComplianceCases.isDeleted, false),
      ),
    );

  if (!row) return null;

  const {
    reportedByName,
    assignedToName,
    resolvedByName,
    employeeName,
    employeeEmail,
    ...record
  } = row;
  return {
    ...record,
    employeeName: employeeName ?? null,
    employeeEmail: employeeEmail ?? null,
    reportedByName: reportedByName ?? null,
    assignedToName: assignedToName ?? null,
    resolvedByName: resolvedByName ?? null,
  };
};

// Generate Case Number using PostgreSQL sequence (thread-safe)
// Format: CASE-2025-000001 (6 digits, auto-expands to 7, 8, 9+ as needed)
export const generateCaseNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();

  try {
    // Use PostgreSQL sequence for atomic ID generation
    const result = await db.execute<{ nextval: string }>(
      sql.raw(`SELECT nextval('org.case_number_seq')::text as nextval`),
    );

    const nextNumber = parseInt(result.rows[0]?.nextval || "1");

    // Use 6 digits minimum, auto-expand when exceeds 999999
    const padding = Math.max(6, nextNumber.toString().length);
    return `CASE-${year}-${String(nextNumber).padStart(padding, "0")}`;
  } catch (error) {
    // Fallback to old method if sequence doesn't exist yet
    console.warn(
      "Case number sequence not found, using fallback method:",
      error,
    );

    const result = await db
      .select({ caseNumber: employeeComplianceCases.caseNumber })
      .from(employeeComplianceCases)
      .where(
        and(
          eq(employeeComplianceCases.isDeleted, false),
          sql`${employeeComplianceCases.caseNumber} ~ ${`^CASE-${year}-\\d+$`}`,
        ),
      )
      .orderBy(desc(employeeComplianceCases.caseNumber))
      .limit(1);

    let nextNumber = 1;
    if (result.length && result[0]?.caseNumber) {
      const lastCaseNumber = result[0].caseNumber;
      const match = lastCaseNumber.match(/^CASE-\d+-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]!) + 1;
      }
    }

    // Use 6 digits minimum, auto-expand when exceeds 999999
    const padding = Math.max(6, nextNumber.toString().length);
    return `CASE-${year}-${String(nextNumber).padStart(padding, "0")}`;
  }
};

// Create Compliance Case
export const createComplianceCase = async (data: CreateComplianceCaseData) => {
  // Validate organizationId (client ID) - only include if it's a valid UUID
  const validatedOrgId = validateOrganizationId(data.organizationId);

  // Auto-generate case number if not provided
  const caseNumber = data.caseNumber || (await generateCaseNumber());

  const insertData: any = {
    employeeId: data.employeeId,
    caseNumber: caseNumber,
    type: data.type,
    severity: data.severity,
    status: data.status || "open",
    title: data.title,
    description: data.description,
    openedOn:
      data.openedOn instanceof Date
        ? data.openedOn.toISOString().split("T")[0]
        : data.openedOn,
  };

  // Only include organizationId if it's a valid client UUID
  if (validatedOrgId) {
    insertData.organizationId = validatedOrgId;
  }

  if (data.jobId) insertData.jobId = data.jobId;
  if (data.notes) insertData.notes = data.notes;
  if (data.dueDate)
    insertData.dueDate =
      data.dueDate instanceof Date
        ? data.dueDate.toISOString().split("T")[0]
        : data.dueDate;
  if (data.reportedBy) insertData.reportedBy = data.reportedBy;
  if (data.assignedTo) insertData.assignedTo = data.assignedTo;
  if (data.impactLevel) insertData.impactLevel = data.impactLevel;
  if (data.correctiveAction)
    insertData.correctiveAction = data.correctiveAction;
  if (data.preventiveAction)
    insertData.preventiveAction = data.preventiveAction;
  // Disciplinary Action fields
  if (data.disciplinaryAction)
    insertData.disciplinaryAction = data.disciplinaryAction;
  if (data.actionDate)
    insertData.actionDate =
      data.actionDate instanceof Date
        ? data.actionDate.toISOString().split("T")[0]
        : data.actionDate;
  if (data.actionNotes) insertData.actionNotes = data.actionNotes;
  if (data.performanceImpact !== undefined)
    insertData.performanceImpact = data.performanceImpact.toString();
  if (data.attachments) insertData.attachments = data.attachments;
  if (data.evidencePhotos) insertData.evidencePhotos = data.evidencePhotos;
  if (data.createdBy) insertData.createdBy = data.createdBy;

  const result = await db
    .insert(employeeComplianceCases)
    .values(insertData)
    .returning();

  // Return enriched data with names (following cursor rule)
  const inserted = result[0];
  if (!inserted) throw new Error("Failed to create compliance case");
  return await getComplianceCaseById(inserted.id);
};

// Update Compliance Case
export const updateComplianceCase = async (
  id: string,
  data: UpdateComplianceCaseData,
) => {
  const updateData: any = { ...data };

  // Handle date conversions
  if (data.dueDate) {
    updateData.dueDate =
      data.dueDate instanceof Date
        ? data.dueDate.toISOString().split("T")[0]
        : data.dueDate;
  }
  if (data.resolvedDate) {
    updateData.resolvedDate =
      data.resolvedDate instanceof Date
        ? data.resolvedDate.toISOString().split("T")[0]
        : data.resolvedDate;
  }
  if (data.actionDate) {
    updateData.actionDate =
      data.actionDate instanceof Date
        ? data.actionDate.toISOString().split("T")[0]
        : data.actionDate;
  }

  // Handle performance impact conversion
  if (data.performanceImpact !== undefined) {
    updateData.performanceImpact = data.performanceImpact.toString();
  }

  const result = await db
    .update(employeeComplianceCases)
    .set(updateData)
    .where(
      and(
        eq(employeeComplianceCases.id, id),
        eq(employeeComplianceCases.isDeleted, false),
      ),
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
        eq(employeeComplianceCases.isDeleted, false),
      ),
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
  resolvedDate?: Date,
) => {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };

  if (notes) updateData.notes = notes;
  if (resolvedBy) updateData.resolvedBy = resolvedBy;
  if (resolvedDate)
    updateData.resolvedDate =
      resolvedDate instanceof Date
        ? resolvedDate.toISOString().split("T")[0]
        : resolvedDate;

  const result = await db
    .update(employeeComplianceCases)
    .set(updateData)
    .where(
      and(
        eq(employeeComplianceCases.id, id),
        eq(employeeComplianceCases.isDeleted, false),
      ),
    )
    .returning();

  return result[0] || null;
};

// Get Violation Watchlist - Now uses Compliance Cases instead of Violation History
export const getViolationWatchlist = async (
  offset: number,
  limit: number,
  filters: {
    organizationId?: string;
    minViolations?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
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

  // Build join conditions for compliance cases
  // When organizationId is provided, include cases with matching orgId OR null (T3 internal)
  // When organizationId is NOT provided, include ALL cases (no org filter)
  const caseJoinConditions = [
    eq(employeeComplianceCases.employeeId, employees.id),
    eq(employeeComplianceCases.isDeleted, false),
  ];

  // Only filter by organizationId if explicitly provided
  // If not provided, show all cases regardless of organizationId
  if (organizationId) {
    // Include cases with matching organizationId OR null organizationId (T3 internal cases)
    caseJoinConditions.push(
      or(
        eq(employeeComplianceCases.organizationId, organizationId),
        isNull(employeeComplianceCases.organizationId),
      )!,
    );
  }
  // If organizationId is not provided, don't add any org filter - show all cases

  // Get employees with compliance case counts (these are the violations)
  const watchlistQuery = db
    .select({
      employeeId: employees.id,
      employeeName: users.fullName,
      employeeEmail: users.email,
      department: departments.name,
      violationCount: count(employeeComplianceCases.id),
      status: employees.status,
      lastViolationDate: sql<Date>`MAX(${employeeComplianceCases.openedOn})`,
    })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(employeeComplianceCases, and(...caseJoinConditions))
    .where(eq(employees.isDeleted, false))
    .groupBy(employees.id, users.id, departments.name)
    .having(sql`COUNT(${employeeComplianceCases.id}) >= ${minViolations}`);

  // Get total count using a separate count-only query
  const countBaseQuery = db
    .select({
      employeeId: employees.id,
    })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(employeeComplianceCases, and(...caseJoinConditions))
    .where(eq(employees.isDeleted, false))
    .groupBy(employees.id, users.id, departments.name)
    .having(sql`COUNT(${employeeComplianceCases.id}) >= ${minViolations}`);

  // Count the distinct employees from the grouped results
  const countResults = await countBaseQuery;
  const total = countResults.length;

  // Get paginated results
  const orderColumn =
    sortBy === "employeeName"
      ? users.fullName
      : sortBy === "department"
        ? departments.name
        : count(employeeComplianceCases.id);

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
  organizationId?: string;
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
    ...(organizationId
      ? [eq(employeeViolationHistory.organizationId, organizationId)]
      : []),
    ...(jobId ? [eq(employeeComplianceCases.jobId, jobId)] : []),
    ...(employeeId
      ? [eq(employeeViolationHistory.employeeId, employeeId)]
      : []),
    ...(dateFrom
      ? [gte(employeeViolationHistory.violationDate, dateFrom)]
      : []),
    ...(dateTo ? [lte(employeeViolationHistory.violationDate, dateTo)] : []),
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
      selectFields.department = departments.name;
      groupByFields = [departments.name];
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
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(
      employeeComplianceCases,
      eq(employeeViolationHistory.complianceCaseId, employeeComplianceCases.id),
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

// Create Employee Violation History
export const createEmployeeViolation = async (data: {
  organizationId?: string;
  employeeId: number;
  complianceCaseId?: string;
  violationType:
    | "safety"
    | "timesheet"
    | "conduct"
    | "training"
    | "certification"
    | "other";
  violationDate: string; // YYYY-MM-DD format
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  disciplinaryAction?: string;
  actionDate?: string; // YYYY-MM-DD format
  actionNotes?: string;
  performanceImpact?: number; // -5.0 to -10.0
  isResolved?: boolean;
  resolutionDate?: string; // YYYY-MM-DD format
  resolutionNotes?: string;
  createdBy?: string;
}) => {
  if (data.organizationId == null) {
    throw new Error(
      "organizationId (client id) is required in body to create a violation",
    );
  }
  const [violation] = await db
    .insert(employeeViolationHistory)
    .values({
      organizationId: data.organizationId,
      employeeId: data.employeeId,
      complianceCaseId: data.complianceCaseId || null,
      violationType: data.violationType,
      violationDate: data.violationDate,
      description: data.description,
      severity: data.severity,
      disciplinaryAction: data.disciplinaryAction || null,
      actionDate: data.actionDate || null,
      actionNotes: data.actionNotes || null,
      performanceImpact: data.performanceImpact
        ? data.performanceImpact.toString()
        : null,
      isResolved: data.isResolved || false,
      resolutionDate: data.resolutionDate || null,
      resolutionNotes: data.resolutionNotes || null,
      createdBy: data.createdBy || null,
    })
    .returning();

  return violation;
};
