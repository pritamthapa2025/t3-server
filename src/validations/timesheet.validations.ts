import { z } from "zod";

const uuidSchema = z
  .string()
  .uuid({ message: "Invalid ID format - must be a valid UUID" });

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be in YYYY-MM-DD format" });

// Get timesheets query validation
export const getTimesheetsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive("Page number must be a positive number")),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(
        z
          .number()
          .int()
          .positive("Limit must be a positive number")
          .max(100, "Maximum 100 items per page"),
      ),
  }),
});

// Get timesheets by employee query validation
export const getTimesheetsByEmployeeQuerySchema = z.object({
  query: z
    .object({
      page: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 1))
        .pipe(z.number().int().positive("Page number must be a positive number")),
      limit: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 10))
        .pipe(
          z
            .number()
            .int()
            .positive("Limit must be a positive number")
            .max(100, "Maximum 100 items per page"),
        ),
      search: z.string().optional(),
      employeeId: z.string().optional(),
      dateFrom: z
        .string()
        .optional()
        .refine((val) => !val || !isNaN(new Date(val).getTime()), {
          message: "Invalid date format for dateFrom. Please use YYYY-MM-DD format",
        }),
      dateTo: z
        .string()
        .optional()
        .refine((val) => !val || !isNaN(new Date(val).getTime()), {
          message: "Invalid date format for dateTo. Please use YYYY-MM-DD format",
        }),
    })
    .refine(
      (data) => {
        if (data.dateFrom && data.dateTo) {
          return new Date(data.dateFrom) <= new Date(data.dateTo);
        }
        return true;
      },
      {
        message: "Start date must be before or equal to end date",
        path: ["dateFrom"],
      },
    ),
});

// Get timesheet by ID validation
export const getTimesheetByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Timesheet ID must be a valid positive number")),
  }),
});

// Create timesheet validation (dispatch-driven: no clockIn/clockOut required)
export const createTimesheetSchema = z.object({
  body: z.object({
    employeeId: z
      .number()
      .int("Employee ID must be a whole number")
      .positive("Employee ID is required and must be a positive number"),
    sheetDate: z.string(),
    breakMinutes: z
      .union([z.number().int(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(
        z
          .number()
          .int("Break minutes must be a whole number")
          .nonnegative("Break minutes cannot be negative"),
      )
      .optional(),
    totalHours: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
      .pipe(z.number().nonnegative("Total hours cannot be negative"))
      .optional(),
    overtimeHours: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
      .pipe(z.number().nonnegative("Overtime hours cannot be negative"))
      .optional(),
    notes: z.string().optional(),
  }),
});

// Update timesheet validation (dispatch-driven: no clockIn/clockOut)
export const updateTimesheetSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Timesheet ID must be a valid positive number")),
  }),
  body: z
    .object({
      employeeId: z
        .number()
        .int("Employee ID must be a whole number")
        .positive("Employee ID must be a positive number")
        .optional(),
      sheetDate: z.string().optional(),
      breakMinutes: z
        .union([z.number().int(), z.string()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .pipe(
          z
            .number()
            .int("Break minutes must be a whole number")
            .nonnegative("Break minutes cannot be negative"),
        )
        .optional(),
      totalHours: z
        .union([z.number(), z.string()])
        .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
        .pipe(z.number().nonnegative("Total hours cannot be negative"))
        .optional(),
      overtimeHours: z
        .union([z.number(), z.string()])
        .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
        .pipe(z.number().nonnegative("Overtime hours cannot be negative"))
        .optional(),
      notes: z.string().optional(),
      status: z
        .enum(["pending", "submitted", "approved", "rejected"], {
          message: "Status must be one of: pending, submitted, approved, or rejected",
        })
        .optional(),
      rejectedBy: uuidSchema.optional().nullable(),
      approvedBy: uuidSchema.optional().nullable(),
      updatedAt: z.string().optional(),
    })
    .refine(
      (data) =>
        data.employeeId !== undefined ||
        data.sheetDate !== undefined ||
        data.breakMinutes !== undefined ||
        data.totalHours !== undefined ||
        data.overtimeHours !== undefined ||
        data.notes !== undefined ||
        data.status !== undefined ||
        data.rejectedBy !== undefined ||
        data.approvedBy !== undefined,
      {
        message: "At least one field must be provided to update the timesheet",
      },
    ),
});

// Delete timesheet validation
export const deleteTimesheetSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Timesheet ID must be a valid positive number")),
  }),
});

// Approve single timesheet validation
export const approveTimesheetSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Timesheet ID must be a valid positive number")),
  }),
  body: z.object({
    approvedBy: uuidSchema,
    notes: z.string().optional(),
  }),
});

// Reject single timesheet validation
export const rejectTimesheetSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Timesheet ID must be a valid positive number")),
  }),
  body: z.object({
    rejectedBy: uuidSchema,
    rejectionReason: z
      .string()
      .min(1, "Rejection reason is required and cannot be empty")
      .max(500, "Rejection reason is too long (maximum 500 characters)"),
    notes: z.string().optional(),
  }),
});

// Get weekly timesheets by employee validation
export const getWeeklyTimesheetsByEmployeeQuerySchema = z.object({
  query: z.object({
    weekStartDate: z
      .string()
      .refine((val) => !isNaN(new Date(val).getTime()), {
        message: "Invalid date format for week start date. Please use YYYY-MM-DD format",
      })
      .refine((val) => new Date(val).getDay() === 1, {
        message: "Week start date must be a Monday (start of the work week)",
      }),
    employeeId: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((val) => {
        if (!val) return undefined;
        if (Array.isArray(val)) {
          return val.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
        }
        const str = val.toString().trim();
        const cleaned = str.replace(/^\[|\]$/g, "");
        const ids = cleaned
          .split(",")
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !isNaN(id) && id > 0);
        return ids.length > 0 ? ids : undefined;
      })
      .pipe(z.array(z.number().int().positive("Employee ID must be a positive number")).optional()),
    departmentId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive("Department ID must be a positive number").optional()),
    status: z
      .enum(["pending", "submitted", "approved", "rejected"], {
        message: "Status must be one of: pending, submitted, approved, or rejected",
      })
      .optional(),
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive("Page number must be a positive number")),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(
        z
          .number()
          .int()
          .positive("Limit must be a positive number")
          .max(100, "Maximum 100 items per page"),
      ),
  }),
});

// Get my timesheets query validation (for current logged-in employee) - weekly format
export const getMyTimesheetsQuerySchema = z.object({
  query: z.object({
    weekStartDate: z
      .string()
      .optional()
      .refine(
        (val) => !val || !isNaN(new Date(val).getTime()),
        { message: "Invalid date format for week start date. Please use YYYY-MM-DD format" },
      )
      .refine(
        (val) => !val || new Date(val).getDay() === 1,
        { message: "Week start date must be a Monday (start of the work week)" },
      ),
    search: z.string().optional(),
  }),
});

// Get timesheet KPIs validation
export const getTimesheetKPIsQuerySchema = z.object({
  query: z.object({
    weekStartDate: z
      .string()
      .min(1, "Week start date is required")
      .refine((val) => !isNaN(new Date(val).getTime()), {
        message: "Invalid date format for week start date. Please use YYYY-MM-DD format",
      })
      .refine((val) => new Date(val).getDay() === 1, {
        message: "Week start date must be a Monday (start of the work week)",
      }),
  }),
});

// ===========================================================================
// Weekly Bulk Action Schemas (new dispatch-driven model)
// ===========================================================================

// Tech confirms their own week (Monday morning)
export const weeklyConfirmSchema = z.object({
  body: z.object({
    weekStart: dateStringSchema,
    weekEnd: dateStringSchema,
    notes: z.string().max(1000).optional(),
  }),
});

// Manager/Executive approves full week for one employee
export const weeklyApproveSchema = z.object({
  body: z.object({
    employeeId: z.number().int().positive("Employee ID must be a positive integer"),
    weekStart: dateStringSchema,
    weekEnd: dateStringSchema,
    notes: z.string().max(1000).optional(),
  }),
});

// Manager/Executive rejects full week for one employee
export const weeklyRejectSchema = z.object({
  body: z.object({
    employeeId: z.number().int().positive("Employee ID must be a positive integer"),
    weekStart: dateStringSchema,
    weekEnd: dateStringSchema,
    rejectionReason: z
      .string()
      .min(1, "Rejection reason is required")
      .max(500, "Rejection reason is too long (maximum 500 characters)"),
    notes: z.string().max(1000).optional(),
  }),
});

// ===========================================================================
// Manual / Coverage Time Logging
// ===========================================================================

const timeHHMMSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, { message: "Time must be in HH:MM format (24h)" });

/**
 * POST /timesheets/log-time
 * Body accepted from both techs and managers.
 * Managers must supply employeeId; techs omit it (self is inferred from JWT).
 */
export const logTimeSchema = z.object({
  body: z
    .object({
      // Required only for managers logging on behalf of a tech
      employeeId: z.number().int().positive("Employee ID must be a positive integer").optional(),
      // Active job to record the time against (optional — tech can log general time)
      jobId: z.string().uuid({ message: "Invalid job ID format" }).optional(),
      sheetDate: dateStringSchema,
      timeIn: timeHHMMSchema,
      timeOut: timeHHMMSchema,
      breakMinutes: z
        .union([z.number().int(), z.string()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .pipe(z.number().int().min(0, "Break minutes cannot be negative"))
        .default(0),
      // 'manual' = self-logged without dispatch, 'coverage' = covering another tech's job
      entryType: z.enum(["manual", "coverage"]).default("manual"),
      notes: z.string().max(2000).optional(),
      // When entryType = 'coverage', the employee ID of the person being covered for
      coveredForEmployeeId: z.number().int().positive("Covered-for employee ID must be a positive integer").optional(),
      // The specific dispatch assignment UUID being covered
      coveredForDispatchAssignmentId: z.string().uuid("Invalid dispatch assignment ID").optional(),
    })
    .refine(
      (data) => {
        const [inH = 0, inM = 0] = data.timeIn.split(":").map(Number);
        const [outH = 0, outM = 0] = data.timeOut.split(":").map(Number);
        return outH * 60 + outM > inH * 60 + inM;
      },
      { message: "Time Out must be after Time In", path: ["timeOut"] },
    ),
});

/**
 * PUT /timesheets/job-entries/:entryId
 * Update time-in, time-out, break, notes on an existing timesheetJobEntry.
 */
export const updateJobEntryParamsSchema = z.object({
  params: z.object({
    entryId: z
      .string()
      .transform((v) => parseInt(v, 10))
      .pipe(z.number().int().positive("Entry ID must be a positive integer")),
  }),
});

export const updateJobEntryBodySchema = z.object({
  body: z
    .object({
      timeIn: timeHHMMSchema,
      timeOut: timeHHMMSchema,
      breakMinutes: z
        .union([z.number().int(), z.string()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .pipe(z.number().int().min(0, "Break minutes cannot be negative"))
        .default(0),
      notes: z.string().max(2000).optional(),
    })
    .refine(
      (data) => {
        const [inH = 0, inM = 0] = data.timeIn.split(":").map(Number);
        const [outH = 0, outM = 0] = data.timeOut.split(":").map(Number);
        return outH * 60 + outM > inH * 60 + inM;
      },
      { message: "Time Out must be after Time In", path: ["timeOut"] },
    ),
});

/**
 * GET /timesheets/my-history
 * Flat paginated list of a tech's own time-block history (both dispatch and manual).
 */
export const getMyHistoryQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive("Page must be a positive number")),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .pipe(z.number().int().positive().max(100, "Maximum 100 per page")),
    dateFrom: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(new Date(val).getTime()), {
        message: "Invalid dateFrom format. Use YYYY-MM-DD",
      }),
    dateTo: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(new Date(val).getTime()), {
        message: "Invalid dateTo format. Use YYYY-MM-DD",
      }),
    jobId: z.string().uuid().optional(),
    status: z
      .enum(["pending", "submitted", "approved", "rejected"])
      .optional(),
    sortBy: z.enum(["date", "hours"]).optional().default("date"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
    search: z.string().optional(),
  }),
});
