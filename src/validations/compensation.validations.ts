import { z } from "zod";

const uuidSchema = z.string().uuid({ message: "Invalid ID format - must be a valid UUID" });

// Get employee compensations query validation
export const getEmployeeCompensationsQuerySchema = z.object({
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
    organizationId: uuidSchema,
    employeeId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive("Employee ID must be a valid positive number").optional()),
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
    employeeId: z
      .number()
      .int("Employee ID must be a whole number")
      .positive("Employee ID is required and must be a positive number"),
    organizationId: uuidSchema,
    
    // Pay structure
    baseSalary: z
      .number()
      .positive("Base salary must be a positive number")
      .optional(),
    hourlyRate: z
      .number()
      .positive("Hourly rate must be a positive number")
      .optional(),
    payType: z.enum(["hourly", "salary", "commission", "contract"], {
      message: "Pay type must be one of: hourly, salary, commission, or contract"
    }),
    payFrequency: z.enum(["weekly", "bi_weekly", "monthly", "semi_monthly"], {
      message: "Pay frequency must be one of: weekly, bi_weekly, monthly, or semi_monthly"
    }),

    // Overtime rules
    overtimeMultiplier: z
      .number()
      .positive("Overtime multiplier must be a positive number (e.g., 1.5 for time-and-a-half)")
      .default(1.5),
    doubleOvertimeMultiplier: z
      .number()
      .positive("Double overtime multiplier must be a positive number (e.g., 2.0 for double-time)")
      .default(2.0),
    overtimeThresholdDaily: z
      .number()
      .positive("Daily overtime threshold must be a positive number of hours (e.g., 8)")
      .default(8.0),
    overtimeThresholdWeekly: z
      .number()
      .positive("Weekly overtime threshold must be a positive number of hours (e.g., 40)")
      .default(40.0),

    // Holiday & PTO rules
    holidayMultiplier: z
      .number()
      .positive("Holiday pay multiplier must be a positive number (e.g., 1.5)")
      .default(1.5),
    ptoAccrualRate: z
      .number()
      .min(0, "PTO accrual rate cannot be negative")
      .optional(),
    sickAccrualRate: z
      .number()
      .min(0, "Sick leave accrual rate cannot be negative")
      .optional(),

    // Effective dates
    effectiveDate: z
      .string()
      .date("Invalid effective date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)"),
    endDate: z
      .string()
      .date("Invalid end date format. Please use YYYY-MM-DD format (e.g., 2024-12-31)")
      .optional(),

    // Notes
    notes: z
      .string()
      .max(1000, "Notes are too long (maximum 1000 characters)")
      .optional(),
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
      message: "Hourly pay type requires an hourly rate, and salary pay type requires a base salary",
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
    baseSalary: z
      .number()
      .positive("Base salary must be a positive number")
      .optional(),
    hourlyRate: z
      .number()
      .positive("Hourly rate must be a positive number")
      .optional(),
    payType: z.enum(["hourly", "salary", "commission", "contract"], {
      message: "Pay type must be one of: hourly, salary, commission, or contract"
    }).optional(),
    payFrequency: z.enum(["weekly", "bi_weekly", "monthly", "semi_monthly"], {
      message: "Pay frequency must be one of: weekly, bi_weekly, monthly, or semi_monthly"
    }).optional(),

    // Overtime rules
    overtimeMultiplier: z
      .number()
      .positive("Overtime multiplier must be a positive number")
      .optional(),
    doubleOvertimeMultiplier: z
      .number()
      .positive("Double overtime multiplier must be a positive number")
      .optional(),
    overtimeThresholdDaily: z
      .number()
      .positive("Daily overtime threshold must be a positive number of hours")
      .optional(),
    overtimeThresholdWeekly: z
      .number()
      .positive("Weekly overtime threshold must be a positive number of hours")
      .optional(),

    // Holiday & PTO rules
    holidayMultiplier: z
      .number()
      .positive("Holiday pay multiplier must be a positive number")
      .optional(),
    ptoAccrualRate: z
      .number()
      .min(0, "PTO accrual rate cannot be negative")
      .optional(),
    sickAccrualRate: z
      .number()
      .min(0, "Sick leave accrual rate cannot be negative")
      .optional(),

    // Effective dates
    effectiveDate: z
      .string()
      .date("Invalid effective date format. Please use YYYY-MM-DD format")
      .optional(),
    endDate: z
      .string()
      .date("Invalid end date format. Please use YYYY-MM-DD format")
      .optional(),

    // Status
    isActive: z.boolean().optional(),

    // Notes
    notes: z
      .string()
      .max(1000, "Notes are too long (maximum 1000 characters)")
      .optional(),
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
      .pipe(z.number().int().positive("Employee ID must be a valid positive number")),
  }),
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

// Get pay periods query validation
export const getPayPeriodsQuerySchema = z.object({
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
    organizationId: uuidSchema,
    frequency: z.enum(["weekly", "bi_weekly", "monthly", "semi_monthly"], {
      message: "Frequency must be one of: weekly, bi_weekly, monthly, or semi_monthly"
    }).optional(),
    year: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().min(2020, "Year must be 2020 or later").max(2030, "Year cannot be beyond 2030").optional()),
    status: z
      .enum([
        "draft",
        "pending_approval",
        "approved",
        "processed",
        "paid",
        "failed",
        "cancelled",
      ], {
        message: "Status must be one of: draft, pending_approval, approved, processed, paid, failed, or cancelled"
      })
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
    periodNumber: z
      .number()
      .int("Period number must be a whole number")
      .positive("Period number must be a positive number"),
    frequency: z.enum(["weekly", "bi_weekly", "monthly", "semi_monthly"], {
      message: "Frequency must be one of: weekly, bi_weekly, monthly, or semi_monthly"
    }),
    startDate: z
      .string()
      .date("Invalid start date format. Please use YYYY-MM-DD format (e.g., 2024-01-01)"),
    endDate: z
      .string()
      .date("Invalid end date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)"),
    payDate: z
      .string()
      .date("Invalid pay date format. Please use YYYY-MM-DD format (e.g., 2024-01-20)"),
    
    // Optional fields
    isHolidayPeriod: z.boolean().default(false),
    timesheetCutoffDate: z
      .string()
      .datetime("Invalid timesheet cutoff datetime format. Please use ISO 8601 format")
      .optional(),
    approvalDeadline: z
      .string()
      .datetime("Invalid approval deadline datetime format. Please use ISO 8601 format")
      .optional(),
    approvalWorkflow: z
      .enum([
        "manual",
        "auto_from_timesheet",
        "manager_approval_required",
        "executive_approval_required",
      ], {
        message: "Approval workflow must be one of: manual, auto_from_timesheet, manager_approval_required, or executive_approval_required"
      })
      .default("auto_from_timesheet"),
    timesheetCutoffEnforced: z.boolean().default(true),
    autoGenerateFromTimesheets: z.boolean().default(true),
    
    notes: z
      .string()
      .max(1000, "Notes are too long (maximum 1000 characters)")
      .optional(),
  }).refine(
    (data) => new Date(data.startDate) < new Date(data.endDate),
    {
      message: "Start date must be before the end date",
      path: ["endDate"],
    }
  ).refine(
    (data) => new Date(data.endDate) <= new Date(data.payDate),
    {
      message: "Pay date must be on or after the end date",
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
    periodNumber: z
      .number()
      .int("Period number must be a whole number")
      .positive("Period number must be a positive number")
      .optional(),
    frequency: z.enum(["weekly", "bi_weekly", "monthly", "semi_monthly"], {
      message: "Frequency must be one of: weekly, bi_weekly, monthly, or semi_monthly"
    }).optional(),
    startDate: z
      .string()
      .date("Invalid start date format. Please use YYYY-MM-DD format")
      .optional(),
    endDate: z
      .string()
      .date("Invalid end date format. Please use YYYY-MM-DD format")
      .optional(),
    payDate: z
      .string()
      .date("Invalid pay date format. Please use YYYY-MM-DD format")
      .optional(),
    
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
      ], {
        message: "Status must be one of: draft, pending_approval, approved, processed, paid, failed, or cancelled"
      })
      .optional(),
    
    // Optional fields
    isHolidayPeriod: z.boolean().optional(),
    timesheetCutoffDate: z
      .string()
      .datetime("Invalid timesheet cutoff datetime format. Please use ISO 8601 format")
      .optional(),
    approvalDeadline: z
      .string()
      .datetime("Invalid approval deadline datetime format. Please use ISO 8601 format")
      .optional(),
    approvalWorkflow: z
      .enum([
        "manual",
        "auto_from_timesheet",
        "manager_approval_required",
        "executive_approval_required",
      ], {
        message: "Approval workflow must be one of: manual, auto_from_timesheet, manager_approval_required, or executive_approval_required"
      })
      .optional(),
    timesheetCutoffEnforced: z.boolean().optional(),
    autoGenerateFromTimesheets: z.boolean().optional(),
    
    notes: z
      .string()
      .max(1000, "Notes are too long (maximum 1000 characters)")
      .optional(),
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
      .pipe(z.number().int().positive("Employee ID must be a valid positive number")),
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
    currentBalance: z
      .number()
      .min(0, "Current balance cannot be negative")
      .optional(),
    accrualRate: z
      .number()
      .min(0, "Accrual rate cannot be negative")
      .optional(),
    maxBalance: z
      .number()
      .min(0, "Maximum balance cannot be negative")
      .optional(),
    ytdAccrued: z
      .number()
      .min(0, "Year-to-date accrued cannot be negative")
      .optional(),
    ytdUsed: z
      .number()
      .min(0, "Year-to-date used cannot be negative")
      .optional(),
    balanceAsOfDate: z
      .string()
      .date("Invalid balance as of date format. Please use YYYY-MM-DD format")
      .optional(),
    lastAccrualDate: z
      .string()
      .date("Invalid last accrual date format. Please use YYYY-MM-DD format")
      .optional(),
  }),
});

// Get employee benefits query validation
export const getEmployeeBenefitsQuerySchema = z.object({
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
    employeeId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive("Employee ID must be a valid positive number").optional()),
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
      ], {
        message: "Benefit type must be one of: health_insurance, dental_insurance, vision_insurance, life_insurance, disability_insurance, retirement_401k, pto_accrual, sick_leave, holiday_pay, or other"
      })
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
    employeeId: z
      .number()
      .int("Employee ID must be a whole number")
      .positive("Employee ID is required and must be a positive number"),
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
    ], {
      message: "Benefit type must be one of: health_insurance, dental_insurance, vision_insurance, life_insurance, disability_insurance, retirement_401k, pto_accrual, sick_leave, holiday_pay, or other"
    }),
    
    planName: z
      .string()
      .max(255, "Plan name is too long (maximum 255 characters)")
      .optional(),
    description: z
      .string()
      .max(1000, "Description is too long (maximum 1000 characters)")
      .optional(),
    
    // Cost structure
    employeeContribution: z
      .number()
      .min(0, "Employee contribution cannot be negative")
      .default(0),
    employerContribution: z
      .number()
      .min(0, "Employer contribution cannot be negative")
      .default(0),
    isPercentage: z.boolean().default(false),
    coverageLevel: z
      .string()
      .max(50, "Coverage level is too long (maximum 50 characters)")
      .optional(),
    
    // Effective dates
    effectiveDate: z
      .string()
      .date("Invalid effective date format. Please use YYYY-MM-DD format (e.g., 2024-01-01)"),
    endDate: z
      .string()
      .date("Invalid end date format. Please use YYYY-MM-DD format (e.g., 2024-12-31)")
      .optional(),
  }).refine(
    (data) => {
      if (data.endDate) {
        return new Date(data.effectiveDate) < new Date(data.endDate);
      }
      return true;
    },
    {
      message: "Effective date must be before the end date",
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
      ], {
        message: "Benefit type must be one of: health_insurance, dental_insurance, vision_insurance, life_insurance, disability_insurance, retirement_401k, pto_accrual, sick_leave, holiday_pay, or other"
      })
      .optional(),
    
    planName: z
      .string()
      .max(255, "Plan name is too long (maximum 255 characters)")
      .optional(),
    description: z
      .string()
      .max(1000, "Description is too long (maximum 1000 characters)")
      .optional(),
    
    // Cost structure
    employeeContribution: z
      .number()
      .min(0, "Employee contribution cannot be negative")
      .optional(),
    employerContribution: z
      .number()
      .min(0, "Employer contribution cannot be negative")
      .optional(),
    isPercentage: z.boolean().optional(),
    coverageLevel: z
      .string()
      .max(50, "Coverage level is too long (maximum 50 characters)")
      .optional(),
    
    // Effective dates
    effectiveDate: z
      .string()
      .date("Invalid effective date format. Please use YYYY-MM-DD format")
      .optional(),
    endDate: z
      .string()
      .date("Invalid end date format. Please use YYYY-MM-DD format")
      .optional(),
    
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
