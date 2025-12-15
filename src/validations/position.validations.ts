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
    payRate: z
      .number()
      .positive("Pay rate must be a positive number")
      .or(z.string().transform((val) => parseFloat(val)))
      .pipe(z.number().positive("Pay rate must be a positive number")),
    payType: z.enum(["Hourly", "Salary"], {
      errorMap: () => ({ message: "Pay type must be either 'Hourly' or 'Salary'" }),
    }),
    currency: z
      .string()
      .length(3, "Currency must be a 3-character code")
      .default("USD")
      .optional(),
    notes: z
      .string()
      .max(2000, "Notes must be less than 2000 characters")
      .optional(),
    isActive: z.boolean().default(true).optional(),
    sortOrder: z
      .number()
      .int()
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
      payRate: z
        .number()
        .positive("Pay rate must be a positive number")
        .or(z.string().transform((val) => parseFloat(val)))
        .pipe(z.number().positive("Pay rate must be a positive number"))
        .optional(),
      payType: z.enum(["Hourly", "Salary"], {
        errorMap: () => ({ message: "Pay type must be either 'Hourly' or 'Salary'" }),
      }).optional(),
      currency: z
        .string()
        .length(3, "Currency must be a 3-character code")
        .optional(),
      notes: z
        .string()
        .max(2000, "Notes must be less than 2000 characters")
        .optional()
        .nullable(),
      isActive: z.boolean().optional(),
      sortOrder: z
        .number()
        .int()
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
        message: "At least one field is required for update",
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





