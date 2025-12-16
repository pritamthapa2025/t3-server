import { z } from "zod";

const uuidSchema = z.string().uuid({ message: "Invalid UUID format" });

// Get timesheets query validation
export const getTimesheetsQuerySchema = z.object({
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
  }),
});

// Get timesheets by employee query validation
export const getTimesheetsByEmployeeQuerySchema = z.object({
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
    employeeId: z.string().optional(), // Filter by specific employee ID (e.g., "T3-00001")
    dateFrom: z
      .string()
      .optional()
      .refine(
        (val) => !val || !isNaN(new Date(val).getTime()),
        { message: "Invalid date format for dateFrom" }
      ),
    dateTo: z
      .string()
      .optional()
      .refine(
        (val) => !val || !isNaN(new Date(val).getTime()),
        { message: "Invalid date format for dateTo" }
      ),
  }).refine(
    (data) => {
      if (data.dateFrom && data.dateTo) {
        return new Date(data.dateFrom) <= new Date(data.dateTo);
      }
      return true;
    },
    {
      message: "dateFrom must be before or equal to dateTo",
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
      .pipe(z.number().int().positive("Invalid timesheet ID")),
  }),
});

// Create timesheet validation
export const createTimesheetSchema = z.object({
  body: z.object({
    employeeId: z.number().int().positive("Employee ID is required"),
    sheetDate: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid date format",
      }),
    clockIn: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid datetime format",
      }),
    clockOut: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid datetime format",
      })
      .optional(), // Now optional since employees can create timesheet without clock-out
    breakMinutes: z
      .union([z.number().int(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number().int().nonnegative())
      .optional(),
    totalHours: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
      .pipe(z.number().nonnegative())
      .optional(),
    overtimeHours: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
      .pipe(z.number().nonnegative())
      .optional(),
    notes: z.string().optional(),
    status: z
      .enum(["pending", "submitted", "approved", "rejected"], {
        message:
          "Status must be one of: pending, submitted, approved, rejected",
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
      .pipe(z.number().int().positive("Invalid timesheet ID")),
  }),
  body: z
    .object({
      employeeId: z.number().int().positive().optional(),
      sheetDate: z
        .union([z.string(), z.date()])
        .transform((val) => (typeof val === "string" ? new Date(val) : val))
        .refine((val) => !isNaN(val.getTime()), {
          message: "Invalid date format",
        })
        .optional(),
      clockIn: z
        .union([z.string(), z.date()])
        .transform((val) => (typeof val === "string" ? new Date(val) : val))
        .refine((val) => !isNaN(val.getTime()), {
          message: "Invalid datetime format",
        })
        .optional(),
      clockOut: z
        .union([z.string(), z.date()])
        .transform((val) => (typeof val === "string" ? new Date(val) : val))
        .refine((val) => !isNaN(val.getTime()), {
          message: "Invalid datetime format",
        })
        .optional(),
      breakMinutes: z
        .union([z.number().int(), z.string()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .pipe(z.number().int().nonnegative())
        .optional(),
      totalHours: z
        .union([z.number(), z.string()])
        .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
        .pipe(z.number().nonnegative())
        .optional(),
      overtimeHours: z
        .union([z.number(), z.string()])
        .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
        .pipe(z.number().nonnegative())
        .optional(),
      notes: z.string().optional(),
      status: z
        .enum(["pending", "submitted", "approved", "rejected"], {
          message:
            "Status must be one of: pending, submitted, approved, rejected",
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
        message: "At least one field is required for update",
      }
    ),
});

// Clock-in validation
export const clockInSchema = z.object({
  body: z.object({
    employeeId: z.number().int().positive("Employee ID is required"),
    clockInDate: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid date format",
      }),
    clockInTime: z
      .string()
      .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: "Invalid time format. Expected HH:MM (24-hour format)",
      }),
    jobIds: z.array(uuidSchema).optional(), // Array of job IDs to assign
    notes: z.string().optional(),
  }),
});

// Clock-out validation
export const clockOutSchema = z.object({
  body: z.object({
    employeeId: z.number().int().positive("Employee ID is required"),
    clockOutDate: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid date format",
      }),
    clockOutTime: z
      .string()
      .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: "Invalid time format. Expected HH:MM (24-hour format)",
      }),
    jobIds: z.array(uuidSchema).optional(), // Array of job IDs to assign
    notes: z.string().optional(),
    breakMinutes: z
      .union([z.number().int(), z.string()])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
      .pipe(z.number().int().nonnegative())
      .optional(),
  }),
});

// Delete timesheet validation
export const deleteTimesheetSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid timesheet ID")),
  }),
});

// Approve timesheet validation
export const approveTimesheetSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid timesheet ID")),
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
      .pipe(z.number().int().positive("Invalid timesheet ID")),
  }),
  body: z.object({
    rejectedBy: uuidSchema,
    rejectionReason: z
      .string()
      .min(1, "Rejection reason is required")
      .max(500, "Rejection reason must be under 500 characters"),
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
        { message: "Invalid date format for weekStartDate. Expected YYYY-MM-DD" }
      )
      .refine(
        (val) => {
          const date = new Date(val);
          // Check if it's a Monday (0 = Sunday, 1 = Monday)
          return date.getDay() === 1;
        },
        { message: "weekStartDate must be a Monday" }
      ),
    search: z.string().optional(),
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
          if (!val) return true; // Optional field
          const date = new Date(val);
          return !isNaN(date.getTime());
        },
        { message: "Invalid date format for weekStartDate. Expected YYYY-MM-DD" }
      )
      .refine(
        (val) => {
          if (!val) return true; // Optional field
          const date = new Date(val);
          // Check if it's a Monday (0 = Sunday, 1 = Monday)
          return date.getDay() === 1;
        },
        { message: "weekStartDate must be a Monday" }
      ),
    search: z.string().optional(),
  }),
});
