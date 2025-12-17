import { z } from "zod";

// Get roles query validation
export const getRolesQuerySchema = z.object({
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
    includeDeleted: z
      .string()
      .optional()
      .transform((val) => val === 'true')
      .pipe(z.boolean()),
    sortBy: z.enum(['name', 'createdAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

// Get role by ID validation
export const getRoleByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid role ID")),
  }),
});

// Create role validation
export const createRoleSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, "Role name is required")
      .max(100, "Role name must be less than 100 characters")
      .trim(),
    description: z
      .string()
      .max(1000, "Description must be less than 1000 characters")
      .optional()
      .nullable(),
  }),
});

// Update role validation
export const updateRoleSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid role ID")),
  }),
  body: z
    .object({
      name: z
        .string()
        .min(1, "Role name cannot be empty")
        .max(100, "Role name must be less than 100 characters")
        .trim()
        .optional(),
      description: z
        .string()
        .max(1000, "Description must be less than 1000 characters")
        .optional()
        .nullable(),
    })
    .refine(
      (data) => data.name !== undefined || data.description !== undefined,
      {
        message: "At least one field is required for update",
      }
    ),
});

// Delete role validation
export const deleteRoleSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid role ID")),
  }),
});

// Role name validation (for checking uniqueness)
export const checkRoleNameSchema = z.object({
  query: z.object({
    name: z
      .string()
      .min(1, "Role name is required")
      .max(100, "Role name must be less than 100 characters")
      .trim(),
    excludeId: z
      .string()
      .optional()
      .transform((val) => val ? parseInt(val, 10) : undefined)
      .pipe(z.number().int().positive().optional()),
  }),
});

