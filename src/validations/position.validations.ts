import { z } from "zod";

// Get positions query validation
export const getPositionsQuerySchema = z.object({
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

// Get position by ID validation
export const getPositionByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid position ID")),
  }),
});

// Create position validation
export const createPositionSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, "Position name is required")
      .max(100, "Position name must be less than 100 characters"),
    departmentId: z.number().int().positive().optional().nullable(),
    description: z
      .string()
      .max(1000, "Description must be less than 1000 characters")
      .optional(),
  }),
});

// Update position validation
export const updatePositionSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid position ID")),
  }),
  body: z
    .object({
      name: z
        .string()
        .min(1, "Position name cannot be empty")
        .max(100, "Position name must be less than 100 characters")
        .optional(),
      departmentId: z.number().int().positive().optional().nullable(),
      description: z
        .string()
        .max(1000, "Description must be less than 1000 characters")
        .optional(),
    })
    .refine(
      (data) =>
        data.name !== undefined ||
        data.departmentId !== undefined ||
        data.description !== undefined,
      {
        message:
          "At least one field (name, departmentId, or description) is required",
      }
    ),
});

// Delete position validation
export const deletePositionSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid position ID")),
  }),
});



