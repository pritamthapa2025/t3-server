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

const bidStatusEnum = z.enum(
  [
    "draft",
    "in_progress",
    "pending",
    "submitted",
    "accepted",
    "won",
    "rejected",
    "lost",
    "expired",
    "cancelled",
  ],
  {
    message:
      "Status must be one of: draft, in_progress, pending, submitted, accepted, won, rejected, lost, expired, or cancelled",
  },
);

const bidPriorityEnum = z.enum(["low", "medium", "high", "urgent"], {
  message: "Priority must be one of: low, medium, high, or urgent",
});

const bidJobTypeEnum = z.enum(
  [
    "general",
    "plan_spec",
    "design_build",
    "service",
    "preventative_maintenance",
    "survey",
  ],
  {
    message:
      "Job type must be one of: general, plan_spec, design_build, service, preventative_maintenance, or survey",
  },
);

const timelineDurationTypeEnum = z.enum(["days", "weeks", "months"], {
  message: "Duration type must be one of: days, weeks, or months",
});

// ============================
// Main Bid Validations
// ============================

export const getBidsQuerySchema = z.object({
  query: z.object({
    organizationId: uuidSchema.optional(), // Optional: Client organization ID (not T3). If not provided, returns all bids
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
    status: bidStatusEnum.optional(),
    jobType: bidJobTypeEnum.optional(),
    priority: bidPriorityEnum.optional(),
    assignedTo: uuidSchema.optional(),
    search: z.string().optional(),
  }),
});

export const getBidByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const getRelatedBidsSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

export const createBidSchema = z.object({
  body: z
    .object({
      organizationId: uuidSchema, // Required: Client organization ID (not T3)
      primaryContactId: uuidSchema.optional().nullable(),
      propertyId: uuidSchema.optional().nullable(),
      jobType: bidJobTypeEnum,
      status: bidStatusEnum.optional().default("draft"),
      priority: bidPriorityEnum.optional().default("medium"),
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
      convertToJob: z.boolean().optional(),

      // Nested objects for related data
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

      // Plan Spec specific data
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

      // Survey specific data
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

      // Design Build specific data
      designBuildData: z
        .object({
          // Design Phase Information
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
          // Design Team
          designTeamMembers: z.string().optional(), // JSON array of employee IDs
          // Design Scope & Requirements
          conceptDescription: z.string().optional(),
          designRequirements: z.string().optional(),
          designDeliverables: z.string().optional(),
          // Client Approval
          clientApprovalRequired: z.boolean().optional(),
          // Design Costs
          designFeeBasis: z
            .enum(["fixed", "hourly", "percentage", "lump_sum"])
            .optional(),
          designFees: z.string().optional(),
          // Legacy/Construction
          buildSpecifications: z.string().optional(),
        })
        .optional(),
    })
    .refine(
      (data) => {
        if (!data.endDate) return true;
        const today = new Date().toISOString().split("T")[0] ?? "";
        return today ? data.endDate >= today : true;
      },
      {
        message:
          "endDate cannot be before created date; must be same or future date",
      },
    ),
});

export const updateBidSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    status: bidStatusEnum.optional(),
    priority: bidPriorityEnum.optional(),
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
    convertToJob: z.boolean().optional(),

    // Nested objects for related data (same as create)
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

    // Plan Spec specific data
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

    // Survey specific data
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

    // Design Build specific data
    designBuildData: z
      .object({
        // Design Phase Information
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
        // Design Team
        designTeamMembers: z.string().optional(), // JSON array of employee IDs
        // Design Scope & Requirements
        conceptDescription: z.string().optional(),
        designRequirements: z.string().optional(),
        designDeliverables: z.string().optional(),
        // Client Approval
        clientApprovalRequired: z.boolean().optional(),
        // Design Costs
        designFeeBasis: z
          .enum(["fixed", "hourly", "percentage", "lump_sum"])
          .optional(),
        designFees: z.string().optional(),
        // Legacy/Construction
        buildSpecifications: z.string().optional(),
      })
      .optional(),

    // Document operations (optional)
    // For adding new documents: upload files with document_0, document_1, etc.

    // For updating existing documents: array of document IDs to update
    documentIdsToUpdate: z.array(uuidSchema).optional(),

    // Update data for documents (must match order of documentIdsToUpdate)
    documentUpdates: z
      .array(
        z.object({
          fileName: z.string().max(255).optional(),
          documentType: z.string().max(50).optional(),
        }),
      )
      .optional(),

    // For deleting documents: array of document IDs to delete
    documentIdsToDelete: z.array(uuidSchema).optional(),
  }),
});

export const deleteBidSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ============================
// Financial Breakdown Validations
// ============================

export const updateFinancialBreakdownSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    materialsEquipment: numericStringSchema.optional(),
    labor: numericStringSchema.optional(),
    travel: numericStringSchema.optional(),
    operatingExpenses: numericStringSchema.optional(),
    totalCost: numericStringSchema.optional(),
    totalPrice: numericStringSchema.optional(),
    grossProfit: numericStringSchema.optional(),
  }),
});

// ============================
// Operating Expenses Validations
// ============================

export const getBidOperatingExpensesSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

export const createBidOperatingExpensesSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    enabled: z.boolean().optional(),
    grossRevenuePreviousYear: numericStringSchema.optional(),
    currentBidAmount: numericStringSchema.optional(),
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

export const updateBidOperatingExpensesSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    enabled: z.boolean().optional(),
    grossRevenuePreviousYear: numericStringSchema.optional(),
    currentBidAmount: numericStringSchema.optional(),
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

export const deleteBidOperatingExpensesSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

// ============================
// Materials Validations
// ============================

export const getBidMaterialsSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

export const getBidMaterialByIdSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    materialId: uuidSchema,
  }),
});

export const createBidMaterialSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    inventoryItemId: uuidSchema.optional(),
    customeName: z.string().optional(),
    description: z
      .string()
      .min(1, "Material description is required and cannot be empty")
      .trim(),
    quantity: numericStringSchema,
    unitCost: numericStringSchema,
    markup: numericStringSchema.optional().default("0"),
    totalCost: numericStringSchema,
  }),
});

export const updateBidMaterialSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    materialId: uuidSchema,
  }),
  body: z.object({
    inventoryItemId: uuidSchema.optional(),
    customName: z.string().optional(),
    description: z
      .string()
      .min(1, "Material description cannot be empty")
      .trim()
      .optional(),
    quantity: numericStringSchema.optional(),
    unitCost: numericStringSchema.optional(),
    markup: numericStringSchema.optional(),
    totalCost: numericStringSchema.optional(),
  }),
});

export const deleteBidMaterialSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    materialId: uuidSchema,
  }),
});

// ============================
// Labor Validations
// ============================

export const getBidLaborSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

export const getBidLaborByIdSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    laborId: uuidSchema,
  }),
});

export const createBidLaborSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    positionId: z
      .number()
      .int("Position ID must be a whole number")
      .positive("Position ID must be a positive number"),
    days: z
      .number()
      .int("Days must be a whole number")
      .positive("Days must be a positive number"),
    hoursPerDay: numericStringSchema,
    totalHours: numericStringSchema,
    costRate: numericStringSchema,
    billableRate: numericStringSchema,
    totalCost: numericStringSchema,
    totalPrice: numericStringSchema,
  }),
});

export const updateBidLaborSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    laborId: uuidSchema,
  }),
  body: z.object({
    positionId: z
      .number()
      .int("Position ID must be a whole number")
      .positive("Position ID must be a positive number")
      .optional(),
    days: z
      .number()
      .int("Days must be a whole number")
      .positive("Days must be a positive number")
      .optional(),
    hoursPerDay: numericStringSchema.optional(),
    totalHours: numericStringSchema.optional(),
    costRate: numericStringSchema.optional(),
    billableRate: numericStringSchema.optional(),
    totalCost: numericStringSchema.optional(),
    totalPrice: numericStringSchema.optional(),
  }),
});

export const deleteBidLaborSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    laborId: uuidSchema,
  }),
});

// ============================
// Travel Validations
// ============================

export const getBidTravelSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    laborId: uuidSchema,
  }),
});

export const getAllBidTravelSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

export const getBidTravelByIdSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    travelId: uuidSchema,
  }),
});

export const createBidTravelDirectSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    laborId: uuidSchema, // Which labor entry this travel belongs to
    employeeName: z
      .string()
      .max(255, "Employee name is too long (maximum 255 characters)")
      .optional(),
    vehicleName: z
      .string()
      .max(255, "Vehicle name is too long (maximum 255 characters)")
      .optional(),
    roundTripMiles: numericStringSchema,
    mileageRate: numericStringSchema,
    vehicleDayRate: numericStringSchema,
    days: z
      .number()
      .int("Days must be a whole number")
      .positive("Days must be a positive number"),
    mileageCost: numericStringSchema,
    vehicleCost: numericStringSchema,
    markup: numericStringSchema.optional().default("0"),
    totalCost: numericStringSchema,
    totalPrice: numericStringSchema,
  }),
});

export const updateBidTravelDirectSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    travelId: uuidSchema,
  }),
  body: z.object({
    employeeName: z
      .string()
      .max(255, "Employee name is too long (maximum 255 characters)")
      .optional(),
    vehicleName: z
      .string()
      .max(255, "Vehicle name is too long (maximum 255 characters)")
      .optional(),
    roundTripMiles: numericStringSchema.optional(),
    mileageRate: numericStringSchema.optional(),
    vehicleDayRate: numericStringSchema.optional(),
    days: z
      .number()
      .int("Days must be a whole number")
      .positive("Days must be a positive number")
      .optional(),
    mileageCost: numericStringSchema.optional(),
    vehicleCost: numericStringSchema.optional(),
    markup: numericStringSchema.optional(),
    totalCost: numericStringSchema.optional(),
    totalPrice: numericStringSchema.optional(),
  }),
});

export const deleteBidTravelDirectSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    travelId: uuidSchema,
  }),
});

export const createBidTravelSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    laborId: uuidSchema,
  }),
  body: z.object({
    // Note: vehicleName removed - derived from bidLabor → positionId → employee → assigned vehicle
    roundTripMiles: numericStringSchema,
    mileageRate: numericStringSchema,
    vehicleDayRate: numericStringSchema,
    days: z
      .number()
      .int("Days must be a whole number")
      .positive("Days must be a positive number"),
    mileageCost: numericStringSchema,
    vehicleCost: numericStringSchema,
    markup: numericStringSchema.optional().default("0"),
    totalCost: numericStringSchema,
    totalPrice: numericStringSchema,
  }),
});

export const updateBidTravelSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    laborId: uuidSchema,
    travelId: uuidSchema,
  }),
  body: z.object({
    vehicleName: z
      .string()
      .max(255, "Vehicle name is too long (maximum 255 characters)")
      .optional(),
    roundTripMiles: numericStringSchema.optional(),
    mileageRate: numericStringSchema.optional(),
    vehicleDayRate: numericStringSchema.optional(),
    days: z
      .number()
      .int("Days must be a whole number")
      .positive("Days must be a positive number")
      .optional(),
    mileageCost: numericStringSchema.optional(),
    vehicleCost: numericStringSchema.optional(),
    markup: numericStringSchema.optional(),
    totalCost: numericStringSchema.optional(),
    totalPrice: numericStringSchema.optional(),
  }),
});

export const deleteBidTravelSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    laborId: uuidSchema,
    travelId: uuidSchema,
  }),
});

// ============================
// Bulk Labor & Travel Validations
// ============================

export const createBulkLaborAndTravelSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z
    .object({
      labor: z
        .array(
          z.object({
            positionId: z
              .number()
              .int("Position ID must be a whole number")
              .positive("Position ID must be a positive number"),
            days: z
              .number()
              .int("Days must be a whole number")
              .positive("Days must be a positive number"),
            hoursPerDay: numericStringSchema,
            totalHours: numericStringSchema,
            costRate: numericStringSchema,
            billableRate: numericStringSchema,
            totalCost: numericStringSchema,
            totalPrice: numericStringSchema,
          }),
        )
        .min(1, "At least one labor entry is required"),
      travel: z
        .array(
          z.object({
            employeeName: z
              .string()
              .max(255, "Employee name is too long (maximum 255 characters)")
              .optional(),
            vehicleName: z
              .string()
              .max(255, "Vehicle name is too long (maximum 255 characters)")
              .optional(),
            roundTripMiles: numericStringSchema,
            mileageRate: numericStringSchema,
            vehicleDayRate: numericStringSchema,
            days: z
              .number()
              .int("Days must be a whole number")
              .positive("Days must be a positive number"),
            mileageCost: numericStringSchema,
            vehicleCost: numericStringSchema,
            markup: numericStringSchema.optional().default("0"),
            totalCost: numericStringSchema,
            totalPrice: numericStringSchema,
          }),
        )
        .min(1, "At least one travel entry is required"),
    })
    .refine((data) => data.labor.length === data.travel.length, {
      message: "Number of labor entries must equal number of travel entries",
      path: ["travel"],
    }),
});

// ============================
// Job-Type Specific Data Validations
// ============================

export const updateBidSurveyDataSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    buildingNumber: z
      .string()
      .max(100, "Building number is too long (maximum 100 characters)")
      .optional(),
    siteLocation: z.string().optional(),
    workType: z
      .string()
      .max(50, "Work type is too long (maximum 50 characters)")
      .optional(),
    hasExistingUnit: z.boolean().optional(),
    unitTag: z
      .string()
      .max(100, "Unit tag is too long (maximum 100 characters)")
      .optional(),
    unitLocation: z
      .string()
      .max(255, "Unit location is too long (maximum 255 characters)")
      .optional(),
    make: z
      .string()
      .max(100, "Make is too long (maximum 100 characters)")
      .optional(),
    model: z
      .string()
      .max(100, "Model is too long (maximum 100 characters)")
      .optional(),
    serial: z
      .string()
      .max(100, "Serial number is too long (maximum 100 characters)")
      .optional(),
    systemType: z
      .string()
      .max(100, "System type is too long (maximum 100 characters)")
      .optional(),
    powerStatus: z
      .string()
      .max(50, "Power status is too long (maximum 50 characters)")
      .optional(),
    voltagePhase: z
      .string()
      .max(50, "Voltage/Phase is too long (maximum 50 characters)")
      .optional(),
    overallCondition: z
      .string()
      .max(100, "Overall condition is too long (maximum 100 characters)")
      .optional(),
    siteAccessNotes: z.string().optional(),
    additionalNotes: z.string().optional(),
    siteConditions: z.string().optional(),
    clientRequirements: z.string().optional(),
    termsAndConditions: z.string().optional(),
    dateOfSurvey: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
      .optional(),
    timeOfSurvey: z
      .string()
      .regex(/^\d{2}:\d{2}:\d{2}$/, "Time must be in HH:MM:SS format")
      .optional(),
  }),
});

export const updateBidPlanSpecDataSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    specifications: z.string().optional(),
    designRequirements: z.string().optional(),
  }),
});

export const updateBidDesignBuildDataSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    designRequirements: z.string().optional(),
    buildSpecifications: z.string().optional(),
  }),
});

// ============================
// Timeline Validations
// ============================

export const getBidTimelineSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

export const createBidTimelineEventSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    event: z
      .string()
      .min(1, "Timeline event name is required and cannot be empty")
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
  }),
});

export const updateBidTimelineEventSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    eventId: uuidSchema,
  }),
  body: z.object({
    event: z
      .string()
      .min(1, "Timeline event name cannot be empty")
      .max(255, "Timeline event name is too long (maximum 255 characters)")
      .trim()
      .optional(),
    eventDate: z
      .string()
      .datetime(
        "Invalid datetime format. Please use ISO 8601 format (e.g., 2024-01-15T10:30:00Z)",
      )
      .optional(),
    estimatedDuration: z
      .number()
      .int("Estimated duration must be a whole number")
      .positive("Estimated duration must be positive")
      .optional(),
    durationType: timelineDurationTypeEnum.optional(),
    isCompleted: z.boolean().optional(),
    description: z.string().optional(),
    sortOrder: z.number().int("Sort order must be a whole number").optional(),
  }),
});

export const deleteBidTimelineEventSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    eventId: uuidSchema,
  }),
});

// ============================
// Notes Validations
// ============================

export const getBidNotesSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

export const createBidNoteSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    note: z
      .string()
      .min(1, "Note content is required and cannot be empty")
      .trim(),
    isInternal: z.boolean().optional().default(true),
  }),
});

export const updateBidNoteSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    noteId: uuidSchema,
  }),
  body: z.object({
    note: z.string().min(1, "Note content cannot be empty").trim().optional(),
    isInternal: z.boolean().optional(),
  }),
});

export const deleteBidNoteSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    noteId: uuidSchema,
  }),
});

// ============================
// History Validations
// ============================

export const getBidHistorySchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

// ============================
// Complete Bid Data Validation
// ============================

export const getBidWithAllDataSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ============================
// Bid Documents Validations
// ============================

export const createBidDocumentsSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({}).optional(),
});

export const getBidDocumentsSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

export const getBidDocumentByIdSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    documentId: uuidSchema,
  }),
});

export const updateBidDocumentSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
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

export const deleteBidDocumentSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    documentId: uuidSchema,
  }),
});

// ============================
// Bid Media Validations
// ============================

export const createBidMediaSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    caption: z.string().optional(),
  }).optional(),
});

export const getBidMediaSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

export const getBidMediaByIdSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    mediaId: uuidSchema,
  }),
});

export const updateBidMediaSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    mediaId: uuidSchema,
  }),
  body: z.object({
    fileName: z
      .string()
      .max(255, "File name is too long (maximum 255 characters)")
      .optional(),
    mediaType: z
      .string()
      .max(50, "Media type is too long (maximum 50 characters)")
      .optional(),
    caption: z.string().optional(),
  }),
});

export const deleteBidMediaSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    mediaId: uuidSchema,
  }),
});

export const downloadBidQuotePDFSchema = z.object({
  params: z.object({ id: uuidSchema }),
});

export const previewBidQuotePDFSchema = z.object({
  params: z.object({ id: uuidSchema }),
});

export const sendQuoteSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z
    .object({
      subject: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

/** Send quote to test email only (POST /bids/:id/send-test) */
export const sendQuoteTestSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z
    .object({
      subject: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
});
