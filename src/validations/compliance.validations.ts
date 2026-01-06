import { z } from "zod";

// Dashboard KPIs Query Schema
export const getDashboardKPIsQuerySchema = z.object({
  query: z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }),
});

// Compliance Cases Query Schema
export const getComplianceCasesQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    search: z.string().optional(),
    organizationId: z.string().uuid().optional(),
    jobId: z.string().uuid().optional(),
    employeeId: z.string().transform(Number).optional(),
    type: z.enum(["safety", "timesheet", "conduct", "training", "certification", "other"]).optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    status: z.enum(["open", "investigating", "resolved", "closed", "escalated"]).optional(),
    assignedTo: z.string().uuid().optional(),
    dueFrom: z.string().optional(),
    dueTo: z.string().optional(),
    sortBy: z.enum(["createdAt", "dueDate", "severity", "status"]).optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
});

// Get Compliance Case By ID Schema
export const getComplianceCaseByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

// Create Compliance Case Schema
export const createComplianceCaseSchema = z.object({
  body: z.object({
    organizationId: z.string().uuid().optional(),
    jobId: z.string().uuid().optional(),
    employeeId: z.number().int().positive(),
    caseNumber: z.string().min(1).max(50),
    type: z.enum(["safety", "timesheet", "conduct", "training", "certification", "other"]),
    severity: z.enum(["low", "medium", "high", "critical"]),
    status: z.enum(["open", "investigating", "resolved", "closed", "escalated"]).optional().default("open"),
    title: z.string().min(1).max(255),
    description: z.string().min(1),
    notes: z.string().optional(),
    openedOn: z.string().transform((str) => new Date(str)),
    dueDate: z.string().transform((str) => new Date(str)).optional(),
    reportedBy: z.string().uuid().optional(),
    assignedTo: z.string().uuid().optional(),
    impactLevel: z.enum(["low_risk", "medium_risk", "high_risk"]).optional(),
    correctiveAction: z.string().optional(),
    preventiveAction: z.string().optional(),
    attachments: z.array(z.string()).optional(),
    evidencePhotos: z.array(z.string()).optional(),
  }),
});

// Update Compliance Case Schema
export const updateComplianceCaseSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    jobId: z.string().uuid().optional(),
    employeeId: z.number().int().positive().optional(),
    caseNumber: z.string().min(1).max(50).optional(),
    type: z.enum(["safety", "timesheet", "conduct", "training", "certification", "other"]).optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    status: z.enum(["open", "investigating", "resolved", "closed", "escalated"]).optional(),
    title: z.string().min(1).max(255).optional(),
    description: z.string().min(1).optional(),
    notes: z.string().optional(),
    dueDate: z.string().transform((str) => new Date(str)).optional(),
    resolvedDate: z.string().transform((str) => new Date(str)).optional(),
    assignedTo: z.string().uuid().optional(),
    resolvedBy: z.string().uuid().optional(),
    impactLevel: z.enum(["low_risk", "medium_risk", "high_risk"]).optional(),
    correctiveAction: z.string().optional(),
    preventiveAction: z.string().optional(),
    attachments: z.array(z.string()).optional(),
    evidencePhotos: z.array(z.string()).optional(),
  }),
});

// Delete Compliance Case Schema
export const deleteComplianceCaseSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

// Update Case Status Schema (for status updates)
export const updateCaseStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(["open", "investigating", "resolved", "closed", "escalated"]),
    notes: z.string().optional(),
    resolvedBy: z.string().uuid().optional(),
    resolvedDate: z.string().transform((str) => new Date(str)).optional(),
  }),
});

// Violation Watchlist Query Schema
export const getViolationWatchlistQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    minViolations: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 3))
      .pipe(z.number().int().positive()),
    sortBy: z.enum(["violationCount", "employeeName", "department"]).optional().default("violationCount"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
});

// Violation Counts Query Schema
export const getViolationCountsQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    jobId: z.string().uuid().optional(),
    employeeId: z.string().transform(Number).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    groupBy: z.enum(["type", "severity", "employee", "department", "job"]).optional().default("type"),
  }),
});

