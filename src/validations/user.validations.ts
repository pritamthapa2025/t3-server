import { z } from "zod";

// UUID validation helper
const uuidSchema = z.string().uuid({ message: "Invalid ID format - must be a valid UUID" });

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
      .min(1, "Full name is required and cannot be empty")
      .max(150, "Full name is too long (maximum 150 characters)")
      .trim(),
    email: z
      .string()
      .email("Please provide a valid email address (e.g., john@example.com)")
      .trim()
      .toLowerCase(),
    phone: z
      .string()
      .optional()
      .refine((val) => !val || val === "" || /^\+?[1-9]\d{1,14}$/.test(val), {
        message: "Please provide a valid phone number (e.g., +1234567890)",
      }),
    address: z
      .string()
      .max(255, "Address is too long (maximum 255 characters)")
      .optional(),
    city: z
      .string()
      .max(100, "City is too long (maximum 100 characters)")
      .optional(),
    state: z
      .string()
      .max(50, "State is too long (maximum 50 characters)")
      .optional(),
    zipCode: z
      .string()
      .max(20, "ZIP code is too long (maximum 20 characters)")
      .optional(),
    dateOfBirth: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid date format. Please use YYYY-MM-DD format (e.g., 1990-01-15)",
      })
      .optional(),
    emergencyContactName: z
      .string()
      .max(150, "Emergency contact name is too long (maximum 150 characters)")
      .optional(),
    emergencyContactPhone: z
      .string()
      .optional()
      .refine((val) => !val || val === "" || /^\+?[1-9]\d{1,14}$/.test(val), {
        message: "Please provide a valid emergency contact phone number (e.g., +1234567890)",
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
        .max(150, "Full name is too long (maximum 150 characters)")
        .trim()
        .optional(),
      email: z
        .string()
        .email("Please provide a valid email address (e.g., john@example.com)")
        .trim()
        .toLowerCase()
        .optional(),
      phone: z
        .string()
        .optional()
        .refine((val) => !val || val === "" || /^\+?[1-9]\d{1,14}$/.test(val), {
          message: "Please provide a valid phone number (e.g., +1234567890)",
        }),
      address: z
        .string()
        .max(255, "Address is too long (maximum 255 characters)")
        .optional(),
      city: z
        .string()
        .max(100, "City is too long (maximum 100 characters)")
        .optional(),
      state: z
        .string()
        .max(50, "State is too long (maximum 50 characters)")
        .optional(),
      zipCode: z
        .string()
        .max(20, "ZIP code is too long (maximum 20 characters)")
        .optional(),
      dateOfBirth: z
        .union([z.string(), z.date()])
        .transform((val) => (typeof val === "string" ? new Date(val) : val))
        .refine((val) => !isNaN(val.getTime()), {
          message: "Invalid date format. Please use YYYY-MM-DD format (e.g., 1990-01-15)",
        })
        .optional(),
      emergencyContactName: z
        .string()
        .max(150, "Emergency contact name is too long (maximum 150 characters)")
        .optional(),
      emergencyContactPhone: z
        .string()
        .optional()
        .refine((val) => !val || val === "" || /^\+?[1-9]\d{1,14}$/.test(val), {
          message: "Please provide a valid emergency contact phone number (e.g., +1234567890)",
        }),
      isActive: z
        .union([z.boolean(), z.string()])
        .transform((val) =>
          typeof val === "string"
            ? val === "true" || val === "1"
            : val
        )
        .pipe(z.boolean())
        .optional(),
      isVerified: z
        .union([z.boolean(), z.string()])
        .transform((val) =>
          typeof val === "string"
            ? val === "true" || val === "1"
            : val
        )
        .pipe(z.boolean())
        .optional(),
      profilePicture: z
        .union([
          z.string().url("Profile picture must be a valid URL").max(500),
          z.null()
        ])
        .optional(),
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
        data.isVerified !== undefined ||
        data.profilePicture !== undefined,
      {
        message: "At least one field must be provided to update the user profile",
      }
    ),
});

// Delete user validation
export const deleteUserSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Get users by roles validation (no parameters needed for Executive/Manager roles)
export const getUsersByRolesSchema = z.object({});