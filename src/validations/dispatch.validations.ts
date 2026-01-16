import { z } from "zod";

const uuidSchema = z.string().uuid({ message: "Invalid ID format - must be a valid UUID" });

// ============================
// Dispatch Tasks Validations
// ============================

export const getDispatchTasksQuerySchema = z.object({
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
    jobId: uuidSchema.optional(),
    status: z.enum(["pending", "assigned", "in_progress", "completed", "cancelled"]).optional(),
    taskType: z.enum(["service", "pm", "install", "emergency", "survey"]).optional(),
    priority: z.enum(["low", "medium", "high", "emergency"]).optional(),
    assignedVehicleId: uuidSchema.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    sortBy: z.enum(["createdAt", "startTime", "endTime", "priority"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const getDispatchTaskByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const createDispatchTaskSchema = z.object({
  body: z.object({
    jobId: uuidSchema,
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    taskType: z.enum(["service", "pm", "install", "emergency", "survey"]),
    priority: z.enum(["low", "medium", "high", "emergency"]).optional(),
    status: z.enum(["pending", "assigned", "in_progress", "completed", "cancelled"]).optional(),
    startTime: z.string().transform((str) => new Date(str)),
    endTime: z.string().transform((str) => new Date(str)),
    estimatedDuration: z.number().int().positive().optional(),
    linkedJobTaskIds: z.array(uuidSchema).optional(),
    notes: z.string().optional(),
    attachments: z.array(z.string()).optional(),
    assignedVehicleId: uuidSchema.optional(),
  }),
});

export const updateDispatchTaskSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    jobId: uuidSchema.optional(),
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    taskType: z.enum(["service", "pm", "install", "emergency", "survey"]).optional(),
    priority: z.enum(["low", "medium", "high", "emergency"]).optional(),
    status: z.enum(["pending", "assigned", "in_progress", "completed", "cancelled"]).optional(),
    startTime: z.string().transform((str) => new Date(str)).optional(),
    endTime: z.string().transform((str) => new Date(str)).optional(),
    estimatedDuration: z.number().int().positive().optional(),
    linkedJobTaskIds: z.array(uuidSchema).optional(),
    notes: z.string().optional(),
    attachments: z.array(z.string()).optional(),
    assignedVehicleId: uuidSchema.optional(),
  }),
});

export const deleteDispatchTaskSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ============================
// Dispatch Assignments Validations
// ============================

export const getDispatchAssignmentsQuerySchema = z.object({
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
    taskId: uuidSchema.optional(),
    technicianId: z.string().transform(Number).optional(),
    status: z.enum(["pending", "started", "completed"]).optional(),
    sortBy: z.enum(["createdAt", "clockIn"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const getDispatchAssignmentByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const createDispatchAssignmentSchema = z.object({
  body: z.object({
    taskId: uuidSchema,
    technicianId: z.number().int().positive(),
    status: z.enum(["pending", "started", "completed"]).optional(),
    clockIn: z.string().transform((str) => new Date(str)).optional(),
    clockOut: z.string().transform((str) => new Date(str)).optional(),
    actualDuration: z.number().int().positive().optional(),
    role: z.string().max(50).optional(),
  }),
});

export const updateDispatchAssignmentSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    taskId: uuidSchema.optional(),
    technicianId: z.number().int().positive().optional(),
    status: z.enum(["pending", "started", "completed"]).optional(),
    clockIn: z.string().transform((str) => new Date(str)).optional(),
    clockOut: z.string().transform((str) => new Date(str)).optional(),
    actualDuration: z.number().int().positive().optional(),
    role: z.string().max(50).optional(),
  }),
});

export const deleteDispatchAssignmentSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const getAssignmentsByTaskIdSchema = z.object({
  params: z.object({
    taskId: uuidSchema,
  }),
});

export const getAssignmentsByTechnicianIdSchema = z.object({
  params: z.object({
    technicianId: z.string().transform(Number).pipe(z.number().int().positive()),
  }),
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.enum(["pending", "started", "completed"]).optional(),
  }),
});

// ============================
// Technician Availability Validations
// ============================

export const getTechnicianAvailabilityQuerySchema = z.object({
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
    employeeId: z.string().transform(Number).optional(),
    date: z.string().optional(),
    status: z.enum(["available", "on_job", "off_shift", "break", "pto"]).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    sortBy: z.enum(["date", "createdAt"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const getTechnicianAvailabilityByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const createTechnicianAvailabilitySchema = z.object({
  body: z.object({
    employeeId: z.number().int().positive(),
    date: z.string().transform((str) => new Date(str)),
    status: z.enum(["available", "on_job", "off_shift", "break", "pto"]).optional(),
    shiftStart: z.string().max(8).optional(), // HH:MM:SS format
    shiftEnd: z.string().max(8).optional(), // HH:MM:SS format
    hoursScheduled: z.string().optional(),
    role: z.string().max(50).optional(),
    notes: z.string().optional(),
  }),
});

export const updateTechnicianAvailabilitySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    employeeId: z.number().int().positive().optional(),
    date: z.string().transform((str) => new Date(str)).optional(),
    status: z.enum(["available", "on_job", "off_shift", "break", "pto"]).optional(),
    shiftStart: z.string().max(8).optional(),
    shiftEnd: z.string().max(8).optional(),
    hoursScheduled: z.string().optional(),
    role: z.string().max(50).optional(),
    notes: z.string().optional(),
  }),
});

export const deleteTechnicianAvailabilitySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const getAvailabilityByEmployeeIdSchema = z.object({
  params: z.object({
    employeeId: z.string().transform(Number).pipe(z.number().int().positive()),
  }),
  query: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
});


