import { z } from "zod";

// UUID validation helper
const uuidSchema = z.string().uuid({ message: "Invalid UUID format" });

// Get users query validation
export const getUsersQuerySchema = z.object({
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
  }),
});

// Get user by ID validation
export const getUserByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Create user validation
export const createUserSchema = z.object({
  body: z.object({
    fullName: z
      .string()
      .min(1, "Full name is required")
      .max(150, "Full name must be less than 150 characters"),
    email: z.email("Invalid email format"),
    phone: z
      .string()
      .optional()
      .refine((val) => !val || val === "" || /^\+?[1-9]\d{1,14}$/.test(val), {
        message: "Invalid phone number format",
      }),
    address: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(50).optional(),
    zipCode: z.string().max(20).optional(),
    dateOfBirth: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid date format",
      })
      .optional(),
    emergencyContactName: z.string().max(150).optional(),
    emergencyContactPhone: z
      .string()
      .optional()
      .refine((val) => !val || val === "" || /^\+?[1-9]\d{1,14}$/.test(val), {
        message: "Invalid phone number format",
      }),
  }),
});

// Update user validation
export const updateUserSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z
    .object({
      fullName: z
        .string()
        .min(1, "Full name cannot be empty")
        .max(150, "Full name must be less than 150 characters")
        .optional(),
      email: z.email("Invalid email format").optional(),
      phone: z
        .string()
        .optional()
        .refine((val) => !val || val === "" || /^\+?[1-9]\d{1,14}$/.test(val), {
          message: "Invalid phone number format",
        }),
      address: z.string().max(255).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(50).optional(),
      zipCode: z.string().max(20).optional(),
      dateOfBirth: z
        .union([z.string(), z.date()])
        .transform((val) => (typeof val === "string" ? new Date(val) : val))
        .refine((val) => !isNaN(val.getTime()), {
          message: "Invalid date format",
        })
        .optional(),
      emergencyContactName: z.string().max(150).optional(),
      emergencyContactPhone: z
        .string()
        .optional()
        .refine((val) => !val || val === "" || /^\+?[1-9]\d{1,14}$/.test(val), {
          message: "Invalid phone number format",
        }),
      isActive: z.boolean().optional(),
      isVerified: z.boolean().optional(),
    })
    .refine(
      (data) =>
        data.fullName !== undefined ||
        data.email !== undefined ||
        data.phone !== undefined ||
        data.address !== undefined ||
        data.city !== undefined ||
        data.state !== undefined ||
        data.zipCode !== undefined ||
        data.dateOfBirth !== undefined ||
        data.emergencyContactName !== undefined ||
        data.emergencyContactPhone !== undefined ||
        data.isActive !== undefined ||
        data.isVerified !== undefined,
      {
        message: "At least one field is required for update",
      }
    ),
});

// Delete user validation
export const deleteUserSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});
