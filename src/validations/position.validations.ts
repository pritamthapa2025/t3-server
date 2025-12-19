import { z } from "zod";

// Get positions query validation
export const getPositionsQuerySchema = z.object({
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

// Get position by ID validation
export const getPositionByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Position ID must be a valid positive number")),
  }),
});

// Create position validation
export const createPositionSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, "Position name is required and cannot be empty")
      .max(100, "Position name is too long (maximum 100 characters)")
      .trim(),
    departmentId: z
      .number()
      .int("Department ID must be a whole number")
      .positive("Department ID must be a positive number")
      .optional()
      .nullable(),
    description: z
      .string()
      .max(1000, "Description is too long (maximum 1000 characters)")
      .optional(),
    payRate: z
      .number()
      .positive("Pay rate must be a positive number")
      .or(z.string().transform((val) => parseFloat(val)))
      .pipe(z.number().positive("Pay rate must be a positive number")),
    payType: z.enum(["Hourly", "Salary"], {
      message: "Pay type must be either 'Hourly' or 'Salary'"
    }),
    currency: z
      .string()
      .length(3, "Currency code must be exactly 3 characters (e.g., USD, EUR)")
      .default("USD")
      .optional(),
    notes: z
      .string()
      .max(2000, "Notes are too long (maximum 2000 characters)")
      .optional(),
    isActive: z.boolean().default(true).optional(),
    sortOrder: z
      .number()
      .int("Sort order must be a whole number")
      .optional(),
  }),
});

// Update position validation
export const updatePositionSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Position ID must be a valid positive number")),
  }),
  body: z
    .object({
      name: z
        .string()
        .min(1, "Position name cannot be empty")
        .max(100, "Position name is too long (maximum 100 characters)")
        .trim()
        .optional(),
      departmentId: z
        .number()
        .int("Department ID must be a whole number")
        .positive("Department ID must be a positive number")
        .optional()
        .nullable(),
      description: z
        .string()
        .max(1000, "Description is too long (maximum 1000 characters)")
        .optional(),
      payRate: z
        .number()
        .positive("Pay rate must be a positive number")
        .or(z.string().transform((val) => parseFloat(val)))
        .pipe(z.number().positive("Pay rate must be a positive number"))
        .optional(),
      payType: z.enum(["Hourly", "Salary"], {
        message: "Pay type must be either 'Hourly' or 'Salary'"
      }).optional(),
      currency: z
        .string()
        .length(3, "Currency code must be exactly 3 characters (e.g., USD, EUR)")
        .optional(),
      notes: z
        .string()
        .max(2000, "Notes are too long (maximum 2000 characters)")
        .optional()
        .nullable(),
      isActive: z.boolean().optional(),
      sortOrder: z
        .number()
        .int("Sort order must be a whole number")
        .optional()
        .nullable(),
    })
    .refine(
      (data) =>
        data.name !== undefined ||
        data.departmentId !== undefined ||
        data.description !== undefined ||
        data.payRate !== undefined ||
        data.payType !== undefined ||
        data.currency !== undefined ||
        data.notes !== undefined ||
        data.isActive !== undefined ||
        data.sortOrder !== undefined,
      {
        message: "At least one field must be provided to update the position",
      }
    ),
});

// Delete position validation
export const deletePositionSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Position ID must be a valid positive number")),
  }),
});
