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

// Get employees simple query validation (for search/autocomplete)
export const getEmployeesSimpleQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    positionId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive().optional()),
    roleId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive().optional()),
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
// Note: userId should NOT be provided when creating an employee
// The system will automatically create a new user and use its ID for the employee
export const createEmployeeSchema = z.object({
  body: z.object({
    // User fields (required - system creates new user when creating employee)
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Invalid email format"),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    dateOfBirth: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid date format",
      })
      .optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    // Employee fields
    employeeId: z
      .string()
      .max(50, "Employee ID must be less than 50 characters")
      .optional(),
    departmentId: z.number().int().positive().optional().nullable(),
    positionId: z.number().int().positive().optional().nullable(),
    reportsTo: uuidSchema.optional().nullable(),
    roleId: z.number().int().positive().optional().nullable(),
    startDate: z
      .union([z.string(), z.date()])
      .transform((val) => (typeof val === "string" ? new Date(val) : val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid date format",
      })
      .optional(),
    // Bank account fields
    accountHolderName: z.string().optional(),
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    routingNumber: z.string().optional(),
    accountType: z.string().optional(),
    branchName: z.string().optional(),
  }),
});

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
      departmentId: z.number().int().positive().optional().nullable(),
      positionId: z.number().int().positive().optional().nullable(),
      reportsTo: uuidSchema.optional().nullable(),
      status: z.string().optional(),
      startDate: z.union([z.string(), z.date()]).optional().nullable(),
      endDate: z.union([z.string(), z.date()]).optional().nullable(),
      note: z.unknown().optional(),
    })
    .refine(
      (data) =>
        data.userId !== undefined ||
        data.employeeId !== undefined ||
        data.departmentId !== undefined ||
        data.positionId !== undefined ||
        data.reportsTo !== undefined ||
        data.status !== undefined ||
        data.startDate !== undefined ||
        data.endDate !== undefined ||
        data.note !== undefined,
      {
        message:
          "At least one field is required for update",
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

// Get jobs and dispatch for employee by date (date is mandatory)
export const getEmployeeJobsAndDispatchSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid employee ID")),
  }),
  query: z.object({
    date: z
      .string()
      .min(1, "Date is required")
      .refine(
        (val) => {
          const d = new Date(val);
          return !isNaN(d.getTime());
        },
        { message: "Invalid date format. Use YYYY-MM-DD." },
      ),
  }),
});

