import { z } from "zod";

const uuidSchema = z.string().uuid({ message: "Invalid UUID format" });

// Get employees query validation
export const getEmployeesQuerySchema = z.object({
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

// Get employee by ID validation
export const getEmployeeByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid employee ID")),
  }),
});

// Create employee validation
export const createEmployeeSchema = z.object({
  body: z.object({
    userId: uuidSchema,
    employeeId: z
      .string()
      .max(50, "Employee ID must be less than 50 characters")
      .optional(),
    departmentId: z.number().int().positive().optional().nullable(),
    positionId: z.number().int().positive().optional().nullable(),
    reportsTo: uuidSchema.optional().nullable(),
    startDate: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid date format",
      }),
  }),
});

// Update employee validation
export const updateEmployeeSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid employee ID")),
  }),
  body: z
    .object({
      userId: uuidSchema.optional(),
      employeeId: z
        .string()
        .max(50, "Employee ID must be less than 50 characters")
        .optional(),
      departmentId: z.number().int().positive().optional().nullable(),
      positionId: z.number().int().positive().optional().nullable(),
      reportsTo: uuidSchema.optional().nullable(),
    })
    .refine(
      (data) =>
        data.userId !== undefined ||
        data.employeeId !== undefined ||
        data.departmentId !== undefined ||
        data.positionId !== undefined ||
        data.reportsTo !== undefined,
      {
        message:
          "At least one field (userId, employeeId, departmentId, positionId, or reportsTo) is required",
      }
    ),
});

// Delete employee validation
export const deleteEmployeeSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid employee ID")),
  }),
});

