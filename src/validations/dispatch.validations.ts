import { z } from "zod";

const uuidSchema = z
  .string()
  .uuid({ message: "Invalid ID format - must be a valid UUID" });

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
    status: z
      .enum(["pending", "assigned", "in_progress", "completed", "cancelled"])
      .optional(),
    taskType: z
      .enum(["service", "pm", "install", "emergency", "survey"])
      .optional(),
    priority: z.enum(["low", "medium", "high", "emergency"]).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    sortBy: z
      .enum(["createdAt", "startTime", "endTime", "priority"])
      .optional(),
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
    status: z
      .enum(["pending", "assigned", "in_progress", "completed", "cancelled"])
      .optional(),
    startTime: z.string(),
    endTime: z.string().optional(),
    estimatedDuration: z.number().int().positive().optional(),
    linkedJobTaskIds: z.array(uuidSchema).optional(),
    technicianIds: z.array(z.number().int().positive()).optional(),
    notes: z.string().optional(),
    attachments: z.array(z.string()).optional(),
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
    taskType: z
      .enum(["service", "pm", "install", "emergency", "survey"])
      .optional(),
    priority: z.enum(["low", "medium", "high", "emergency"]).optional(),
    status: z
      .enum(["pending", "assigned", "in_progress", "completed", "cancelled"])
      .optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    estimatedDuration: z.number().int().positive().optional(),
    linkedJobTaskIds: z.array(uuidSchema).optional(),
    technicianIds: z.array(z.number().int().positive()).optional(),
    notes: z.string().optional(),
    attachments: z.array(z.string()).optional(),
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
    sortBy: z.enum(["createdAt"]).optional(),
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
    actualDuration: z.number().int().positive().optional(),
    role: z.string().max(50).optional(),
  }),
});

// Log hours for a specific dispatch assignment (dispatch-driven time tracking)
export const logHoursForAssignmentSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z
    .object({
      timeIn: z.string().datetime({ message: "timeIn must be a valid ISO datetime" }),
      timeOut: z.string().datetime({ message: "timeOut must be a valid ISO datetime" }),
      actualHours: z.number().nonnegative("actualHours must be 0 or greater").optional(),
      logNotes: z.string().max(2000).optional(),
      breakTaken: z.boolean().optional(),
      breakStartTime: z
        .string()
        .datetime({ message: "breakStartTime must be a valid ISO datetime" })
        .optional(),
      breakMinutes: z
        .number()
        .int()
        .nonnegative("breakMinutes must be 0 or greater")
        .max(120, "breakMinutes cannot exceed 120")
        .optional(),
      mediaAttachments: z
        .array(
          z.object({
            url: z.string().url("Each attachment must have a valid URL"),
            label: z.string().max(255),
            uploadedAt: z.string().datetime(),
          }),
        )
        .max(20, "Maximum 20 media attachments per shift")
        .optional(),
    })
    .refine(
      (data) => {
        const start = new Date(data.timeIn);
        const end = new Date(data.timeOut);
        return end > start;
      },
      {
        message: "timeOut must be after timeIn",
        path: ["timeOut"],
      },
    )
    .refine(
      (data) => {
        if (data.breakTaken && data.breakStartTime) {
          const start = new Date(data.timeIn);
          const breakStart = new Date(data.breakStartTime);
          return breakStart >= start;
        }
        return true;
      },
      {
        message: "breakStartTime must be after or equal to timeIn",
        path: ["breakStartTime"],
      },
    ),
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
    technicianId: z
      .string()
      .transform(Number)
      .pipe(z.number().int().positive()),
  }),
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.enum(["pending", "started", "completed"]).optional(),
    jobId: z.string().uuid().optional(),
  }),
});

// Available employees for dispatch (employees with status = 'available')
export const getAvailableEmployeesQuerySchema = z.object({
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

// Employees with assigned dispatch tasks (tasks array per employee, empty if none)
export const getEmployeesWithAssignedTasksQuerySchema = z.object({
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
    status: z
      .enum([
        "available",
        "on_leave",
        "in_field",
        "terminated",
        "suspended",
        "active",
      ])
      .optional(),
  }),
});
