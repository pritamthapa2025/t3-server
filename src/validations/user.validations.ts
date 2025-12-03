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
  }),
});

// Get user by ID validation
export const getUserByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Create user validation
export const createUserSchema = z
  .object({
    body: z.object({
      fullName: z
        .string()
        .min(1, "Full name is required")
        .max(150, "Full name must be less than 150 characters"),
      email: z.string().email("Invalid email format"),
      phone: z
        .string()
        .optional()
        .refine((val) => !val || val === "" || /^\+?[1-9]\d{1,14}$/.test(val), {
          message: "Invalid phone number format",
        }),
      departmentId: z.number().int().positive().optional().nullable(),
      positionId: z.number().int().positive().optional().nullable(),
      reportsTo: uuidSchema.optional().nullable(),
      startDate: z
        .union([z.string(), z.date()])
        .transform((val) => (typeof val === "string" ? new Date(val) : val))
        .refine((val) => !isNaN(val.getTime()), {
          message: "Invalid date format",
        }),
      accountHolderName: z
        .string()
        .max(150, "Account holder name must be less than 150 characters")
        .optional(),
      bankName: z
        .string()
        .max(150, "Bank name must be less than 150 characters")
        .optional(),
      accountNumber: z
        .string()
        .max(100, "Account number must be less than 100 characters")
        .optional(),
      routingNumber: z
        .string()
        .max(100, "Routing number must be less than 100 characters")
        .optional(),
      accountType: z
        .enum(["savings", "current", "salary", "checking", "business"], {
          message:
            "Account type must be one of: savings, current, salary, checking, business",
        })
        .optional(),
      branchName: z
        .string()
        .max(150, "Branch name must be less than 150 characters")
        .optional(),
    }),
  })
  .refine(
    (data) => {
      const hasAnyBankField =
        data.body.accountHolderName ||
        data.body.bankName ||
        data.body.accountNumber ||
        data.body.accountType;
      if (hasAnyBankField) {
        return (
          data.body.accountHolderName &&
          data.body.bankName &&
          data.body.accountNumber &&
          data.body.accountType
        );
      }
      return true;
    },
    {
      message:
        "When providing bank account details, accountHolderName, bankName, accountNumber, and accountType are required",
      path: ["body"],
    }
  );

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
      email: z.string().email("Invalid email format").optional(),
      phone: z
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
        data.isActive !== undefined ||
        data.isVerified !== undefined,
      {
        message:
          "At least one field (fullName, email, phone, isActive, or isVerified) is required",
      }
    ),
});

// Delete user validation
export const deleteUserSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});
