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
      }),
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
    submittedBy: uuidSchema.optional().nullable(),
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
      submittedBy: uuidSchema.optional().nullable(),
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
        data.submittedBy !== undefined ||
        data.approvedBy !== undefined,
      {
        message: "At least one field is required for update",
      }
    ),
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
