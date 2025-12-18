import { z } from "zod";

const uuidSchema = z.string().uuid({ message: "Invalid UUID format" });

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
        .min(1, "Full name is required")
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
      // Employee fields
      employeeId: z
        .string()
        .max(50, "Employee ID must be less than 50 characters")
        .optional(),
      departmentId: z
        .union([z.number(), z.string()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .pipe(z.number().int().positive())
        .optional()
        .nullable(),
      positionId: z
        .union([z.number(), z.string()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .pipe(z.number().int().positive())
        .optional()
        .nullable(),
      reportsTo: uuidSchema.optional().nullable(),
      roleId: z
        .union([z.number(), z.string()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .pipe(z.number().int().positive())
        .optional()
        .nullable(),
      startDate: z
        .union([z.string(), z.date()])
        .transform((val) => (typeof val === "string" ? new Date(val) : val))
        .refine((val) => !isNaN(val.getTime()), {
          message: "Invalid date format",
        })
        .optional(),
      // Bank account fields
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
      // Either userId must be provided, or fullName and email must be provided for new user
      const hasUserId = !!data.body.userId;
      const hasNewUserFields = !!data.body.fullName && !!data.body.email;
      return hasUserId || hasNewUserFields;
    },
    {
      message:
        "Either userId must be provided, or fullName and email are required to create a new user",
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
        "When providing bank account details, accountHolderName, bankName, accountNumber, and accountType are required",
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
      userId: uuidSchema.optional(),
      employeeId: z
        .string()
        .max(50, "Employee ID must be less than 50 characters")
        .optional(),
      departmentId: z
        .union([z.number(), z.string()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .pipe(z.number().int().positive())
        .optional()
        .nullable(),
      positionId: z
        .union([z.number(), z.string()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .pipe(z.number().int().positive())
        .optional()
        .nullable(),
      reportsTo: uuidSchema.optional().nullable(),
      roleId: z
        .union([z.number(), z.string()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .pipe(z.number().int().positive())
        .optional()
        .nullable(),
    })
    .refine(
      (data) =>
        data.userId !== undefined ||
        data.employeeId !== undefined ||
        data.departmentId !== undefined ||
        data.positionId !== undefined ||
        data.reportsTo !== undefined ||
        data.roleId !== undefined,
      {
        message:
          "At least one field (userId, employeeId, departmentId, positionId, reportsTo, or roleId) is required",
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

