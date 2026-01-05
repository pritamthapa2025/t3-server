import { z } from "zod";

const uuidSchema = z.string().uuid({ message: "Invalid ID format - must be a valid UUID" });

// Get payroll dashboard query validation (T3 internal - no organizationId needed)
export const getPayrollDashboardQuerySchema = z.object({
  query: z.object({
    payPeriodId: uuidSchema.optional(),
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
  }),
});

// Get payroll entries query validation
export const getPayrollEntriesQuerySchema = z.object({
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
    organizationId: uuidSchema,
    payPeriodId: uuidSchema.optional(),
    status: z
      .enum([
        "draft",
        "pending_approval",
        "approved",
        "processed",
        "paid",
        "failed",
        "cancelled",
      ])
      .optional(),
    employeeId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive().optional()),
  }),
});

// Get payroll entry by ID validation
export const getPayrollEntryByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Create payroll entry validation
export const createPayrollEntrySchema = z.object({
  body: z.object({
    organizationId: uuidSchema,
    payrollRunId: uuidSchema,
    employeeId: z.number().int().positive(),
    
    // Hours data
    regularHours: z
      .number()
      .min(0, "Regular hours cannot be negative")
      .max(168, "Regular hours cannot exceed 168 hours (1 week)"),
    overtimeHours: z
      .number()
      .min(0, "Overtime hours cannot be negative")
      .max(168, "Overtime hours cannot exceed 168 hours (1 week)")
      .default(0),
    doubleOvertimeHours: z
      .number()
      .min(0, "Double overtime hours cannot be negative")
      .max(168, "Double overtime hours cannot exceed 168 hours (1 week)")
      .default(0),
    ptoHours: z
      .number()
      .min(0, "PTO hours cannot be negative")
      .max(168, "PTO hours cannot exceed 168 hours (1 week)")
      .default(0),
    sickHours: z
      .number()
      .min(0, "Sick hours cannot be negative")
      .max(168, "Sick hours cannot exceed 168 hours (1 week)")
      .default(0),
    holidayHours: z
      .number()
      .min(0, "Holiday hours cannot be negative")
      .max(168, "Holiday hours cannot exceed 168 hours (1 week)")
      .default(0),

    // Pay rates
    hourlyRate: z
      .number()
      .positive("Hourly rate must be a positive number"),
    overtimeMultiplier: z
      .number()
      .positive("Overtime multiplier must be a positive number (e.g., 1.5 for time-and-a-half)")
      .default(1.5),
    doubleOvertimeMultiplier: z
      .number()
      .positive("Double overtime multiplier must be a positive number (e.g., 2.0 for double-time)")
      .default(2.0),
    holidayMultiplier: z
      .number()
      .positive("Holiday multiplier must be a positive number (e.g., 1.5)")
      .default(1.5),

    // Bonuses
    bonuses: z
      .number()
      .min(0, "Bonuses cannot be negative")
      .default(0),

    // Payment details
    paymentMethod: z
      .enum(["direct_deposit", "check", "cash", "wire_transfer"], {
        message: "Payment method must be one of: direct_deposit, check, cash, or wire_transfer"
      })
      .default("direct_deposit"),
    bankAccountId: uuidSchema.optional(),
    checkNumber: z
      .string()
      .max(50, "Check number is too long (maximum 50 characters)")
      .optional(),

    // Scheduling
    scheduledDate: z
      .string()
      .date("Invalid scheduled date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)")
      .optional(),

    // Notes
    notes: z
      .string()
      .max(1000, "Notes are too long (maximum 1000 characters)")
      .optional(),
  }),
});

// Update payroll entry validation
export const updatePayrollEntrySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    // Hours data
    regularHours: z
      .number()
      .min(0, "Regular hours cannot be negative")
      .max(168, "Regular hours cannot exceed 168 hours (1 week)")
      .optional(),
    overtimeHours: z
      .number()
      .min(0, "Overtime hours cannot be negative")
      .max(168, "Overtime hours cannot exceed 168 hours (1 week)")
      .optional(),
    doubleOvertimeHours: z
      .number()
      .min(0, "Double overtime hours cannot be negative")
      .max(168, "Double overtime hours cannot exceed 168 hours (1 week)")
      .optional(),
    ptoHours: z
      .number()
      .min(0, "PTO hours cannot be negative")
      .max(168, "PTO hours cannot exceed 168 hours (1 week)")
      .optional(),
    sickHours: z
      .number()
      .min(0, "Sick hours cannot be negative")
      .max(168, "Sick hours cannot exceed 168 hours (1 week)")
      .optional(),
    holidayHours: z
      .number()
      .min(0, "Holiday hours cannot be negative")
      .max(168, "Holiday hours cannot exceed 168 hours (1 week)")
      .optional(),

    // Pay rates
    hourlyRate: z
      .number()
      .positive("Hourly rate must be a positive number")
      .optional(),
    overtimeMultiplier: z
      .number()
      .positive("Overtime multiplier must be a positive number")
      .optional(),
    doubleOvertimeMultiplier: z
      .number()
      .positive("Double overtime multiplier must be a positive number")
      .optional(),
    holidayMultiplier: z
      .number()
      .positive("Holiday multiplier must be a positive number")
      .optional(),

    // Bonuses
    bonuses: z
      .number()
      .min(0, "Bonuses cannot be negative")
      .optional(),

    // Payment details
    paymentMethod: z
      .enum(["direct_deposit", "check", "cash", "wire_transfer"], {
        message: "Payment method must be one of: direct_deposit, check, cash, or wire_transfer"
      })
      .optional(),
    bankAccountId: uuidSchema.optional(),
    checkNumber: z
      .string()
      .max(50, "Check number is too long (maximum 50 characters)")
      .optional(),

    // Scheduling
    scheduledDate: z
      .string()
      .date("Invalid scheduled date format. Please use YYYY-MM-DD format")
      .optional(),

    // Notes
    notes: z
      .string()
      .max(1000, "Notes are too long (maximum 1000 characters)")
      .optional(),
  }),
});

// Delete payroll entry validation
export const deletePayrollEntrySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Approve payroll entry validation
export const approvePayrollEntrySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    notes: z
      .string()
      .max(500, "Notes are too long (maximum 500 characters)")
      .optional(),
  }),
});

// Reject payroll entry validation
export const rejectPayrollEntrySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    reason: z
      .string()
      .min(1, "Rejection reason is required and cannot be empty")
      .max(500, "Rejection reason is too long (maximum 500 characters)"),
  }),
});

// Get payroll runs query validation
export const getPayrollRunsQuerySchema = z.object({
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
    organizationId: uuidSchema,
    status: z
      .enum([
        "draft",
        "pending_approval",
        "approved",
        "processed",
        "paid",
        "failed",
        "cancelled",
      ])
      .optional(),
  }),
});

// Get payroll run by ID validation
export const getPayrollRunByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Create payroll run validation
export const createPayrollRunSchema = z.object({
  body: z.object({
    organizationId: uuidSchema,
    payPeriodId: uuidSchema,
    runType: z.enum(["regular", "bonus", "correction"], {
      message: "Run type must be one of: regular, bonus, or correction"
    }).default("regular"),
    notes: z
      .string()
      .max(1000, "Notes are too long (maximum 1000 characters)")
      .optional(),
  }),
});

// Process payroll run validation
export const processPayrollRunSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});




