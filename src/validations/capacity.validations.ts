import { z } from "zod";

// Dashboard KPIs validation
export const getDashboardKPIsQuerySchema = z.object({
  date: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid date format" }
  ),
});

// Utilization metrics validation
export const getUtilizationMetricsQuerySchema = z.object({
  startDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid start date format" }
  ),
  endDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid end date format" }
  ),
  departmentId: z.string().optional().refine(
    (val) => !val || !isNaN(parseInt(val)),
    { message: "Department ID must be a number" }
  ),
  periodType: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional().default('monthly'),
});

// Chart data validation
export const getUtilizationChartDataQuerySchema = z.object({
  startDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid start date format" }
  ),
  endDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid end date format" }
  ),
  periodType: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional().default('monthly'),
  departmentId: z.string().optional().refine(
    (val) => !val || !isNaN(parseInt(val)),
    { message: "Department ID must be a number" }
  ),
});

// Coverage by team validation
export const getCoverageByTeamQuerySchema = z.object({
  date: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid date format" }
  ),
});

// Employee availability validation
export const getEmployeeAvailabilityQuerySchema = z.object({
  status: z.enum(['available', 'on_job', 'break', 'pto', 'sick', 'off_shift', 'suspended']).optional(),
  departmentId: z.string().optional().refine(
    (val) => !val || !isNaN(parseInt(val)),
    { message: "Department ID must be a number" }
  ),
  page: z.string().optional().default('1').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0,
    { message: "Page must be a positive number" }
  ),
  limit: z.string().optional().default('10').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0 && parseInt(val) <= 100,
    { message: "Limit must be between 1 and 100" }
  ),
});

export const updateEmployeeAvailabilitySchema = z.object({
  currentStatus: z.enum(['available', 'on_job', 'break', 'pto', 'sick', 'off_shift', 'suspended']),
  location: z.string().max(255).optional(),
  expectedAvailableTime: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid expected available time format" }
  ),
  currentJobId: z.string().uuid().optional().nullable(),
  currentTaskDescription: z.string().max(1000).optional(),
});

// Resource allocations validation
export const getResourceAllocationsQuerySchema = z.object({
  startDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid start date format" }
  ),
  endDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid end date format" }
  ),
  employeeId: z.string().optional().refine(
    (val) => !val || !isNaN(parseInt(val)),
    { message: "Employee ID must be a number" }
  ),
  jobId: z.string().uuid().optional(),
  status: z.enum(['planned', 'assigned', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.string().optional().refine(
    (val) => !val || (!isNaN(parseInt(val)) && parseInt(val) >= 1 && parseInt(val) <= 4),
    { message: "Priority must be between 1 and 4" }
  ),
  page: z.string().optional().default('1').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0,
    { message: "Page must be a positive number" }
  ),
  limit: z.string().optional().default('10').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0 && parseInt(val) <= 100,
    { message: "Limit must be between 1 and 100" }
  ),
});

export const createResourceAllocationSchema = z.object({
  employeeId: z.number().int().positive({ message: "Employee ID is required" }),
  jobId: z.string().uuid().optional().nullable(),
  taskId: z.string().uuid().optional().nullable(),
  plannedStartTime: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid planned start time format" }
  ),
  plannedEndTime: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid planned end time format" }
  ),
  plannedHours: z.number().positive({ message: "Planned hours must be positive" }),
  priority: z.number().int().min(1).max(4).optional().default(3),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => new Date(data.plannedEndTime) > new Date(data.plannedStartTime),
  {
    message: "Planned end time must be after start time",
    path: ["plannedEndTime"],
  }
);

export const updateResourceAllocationSchema = z.object({
  plannedStartTime: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid planned start time format" }
  ),
  plannedEndTime: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid planned end time format" }
  ),
  plannedHours: z.number().positive().optional(),
  actualStartTime: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid actual start time format" }
  ),
  actualEndTime: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid actual end time format" }
  ),
  actualHours: z.number().positive().optional(),
  status: z.enum(['planned', 'assigned', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  notes: z.string().max(1000).optional(),
});

// Employee shifts validation
export const getEmployeeShiftsQuerySchema = z.object({
  startDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid start date format" }
  ),
  endDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid end date format" }
  ),
  employeeId: z.string().optional().refine(
    (val) => !val || !isNaN(parseInt(val)),
    { message: "Employee ID must be a number" }
  ),
  departmentId: z.string().optional().refine(
    (val) => !val || !isNaN(parseInt(val)),
    { message: "Department ID must be a number" }
  ),
  isActive: z.string().optional().refine(
    (val) => !val || val === 'true' || val === 'false',
    { message: "isActive must be true or false" }
  ),
  page: z.string().optional().default('1').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0,
    { message: "Page must be a positive number" }
  ),
  limit: z.string().optional().default('10').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0 && parseInt(val) <= 100,
    { message: "Limit must be between 1 and 100" }
  ),
});

export const createEmployeeShiftSchema = z.object({
  employeeId: z.number().int().positive({ message: "Employee ID is required" }),
  shiftDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid shift date format" }
  ),
  shiftStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Invalid shift start time format (HH:MM)"
  }),
  shiftEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Invalid shift end time format (HH:MM)"
  }),
  shiftType: z.enum(['regular', 'overtime', 'on_call', 'emergency']).optional().default('regular'),
  plannedHours: z.number().positive().max(24).optional().default(8.00),
  availableHours: z.number().positive().max(24).optional().default(8.00),
  breakMinutes: z.number().int().min(0).max(480).optional().default(0),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => data.shiftEnd > data.shiftStart,
  {
    message: "Shift end time must be after start time",
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
    { message: "Invalid shift date format" }
  ),
  shiftStart: z.string().optional().refine(
    (val) => !val || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val),
    { message: "Invalid shift start time format (HH:MM)" }
  ),
  shiftEnd: z.string().optional().refine(
    (val) => !val || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val),
    { message: "Invalid shift end time format (HH:MM)" }
  ),
  shiftType: z.enum(['regular', 'overtime', 'on_call', 'emergency']).optional(),
  plannedHours: z.number().positive().max(24).optional(),
  availableHours: z.number().positive().max(24).optional(),
  breakMinutes: z.number().int().min(0).max(480).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
});

// Department capacity overview validation
export const getDepartmentCapacityOverviewQuerySchema = z.object({
  startDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid start date format" }
  ),
  endDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid end date format" }
  ),
  periodType: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional().default('daily'),
});

// Capacity planning templates validation
export const getCapacityPlanningTemplatesQuerySchema = z.object({
  departmentId: z.string().optional().refine(
    (val) => !val || !isNaN(parseInt(val)),
    { message: "Department ID must be a number" }
  ),
  isActive: z.string().optional().refine(
    (val) => !val || val === 'true' || val === 'false',
    { message: "isActive must be true or false" }
  ),
  page: z.string().optional().default('1').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0,
    { message: "Page must be a positive number" }
  ),
  limit: z.string().optional().default('10').refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0 && parseInt(val) <= 100,
    { message: "Limit must be between 1 and 100" }
  ),
});

export const createCapacityPlanningTemplateSchema = z.object({
  name: z.string().min(1).max(100, { message: "Name must be between 1 and 100 characters" }),
  description: z.string().max(1000).optional(),
  departmentId: z.number().int().positive().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(), // 0=Sunday, 6=Saturday, null=daily
  shiftStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Invalid shift start time format (HH:MM)"
  }),
  shiftEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Invalid shift end time format (HH:MM)"
  }),
  plannedHours: z.number().positive().max(24, { message: "Planned hours must be positive and max 24" }),
  minEmployees: z.number().int().positive().optional().default(1),
  maxEmployees: z.number().int().positive().optional(),
  requiredSkills: z.array(z.string()).optional(),
  effectiveFrom: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid effective from date format" }
  ),
  effectiveTo: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid effective to date format" }
  ),
}).refine(
  (data) => data.shiftEnd > data.shiftStart,
  {
    message: "Shift end time must be after start time",
    path: ["shiftEnd"],
  }
).refine(
  (data) => !data.maxEmployees || data.maxEmployees >= data.minEmployees,
  {
    message: "Max employees must be greater than or equal to min employees",
    path: ["maxEmployees"],
  }
).refine(
  (data) => !data.effectiveTo || new Date(data.effectiveTo) >= new Date(data.effectiveFrom),
  {
    message: "Effective to date must be after effective from date",
    path: ["effectiveTo"],
  }
);



