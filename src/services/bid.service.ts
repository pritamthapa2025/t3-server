import { count, eq, and, desc, asc, max, sql, or, ilike } from "drizzle-orm";
import { db } from "../config/db.js";
import {
  bidsTable,
  bidFinancialBreakdown,
  bidMaterials,
  bidLabor,
  bidTravel,
  bidOperatingExpenses,
  bidSurveyData,
  bidPlanSpecData,
  bidDesignBuildData,
  bidTimeline,
  bidNotes,
  bidHistory,
} from "../drizzle/schema/bids.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";

// ============================
// Main Bid Operations
// ============================

export const getBids = async (
  organizationId: string,
  offset: number,
  limit: number,
  filters?: {
    status?: string;
    jobType?: string;
    priority?: string;
    assignedTo?: string;
    search?: string;
  }
) => {
  let whereCondition = and(
    eq(bidsTable.organizationId, organizationId),
    eq(bidsTable.isDeleted, false)
  );

  if (filters?.status) {
    whereCondition = and(
      whereCondition,
      eq(bidsTable.status, filters.status as any)
    );
  }
  if (filters?.jobType) {
    whereCondition = and(
      whereCondition,
      eq(bidsTable.jobType, filters.jobType as any)
    );
  }
  if (filters?.priority) {
    whereCondition = and(
      whereCondition,
      eq(bidsTable.priority, filters.priority as any)
    );
  }
  if (filters?.assignedTo) {
    whereCondition = and(
      whereCondition,
      eq(bidsTable.assignedTo, filters.assignedTo)
    );
  }
  if (filters?.search) {
    whereCondition = and(
      whereCondition,
      or(
        ilike(bidsTable.title, `%${filters.search}%`),
        ilike(bidsTable.bidNumber, `%${filters.search}%`),
        ilike(bidsTable.projectName, `%${filters.search}%`),
        ilike(bidsTable.siteAddress, `%${filters.search}%`)
      )!
    );
  }

  const result = await db
    .select()
    .from(bidsTable)
    .where(whereCondition)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(bidsTable.createdAt));

  const totalCount = await db
    .select({ count: count() })
    .from(bidsTable)
    .where(whereCondition);

  const total = totalCount[0]?.count ?? 0;

  return {
    data: result || [],
    total: total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit: limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getBidById = async (id: string, organizationId: string) => {
  const [bid] = await db
    .select()
    .from(bidsTable)
    .where(
      and(
        eq(bidsTable.id, id),
        eq(bidsTable.organizationId, organizationId),
        eq(bidsTable.isDeleted, false)
      )
    );
  return bid || null;
};

export const createBid = async (data: {
  organizationId: string;
  title: string;
  jobType:
    | "general"
    | "survey"
    | "plan_spec"
    | "design_build"
    | "service"
    | "preventative_maintenance";
  status?: string;
  priority?: string;
  projectName?: string;
  siteAddress?: string;
  buildingSuiteNumber?: string;
  acrossValuations?: string;
  scopeOfWork?: string;
  specialRequirements?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  plannedStartDate?: string;
  estimatedCompletion?: string;
  expiresDate?: string;
  removalDate?: string;
  bidAmount?: string;
  estimatedDuration?: number;
  profitMargin?: string;
  expiresIn?: number;
  paymentTerms?: string;
  warrantyPeriod?: string;
  warrantyPeriodLabor?: string;
  warrantyDetails?: string;
  specialTerms?: string;
  exclusions?: string;
  proposalBasis?: string;
  referenceDate?: string;
  templateSelection?: string;
  supervisorManager?: number;
  primaryTechnicianId?: number;
  assignedTo?: string;
  qtyNumber?: string;
  marked?: string;
  convertToJob?: boolean;
  createdBy: string;
}) => {
  // Generate bid number atomically (no race conditions)
  const bidNumber = await generateBidNumber(data.organizationId);

  // Validate employee IDs exist if provided
  if (data.supervisorManager) {
    const [supervisor] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.id, data.supervisorManager),
          eq(employees.isDeleted, false)
        )
      )
      .limit(1);

    if (!supervisor) {
      throw new Error(
        `Supervisor manager with ID ${data.supervisorManager} does not exist`
      );
    }
  }

  if (data.primaryTechnicianId) {
    const [technician] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.id, data.primaryTechnicianId),
          eq(employees.isDeleted, false)
        )
      )
      .limit(1);

    if (!technician) {
      throw new Error(
        `Primary technician with ID ${data.primaryTechnicianId} does not exist`
      );
    }
  }

  // Helper function to convert date string to date or undefined
  const toDateOrUndefined = (dateStr?: string): string | undefined => {
    if (!dateStr || dateStr.trim() === "") return undefined;
    try {
      return new Date(dateStr).toISOString().split("T")[0];
    } catch {
      return undefined;
    }
  };


  // Insert bid - no retry logic needed since bidNumber is guaranteed unique
  const result = await db
    .insert(bidsTable)
    .values({
      bidNumber,
      title: data.title,
      jobType: data.jobType,
      organizationId: data.organizationId,
      createdBy: data.createdBy,
      status: (data.status as any) || "draft",
      priority: (data.priority as any) || "medium",
      projectName: data.projectName || undefined,
      siteAddress: data.siteAddress || undefined,
      buildingSuiteNumber: data.buildingSuiteNumber || undefined,
      acrossValuations: data.acrossValuations || undefined,
      scopeOfWork: data.scopeOfWork || undefined,
      specialRequirements: data.specialRequirements || undefined,
      description: data.description || undefined,
      startDate: toDateOrUndefined(data.startDate),
      endDate: toDateOrUndefined(data.endDate),
      plannedStartDate: toDateOrUndefined(data.plannedStartDate),
      estimatedCompletion: toDateOrUndefined(data.estimatedCompletion),
      expiresDate: toDateOrUndefined(data.expiresDate),
      removalDate: toDateOrUndefined(data.removalDate),
      bidAmount: data.bidAmount || "0",
      estimatedDuration: data.estimatedDuration ?? undefined,
      profitMargin: data.profitMargin || undefined,
      expiresIn: data.expiresIn ?? undefined,
      paymentTerms: data.paymentTerms || undefined,
      warrantyPeriod: data.warrantyPeriod || undefined,
      warrantyPeriodLabor: data.warrantyPeriodLabor || undefined,
      warrantyDetails: data.warrantyDetails || undefined,
      specialTerms: data.specialTerms || undefined,
      exclusions: data.exclusions || undefined,
      proposalBasis: data.proposalBasis || undefined,
      referenceDate: data.referenceDate || undefined,
      templateSelection: data.templateSelection || undefined,
      supervisorManager: data.supervisorManager ?? undefined,
      primaryTechnicianId: data.primaryTechnicianId ?? undefined,
      assignedTo: data.assignedTo || undefined,
      qtyNumber: data.qtyNumber || undefined,
      marked: data.marked || undefined,
      convertToJob: data.convertToJob ?? undefined,
    })
    .returning();

  const bid = (result as any[])[0];

  // Create related records based on job type
  if (bid) {
    await createRelatedRecords(bid.id, data.organizationId, data.jobType);
  }

  return bid;
};

export const updateBid = async (
  id: string,
  organizationId: string,
  data: Partial<{
    title: string;
    status: string;
    priority: string;
    projectName: string;
    siteAddress: string;
    scopeOfWork: string;
    description: string;
    startDate: string;
    endDate: string;
    plannedStartDate: string;
    estimatedCompletion: string;
    expiresDate: string;
    removalDate: string;
    bidAmount: string;
    supervisorManager: number;
    primaryTechnicianId: number;
    assignedTo: string;
  }>
) => {
  const [bid] = await db
    .update(bidsTable)
    .set({
      title: data.title,
      status: data.status as any,
      priority: data.priority as any,
      projectName: data.projectName,
      siteAddress: data.siteAddress,
      scopeOfWork: data.scopeOfWork,
      description: data.description,
      startDate: data.startDate
        ? new Date(data.startDate).toISOString().split("T")[0]
        : undefined,
      endDate: data.endDate
        ? new Date(data.endDate).toISOString().split("T")[0]
        : undefined,
      plannedStartDate: data.plannedStartDate
        ? new Date(data.plannedStartDate).toISOString().split("T")[0]
        : undefined,
      estimatedCompletion: data.estimatedCompletion
        ? new Date(data.estimatedCompletion).toISOString().split("T")[0]
        : undefined,
      expiresDate: data.expiresDate
        ? new Date(data.expiresDate).toISOString().split("T")[0]
        : undefined,
      removalDate: data.removalDate
        ? new Date(data.removalDate).toISOString().split("T")[0]
        : undefined,
      bidAmount: data.bidAmount,
      supervisorManager: data.supervisorManager ?? undefined,
      primaryTechnicianId: data.primaryTechnicianId ?? undefined,
      assignedTo: data.assignedTo,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bidsTable.id, id),
        eq(bidsTable.organizationId, organizationId),
        eq(bidsTable.isDeleted, false)
      )
    )
    .returning();

  return bid || null;
};

export const deleteBid = async (id: string, organizationId: string) => {
  const [bid] = await db
    .update(bidsTable)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bidsTable.id, id),
        eq(bidsTable.organizationId, organizationId),
        eq(bidsTable.isDeleted, false)
      )
    )
    .returning();

  return bid || null;
};

// ============================
// Financial Breakdown Operations
// ============================

export const getBidFinancialBreakdown = async (
  bidId: string,
  _organizationId: string
) => {
  const [breakdown] = await db
    .select()
    .from(bidFinancialBreakdown)
    .where(
      and(
        eq(bidFinancialBreakdown.bidId, bidId),
        eq(bidFinancialBreakdown.isDeleted, false)
      )
    );
  return breakdown || null;
};

export const updateBidFinancialBreakdown = async (
  bidId: string,
  organizationId: string,
  data: {
    materialsEquipment: string;
    labor: string;
    travel: string;
    operatingExpenses: string;
    totalCost: string;
  }
) => {
  // Check if breakdown exists
  const existing = await getBidFinancialBreakdown(bidId, organizationId);

  if (existing) {
    const [breakdown] = await db
      .update(bidFinancialBreakdown)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(bidFinancialBreakdown.id, existing.id))
      .returning();
    return breakdown;
  } else {
    const [breakdown] = await db
      .insert(bidFinancialBreakdown)
      .values({
        bidId,
        ...data,
      })
      .returning();
    return breakdown;
  }
};

// ============================
// Operating Expenses Operations
// ============================

export const getBidOperatingExpenses = async (
  bidId: string,
  organizationId: string
) => {
  // Verify bid belongs to organization
  const bid = await getBidById(bidId, organizationId);
  if (!bid) {
    return null;
  }

  const [operatingExpenses] = await db
    .select()
    .from(bidOperatingExpenses)
    .where(
      and(
        eq(bidOperatingExpenses.bidId, bidId),
        eq(bidOperatingExpenses.isDeleted, false)
      )
    );
  return operatingExpenses || null;
};

export const updateBidOperatingExpenses = async (
  bidId: string,
  organizationId: string,
  data: Partial<{
    enabled: boolean;
    grossRevenuePreviousYear: string;
    currentBidAmount: string;
    operatingCostPreviousYear: string;
    inflationAdjustedOperatingCost: string;
    inflationRate: string;
    utilizationPercentage: string;
    calculatedOperatingCost: string;
    applyMarkup: boolean;
    markupPercentage: string;
    operatingPrice: string;
  }>
) => {
  // Verify bid belongs to organization
  const bid = await getBidById(bidId, organizationId);
  if (!bid) {
    return null;
  }

  // Check if operating expenses exists
  const existing = await getBidOperatingExpenses(bidId, organizationId);

  if (existing) {
    const [operatingExpenses] = await db
      .update(bidOperatingExpenses)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(bidOperatingExpenses.id, existing.id))
      .returning();
    return operatingExpenses;
  } else {
    const [operatingExpenses] = await db
      .insert(bidOperatingExpenses)
      .values({
        bidId,
        ...data,
      })
      .returning();
    return operatingExpenses;
  }
};

// ============================
// Materials Operations
// ============================

export const getBidMaterials = async (
  bidId: string,
  _organizationId: string
) => {
  const materials = await db
    .select()
    .from(bidMaterials)
    .where(
      and(eq(bidMaterials.bidId, bidId), eq(bidMaterials.isDeleted, false))
    );
  return materials;
};

export const createBidMaterial = async (data: {
  bidId: string;
  description: string;
  quantity: string;
  unitCost: string;
  markup: string;
  totalCost: string;
}) => {
  const [material] = await db.insert(bidMaterials).values(data).returning();
  return material;
};

export const updateBidMaterial = async (
  id: string,
  organizationId: string,
  data: Partial<{
    description: string;
    quantity: string;
    unitCost: string;
    markup: string;
    totalCost: string;
  }>
) => {
  const [material] = await db
    .update(bidMaterials)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(bidMaterials.id, id), eq(bidMaterials.isDeleted, false)))
    .returning();
  return material;
};

export const deleteBidMaterial = async (id: string, _organizationId: string) => {
  const [material] = await db
    .update(bidMaterials)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(bidMaterials.id, id), eq(bidMaterials.isDeleted, false)))
    .returning();
  return material;
};

// ============================
// Labor Operations
// ============================

export const getBidLabor = async (bidId: string) => {
  const labor = await db
    .select()
    .from(bidLabor)
    .where(and(eq(bidLabor.bidId, bidId), eq(bidLabor.isDeleted, false)));
  return labor;
};

export const getBidLaborById = async (laborId: string) => {
  const [labor] = await db
    .select()
    .from(bidLabor)
    .where(and(eq(bidLabor.id, laborId), eq(bidLabor.isDeleted, false)));
  return labor || null;
};

export const createBidLabor = async (data: {
  bidId: string;
  positionId: number;
  days: number;
  hoursPerDay: string;
  totalHours: string;
  costRate: string;
  billableRate: string;
  totalCost: string;
  totalPrice: string;
}) => {
  const [labor] = await db.insert(bidLabor).values(data).returning();
  return labor;
};

export const updateBidLabor = async (
  id: string,
  data: Partial<{
    employeeId: number;
    quantity: number;
    days: number;
    hoursPerDay: string;
    totalHours: string;
    costRate: string;
    billableRate: string;
    totalCost: string;
    totalPrice: string;
  }>
) => {
  const [labor] = await db
    .update(bidLabor)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(bidLabor.id, id), eq(bidLabor.isDeleted, false)))
    .returning();
  return labor;
};

export const deleteBidLabor = async (id: string) => {
  const [labor] = await db
    .update(bidLabor)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(bidLabor.id, id), eq(bidLabor.isDeleted, false)))
    .returning();
  return labor;
};

// ============================
// Travel Operations
// ============================

export const getBidTravel = async (bidLaborId: string) => {
  const travel = await db
    .select()
    .from(bidTravel)
    .where(
      and(eq(bidTravel.bidLaborId, bidLaborId), eq(bidTravel.isDeleted, false))
    );
  return travel;
};

export const createBidTravel = async (data: {
  bidLaborId: string;
  roundTripMiles: string;
  mileageRate: string;
  vehicleDayRate: string;
  days: number;
  mileageCost: string;
  vehicleCost: string;
  markup: string;
  totalCost: string;
  totalPrice: string;
}) => {
  const [travel] = await db.insert(bidTravel).values(data).returning();
  return travel;
};

// ============================
// Bulk Labor & Travel Operations
// ============================

export const createBulkLaborAndTravel = async (
  bidId: string,
  laborEntries: Array<{
    employeeId: number;
    quantity: number;
    days: number;
    hoursPerDay: string;
    totalHours: string;
    costRate: string;
    billableRate: string;
    totalCost: string;
    totalPrice: string;
  }>,
  travelEntries: Array<{
    employeeName?: string;
    vehicleName?: string;
    roundTripMiles: string;
    mileageRate: string;
    vehicleDayRate: string;
    days: number;
    mileageCost: string;
    vehicleCost: string;
    markup: string;
    totalCost: string;
    totalPrice: string;
  }>
) => {
  // Validate arrays have same length
  if (laborEntries.length !== travelEntries.length) {
    throw new Error(
      "Number of labor entries must equal number of travel entries"
    );
  }

  const createdLabor: any[] = [];
  const createdTravel: any[] = [];

  // Create all labor entries first
  for (const laborData of laborEntries) {
    const [labor] = await db
      .insert(bidLabor)
      .values({
        bidId,
        positionId: 1, // Default position since positionId is not provided in laborData
        days: laborData.days,
        hoursPerDay: laborData.hoursPerDay,
        totalHours: laborData.totalHours,
        costRate: laborData.costRate,
        billableRate: laborData.billableRate,
        totalCost: laborData.totalCost,
        totalPrice: laborData.totalPrice,
      })
      .returning();
    createdLabor.push(labor);
  }

  // Create travel entries using corresponding labor IDs
  for (let i = 0; i < travelEntries.length; i++) {
    const travelData = travelEntries[i]!; // Safe because we check length
    const laborEntry = createdLabor[i]!; // Safe because arrays have same length

    const [travel] = await db
      .insert(bidTravel)
      .values({
        bidLaborId: laborEntry.id,
        roundTripMiles: travelData.roundTripMiles,
        mileageRate: travelData.mileageRate,
        vehicleDayRate: travelData.vehicleDayRate,
        days: travelData.days,
        mileageCost: travelData.mileageCost,
        vehicleCost: travelData.vehicleCost,
        markup: travelData.markup || "0",
        totalCost: travelData.totalCost,
        totalPrice: travelData.totalPrice,
      })
      .returning();
    createdTravel.push(travel);
  }

  return {
    labor: createdLabor,
    travel: createdTravel,
  };
};

export const updateBidTravel = async (
  id: string,
  data: Partial<{
    bidLaborId: string;
    vehicleName: string;
    roundTripMiles: string;
    mileageRate: string;
    vehicleDayRate: string;
    days: number;
    mileageCost: string;
    vehicleCost: string;
    markup: string;
    totalCost: string;
    totalPrice: string;
  }>
) => {
  const [travel] = await db
    .update(bidTravel)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(bidTravel.id, id), eq(bidTravel.isDeleted, false)))
    .returning();
  return travel;
};

export const deleteBidTravel = async (id: string) => {
  const [travel] = await db
    .update(bidTravel)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(bidTravel.id, id), eq(bidTravel.isDeleted, false)))
    .returning();
  return travel;
};

// ============================
// Job-Type Specific Data Operations
// ============================

export const getBidSurveyData = async (
  bidId: string,
  _organizationId: string
) => {
  const [surveyData] = await db
    .select()
    .from(bidSurveyData)
    .where(
      and(eq(bidSurveyData.bidId, bidId), eq(bidSurveyData.isDeleted, false))
    );
  return surveyData || null;
};

export const updateBidSurveyData = async (
  bidId: string,
  organizationId: string,
  data: Partial<{
    buildingNumber: string;
    siteLocation: string;
    workType: string;
    hasExistingUnit: boolean;
    unitTag: string;
    unitLocation: string;
    make: string;
    model: string;
    serial: string;
    systemType: string;
    powerStatus: string;
    voltagePhase: string;
    overallCondition: string;
    siteAccessNotes: string;
    additionalNotes: string;
    siteConditions: string;
    clientRequirements: string;
    termsAndConditions: string;
    dateOfSurvey: string;
    timeOfSurvey: string;
  }>
) => {
  const existing = await getBidSurveyData(bidId, organizationId);

  if (existing) {
    const [surveyData] = await db
      .update(bidSurveyData)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(bidSurveyData.id, existing.id))
      .returning();
    return surveyData;
  } else {
    const [surveyData] = await db
      .insert(bidSurveyData)
      .values({
        bidId,
        ...data,
      })
      .returning();
    return surveyData;
  }
};

export const getBidPlanSpecData = async (
  bidId: string,
  _organizationId: string
) => {
  const [planSpecData] = await db
    .select()
    .from(bidPlanSpecData)
    .where(
      and(
        eq(bidPlanSpecData.bidId, bidId),
        eq(bidPlanSpecData.isDeleted, false)
      )
    );
  return planSpecData || null;
};

export const updateBidPlanSpecData = async (
  bidId: string,
  organizationId: string,
  data: Partial<{
    // Plans Information
    plansReceivedDate: string;
    planRevision: string;
    planReviewNotes: string;
    // Specifications Information
    specificationsReceivedDate: string;
    specificationRevision: string;
    specificationReviewNotes: string;
    // Compliance & Addenda
    complianceRequirements: string;
    codeComplianceStatus: string;
    addendaReceived: boolean;
    addendaCount: number;
    addendaNotes: string;
    // Legacy fields
    specifications: string;
    designRequirements: string;
  }>
) => {
  const existing = await getBidPlanSpecData(bidId, organizationId);

  // Helper to convert date string to date format
  const toDateOrUndefined = (dateStr?: string): string | undefined => {
    if (!dateStr || dateStr.trim() === "") return undefined;
    try {
      return new Date(dateStr).toISOString().split("T")[0];
    } catch {
      return undefined;
    }
  };

  const processedData = {
    ...data,
    plansReceivedDate: toDateOrUndefined(data.plansReceivedDate),
    specificationsReceivedDate: toDateOrUndefined(data.specificationsReceivedDate),
  };

  if (existing) {
    const [planSpecData] = await db
      .update(bidPlanSpecData)
      .set({
        ...processedData,
        updatedAt: new Date(),
      })
      .where(eq(bidPlanSpecData.id, existing.id))
      .returning();
    return planSpecData;
  } else {
    const [planSpecData] = await db
      .insert(bidPlanSpecData)
      .values({
        bidId,
        ...processedData,
      })
      .returning();
    return planSpecData;
  }
};

export const getBidDesignBuildData = async (
  bidId: string,
  _organizationId: string
) => {
  const [designBuildData] = await db
    .select()
    .from(bidDesignBuildData)
    .where(
      and(
        eq(bidDesignBuildData.bidId, bidId),
        eq(bidDesignBuildData.isDeleted, false)
      )
    );
  return designBuildData || null;
};

export const updateBidDesignBuildData = async (
  bidId: string,
  organizationId: string,
  data: Partial<{
    // Design Phase Information
    designPhase: string;
    designStartDate: string;
    designCompletionDate: string;
    // Design Team
    designTeamMembers: string; // JSON array of employee IDs
    // Design Scope & Requirements
    conceptDescription: string;
    designRequirements: string;
    designDeliverables: string;
    // Client Approval
    clientApprovalRequired: boolean;
    // Design Costs
    designFeeBasis: string;
    designFees: string;
    // Legacy/Construction
    buildSpecifications: string;
  }>
) => {
  const existing = await getBidDesignBuildData(bidId, organizationId);

  // Helper to convert date string to date format
  const toDateOrUndefined = (dateStr?: string): string | undefined => {
    if (!dateStr || dateStr.trim() === "") return undefined;
    try {
      return new Date(dateStr).toISOString().split("T")[0];
    } catch {
      return undefined;
    }
  };

  const processedData = {
    ...data,
    designStartDate: toDateOrUndefined(data.designStartDate),
    designCompletionDate: toDateOrUndefined(data.designCompletionDate),
  };

  if (existing) {
    const [designBuildData] = await db
      .update(bidDesignBuildData)
      .set({
        ...processedData,
        updatedAt: new Date(),
      })
      .where(eq(bidDesignBuildData.id, existing.id))
      .returning();
    return designBuildData;
  } else {
    const [designBuildData] = await db
      .insert(bidDesignBuildData)
      .values({
        bidId,
        ...processedData,
      })
      .returning();
    return designBuildData;
  }
};

// ============================
// Timeline Operations
// ============================

export const getBidTimeline = async (bidId: string, organizationId: string) => {
  const timeline = await db
    .select()
    .from(bidTimeline)
    .where(
      and(
        eq(bidTimeline.bidId, bidId),
        eq(bidTimeline.organizationId, organizationId),
        eq(bidTimeline.isDeleted, false)
      )
    )
    .orderBy(asc(bidTimeline.sortOrder), asc(bidTimeline.eventDate));
  return timeline;
};

export const createBidTimelineEvent = async (data: {
  bidId: string;
  organizationId: string;
  event: string;
  eventDate: string;
  status?: string;
  description?: string;
  sortOrder?: number;
  createdBy?: string;
}) => {
  const [timelineEvent] = await db
    .insert(bidTimeline)
    .values({
      bidId: data.bidId,
      organizationId: data.organizationId,
      event: data.event,
      eventDate: new Date(data.eventDate),
      status: (data.status as any) || "pending",
      description: data.description,
      sortOrder: data.sortOrder || 0,
      createdBy: data.createdBy,
    })
    .returning();
  return timelineEvent;
};

export const updateBidTimelineEvent = async (
  id: string,
  organizationId: string,
  data: Partial<{
    event: string;
    eventDate: string;
    status: string;
    description: string;
    sortOrder: number;
  }>
) => {
  const [timelineEvent] = await db
    .update(bidTimeline)
    .set({
      event: data.event,
      eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
      status: data.status as any,
      description: data.description,
      sortOrder: data.sortOrder,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bidTimeline.id, id),
        eq(bidTimeline.organizationId, organizationId),
        eq(bidTimeline.isDeleted, false)
      )
    )
    .returning();
  return timelineEvent;
};

export const deleteBidTimelineEvent = async (
  id: string,
  organizationId: string
) => {
  const [timelineEvent] = await db
    .update(bidTimeline)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bidTimeline.id, id),
        eq(bidTimeline.organizationId, organizationId),
        eq(bidTimeline.isDeleted, false)
      )
    )
    .returning();
  return timelineEvent;
};

// ============================
// Notes Operations
// ============================

export const getBidNotes = async (bidId: string, organizationId: string) => {
  const notes = await db
    .select()
    .from(bidNotes)
    .where(
      and(
        eq(bidNotes.bidId, bidId),
        eq(bidNotes.organizationId, organizationId),
        eq(bidNotes.isDeleted, false)
      )
    )
    .orderBy(desc(bidNotes.createdAt));
  return notes;
};

export const createBidNote = async (data: {
  bidId: string;
  organizationId: string;
  note: string;
  createdBy: string;
  isInternal?: boolean;
}) => {
  const [note] = await db.insert(bidNotes).values(data).returning();
  return note;
};

export const updateBidNote = async (
  id: string,
  organizationId: string,
  data: {
    note: string;
    isInternal?: boolean;
  }
) => {
  const [note] = await db
    .update(bidNotes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bidNotes.id, id),
        eq(bidNotes.organizationId, organizationId),
        eq(bidNotes.isDeleted, false)
      )
    )
    .returning();
  return note;
};

export const deleteBidNote = async (id: string, organizationId: string) => {
  const [note] = await db
    .update(bidNotes)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bidNotes.id, id),
        eq(bidNotes.organizationId, organizationId),
        eq(bidNotes.isDeleted, false)
      )
    )
    .returning();
  return note;
};

// ============================
// History Operations (Read-only)
// ============================

export const getBidHistory = async (bidId: string, organizationId: string) => {
  const history = await db
    .select()
    .from(bidHistory)
    .where(
      and(
        eq(bidHistory.bidId, bidId),
        eq(bidHistory.organizationId, organizationId)
      )
    )
    .orderBy(desc(bidHistory.createdAt));
  return history;
};

export const createBidHistoryEntry = async (data: {
  bidId: string;
  organizationId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
  performedBy: string;
}) => {
  const [historyEntry] = await db.insert(bidHistory).values(data).returning();
  return historyEntry;
};

// ============================
// Helper Functions
// ============================

// Generate next bid number using atomic database function
// This is THREAD-SAFE and prevents race conditions
const generateBidNumber = async (organizationId: string): Promise<string> => {
  try {
    // Use atomic database function to get next counter value
    const result = await db.execute<{ next_value: string }>(
      sql.raw(
        `SELECT org.get_next_counter('${organizationId}'::uuid, 'bid_number') as next_value`
      )
    );

    const nextNumber = parseInt(result.rows[0]?.next_value || "1");
    return `BID-${nextNumber.toString().padStart(5, "0")}`;
  } catch (error) {
    // Fallback to old method if function doesn't exist yet
    console.warn("Counter function not found, using fallback method:", error);

    const maxResult = await db
      .select({
        maxBidNumber: max(bidsTable.bidNumber),
      })
      .from(bidsTable)
      .where(eq(bidsTable.organizationId, organizationId));

    const maxBidNumber = maxResult[0]?.maxBidNumber;
    let nextNumber = 1;

    if (maxBidNumber) {
      const match = maxBidNumber.match(/BID-(\d+)/);
      if (match && match[1]) {
        const currentNumber = parseInt(match[1], 10);
        nextNumber = currentNumber + 1;
      }
    }

    return `BID-${nextNumber.toString().padStart(5, "0")}`;
  }
};

const createRelatedRecords = async (
  bidId: string,
  organizationId: string,
  jobType:
    | "general"
    | "survey"
    | "plan_spec"
    | "design_build"
    | "service"
    | "preventative_maintenance"
) => {
  // Create financial breakdown
  await db.insert(bidFinancialBreakdown).values({
    bidId,
    materialsEquipment: "0",
    labor: "0",
    travel: "0",
    operatingExpenses: "0",
    totalCost: "0",
  });

  // Create operating expenses
  await db.insert(bidOperatingExpenses).values({
    bidId,
  });

  // Create job-type specific data (only for types that have specific data tables)
  switch (jobType) {
    case "survey":
      await db.insert(bidSurveyData).values({
        bidId,
      });
      break;
    case "plan_spec":
      await db.insert(bidPlanSpecData).values({
        bidId,
      });
      break;
    case "design_build":
      await db.insert(bidDesignBuildData).values({
        bidId,
      });
      break;
    // "general", "service", and "preventative_maintenance" don't have specific data tables
    // They only use the main bid table and related financial/operating expense tables
    case "general":
    case "service":
    case "preventative_maintenance":
      // No specific data tables for these types
      break;
  }
};

// ============================
// Complete Bid Data with Relations
// ============================

export const getBidWithAllData = async (id: string, organizationId: string) => {
  const bid = await getBidById(id, organizationId);
  if (!bid) return null;

  const [
    financialBreakdown,
    materials,
    labor,
    surveyData,
    planSpecData,
    designBuildData,
    timeline,
    notes,
    history,
  ] = await Promise.all([
    getBidFinancialBreakdown(id, organizationId),
    getBidMaterials(id, organizationId),
    getBidLabor(id),
    getBidSurveyData(id, organizationId),
    getBidPlanSpecData(id, organizationId),
    getBidDesignBuildData(id, organizationId),
    getBidTimeline(id, organizationId),
    getBidNotes(id, organizationId),
    getBidHistory(id, organizationId),
  ]);

  // Get travel for each labor entry
  const travelPromises = labor.map((laborEntry) => getBidTravel(laborEntry.id));
  const travelArrays = await Promise.all(travelPromises);
  const travel = travelArrays.flat();

  return {
    bid,
    financialBreakdown,
    materials,
    labor,
    travel,
    surveyData,
    planSpecData,
    designBuildData,
    timeline,
    notes,
    history,
  };
};
