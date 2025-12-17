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
  bidDocuments,
  bidPlanSpecFiles,
  bidDesignBuildFiles,
  bidNotes,
  bidHistory,
} from "../drizzle/schema/bids.schema.js";

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
        ilike(bidsTable.clientName, `%${filters.search}%`),
        ilike(bidsTable.projectName, `%${filters.search}%`),
        ilike(bidsTable.siteAddress, `%${filters.search}%`),
        ilike(bidsTable.city, `%${filters.search}%`)
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
  jobType: "survey" | "plan_spec" | "design_build";
  status?: string;
  priority?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  city?: string;
  projectName?: string;
  siteAddress?: string;
  scopeOfWork?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  plannedStartDate?: string;
  estimatedCompletion?: string;
  expiresDate?: string;
  removalDate?: string;
  bidAmount?: string;
  createdBy: string;
}) => {
  const maxRetries = 5;
  let attempt = 0;

  // Generate initial bid number outside the retry loop
  let bidNumber = await generateBidNumber(data.organizationId);

  while (attempt < maxRetries) {
    try {
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
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          clientPhone: data.clientPhone,
          city: data.city,
          projectName: data.projectName,
          siteAddress: data.siteAddress,
          scopeOfWork: data.scopeOfWork,
          description: data.description,
          startDate: data.startDate
            ? new Date(data.startDate).toISOString().split("T")[0]
            : null,
          endDate: data.endDate
            ? new Date(data.endDate).toISOString().split("T")[0]
            : null,
          plannedStartDate: data.plannedStartDate
            ? new Date(data.plannedStartDate).toISOString().split("T")[0]
            : null,
          estimatedCompletion: data.estimatedCompletion
            ? new Date(data.estimatedCompletion).toISOString().split("T")[0]
            : null,
          expiresDate: data.expiresDate ? new Date(data.expiresDate) : null,
          removalDate: data.removalDate
            ? new Date(data.removalDate).toISOString().split("T")[0]
            : null,
          bidAmount: data.bidAmount || "0",
        })
        .returning();

      const bid = (result as any[])[0];

      // Create related records based on job type
      if (bid) {
        await createRelatedRecords(bid.id, data.organizationId, data.jobType);
      }

      return bid;
    } catch (error: any) {
      attempt++;

      // Check if it's a unique constraint violation on bidNumber
      const isUniqueConstraintError =
        error?.code === "23505" || // PostgreSQL unique violation
        error?.code === "SQLITE_CONSTRAINT" || // SQLite constraint
        (error?.message && error.message.includes("UNIQUE constraint failed"));

      if (isUniqueConstraintError && attempt < maxRetries) {
        // Increment bid number for retry
        const match = bidNumber.match(/BID-(\d+)/);
        if (match && match[1]) {
          const currentNumber = parseInt(match[1], 10);
          const nextNumber = currentNumber + 1;
          bidNumber = `BID-${nextNumber.toString().padStart(5, "0")}`;
        }

        console.warn(
          `Bid number collision detected, retrying with ${bidNumber}... (attempt ${attempt}/${maxRetries})`
        );
        // Small random delay to reduce collision probability
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
        continue;
      }

      // If it's not a unique constraint error or we've exceeded retries, throw the error
      console.error(`Failed to create bid after ${attempt} attempts:`, error);
      throw error;
    }
  }

  throw new Error(
    `Failed to create bid after ${maxRetries} attempts due to bid number collisions`
  );
};

export const updateBid = async (
  id: string,
  organizationId: string,
  data: Partial<{
    title: string;
    status: string;
    priority: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    city: string;
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
    assignedTo: string;
  }>
) => {
  const [bid] = await db
    .update(bidsTable)
    .set({
      title: data.title,
      status: data.status as any,
      priority: data.priority as any,
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      clientPhone: data.clientPhone,
      city: data.city,
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
      expiresDate: data.expiresDate ? new Date(data.expiresDate) : undefined,
      removalDate: data.removalDate
        ? new Date(data.removalDate).toISOString().split("T")[0]
        : undefined,
      bidAmount: data.bidAmount,
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
  organizationId: string
) => {
  const [breakdown] = await db
    .select()
    .from(bidFinancialBreakdown)
    .where(
      and(
        eq(bidFinancialBreakdown.bidId, bidId),
        eq(bidFinancialBreakdown.organizationId, organizationId),
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
        organizationId,
        ...data,
      })
      .returning();
    return breakdown;
  }
};

// ============================
// Materials Operations
// ============================

export const getBidMaterials = async (
  bidId: string,
  organizationId: string
) => {
  const materials = await db
    .select()
    .from(bidMaterials)
    .where(
      and(
        eq(bidMaterials.bidId, bidId),
        eq(bidMaterials.organizationId, organizationId),
        eq(bidMaterials.isDeleted, false)
      )
    );
  return materials;
};

export const createBidMaterial = async (data: {
  bidId: string;
  organizationId: string;
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
    .where(
      and(
        eq(bidMaterials.id, id),
        eq(bidMaterials.organizationId, organizationId),
        eq(bidMaterials.isDeleted, false)
      )
    )
    .returning();
  return material;
};

export const deleteBidMaterial = async (id: string, organizationId: string) => {
  const [material] = await db
    .update(bidMaterials)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bidMaterials.id, id),
        eq(bidMaterials.organizationId, organizationId),
        eq(bidMaterials.isDeleted, false)
      )
    )
    .returning();
  return material;
};

// ============================
// Labor Operations
// ============================

export const getBidLabor = async (bidId: string, organizationId: string) => {
  const labor = await db
    .select()
    .from(bidLabor)
    .where(
      and(
        eq(bidLabor.bidId, bidId),
        eq(bidLabor.organizationId, organizationId),
        eq(bidLabor.isDeleted, false)
      )
    );
  return labor;
};

export const createBidLabor = async (data: {
  bidId: string;
  organizationId: string;
  role: string;
  quantity: number;
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
  organizationId: string,
  data: Partial<{
    role: string;
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
    .where(
      and(
        eq(bidLabor.id, id),
        eq(bidLabor.organizationId, organizationId),
        eq(bidLabor.isDeleted, false)
      )
    )
    .returning();
  return labor;
};

export const deleteBidLabor = async (id: string, organizationId: string) => {
  const [labor] = await db
    .update(bidLabor)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bidLabor.id, id),
        eq(bidLabor.organizationId, organizationId),
        eq(bidLabor.isDeleted, false)
      )
    )
    .returning();
  return labor;
};

// ============================
// Travel Operations
// ============================

export const getBidTravel = async (bidId: string, organizationId: string) => {
  const travel = await db
    .select()
    .from(bidTravel)
    .where(
      and(
        eq(bidTravel.bidId, bidId),
        eq(bidTravel.organizationId, organizationId),
        eq(bidTravel.isDeleted, false)
      )
    );
  return travel;
};

export const createBidTravel = async (data: {
  bidId: string;
  organizationId: string;
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
}) => {
  const [travel] = await db.insert(bidTravel).values(data).returning();
  return travel;
};

export const updateBidTravel = async (
  id: string,
  organizationId: string,
  data: Partial<{
    employeeName: string;
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
    .where(
      and(
        eq(bidTravel.id, id),
        eq(bidTravel.organizationId, organizationId),
        eq(bidTravel.isDeleted, false)
      )
    )
    .returning();
  return travel;
};

export const deleteBidTravel = async (id: string, organizationId: string) => {
  const [travel] = await db
    .update(bidTravel)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bidTravel.id, id),
        eq(bidTravel.organizationId, organizationId),
        eq(bidTravel.isDeleted, false)
      )
    )
    .returning();
  return travel;
};

// ============================
// Job-Type Specific Data Operations
// ============================

export const getBidSurveyData = async (
  bidId: string,
  organizationId: string
) => {
  const [surveyData] = await db
    .select()
    .from(bidSurveyData)
    .where(
      and(
        eq(bidSurveyData.bidId, bidId),
        eq(bidSurveyData.organizationId, organizationId),
        eq(bidSurveyData.isDeleted, false)
      )
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
    siteConditions: string;
    clientRequirements: string;
    technicianId: string;
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
        organizationId,
        ...data,
      })
      .returning();
    return surveyData;
  }
};

export const getBidPlanSpecData = async (
  bidId: string,
  organizationId: string
) => {
  const [planSpecData] = await db
    .select()
    .from(bidPlanSpecData)
    .where(
      and(
        eq(bidPlanSpecData.bidId, bidId),
        eq(bidPlanSpecData.organizationId, organizationId),
        eq(bidPlanSpecData.isDeleted, false)
      )
    );
  return planSpecData || null;
};

export const updateBidPlanSpecData = async (
  bidId: string,
  organizationId: string,
  data: {
    specifications?: string;
    designRequirements?: string;
  }
) => {
  const existing = await getBidPlanSpecData(bidId, organizationId);

  if (existing) {
    const [planSpecData] = await db
      .update(bidPlanSpecData)
      .set({
        ...data,
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
        organizationId,
        ...data,
      })
      .returning();
    return planSpecData;
  }
};

export const getBidDesignBuildData = async (
  bidId: string,
  organizationId: string
) => {
  const [designBuildData] = await db
    .select()
    .from(bidDesignBuildData)
    .where(
      and(
        eq(bidDesignBuildData.bidId, bidId),
        eq(bidDesignBuildData.organizationId, organizationId),
        eq(bidDesignBuildData.isDeleted, false)
      )
    );
  return designBuildData || null;
};

export const updateBidDesignBuildData = async (
  bidId: string,
  organizationId: string,
  data: {
    designRequirements?: string;
    buildSpecifications?: string;
  }
) => {
  const existing = await getBidDesignBuildData(bidId, organizationId);

  if (existing) {
    const [designBuildData] = await db
      .update(bidDesignBuildData)
      .set({
        ...data,
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
        organizationId,
        ...data,
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

const generateBidNumber = async (organizationId: string): Promise<string> => {
  // Get the highest existing bid number for this organization
  const maxResult = await db
    .select({
      maxBidNumber: max(bidsTable.bidNumber),
    })
    .from(bidsTable)
    .where(eq(bidsTable.organizationId, organizationId));

  const maxBidNumber = maxResult[0]?.maxBidNumber;

  let nextNumber = 1;

  if (maxBidNumber) {
    // Extract numeric part from BID-00001 format
    const match = maxBidNumber.match(/BID-(\d+)/);
    if (match && match[1]) {
      const currentNumber = parseInt(match[1], 10);
      nextNumber = currentNumber + 1;
    }
  }

  // Format: BID-00001, BID-00002, etc. (5 digits padding)
  const bidNumber = `BID-${String(nextNumber).padStart(5, "0")}`;
  return bidNumber;
};

const createRelatedRecords = async (
  bidId: string,
  organizationId: string,
  jobType: "survey" | "plan_spec" | "design_build"
) => {
  // Create financial breakdown
  await db.insert(bidFinancialBreakdown).values({
    bidId,
    organizationId,
    materialsEquipment: "0",
    labor: "0",
    travel: "0",
    operatingExpenses: "0",
    totalCost: "0",
  });

  // Create operating expenses
  await db.insert(bidOperatingExpenses).values({
    bidId,
    organizationId,
  });

  // Create job-type specific data
  switch (jobType) {
    case "survey":
      await db.insert(bidSurveyData).values({
        bidId,
        organizationId,
      });
      break;
    case "plan_spec":
      await db.insert(bidPlanSpecData).values({
        bidId,
        organizationId,
      });
      break;
    case "design_build":
      await db.insert(bidDesignBuildData).values({
        bidId,
        organizationId,
      });
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
    travel,
    surveyData,
    planSpecData,
    designBuildData,
    timeline,
    notes,
    history,
  ] = await Promise.all([
    getBidFinancialBreakdown(id, organizationId),
    getBidMaterials(id, organizationId),
    getBidLabor(id, organizationId),
    getBidTravel(id, organizationId),
    getBidSurveyData(id, organizationId),
    getBidPlanSpecData(id, organizationId),
    getBidDesignBuildData(id, organizationId),
    getBidTimeline(id, organizationId),
    getBidNotes(id, organizationId),
    getBidHistory(id, organizationId),
  ]);

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
