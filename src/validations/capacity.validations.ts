import { z } from "zod";

// Dashboard KPIs validation
export const getDashboardKPIsQuerySchema = z.object({
  date: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)" }
  ),
});

// Utilization metrics validation
export const getUtilizationMetricsQuerySchema = z.object({
  startDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid start date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)" }
  ),
  endDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid end date format. Please use YYYY-MM-DD format (e.g., 2024-01-31)" }
  ),
  departmentId: z.string().optional().refine(
    (val) => !val || !isNaN(parseInt(val)),
    { message: "Department ID must be a valid number" }
  ),
  periodType: z.enum(['daily', 'weekly', 'monthly', 'quarterly'], {
    message: "Period type must be one of: daily, weekly, monthly, or quarterly"
  }).optional().default('monthly'),
});

// Chart data validation
export const getUtilizationChartDataQuerySchema = z.object({
  startDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid start date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)" }
  ),
  endDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid end date format. Please use YYYY-MM-DD format (e.g., 2024-01-31)" }
  ),
  periodType: z.enum(['daily', 'weekly', 'monthly', 'quarterly'], {
    message: "Period type must be one of: daily, weekly, monthly, or quarterly"
  }).optional().default('monthly'),
  departmentId: z.string().optional().refine(
    (val) => !val || !isNaN(parseInt(val)),
    { message: "Department ID must be a valid number" }
  ),
});

// Coverage by team validation
export const getCoverageByTeamQuerySchema = z.object({
  date: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)" }
  ),
});

// Employee availability validation
export const getEmployeeAvailabilityQuerySchema = z.object({
  status: z.enum(['available', 'on_job', 'break', 'pto', 'sick', 'off_shift', 'suspended'], {
    message: "Status must be one of: available, on_job, break, pto, sick, off_shift, or suspended"
  }).optional(),
  departmentId: z.string().optional().refine(
    (val) => !val || !isNaN(parseInt(val)),
    { message: "Department ID must be a valid number" }
  ),
  page: z.string().optional().default('1').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0,
    { message: "Page number must be a positive number" }
  ),
  limit: z.string().optional().default('10').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0 && parseInt(val) <= 100,
    { message: "Limit must be between 1 and 100" }
  ),
});

export const updateEmployeeAvailabilitySchema = z.object({
  currentStatus: z.enum(['available', 'on_job', 'break', 'pto', 'sick', 'off_shift', 'suspended'], {
    message: "Status must be one of: available, on_job, break, pto, sick, off_shift, or suspended"
  }),
  location: z
    .string()
    .max(255, "Location is too long (maximum 255 characters)")
    .optional(),
  expectedAvailableTime: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid expected available time format. Please use ISO 8601 format (e.g., 2024-01-15T14:30:00Z)" }
  ),
  currentJobId: z
    .string()
    .uuid("Job ID must be a valid UUID")
    .optional()
    .nullable(),
  currentTaskDescription: z
    .string()
    .max(1000, "Task description is too long (maximum 1000 characters)")
    .optional(),
});

// Resource allocations validation
export const getResourceAllocationsQuerySchema = z.object({
  startDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid start date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)" }
  ),
  endDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid end date format. Please use YYYY-MM-DD format (e.g., 2024-01-31)" }
  ),
  employeeId: z.string().optional().refine(
    (val) => !val || !isNaN(parseInt(val)),
    { message: "Employee ID must be a valid number" }
  ),
  jobId: z
    .string()
    .uuid("Job ID must be a valid UUID")
    .optional(),
  status: z.enum(['planned', 'assigned', 'in_progress', 'completed', 'cancelled'], {
    message: "Status must be one of: planned, assigned, in_progress, completed, or cancelled"
  }).optional(),
  priority: z.string().optional().refine(
    (val) => !val || (!isNaN(parseInt(val)) && parseInt(val) >= 1 && parseInt(val) <= 4),
    { message: "Priority must be between 1 (highest) and 4 (lowest)" }
  ),
  page: z.string().optional().default('1').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0,
    { message: "Page number must be a positive number" }
  ),
  limit: z.string().optional().default('10').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0 && parseInt(val) <= 100,
    { message: "Limit must be between 1 and 100" }
  ),
});

export const createResourceAllocationSchema = z.object({
  employeeId: z
    .number()
    .int("Employee ID must be a whole number")
    .positive("Employee ID is required and must be a positive number"),
  jobId: z
    .string()
    .uuid("Job ID must be a valid UUID")
    .optional()
    .nullable(),
  taskId: z
    .string()
    .uuid("Task ID must be a valid UUID")
    .optional()
    .nullable(),
  plannedStartTime: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid planned start time format. Please use ISO 8601 format (e.g., 2024-01-15T08:00:00Z)" }
  ),
  plannedEndTime: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid planned end time format. Please use ISO 8601 format (e.g., 2024-01-15T17:00:00Z)" }
  ),
  plannedHours: z
    .number()
    .positive("Planned hours must be a positive number"),
  priority: z
    .number()
    .int("Priority must be a whole number")
    .min(1, "Priority must be between 1 (highest) and 4 (lowest)")
    .max(4, "Priority must be between 1 (highest) and 4 (lowest)")
    .optional()
    .default(3),
  notes: z
    .string()
    .max(1000, "Notes are too long (maximum 1000 characters)")
    .optional(),
}).refine(
  (data) => new Date(data.plannedEndTime) > new Date(data.plannedStartTime),
  {
    message: "Planned end time must be after the planned start time",
    path: ["plannedEndTime"],
  }
);

export const updateResourceAllocationSchema = z.object({
  plannedStartTime: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid planned start time format. Please use ISO 8601 format (e.g., 2024-01-15T08:00:00Z)" }
  ),
  plannedEndTime: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid planned end time format. Please use ISO 8601 format (e.g., 2024-01-15T17:00:00Z)" }
  ),
  plannedHours: z
    .number()
    .positive("Planned hours must be a positive number")
    .optional(),
  actualStartTime: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid actual start time format. Please use ISO 8601 format (e.g., 2024-01-15T08:00:00Z)" }
  ),
  actualEndTime: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid actual end time format. Please use ISO 8601 format (e.g., 2024-01-15T17:00:00Z)" }
  ),
  actualHours: z
    .number()
    .positive("Actual hours must be a positive number")
    .optional(),
  status: z.enum(['planned', 'assigned', 'in_progress', 'completed', 'cancelled'], {
    message: "Status must be one of: planned, assigned, in_progress, completed, or cancelled"
  }).optional(),
  priority: z
    .number()
    .int("Priority must be a whole number")
    .min(1, "Priority must be between 1 (highest) and 4 (lowest)")
    .max(4, "Priority must be between 1 (highest) and 4 (lowest)")
    .optional(),
  notes: z
    .string()
    .max(1000, "Notes are too long (maximum 1000 characters)")
    .optional(),
});

// Employee shifts validation
export const getEmployeeShiftsQuerySchema = z.object({
  startDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid start date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)" }
  ),
  endDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid end date format. Please use YYYY-MM-DD format (e.g., 2024-01-31)" }
  ),
  employeeId: z.string().optional().refine(
    (val) => !val || !isNaN(parseInt(val)),
    { message: "Employee ID must be a valid number" }
  ),
  departmentId: z.string().optional().refine(
    (val) => !val || !isNaN(parseInt(val)),
    { message: "Department ID must be a valid number" }
  ),
  isActive: z.string().optional().refine(
    (val) => !val || val === 'true' || val === 'false',
    { message: "isActive must be true or false" }
  ),
  page: z.string().optional().default('1').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0,
    { message: "Page number must be a positive number" }
  ),
  limit: z.string().optional().default('10').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0 && parseInt(val) <= 100,
    { message: "Limit must be between 1 and 100" }
  ),
});

export const createEmployeeShiftSchema = z.object({
  employeeId: z
    .number()
    .int("Employee ID must be a whole number")
    .positive("Employee ID is required and must be a positive number"),
  shiftDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid shift date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)" }
  ),
  shiftStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Invalid shift start time. Please use HH:MM format in 24-hour time (e.g., 08:00 or 14:30)"
  }),
  shiftEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Invalid shift end time. Please use HH:MM format in 24-hour time (e.g., 17:00 or 22:30)"
  }),
  shiftType: z.enum(['regular', 'overtime', 'on_call', 'emergency'], {
    message: "Shift type must be one of: regular, overtime, on_call, or emergency"
  }).optional().default('regular'),
  plannedHours: z
    .number()
    .positive("Planned hours must be a positive number")
    .max(24, "Planned hours cannot exceed 24 hours in a day")
    .optional()
    .default(8.00),
  availableHours: z
    .number()
    .positive("Available hours must be a positive number")
    .max(24, "Available hours cannot exceed 24 hours in a day")
    .optional()
    .default(8.00),
  breakMinutes: z
    .number()
    .int("Break minutes must be a whole number")
    .min(0, "Break minutes cannot be negative")
    .max(480, "Break minutes cannot exceed 8 hours (480 minutes)")
    .optional()
    .default(0),
  notes: z
    .string()
    .max(1000, "Notes are too long (maximum 1000 characters)")
    .optional(),
}).refine(
  (data) => data.shiftEnd > data.shiftStart,
  {
    message: "Shift end time must be after shift start time",
    path: ["shiftEnd"],
  }
).refine(
  (data) => data.availableHours <= data.plannedHours,
  {
    message: "Available hours cannot exceed planned hours",
    path: ["availableHours"],
  }
);

export const updateEmployeeShiftSchema = z.object({
  shiftDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid shift date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)" }
  ),
  shiftStart: z.string().optional().refine(
    (val) => !val || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val),
    { message: "Invalid shift start time. Please use HH:MM format in 24-hour time (e.g., 08:00)" }
  ),
  shiftEnd: z.string().optional().refine(
    (val) => !val || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val),
    { message: "Invalid shift end time. Please use HH:MM format in 24-hour time (e.g., 17:00)" }
  ),
  shiftType: z.enum(['regular', 'overtime', 'on_call', 'emergency'], {
    message: "Shift type must be one of: regular, overtime, on_call, or emergency"
  }).optional(),
  plannedHours: z
    .number()
    .positive("Planned hours must be a positive number")
    .max(24, "Planned hours cannot exceed 24 hours in a day")
    .optional(),
  availableHours: z
    .number()
    .positive("Available hours must be a positive number")
    .max(24, "Available hours cannot exceed 24 hours in a day")
    .optional(),
  breakMinutes: z
    .number()
    .int("Break minutes must be a whole number")
    .min(0, "Break minutes cannot be negative")
    .max(480, "Break minutes cannot exceed 8 hours (480 minutes)")
    .optional(),
  isActive: z.boolean().optional(),
  notes: z
    .string()
    .max(1000, "Notes are too long (maximum 1000 characters)")
    .optional(),
});

// Department capacity overview validation
export const getDepartmentCapacityOverviewQuerySchema = z.object({
  startDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid start date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)" }
  ),
  endDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid end date format. Please use YYYY-MM-DD format (e.g., 2024-01-31)" }
  ),
  periodType: z.enum(['daily', 'weekly', 'monthly', 'quarterly'], {
    message: "Period type must be one of: daily, weekly, monthly, or quarterly"
  }).optional().default('daily'),
});

// Capacity planning templates validation
export const getCapacityPlanningTemplatesQuerySchema = z.object({
  departmentId: z.string().optional().refine(
    (val) => !val || !isNaN(parseInt(val)),
    { message: "Department ID must be a valid number" }
  ),
  isActive: z.string().optional().refine(
    (val) => !val || val === 'true' || val === 'false',
    { message: "isActive must be true or false" }
  ),
  page: z.string().optional().default('1').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0,
    { message: "Page number must be a positive number" }
  ),
  limit: z.string().optional().default('10').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0 && parseInt(val) <= 100,
    { message: "Limit must be between 1 and 100" }
  ),
});

export const createCapacityPlanningTemplateSchema = z.object({
  name: z
    .string()
    .min(1, "Template name is required and cannot be empty")
    .max(100, "Template name is too long (maximum 100 characters)")
    .trim(),
  description: z
    .string()
    .max(1000, "Description is too long (maximum 1000 characters)")
    .optional(),
  departmentId: z
    .number()
    .int("Department ID must be a whole number")
    .positive("Department ID must be a positive number")
    .optional(),
  dayOfWeek: z
    .number()
    .int("Day of week must be a whole number")
    .min(0, "Day of week must be between 0 (Sunday) and 6 (Saturday)")
    .max(6, "Day of week must be between 0 (Sunday) and 6 (Saturday)")
    .optional()
    .nullable(),
  shiftStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Invalid shift start time. Please use HH:MM format in 24-hour time (e.g., 08:00)"
  }),
  shiftEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Invalid shift end time. Please use HH:MM format in 24-hour time (e.g., 17:00)"
  }),
  plannedHours: z
    .number()
    .positive("Planned hours must be a positive number")
    .max(24, "Planned hours cannot exceed 24 hours in a day"),
  minEmployees: z
    .number()
    .int("Minimum employees must be a whole number")
    .positive("Minimum employees must be at least 1")
    .optional()
    .default(1),
  maxEmployees: z
    .number()
    .int("Maximum employees must be a whole number")
    .positive("Maximum employees must be a positive number")
    .optional(),
  requiredSkills: z.array(z.string()).optional(),
  effectiveFrom: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid effective from date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)" }
  ),
  effectiveTo: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid effective to date format. Please use YYYY-MM-DD format (e.g., 2024-12-31)" }
  ),
}).refine(
  (data) => data.shiftEnd > data.shiftStart,
  {
    message: "Shift end time must be after shift start time",
    path: ["shiftEnd"],
  }
).refine(
  (data) => !data.maxEmployees || data.maxEmployees >= data.minEmployees,
  {
    message: "Maximum employees must be greater than or equal to minimum employees",
    path: ["maxEmployees"],
  }
).refine(
  (data) => !data.effectiveTo || new Date(data.effectiveTo) >= new Date(data.effectiveFrom),
  {
    message: "Effective to date must be on or after the effective from date",
    path: ["effectiveTo"],
  }
);
