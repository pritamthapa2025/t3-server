import { z } from "zod";

// Get departments query validation
export const getDepartmentsQuerySchema = z.object({
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

// Get department by ID validation
export const getDepartmentByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Department ID must be a valid positive number")),
  }),
});

// Position Pay Band validation
const positionPayBandSchema = z.object({
  positionTitle: z
    .string()
    .min(1, "Position title is required and cannot be empty")
    .max(100, "Position title is too long (maximum 100 characters)")
    .trim(),
  payType: z.enum(["Hourly", "Salary"], {
    message: "Pay type must be either 'Hourly' or 'Salary'"
  }),
  payRate: z
    .number()
    .positive("Pay rate must be a positive number")
    .or(z.string().transform((val) => parseFloat(val)))
    .pipe(z.number().positive("Pay rate must be a positive number")),
  notes: z
    .string()
    .max(500, "Notes are too long (maximum 500 characters)")
    .optional(),
});

// Create department validation
export const createDepartmentSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, "Department name is required and cannot be empty")
      .max(100, "Department name is too long (maximum 100 characters)")
      .trim(),
    description: z
      .string()
      .max(1000, "Description is too long (maximum 1000 characters)")
      .optional(),
    leadId: z
      .string()
      .uuid("Lead ID must be a valid UUID")
      .optional(),
    contactEmail: z
      .string()
      .email("Please provide a valid email address (e.g., department@example.com)")
      .max(255, "Contact email is too long (maximum 255 characters)")
      .trim()
      .optional(),
    primaryLocation: z
      .string()
      .max(255, "Primary location is too long (maximum 255 characters)")
      .optional(),
    shiftCoverage: z
      .string()
      .max(100, "Shift coverage is too long (maximum 100 characters)")
      .optional(),
    utilization: z
      .number()
      .min(0, "Utilization must be between 0 and 1 (e.g., 0.75 for 75%)")
      .max(1, "Utilization must be between 0 and 1 (e.g., 0.75 for 75%)")
      .optional(),
    isActive: z.boolean().optional(),
    sortOrder: z
      .number()
      .int("Sort order must be a whole number")
      .optional(),
    positionPayBands: z.array(positionPayBandSchema).optional(),
  }),
});

// Update position pay band schema (includes id for existing positions)
const updatePositionPayBandSchema = z.object({
  id: z.number().int().positive().optional(),
  positionTitle: z
    .string()
    .min(1, "Position title is required and cannot be empty")
    .max(100, "Position title is too long (maximum 100 characters)")
    .trim(),
  payType: z.enum(["Hourly", "Salary"], {
    message: "Pay type must be either 'Hourly' or 'Salary'"
  }),
  payRate: z
    .number()
    .positive("Pay rate must be a positive number")
    .or(z.string().transform((val) => parseFloat(val)))
    .pipe(z.number().positive("Pay rate must be a positive number")),
  notes: z
    .string()
    .max(500, "Notes are too long (maximum 500 characters)")
    .optional(),
});

// Update department validation
export const updateDepartmentSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Department ID must be a valid positive number")),
  }),
  body: z
    .object({
      name: z
        .string()
        .min(1, "Department name cannot be empty")
        .max(100, "Department name is too long (maximum 100 characters)")
        .trim()
        .optional(),
      description: z
        .string()
        .max(1000, "Description is too long (maximum 1000 characters)")
        .optional(),
      leadId: z
        .string()
        .uuid("Lead ID must be a valid UUID")
        .optional()
        .nullable(),
      contactEmail: z
        .string()
        .email("Please provide a valid email address (e.g., department@example.com)")
        .max(255, "Contact email is too long (maximum 255 characters)")
        .trim()
        .optional()
        .nullable(),
      primaryLocation: z
        .string()
        .max(255, "Primary location is too long (maximum 255 characters)")
        .optional()
        .nullable(),
      shiftCoverage: z
        .string()
        .max(100, "Shift coverage is too long (maximum 100 characters)")
        .optional()
        .nullable(),
      utilization: z
        .number()
        .min(0, "Utilization must be between 0 and 1 (e.g., 0.75 for 75%)")
        .max(1, "Utilization must be between 0 and 1 (e.g., 0.75 for 75%)")
        .optional()
        .nullable(),
      isActive: z.boolean().optional(),
      sortOrder: z
        .number()
        .int("Sort order must be a whole number")
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
        data.utilization !== undefined ||
        data.isActive !== undefined ||
        data.sortOrder !== undefined ||
        data.positionPayBands !== undefined,
      {
        message: "At least one field must be provided to update the department",
      }
    ),
});

// Delete department validation
export const deleteDepartmentSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Department ID must be a valid positive number")),
  }),
});
