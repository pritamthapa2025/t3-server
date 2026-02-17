import { z } from "zod";
import { expenseCategoryEnum } from "./expenses.validations.js";

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

const timelineDurationTypeEnum = z.enum(["days", "weeks", "months"], {
  message: "Duration type must be one of: days, weeks, or months",
});

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
    // Job fields
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

    // Nested bid data updates
    bidData: z
      .object({
        status: z
          .enum(
            [
              "draft",
              "pending",
              "submitted",
              "under_review",
              "approved",
              "rejected",
              "won",
              "lost",
              "cancelled",
            ],
            {
              message:
                "Bid status must be one of: draft, pending, submitted, under_review, approved, rejected, won, lost, or cancelled",
            },
          )
          .optional(),
        priority: z
          .enum(["low", "medium", "high", "urgent"], {
            message: "Bid priority must be one of: low, medium, high, or urgent",
          })
          .optional(),
        primaryContactId: uuidSchema.optional().nullable(),
        propertyId: uuidSchema.optional().nullable(),
        projectName: z
          .string()
          .max(255, "Project name is too long (maximum 255 characters)")
          .optional(),
        siteAddress: z.string().optional(),
        buildingSuiteNumber: z
          .string()
          .max(100, "Building/Suite number is too long (maximum 100 characters)")
          .optional(),
        acrossValuations: z
          .string()
          .max(255, "Across valuations is too long (maximum 255 characters)")
          .optional(),
        scopeOfWork: z.string().optional(),
        specialRequirements: z.string().optional(),
        description: z.string().optional(),
        endDate: z
          .string()
          .regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "Date must be in YYYY-MM-DD format (e.g., 2024-01-15)",
          )
          .optional(),
        plannedStartDate: z
          .string()
          .regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "Date must be in YYYY-MM-DD format (e.g., 2024-01-15)",
          )
          .optional(),
        estimatedCompletion: z
          .string()
          .regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "Date must be in YYYY-MM-DD format (e.g., 2024-01-15)",
          )
          .optional(),
        removalDate: z
          .string()
          .regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "Date must be in YYYY-MM-DD format (e.g., 2024-01-15)",
          )
          .optional(),
        bidAmount: numericStringSchema.optional(),
        estimatedDuration: z
          .number()
          .int("Estimated duration must be a whole number")
          .positive("Estimated duration must be positive")
          .optional(),
        profitMargin: numericStringSchema.optional(),
        paymentTerms: z.string().optional(),
        warrantyPeriod: z
          .string()
          .max(50, "Warranty period is too long (maximum 50 characters)")
          .optional(),
        warrantyPeriodLabor: z
          .string()
          .max(50, "Warranty period labor is too long (maximum 50 characters)")
          .optional(),
        warrantyDetails: z.string().optional(),
        specialTerms: z.string().optional(),
        exclusions: z.string().optional(),
        proposalBasis: z.string().optional(),
        referenceDate: z
          .string()
          .max(50, "Reference date is too long (maximum 50 characters)")
          .optional(),
        templateSelection: z
          .string()
          .max(100, "Template selection is too long (maximum 100 characters)")
          .optional(),
        supervisorManager: z
          .number()
          .int("Supervisor manager ID must be a whole number")
          .positive("Supervisor manager ID must be a positive number")
          .optional(),
        primaryTechnicianId: z
          .number()
          .int("Primary technician ID must be a whole number")
          .positive("Primary technician ID must be a positive number")
          .optional(),
        assignedTo: uuidSchema.optional(),
        qtyNumber: z
          .string()
          .max(50, "Quantity number is too long (maximum 50 characters)")
          .optional(),
        marked: z
          .string()
          .max(20, "Marked value is too long (maximum 20 characters)")
          .optional(),
      })
      .optional(),

    financialBreakdown: z
      .object({
        materialsEquipment: z.string().optional(),
        labor: z.string().optional(),
        travel: z.string().optional(),
        operatingExpenses: z.string().optional(),
        totalCost: z.string().optional(),
        totalPrice: z.string().optional(),
        grossProfit: z.string().optional(),
      })
      .optional(),

    operatingExpenses: z
      .object({
        enabled: z.boolean().optional(),
        grossRevenuePreviousYear: z.string().optional(),
        currentBidAmount: z.string().optional(),
        operatingCostPreviousYear: z.string().optional(),
        inflationAdjustedOperatingCost: z.string().optional(),
        inflationRate: z.string().optional(),
        utilizationPercentage: z.string().optional(),
        calculatedOperatingCost: z.string().optional(),
        applyMarkup: z.boolean().optional(),
        markupPercentage: z.string().optional(),
        operatingPrice: z.string().optional(),
      })
      .optional(),

    materials: z
      .array(
        z.object({
          inventoryItemId: uuidSchema.optional(),
          customName: z.string().optional(),
          description: z.string(),
          quantity: z.string(),
          unitCost: z.string(),
          markup: z.string().optional(),
          totalCost: z.string(),
        }),
      )
      .optional(),

    laborAndTravel: z
      .object({
        labor: z.array(
          z.object({
            positionId: z.number().int().positive(),
            days: z.number().int().positive(),
            hoursPerDay: z.string(),
            totalHours: z.string(),
            costRate: z.string(),
            billableRate: z.string(),
            totalCost: z.string(),
            totalPrice: z.string(),
          }),
        ),
        travel: z.array(
          z.object({
            vehicleName: z.string().optional(),
            roundTripMiles: z.string(),
            mileageRate: z.string(),
            vehicleDayRate: z.string(),
            days: z.number().int().positive(),
            mileageCost: z.string(),
            vehicleCost: z.string(),
            markup: z.string().optional(),
            totalCost: z.string(),
            totalPrice: z.string(),
          }),
        ),
      })
      .optional(),

    planSpecData: z
      .object({
        plansReceivedDate: z.string().optional(),
        planRevision: z.string().max(100).optional(),
        planReviewNotes: z.string().optional(),
        specificationsReceivedDate: z.string().optional(),
        specificationRevision: z.string().max(100).optional(),
        specificationReviewNotes: z.string().optional(),
        complianceRequirements: z.string().optional(),
        codeComplianceStatus: z
          .enum(["pending", "compliant", "non_compliant", "under_review"])
          .optional(),
        addendaReceived: z.boolean().optional(),
        addendaCount: z.number().int().min(0).optional(),
        addendaNotes: z.string().optional(),
        specifications: z.string().optional(),
        designRequirements: z.string().optional(),
      })
      .optional(),

    surveyData: z
      .object({
        buildingNumber: z.string().optional(),
        siteLocation: z.string().optional(),
        workType: z.string().optional(),
        hasExistingUnit: z.boolean().optional(),
        unitTag: z.string().optional(),
        unitLocation: z.string().optional(),
        make: z.string().optional(),
        model: z.string().optional(),
        serial: z.string().optional(),
        systemType: z.string().optional(),
        powerStatus: z.string().optional(),
        voltagePhase: z.string().optional(),
        overallCondition: z.string().optional(),
        siteAccessNotes: z.string().optional(),
        additionalNotes: z.string().optional(),
        siteConditions: z.string().optional(),
        clientRequirements: z.string().optional(),
        termsAndConditions: z.string().optional(),
        dateOfSurvey: z.string().optional(),
        timeOfSurvey: z.string().optional(),
      })
      .optional(),

    designBuildData: z
      .object({
        designPhase: z
          .enum([
            "conceptual",
            "schematic",
            "design_development",
            "construction_documents",
            "bidding",
            "construction_admin",
          ])
          .optional(),
        designStartDate: z.string().optional(),
        designCompletionDate: z.string().optional(),
        designTeamMembers: z.string().optional(),
        conceptDescription: z.string().optional(),
        designRequirements: z.string().optional(),
        designDeliverables: z.string().optional(),
        clientApprovalRequired: z.boolean().optional(),
        designFeeBasis: z
          .enum(["fixed", "hourly", "percentage", "lump_sum"])
          .optional(),
        designFees: z.string().optional(),
        buildSpecifications: z.string().optional(),
      })
      .optional(),

    timeline: z
      .array(
        z.object({
          id: uuidSchema.optional(), // If provided, update existing; otherwise create new
          event: z
            .string()
            .min(1, "Timeline event name is required")
            .max(255, "Timeline event name is too long (maximum 255 characters)")
            .trim(),
          eventDate: z
            .string()
            .datetime(
              "Invalid datetime format. Please use ISO 8601 format (e.g., 2024-01-15T10:30:00Z)",
            ),
          estimatedDuration: z
            .number()
            .int("Estimated duration must be a whole number")
            .positive("Estimated duration must be positive"),
          durationType: timelineDurationTypeEnum,
          isCompleted: z.boolean().optional().default(false),
          description: z.string().optional(),
          sortOrder: z
            .number()
            .int("Sort order must be a whole number")
            .optional()
            .default(0),
          _delete: z.boolean().optional(), // If true, delete this event
        }),
      )
      .optional(),

    notes: z
      .array(
        z.object({
          id: uuidSchema.optional(), // If provided, update existing; otherwise create new
          note: z.string().min(1, "Note content is required").trim(),
          isInternal: z.boolean().optional().default(true),
          _delete: z.boolean().optional(), // If true, delete this note
        }),
      )
      .optional(),

    // Document operations
    documentIdsToUpdate: z.array(uuidSchema).optional(),
    documentUpdates: z
      .array(
        z.object({
          fileName: z.string().max(255).optional(),
          documentType: z.string().max(50).optional(),
        }),
      )
      .optional(),
    documentIdsToDelete: z.array(uuidSchema).optional(),

    // Media operations
    mediaIdsToUpdate: z.array(uuidSchema).optional(),
    mediaUpdates: z
      .array(
        z.object({
          fileName: z.string().max(255).optional(),
          mediaType: z.string().max(50).optional(),
        }),
      )
      .optional(),
    mediaIdsToDelete: z.array(uuidSchema).optional(),
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
  query: z
    .object({
      roleName: z.string().min(1).optional(),
    })
    .optional(),
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
    estimatedDuration: z
      .number()
      .int("Estimated duration must be a whole number")
      .positive("Estimated duration must be positive"),
    durationType: timelineDurationTypeEnum,
    isCompleted: z.boolean().optional().default(false),
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
    estimatedDuration: z
      .number()
      .int("Estimated duration must be a whole number")
      .positive("Estimated duration must be positive")
      .optional(),
    durationType: timelineDurationTypeEnum.optional(),
    isCompleted: z.boolean().optional(),
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
// Task Comments Validations
// ============================

export const getTaskCommentsSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    taskId: uuidSchema,
  }),
});

export const getTaskCommentByIdSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    taskId: uuidSchema,
    id: uuidSchema,
  }),
});

export const createTaskCommentSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    taskId: uuidSchema,
  }),
  body: z.object({
    comment: z.string().min(1, "Comment is required"),
  }),
});

export const updateTaskCommentSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    taskId: uuidSchema,
    id: uuidSchema,
  }),
  body: z.object({
    comment: z.string().min(1).optional(),
  }),
});

export const deleteTaskCommentSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    taskId: uuidSchema,
    id: uuidSchema,
  }),
});

// ============================
// Job Survey Validations
// ============================

const jobSurveyBodySchema = z.object({
  buildingNumber: z.string().max(100).optional(),
  unitTagLabel: z.string().max(100).optional(),
  unitLocation: z.string().max(255).optional(),
  technicianId: z.coerce.number().int().optional(),
  make: z.string().max(255).optional(),
  modelNumber: z.string().max(255).optional(),
  serialNumber: z.string().max(255).optional(),
  systemType: z.string().max(100).optional(),
  powerStatus: z.string().max(100).optional(),
  voltagePhase: z.string().max(100).optional(),
  overallUnitCondition: z.string().max(100).optional(),
  physicalConditionNotes: z.string().optional(),
  corrosionOrRust: z.boolean().optional(),
  debrisOrBlockage: z.boolean().optional(),
  refrigerantLineCondition: z.string().max(255).optional(),
  electricalComponentsCondition: z.string().max(255).optional(),
  ductingCondition: z.string().max(255).optional(),
  condensateLineCondition: z.string().max(100).optional(),
  cabinetIntegrity: z.string().max(255).optional(),
  filterPresent: z.boolean().optional(),
  filterSize: z.string().max(100).optional(),
  filterCondition: z.string().max(100).optional(),
  blowerMotorStatus: z.string().max(255).optional(),
  blowerMotorCondition: z.string().max(255).optional(),
  airflowOutput: z.string().max(100).optional(),
  beltCondition: z.string().max(255).optional(),
  temperatureSplitSupplyF: numericStringSchema.optional(),
  temperatureSplitReturnF: numericStringSchema.optional(),
  coolingCoilCondition: z.string().max(255).optional(),
  compressorStatus: z.string().max(255).optional(),
  refrigerantLineTemperatureF: numericStringSchema.optional(),
  coolingFunctionality: z.string().max(100).optional(),
  heatingFunctionality: z.string().max(100).optional(),
  gasValveCondition: z.string().max(255).optional(),
  heatingCoilCondition: z.string().max(255).optional(),
  photosMedia: z.array(z.string()).optional().nullable(),
  pros: z.string().optional(),
  cons: z.string().optional(),
  status: z.enum(["draft", "submitted", "completed"]).optional(),
});

export const getJobSurveysSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

export const getJobSurveyByIdSchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    id: uuidSchema,
  }),
});

export const createJobSurveySchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
  body: jobSurveyBodySchema.optional(),
});

export const updateJobSurveySchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    id: uuidSchema,
  }),
  body: jobSurveyBodySchema,
});

export const deleteJobSurveySchema = z.object({
  params: z.object({
    jobId: uuidSchema,
    id: uuidSchema,
  }),
});

// ============================
// Expenses Validations
// ============================

/** Job expense types (matches UI: Materials, Equipment, Transportation, Permits, Subcontractor, Utilities, Tools, Safety Equipment, Other) */
export const JOB_EXPENSE_TYPES = [
  "materials",
  "equipment",
  "transportation",
  "permits",
  "subcontractor",
  "utilities",
  "tools",
  "safety_equipment",
  "other",
] as const;

const jobExpenseTypeSchemaRaw = z.enum(JOB_EXPENSE_TYPES, {
  message:
    "Expense type must be one of: Materials, Equipment, Transportation, Permits, Subcontractor, Utilities, Tools, Safety Equipment, Other",
});

/** Accepts UI labels (e.g. "Safety Equipment") or API values (e.g. "safety_equipment") and normalizes to API form. */
export const jobExpenseTypeSchema = z.preprocess(
  (v) =>
    typeof v === "string"
      ? (v as string).toLowerCase().trim().replace(/\s+/g, "_")
      : v,
  jobExpenseTypeSchemaRaw
);

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
    expenseType: jobExpenseTypeSchema,
    category: expenseCategoryEnum.optional(), // optional; service defaults if omitted
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
      expenseType: jobExpenseTypeSchema.optional(),
      category: expenseCategoryEnum.optional(),
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

// Get job invoice KPIs validation
export const getJobInvoiceKPIsSchema = z.object({
  params: z.object({
    jobId: z.string().uuid("Job ID must be a valid UUID"),
  }),
});

// Get job labor cost tracking validation
export const getJobLaborCostTrackingSchema = z.object({
  params: z.object({
    jobId: z.string().uuid("Job ID must be a valid UUID"),
  }),
});
