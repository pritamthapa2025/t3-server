import { z } from "zod";

const uuidSchema = z.string().uuid({ message: "Invalid UUID format" });
const numericStringSchema = z.string().regex(/^\d+(\.\d+)?$/, {
  message: "Must be a valid numeric string",
});

// ============================
// Base Schemas
// ============================

const bidStatusEnum = z.enum([
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
]);

const bidPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);

const bidJobTypeEnum = z.enum(["survey", "plan_spec", "design_build"]);

const timelineStatusEnum = z.enum([
  "completed",
  "pending",
  "in_progress",
  "cancelled",
]);

// ============================
// Main Bid Validations
// ============================

export const getBidsQuerySchema = z.object({
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
    status: bidStatusEnum.optional(),
    jobType: bidJobTypeEnum.optional(),
    priority: bidPriorityEnum.optional(),
    assignedTo: uuidSchema.optional(),
  }),
});

export const getBidByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const createBidSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required").max(255),
    jobType: bidJobTypeEnum,
    status: bidStatusEnum.optional().default("draft"),
    priority: bidPriorityEnum.optional().default("medium"),
    clientName: z.string().max(255).optional(),
    clientEmail: z.string().email().max(150).optional(),
    clientPhone: z.string().max(20).optional(),
    city: z.string().max(100).optional(),
    superClient: z.string().max(255).optional(),
    superPrimaryContact: z.string().max(255).optional(),
    primaryContact: z.string().max(255).optional(),
    industryClassification: z.string().max(100).optional(),
    projectName: z.string().max(255).optional(),
    siteAddress: z.string().optional(),
    buildingSuiteNumber: z.string().max(100).optional(),
    property: z.string().max(255).optional(),
    acrossValuations: z.string().max(255).optional(),
    scopeOfWork: z.string().optional(),
    specialRequirements: z.string().optional(),
    description: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    plannedStartDate: z.string().datetime().optional(),
    estimatedCompletion: z.string().datetime().optional(),
    expiresDate: z.string().datetime().optional(),
    removalDate: z.string().datetime().optional(),
    bidAmount: numericStringSchema.optional(),
    estimatedDuration: z.number().int().positive().optional(),
    profitMargin: numericStringSchema.optional(),
    expiresIn: z.number().int().positive().optional(),
    paymentTerms: z.string().optional(),
    warrantyPeriod: z.string().max(50).optional(),
    warrantyPeriodLabor: z.string().max(50).optional(),
    warrantyDetails: z.string().optional(),
    specialTerms: z.string().optional(),
    exclusions: z.string().optional(),
    proposalBasis: z.string().optional(),
    referenceDate: z.string().max(50).optional(),
    templateSelection: z.string().max(100).optional(),
    primaryTeammate: uuidSchema.optional(),
    supervisorManager: uuidSchema.optional(),
    technicianId: uuidSchema.optional(),
    assignedTo: uuidSchema.optional(),
    qtyNumber: z.string().max(50).optional(),
    marked: z.string().max(20).optional(),
    convertToJob: z.boolean().optional(),
    jobId: uuidSchema.optional(),
  }),
});

export const updateBidSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    status: bidStatusEnum.optional(),
    priority: bidPriorityEnum.optional(),
    clientName: z.string().max(255).optional(),
    clientEmail: z.string().email().max(150).optional(),
    clientPhone: z.string().max(20).optional(),
    city: z.string().max(100).optional(),
    superClient: z.string().max(255).optional(),
    superPrimaryContact: z.string().max(255).optional(),
    primaryContact: z.string().max(255).optional(),
    industryClassification: z.string().max(100).optional(),
    projectName: z.string().max(255).optional(),
    siteAddress: z.string().optional(),
    buildingSuiteNumber: z.string().max(100).optional(),
    property: z.string().max(255).optional(),
    acrossValuations: z.string().max(255).optional(),
    scopeOfWork: z.string().optional(),
    specialRequirements: z.string().optional(),
    description: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    plannedStartDate: z.string().datetime().optional(),
    estimatedCompletion: z.string().datetime().optional(),
    expiresDate: z.string().datetime().optional(),
    removalDate: z.string().datetime().optional(),
    bidAmount: numericStringSchema.optional(),
    estimatedDuration: z.number().int().positive().optional(),
    profitMargin: numericStringSchema.optional(),
    expiresIn: z.number().int().positive().optional(),
    paymentTerms: z.string().optional(),
    warrantyPeriod: z.string().max(50).optional(),
    warrantyPeriodLabor: z.string().max(50).optional(),
    warrantyDetails: z.string().optional(),
    specialTerms: z.string().optional(),
    exclusions: z.string().optional(),
    proposalBasis: z.string().optional(),
    referenceDate: z.string().max(50).optional(),
    templateSelection: z.string().max(100).optional(),
    primaryTeammate: uuidSchema.optional(),
    supervisorManager: uuidSchema.optional(),
    technicianId: uuidSchema.optional(),
    assignedTo: uuidSchema.optional(),
    qtyNumber: z.string().max(50).optional(),
    marked: z.string().max(20).optional(),
    convertToJob: z.boolean().optional(),
    jobId: uuidSchema.optional(),
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

export const getBidMaterialsSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
});

export const createBidMaterialSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    description: z.string().min(1, "Description is required"),
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
    description: z.string().min(1).optional(),
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

export const createBidLaborSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    role: z.string().min(1, "Role is required").max(100),
    quantity: z.number().int().positive(),
    days: z.number().int().positive(),
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
    role: z.string().min(1).max(100).optional(),
    quantity: z.number().int().positive().optional(),
    days: z.number().int().positive().optional(),
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
  }),
});

export const createBidTravelSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
  }),
  body: z.object({
    employeeName: z.string().max(255).optional(),
    vehicleName: z.string().max(255).optional(),
    roundTripMiles: numericStringSchema,
    mileageRate: numericStringSchema,
    vehicleDayRate: numericStringSchema,
    days: z.number().int().positive(),
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
    travelId: uuidSchema,
  }),
  body: z.object({
    employeeName: z.string().max(255).optional(),
    vehicleName: z.string().max(255).optional(),
    roundTripMiles: numericStringSchema.optional(),
    mileageRate: numericStringSchema.optional(),
    vehicleDayRate: numericStringSchema.optional(),
    days: z.number().int().positive().optional(),
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
    travelId: uuidSchema,
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
    siteAccessNotes: z.string().optional(),
    siteConditions: z.string().optional(),
    clientRequirements: z.string().optional(),
    technicianId: uuidSchema.optional(),
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
    event: z.string().min(1, "Event name is required").max(255),
    eventDate: z.string().datetime(),
    status: timelineStatusEnum.optional().default("pending"),
    description: z.string().optional(),
    sortOrder: z.number().int().optional().default(0),
  }),
});

export const updateBidTimelineEventSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    eventId: uuidSchema,
  }),
  body: z.object({
    event: z.string().min(1).max(255).optional(),
    eventDate: z.string().datetime().optional(),
    status: timelineStatusEnum.optional(),
    description: z.string().optional(),
    sortOrder: z.number().int().optional(),
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
    note: z.string().min(1, "Note content is required"),
    isInternal: z.boolean().optional().default(true),
  }),
});

export const updateBidNoteSchema = z.object({
  params: z.object({
    bidId: uuidSchema,
    noteId: uuidSchema,
  }),
  body: z.object({
    note: z.string().min(1).optional(),
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
// Operating Expenses Validations
// ============================

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


