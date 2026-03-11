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
    "needs_review",
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
      "Status must be one of: draft, in_progress, pending, needs_review, submitted, accepted, won, rejected, lost, expired, or cancelled",
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
    status: z
      .union([bidStatusEnum, z.array(bidStatusEnum)])
      .optional()
      .transform((val) =>
        val === undefined ? undefined : Array.isArray(val) ? val : [val],
      ),
    jobType: bidJobTypeEnum.optional(),
    priority: bidPriorityEnum.optional(),
    assignedTo: uuidSchema.optional(),
    search: z.string().optional(),
    sortBy: z
      .enum(["newest", "oldest", "value_high", "value_low"], {
        message: "sortBy must be one of: newest, oldest, value_high, value_low",
      })
      .optional(),
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

export const getBidVersionInfoSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

export const getBidKPIsSchema = z.object({
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
      parentBidId: uuidSchema.optional().nullable(),
      rootBidId: uuidSchema.optional().nullable(),
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

      // Additional project & contact fields
      industryClassification: z.string().max(255).optional(),
      scheduledDateTime: z.string().datetime().optional(),
      termsTemplateSelection: z.string().max(100).optional(),
      siteContactName: z.string().max(255).optional(),
      siteContactPhone: z.string().max(50).optional(),
      accessInstructions: z.string().optional(),

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
          actualMaterialsEquipment: z.string().optional(),
          actualLabor: z.string().optional(),
          actualTravel: z.string().optional(),
          actualOperatingExpenses: z.string().optional(),
          actualTotalCost: z.string().optional(),
          actualTotalPrice: z.string().optional(),
          actualGrossProfit: z.string().optional(),
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
          actualCurrentBidAmount: z.string().optional(),
          actualCalculatedOperatingCost: z.string().optional(),
          actualInflationAdjustedOperatingCost: z.string().optional(),
          actualOperatingPrice: z.string().optional(),
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
            totalPrice: z.string().optional(),
          }),
        )
        .optional(),

      laborAndTravel: z
        .object({
          labor: z.array(
            z.object({
              positionId: z.number().int().positive().optional().nullable(),
              customRole: z.string().max(255).optional(),
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
          // New survey bid fields
          surveyType: z
            .enum([
              "new-installation",
              "existing-assessment",
              "energy-audit",
              "feasibility-study",
            ])
            .optional(),
          numberOfBuildings: z.number().int().positive().optional(),
          expectedUnitsToSurvey: z.number().int().positive().optional(),
          buildingNumbers: z.string().optional(), // JSON array
          unitTypes: z.string().optional(), // JSON array
          includePhotoDocumentation: z.boolean().optional(),
          includePerformanceTesting: z.boolean().optional(),
          includeEnergyAnalysis: z.boolean().optional(),
          includeRecommendations: z.boolean().optional(),
          schedulingConstraints: z.string().optional(),
          technicianId: z.number().int().positive().optional().nullable(),
          // Pricing
          pricingModel: z
            .enum(["flat_fee", "per_unit", "time_materials"])
            .optional(),
          flatSurveyFee: z.string().optional(),
          pricePerUnit: z.string().optional(),
          estimatedHours: z.string().optional(),
          hourlyRate: z.string().optional(),
          estimatedExpenses: z.string().optional(),
          totalSurveyFee: z.string().optional(),
          // Survey metadata
          surveyDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          surveyBy: z.string().max(255).optional(),
          surveyNotes: z.string().optional(),
          accessRequirements: z.string().optional(),
          utilityLocations: z.string().optional(),
          existingEquipment: z.string().optional(),
          measurements: z.string().optional(),
          photos: z.string().optional(), // JSON array
          // Shared notes
          siteAccessNotes: z.string().optional(),
          additionalNotes: z.string().optional(),
          clientRequirements: z.string().optional(),
          termsAndConditions: z.string().optional(),
          // Legacy fields (kept for backward compat)
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
          siteConditions: z.string().optional(),
          dateOfSurvey: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          timeOfSurvey: z
            .string()
            .regex(/^\d{2}:\d{2}:\d{2}$/)
            .optional(),
        })
        .optional(),

      // Design Build specific data
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
          approvalMilestones: z.string().optional(),
          designRevisionLimit: z.number().int().min(0).optional(),
          designFeeBasis: z
            .enum(["fixed", "hourly", "percentage", "lump_sum"])
            .optional(),
          designPrice: z.string().optional(),
          designCost: z.string().optional(),
          buildSpecifications: z.string().optional(),
        })
        .optional(),

      // Service specific data
      serviceData: z
        .object({
          // Bid-creation fields
          serviceType: z
            .enum([
              "emergency_repair",
              "scheduled_repair",
              "diagnostic",
              "installation",
              "other",
            ])
            .or(z.literal(""))
            .optional(),
          equipmentType: z
            .enum([
              "rooftop_unit",
              "split_system",
              "boiler",
              "chiller",
              "air_handler",
              "other",
            ])
            .or(z.literal(""))
            .optional(),
          issueCategory: z
            .enum([
              "cooling",
              "heating",
              "ventilation",
              "controls",
              "electrical",
              "plumbing",
              "other",
            ])
            .or(z.literal(""))
            .optional(),
          reportedIssue: z.string().optional(),
          preliminaryAssessment: z.string().optional(),
          estimatedWorkScope: z.string().optional(),
          leadTechnicianId: z.number().int().positive().optional().nullable(),
          helperTechnicianId: z.number().int().positive().optional().nullable(),
          pricingModel: z
            .enum(["time_materials", "flat_rate", "diagnostic_repair"])
            .or(z.literal(""))
            .optional(),
          numberOfTechs: z.number().int().positive().optional(),
          laborHours: z.string().optional(),
          laborRate: z.string().optional(),
          materialsCost: z.string().optional(),
          travelCost: z.string().optional(),
          serviceMarkup: z.string().optional(),
          flatRatePrice: z.string().optional(),
          diagnosticFee: z.string().optional(),
          estimatedRepairCost: z.string().optional(),
          pricingNotes: z.string().optional(),
          // Execution-phase fields
          serviceCallTechnician: z
            .number()
            .int()
            .positive()
            .optional()
            .nullable(),
          timeIn: z.string().max(50).optional().nullable(),
          timeOut: z.string().max(50).optional().nullable(),
          serviceDescription: z.string().optional().nullable(),
          plumbingSystemCheck: z.boolean().optional(),
          thermostatCheck: z.boolean().optional(),
          hvacSystemCheck: z.boolean().optional(),
          clientCommunicationCheck: z.boolean().optional(),
          customerSignaturePath: z.string().max(500).optional().nullable(),
          customerSignatureDate: z.string().datetime().optional().nullable(),
          serviceNotes: z.string().optional().nullable(),
        })
        .optional(),

      // Preventative Maintenance specific data
      preventativeMaintenanceData: z
        .object({
          pmType: z
            .enum(["new_pm_bid", "existing_pm_renewal"])
            .optional()
            .nullable(),
          previousPmJobId: z.string().max(100).optional().nullable(),
          maintenanceFrequency: z
            .enum(["quarterly", "semi_annual", "annual"])
            .optional()
            .nullable(),
          numberOfBuildings: z.number().int().positive().optional().nullable(),
          numberOfUnits: z.number().int().positive().optional().nullable(),
          buildingNumbers: z.string().optional().nullable(),
          expectedUnitTags: z.string().optional().nullable(),
          filterReplacementIncluded: z.boolean().optional(),
          coilCleaningIncluded: z.boolean().optional(),
          temperatureReadingsIncluded: z.boolean().optional(),
          visualInspectionIncluded: z.boolean().optional(),
          serviceScope: z.string().optional().nullable(),
          specialRequirements: z.string().optional().nullable(),
          clientPmRequirements: z.string().optional().nullable(),
          // Pricing
          pricingModel: z
            .enum(["per_unit", "flat_rate", "annual_contract"])
            .optional()
            .nullable(),
          pricePerUnit: z.string().optional().nullable(),
          flatRatePerVisit: z.string().optional().nullable(),
          annualContractValue: z.string().optional().nullable(),
          includeFilterReplacement: z.boolean().optional(),
          filterReplacementCost: z.string().optional().nullable(),
          includeCoilCleaning: z.boolean().optional(),
          coilCleaningCost: z.string().optional().nullable(),
          emergencyServiceRate: z.string().optional().nullable(),
          paymentSchedule: z
            .enum(["annual", "per_visit", "quarterly"])
            .optional()
            .nullable(),
          pricingNotes: z.string().optional().nullable(),
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
    parentBidId: uuidSchema.optional().nullable(),
    rootBidId: uuidSchema.optional().nullable(),
    versionNumber: z.number().int().positive().optional(),
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

    // Additional project & contact fields
    industryClassification: z.string().max(255).optional(),
    scheduledDateTime: z.string().datetime().optional(),
    termsTemplateSelection: z.string().max(100).optional(),
    siteContactName: z.string().max(255).optional(),
    siteContactPhone: z.string().max(50).optional(),
    accessInstructions: z.string().optional(),

    // Lifecycle / post-decision fields (update only)
    finalBidAmount: z.string().optional(),
    actualCost: z.string().optional(),
    submittedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    decisionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    convertedToJobId: uuidSchema.optional().nullable(),
    conversionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    lostReason: z.string().optional(),
    rejectionReason: z.string().optional(),

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
        actualMaterialsEquipment: z.string().optional(),
        actualLabor: z.string().optional(),
        actualTravel: z.string().optional(),
        actualOperatingExpenses: z.string().optional(),
        actualTotalCost: z.string().optional(),
        actualTotalPrice: z.string().optional(),
        actualGrossProfit: z.string().optional(),
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
        actualCurrentBidAmount: z.string().optional(),
        actualCalculatedOperatingCost: z.string().optional(),
        actualInflationAdjustedOperatingCost: z.string().optional(),
        actualOperatingPrice: z.string().optional(),
      })
      .optional(),

    materials: z
      .array(
        z.object({
          id: uuidSchema.optional(),
          inventoryItemId: uuidSchema.optional(),
          customName: z.string().optional(),
          description: z.string(),
          quantity: z.string(),
          unitCost: z.string(),
          markup: z.string().optional(),
          totalCost: z.string(),
          totalPrice: z.string().optional(),
        }),
      )
      .optional(),

    laborAndTravel: z
      .object({
        labor: z.array(
          z.object({
            id: uuidSchema.optional(),
            positionId: z.number().int().positive().optional().nullable(),
            customRole: z.string().max(255).optional(),
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
            id: uuidSchema.optional(),
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
        surveyType: z
          .enum([
            "new-installation",
            "existing-assessment",
            "energy-audit",
            "feasibility-study",
          ])
          .optional(),
        numberOfBuildings: z.number().int().positive().optional(),
        expectedUnitsToSurvey: z.number().int().positive().optional(),
        buildingNumbers: z.string().optional(),
        unitTypes: z.string().optional(),
        includePhotoDocumentation: z.boolean().optional(),
        includePerformanceTesting: z.boolean().optional(),
        includeEnergyAnalysis: z.boolean().optional(),
        includeRecommendations: z.boolean().optional(),
        schedulingConstraints: z.string().optional(),
        technicianId: z.number().int().positive().optional().nullable(),
        pricingModel: z
          .enum(["flat_fee", "per_unit", "time_materials"])
          .optional(),
        flatSurveyFee: z.string().optional(),
        pricePerUnit: z.string().optional(),
        estimatedHours: z.string().optional(),
        hourlyRate: z.string().optional(),
        estimatedExpenses: z.string().optional(),
        totalSurveyFee: z.string().optional(),
        surveyDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        surveyBy: z.string().max(255).optional(),
        surveyNotes: z.string().optional(),
        accessRequirements: z.string().optional(),
        utilityLocations: z.string().optional(),
        existingEquipment: z.string().optional(),
        measurements: z.string().optional(),
        photos: z.string().optional(),
        siteAccessNotes: z.string().optional(),
        additionalNotes: z.string().optional(),
        clientRequirements: z.string().optional(),
        termsAndConditions: z.string().optional(),
        // Legacy fields
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
        siteConditions: z.string().optional(),
        dateOfSurvey: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        timeOfSurvey: z
          .string()
          .regex(/^\d{2}:\d{2}:\d{2}$/)
          .optional(),
      })
      .optional(),

    // Design Build specific data
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
        approvalMilestones: z.string().optional(),
        designRevisionLimit: z.number().int().min(0).optional(),
        designFeeBasis: z
          .enum(["fixed", "hourly", "percentage", "lump_sum"])
          .optional(),
        designPrice: z.string().optional(),
        designCost: z.string().optional(),
        buildSpecifications: z.string().optional(),
      })
      .optional(),

    // Service specific data
    serviceData: z
      .object({
        serviceType: z
          .enum([
            "emergency_repair",
            "scheduled_repair",
            "diagnostic",
            "installation",
            "other",
          ])
          .or(z.literal(""))
          .optional(),
        equipmentType: z
          .enum([
            "rooftop_unit",
            "split_system",
            "boiler",
            "chiller",
            "air_handler",
            "other",
          ])
          .or(z.literal(""))
          .optional(),
        issueCategory: z
          .enum([
            "cooling",
            "heating",
            "ventilation",
            "controls",
            "electrical",
            "plumbing",
            "other",
          ])
          .or(z.literal(""))
          .optional(),
        reportedIssue: z.string().optional(),
        preliminaryAssessment: z.string().optional(),
        estimatedWorkScope: z.string().optional(),
        leadTechnicianId: z.number().int().positive().optional().nullable(),
        helperTechnicianId: z.number().int().positive().optional().nullable(),
        pricingModel: z
          .enum(["time_materials", "flat_rate", "diagnostic_repair"])
          .or(z.literal(""))
          .optional(),
        numberOfTechs: z.number().int().positive().optional(),
        laborHours: z.string().optional(),
        laborRate: z.string().optional(),
        materialsCost: z.string().optional(),
        travelCost: z.string().optional(),
        serviceMarkup: z.string().optional(),
        flatRatePrice: z.string().optional(),
        diagnosticFee: z.string().optional(),
        estimatedRepairCost: z.string().optional(),
        pricingNotes: z.string().optional(),
        // Execution-phase fields
        serviceCallTechnician: z
          .number()
          .int()
          .positive()
          .optional()
          .nullable(),
        timeIn: z.string().max(50).optional().nullable(),
        timeOut: z.string().max(50).optional().nullable(),
        serviceDescription: z.string().optional().nullable(),
        plumbingSystemCheck: z.boolean().optional(),
        thermostatCheck: z.boolean().optional(),
        hvacSystemCheck: z.boolean().optional(),
        clientCommunicationCheck: z.boolean().optional(),
        customerSignaturePath: z.string().max(500).optional().nullable(),
        customerSignatureDate: z.string().datetime().optional().nullable(),
        serviceNotes: z.string().optional().nullable(),
      })
      .optional(),

    // Preventative Maintenance specific data
    preventativeMaintenanceData: z
      .object({
        pmType: z
          .enum(["new_pm_bid", "existing_pm_renewal"])
          .optional()
          .nullable(),
        previousPmJobId: z.string().max(100).optional().nullable(),
        maintenanceFrequency: z
          .enum(["quarterly", "semi_annual", "annual"])
          .optional()
          .nullable(),
        numberOfBuildings: z.number().int().positive().optional().nullable(),
        numberOfUnits: z.number().int().positive().optional().nullable(),
        buildingNumbers: z.string().optional().nullable(),
        expectedUnitTags: z.string().optional().nullable(),
        filterReplacementIncluded: z.boolean().optional(),
        coilCleaningIncluded: z.boolean().optional(),
        temperatureReadingsIncluded: z.boolean().optional(),
        visualInspectionIncluded: z.boolean().optional(),
        serviceScope: z.string().optional().nullable(),
        specialRequirements: z.string().optional().nullable(),
        clientPmRequirements: z.string().optional().nullable(),
        pricingModel: z
          .enum(["per_unit", "flat_rate", "annual_contract"])
          .optional()
          .nullable(),
        pricePerUnit: z.string().optional().nullable(),
        flatRatePerVisit: z.string().optional().nullable(),
        annualContractValue: z.string().optional().nullable(),
        includeFilterReplacement: z.boolean().optional(),
        filterReplacementCost: z.string().optional().nullable(),
        includeCoilCleaning: z.boolean().optional(),
        coilCleaningCost: z.string().optional().nullable(),
        emergencyServiceRate: z.string().optional().nullable(),
        paymentSchedule: z
          .enum(["annual", "per_visit", "quarterly"])
          .optional()
          .nullable(),
        pricingNotes: z.string().optional().nullable(),
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
    actualMaterialsEquipment: numericStringSchema.optional(),
    actualLabor: numericStringSchema.optional(),
    actualTravel: numericStringSchema.optional(),
    actualOperatingExpenses: numericStringSchema.optional(),
    actualTotalCost: numericStringSchema.optional(),
    actualTotalPrice: numericStringSchema.optional(),
    actualGrossProfit: numericStringSchema.optional(),
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
    actualCurrentBidAmount: numericStringSchema.optional(),
    actualCalculatedOperatingCost: numericStringSchema.optional(),
    actualInflationAdjustedOperatingCost: numericStringSchema.optional(),
    actualOperatingPrice: numericStringSchema.optional(),
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
    actualCurrentBidAmount: numericStringSchema.optional(),
    actualCalculatedOperatingCost: numericStringSchema.optional(),
    actualInflationAdjustedOperatingCost: numericStringSchema.optional(),
    actualOperatingPrice: numericStringSchema.optional(),
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
    totalPrice: numericStringSchema.optional(),
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
    totalPrice: numericStringSchema.optional(),
    actualQuantity: numericStringSchema.optional(),
    actualUnitCost: numericStringSchema.optional(),
    actualMarkup: numericStringSchema.optional(),
    actualTotalCost: numericStringSchema.optional(),
    actualTotalPrice: numericStringSchema.optional(),
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
      .positive("Position ID must be a positive number")
      .optional()
      .nullable(),
    customRole: z
      .string()
      .max(255, "Custom role is too long (maximum 255 characters)")
      .optional(),
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
      .optional()
      .nullable(),
    customRole: z
      .string()
      .max(255, "Custom role is too long (maximum 255 characters)")
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
    actualDays: z.number().int().positive().optional(),
    actualHoursPerDay: numericStringSchema.optional(),
    actualTotalHours: numericStringSchema.optional(),
    actualCostRate: numericStringSchema.optional(),
    actualBillableRate: numericStringSchema.optional(),
    actualTotalCost: numericStringSchema.optional(),
    actualTotalPrice: numericStringSchema.optional(),
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
    actualRoundTripMiles: numericStringSchema.optional(),
    actualMileageRate: numericStringSchema.optional(),
    actualVehicleDayRate: numericStringSchema.optional(),
    actualDays: z.number().int().positive().optional(),
    actualMileageCost: numericStringSchema.optional(),
    actualVehicleCost: numericStringSchema.optional(),
    actualMarkup: numericStringSchema.optional(),
    actualTotalCost: numericStringSchema.optional(),
    actualTotalPrice: numericStringSchema.optional(),
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
              .positive("Position ID must be a positive number")
              .optional()
              .nullable(),
            customRole: z.string().max(255).optional(),
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
    // New survey bid fields
    surveyType: z
      .enum([
        "new-installation",
        "existing-assessment",
        "energy-audit",
        "feasibility-study",
      ])
      .optional(),
    numberOfBuildings: z.number().int().positive().optional(),
    expectedUnitsToSurvey: z.number().int().positive().optional(),
    buildingNumbers: z.string().optional(),
    unitTypes: z.string().optional(),
    includePhotoDocumentation: z.boolean().optional(),
    includePerformanceTesting: z.boolean().optional(),
    includeEnergyAnalysis: z.boolean().optional(),
    includeRecommendations: z.boolean().optional(),
    schedulingConstraints: z.string().optional(),
    technicianId: z.number().int().positive().optional().nullable(),
    pricingModel: z.enum(["flat_fee", "per_unit", "time_materials"]).optional(),
    flatSurveyFee: z.string().optional(),
    pricePerUnit: z.string().optional(),
    estimatedHours: z.string().optional(),
    hourlyRate: z.string().optional(),
    estimatedExpenses: z.string().optional(),
    totalSurveyFee: z.string().optional(),
    surveyDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    surveyBy: z.string().max(255).optional(),
    surveyNotes: z.string().optional(),
    accessRequirements: z.string().optional(),
    utilityLocations: z.string().optional(),
    existingEquipment: z.string().optional(),
    measurements: z.string().optional(),
    photos: z.string().optional(),
    // Shared notes
    siteAccessNotes: z.string().optional(),
    additionalNotes: z.string().optional(),
    clientRequirements: z.string().optional(),
    termsAndConditions: z.string().optional(),
    // Legacy fields
    buildingNumber: z.string().max(100).optional(),
    siteLocation: z.string().optional(),
    workType: z.string().max(50).optional(),
    hasExistingUnit: z.boolean().optional(),
    unitTag: z.string().max(100).optional(),
    unitLocation: z.string().max(255).optional(),
    make: z.string().max(100).optional(),
    model: z.string().max(100).optional(),
    serial: z.string().max(100).optional(),
    systemType: z.string().max(100).optional(),
    powerStatus: z.string().max(50).optional(),
    voltagePhase: z.string().max(50).optional(),
    overallCondition: z.string().max(100).optional(),
    siteConditions: z.string().optional(),
    dateOfSurvey: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    timeOfSurvey: z
      .string()
      .regex(/^\d{2}:\d{2}:\d{2}$/)
      .optional(),
  }),
});

export const updateBidPlanSpecDataSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    plansReceivedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    planRevision: z.string().max(100).optional(),
    planReviewNotes: z.string().optional(),
    specificationsReceivedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    specificationRevision: z.string().max(100).optional(),
    specificationReviewNotes: z.string().optional(),
    complianceRequirements: z.string().optional(),
    codeComplianceStatus: z
      .enum(["pending", "compliant", "non_compliant", "under_review"])
      .optional(),
    addendaReceived: z.boolean().optional(),
    addendaCount: z.number().int().min(0).optional(),
    addendaNotes: z.string().optional(),
    // Legacy fields
    specifications: z.string().optional(),
    designRequirements: z.string().optional(),
  }),
});

export const updateBidDesignBuildDataSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
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
    approvalMilestones: z.string().optional(),
    designRevisionLimit: z.number().int().min(0).optional(),
    designFeeBasis: z
      .enum(["fixed", "hourly", "percentage", "lump_sum"])
      .optional(),
    designPrice: z.string().optional(),
    designCost: z.string().optional(),
    buildSpecifications: z.string().optional(),
  }),
});

export const getBidServiceDataSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

export const updateBidServiceDataSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    // Bid-creation fields
    serviceType: z
      .enum([
        "emergency_repair",
        "scheduled_repair",
        "diagnostic",
        "installation",
        "other",
      ])
      .or(z.literal(""))
      .optional(),
    equipmentType: z
      .enum([
        "rooftop_unit",
        "split_system",
        "boiler",
        "chiller",
        "air_handler",
        "other",
      ])
      .or(z.literal(""))
      .optional(),
    issueCategory: z
      .enum([
        "cooling",
        "heating",
        "ventilation",
        "controls",
        "electrical",
        "plumbing",
        "other",
      ])
      .or(z.literal(""))
      .optional(),
    reportedIssue: z.string().optional(),
    preliminaryAssessment: z.string().optional(),
    estimatedWorkScope: z.string().optional(),
    leadTechnicianId: z.number().int().positive().optional().nullable(),
    helperTechnicianId: z.number().int().positive().optional().nullable(),
    pricingModel: z
      .enum(["time_materials", "flat_rate", "diagnostic_repair"])
      .or(z.literal(""))
      .optional(),
    numberOfTechs: z.number().int().positive().optional(),
    laborHours: z.string().optional(),
    laborRate: z.string().optional(),
    materialsCost: z.string().optional(),
    travelCost: z.string().optional(),
    serviceMarkup: z.string().optional(),
    flatRatePrice: z.string().optional(),
    diagnosticFee: z.string().optional(),
    estimatedRepairCost: z.string().optional(),
    pricingNotes: z.string().optional(),
    // Execution-phase fields (correct DB column names)
    serviceCallTechnician: z.number().int().positive().optional().nullable(),
    timeIn: z.string().max(50).optional().nullable(),
    timeOut: z.string().max(50).optional().nullable(),
    serviceDescription: z.string().optional().nullable(),
    serviceNotes: z.string().optional().nullable(),
    plumbingSystemCheck: z.boolean().optional().nullable(),
    thermostatCheck: z.boolean().optional().nullable(),
    hvacSystemCheck: z.boolean().optional().nullable(),
    clientCommunicationCheck: z.boolean().optional().nullable(),
    customerSignaturePath: z.string().max(500).optional().nullable(),
    customerSignatureDate: z.string().datetime().optional().nullable(),
  }),
});

export const getBidPreventativeMaintenanceDataSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

export const updateBidPreventativeMaintenanceDataSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    pmType: z.enum(["new_pm_bid", "existing_pm_renewal"]).optional().nullable(),
    previousPmJobId: z.string().max(100).optional().nullable(),
    maintenanceFrequency: z
      .enum(["quarterly", "semi_annual", "annual"])
      .optional()
      .nullable(),
    numberOfBuildings: z.number().int().positive().optional().nullable(),
    numberOfUnits: z.number().int().positive().optional().nullable(),
    buildingNumbers: z.string().optional().nullable(),
    expectedUnitTags: z.string().optional().nullable(),
    filterReplacementIncluded: z.boolean().optional(),
    coilCleaningIncluded: z.boolean().optional(),
    temperatureReadingsIncluded: z.boolean().optional(),
    visualInspectionIncluded: z.boolean().optional(),
    serviceScope: z.string().optional().nullable(),
    specialRequirements: z.string().optional().nullable(),
    clientPmRequirements: z.string().optional().nullable(),
    // Pricing fields
    pricingModel: z
      .enum(["per_unit", "flat_rate", "annual_contract"])
      .optional()
      .nullable(),
    pricePerUnit: z.string().optional().nullable(),
    flatRatePerVisit: z.string().optional().nullable(),
    annualContractValue: z.string().optional().nullable(),
    includeFilterReplacement: z.boolean().optional(),
    filterReplacementCost: z.string().optional().nullable(),
    includeCoilCleaning: z.boolean().optional(),
    coilCleaningCost: z.string().optional().nullable(),
    emergencyServiceRate: z.string().optional().nullable(),
    paymentSchedule: z
      .enum(["annual", "per_visit", "quarterly"])
      .optional()
      .nullable(),
    pricingNotes: z.string().optional().nullable(),
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
  }).optional(),
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
  }),
});

export const updateBidNoteSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    noteId: uuidSchema,
  }),
  body: z.object({
    note: z.string().min(1, "Note content cannot be empty").trim().optional(),
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
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
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
  query: z
    .object({
      tagIds: z
        .union([z.string(), z.array(uuidSchema)])
        .optional()
        .transform((v) => {
          if (v === undefined) return undefined;
          const arr = Array.isArray(v)
            ? v
            : (v as string)
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
          return arr.length ? arr : undefined;
        }),
      // Filter by file type: pdf | word | excel
      fileType: z
        .enum(["pdf", "word", "excel"], {
          message: "fileType must be one of: pdf, word, excel",
        })
        .optional(),
      // Filter by date range
      dateRange: z
        .enum(["today", "this_week", "this_month", "this_year"], {
          message:
            "dateRange must be one of: today, this_week, this_month, this_year",
        })
        .optional(),
      // Sort field
      sortBy: z
        .enum(["date", "name", "size"], {
          message: "sortBy must be one of: date, name, size",
        })
        .optional(),
      // Sort direction
      sortOrder: z
        .enum(["asc", "desc"], {
          message: "sortOrder must be one of: asc, desc",
        })
        .optional(),
    })
    .optional(),
});

export const getBidDocumentTagsSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

export const getBidDocumentTagByIdSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    tagId: uuidSchema,
  }),
});

export const createBidDocumentTagSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  }),
});

export const updateBidDocumentTagSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    tagId: uuidSchema,
  }),
  body: z.object({
    name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  }),
});

export const deleteBidDocumentTagSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    tagId: uuidSchema,
  }),
});

export const getDocumentTagsSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    documentId: uuidSchema,
  }),
});

export const linkDocumentTagSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    documentId: uuidSchema,
  }),
  body: z
    .object({
      tagId: uuidSchema.optional(),
      tagName: z.string().min(1).max(100).optional(),
    })
    .refine((data) => data.tagId ?? data.tagName, {
      message: "Either tagId or tagName is required",
    }),
});

export const unlinkDocumentTagSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    documentId: uuidSchema,
    tagId: uuidSchema,
  }),
});

export const getBidDocumentByIdSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    documentId: uuidSchema,
  }),
});

export const previewBidDocumentSchema = z.object({
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
  body: z
    .object({
      caption: z.string().optional(),
    })
    .optional(),
});

export const getBidMediaSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  query: z
    .object({
      mediaType: z
        .enum(["photo", "video", "audio"], {
          message: "mediaType must be one of: photo, video, audio",
        })
        .optional(),
      dateRange: z
        .enum(["today", "this_week", "this_month", "this_year"], {
          message:
            "dateRange must be one of: today, this_week, this_month, this_year",
        })
        .optional(),
      sortBy: z
        .enum(["date", "name", "size"], {
          message: "sortBy must be one of: date, name, size",
        })
        .optional(),
      sortOrder: z
        .enum(["asc", "desc"], {
          message: "sortOrder must be one of: asc, desc",
        })
        .optional(),
    })
    .optional(),
});

export const getBidMediaByIdSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    mediaId: uuidSchema,
  }),
});

export const previewBidMediaSchema = z.object({
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
