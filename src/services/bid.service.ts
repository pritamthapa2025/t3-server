import {
  count,
  eq,
  and,
  desc,
  asc,
  max,
  sql,
  or,
  ilike,
  inArray,
} from "drizzle-orm";
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
  bidDocuments,
} from "../drizzle/schema/bids.schema.js";
import { employees, positions } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { organizations } from "../drizzle/schema/client.schema.js";
import { alias } from "drizzle-orm/pg-core";
import { getOrganizationById } from "./client.service.js";

// ============================
// Main Bid Operations
// ============================

// Aliases for joining users table multiple times (createdBy, assignedTo)
const createdByUser = alias(users, "created_by_user");
const assignedToUser = alias(users, "assigned_to_user");

/** Compute expiresIn (days) from endDate - createdDate. Returns null if either date missing or endDate before createdDate. */
function computeExpiresIn(bid: {
  endDate?: string | Date | null;
  createdDate?: string | Date | null;
}): number | null {
  const end = bid.endDate ? new Date(bid.endDate) : null;
  const created = bid.createdDate ? new Date(bid.createdDate) : null;
  if (!end || !created) return null;
  if (end.getTime() < created.getTime()) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - created.getTime()) / msPerDay);
}

export const getBids = async (
  organizationId: string | undefined,
  offset: number,
  limit: number,
  filters?: {
    status?: string;
    jobType?: string;
    priority?: string;
    assignedTo?: string;
    search?: string;
  },
) => {
  // Build where conditions array - organizationId is optional
  const whereConditions = [eq(bidsTable.isDeleted, false)];

  // If organizationId is provided, filter by it
  if (organizationId) {
    whereConditions.push(eq(bidsTable.organizationId, organizationId));
  }

  if (filters?.status) {
    whereConditions.push(eq(bidsTable.status, filters.status as any));
  }
  if (filters?.jobType) {
    whereConditions.push(eq(bidsTable.jobType, filters.jobType as any));
  }
  if (filters?.priority) {
    whereConditions.push(eq(bidsTable.priority, filters.priority as any));
  }
  if (filters?.assignedTo) {
    whereConditions.push(eq(bidsTable.assignedTo, filters.assignedTo));
  }
  if (filters?.search) {
    whereConditions.push(
      or(
        ilike(bidsTable.bidNumber, `%${filters.search}%`),
        ilike(bidsTable.projectName, `%${filters.search}%`),
        ilike(bidsTable.siteAddress, `%${filters.search}%`),
      )!,
    );
  }

  // Always have at least isDeleted condition, so whereCondition is always defined
  const whereCondition = and(...whereConditions);

  const result = await db
    .select({
      bid: bidsTable,
      createdByName: createdByUser.fullName,
      assignedToName: assignedToUser.fullName,
      organizationName: organizations.name,
      organizationStreetAddress: organizations.streetAddress,
      organizationCity: organizations.city,
      organizationState: organizations.state,
      organizationZipCode: organizations.zipCode,
    })
    .from(bidsTable)
    .leftJoin(createdByUser, eq(bidsTable.createdBy, createdByUser.id))
    .leftJoin(assignedToUser, eq(bidsTable.assignedTo, assignedToUser.id))
    .leftJoin(organizations, eq(bidsTable.organizationId, organizations.id))
    .where(whereCondition)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(bidsTable.createdAt));

  const totalCount = await db
    .select({ count: count() })
    .from(bidsTable)
    .where(whereCondition);

  const total = totalCount[0]?.count ?? 0;

  // Map results to include createdByName, assignedToName, organization data, and derived expiresIn
  const enrichedBids = result.map((item) => ({
    ...item.bid,
    createdByName: item.createdByName ?? null,
    assignedToName: item.assignedToName ?? null,
    organizationName: item.organizationName ?? null,
    organizationLocation:
      item.organizationCity && item.organizationState
        ? `${item.organizationCity}, ${item.organizationState}`
        : (item.organizationCity ?? item.organizationState ?? null),
    organizationStreetAddress: item.organizationStreetAddress ?? null,
    organizationCity: item.organizationCity ?? null,
    organizationState: item.organizationState ?? null,
    organizationZipCode: item.organizationZipCode ?? null,
    expiresIn: computeExpiresIn(item.bid),
  }));

  return {
    data: enrichedBids || [],
    total: total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit: limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/** Minimal bid fields for list/display (related bids) */
const RELATED_BID_DISPLAY_FIELDS = [
  "id",
  "bidNumber",
  "status",
  "priority",
  "projectName",
  "organizationId",
  "bidAmount",
  "jobType",
  "createdAt",
  "createdByName",
  "assignedToName",
  "expiresIn",
] as const;

/**
 * Get all bids for the same organization as the given bid (related bids).
 * Uses the bid's organizationId and returns minimal data for display.
 */
export const getRelatedBids = async (bidId: string) => {
  const bid = await getBidByIdSimple(bidId);
  if (!bid) return null;
  const result = await getBids(bid.organizationId, 0, 500);
  const minimalData = result.data.map((b) => {
    const minimal: Record<string, unknown> = {};
    for (const key of RELATED_BID_DISPLAY_FIELDS) {
      if (key in b) minimal[key] = (b as Record<string, unknown>)[key];
    }
    return minimal;
  });
  return {
    data: minimalData,
    total: result.total,
    pagination: result.pagination,
  };
};

export const getBidById = async (id: string) => {
  const [result] = await db
    .select({
      bid: bidsTable,
      createdByName: createdByUser.fullName,
      assignedToName: assignedToUser.fullName,
    })
    .from(bidsTable)
    .leftJoin(createdByUser, eq(bidsTable.createdBy, createdByUser.id))
    .leftJoin(assignedToUser, eq(bidsTable.assignedTo, assignedToUser.id))
    .where(and(eq(bidsTable.id, id), eq(bidsTable.isDeleted, false)));
  if (!result) return null;
  return {
    ...result.bid,
    createdByName: result.createdByName ?? null,
    assignedToName: result.assignedToName ?? null,
    expiresIn: computeExpiresIn(result.bid),
  };
};

// Simple version without organization validation - trusts bid ID access
export const getBidByIdSimple = async (id: string) => {
  const [result] = await db
    .select({
      bid: bidsTable,
      createdByName: createdByUser.fullName,
      assignedToName: assignedToUser.fullName,
    })
    .from(bidsTable)
    .leftJoin(createdByUser, eq(bidsTable.createdBy, createdByUser.id))
    .leftJoin(assignedToUser, eq(bidsTable.assignedTo, assignedToUser.id))
    .where(and(eq(bidsTable.id, id), eq(bidsTable.isDeleted, false)));
  if (!result) return null;
  return {
    ...result.bid,
    createdByName: result.createdByName ?? null,
    assignedToName: result.assignedToName ?? null,
    expiresIn: computeExpiresIn(result.bid),
  };
};

export const createBid = async (data: {
  organizationId: string;
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
  endDate?: string;
  plannedStartDate?: string;
  estimatedCompletion?: string;
  removalDate?: string;
  bidAmount?: string;
  estimatedDuration?: number;
  profitMargin?: string;
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
          eq(employees.isDeleted, false),
        ),
      )
      .limit(1);

    if (!supervisor) {
      throw new Error(
        `Supervisor manager with ID ${data.supervisorManager} does not exist`,
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
          eq(employees.isDeleted, false),
        ),
      )
      .limit(1);

    if (!technician) {
      throw new Error(
        `Primary technician with ID ${data.primaryTechnicianId} does not exist`,
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

  // Validate endDate: cannot be before created date (same or future only). On create, createdDate = now.
  const endDateVal = toDateOrUndefined(data.endDate);
  if (endDateVal) {
    const createdToday = new Date().toISOString().split("T")[0] ?? "";
    if (createdToday && endDateVal < createdToday) {
      throw new Error(
        "endDate cannot be before created date; it must be the same date or a future date",
      );
    }
  }

  // Insert bid - no retry logic needed since bidNumber is guaranteed unique
  const result = await db
    .insert(bidsTable)
    .values({
      bidNumber,
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
      endDate: endDateVal,
      plannedStartDate: toDateOrUndefined(data.plannedStartDate),
      estimatedCompletion: toDateOrUndefined(data.estimatedCompletion),
      removalDate: toDateOrUndefined(data.removalDate),
      bidAmount: data.bidAmount || "0",
      estimatedDuration: data.estimatedDuration ?? undefined,
      profitMargin: data.profitMargin || undefined,
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

    // Automatically create a "created" timeline event
    const createdDateIso =
      bid.createdDate?.toISOString() ?? new Date().toISOString();
    await createBidTimelineEvent({
      bidId: bid.id,
      event: "created",
      eventDate: createdDateIso,
      estimatedDuration: 0,
      durationType: "days",
      isCompleted: true,
      description: "Bid created",
      createdBy: data.createdBy,
    });

    // Only create "end date" timeline event when endDate is given; if null/undefined/empty, do not create
    const endDateValue = bid.endDate ?? data.endDate;
    if (endDateValue != null && endDateValue !== "") {
      const endDateEvent =
        typeof endDateValue === "string"
          ? new Date(endDateValue + "T23:59:59.000Z").toISOString()
          : new Date(endDateValue).toISOString();
      const createdDate = bid.createdDate
        ? new Date(bid.createdDate)
        : new Date();
      const endDate = new Date(endDateEvent);
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysBetween = Math.max(
        0,
        Math.floor((endDate.getTime() - createdDate.getTime()) / msPerDay),
      );
      await createBidTimelineEvent({
        bidId: bid.id,
        event: "end date",
        eventDate: endDateEvent,
        estimatedDuration: daysBetween,
        durationType: "days",
        isCompleted: false,
        description: "Project end date",
        sortOrder: 1,
        createdBy: data.createdBy,
      });
    }
  }

  if (!bid) return null;

  // Get createdBy user name
  let createdByName: string | null = null;
  if (bid.createdBy) {
    const [creator] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, bid.createdBy))
      .limit(1);
    createdByName = creator?.fullName || null;
  }

  return {
    ...bid,
    createdByName,
    expiresIn: computeExpiresIn(bid),
  };
};

export const updateBid = async (
  id: string,
  organizationId: string,
  data: Partial<{
    status: string;
    priority: string;
    projectName: string;
    siteAddress: string;
    scopeOfWork: string;
    description: string;
    endDate: string;
    plannedStartDate: string;
    estimatedCompletion: string;
    removalDate: string;
    bidAmount: string;
    supervisorManager: number;
    primaryTechnicianId: number;
    assignedTo: string;
  }>,
) => {
  // Validate endDate: cannot be before bid's created date
  if (data.endDate) {
    const existing = await getBidByIdSimple(id);
    if (existing?.createdDate) {
      const endStr = new Date(data.endDate).toISOString().split("T")[0] ?? "";
      const createdStr =
        typeof existing.createdDate === "string"
          ? existing.createdDate.slice(0, 10)
          : (new Date(existing.createdDate).toISOString().split("T")[0] ?? "");
      if (endStr && createdStr && endStr < createdStr) {
        throw new Error(
          "endDate cannot be before created date; it must be the same date or a future date",
        );
      }
    }
  }

  const [bid] = await db
    .update(bidsTable)
    .set({
      status: data.status as any,
      priority: data.priority as any,
      projectName: data.projectName,
      siteAddress: data.siteAddress,
      scopeOfWork: data.scopeOfWork,
      description: data.description,
      endDate: data.endDate
        ? new Date(data.endDate).toISOString().split("T")[0]
        : undefined,
      plannedStartDate: data.plannedStartDate
        ? new Date(data.plannedStartDate).toISOString().split("T")[0]
        : undefined,
      estimatedCompletion: data.estimatedCompletion
        ? new Date(data.estimatedCompletion).toISOString().split("T")[0]
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
        eq(bidsTable.isDeleted, false),
      ),
    )
    .returning();

  if (!bid) return null;

  // Get createdBy user name
  let createdByName: string | null = null;
  if (bid.createdBy) {
    const [creator] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, bid.createdBy))
      .limit(1);
    createdByName = creator?.fullName || null;
  }

  return {
    ...bid,
    createdByName,
    expiresIn: computeExpiresIn(bid),
  };
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
        eq(bidsTable.isDeleted, false),
      ),
    )
    .returning();

  return bid || null;
};

// ============================
// Financial Breakdown Operations
// ============================

export const getBidFinancialBreakdown = async (
  bidId: string,
  _organizationId: string,
) => {
  const [breakdown] = await db
    .select()
    .from(bidFinancialBreakdown)
    .where(
      and(
        eq(bidFinancialBreakdown.bidId, bidId),
        eq(bidFinancialBreakdown.isDeleted, false),
      ),
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
    totalPrice?: string;
    grossProfit?: string;
  },
) => {
  const totalPrice = data.totalPrice ?? "0";
  const grossProfit =
    data.grossProfit ??
    (parseFloat(totalPrice) - parseFloat(data.totalCost ?? "0")).toFixed(2);

  const payload = {
    ...data,
    totalPrice,
    grossProfit,
  };

  const existing = await getBidFinancialBreakdown(bidId, organizationId);

  if (existing) {
    const [breakdown] = await db
      .update(bidFinancialBreakdown)
      .set({
        ...payload,
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
        ...payload,
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
  _organizationId: string,
) => {
  // Verify bid exists
  const bid = await getBidById(bidId);
  if (!bid) {
    return null;
  }

  const [operatingExpenses] = await db
    .select()
    .from(bidOperatingExpenses)
    .where(
      and(
        eq(bidOperatingExpenses.bidId, bidId),
        eq(bidOperatingExpenses.isDeleted, false),
      ),
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
  }>,
) => {
  // Verify bid exists
  const bid = await getBidById(bidId);
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

export const createBidOperatingExpenses = async (
  bidId: string,
  organizationId: string,
  data: {
    enabled?: boolean;
    grossRevenuePreviousYear?: string;
    currentBidAmount?: string;
    operatingCostPreviousYear?: string;
    inflationAdjustedOperatingCost?: string;
    inflationRate?: string;
    utilizationPercentage?: string;
    calculatedOperatingCost?: string;
    applyMarkup?: boolean;
    markupPercentage?: string;
    operatingPrice?: string;
  },
) => {
  const bid = await getBidById(bidId);
  if (!bid) return null;

  const existing = await getBidOperatingExpenses(bidId, organizationId);
  if (existing) return "exists"; // signal conflict for controller

  const [operatingExpenses] = await db
    .insert(bidOperatingExpenses)
    .values({
      bidId,
      ...data,
    })
    .returning();
  return operatingExpenses;
};

export const deleteBidOperatingExpenses = async (
  bidId: string,
  organizationId: string,
) => {
  const bid = await getBidById(bidId);
  if (!bid) return null;

  const existing = await getBidOperatingExpenses(bidId, organizationId);
  if (!existing) return null;

  const [operatingExpenses] = await db
    .update(bidOperatingExpenses)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(bidOperatingExpenses.id, existing.id))
    .returning();
  return operatingExpenses ?? null;
};

// ============================
// Materials Operations
// ============================

export const getBidMaterials = async (
  bidId: string,
  _organizationId: string,
) => {
  const materials = await db
    .select()
    .from(bidMaterials)
    .where(
      and(eq(bidMaterials.bidId, bidId), eq(bidMaterials.isDeleted, false)),
    );
  return materials;
};

export const getBidMaterialById = async (
  materialId: string,
  _organizationId: string,
) => {
  const [material] = await db
    .select()
    .from(bidMaterials)
    .where(
      and(eq(bidMaterials.id, materialId), eq(bidMaterials.isDeleted, false)),
    );
  return material || null;
};

export const createBidMaterial = async (data: {
  bidId: string;
  inventoryItemId?: string;
  customName?: string;
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
    inventoryItemId: string;
    customName: string;
    description: string;
    quantity: string;
    unitCost: string;
    markup: string;
    totalCost: string;
  }>,
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

export const deleteBidMaterial = async (
  id: string,
  _organizationId: string,
) => {
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
    .select({
      id: bidLabor.id,
      bidId: bidLabor.bidId,
      positionId: bidLabor.positionId,
      positionName: positions.name,
      days: bidLabor.days,
      hoursPerDay: bidLabor.hoursPerDay,
      totalHours: bidLabor.totalHours,
      costRate: bidLabor.costRate,
      billableRate: bidLabor.billableRate,
      totalCost: bidLabor.totalCost,
      totalPrice: bidLabor.totalPrice,
      isDeleted: bidLabor.isDeleted,
      createdAt: bidLabor.createdAt,
      updatedAt: bidLabor.updatedAt,
    })
    .from(bidLabor)
    .leftJoin(positions, eq(bidLabor.positionId, positions.id))
    .where(and(eq(bidLabor.bidId, bidId), eq(bidLabor.isDeleted, false)));
  return labor;
};

export const getBidLaborById = async (laborId: string) => {
  const [labor] = await db
    .select({
      id: bidLabor.id,
      bidId: bidLabor.bidId,
      positionId: bidLabor.positionId,
      positionName: positions.name,
      days: bidLabor.days,
      hoursPerDay: bidLabor.hoursPerDay,
      totalHours: bidLabor.totalHours,
      costRate: bidLabor.costRate,
      billableRate: bidLabor.billableRate,
      totalCost: bidLabor.totalCost,
      totalPrice: bidLabor.totalPrice,
      isDeleted: bidLabor.isDeleted,
      createdAt: bidLabor.createdAt,
      updatedAt: bidLabor.updatedAt,
    })
    .from(bidLabor)
    .leftJoin(positions, eq(bidLabor.positionId, positions.id))
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
  try {
    const [labor] = await db.insert(bidLabor).values(data).returning();
    if (!labor) {
      throw new Error("Failed to create labor entry - no data returned");
    }
    return labor;
  } catch (error) {
    console.error("Error in createBidLabor:", error);
    throw error;
  }
};

export const updateBidLabor = async (
  id: string,
  data: Partial<{
    positionId: number;
    days: number;
    hoursPerDay: string;
    totalHours: string;
    costRate: string;
    billableRate: string;
    totalCost: string;
    totalPrice: string;
  }>,
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
      and(eq(bidTravel.bidLaborId, bidLaborId), eq(bidTravel.isDeleted, false)),
    );
  return travel;
};

export const getAllBidTravel = async (bidId: string) => {
  try {
    // First get all labor entries for this bid
    const laborEntries = await db
      .select({
        id: bidLabor.id,
        positionId: bidLabor.positionId,
      })
      .from(bidLabor)
      .where(and(eq(bidLabor.bidId, bidId), eq(bidLabor.isDeleted, false)));

    if (laborEntries.length === 0) {
      return []; // No labor entries, so no travel entries
    }

    // Get all travel entries for these labor entries
    const laborIds = laborEntries.map((labor) => labor.id);

    // Use simple select() to get all columns and avoid field-specific issues
    const travel = await db
      .select()
      .from(bidTravel)
      .where(
        and(
          inArray(bidTravel.bidLaborId, laborIds),
          eq(bidTravel.isDeleted, false),
        ),
      )
      .orderBy(asc(bidTravel.createdAt));

    return travel;
  } catch (error) {
    console.error("Error in getAllBidTravel:", error);
    throw error; // Re-throw for proper error handling in controller
  }
};

export const getBidTravelById = async (travelId: string) => {
  const [travel] = await db
    .select()
    .from(bidTravel)
    .where(and(eq(bidTravel.id, travelId), eq(bidTravel.isDeleted, false)));
  return travel || null;
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
    positionId: number;
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
  }>,
) => {
  // Validate arrays have same length
  if (laborEntries.length !== travelEntries.length) {
    throw new Error(
      "Number of labor entries must equal number of travel entries",
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
        positionId: laborData.positionId,
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
  }>,
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
  _organizationId: string,
) => {
  const [surveyData] = await db
    .select()
    .from(bidSurveyData)
    .where(
      and(eq(bidSurveyData.bidId, bidId), eq(bidSurveyData.isDeleted, false)),
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
  }>,
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
  _organizationId: string,
) => {
  const [planSpecData] = await db
    .select()
    .from(bidPlanSpecData)
    .where(
      and(
        eq(bidPlanSpecData.bidId, bidId),
        eq(bidPlanSpecData.isDeleted, false),
      ),
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
  }>,
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
    specificationsReceivedDate: toDateOrUndefined(
      data.specificationsReceivedDate,
    ),
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
  _organizationId: string,
) => {
  const [designBuildData] = await db
    .select()
    .from(bidDesignBuildData)
    .where(
      and(
        eq(bidDesignBuildData.bidId, bidId),
        eq(bidDesignBuildData.isDeleted, false),
      ),
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
  }>,
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

export const getBidTimeline = async (bidId: string) => {
  const timeline = await db
    .select()
    .from(bidTimeline)
    .where(and(eq(bidTimeline.bidId, bidId), eq(bidTimeline.isDeleted, false)))
    .orderBy(asc(bidTimeline.sortOrder), asc(bidTimeline.eventDate));
  return timeline;
};

export const getBidTimelineEventById = async (eventId: string) => {
  const [timelineEvent] = await db
    .select()
    .from(bidTimeline)
    .where(and(eq(bidTimeline.id, eventId), eq(bidTimeline.isDeleted, false)));
  return timelineEvent || null;
};

export const createBidTimelineEvent = async (data: {
  bidId: string;
  event: string;
  eventDate: string;
  estimatedDuration: number;
  durationType: string;
  isCompleted?: boolean;
  description?: string;
  sortOrder?: number;
  createdBy?: string;
}) => {
  const [timelineEvent] = await db
    .insert(bidTimeline)
    .values({
      bidId: data.bidId,
      event: data.event,
      eventDate: new Date(data.eventDate),
      estimatedDuration: data.estimatedDuration,
      durationType: data.durationType,
      isCompleted: data.isCompleted ?? false,
      description: data.description,
      sortOrder: data.sortOrder ?? 0,
      createdBy: data.createdBy,
    })
    .returning();
  return timelineEvent;
};

export const updateBidTimelineEvent = async (
  id: string,
  data: Partial<{
    event: string;
    eventDate: string;
    estimatedDuration: number;
    durationType: string;
    isCompleted: boolean;
    description: string;
    sortOrder: number;
  }>,
) => {
  const [timelineEvent] = await db
    .update(bidTimeline)
    .set({
      event: data.event,
      eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
      estimatedDuration: data.estimatedDuration,
      durationType: data.durationType,
      isCompleted: data.isCompleted,
      description: data.description,
      sortOrder: data.sortOrder,
      updatedAt: new Date(),
    })
    .where(and(eq(bidTimeline.id, id), eq(bidTimeline.isDeleted, false)))
    .returning();
  return timelineEvent;
};

export const deleteBidTimelineEvent = async (id: string) => {
  const [timelineEvent] = await db
    .update(bidTimeline)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(bidTimeline.id, id), eq(bidTimeline.isDeleted, false)))
    .returning();
  return timelineEvent;
};

// ============================
// Notes Operations
// ============================

export const getBidNotes = async (bidId: string) => {
  const notes = await db
    .select()
    .from(bidNotes)
    .where(and(eq(bidNotes.bidId, bidId), eq(bidNotes.isDeleted, false)))
    .orderBy(desc(bidNotes.createdAt));
  return notes;
};

export const getBidNoteById = async (noteId: string) => {
  const [note] = await db
    .select()
    .from(bidNotes)
    .where(and(eq(bidNotes.id, noteId), eq(bidNotes.isDeleted, false)));
  return note || null;
};

export const createBidNote = async (data: {
  bidId: string;
  note: string;
  createdBy: string;
  isInternal?: boolean;
}) => {
  const [note] = await db.insert(bidNotes).values(data).returning();
  return note;
};

export const updateBidNote = async (
  id: string,
  data: {
    note: string;
    isInternal?: boolean;
  },
) => {
  const [note] = await db
    .update(bidNotes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(bidNotes.id, id), eq(bidNotes.isDeleted, false)))
    .returning();
  return note;
};

export const deleteBidNote = async (id: string) => {
  const [note] = await db
    .update(bidNotes)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(bidNotes.id, id), eq(bidNotes.isDeleted, false)))
    .returning();
  return note;
};

// ============================
// History Operations (Read-only)
// ============================

export const getBidHistory = async (bidId: string) => {
  const history = await db
    .select()
    .from(bidHistory)
    .where(eq(bidHistory.bidId, bidId))
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
// Format: BID-2025-000001 (6 digits, auto-expands to 7, 8, 9+ as needed)
// This is THREAD-SAFE and prevents race conditions
const generateBidNumber = async (organizationId: string): Promise<string> => {
  const year = new Date().getFullYear();

  try {
    // Use atomic database function to get next counter value
    const result = await db.execute<{ next_value: string }>(
      sql.raw(
        `SELECT org.get_next_counter('${organizationId}'::uuid, 'bid_number') as next_value`,
      ),
    );

    const nextNumber = parseInt(result.rows[0]?.next_value || "1");
    // Use 4 digits minimum, auto-expand when exceeds 9999
    const padding = Math.max(4, nextNumber.toString().length);
    return `BID-${year}-${nextNumber.toString().padStart(padding, "0")}`;
  } catch (error) {
    // Fallback to old method if function doesn't exist yet
    console.warn("Counter function not found, using fallback method:", error);

    const maxResult = await db
      .select({
        maxBidNumber: max(bidsTable.bidNumber),
      })
      .from(bidsTable)
      .where(
        and(
          eq(bidsTable.organizationId, organizationId),
          sql`${bidsTable.bidNumber} ~ ${`^BID-${year}-\\d+$`}`,
        ),
      );

    const maxBidNumber = maxResult[0]?.maxBidNumber;
    let nextNumber = 1;

    if (maxBidNumber) {
      const match = maxBidNumber.match(/BID-\d+-(\d+)/);
      if (match && match[1]) {
        const currentNumber = parseInt(match[1], 10);
        nextNumber = currentNumber + 1;
      }
    }

    // Use 4 digits minimum, auto-expand when exceeds 9999
    const padding = Math.max(4, nextNumber.toString().length);
    return `BID-${year}-${nextNumber.toString().padStart(padding, "0")}`;
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
    | "preventative_maintenance",
) => {
  // Create financial breakdown
  await db.insert(bidFinancialBreakdown).values({
    bidId,
    materialsEquipment: "0",
    labor: "0",
    travel: "0",
    operatingExpenses: "0",
    totalCost: "0",
    totalPrice: "0",
    grossProfit: "0",
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

export const getBidWithAllData = async (id: string) => {
  const bid = await getBidById(id);
  if (!bid) return null;

  // Use the bid's organizationId for related data that still needs it
  const organizationId = bid.organizationId;

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
    clientInfo,
    operatingExpenses,
  ] = await Promise.all([
    getBidFinancialBreakdown(id, organizationId),
    getBidMaterials(id, organizationId),
    getBidLabor(id),
    getBidSurveyData(id, organizationId),
    getBidPlanSpecData(id, organizationId),
    getBidDesignBuildData(id, organizationId),
    getBidTimeline(id),
    getBidNotes(id),
    getBidHistory(id),
    getOrganizationById(organizationId),
    getBidOperatingExpenses(id, organizationId),
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
    clientInfo: clientInfo?.organization ?? null,
    operatingExpenses: operatingExpenses ?? null,
  };
};

// ============================
// Bid Documents Operations
// ============================

export const getBidDocuments = async (bidId: string) => {
  const documentsResult = await db
    .select({
      document: bidDocuments,
      uploadedByName: users.fullName,
    })
    .from(bidDocuments)
    .leftJoin(users, eq(bidDocuments.uploadedBy, users.id))
    .where(
      and(eq(bidDocuments.bidId, bidId), eq(bidDocuments.isDeleted, false)),
    )
    .orderBy(desc(bidDocuments.createdAt));

  return documentsResult.map((doc) => ({
    ...doc.document,
    uploadedByName: doc.uploadedByName || null,
  }));
};

export const getBidDocumentById = async (documentId: string) => {
  const [result] = await db
    .select({
      document: bidDocuments,
      uploadedByName: users.fullName,
    })
    .from(bidDocuments)
    .leftJoin(users, eq(bidDocuments.uploadedBy, users.id))
    .where(
      and(eq(bidDocuments.id, documentId), eq(bidDocuments.isDeleted, false)),
    );

  if (!result) return null;

  return {
    ...result.document,
    uploadedByName: result.uploadedByName || null,
  };
};

export const createBidDocument = async (data: {
  bidId: string;
  fileName: string;
  filePath: string;
  fileType?: string;
  fileSize?: number;
  documentType?: string;
  uploadedBy: string;
}) => {
  const [document] = await db
    .insert(bidDocuments)
    .values({
      bidId: data.bidId,
      fileName: data.fileName,
      filePath: data.filePath,
      fileType: data.fileType || undefined,
      fileSize: data.fileSize || undefined,
      documentType: data.documentType || undefined,
      uploadedBy: data.uploadedBy,
    })
    .returning();
  return document;
};

export const createBidDocuments = async (
  bidId: string,
  documents: Array<{
    fileName: string;
    filePath: string;
    fileType?: string;
    fileSize?: number;
    documentType?: string;
    uploadedBy: string;
  }>,
) => {
  if (documents.length === 0) {
    return [];
  }

  const insertedDocuments = await db
    .insert(bidDocuments)
    .values(
      documents.map((doc) => ({
        bidId,
        fileName: doc.fileName,
        filePath: doc.filePath,
        fileType: doc.fileType || undefined,
        fileSize: doc.fileSize || undefined,
        documentType: doc.documentType || undefined,
        uploadedBy: doc.uploadedBy,
      })),
    )
    .returning();

  return insertedDocuments;
};

export const updateBidDocument = async (
  documentId: string,
  data: Partial<{
    fileName: string;
    filePath: string;
    fileType: string;
    fileSize: number;
    documentType: string;
  }>,
) => {
  const [document] = await db
    .update(bidDocuments)
    .set({
      fileName: data.fileName,
      filePath: data.filePath,
      fileType: data.fileType,
      fileSize: data.fileSize,
      documentType: data.documentType,
      updatedAt: new Date(),
    })
    .where(
      and(eq(bidDocuments.id, documentId), eq(bidDocuments.isDeleted, false)),
    )
    .returning();
  return document || null;
};

export const deleteBidDocument = async (documentId: string) => {
  const [document] = await db
    .update(bidDocuments)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(eq(bidDocuments.id, documentId), eq(bidDocuments.isDeleted, false)),
    )
    .returning();
  return document || null;
};
