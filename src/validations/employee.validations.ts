import { z } from "zod";

const uuidSchema = z
  .string()
  .uuid({ message: "Invalid ID format - must be a valid UUID" });

// Helper to handle empty strings for numeric fields
const stringToIntOrUndefined = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined || val === "") return undefined;
    const num = typeof val === "string" ? parseInt(val, 10) : val;
    return isNaN(num) ? undefined : num;
  });

// Get employees query validation
export const getEmployeesQuerySchema = z.object({
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

// Get employees simple query validation (no pagination, search only)
export const getEmployeesSimpleQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
  }),
});

// Get employee by ID validation
export const getEmployeeByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid employee ID")),
  }),
});

// Create employee validation
export const createEmployeeSchema = z
  .object({
    body: z.object({
      // User fields (required if userId is not provided)
      userId: uuidSchema.optional(),
      fullName: z
        .string()
        .min(1, "Full name is required and cannot be empty")
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
          message:
            "Invalid date format. Please use YYYY-MM-DD format (e.g., 1990-01-15)",
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
          message:
            "Please provide a valid emergency contact phone number (e.g., +1234567890)",
        }),
      // Employee fields
      employeeId: z
        .string()
        .max(50, "Employee ID is too long (maximum 50 characters)")
        .optional(),
      departmentId: stringToIntOrUndefined
        .pipe(
          z
            .number()
            .int("Department ID must be a whole number")
            .positive("Department ID must be a positive number")
            .optional()
        )
        .optional()
        .nullable(),
      positionId: stringToIntOrUndefined
        .pipe(
          z
            .number()
            .int("Position ID must be a whole number")
            .positive("Position ID must be a positive number")
            .optional()
        )
        .optional()
        .nullable(),
      reportsTo: uuidSchema.optional().nullable(),
      roleId: stringToIntOrUndefined
        .pipe(
          z
            .number()
            .int("Role ID must be a whole number")
            .positive("Role ID must be a positive number")
            .optional()
        )
        .optional()
        .nullable(),
      startDate: z
        .union([z.string(), z.date()])
        .transform((val) => (typeof val === "string" ? new Date(val) : val))
        .refine((val) => !isNaN(val.getTime()), {
          message:
            "Invalid start date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)",
        })
        .optional(),
      // Bank account fields
      accountHolderName: z
        .string()
        .max(150, "Account holder name is too long (maximum 150 characters)")
        .trim()
        .optional(),
      bankName: z
        .string()
        .max(150, "Bank name is too long (maximum 150 characters)")
        .trim()
        .optional(),
      accountNumber: z
        .string()
        .max(100, "Account number is too long (maximum 100 characters)")
        .trim()
        .optional(),
      routingNumber: z
        .string()
        .max(100, "Routing number is too long (maximum 100 characters)")
        .trim()
        .optional(),
      accountType: z
        .enum(["savings", "current", "salary", "checking", "business"])
        .optional(),
      branchName: z
        .string()
        .max(150, "Branch name is too long (maximum 150 characters)")
        .trim()
        .optional(),
    }),
  })
  .refine(
    (data) => {
      // Either userId must be provided, or fullName and email must be provided for new user
      const hasUserId = !!data.body.userId;
      const hasNewUserFields = !!data.body.fullName && !!data.body.email;
      return hasUserId || hasNewUserFields;
    },
    {
      message:
        "Either 'User ID' must be provided (for existing user), OR both 'Full Name' and 'Email' are required (to create a new user)",
      path: ["body"],
    }
  )
  .refine(
    (data) => {
      // If any bank field is provided, all required bank fields must be provided
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
        "When adding bank account details, all of these fields are required: Account Holder Name, Bank Name, Account Number, and Account Type",
      path: ["body"],
    }
  );

// Update employee validation
export const updateEmployeeSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid employee ID")),
  }),
  body: z
    .object({
      // Employee fields (employeeId excluded as per user request)
      departmentId: stringToIntOrUndefined
        .pipe(
          z
            .number()
            .int("Department ID must be a whole number")
            .positive("Department ID must be a positive number")
            .optional()
        )
        .optional()
        .nullable(),
      positionId: stringToIntOrUndefined
        .pipe(
          z
            .number()
            .int("Position ID must be a whole number")
            .positive("Position ID must be a positive number")
            .optional()
        )
        .optional()
        .nullable(),
      reportsTo: uuidSchema.optional().nullable(),
      roleId: stringToIntOrUndefined
        .pipe(
          z
            .number()
            .int("Role ID must be a whole number")
            .positive("Role ID must be a positive number")
            .optional()
        )
        .optional()
        .nullable(),
      status: z
        .enum(["available", "in_field", "on_leave", "terminated", "suspended"])
        .optional(),
      startDate: z
        .union([z.string(), z.date()])
        .transform((val) => (typeof val === "string" ? new Date(val) : val))
        .refine((val) => !isNaN(val.getTime()), {
          message:
            "Invalid start date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)",
        })
        .optional(),
      endDate: z
        .union([z.string(), z.date(), z.null()])
        .transform((val) =>
          val === null || val === undefined
            ? null
            : typeof val === "string"
            ? new Date(val)
            : val
        )
        .refine((val) => val === null || !isNaN(val.getTime()), {
          message:
            "Invalid end date format. Please use YYYY-MM-DD format (e.g., 2024-12-31)",
        })
        .optional()
        .nullable(),

      // User fields (from General Information section)
      fullName: z
        .string()
        .min(1, "Full name is required and cannot be empty")
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

      // Bank account fields (from Payroll Information section)
      accountHolderName: z
        .string()
        .max(150, "Account holder name is too long (maximum 150 characters)")
        .trim()
        .optional(),
      bankName: z
        .string()
        .max(150, "Bank name is too long (maximum 150 characters)")
        .trim()
        .optional(),
      accountNumber: z
        .string()
        .max(100, "Account number is too long (maximum 100 characters)")
        .trim()
        .optional(),
      routingNumber: z
        .string()
        .max(100, "Routing number is too long (maximum 100 characters)")
        .trim()
        .optional(),
      accountType: z
        .enum(["savings", "current", "salary", "checking", "business"])
        .optional(),
    })
    .refine(
      (data) =>
        data.departmentId !== undefined ||
        data.positionId !== undefined ||
        data.reportsTo !== undefined ||
        data.roleId !== undefined ||
        data.status !== undefined ||
        data.startDate !== undefined ||
        data.endDate !== undefined ||
        data.fullName !== undefined ||
        data.email !== undefined ||
        data.phone !== undefined ||
        data.address !== undefined ||
        data.city !== undefined ||
        data.state !== undefined ||
        data.zipCode !== undefined ||
        data.accountHolderName !== undefined ||
        data.bankName !== undefined ||
        data.accountNumber !== undefined ||
        data.routingNumber !== undefined ||
        data.accountType !== undefined,
      {
        message: "At least one field must be provided to update",
      }
    ),
});

// Delete employee validation
export const deleteEmployeeSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid employee ID")),
  }),
});
