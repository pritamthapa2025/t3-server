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
  lte,
  isNotNull,
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
  bidDocumentTags,
  bidDocumentTagLinks,
  bidMedia,
} from "../drizzle/schema/bids.schema.js";
import { employees, positions } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import {
  organizations,
  clientContacts,
  properties,
} from "../drizzle/schema/client.schema.js";
import { alias } from "drizzle-orm/pg-core";
import { getOrganizationById } from "./client.service.js";
import { getOperatingExpenseDefaults } from "./settings.service.js";

// ============================
// Main Bid Operations
// ============================

// Aliases for joining users table multiple times (createdBy, assignedTo)
const createdByUser = alias(users, "created_by_user");
const assignedToUser = alias(users, "assigned_to_user");

/** Days from today until endDate (0 if no endDate or already past). For "Expires in X Days" card. */
function expiresInDaysFromToday(bid: {
  endDate?: string | Date | null;
}): number {
  const end = bid.endDate ? new Date(bid.endDate) : null;
  if (!end) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.floor((endDay.getTime() - today.getTime()) / msPerDay);
  return Math.max(0, days);
}

/** Summary fields for bid cards: Bid Amount, Estimated Duration, Profit Margin, Expires in. */
export type BidSummaryFields = {
  bidAmount: string;
  estimatedDuration: number;
  profitMargin: number;
  expiresIn: number;
};

function getBidSummaryFields(bid: {
  bidAmount?: string | null;
  estimatedDuration?: number | null;
  profitMargin?: string | null;
  endDate?: string | Date | null;
  plannedStartDate?: string | Date | null;
  estimatedCompletion?: string | Date | null;
}): BidSummaryFields {
  const amount = Number(bid.bidAmount) || 0;
  const margin = bid.profitMargin != null ? Number(bid.profitMargin) : 0;

  // Calculate estimated duration from dates if available
  let duration = bid.estimatedDuration ?? 0;
  if (bid.plannedStartDate && bid.estimatedCompletion) {
    const startDate = new Date(bid.plannedStartDate);
    const endDate = new Date(bid.estimatedCompletion);
    const msPerDay = 24 * 60 * 60 * 1000;
    duration = Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay);
  }

  return {
    bidAmount: amount.toFixed(2),
    estimatedDuration: duration,
    profitMargin: Math.round(margin * 100) / 100,
    expiresIn: expiresInDaysFromToday(bid),
  };
}

/** Fetch minimal primary contact by id (for bid response). */
async function getPrimaryContactMinimal(contactId: string | null | undefined) {
  if (!contactId) return null;
  const [c] = await db
    .select({
      id: clientContacts.id,
      fullName: clientContacts.fullName,
      email: clientContacts.email,
      phone: clientContacts.phone,
      title: clientContacts.title,
    })
    .from(clientContacts)
    .where(
      and(
        eq(clientContacts.id, contactId),
        eq(clientContacts.isDeleted, false),
      ),
    )
    .limit(1);
  return c ?? null;
}

/** Fetch minimal property by id (for bid response). */
async function getPropertyMinimal(propertyId: string | null | undefined) {
  if (!propertyId) return null;
  const [p] = await db
    .select({
      id: properties.id,
      propertyName: properties.propertyName,
      propertyCode: properties.propertyCode,
      addressLine1: properties.addressLine1,
      city: properties.city,
      state: properties.state,
      zipCode: properties.zipCode,
    })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.isDeleted, false)))
    .limit(1);
  return p ?? null;
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
      // totalPrice from bid_financial_breakdown
      totalPrice: bidFinancialBreakdown.totalPrice,
      // Minimal primary contact (only when primaryContactId is set)
      contactId: clientContacts.id,
      contactFullName: clientContacts.fullName,
      contactEmail: clientContacts.email,
      contactPhone: clientContacts.phone,
      contactTitle: clientContacts.title,
      // Minimal property (only when propertyId is set)
      propId: properties.id,
      propPropertyName: properties.propertyName,
      propPropertyCode: properties.propertyCode,
      propAddressLine1: properties.addressLine1,
      propCity: properties.city,
      propState: properties.state,
      propZipCode: properties.zipCode,
    })
    .from(bidsTable)
    .leftJoin(createdByUser, eq(bidsTable.createdBy, createdByUser.id))
    .leftJoin(assignedToUser, eq(bidsTable.assignedTo, assignedToUser.id))
    .leftJoin(organizations, eq(bidsTable.organizationId, organizations.id))
    .leftJoin(
      bidFinancialBreakdown,
      and(
        eq(bidsTable.id, bidFinancialBreakdown.bidId),
        eq(bidFinancialBreakdown.isDeleted, false),
      ),
    )
    .leftJoin(
      clientContacts,
      and(
        eq(bidsTable.primaryContactId, clientContacts.id),
        eq(clientContacts.isDeleted, false),
      ),
    )
    .leftJoin(
      properties,
      and(
        eq(bidsTable.propertyId, properties.id),
        eq(properties.isDeleted, false),
      ),
    )
    .where(whereCondition)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(bidsTable.createdAt));

  const totalCount = await db
    .select({ count: count() })
    .from(bidsTable)
    .where(whereCondition);

  const total = totalCount[0]?.count ?? 0;

  // Map results to include createdByName, assignedToName, organization data, primaryContact, property, and derived expiresIn
  const enrichedBids = result.map((item) => {
    const primaryContact =
      item.bid.primaryContactId && item.contactId
        ? {
            id: item.contactId,
            fullName: item.contactFullName,
            email: item.contactEmail,
            phone: item.contactPhone,
            title: item.contactTitle,
          }
        : null;
    const property =
      item.bid.propertyId && item.propId
        ? {
            id: item.propId,
            propertyName: item.propPropertyName,
            propertyCode: item.propPropertyCode,
            addressLine1: item.propAddressLine1,
            city: item.propCity,
            state: item.propState,
            zipCode: item.propZipCode,
          }
        : null;
    return {
      ...item.bid,
      totalPrice: item.totalPrice ?? null,
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
      ...(primaryContact && { primaryContact }),
      ...(property && { property }),
      expiresIn: expiresInDaysFromToday(item.bid),
    };
  });

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
  const [primaryContact, property] = await Promise.all([
    getPrimaryContactMinimal(result.bid.primaryContactId),
    getPropertyMinimal(result.bid.propertyId),
  ]);
  const bidSummary = getBidSummaryFields(result.bid);
  return {
    ...result.bid,
    createdByName: result.createdByName ?? null,
    assignedToName: result.assignedToName ?? null,
    expiresIn: expiresInDaysFromToday(result.bid),
    bidSummary,
    ...(primaryContact && { primaryContact }),
    ...(property && { property }),
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
  const [primaryContact, property] = await Promise.all([
    getPrimaryContactMinimal(result.bid.primaryContactId),
    getPropertyMinimal(result.bid.propertyId),
  ]);
  const bidSummary = getBidSummaryFields(result.bid);
  return {
    ...result.bid,
    createdByName: result.createdByName ?? null,
    assignedToName: result.assignedToName ?? null,
    expiresIn: expiresInDaysFromToday(result.bid),
    bidSummary,
    ...(primaryContact && { primaryContact }),
    ...(property && { property }),
  };
};

export const createBid = async (data: {
  organizationId: string;
  primaryContactId?: string | null;
  propertyId?: string | null;
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
      primaryContactId: data.primaryContactId ?? undefined,
      propertyId: data.propertyId ?? undefined,
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

  return getBidById(bid.id);
};

export const updateBid = async (
  id: string,
  organizationId: string,
  data: Partial<{
    status: string;
    priority: string;
    projectName: string;
    siteAddress: string;
    buildingSuiteNumber: string;
    acrossValuations: string;
    scopeOfWork: string;
    specialRequirements: string;
    description: string;
    endDate: string;
    plannedStartDate: string;
    estimatedCompletion: string;
    removalDate: string;
    bidAmount: string;
    estimatedDuration: number;
    profitMargin: string;
    paymentTerms: string;
    warrantyPeriod: string;
    warrantyPeriodLabor: string;
    warrantyDetails: string;
    specialTerms: string;
    exclusions: string;
    proposalBasis: string;
    referenceDate: string;
    templateSelection: string;
    primaryContactId: string | null;
    propertyId: string | null;
    supervisorManager: number;
    primaryTechnicianId: number;
    assignedTo: string;
    qtyNumber: string;
    marked: string;
    convertToJob: boolean;
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
      buildingSuiteNumber: data.buildingSuiteNumber,
      acrossValuations: data.acrossValuations,
      scopeOfWork: data.scopeOfWork,
      specialRequirements: data.specialRequirements,
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
      estimatedDuration: data.estimatedDuration,
      profitMargin: data.profitMargin,
      paymentTerms: data.paymentTerms,
      warrantyPeriod: data.warrantyPeriod,
      warrantyPeriodLabor: data.warrantyPeriodLabor,
      warrantyDetails: data.warrantyDetails,
      specialTerms: data.specialTerms,
      exclusions: data.exclusions,
      proposalBasis: data.proposalBasis,
      referenceDate: data.referenceDate,
      templateSelection: data.templateSelection,
      primaryContactId: data.primaryContactId ?? undefined,
      propertyId: data.propertyId ?? undefined,
      supervisorManager: data.supervisorManager ?? undefined,
      primaryTechnicianId: data.primaryTechnicianId ?? undefined,
      assignedTo: data.assignedTo,
      qtyNumber: data.qtyNumber,
      marked: data.marked,
      convertToJob: data.convertToJob,
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

  return getBidById(id);
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
    materialsEquipment?: string;
    labor?: string;
    travel?: string;
    operatingExpenses?: string;
    totalCost?: string;
    totalPrice?: string;
    grossProfit?: string;
    actualMaterialsEquipment?: string;
    actualLabor?: string;
    actualTravel?: string;
    actualOperatingExpenses?: string;
    actualTotalCost?: string;
    actualTotalPrice?: string;
    actualGrossProfit?: string;
  },
) => {
  const existing = await getBidFinancialBreakdown(bidId, organizationId);

  const hasInitial =
    data.materialsEquipment !== undefined ||
    data.labor !== undefined ||
    data.travel !== undefined ||
    data.operatingExpenses !== undefined ||
    data.totalCost !== undefined ||
    data.totalPrice !== undefined ||
    data.grossProfit !== undefined;
  const hasActual =
    data.actualMaterialsEquipment !== undefined ||
    data.actualLabor !== undefined ||
    data.actualTravel !== undefined ||
    data.actualOperatingExpenses !== undefined ||
    data.actualTotalCost !== undefined ||
    data.actualTotalPrice !== undefined ||
    data.actualGrossProfit !== undefined;

  const totalPrice = data.totalPrice ?? existing?.totalPrice ?? "0";
  const totalCost = data.totalCost ?? existing?.totalCost ?? "0";
  const grossProfit =
    data.grossProfit ??
    existing?.grossProfit ??
    (parseFloat(totalPrice) - parseFloat(totalCost)).toFixed(2);

  const setPayload: Record<string, unknown> = { updatedAt: new Date() };

  // PUT: never update initial on existing row; only update actual. If no row yet (insert), set both from payload.
  if (existing) {
    if (hasInitial && !hasActual) {
      setPayload.actualMaterialsEquipment =
        data.materialsEquipment ?? existing.actualMaterialsEquipment ?? "0";
      setPayload.actualLabor = data.labor ?? existing.actualLabor ?? "0";
      setPayload.actualTravel = data.travel ?? existing.actualTravel ?? "0";
      setPayload.actualOperatingExpenses =
        data.operatingExpenses ?? existing.actualOperatingExpenses ?? "0";
      setPayload.actualTotalCost =
        data.totalCost ?? existing.actualTotalCost ?? "0";
      setPayload.actualTotalPrice =
        data.totalPrice ?? existing.actualTotalPrice ?? "0";
      setPayload.actualGrossProfit =
        data.grossProfit ?? existing.actualGrossProfit ?? "0";
    } else if (hasActual) {
      if (data.actualMaterialsEquipment !== undefined)
        setPayload.actualMaterialsEquipment = data.actualMaterialsEquipment;
      if (data.actualLabor !== undefined)
        setPayload.actualLabor = data.actualLabor;
      if (data.actualTravel !== undefined)
        setPayload.actualTravel = data.actualTravel;
      if (data.actualOperatingExpenses !== undefined)
        setPayload.actualOperatingExpenses = data.actualOperatingExpenses;
      if (data.actualTotalCost !== undefined)
        setPayload.actualTotalCost = data.actualTotalCost;
      if (data.actualTotalPrice !== undefined)
        setPayload.actualTotalPrice = data.actualTotalPrice;
      if (data.actualGrossProfit !== undefined)
        setPayload.actualGrossProfit = data.actualGrossProfit;
    }
  } else if (hasInitial) {
    setPayload.materialsEquipment = data.materialsEquipment ?? "0";
    setPayload.labor = data.labor ?? "0";
    setPayload.travel = data.travel ?? "0";
    setPayload.operatingExpenses = data.operatingExpenses ?? "0";
    setPayload.totalCost = data.totalCost ?? "0";
    setPayload.totalPrice = data.totalPrice ?? totalPrice;
    setPayload.grossProfit = data.grossProfit ?? grossProfit;
    setPayload.actualMaterialsEquipment = data.materialsEquipment ?? "0";
    setPayload.actualLabor = data.labor ?? "0";
    setPayload.actualTravel = data.travel ?? "0";
    setPayload.actualOperatingExpenses = data.operatingExpenses ?? "0";
    setPayload.actualTotalCost = data.totalCost ?? "0";
    setPayload.actualTotalPrice = data.totalPrice ?? totalPrice;
    setPayload.actualGrossProfit = data.grossProfit ?? grossProfit;
  }

  let result;
  if (existing) {
    const [breakdown] = await db
      .update(bidFinancialBreakdown)
      .set(setPayload as any)
      .where(eq(bidFinancialBreakdown.id, existing.id))
      .returning();
    result = breakdown;
  } else if (hasInitial) {
    const [breakdown] = await db
      .insert(bidFinancialBreakdown)
      .values({
        bidId,
        materialsEquipment: (setPayload.materialsEquipment as string) ?? "0",
        labor: (setPayload.labor as string) ?? "0",
        travel: (setPayload.travel as string) ?? "0",
        operatingExpenses: (setPayload.operatingExpenses as string) ?? "0",
        totalCost: (setPayload.totalCost as string) ?? "0",
        totalPrice: (setPayload.totalPrice as string) ?? "0",
        grossProfit: (setPayload.grossProfit as string) ?? "0",
        actualMaterialsEquipment:
          (setPayload.actualMaterialsEquipment as string) ??
          (setPayload.materialsEquipment as string) ??
          "0",
        actualLabor:
          (setPayload.actualLabor as string) ??
          (setPayload.labor as string) ??
          "0",
        actualTravel:
          (setPayload.actualTravel as string) ??
          (setPayload.travel as string) ??
          "0",
        actualOperatingExpenses:
          (setPayload.actualOperatingExpenses as string) ??
          (setPayload.operatingExpenses as string) ??
          "0",
        actualTotalCost:
          (setPayload.actualTotalCost as string) ??
          (setPayload.totalCost as string) ??
          "0",
        actualTotalPrice:
          (setPayload.actualTotalPrice as string) ??
          (setPayload.totalPrice as string) ??
          "0",
        actualGrossProfit:
          (setPayload.actualGrossProfit as string) ??
          (setPayload.grossProfit as string) ??
          "0",
      } as any)
      .returning();
    result = breakdown;
  } else {
    return existing;
  }

  if (!existing && hasInitial) {
    await recalculateAndApplyBidOperatingExpenses(bidId, organizationId);
  }
  const updated = await getBidFinancialBreakdown(bidId, organizationId);
  return updated ?? result;
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
    actualCurrentBidAmount: string;
    actualCalculatedOperatingCost: string;
    actualInflationAdjustedOperatingCost: string;
    actualOperatingPrice: string;
  }>,
) => {
  const bid = await getBidById(bidId);
  if (!bid) return null;

  const existing = await getBidOperatingExpenses(bidId, organizationId);
  const hasActual =
    data.actualCurrentBidAmount !== undefined ||
    data.actualCalculatedOperatingCost !== undefined ||
    data.actualInflationAdjustedOperatingCost !== undefined ||
    data.actualOperatingPrice !== undefined;
  const hasInitial =
    data.enabled !== undefined ||
    data.grossRevenuePreviousYear !== undefined ||
    data.currentBidAmount !== undefined ||
    data.operatingCostPreviousYear !== undefined ||
    data.inflationRate !== undefined ||
    data.calculatedOperatingCost !== undefined ||
    data.inflationAdjustedOperatingCost !== undefined ||
    data.operatingPrice !== undefined;

  const setPayload: Record<string, unknown> = { updatedAt: new Date() };
  if (existing) {
    if (hasActual) {
      if (data.actualCurrentBidAmount !== undefined)
        setPayload.actualCurrentBidAmount = data.actualCurrentBidAmount;
      if (data.actualCalculatedOperatingCost !== undefined)
        setPayload.actualCalculatedOperatingCost =
          data.actualCalculatedOperatingCost;
      if (data.actualInflationAdjustedOperatingCost !== undefined)
        setPayload.actualInflationAdjustedOperatingCost =
          data.actualInflationAdjustedOperatingCost;
      if (data.actualOperatingPrice !== undefined)
        setPayload.actualOperatingPrice = data.actualOperatingPrice;
    } else if (hasInitial) {
      setPayload.actualCurrentBidAmount =
        data.currentBidAmount ?? existing.actualCurrentBidAmount;
      setPayload.actualCalculatedOperatingCost =
        data.calculatedOperatingCost ?? existing.actualCalculatedOperatingCost;
      setPayload.actualInflationAdjustedOperatingCost =
        data.inflationAdjustedOperatingCost ??
        existing.actualInflationAdjustedOperatingCost;
      setPayload.actualOperatingPrice =
        data.operatingPrice ?? existing.actualOperatingPrice;
    }
  } else {
    Object.assign(setPayload, data);
    setPayload.actualCurrentBidAmount = data.currentBidAmount ?? "0";
    setPayload.actualCalculatedOperatingCost =
      data.calculatedOperatingCost ?? "0";
    setPayload.actualInflationAdjustedOperatingCost =
      data.inflationAdjustedOperatingCost ?? "0";
    setPayload.actualOperatingPrice = data.operatingPrice ?? "0";
  }

  let result;
  if (existing) {
    if (Object.keys(setPayload).length <= 1)
      return (await getBidOperatingExpenses(bidId, organizationId)) ?? null;
    const [operatingExpenses] = await db
      .update(bidOperatingExpenses)
      .set(setPayload as any)
      .where(eq(bidOperatingExpenses.id, existing.id))
      .returning();
    result = operatingExpenses;
  } else {
    const [operatingExpenses] = await db
      .insert(bidOperatingExpenses)
      .values({ bidId, ...setPayload } as any)
      .returning();
    result = operatingExpenses;
  }

  if (!existing && hasInitial) {
    await recalculateAndApplyBidOperatingExpenses(bidId, organizationId);
  }

  return (await getBidOperatingExpenses(bidId, organizationId)) ?? result;
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

/**
 * Calculate operating expense add-on using client's formula:
 * 1. Overhead ratio = Annual Operating Expenses / Annual Revenue
 * 2. Overhead allocation = ratio × direct project cost
 * 3. Inflation offset = allocation × (inflationRate / 100)
 * 4. Total operating add-on = allocation × (1 + inflationRate/100)
 * Final bid = direct cost + add-on, rounded up to nearest dollar.
 */
export const calculateOperatingExpenseAddOn = (params: {
  directCost: number;
  grossRevenuePreviousYear: number;
  operatingCostPreviousYear: number;
  inflationRatePercent: number;
}) => {
  const {
    directCost,
    grossRevenuePreviousYear,
    operatingCostPreviousYear,
    inflationRatePercent,
  } = params;

  if (grossRevenuePreviousYear <= 0 || directCost < 0) {
    return {
      overheadRatio: 0,
      overheadAllocation: 0,
      inflationOffset: 0,
      totalOperatingAddOn: 0,
      finalBidRoundedUp: Math.ceil(directCost),
    };
  }

  const overheadRatio = operatingCostPreviousYear / grossRevenuePreviousYear;
  const overheadAllocation = directCost * overheadRatio;
  const inflationMultiplier = 1 + inflationRatePercent / 100;
  const totalOperatingAddOn = overheadAllocation * inflationMultiplier;
  const inflationOffset = totalOperatingAddOn - overheadAllocation;
  const totalPrice = directCost + totalOperatingAddOn;
  const finalBidRoundedUp = Math.ceil(totalPrice);

  return {
    overheadRatio,
    overheadAllocation,
    inflationOffset,
    totalOperatingAddOn,
    totalPrice,
    finalBidRoundedUp,
  };
};

/**
 * Recalculate operating expense add-on from current bid data and apply to
 * bid_operating_expenses, bid_financial_breakdown, and bids.bidAmount (rounded up).
 * Uses bid's operating expense row for revenue/cost/inflation, falling back to org defaults.
 */
export const recalculateAndApplyBidOperatingExpenses = async (
  bidId: string,
  organizationId: string,
) => {
  const bid = await getBidById(bidId);
  if (!bid) return null;

  const breakdown = await getBidFinancialBreakdown(bidId, organizationId);
  const directCost = breakdown ? parseFloat(breakdown.totalCost ?? "0") : 0;

  const opExRow = await getBidOperatingExpenses(bidId, organizationId);
  const enabled = opExRow?.enabled ?? false;

  if (!enabled) {
    // Clear operating add-on: totalPrice = totalCost, bidAmount = ceil(totalCost)
    const totalPrice = directCost.toFixed(2);
    const bidAmountRounded = Math.ceil(directCost).toString();
    const grossProfit = (parseFloat(totalPrice) - directCost).toFixed(2);

    if (breakdown) {
      await db
        .update(bidFinancialBreakdown)
        .set({
          operatingExpenses: "0",
          totalPrice,
          grossProfit,
          actualOperatingExpenses: "0",
          actualTotalPrice: totalPrice,
          actualGrossProfit: grossProfit,
          updatedAt: new Date(),
        })
        .where(eq(bidFinancialBreakdown.id, breakdown.id));
    }
    await db
      .update(bidsTable)
      .set({ bidAmount: bidAmountRounded, updatedAt: new Date() })
      .where(eq(bidsTable.id, bidId));
    return null;
  }

  // Resolve revenue, operating cost, and inflation from bid row or defaults
  const defaults = await getOperatingExpenseDefaults();
  const grossRevenuePreviousYear = parseFloat(
    opExRow?.grossRevenuePreviousYear ??
      defaults?.grossRevenuePreviousYear ??
      "0",
  );
  const operatingCostPreviousYear = parseFloat(
    opExRow?.operatingCostPreviousYear ??
      defaults?.operatingCostPreviousYear ??
      "0",
  );
  const inflationRatePercent = parseFloat(
    opExRow?.inflationRate ?? defaults?.inflationRate ?? "0",
  );

  const calc = calculateOperatingExpenseAddOn({
    directCost,
    grossRevenuePreviousYear,
    operatingCostPreviousYear,
    inflationRatePercent,
  });

  const totalOperatingAddOnStr = calc.totalOperatingAddOn.toFixed(2);
  const totalPriceStr = calc.totalPrice?.toFixed(2) ?? "0.00";
  const grossProfitStr = calc.totalOperatingAddOn.toFixed(2);

  // Update bid_operating_expenses with calculated fields; keep actual* in sync with initial
  if (opExRow) {
    await db
      .update(bidOperatingExpenses)
      .set({
        currentBidAmount: directCost.toFixed(2),
        calculatedOperatingCost: calc.overheadAllocation.toFixed(2),
        inflationAdjustedOperatingCost: totalOperatingAddOnStr,
        operatingPrice: totalOperatingAddOnStr,
        actualCurrentBidAmount: directCost.toFixed(2),
        actualCalculatedOperatingCost: calc.overheadAllocation.toFixed(2),
        actualInflationAdjustedOperatingCost: totalOperatingAddOnStr,
        actualOperatingPrice: totalOperatingAddOnStr,
        updatedAt: new Date(),
      })
      .where(eq(bidOperatingExpenses.id, opExRow.id));
  }

  // Update bid_financial_breakdown; keep actual* in sync with initial
  if (breakdown) {
    await db
      .update(bidFinancialBreakdown)
      .set({
        operatingExpenses: totalOperatingAddOnStr,
        totalPrice: totalPriceStr,
        grossProfit: grossProfitStr,
        actualOperatingExpenses: totalOperatingAddOnStr,
        actualTotalPrice: totalPriceStr,
        actualGrossProfit: grossProfitStr,
        updatedAt: new Date(),
      })
      .where(eq(bidFinancialBreakdown.id, breakdown.id));
  } else {
    await db.insert(bidFinancialBreakdown).values({
      bidId,
      materialsEquipment: "0",
      labor: "0",
      travel: "0",
      operatingExpenses: totalOperatingAddOnStr,
      totalCost: directCost.toFixed(2),
      totalPrice: totalPriceStr,
      grossProfit: grossProfitStr,
      actualMaterialsEquipment: "0",
      actualLabor: "0",
      actualTravel: "0",
      actualOperatingExpenses: totalOperatingAddOnStr,
      actualTotalCost: directCost.toFixed(2),
      actualTotalPrice: totalPriceStr,
      actualGrossProfit: grossProfitStr,
    } as any);
  }

  // Final bid rounded up to nearest dollar
  await db
    .update(bidsTable)
    .set({
      bidAmount: calc.finalBidRoundedUp.toString(),
      updatedAt: new Date(),
    })
    .where(eq(bidsTable.id, bidId));

  return calc;
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
  totalPrice?: string;
}) => {
  const totalPrice =
    data.totalPrice ??
    (
      parseFloat(data.totalCost) *
      (1 + parseFloat(data.markup || "0") / 100)
    ).toFixed(2);
  const [material] = await db
    .insert(bidMaterials)
    .values({
      ...data,
      totalPrice,
      actualQuantity: data.quantity,
      actualUnitCost: data.unitCost,
      actualMarkup: data.markup,
      actualTotalCost: data.totalCost,
      actualTotalPrice: totalPrice,
    } as any)
    .returning();
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
    totalPrice: string;
    actualQuantity: string;
    actualUnitCost: string;
    actualMarkup: string;
    actualTotalCost: string;
    actualTotalPrice: string;
  }>,
) => {
  const hasActual =
    data.actualQuantity !== undefined ||
    data.actualUnitCost !== undefined ||
    data.actualMarkup !== undefined ||
    data.actualTotalCost !== undefined ||
    data.actualTotalPrice !== undefined;
  const hasInitial =
    data.quantity !== undefined ||
    data.unitCost !== undefined ||
    data.markup !== undefined ||
    data.totalCost !== undefined ||
    data.totalPrice !== undefined;
  const setPayload: Record<string, unknown> = { updatedAt: new Date() };
  if (hasActual) {
    if (data.actualQuantity !== undefined)
      setPayload.actualQuantity = data.actualQuantity;
    if (data.actualUnitCost !== undefined)
      setPayload.actualUnitCost = data.actualUnitCost;
    if (data.actualMarkup !== undefined)
      setPayload.actualMarkup = data.actualMarkup;
    if (data.actualTotalCost !== undefined)
      setPayload.actualTotalCost = data.actualTotalCost;
    if (data.actualTotalPrice !== undefined)
      setPayload.actualTotalPrice = data.actualTotalPrice;
  } else if (hasInitial) {
    if (data.quantity !== undefined) setPayload.actualQuantity = data.quantity;
    if (data.unitCost !== undefined) setPayload.actualUnitCost = data.unitCost;
    if (data.markup !== undefined) setPayload.actualMarkup = data.markup;
    if (data.totalCost !== undefined)
      setPayload.actualTotalCost = data.totalCost;
    if (data.totalPrice !== undefined)
      setPayload.actualTotalPrice = data.totalPrice;
    else if (data.totalCost !== undefined)
      setPayload.actualTotalPrice = data.totalCost;
  }
  if (Object.keys(setPayload).length <= 1)
    return (await getBidMaterialById(id, organizationId)) ?? null;
  const [material] = await db
    .update(bidMaterials)
    .set(setPayload as any)
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
      actualDays: bidLabor.actualDays,
      actualHoursPerDay: bidLabor.actualHoursPerDay,
      actualTotalHours: bidLabor.actualTotalHours,
      actualCostRate: bidLabor.actualCostRate,
      actualBillableRate: bidLabor.actualBillableRate,
      actualTotalCost: bidLabor.actualTotalCost,
      actualTotalPrice: bidLabor.actualTotalPrice,
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
      actualDays: bidLabor.actualDays,
      actualHoursPerDay: bidLabor.actualHoursPerDay,
      actualTotalHours: bidLabor.actualTotalHours,
      actualCostRate: bidLabor.actualCostRate,
      actualBillableRate: bidLabor.actualBillableRate,
      actualTotalCost: bidLabor.actualTotalCost,
      actualTotalPrice: bidLabor.actualTotalPrice,
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
    const [labor] = await db
      .insert(bidLabor)
      .values({
        ...data,
        actualDays: data.days,
        actualHoursPerDay: data.hoursPerDay,
        actualTotalHours: data.totalHours,
        actualCostRate: data.costRate,
        actualBillableRate: data.billableRate,
        actualTotalCost: data.totalCost,
        actualTotalPrice: data.totalPrice,
      } as any)
      .returning();
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
    actualDays: number;
    actualHoursPerDay: string;
    actualTotalHours: string;
    actualCostRate: string;
    actualBillableRate: string;
    actualTotalCost: string;
    actualTotalPrice: string;
  }>,
) => {
  const hasActual =
    data.actualDays !== undefined ||
    data.actualHoursPerDay !== undefined ||
    data.actualTotalHours !== undefined ||
    data.actualCostRate !== undefined ||
    data.actualBillableRate !== undefined ||
    data.actualTotalCost !== undefined ||
    data.actualTotalPrice !== undefined;
  const hasInitial =
    data.days !== undefined ||
    data.hoursPerDay !== undefined ||
    data.totalHours !== undefined ||
    data.costRate !== undefined ||
    data.billableRate !== undefined ||
    data.totalCost !== undefined ||
    data.totalPrice !== undefined;
  const setPayload: Record<string, unknown> = { updatedAt: new Date() };
  if (hasActual) {
    if (data.actualDays !== undefined) setPayload.actualDays = data.actualDays;
    if (data.actualHoursPerDay !== undefined)
      setPayload.actualHoursPerDay = data.actualHoursPerDay;
    if (data.actualTotalHours !== undefined)
      setPayload.actualTotalHours = data.actualTotalHours;
    if (data.actualCostRate !== undefined)
      setPayload.actualCostRate = data.actualCostRate;
    if (data.actualBillableRate !== undefined)
      setPayload.actualBillableRate = data.actualBillableRate;
    if (data.actualTotalCost !== undefined)
      setPayload.actualTotalCost = data.actualTotalCost;
    if (data.actualTotalPrice !== undefined)
      setPayload.actualTotalPrice = data.actualTotalPrice;
  } else if (hasInitial) {
    if (data.days !== undefined) setPayload.actualDays = data.days;
    if (data.hoursPerDay !== undefined)
      setPayload.actualHoursPerDay = data.hoursPerDay;
    if (data.totalHours !== undefined)
      setPayload.actualTotalHours = data.totalHours;
    if (data.costRate !== undefined) setPayload.actualCostRate = data.costRate;
    if (data.billableRate !== undefined)
      setPayload.actualBillableRate = data.billableRate;
    if (data.totalCost !== undefined)
      setPayload.actualTotalCost = data.totalCost;
    if (data.totalPrice !== undefined)
      setPayload.actualTotalPrice = data.totalPrice;
  }
  if (Object.keys(setPayload).length <= 1)
    return (await getBidLaborById(id)) ?? null;
  const [labor] = await db
    .update(bidLabor)
    .set(setPayload as any)
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
  const [travel] = await db
    .insert(bidTravel)
    .values({
      ...data,
      actualRoundTripMiles: data.roundTripMiles,
      actualMileageRate: data.mileageRate,
      actualVehicleDayRate: data.vehicleDayRate,
      actualDays: data.days,
      actualMileageCost: data.mileageCost,
      actualVehicleCost: data.vehicleCost,
      actualMarkup: data.markup,
      actualTotalCost: data.totalCost,
      actualTotalPrice: data.totalPrice,
    } as any)
    .returning();
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
        actualDays: laborData.days,
        actualHoursPerDay: laborData.hoursPerDay,
        actualTotalHours: laborData.totalHours,
        actualCostRate: laborData.costRate,
        actualBillableRate: laborData.billableRate,
        actualTotalCost: laborData.totalCost,
        actualTotalPrice: laborData.totalPrice,
      } as any)
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
        actualRoundTripMiles: travelData.roundTripMiles,
        actualMileageRate: travelData.mileageRate,
        actualVehicleDayRate: travelData.vehicleDayRate,
        actualDays: travelData.days,
        actualMileageCost: travelData.mileageCost,
        actualVehicleCost: travelData.vehicleCost,
        actualMarkup: travelData.markup || "0",
        actualTotalCost: travelData.totalCost,
        actualTotalPrice: travelData.totalPrice,
      } as any)
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
    actualRoundTripMiles: string;
    actualMileageRate: string;
    actualVehicleDayRate: string;
    actualDays: number;
    actualMileageCost: string;
    actualVehicleCost: string;
    actualMarkup: string;
    actualTotalCost: string;
    actualTotalPrice: string;
  }>,
) => {
  const hasActual =
    data.actualRoundTripMiles !== undefined ||
    data.actualMileageRate !== undefined ||
    data.actualVehicleDayRate !== undefined ||
    data.actualDays !== undefined ||
    data.actualMileageCost !== undefined ||
    data.actualVehicleCost !== undefined ||
    data.actualMarkup !== undefined ||
    data.actualTotalCost !== undefined ||
    data.actualTotalPrice !== undefined;
  const hasInitial =
    data.roundTripMiles !== undefined ||
    data.mileageRate !== undefined ||
    data.vehicleDayRate !== undefined ||
    data.days !== undefined ||
    data.mileageCost !== undefined ||
    data.vehicleCost !== undefined ||
    data.markup !== undefined ||
    data.totalCost !== undefined ||
    data.totalPrice !== undefined;
  const setPayload: Record<string, unknown> = { updatedAt: new Date() };
  if (hasActual) {
    if (data.actualRoundTripMiles !== undefined)
      setPayload.actualRoundTripMiles = data.actualRoundTripMiles;
    if (data.actualMileageRate !== undefined)
      setPayload.actualMileageRate = data.actualMileageRate;
    if (data.actualVehicleDayRate !== undefined)
      setPayload.actualVehicleDayRate = data.actualVehicleDayRate;
    if (data.actualDays !== undefined) setPayload.actualDays = data.actualDays;
    if (data.actualMileageCost !== undefined)
      setPayload.actualMileageCost = data.actualMileageCost;
    if (data.actualVehicleCost !== undefined)
      setPayload.actualVehicleCost = data.actualVehicleCost;
    if (data.actualMarkup !== undefined)
      setPayload.actualMarkup = data.actualMarkup;
    if (data.actualTotalCost !== undefined)
      setPayload.actualTotalCost = data.actualTotalCost;
    if (data.actualTotalPrice !== undefined)
      setPayload.actualTotalPrice = data.actualTotalPrice;
  } else if (hasInitial) {
    if (data.roundTripMiles !== undefined)
      setPayload.actualRoundTripMiles = data.roundTripMiles;
    if (data.mileageRate !== undefined)
      setPayload.actualMileageRate = data.mileageRate;
    if (data.vehicleDayRate !== undefined)
      setPayload.actualVehicleDayRate = data.vehicleDayRate;
    if (data.days !== undefined) setPayload.actualDays = data.days;
    if (data.mileageCost !== undefined)
      setPayload.actualMileageCost = data.mileageCost;
    if (data.vehicleCost !== undefined)
      setPayload.actualVehicleCost = data.vehicleCost;
    if (data.markup !== undefined) setPayload.actualMarkup = data.markup;
    if (data.totalCost !== undefined)
      setPayload.actualTotalCost = data.totalCost;
    if (data.totalPrice !== undefined)
      setPayload.actualTotalPrice = data.totalPrice;
  }
  if (Object.keys(setPayload).length <= 1)
    return (await getBidTravelById(id)) ?? null;
  const [travel] = await db
    .update(bidTravel)
    .set(setPayload as any)
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
// Format: BID-2025-0001 (name-year-4digit, auto-expands to 5, 6+ as needed)
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
    actualMaterialsEquipment: "0",
    actualLabor: "0",
    actualTravel: "0",
    actualOperatingExpenses: "0",
    actualTotalCost: "0",
    actualTotalPrice: "0",
    actualGrossProfit: "0",
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
    documents,
    media,
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
    getBidDocuments(id),
    getBidMedia(id),
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
    documents,
    media,
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

export const getBidDocuments = async (
  bidId: string,
  options?: { tagIds?: string[] },
) => {
  const tagIds = options?.tagIds?.filter(Boolean);
  const hasTagFilter = (tagIds?.length ?? 0) > 0;

  const baseConditions = and(
    eq(bidDocuments.bidId, bidId),
    eq(bidDocuments.isDeleted, false),
  );

  let documentsResult: {
    document: typeof bidDocuments.$inferSelect;
    uploadedByName: string | null;
  }[];

  if (hasTagFilter) {
    const withTagLinks = await db
      .select({
        document: bidDocuments,
        uploadedByName: users.fullName,
      })
      .from(bidDocuments)
      .innerJoin(
        bidDocumentTagLinks,
        eq(bidDocuments.id, bidDocumentTagLinks.documentId),
      )
      .leftJoin(users, eq(bidDocuments.uploadedBy, users.id))
      .where(and(baseConditions, inArray(bidDocumentTagLinks.tagId, tagIds!)))
      .orderBy(desc(bidDocuments.createdAt));
    // Dedupe by document id (same doc can appear once per matching tag)
    const seen = new Set<string>();
    documentsResult = withTagLinks.filter((row) => {
      if (seen.has(row.document.id)) return false;
      seen.add(row.document.id);
      return true;
    });
  } else {
    documentsResult = await db
      .select({
        document: bidDocuments,
        uploadedByName: users.fullName,
      })
      .from(bidDocuments)
      .leftJoin(users, eq(bidDocuments.uploadedBy, users.id))
      .where(baseConditions)
      .orderBy(desc(bidDocuments.createdAt));
  }

  const documentIds = documentsResult.map((r) => r.document.id);
  const documentTagsMap = await getDocumentTagsMapForDocuments(
    bidId,
    documentIds,
  );

  return documentsResult.map((doc) => ({
    ...doc.document,
    uploadedByName: doc.uploadedByName || null,
    tags: documentTagsMap.get(doc.document.id) ?? [],
  }));
};

/** Build map documentId -> tags[] for given document ids in a bid */
async function getDocumentTagsMapForDocuments(
  bidId: string,
  documentIds: string[],
): Promise<Map<string, { id: string; name: string }[]>> {
  const map = new Map<string, { id: string; name: string }[]>();
  if (documentIds.length === 0) return map;

  const linksAndTags = await db
    .select({
      documentId: bidDocumentTagLinks.documentId,
      tagId: bidDocumentTags.id,
      tagName: bidDocumentTags.name,
    })
    .from(bidDocumentTagLinks)
    .innerJoin(
      bidDocumentTags,
      eq(bidDocumentTagLinks.tagId, bidDocumentTags.id),
    )
    .where(
      and(
        eq(bidDocumentTags.bidId, bidId),
        inArray(bidDocumentTagLinks.documentId, documentIds),
      ),
    );

  for (const row of linksAndTags) {
    const list = map.get(row.documentId) ?? [];
    list.push({ id: row.tagId, name: row.tagName });
    map.set(row.documentId, list);
  }
  return map;
}

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

// ============================
// Bid Document Tags Operations
// ============================

export const getBidDocumentTags = async (bidId: string) => {
  const tags = await db
    .select({
      id: bidDocumentTags.id,
      bidId: bidDocumentTags.bidId,
      name: bidDocumentTags.name,
      createdAt: bidDocumentTags.createdAt,
    })
    .from(bidDocumentTags)
    .where(eq(bidDocumentTags.bidId, bidId))
    .orderBy(asc(bidDocumentTags.name));

  const linkCounts = await db
    .select({
      tagId: bidDocumentTagLinks.tagId,
      count: count(),
    })
    .from(bidDocumentTagLinks)
    .where(
      inArray(
        bidDocumentTagLinks.tagId,
        tags.map((t) => t.id),
      ),
    )
    .groupBy(bidDocumentTagLinks.tagId);

  const countByTagId = new Map(
    linkCounts.map((r) => [r.tagId, Number(r.count)]),
  );

  return tags.map((tag) => ({
    ...tag,
    documentCount: countByTagId.get(tag.id) ?? 0,
  }));
};

export const getBidDocumentTagById = async (tagId: string) => {
  const [row] = await db
    .select()
    .from(bidDocumentTags)
    .where(eq(bidDocumentTags.id, tagId));
  return row ?? null;
};

export const createBidDocumentTag = async (bidId: string, name: string) => {
  const [tag] = await db
    .insert(bidDocumentTags)
    .values({ bidId, name: name.trim() })
    .returning();
  return tag;
};

export const updateBidDocumentTag = async (
  tagId: string,
  data: { name: string },
) => {
  const [tag] = await db
    .update(bidDocumentTags)
    .set({ name: data.name.trim() })
    .where(eq(bidDocumentTags.id, tagId))
    .returning();
  return tag ?? null;
};

export const deleteBidDocumentTag = async (tagId: string) => {
  await db
    .delete(bidDocumentTagLinks)
    .where(eq(bidDocumentTagLinks.tagId, tagId));
  const [tag] = await db
    .delete(bidDocumentTags)
    .where(eq(bidDocumentTags.id, tagId))
    .returning();
  return tag ?? null;
};

export const getDocumentTags = async (
  bidId: string,
  documentId: string,
): Promise<{ id: string; name: string }[]> => {
  const rows = await db
    .select({
      id: bidDocumentTags.id,
      name: bidDocumentTags.name,
    })
    .from(bidDocumentTagLinks)
    .innerJoin(
      bidDocumentTags,
      eq(bidDocumentTagLinks.tagId, bidDocumentTags.id),
    )
    .where(
      and(
        eq(bidDocumentTagLinks.documentId, documentId),
        eq(bidDocumentTags.bidId, bidId),
      ),
    );
  return rows;
};

/** Link a tag to a document. If tagName provided and tag doesn't exist, create it then link. */
export const linkDocumentTag = async (params: {
  bidId: string;
  documentId: string;
  tagId?: string;
  tagName?: string;
}) => {
  const { bidId, documentId, tagId: providedTagId, tagName } = params;

  let tagId = providedTagId;
  if (!tagId && tagName) {
    const trimmed = tagName.trim();
    const [existing] = await db
      .select()
      .from(bidDocumentTags)
      .where(
        and(
          eq(bidDocumentTags.bidId, bidId),
          eq(bidDocumentTags.name, trimmed),
        ),
      );
    if (existing) {
      tagId = existing.id;
    } else {
      const [created] = await db
        .insert(bidDocumentTags)
        .values({ bidId, name: trimmed })
        .returning();
      tagId = created?.id;
    }
  }

  if (!tagId) {
    return null;
  }

  const [link] = await db
    .insert(bidDocumentTagLinks)
    .values({ documentId, tagId })
    .onConflictDoNothing({
      target: [bidDocumentTagLinks.documentId, bidDocumentTagLinks.tagId],
    })
    .returning();

  if (link) return link;
  const [existing] = await db
    .select()
    .from(bidDocumentTagLinks)
    .where(
      and(
        eq(bidDocumentTagLinks.documentId, documentId),
        eq(bidDocumentTagLinks.tagId, tagId),
      ),
    );
  return existing ?? null;
};

/** Unlink a tag from a document. If tag has no more links, delete the tag. */
export const unlinkDocumentTag = async (
  documentId: string,
  tagId: string,
): Promise<{ unlinked: boolean; tagDeleted: boolean }> => {
  const [deleted] = await db
    .delete(bidDocumentTagLinks)
    .where(
      and(
        eq(bidDocumentTagLinks.documentId, documentId),
        eq(bidDocumentTagLinks.tagId, tagId),
      ),
    )
    .returning();

  if (!deleted) {
    return { unlinked: false, tagDeleted: false };
  }

  const remaining = await db
    .select({ count: count() })
    .from(bidDocumentTagLinks)
    .where(eq(bidDocumentTagLinks.tagId, tagId));

  const remainingCount = Number(remaining[0]?.count ?? 0);
  if (remainingCount === 0) {
    await db.delete(bidDocumentTags).where(eq(bidDocumentTags.id, tagId));
    return { unlinked: true, tagDeleted: true };
  }
  return { unlinked: true, tagDeleted: false };
};

// ============================
// Bid Media Operations
// ============================

export const getBidMedia = async (bidId: string) => {
  const mediaResult = await db
    .select({
      media: bidMedia,
      uploadedByName: users.fullName,
    })
    .from(bidMedia)
    .leftJoin(users, eq(bidMedia.uploadedBy, users.id))
    .where(and(eq(bidMedia.bidId, bidId), eq(bidMedia.isDeleted, false)))
    .orderBy(desc(bidMedia.createdAt));

  return mediaResult.map((item) => ({
    ...item.media,
    uploadedByName: item.uploadedByName || null,
  }));
};

export const getBidMediaById = async (mediaId: string) => {
  const [result] = await db
    .select({
      media: bidMedia,
      uploadedByName: users.fullName,
    })
    .from(bidMedia)
    .leftJoin(users, eq(bidMedia.uploadedBy, users.id))
    .where(and(eq(bidMedia.id, mediaId), eq(bidMedia.isDeleted, false)));

  if (!result) return null;

  return {
    ...result.media,
    uploadedByName: result.uploadedByName || null,
  };
};

export const createBidMedia = async (data: {
  bidId: string;
  fileName: string;
  filePath: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  mediaType?: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  caption?: string;
  uploadedBy: string;
}) => {
  const [media] = await db
    .insert(bidMedia)
    .values({
      bidId: data.bidId,
      fileName: data.fileName,
      filePath: data.filePath,
      fileUrl: data.fileUrl || undefined,
      fileType: data.fileType || undefined,
      fileSize: data.fileSize || undefined,
      mediaType: data.mediaType || undefined,
      thumbnailPath: data.thumbnailPath || undefined,
      thumbnailUrl: data.thumbnailUrl || undefined,
      caption: data.caption || undefined,
      uploadedBy: data.uploadedBy,
    })
    .returning();
  return media;
};

export const createMultipleBidMedia = async (
  bidId: string,
  mediaFiles: Array<{
    fileName: string;
    filePath: string;
    fileUrl?: string;
    fileType?: string;
    fileSize?: number;
    mediaType?: string;
    thumbnailPath?: string;
    thumbnailUrl?: string;
    caption?: string;
    uploadedBy: string;
  }>,
) => {
  if (mediaFiles.length === 0) {
    return [];
  }

  const insertedMedia = await db
    .insert(bidMedia)
    .values(
      mediaFiles.map((media) => ({
        bidId,
        fileName: media.fileName,
        filePath: media.filePath,
        fileUrl: media.fileUrl || undefined,
        fileType: media.fileType || undefined,
        fileSize: media.fileSize || undefined,
        mediaType: media.mediaType || undefined,
        thumbnailPath: media.thumbnailPath || undefined,
        thumbnailUrl: media.thumbnailUrl || undefined,
        caption: media.caption || undefined,
        uploadedBy: media.uploadedBy,
      })),
    )
    .returning();

  return insertedMedia;
};

export const updateBidMedia = async (
  mediaId: string,
  data: Partial<{
    fileName: string;
    filePath: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    mediaType: string;
    thumbnailPath: string;
    thumbnailUrl: string;
    caption: string;
  }>,
) => {
  const [media] = await db
    .update(bidMedia)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(bidMedia.id, mediaId), eq(bidMedia.isDeleted, false)))
    .returning();
  return media || null;
};

export const deleteBidMedia = async (mediaId: string) => {
  const [media] = await db
    .update(bidMedia)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(bidMedia.id, mediaId), eq(bidMedia.isDeleted, false)))
    .returning();
  return media || null;
};

// ============================
// Bids KPIs
// ============================

export const getBidsKPIs = async () => {
  // Total bid value (sum of all bid amounts)
  const [totalBidValueRow] = await db
    .select({
      totalBidValue: sql<string>`COALESCE(SUM(CAST(${bidsTable.bidAmount} AS NUMERIC)), 0)`,
    })
    .from(bidsTable)
    .where(eq(bidsTable.isDeleted, false));

  // Active bids (status: submitted, in_progress)
  const [activeBidsRow] = await db
    .select({ count: count() })
    .from(bidsTable)
    .where(
      and(
        eq(bidsTable.isDeleted, false),
        or(
          eq(bidsTable.status, "submitted"),
          eq(bidsTable.status, "in_progress"),
        ),
      ),
    );

  // Pending bids (status: draft, pending)
  const [pendingBidsRow] = await db
    .select({ count: count() })
    .from(bidsTable)
    .where(
      and(
        eq(bidsTable.isDeleted, false),
        or(eq(bidsTable.status, "draft"), eq(bidsTable.status, "pending")),
      ),
    );

  // Won bids (status: accepted, won)
  const [wonBidsRow] = await db
    .select({ count: count() })
    .from(bidsTable)
    .where(
      and(
        eq(bidsTable.isDeleted, false),
        or(eq(bidsTable.status, "accepted"), eq(bidsTable.status, "won")),
      ),
    );

  // Average profit margin
  const [avgProfitMarginRow] = await db
    .select({
      avgProfitMargin: sql<string>`COALESCE(AVG(CAST(${bidsTable.profitMargin} AS NUMERIC)), 0)`,
    })
    .from(bidsTable)
    .where(eq(bidsTable.isDeleted, false));

  return {
    totalBidValue: Number(totalBidValueRow?.totalBidValue || 0),
    activeBids: activeBidsRow?.count || 0,
    pendingBids: pendingBidsRow?.count || 0,
    wonBids: wonBidsRow?.count || 0,
    avgProfitMargin: Number(
      Number(avgProfitMarginRow?.avgProfitMargin || 0).toFixed(2),
    ),
  };
};

// Get KPIs for a specific bid
export const getBidKPIs = async (bidId: string) => {
  const [bid] = await db
    .select({
      bidAmount: bidsTable.bidAmount,
      estimatedDuration: bidsTable.estimatedDuration,
      profitMargin: bidsTable.profitMargin,
      endDate: bidsTable.endDate,
      plannedStartDate: bidsTable.plannedStartDate,
      estimatedCompletion: bidsTable.estimatedCompletion,
    })
    .from(bidsTable)
    .where(and(eq(bidsTable.id, bidId), eq(bidsTable.isDeleted, false)));

  if (!bid) {
    return null;
  }

  // Calculate estimated duration from dates if available
  let calculatedDuration = bid.estimatedDuration || 0;
  if (bid.plannedStartDate && bid.estimatedCompletion) {
    const startDate = new Date(bid.plannedStartDate);
    const endDate = new Date(bid.estimatedCompletion);
    const msPerDay = 24 * 60 * 60 * 1000;
    calculatedDuration = Math.floor(
      (endDate.getTime() - startDate.getTime()) / msPerDay,
    );
  }

  return {
    bidAmount: Number(bid.bidAmount || 0),
    estimatedDuration: calculatedDuration,
    profitMargin: Number(bid.profitMargin || 0),
    expiresIn: expiresInDaysFromToday(bid),
  };
};

/** Statuses that should be auto-expired when endDate has passed */
const BID_STATUSES_TO_EXPIRE = [
  "draft",
  "pending",
  "submitted",
  "in_progress",
] as const;

/**
 * Expire bids whose endDate has passed. Used by cron job.
 * Updates status to "expired" and creates history entry when CRON_SYSTEM_USER_ID is set.
 */
export const expireExpiredBids = async (): Promise<{
  expired: number;
  errors: number;
}> => {
  const today = new Date().toISOString().split("T")[0]!;
  const systemUserId = process.env.CRON_SYSTEM_USER_ID;

  const expiredBids = await db
    .select({
      id: bidsTable.id,
      organizationId: bidsTable.organizationId,
      status: bidsTable.status,
    })
    .from(bidsTable)
    .where(
      and(
        eq(bidsTable.isDeleted, false),
        isNotNull(bidsTable.endDate),
        lte(bidsTable.endDate, today),
        inArray(bidsTable.status, [...BID_STATUSES_TO_EXPIRE]),
      ),
    );

  let expired = 0;
  let errors = 0;

  for (const bid of expiredBids) {
    try {
      await updateBid(bid.id, bid.organizationId, { status: "expired" });
      if (systemUserId) {
        await createBidHistoryEntry({
          bidId: bid.id,
          organizationId: bid.organizationId,
          action: "status_changed",
          oldValue: bid.status,
          newValue: "expired",
          description: "Bid automatically expired (end date passed)",
          performedBy: systemUserId,
        });
      }
      expired++;
    } catch {
      errors++;
      // Log but continue with other bids
    }
  }

  return { expired, errors };
};
