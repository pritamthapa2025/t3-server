import { z } from "zod";

const uuidSchema = z.string().uuid({ message: "Invalid UUID format" });

// Get employee compensations query validation
export const getEmployeeCompensationsQuerySchema = z.object({
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
    employeeId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive().optional()),
    isActive: z
      .string()
      .optional()
      .transform((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return undefined;
      })
      .pipe(z.boolean().optional()),
  }),
});

// Get employee compensation by ID validation
export const getEmployeeCompensationByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Create employee compensation validation
export const createEmployeeCompensationSchema = z.object({
  body: z.object({
    employeeId: z.number().int().positive(),
    organizationId: uuidSchema,
    
    // Pay structure
    baseSalary: z.number().positive().optional(),
    hourlyRate: z.number().positive().optional(),
    payType: z.enum(["hourly", "salary", "commission", "contract"]),
    payFrequency: z.enum(["weekly", "bi_weekly", "monthly", "semi_monthly"]),

    // Overtime rules
    overtimeMultiplier: z.number().positive().default(1.5),
    doubleOvertimeMultiplier: z.number().positive().default(2.0),
    overtimeThresholdDaily: z.number().positive().default(8.0),
    overtimeThresholdWeekly: z.number().positive().default(40.0),

    // Holiday & PTO rules
    holidayMultiplier: z.number().positive().default(1.5),
    ptoAccrualRate: z.number().min(0).optional(),
    sickAccrualRate: z.number().min(0).optional(),

    // Effective dates
    effectiveDate: z.string().date(),
    endDate: z.string().date().optional(),

    // Notes
    notes: z.string().max(1000).optional(),
  }).refine(
    (data) => {
      if (data.payType === "hourly" && !data.hourlyRate) {
        return false;
      }
      if (data.payType === "salary" && !data.baseSalary) {
        return false;
      }
      return true;
    },
    {
      message: "Hourly rate required for hourly pay type, base salary required for salary pay type",
      path: ["hourlyRate"],
    }
  ),
});

// Update employee compensation validation
export const updateEmployeeCompensationSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    // Pay structure
    baseSalary: z.number().positive().optional(),
    hourlyRate: z.number().positive().optional(),
    payType: z.enum(["hourly", "salary", "commission", "contract"]).optional(),
    payFrequency: z.enum(["weekly", "bi_weekly", "monthly", "semi_monthly"]).optional(),

    // Overtime rules
    overtimeMultiplier: z.number().positive().optional(),
    doubleOvertimeMultiplier: z.number().positive().optional(),
    overtimeThresholdDaily: z.number().positive().optional(),
    overtimeThresholdWeekly: z.number().positive().optional(),

    // Holiday & PTO rules
    holidayMultiplier: z.number().positive().optional(),
    ptoAccrualRate: z.number().min(0).optional(),
    sickAccrualRate: z.number().min(0).optional(),

    // Effective dates
    effectiveDate: z.string().date().optional(),
    endDate: z.string().date().optional(),

    // Status
    isActive: z.boolean().optional(),

    // Notes
    notes: z.string().max(1000).optional(),
  }),
});

// Delete employee compensation validation
export const deleteEmployeeCompensationSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Get employee compensation history validation
export const getEmployeeCompensationHistorySchema = z.object({
  params: z.object({
    employeeId: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid employee ID")),
  }),
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

// Get pay periods query validation
export const getPayPeriodsQuerySchema = z.object({
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
    organizationId: uuidSchema,
    frequency: z.enum(["weekly", "bi_weekly", "monthly", "semi_monthly"]).optional(),
    year: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().min(2020).max(2030).optional()),
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

// Get pay period by ID validation
export const getPayPeriodByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Create pay period validation
export const createPayPeriodSchema = z.object({
  body: z.object({
    organizationId: uuidSchema,
    periodNumber: z.number().int().positive(),
    frequency: z.enum(["weekly", "bi_weekly", "monthly", "semi_monthly"]),
    startDate: z.string().date(),
    endDate: z.string().date(),
    payDate: z.string().date(),
    
    // Optional fields
    isHolidayPeriod: z.boolean().default(false),
    timesheetCutoffDate: z.string().datetime().optional(),
    approvalDeadline: z.string().datetime().optional(),
    approvalWorkflow: z
      .enum([
        "manual",
        "auto_from_timesheet",
        "manager_approval_required",
        "executive_approval_required",
      ])
      .default("auto_from_timesheet"),
    timesheetCutoffEnforced: z.boolean().default(true),
    autoGenerateFromTimesheets: z.boolean().default(true),
    
    notes: z.string().max(1000).optional(),
  }).refine(
    (data) => new Date(data.startDate) < new Date(data.endDate),
    {
      message: "Start date must be before end date",
      path: ["endDate"],
    }
  ).refine(
    (data) => new Date(data.endDate) <= new Date(data.payDate),
    {
      message: "Pay date must be after end date",
      path: ["payDate"],
    }
  ),
});

// Update pay period validation
export const updatePayPeriodSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    periodNumber: z.number().int().positive().optional(),
    frequency: z.enum(["weekly", "bi_weekly", "monthly", "semi_monthly"]).optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    payDate: z.string().date().optional(),
    
    // Status controls
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
    
    // Optional fields
    isHolidayPeriod: z.boolean().optional(),
    timesheetCutoffDate: z.string().datetime().optional(),
    approvalDeadline: z.string().datetime().optional(),
    approvalWorkflow: z
      .enum([
        "manual",
        "auto_from_timesheet",
        "manager_approval_required",
        "executive_approval_required",
      ])
      .optional(),
    timesheetCutoffEnforced: z.boolean().optional(),
    autoGenerateFromTimesheets: z.boolean().optional(),
    
    notes: z.string().max(1000).optional(),
  }),
});

// Delete pay period validation
export const deletePayPeriodSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Get employee leave balances validation
export const getEmployeeLeaveBalancesSchema = z.object({
  params: z.object({
    employeeId: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid employee ID")),
  }),
  query: z.object({
    organizationId: uuidSchema,
  }),
});

// Update employee leave balance validation
export const updateEmployeeLeaveBalanceSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    currentBalance: z.number().min(0).optional(),
    accrualRate: z.number().min(0).optional(),
    maxBalance: z.number().min(0).optional(),
    ytdAccrued: z.number().min(0).optional(),
    ytdUsed: z.number().min(0).optional(),
    balanceAsOfDate: z.string().date().optional(),
    lastAccrualDate: z.string().date().optional(),
  }),
});

// Get employee benefits query validation
export const getEmployeeBenefitsQuerySchema = z.object({
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
    employeeId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive().optional()),
    organizationId: uuidSchema,
    benefitType: z
      .enum([
        "health_insurance",
        "dental_insurance",
        "vision_insurance",
        "life_insurance",
        "disability_insurance",
        "retirement_401k",
        "pto_accrual",
        "sick_leave",
        "holiday_pay",
        "other",
      ])
      .optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return undefined;
      })
      .pipe(z.boolean().optional()),
  }),
});

// Create employee benefit validation
export const createEmployeeBenefitSchema = z.object({
  body: z.object({
    employeeId: z.number().int().positive(),
    organizationId: uuidSchema,
    
    benefitType: z.enum([
      "health_insurance",
      "dental_insurance",
      "vision_insurance",
      "life_insurance",
      "disability_insurance",
      "retirement_401k",
      "pto_accrual",
      "sick_leave",
      "holiday_pay",
      "other",
    ]),
    
    planName: z.string().max(255).optional(),
    description: z.string().max(1000).optional(),
    
    // Cost structure
    employeeContribution: z.number().min(0).default(0),
    employerContribution: z.number().min(0).default(0),
    isPercentage: z.boolean().default(false),
    coverageLevel: z.string().max(50).optional(),
    
    // Effective dates
    effectiveDate: z.string().date(),
    endDate: z.string().date().optional(),
  }).refine(
    (data) => {
      if (data.endDate) {
        return new Date(data.effectiveDate) < new Date(data.endDate);
      }
      return true;
    },
    {
      message: "Effective date must be before end date",
      path: ["endDate"],
    }
  ),
});

// Update employee benefit validation
export const updateEmployeeBenefitSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    benefitType: z
      .enum([
        "health_insurance",
        "dental_insurance",
        "vision_insurance",
        "life_insurance",
        "disability_insurance",
        "retirement_401k",
        "pto_accrual",
        "sick_leave",
        "holiday_pay",
        "other",
      ])
      .optional(),
    
    planName: z.string().max(255).optional(),
    description: z.string().max(1000).optional(),
    
    // Cost structure
    employeeContribution: z.number().min(0).optional(),
    employerContribution: z.number().min(0).optional(),
    isPercentage: z.boolean().optional(),
    coverageLevel: z.string().max(50).optional(),
    
    // Effective dates
    effectiveDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    
    // Status
    isActive: z.boolean().optional(),
  }),
});

// Delete employee benefit validation
export const deleteEmployeeBenefitSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});



