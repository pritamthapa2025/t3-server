import { z } from "zod";

const uuidSchema = z
  .string()
  .uuid({ message: "Invalid ID format - must be a valid UUID" });
const numericStringSchema = z.string().regex(/^\d+(\.\d+)?$/, {
  message: "Must be a valid number (e.g., 100 or 99.99)",
});

// ============================
// Base Schemas
// ============================

const jobStatusEnum = z.enum(
  [
    "planned",
    "scheduled",
    "in_progress",
    "on_hold",
    "completed",
    "cancelled",
    "invoiced",
    "closed",
  ],
  {
    message:
      "Status must be one of: planned, scheduled, in_progress, on_hold, completed, cancelled, invoiced, or closed",
  },
);

// Note: Priority updates the associated bid's priority, not the job's priority
// Jobs now use bid priority instead of their own priority field
const jobPriorityEnum = z.enum(["low", "medium", "high", "urgent"], {
  message:
    "Priority must be one of: low, medium, high, or urgent (updates the associated bid's priority)",
});

const timelineStatusEnum = z.enum(
  ["completed", "pending", "in_progress", "cancelled"],
  {
    message:
      "Timeline status must be one of: completed, pending, in_progress, or cancelled",
  },
);

// ============================
// Main Job Validations
// ============================

export const getJobsQuerySchema = z.object({
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
      .pipe(
        z
          .number()
          .int()
          .positive("Limit must be a positive number")
          .max(100, "Maximum 100 items per page"),
      ),
    status: jobStatusEnum.optional(),
    jobType: z.string().max(100).optional(),
    priority: jobPriorityEnum.optional(),
    search: z.string().optional(),
  }),
});

export const getJobByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const createJobSchema = z.object({
  body: z.object({
    jobNumber: z
      .string()
      .max(100, "Job number is too long (maximum 100 characters)")
      .optional(),
    status: jobStatusEnum.optional().default("planned"),
    priority: jobPriorityEnum.optional(), // Updates the associated bid's priority
    jobType: z.string().max(100).optional(),
    serviceType: z.string().max(100).optional(),
    bidId: uuidSchema, // Now required - organization and property can be derived from bid
    description: z.string().optional(),
    scheduledStartDate: z
      .string()
      .date("Invalid date format. Must be in YYYY-MM-DD format"),
    scheduledEndDate: z
      .string()
      .date("Invalid date format. Must be in YYYY-MM-DD format"),
    siteAddress: z.string().optional(),
    siteContactName: z.string().max(150).optional(),
    siteContactPhone: z.string().max(20).optional(),
    accessInstructions: z.string().optional(),
    contractValue: numericStringSchema.optional(),
    assignedTeamMembers: z
      .array(
        z.object({
          employeeId: z
            .number()
            .int()
            .positive("Employee ID must be a positive number"),
          positionId: z
            .number()
            .int()
            .positive("Position ID must be a positive number")
            .optional(),
        }),
      )
      .optional(),
  }),
});

export const updateJobSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    status: jobStatusEnum.optional(),
    priority: jobPriorityEnum.optional(),
    jobType: z.string().max(100).optional(),
    serviceType: z.string().max(100).optional(),
    description: z.string().optional(),
    scheduledStartDate: z.string().date().optional(),
    scheduledEndDate: z.string().date().optional(),
    actualStartDate: z.string().date().optional(),
    actualEndDate: z.string().date().optional(),
    siteAddress: z.string().optional(),
    siteContactName: z.string().max(150).optional(),
    siteContactPhone: z.string().max(20).optional(),
    accessInstructions: z.string().optional(),
    contractValue: numericStringSchema.optional(),
    actualCost: numericStringSchema.optional(),
    completionNotes: z.string().optional(),
    completionPercentage: numericStringSchema.optional(),
  }),
});

export const deleteJobSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ============================
// Team Members Validations
// ============================

export const getJobTeamMembersSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

export const addJobTeamMemberSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
  body: z.object({
    employeeId: z
      .number()
      .int()
      .positive("Employee ID must be a positive number"),
    role: z.string().max(100).optional(),
  }),
});

export const removeJobTeamMemberSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    employeeId: z.string().regex(/^\d+$/, "Employee ID must be a number"),
  }),
});

// ============================
// Financial Summary Validations
// ============================

export const getJobFinancialSummarySchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

export const updateJobFinancialSummarySchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
  body: z.object({
    contractValue: numericStringSchema.optional(),
    totalInvoiced: numericStringSchema.optional(),
    totalPaid: numericStringSchema.optional(),
    vendorsOwed: numericStringSchema.optional(),
    laborPaidToDate: numericStringSchema.optional(),
    jobCompletionRate: numericStringSchema.optional(),
    profitability: numericStringSchema.optional(),
    profitMargin: numericStringSchema.optional(),
  }),
});

// ============================
// Financial Breakdown Validations
// ============================

export const getJobFinancialBreakdownSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

export const updateJobFinancialBreakdownSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
  body: z.object({
    materialsEquipment: numericStringSchema,
    labor: numericStringSchema,
    travel: numericStringSchema,
    operatingExpenses: numericStringSchema,
    totalCost: numericStringSchema,
  }),
});

// ============================
// Materials Validations
// ============================

export const getJobMaterialsSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

export const getJobMaterialByIdSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    materialId: uuidSchema,
  }),
});

export const createJobMaterialSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
  body: z.object({
    description: z.string().min(1, "Description is required"),
    quantity: numericStringSchema,
    unitCost: numericStringSchema,
    markup: numericStringSchema.optional(),
    totalCost: numericStringSchema,
    // Note: isActual removed - job materials now only track actual materials used
  }),
});

export const updateJobMaterialSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    materialId: uuidSchema,
  }),
  body: z.object({
    description: z.string().min(1).optional(),
    quantity: numericStringSchema.optional(),
    unitCost: numericStringSchema.optional(),
    markup: numericStringSchema.optional(),
    totalCost: numericStringSchema.optional(),
    // Note: isActual removed - these tables now only track actual data
  }),
});

export const deleteJobMaterialSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    materialId: uuidSchema,
  }),
});

// ============================
// Labor Validations
// ============================

export const getJobLaborSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

export const getJobLaborByIdSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    laborId: uuidSchema,
  }),
});

export const createJobLaborSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
  body: z.object({
    positionId: z.number().int().positive("Position ID is required"),
    days: z.number().int().positive("Days must be a positive number"),
    hoursPerDay: numericStringSchema,
    totalHours: numericStringSchema,
    costRate: numericStringSchema,
    billableRate: numericStringSchema,
    totalCost: numericStringSchema,
    totalPrice: numericStringSchema,
    // Note: isActual removed - these tables now only track actual data
  }),
});

export const updateJobLaborSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    laborId: uuidSchema,
  }),
  body: z.object({
    positionId: z.number().int().positive().optional(),
    days: z.number().int().positive().optional(),
    hoursPerDay: numericStringSchema.optional(),
    totalHours: numericStringSchema.optional(),
    costRate: numericStringSchema.optional(),
    billableRate: numericStringSchema.optional(),
    totalCost: numericStringSchema.optional(),
    totalPrice: numericStringSchema.optional(),
    // Note: isActual removed - these tables now only track actual data
  }),
});

export const deleteJobLaborSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    laborId: uuidSchema,
  }),
});

// ============================
// Travel Validations
// ============================

export const getJobTravelSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

export const getJobTravelByIdSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    travelId: uuidSchema,
  }),
});

export const createJobTravelSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
  body: z.object({
    employeeId: z.number().int().positive().optional(),
    employeeName: z.string().max(255).optional(),
    vehicleId: uuidSchema.optional(),
    vehicleName: z.string().max(255).optional(),
    roundTripMiles: numericStringSchema,
    mileageRate: numericStringSchema,
    vehicleDayRate: numericStringSchema,
    days: z.number().int().positive("Days must be a positive number"),
    mileageCost: numericStringSchema,
    vehicleCost: numericStringSchema,
    markup: numericStringSchema.optional(),
    totalCost: numericStringSchema,
    totalPrice: numericStringSchema,
    // Note: isActual removed - job travel now only tracks actual travel expenses
  }),
});

export const updateJobTravelSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    travelId: uuidSchema,
  }),
  body: z.object({
    employeeId: z.number().int().positive().optional(),
    roundTripMiles: numericStringSchema.optional(),
    mileageRate: numericStringSchema.optional(),
    vehicleDayRate: numericStringSchema.optional(),
    days: z.number().int().positive().optional(),
    mileageCost: numericStringSchema.optional(),
    vehicleCost: numericStringSchema.optional(),
    markup: numericStringSchema.optional(),
    totalCost: numericStringSchema.optional(),
    totalPrice: numericStringSchema.optional(),
    // Note: isActual removed - these tables now only track actual data
    // Note: employeeName, vehicleId, vehicleName removed - derived from employeeId
  }),
});

export const deleteJobTravelSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    travelId: uuidSchema,
  }),
});

// ============================
// Operating Expenses Validations
// ============================

export const getJobOperatingExpensesSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

export const updateJobOperatingExpensesSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
  body: z.object({
    enabled: z.boolean().optional(),
    grossRevenuePreviousYear: numericStringSchema.optional(),
    currentJobAmount: numericStringSchema.optional(),
    operatingCostPreviousYear: numericStringSchema.optional(),
    inflationAdjustedOperatingCost: numericStringSchema.optional(),
    inflationRate: numericStringSchema.optional(),
    utilizationPercentage: numericStringSchema.optional(),
    calculatedOperatingCost: numericStringSchema.optional(),
    applyMarkup: z.boolean().optional(),
    markupPercentage: numericStringSchema.optional(),
    operatingPrice: numericStringSchema.optional(),
  }),
});

// ============================
// Timeline Validations
// ============================

export const getJobTimelineSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

export const getJobTimelineEventByIdSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    eventId: uuidSchema,
  }),
});

export const createJobTimelineEventSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
  body: z.object({
    event: z.string().min(1, "Event is required").max(255),
    eventDate: z.string().datetime("Invalid datetime format"),
    status: timelineStatusEnum.optional().default("pending"),
    description: z.string().optional(),
    sortOrder: z.number().int().optional().default(0),
  }),
});

export const updateJobTimelineEventSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    eventId: uuidSchema,
  }),
  body: z.object({
    event: z.string().max(255).optional(),
    eventDate: z.string().datetime().optional(),
    status: timelineStatusEnum.optional(),
    description: z.string().optional(),
    sortOrder: z.number().int().optional(),
  }),
});

export const deleteJobTimelineEventSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    eventId: uuidSchema,
  }),
});

// ============================
// Notes Validations
// ============================

export const getJobNotesSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

export const createJobNoteSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
  body: z.object({
    note: z.string().min(1, "Note is required"),
    isInternal: z.boolean().optional().default(true),
  }),
});

export const getJobNoteByIdSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    noteId: uuidSchema,
  }),
});

export const updateJobNoteSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    noteId: uuidSchema,
  }),
  body: z.object({
    note: z.string().min(1).optional(),
    isInternal: z.boolean().optional(),
  }),
});

export const deleteJobNoteSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    noteId: uuidSchema,
  }),
});

// ============================
// History Validations
// ============================

export const getJobHistorySchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

// ============================
// Tasks Validations
// ============================

export const getJobTasksSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

export const createJobTaskSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
  body: z.object({
    taskName: z.string().min(1, "Task name is required").max(255),
    description: z.string().optional(),
    status: z.string().max(50).optional().default("pending"),
    priority: z.string().max(50).optional().default("medium"),
    assignedTo: uuidSchema.optional(),
    dueDate: z.string().date().optional(),
    estimatedHours: numericStringSchema.optional(),
    sortOrder: z.number().int().optional().default(0),
  }),
});

export const getJobTaskByIdSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    taskId: uuidSchema,
  }),
});

export const updateJobTaskSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    taskId: uuidSchema,
  }),
  body: z.object({
    taskName: z.string().max(255).optional(),
    description: z.string().optional(),
    status: z.string().max(50).optional(),
    priority: z.string().max(50).optional(),
    assignedTo: uuidSchema.optional(),
    dueDate: z.string().date().optional(),
    completedDate: z.string().date().optional(),
    estimatedHours: numericStringSchema.optional(),
    actualHours: numericStringSchema.optional(),
    sortOrder: z.number().int().optional(),
  }),
});

export const deleteJobTaskSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    taskId: uuidSchema,
  }),
});

// ============================
// Expenses Validations
// ============================

export const getJobExpensesSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

export const createJobExpenseSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
  body: z.object({
    expenseType: z.string().min(1, "Expense type is required").max(100),
    expenseCategoryId: uuidSchema.optional(), // optional; service defaults if omitted
    description: z.string().min(1, "Description is required"),
    quantity: z.coerce.number().int().min(1).optional(),
    amount: numericStringSchema,
    expenseDate: z.string().date("Invalid date format"),
    vendorName: z.string().max(255).optional(),
    invoiceNumber: z.string().max(100).optional(),
    receiptPath: z.string().max(500).optional(), // set server-side after upload
    approvedBy: uuidSchema.optional(),
  }),
});

export const getJobExpenseByIdSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    expenseId: uuidSchema,
  }),
});

export const updateJobExpenseSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    expenseId: uuidSchema,
  }),
  body: z
    .object({
      expenseType: z.string().max(100).optional(),
      expenseCategoryId: uuidSchema.optional(),
      description: z.string().min(1).optional(),
      quantity: z.coerce.number().int().min(1).optional(),
      amount: numericStringSchema.optional(),
      expenseDate: z.string().date().optional(),
      vendorName: z.string().max(255).optional(),
      invoiceNumber: z.string().max(100).optional(),
      receiptPath: z.string().max(500).optional(),
      approvedBy: uuidSchema.optional(),
    })
    .refine((b) => Object.keys(b).length > 0, {
      message: "At least one field is required to update",
    }),
});

export const deleteJobExpenseSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    expenseId: uuidSchema,
  }),
});

// ============================
// Documents Validations
// ============================

export const getJobDocumentsSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

export const createJobDocumentsSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
  body: z.object({}).optional(),
});

export const getJobDocumentByIdSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    documentId: uuidSchema,
  }),
});

export const updateJobDocumentSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    documentId: uuidSchema,
  }),
  body: z.object({
    fileName: z
      .string()
      .max(255, "File name is too long (maximum 255 characters)")
      .optional(),
    documentType: z
      .string()
      .max(50, "Document type is too long (maximum 50 characters)")
      .optional(),
  }),
});

export const deleteJobDocumentSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    documentId: uuidSchema,
  }),
});

// ============================
// Complete Job Data Validations
// ============================

export const getJobWithAllDataSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});
