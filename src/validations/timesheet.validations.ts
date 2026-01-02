import { z } from "zod";

const uuidSchema = z.string().uuid({ message: "Invalid ID format - must be a valid UUID" });

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
      .pipe(z.number().int().positive("Limit must be a positive number").max(100, "Maximum 100 items per page")),
  }),
});

// Get timesheets by employee query validation
export const getTimesheetsByEmployeeQuerySchema = z.object({
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
      .pipe(z.number().int().positive("Limit must be a positive number").max(100, "Maximum 100 items per page")),
    search: z.string().optional(),
    employeeId: z.string().optional(),
    dateFrom: z
      .string()
      .optional()
      .refine(
        (val) => !val || !isNaN(new Date(val).getTime()),
        { message: "Invalid date format for dateFrom. Please use YYYY-MM-DD format" }
      ),
    dateTo: z
      .string()
      .optional()
      .refine(
        (val) => !val || !isNaN(new Date(val).getTime()),
        { message: "Invalid date format for dateTo. Please use YYYY-MM-DD format" }
      ),
  }).refine(
    (data) => {
      if (data.dateFrom && data.dateTo) {
        return new Date(data.dateFrom) <= new Date(data.dateTo);
      }
      return true;
    },
    {
      message: "Start date must be before or equal to end date",
      path: ["dateFrom"],
    }
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

// Create timesheet validation
export const createTimesheetSchema = z.object({
  body: z.object({
    employeeId: z
      .number()
      .int("Employee ID must be a whole number")
      .positive("Employee ID is required and must be a positive number"),
    sheetDate: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)",
      }),
    clockIn: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid clock-in datetime format. Please use ISO 8601 format (e.g., 2024-01-15T08:00:00Z)",
      }),
    clockOut: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid clock-out datetime format. Please use ISO 8601 format (e.g., 2024-01-15T17:00:00Z)",
      })
      .optional(),
    breakMinutes: z
      .union([z.number().int(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number().int("Break minutes must be a whole number").nonnegative("Break minutes cannot be negative"))
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
        message: "Status must be one of: pending, submitted, approved, or rejected"
      })
      .optional(),
    rejectedBy: uuidSchema.optional().nullable(),
    approvedBy: uuidSchema.optional().nullable(),
  }),
});

// Update timesheet validation
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
      sheetDate: z
        .union([z.string(), z.date()])
        .transform((val) => (typeof val === "string" ? new Date(val) : val))
        .refine((val) => !isNaN(val.getTime()), {
          message: "Invalid date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)",
        })
        .optional(),
      clockIn: z
        .union([z.string(), z.date()])
        .transform((val) => (typeof val === "string" ? new Date(val) : val))
        .refine((val) => !isNaN(val.getTime()), {
          message: "Invalid clock-in datetime format. Please use ISO 8601 format (e.g., 2024-01-15T08:00:00Z)",
        })
        .optional(),
      clockOut: z
        .union([z.string(), z.date()])
        .transform((val) => (typeof val === "string" ? new Date(val) : val))
        .refine((val) => !isNaN(val.getTime()), {
          message: "Invalid clock-out datetime format. Please use ISO 8601 format (e.g., 2024-01-15T17:00:00Z)",
        })
        .optional(),
      breakMinutes: z
        .union([z.number().int(), z.string()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .pipe(z.number().int("Break minutes must be a whole number").nonnegative("Break minutes cannot be negative"))
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
          message: "Status must be one of: pending, submitted, approved, or rejected"
        })
        .optional(),
      rejectedBy: uuidSchema.optional().nullable(),
      approvedBy: uuidSchema.optional().nullable(),
    })
    .refine(
      (data) =>
        data.employeeId !== undefined ||
        data.sheetDate !== undefined ||
        data.clockIn !== undefined ||
        data.clockOut !== undefined ||
        data.breakMinutes !== undefined ||
        data.totalHours !== undefined ||
        data.overtimeHours !== undefined ||
        data.notes !== undefined ||
        data.status !== undefined ||
        data.rejectedBy !== undefined ||
        data.approvedBy !== undefined,
      {
        message: "At least one field must be provided to update the timesheet",
      }
    ),
});

// Clock-in validation
export const clockInSchema = z.object({
  body: z.object({
    employeeId: z
      .number()
      .int("Employee ID must be a whole number")
      .positive("Employee ID is required and must be a positive number"),
    clockInDate: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)",
      }),
    clockInTime: z
      .string()
      .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: "Invalid time format. Please use HH:MM in 24-hour format (e.g., 08:30 or 14:45)",
      }),
    jobIds: z.array(uuidSchema).optional(),
    notes: z.string().optional(),
  }),
});

// Clock-out validation
export const clockOutSchema = z.object({
  body: z.object({
    employeeId: z
      .number()
      .int("Employee ID must be a whole number")
      .positive("Employee ID is required and must be a positive number"),
    clockOutDate: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)",
      }),
    clockOutTime: z
      .string()
      .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: "Invalid time format. Please use HH:MM in 24-hour format (e.g., 17:30 or 22:15)",
      }),
    jobIds: z.array(uuidSchema).optional(),
    notes: z.string().optional(),
    breakMinutes: z
      .union([z.number().int(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number().int("Break minutes must be a whole number").nonnegative("Break minutes cannot be negative"))
      .optional(),
  }),
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

// Approve timesheet validation
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

// Reject timesheet validation
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
      .refine(
        (val) => {
          const date = new Date(val);
          return !isNaN(date.getTime());
        },
        { message: "Invalid date format for week start date. Please use YYYY-MM-DD format (e.g., 2024-01-15)" }
      )
      .refine(
        (val) => {
          const date = new Date(val);
          // Check if it's a Monday (0 = Sunday, 1 = Monday)
          return date.getDay() === 1;
        },
        { message: "Week start date must be a Monday (start of the work week)" }
      ),
    search: z.string().optional(),
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
      .pipe(z.number().int().positive("Limit must be a positive number").max(100, "Maximum 100 items per page")),
  }),
});

// Get my timesheets query validation (for current logged-in employee) - weekly format
export const getMyTimesheetsQuerySchema = z.object({
  query: z.object({
    weekStartDate: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          const date = new Date(val);
          return !isNaN(date.getTime());
        },
        { message: "Invalid date format for week start date. Please use YYYY-MM-DD format (e.g., 2024-01-15)" }
      )
      .refine(
        (val) => {
          if (!val) return true;
          const date = new Date(val);
          // Check if it's a Monday (0 = Sunday, 1 = Monday)
          return date.getDay() === 1;
        },
        { message: "Week start date must be a Monday (start of the work week)" }
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
      .refine(
        (val) => {
          const date = new Date(val);
          return !isNaN(date.getTime());
        },
        { message: "Invalid date format for week start date. Please use YYYY-MM-DD format (e.g., 2024-01-15)" }
      )
      .refine(
        (val) => {
          const date = new Date(val);
          // Check if it's a Monday (0 = Sunday, 1 = Monday)
          return date.getDay() === 1;
        },
        { message: "Week start date must be a Monday (start of the work week)" }
      ),
  }),
});

// Create timesheet with both clock-in and clock-out validation
export const createTimesheetWithClockDataSchema = z.object({
  body: z.object({
    employeeId: z
      .number()
      .int("Employee ID must be a whole number")
      .positive("Employee ID is required and must be a positive number"),
    clockInDate: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)",
      }),
    clockInTime: z
      .string()
      .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: "Invalid time format. Please use HH:MM in 24-hour format (e.g., 08:30 or 14:45)",
      }),
    clockOutDate: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)",
      })
      .optional(),
    clockOutTime: z
      .string()
      .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: "Invalid time format. Please use HH:MM in 24-hour format (e.g., 17:30 or 22:15)",
      })
      .optional(),
    jobIds: z.array(uuidSchema).optional(),
    notes: z.string().optional(),
    breakMinutes: z
      .union([z.number().int(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number().int("Break minutes must be a whole number").nonnegative("Break minutes cannot be negative"))
      .optional(),
  }).refine(
    (data) => {
      // If clockOutDate is provided, clockOutTime must also be provided and vice versa
      const hasClockOutDate = !!data.clockOutDate;
      const hasClockOutTime = !!data.clockOutTime;
      return hasClockOutDate === hasClockOutTime;
    },
    {
      message: "Both clockOutDate and clockOutTime must be provided together, or both omitted",
      path: ["clockOutTime"],
    }
  ),
});