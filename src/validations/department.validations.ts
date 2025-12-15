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

// Position Pay Band validation
const positionPayBandSchema = z.object({
  positionTitle: z
    .string()
    .min(1, "Position title is required")
    .max(100, "Position title must be less than 100 characters"),
  payType: z.enum(
    ["Hourly", "Salary"],
    "Pay type must be either 'Hourly' or 'Salary'"
  ),
  payRate: z
    .number()
    .positive("Pay rate must be a positive number")
    .or(z.string().transform((val) => parseFloat(val)))
    .pipe(z.number().positive()),
  notes: z.string().max(500).optional(),
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
    leadId: z.string().uuid("Invalid lead ID").optional(),
    contactEmail: z
      .string()
      .email("Invalid email format")
      .max(255, "Contact email must be less than 255 characters")
      .optional(),
    primaryLocation: z
      .string()
      .max(255, "Primary location must be less than 255 characters")
      .optional(),
    shiftCoverage: z
      .string()
      .max(100, "Shift coverage must be less than 100 characters")
      .optional(),
    openPositions: z
      .number()
      .int()
      .nonnegative("Open positions must be a non-negative integer")
      .optional(),
    utilization: z
      .number()
      .min(0, "Utilization must be between 0 and 1")
      .max(1, "Utilization must be between 0 and 1")
      .optional(),
    isActive: z.boolean().optional(),
    sortOrder: z
      .number()
      .int()
      .optional(),
    positionPayBands: z.array(positionPayBandSchema).optional(),
  }),
});

// Update position pay band schema (includes id for existing positions)
const updatePositionPayBandSchema = z.object({
  id: z.number().int().positive().optional(),
  positionTitle: z
    .string()
    .min(1, "Position title is required")
    .max(100, "Position title must be less than 100 characters"),
  payType: z.enum(
    ["Hourly", "Salary"],
    "Pay type must be either 'Hourly' or 'Salary'"
  ),
  payRate: z
    .number()
    .positive("Pay rate must be a positive number")
    .or(z.string().transform((val) => parseFloat(val)))
    .pipe(z.number().positive()),
  notes: z.string().max(500).optional(),
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
      leadId: z.string().uuid("Invalid lead ID").optional().nullable(),
      contactEmail: z
        .string()
        .email("Invalid email format")
        .max(255, "Contact email must be less than 255 characters")
        .optional()
        .nullable(),
      primaryLocation: z
        .string()
        .max(255, "Primary location must be less than 255 characters")
        .optional()
        .nullable(),
      shiftCoverage: z
        .string()
        .max(100, "Shift coverage must be less than 100 characters")
        .optional()
        .nullable(),
      openPositions: z
        .number()
        .int()
        .nonnegative("Open positions must be a non-negative integer")
        .optional(),
      utilization: z
        .number()
        .min(0, "Utilization must be between 0 and 1")
        .max(1, "Utilization must be between 0 and 1")
        .optional()
        .nullable(),
      isActive: z.boolean().optional(),
      sortOrder: z
        .number()
        .int()
        .optional()
        .nullable(),
      positionPayBands: z.array(updatePositionPayBandSchema).optional(),
    })
    .refine(
      (data) =>
        data.name !== undefined ||
        data.description !== undefined ||
        data.leadId !== undefined ||
        data.contactEmail !== undefined ||
        data.primaryLocation !== undefined ||
        data.shiftCoverage !== undefined ||
        data.openPositions !== undefined ||
        data.utilization !== undefined ||
        data.isActive !== undefined ||
        data.sortOrder !== undefined ||
        data.positionPayBands !== undefined,
      {
        message: "At least one field is required for update",
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
