import { z } from "zod";

const uuidSchema = z.string().uuid({ message: "Invalid UUID format" });

// Get payroll dashboard query validation
export const getPayrollDashboardQuerySchema = z.object({
  query: z.object({
    organizationId: uuidSchema,
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
    regularHours: z.number().min(0).max(168), // Max 168 hours per week
    overtimeHours: z.number().min(0).max(168).default(0),
    doubleOvertimeHours: z.number().min(0).max(168).default(0),
    ptoHours: z.number().min(0).max(168).default(0),
    sickHours: z.number().min(0).max(168).default(0),
    holidayHours: z.number().min(0).max(168).default(0),

    // Pay rates
    hourlyRate: z.number().positive(),
    overtimeMultiplier: z.number().positive().default(1.5),
    doubleOvertimeMultiplier: z.number().positive().default(2.0),
    holidayMultiplier: z.number().positive().default(1.5),

    // Bonuses
    bonuses: z.number().min(0).default(0),

    // Payment details
    paymentMethod: z
      .enum(["direct_deposit", "check", "cash", "wire_transfer"])
      .default("direct_deposit"),
    bankAccountId: uuidSchema.optional(),
    checkNumber: z.string().max(50).optional(),

    // Scheduling
    scheduledDate: z.string().date().optional(),

    // Notes
    notes: z.string().max(1000).optional(),
  }),
});

// Update payroll entry validation
export const updatePayrollEntrySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    // Hours data
    regularHours: z.number().min(0).max(168).optional(),
    overtimeHours: z.number().min(0).max(168).optional(),
    doubleOvertimeHours: z.number().min(0).max(168).optional(),
    ptoHours: z.number().min(0).max(168).optional(),
    sickHours: z.number().min(0).max(168).optional(),
    holidayHours: z.number().min(0).max(168).optional(),

    // Pay rates
    hourlyRate: z.number().positive().optional(),
    overtimeMultiplier: z.number().positive().optional(),
    doubleOvertimeMultiplier: z.number().positive().optional(),
    holidayMultiplier: z.number().positive().optional(),

    // Bonuses
    bonuses: z.number().min(0).optional(),

    // Payment details
    paymentMethod: z
      .enum(["direct_deposit", "check", "cash", "wire_transfer"])
      .optional(),
    bankAccountId: uuidSchema.optional(),
    checkNumber: z.string().max(50).optional(),

    // Scheduling
    scheduledDate: z.string().date().optional(),

    // Notes
    notes: z.string().max(1000).optional(),
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
    notes: z.string().max(500).optional(),
  }),
});

// Reject payroll entry validation
export const rejectPayrollEntrySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    reason: z.string().min(1).max(500),
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
    runType: z.enum(["regular", "bonus", "correction"]).default("regular"),
    notes: z.string().max(1000).optional(),
  }),
});

// Process payroll run validation
export const processPayrollRunSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});


