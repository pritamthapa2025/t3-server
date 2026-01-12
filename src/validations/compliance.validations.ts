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
    caseNumber: z.string().min(1).max(50).optional(), // Auto-generated if not provided
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
    // Disciplinary Action fields
    disciplinaryAction: z.string().max(100, "Disciplinary action is too long (maximum 100 characters)").optional(),
    actionDate: z.string().optional().refine(
      (val) => !val || !isNaN(Date.parse(val)),
      { message: "Invalid action date format. Please use YYYY-MM-DD format (e.g., 2024-12-15)" }
    ),
    actionNotes: z.string().optional(),
    performanceImpact: z.number().min(-10, "Performance impact cannot be less than -10").max(0, "Performance impact cannot be greater than 0").optional(),
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
    // Disciplinary Action fields
    disciplinaryAction: z.string().max(100, "Disciplinary action is too long (maximum 100 characters)").optional(),
    actionDate: z.string().optional().refine(
      (val) => !val || !isNaN(Date.parse(val)),
      { message: "Invalid action date format. Please use YYYY-MM-DD format (e.g., 2024-12-15)" }
    ),
    actionNotes: z.string().optional(),
    performanceImpact: z.number().min(-10, "Performance impact cannot be less than -10").max(0, "Performance impact cannot be greater than 0").optional(),
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

// Create Employee Violation Schema
export const createEmployeeViolationSchema = z.object({
  body: z.object({
    employeeId: z.number().int().positive("Employee ID is required and must be a positive number"),
    complianceCaseId: z.string().uuid("Compliance case ID must be a valid UUID").optional(),
    violationType: z.enum(["safety", "timesheet", "conduct", "training", "certification", "other"], {
      message: "Violation type must be one of: safety, timesheet, conduct, training, certification, other"
    }),
    violationDate: z.string().refine(
      (val) => !isNaN(Date.parse(val)),
      { message: "Invalid violation date format. Please use YYYY-MM-DD format (e.g., 2024-12-15)" }
    ),
    description: z.string().min(1, "Description is required"),
    severity: z.enum(["low", "medium", "high", "critical"], {
      message: "Severity must be one of: low, medium, high, critical"
    }),
    disciplinaryAction: z.string().max(100, "Disciplinary action is too long (maximum 100 characters)").optional(),
    actionDate: z.string().optional().refine(
      (val) => !val || !isNaN(Date.parse(val)),
      { message: "Invalid action date format. Please use YYYY-MM-DD format (e.g., 2024-12-15)" }
    ),
    actionNotes: z.string().optional(),
    performanceImpact: z.number().min(-10, "Performance impact cannot be less than -10").max(0, "Performance impact cannot be greater than 0").optional(),
    isResolved: z.boolean().optional().default(false),
    resolutionDate: z.string().optional().refine(
      (val) => !val || !isNaN(Date.parse(val)),
      { message: "Invalid resolution date format. Please use YYYY-MM-DD format (e.g., 2024-12-15)" }
    ),
    resolutionNotes: z.string().optional(),
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

