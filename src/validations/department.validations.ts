import { z } from "zod";

// Get departments query validation
export const getDepartmentsQuerySchema = z.object({
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

// Get department by ID validation
export const getDepartmentByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid department ID")),
  }),
});

// Create department validation
export const createDepartmentSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, "Department name is required")
      .max(100, "Department name must be less than 100 characters"),
    description: z
      .string()
      .max(1000, "Description must be less than 1000 characters")
      .optional(),
  }),
});

// Update department validation
export const updateDepartmentSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid department ID")),
  }),
  body: z
    .object({
      name: z
        .string()
        .min(1, "Department name cannot be empty")
        .max(100, "Department name must be less than 100 characters")
        .optional(),
      description: z
        .string()
        .max(1000, "Description must be less than 1000 characters")
        .optional(),
    })
    .refine(
      (data) => data.name !== undefined || data.description !== undefined,
      {
        message: "At least one field (name or description) is required",
      }
    ),
});

// Delete department validation
export const deleteDepartmentSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid department ID")),
  }),
});



