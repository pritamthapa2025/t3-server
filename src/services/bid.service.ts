import {
  count,
  eq,
  ne,
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
import { cachedOrgAggregate } from "../utils/org-aggregate-cache.js";
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
  bidServiceData,
  bidPreventativeMaintenanceData,
  bidTimeline,
  bidNotes,
  bidHistory,
  bidDocuments,
  bidDocumentTags,
  bidDocumentTagLinks,
  bidMedia,
  bidPlanSpecFiles,
  bidDesignBuildFiles,
} from "../drizzle/schema/bids.schema.js";
import {
  jobs,
  jobTeamMembers,
  jobTasks,
  jobExpenses,
  jobSurveys,
} from "../drizzle/schema/jobs.schema.js";
import {
  dispatchTasks,
  dispatchAssignments,
} from "../drizzle/schema/dispatch.schema.js";
import { employees, positions } from "../drizzle/schema/org.schema.js";
import { users, userRoles, roles } from "../drizzle/schema/auth.schema.js";
import {
  organizations,
  clientContacts,
  properties,
} from "../drizzle/schema/client.schema.js";
import { alias } from "drizzle-orm/pg-core";
import { getTableColumns } from "drizzle-orm";
import { isStale, STALE_DATA } from "../utils/optimistic-lock.js";
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
  actualTotalPrice?: string | null;
  estimatedDuration?: number | null;
  profitMargin?: string | null;
  endDate?: string | Date | null;
  plannedStartDate?: string | Date | null;
  estimatedCompletion?: string | Date | null;
}): BidSummaryFields {
  const amount = Number(bid.actualTotalPrice) || 0;
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

export type GetBidsFilterOptions = {
  userId: string;
  applyAssignedOrTeamFilter: boolean;
};

export const getBids = async (
  organizationId: string | undefined,
  offset: number,
  limit: number,
  filters?: {
    status?: string[];
    jobType?: string;
    priority?: string;
    assignedTo?: string;
    search?: string;
    sortBy?: "newest" | "oldest" | "value_high" | "value_low";
  },
  options?: GetBidsFilterOptions,
) => {
  // Auto-expire bids whose end date has passed (non-fatal)
  expireExpiredBids().catch(() => {
    /* best-effort */
  });

  // Build where conditions array - organizationId is optional
  const whereConditions = [
    eq(bidsTable.isDeleted, false),
    ne(bidsTable.status, "won"),
  ];

  // If organizationId is provided, filter by it
  if (organizationId) {
    whereConditions.push(eq(bidsTable.organizationId, organizationId));
  }

  if (filters?.status && filters.status.length > 0) {
    whereConditions.push(inArray(bidsTable.status, filters.status as any[]));
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

  // assigned_only: Technicians see only bids where they are explicitly assignedTo (bids.assigned_to)
  // Bids with assignedTo=null are excluded - user must be in the assignedTo field
  if (options?.applyAssignedOrTeamFilter && options?.userId) {
    whereConditions.push(eq(bidsTable.assignedTo, options.userId));
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
      // totalPrice and actualTotalPrice from bid_financial_breakdown
      totalPrice: bidFinancialBreakdown.totalPrice,
      actualTotalPrice: bidFinancialBreakdown.actualTotalPrice,
      // Job-type specific pricing fields — used to derive effectiveBidAmount
      // when actualTotalPrice is 0 (existing bids before financial backfill)
      surveyTotalSurveyFee: bidSurveyData.totalSurveyFee,
      surveyPricingModel: bidSurveyData.pricingModel,
      surveyFlatSurveyFee: bidSurveyData.flatSurveyFee,
      surveyEstimatedHours: bidSurveyData.estimatedHours,
      surveyHourlyRate: bidSurveyData.hourlyRate,
      surveyEstimatedExpenses: bidSurveyData.estimatedExpenses,
      servicePricingModel: bidServiceData.pricingModel,
      serviceLaborHours: bidServiceData.laborHours,
      serviceLaborRate: bidServiceData.laborRate,
      serviceMaterialsCost: bidServiceData.materialsCost,
      serviceTravelCost: bidServiceData.travelCost,
      serviceMarkup: bidServiceData.serviceMarkup,
      serviceFlatRatePrice: bidServiceData.flatRatePrice,
      serviceDiagnosticFee: bidServiceData.diagnosticFee,
      serviceEstimatedRepairCost: bidServiceData.estimatedRepairCost,
      pmPricingModel: bidPreventativeMaintenanceData.pricingModel,
      pmPricePerUnit: bidPreventativeMaintenanceData.pricePerUnit,
      pmNumberOfUnits: bidPreventativeMaintenanceData.numberOfUnits,
      pmFlatRatePerVisit: bidPreventativeMaintenanceData.flatRatePerVisit,
      pmAnnualContractValue: bidPreventativeMaintenanceData.annualContractValue,
      dbDesignPrice: bidDesignBuildData.designPrice,
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
    .leftJoin(bidSurveyData, eq(bidsTable.id, bidSurveyData.bidId))
    .leftJoin(bidServiceData, eq(bidsTable.id, bidServiceData.bidId))
    .leftJoin(
      bidPreventativeMaintenanceData,
      eq(bidsTable.id, bidPreventativeMaintenanceData.bidId),
    )
    .leftJoin(bidDesignBuildData, eq(bidsTable.id, bidDesignBuildData.bidId))
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
    .orderBy(
      filters?.sortBy === "oldest"
        ? asc(bidsTable.createdAt)
        : filters?.sortBy === "value_high"
          ? sql`${bidFinancialBreakdown.actualTotalPrice} DESC NULLS LAST`
          : filters?.sortBy === "value_low"
            ? sql`${bidFinancialBreakdown.actualTotalPrice} ASC NULLS LAST`
            : desc(bidsTable.createdAt),
    );

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

    // Derive effective bid amount: prefer stored actualTotalPrice; when that
    // is zero/null (old bids before financial backfill), compute on-the-fly
    // from the job-type-specific pricing data joined above.
    const n = (v: unknown): number => parseFloat(String(v ?? "0")) || 0;
    const storedTotal = n(item.actualTotalPrice);
    let effectiveBidAmount: string | null = item.actualTotalPrice ?? null;
    if (storedTotal === 0) {
      const jobType = item.bid.jobType;
      let derived = 0;
      if (jobType === "survey") {
        derived = n(item.surveyTotalSurveyFee);
        if (derived === 0) {
          if (item.surveyPricingModel === "flat_fee")
            derived = n(item.surveyFlatSurveyFee);
          else if (item.surveyPricingModel === "time_materials")
            derived =
              n(item.surveyEstimatedHours) * n(item.surveyHourlyRate) +
              n(item.surveyEstimatedExpenses);
        }
      } else if (jobType === "service") {
        if (item.servicePricingModel === "flat_rate")
          derived = n(item.serviceFlatRatePrice);
        else if (item.servicePricingModel === "diagnostic_repair")
          derived =
            n(item.serviceDiagnosticFee) + n(item.serviceEstimatedRepairCost);
        else {
          const base =
            n(item.serviceLaborHours) * n(item.serviceLaborRate) +
            n(item.serviceMaterialsCost) +
            n(item.serviceTravelCost);
          derived = base * (1 + n(item.serviceMarkup) / 100);
        }
      } else if (jobType === "preventative_maintenance") {
        if (item.pmPricingModel === "flat_rate")
          derived = n(item.pmFlatRatePerVisit);
        else if (item.pmPricingModel === "annual_contract")
          derived = n(item.pmAnnualContractValue);
        else
          derived =
            n(item.pmPricePerUnit) * Math.max(n(item.pmNumberOfUnits), 1);
      } else if (jobType === "design_build") {
        derived = n(item.dbDesignPrice);
      }
      if (derived > 0) effectiveBidAmount = derived.toFixed(2);
    }

    return {
      ...item.bid,
      bidAmount: effectiveBidAmount,
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

/**
 * Get all version bids in the same family tree as the given bid.
 * Traverses rootBidId to find the family root, then returns every bid
 * whose id = root OR whose rootBidId = root, sorted by versionNumber asc.
 */
export const getRelatedBids = async (bidId: string) => {
  // Resolve the given bid's own rootBidId and versionNumber
  const [current] = await db
    .select({
      id: bidsTable.id,
      rootBidId: bidsTable.rootBidId,
      versionNumber: bidsTable.versionNumber,
    })
    .from(bidsTable)
    .where(eq(bidsTable.id, bidId))
    .limit(1);

  if (!current) return null;

  // The root of this family tree is either the stored rootBidId
  // (for child bids) or the bid itself (for the root/V1 bid).
  const familyRootId = current.rootBidId ?? current.id;

  // Fetch every member of the family: the root + all children
  const versions = await db
    .select({
      id: bidsTable.id,
      bidNumber: bidsTable.bidNumber,
      status: bidsTable.status,
      priority: bidsTable.priority,
      projectName: bidsTable.projectName,
      jobType: bidsTable.jobType,
      createdAt: bidsTable.createdAt,
      versionNumber: bidsTable.versionNumber,
      rootBidId: bidsTable.rootBidId,
      parentBidId: bidsTable.parentBidId,
      organizationId: bidsTable.organizationId,
      assignedTo: bidsTable.assignedTo,
      createdByUser: createdByUser.fullName,
    })
    .from(bidsTable)
    .leftJoin(createdByUser, eq(bidsTable.createdBy, createdByUser.id))
    .where(
      and(
        eq(bidsTable.isDeleted, false),
        or(
          eq(bidsTable.id, familyRootId),
          eq(bidsTable.rootBidId, familyRootId),
        ),
      ),
    )
    .orderBy(asc(bidsTable.versionNumber));

  return {
    data: versions,
    familyRootId,
    total: versions.length,
  };
};

export const getBidById = async (id: string) => {
  const [result] = await db
    .select({
      bid: bidsTable,
      createdByName: createdByUser.fullName,
      assignedToName: assignedToUser.fullName,
      actualTotalPrice: bidFinancialBreakdown.actualTotalPrice,
    })
    .from(bidsTable)
    .leftJoin(createdByUser, eq(bidsTable.createdBy, createdByUser.id))
    .leftJoin(assignedToUser, eq(bidsTable.assignedTo, assignedToUser.id))
    .leftJoin(
      bidFinancialBreakdown,
      and(
        eq(bidsTable.id, bidFinancialBreakdown.bidId),
        eq(bidFinancialBreakdown.isDeleted, false),
      ),
    )
    .where(and(eq(bidsTable.id, id), eq(bidsTable.isDeleted, false)));
  if (!result) return null;
  const [primaryContact, property] = await Promise.all([
    getPrimaryContactMinimal(result.bid.primaryContactId),
    getPropertyMinimal(result.bid.propertyId),
  ]);
  const bidSummary = getBidSummaryFields({
    ...result.bid,
    actualTotalPrice: result.actualTotalPrice,
  });
  return {
    ...result.bid,
    bidAmount: result.actualTotalPrice ?? null,
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
      actualTotalPrice: bidFinancialBreakdown.actualTotalPrice,
    })
    .from(bidsTable)
    .leftJoin(createdByUser, eq(bidsTable.createdBy, createdByUser.id))
    .leftJoin(assignedToUser, eq(bidsTable.assignedTo, assignedToUser.id))
    .leftJoin(
      bidFinancialBreakdown,
      and(
        eq(bidsTable.id, bidFinancialBreakdown.bidId),
        eq(bidFinancialBreakdown.isDeleted, false),
      ),
    )
    .where(and(eq(bidsTable.id, id), eq(bidsTable.isDeleted, false)));
  if (!result) return null;
  const [primaryContact, property] = await Promise.all([
    getPrimaryContactMinimal(result.bid.primaryContactId),
    getPropertyMinimal(result.bid.propertyId),
  ]);
  const bidSummary = getBidSummaryFields({
    ...result.bid,
    actualTotalPrice: result.actualTotalPrice,
  });
  return {
    ...result.bid,
    bidAmount: result.actualTotalPrice ?? null,
    createdByName: result.createdByName ?? null,
    assignedToName: result.assignedToName ?? null,
    expiresIn: expiresInDaysFromToday(result.bid),
    bidSummary,
    ...(primaryContact && { primaryContact }),
    ...(property && { property }),
  };
};

/**
 * Walk up the parentBidId chain to find the root bid, then calculate the
 * next sequential versionNumber for a new child bid.
 *
 * Strategy:
 *  1. Walk up via parentBidId until we reach a bid with no parent — that is
 *     the "root" (the original V1 bid of the family).
 *  2. Query MAX(version_number) across every bid that shares the same root
 *     (i.e. root_bid_id = rootId OR id = rootId).
 *  3. next version = MAX + 1.
 *
 * Because root_bid_id is indexed, step 2 is a single fast indexed query even
 * for very large families.
 */
export const resolveVersionTree = async (
  parentBidId: string,
): Promise<{ rootBidId: string; nextVersionNumber: number }> => {
  // Walk up to find the root (the bid that has no parentBidId)
  let currentId = parentBidId;
  let rootId = parentBidId;

  for (let depth = 0; depth < 50; depth++) {
    const [row] = await db
      .select({ id: bidsTable.id, parentBidId: bidsTable.parentBidId })
      .from(bidsTable)
      .where(eq(bidsTable.id, currentId))
      .limit(1);

    if (!row) break;
    if (!row.parentBidId) {
      rootId = row.id;
      break;
    }
    rootId = row.id;
    currentId = row.parentBidId;
  }

  // MAX versionNumber across the entire family tree
  const [maxRow] = await db
    .select({ maxVersion: max(bidsTable.versionNumber) })
    .from(bidsTable)
    .where(or(eq(bidsTable.rootBidId, rootId), eq(bidsTable.id, rootId)));

  const maxVersion = maxRow?.maxVersion ?? 1;
  return { rootBidId: rootId, nextVersionNumber: Number(maxVersion) + 1 };
};

/**
 * Return version-info for a given bid: its project name, organization name,
 * its own version, and the next available version in its family tree.
 * Used by the frontend "Parent Bid" dropdown to auto-populate the version badge.
 */
export const getBidVersionInfo = async (bidId: string) => {
  const [bid] = await db
    .select({
      id: bidsTable.id,
      projectName: bidsTable.projectName,
      organizationId: bidsTable.organizationId,
      parentBidId: bidsTable.parentBidId,
      versionNumber: bidsTable.versionNumber,
    })
    .from(bidsTable)
    .where(and(eq(bidsTable.id, bidId), eq(bidsTable.isDeleted, false)))
    .limit(1);

  if (!bid) return null;

  // Get organization name
  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, bid.organizationId))
    .limit(1);

  // Resolve next version for a new child of this bid
  const { nextVersionNumber } = await resolveVersionTree(bidId);

  return {
    bidId: bid.id,
    projectName: bid.projectName,
    organizationName: org?.name ?? null,
    currentVersion: `V${bid.versionNumber}`,
    currentVersionNumber: bid.versionNumber,
    nextVersionNumber,
    nextVersion: `V${nextVersionNumber}`,
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
  parentBidId?: string | null;
  // New fields
  industryClassification?: string;
  scheduledDateTime?: string;
  termsTemplateSelection?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  accessInstructions?: string;
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

  const toLocalDateString = (date: Date): string => {
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Convert date string to YYYY-MM-DD (server-local) or undefined
  const toDateOrUndefined = (dateStr?: string): string | undefined => {
    if (!dateStr || dateStr.trim() === "") return undefined;
    const trimmed = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return undefined;
    return toLocalDateString(d);
  };

  const endDateVal = toDateOrUndefined(data.endDate);

  // Resolve versioning when a parent is provided
  let resolvedVersionNumber = 1;
  let resolvedRootBidId: string | undefined;

  if (data.parentBidId) {
    const tree = await resolveVersionTree(data.parentBidId);
    resolvedRootBidId = tree.rootBidId;
    resolvedVersionNumber = tree.nextVersionNumber;
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
      parentBidId: data.parentBidId ?? undefined,
      rootBidId: resolvedRootBidId,
      versionNumber: resolvedVersionNumber,
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
      industryClassification: data.industryClassification || undefined,
      scheduledDateTime: data.scheduledDateTime
        ? new Date(data.scheduledDateTime)
        : undefined,
      termsTemplateSelection: data.termsTemplateSelection || undefined,
      siteContactName: data.siteContactName || undefined,
      siteContactPhone: data.siteContactPhone || undefined,
      accessInstructions: data.accessInstructions || undefined,
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

  // Fire bid_created notification (fire-and-forget)
  // Recipients: creator + all executives + all managers (manager role covers any supervisor assigned to this bid)
  void (async () => {
    try {
      const { NotificationService } = await import("./notification.service.js");
      const svc = new NotificationService();
      const bidName = bid.projectName || bid.bidNumber || "New Bid";
      const baseNotifData = {
        entityType: "Bid",
        entityId: bid.id,
        entityName: bidName,
        creatorId: data.createdBy,
      };

      await svc.triggerNotification({
        type: "bid_created",
        category: "job",
        priority: "medium",
        triggeredBy: data.createdBy,
        data: baseNotifData,
      });

      // If bid was created by a manager (not an executive), notify executives for approval
      if (data.createdBy) {
        const creatorRoles = await db
          .select({ roleName: roles.name })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(eq(userRoles.userId, data.createdBy));

        const roleNames = creatorRoles.map((r) => r.roleName);
        const isExecutive = roleNames.includes("executive");

        if (!isExecutive) {
          await svc.triggerNotification({
            type: "bid_requires_approval",
            category: "job",
            priority: "high",
            triggeredBy: data.createdBy,
            data: baseNotifData,
          });
        }
      }
    } catch (err) {
      console.error("[Notification] bid_created failed:", err);
    }
  })();

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
    parentBidId: string | null;
    rootBidId: string | null;
    versionNumber: number;
    // New fields
    industryClassification: string;
    scheduledDateTime: string;
    termsTemplateSelection: string;
    siteContactName: string;
    siteContactPhone: string;
    accessInstructions: string;
    finalBidAmount: string;
    actualCost: string;
    submittedDate: string;
    decisionDate: string;
    convertedToJobId: string | null;
    conversionDate: string;
    lostReason: string;
    rejectionReason: string;
  }>,
  clientUpdatedAt?: string,
) => {
  const [beforeRow] = await db
    .select({ status: bidsTable.status, updatedAt: bidsTable.updatedAt })
    .from(bidsTable)
    .where(
      and(
        eq(bidsTable.id, id),
        eq(bidsTable.organizationId, organizationId),
        eq(bidsTable.isDeleted, false),
      ),
    )
    .limit(1);

  if (!beforeRow) return null;

  if (clientUpdatedAt && isStale(beforeRow.updatedAt, clientUpdatedAt)) {
    return STALE_DATA;
  }

  const toLocalDateString = (date: Date): string => {
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const toDateOrUndefined = (dateStr?: string): string | undefined => {
    if (!dateStr || dateStr.trim() === "") return undefined;
    const trimmed = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return undefined;
    return toLocalDateString(d);
  };

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
      endDate: toDateOrUndefined(data.endDate),
      plannedStartDate: toDateOrUndefined(data.plannedStartDate),
      estimatedCompletion: toDateOrUndefined(data.estimatedCompletion),
      removalDate: toDateOrUndefined(data.removalDate),
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
      // New fields
      industryClassification: data.industryClassification,
      scheduledDateTime: data.scheduledDateTime
        ? new Date(data.scheduledDateTime)
        : undefined,
      termsTemplateSelection: data.termsTemplateSelection,
      siteContactName: data.siteContactName,
      siteContactPhone: data.siteContactPhone,
      accessInstructions: data.accessInstructions,
      finalBidAmount: data.finalBidAmount,
      actualCost: data.actualCost,
      submittedDate: data.submittedDate ?? undefined,
      decisionDate: data.decisionDate ?? undefined,
      convertedToJobId: data.convertedToJobId ?? undefined,
      conversionDate: data.conversionDate ?? undefined,
      lostReason: data.lostReason,
      rejectionReason: data.rejectionReason,
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

  // Only notify on real transitions — clients often PATCH the same status again (e.g. won after job create),
  // which must not re-fire bid_won / other status alerts.
  const previousStatus = beforeRow.status ?? null;
  const newStatus =
    typeof data.status === "string" && data.status.length > 0
      ? data.status
      : null;
  const statusTransitioned =
    newStatus !== null && newStatus !== previousStatus;

  // Fire status-based notifications (fire-and-forget)
  if (statusTransitioned && newStatus) {
    void (async () => {
      try {
        const { NotificationService } =
          await import("./notification.service.js");
        const svc = new NotificationService();
        const entityName = bid.projectName || bid.bidNumber || "Bid";

        // Recipients for bid status events: all executives + all managers
        // Manager role covers any supervisor assigned to this bid
        const baseData = {
          entityType: "Bid",
          entityId: id,
          entityName,
        };

        if (newStatus === "sent") {
          // Notify client's primary contact that a bid has been sent to them
          await svc.triggerNotification({
            type: "bid_sent_to_client",
            category: "job",
            priority: "medium",
            data: {
              ...baseData,
              clientId: organizationId, // routes to primary contact in clientContacts
            },
          });
        } else if (newStatus === "won") {
          await svc.triggerNotification({
            type: "bid_won",
            category: "job",
            priority: "high",
            data: baseData,
          });
        } else if (newStatus === "expired") {
          await svc.triggerNotification({
            type: "bid_expired",
            category: "job",
            priority: "medium",
            data: baseData,
          });
        } else if (newStatus === "pending") {
          await svc.triggerNotification({
            type: "bid_requires_approval",
            category: "job",
            priority: "high",
            data: baseData,
          });
        }
      } catch (err) {
        console.error("[Notification] bid status notification failed:", err);
      }
    })();
  }

  return getBidById(id);
};

export const deleteBid = async (
  id: string,
  organizationId: string,
  deletedBy: string,
) => {
  const now = new Date();

  // 1. Collect job IDs for this bid
  const jobRows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.bidId, id), eq(jobs.isDeleted, false)));
  const jobIds = jobRows.map((r) => r.id);

  if (jobIds.length > 0) {
    // 2. Collect dispatch task IDs for these jobs
    const taskRows = await db
      .select({ id: dispatchTasks.id })
      .from(dispatchTasks)
      .where(
        and(
          inArray(dispatchTasks.jobId, jobIds),
          eq(dispatchTasks.isDeleted, false),
        ),
      );
    const taskIds = taskRows.map((r) => r.id);

    // 3. Soft-delete dispatch assignments
    if (taskIds.length > 0) {
      await db
        .update(dispatchAssignments)
        .set({ isDeleted: true, updatedAt: now })
        .where(
          and(
            inArray(dispatchAssignments.taskId, taskIds),
            eq(dispatchAssignments.isDeleted, false),
          ),
        );
    }

    // 4. Soft-delete dispatch tasks
    await db
      .update(dispatchTasks)
      .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
      .where(
        and(
          inArray(dispatchTasks.jobId, jobIds),
          eq(dispatchTasks.isDeleted, false),
        ),
      );

    // 5. Deactivate job team members
    await db
      .update(jobTeamMembers)
      .set({ isActive: false })
      .where(inArray(jobTeamMembers.jobId, jobIds));

    // 6. Soft-delete job tasks, surveys, expenses (in parallel)
    await Promise.all([
      db
        .update(jobTasks)
        .set({ isDeleted: true, updatedAt: now })
        .where(
          and(inArray(jobTasks.jobId, jobIds), eq(jobTasks.isDeleted, false)),
        ),
      db
        .update(jobSurveys)
        .set({ isDeleted: true, updatedAt: now })
        .where(
          and(
            inArray(jobSurveys.jobId, jobIds),
            eq(jobSurveys.isDeleted, false),
          ),
        ),
      db
        .update(jobExpenses)
        .set({ isDeleted: true, updatedAt: now })
        .where(
          and(
            inArray(jobExpenses.jobId, jobIds),
            eq(jobExpenses.isDeleted, false),
          ),
        ),
    ]);

    // 7. Soft-delete jobs
    await db
      .update(jobs)
      .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
      .where(and(inArray(jobs.id, jobIds), eq(jobs.isDeleted, false)));
  }

  // 8. Soft-delete bid travel (tied to bidLabor, not directly to bid)
  const laborRows = await db
    .select({ id: bidLabor.id })
    .from(bidLabor)
    .where(eq(bidLabor.bidId, id));
  if (laborRows.length > 0) {
    const laborIds = laborRows.map((r) => r.id);
    await db
      .update(bidTravel)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          inArray(bidTravel.bidLaborId, laborIds),
          eq(bidTravel.isDeleted, false),
        ),
      );
  }

  // 9. Soft-delete all bid sub-tables (in parallel)
  await Promise.all([
    db
      .update(bidFinancialBreakdown)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          eq(bidFinancialBreakdown.bidId, id),
          eq(bidFinancialBreakdown.isDeleted, false),
        ),
      ),
    db
      .update(bidMaterials)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(eq(bidMaterials.bidId, id), eq(bidMaterials.isDeleted, false)),
      ),
    db
      .update(bidLabor)
      .set({ isDeleted: true, updatedAt: now })
      .where(and(eq(bidLabor.bidId, id), eq(bidLabor.isDeleted, false))),
    db
      .update(bidOperatingExpenses)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          eq(bidOperatingExpenses.bidId, id),
          eq(bidOperatingExpenses.isDeleted, false),
        ),
      ),
    db
      .update(bidPlanSpecData)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          eq(bidPlanSpecData.bidId, id),
          eq(bidPlanSpecData.isDeleted, false),
        ),
      ),
    db
      .update(bidSurveyData)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(eq(bidSurveyData.bidId, id), eq(bidSurveyData.isDeleted, false)),
      ),
    db
      .update(bidDesignBuildData)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          eq(bidDesignBuildData.bidId, id),
          eq(bidDesignBuildData.isDeleted, false),
        ),
      ),
    db
      .update(bidServiceData)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(eq(bidServiceData.bidId, id), eq(bidServiceData.isDeleted, false)),
      ),
    db
      .update(bidPreventativeMaintenanceData)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          eq(bidPreventativeMaintenanceData.bidId, id),
          eq(bidPreventativeMaintenanceData.isDeleted, false),
        ),
      ),
    db
      .update(bidTimeline)
      .set({ isDeleted: true, updatedAt: now })
      .where(and(eq(bidTimeline.bidId, id), eq(bidTimeline.isDeleted, false))),
    db
      .update(bidNotes)
      .set({ isDeleted: true, updatedAt: now })
      .where(and(eq(bidNotes.bidId, id), eq(bidNotes.isDeleted, false))),
    db
      .update(bidDocuments)
      .set({ isDeleted: true, deletedAt: now, updatedAt: now })
      .where(
        and(eq(bidDocuments.bidId, id), eq(bidDocuments.isDeleted, false)),
      ),
    db
      .update(bidMedia)
      .set({ isDeleted: true, deletedAt: now, updatedAt: now })
      .where(and(eq(bidMedia.bidId, id), eq(bidMedia.isDeleted, false))),
    db
      .update(bidPlanSpecFiles)
      .set({ isDeleted: true, deletedAt: now })
      .where(
        and(
          eq(bidPlanSpecFiles.bidId, id),
          eq(bidPlanSpecFiles.isDeleted, false),
        ),
      ),
    db
      .update(bidDesignBuildFiles)
      .set({ isDeleted: true, deletedAt: now })
      .where(
        and(
          eq(bidDesignBuildFiles.bidId, id),
          eq(bidDesignBuildFiles.isDeleted, false),
        ),
      ),
  ]);

  // 10. Soft-delete the bid itself
  const [bid] = await db
    .update(bidsTable)
    .set({
      isDeleted: true,
      deletedAt: now,
      deletedBy,
      updatedAt: now,
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
  isCreate = false,
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
  // Always derive grossProfit from totalPrice - totalCost.
  // Client-sent grossProfit is intentionally ignored because it is frequently
  // wrong (e.g. PM bids where the client sets it to "0" even though the
  // contract value creates real profit over direct costs).
  const grossProfit = (
    parseFloat(totalPrice) - parseFloat(totalCost)
  ).toFixed(2);

  const setPayload: Record<string, unknown> = { updatedAt: new Date() };

  if (existing) {
    if (isCreate && hasInitial && !hasActual) {
      // On bid creation the row is pre-inserted with zeros; write both initial and actual from the payload.
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
    } else if (hasInitial && !hasActual) {
      // Subsequent update: only update actual fields, never touch initial.
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
  isCreate = false,
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
    if (isCreate && hasInitial && !hasActual) {
      // On bid creation the row is pre-inserted with defaults; write all initial fields and mirror to actual.
      Object.assign(setPayload, data);
      setPayload.actualCurrentBidAmount = data.currentBidAmount ?? "0";
      setPayload.actualCalculatedOperatingCost =
        data.calculatedOperatingCost ?? "0";
      setPayload.actualInflationAdjustedOperatingCost =
        data.inflationAdjustedOperatingCost ?? "0";
      setPayload.actualOperatingPrice = data.operatingPrice ?? "0";
    } else if (hasActual) {
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
      // Subsequent update: only update actual fields, never touch initial.
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
 * bid_operating_expenses and bid_financial_breakdown.
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
    // Clear operating add-on: totalPrice = totalCost
    const totalPrice = directCost.toFixed(2);
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

  return calc;
};

// ============================
// Materials Operations
// ============================

export const getBidMaterials = async (
  bidId: string,
  _organizationId?: string,
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
  // Get material data before deletion (for history logging) - fetch without isDeleted check
  const [material] = await db
    .select()
    .from(bidMaterials)
    .where(eq(bidMaterials.id, id))
    .limit(1);
  
  if (!material) {
    return null;
  }
  
  // Hard delete - actually remove from database
  await db
    .delete(bidMaterials)
    .where(eq(bidMaterials.id, id));
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
      quantity: bidLabor.quantity,
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
      quantity: bidLabor.quantity,
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
  positionId?: number | null;
  customRole?: string;
  quantity?: number;
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
        quantity: data.quantity ?? 1, // Default to 1 if not provided
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
    positionId: number | null;
    customRole: string;
    quantity: number;
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
    data.quantity !== undefined ||
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
    if (data.quantity !== undefined) setPayload.quantity = data.quantity;
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
  // Also handle direct quantity update
  if (data.quantity !== undefined) {
    setPayload.quantity = data.quantity;
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
  // Get labor data before deletion (for history logging) - fetch without isDeleted check
  const [labor] = await db
    .select({
      id: bidLabor.id,
      bidId: bidLabor.bidId,
      positionId: bidLabor.positionId,
      positionName: positions.name,
      quantity: bidLabor.quantity,
      days: bidLabor.days,
      hoursPerDay: bidLabor.hoursPerDay,
      totalHours: bidLabor.totalHours,
      costRate: bidLabor.costRate,
      billableRate: bidLabor.billableRate,
      totalCost: bidLabor.totalCost,
      totalPrice: bidLabor.totalPrice,
    })
    .from(bidLabor)
    .leftJoin(positions, eq(bidLabor.positionId, positions.id))
    .where(eq(bidLabor.id, id))
    .limit(1);
  
  if (!labor) {
    return null;
  }
  
  // First, hard delete all associated travel entries
  await db
    .delete(bidTravel)
    .where(eq(bidTravel.bidLaborId, id));
  
  // Then hard delete the labor entry
  await db
    .delete(bidLabor)
    .where(eq(bidLabor.id, id));
  
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
  originAddressId?: string | null;
  originAddress?: string | null;
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
    originAddressId?: string | null;
    originAddress?: string | null;
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
        originAddressId: travelData.originAddressId ?? null,
        originAddress: travelData.originAddress ?? null,
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
    originAddressId: string | null;
    originAddress: string | null;
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

  // Always persist origin fields when provided
  if ("originAddressId" in data) setPayload.originAddressId = data.originAddressId ?? null;
  if ("originAddress" in data) setPayload.originAddress = data.originAddress ?? null;

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
    // Editing a bid: update both initial columns and actual* columns together
    if (data.roundTripMiles !== undefined) {
      setPayload.roundTripMiles = data.roundTripMiles;
      setPayload.actualRoundTripMiles = data.roundTripMiles;
    }
    if (data.mileageRate !== undefined) {
      setPayload.mileageRate = data.mileageRate;
      setPayload.actualMileageRate = data.mileageRate;
    }
    if (data.vehicleDayRate !== undefined) {
      setPayload.vehicleDayRate = data.vehicleDayRate;
      setPayload.actualVehicleDayRate = data.vehicleDayRate;
    }
    if (data.days !== undefined) {
      setPayload.days = data.days;
      setPayload.actualDays = data.days;
    }
    if (data.mileageCost !== undefined) {
      setPayload.mileageCost = data.mileageCost;
      setPayload.actualMileageCost = data.mileageCost;
    }
    if (data.vehicleCost !== undefined) {
      setPayload.vehicleCost = data.vehicleCost;
      setPayload.actualVehicleCost = data.vehicleCost;
    }
    if (data.markup !== undefined) {
      setPayload.markup = data.markup;
      setPayload.actualMarkup = data.markup;
    }
    if (data.totalCost !== undefined) {
      setPayload.totalCost = data.totalCost;
      setPayload.actualTotalCost = data.totalCost;
    }
    if (data.totalPrice !== undefined) {
      setPayload.totalPrice = data.totalPrice;
      setPayload.actualTotalPrice = data.totalPrice;
    }
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
  // Get travel data before deletion (for history logging) - fetch without isDeleted check
  const [travel] = await db
    .select()
    .from(bidTravel)
    .where(eq(bidTravel.id, id))
    .limit(1);
  
  if (!travel) {
    return null;
  }
  
  // Hard delete - actually remove from database
  await db
    .delete(bidTravel)
    .where(eq(bidTravel.id, id));
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
    // New survey bid fields
    surveyType: string;
    numberOfBuildings: number;
    expectedUnitsToSurvey: number;
    buildingNumbers: string;
    unitTypes: string;
    includePhotoDocumentation: boolean;
    includePerformanceTesting: boolean;
    includeEnergyAnalysis: boolean;
    includeRecommendations: boolean;
    schedulingConstraints: string;
    technicianId: number | null;
    pricingModel: string;
    flatSurveyFee: string;
    pricePerUnit: string;
    estimatedHours: string;
    hourlyRate: string;
    estimatedExpenses: string;
    totalSurveyFee: string;
    surveyDate: string;
    surveyBy: string;
    surveyNotes: string;
    accessRequirements: string;
    utilityLocations: string;
    existingEquipment: string;
    measurements: string;
    photos: string;
    // Shared notes fields
    siteAccessNotes: string;
    additionalNotes: string;
    clientRequirements: string;
    termsAndConditions: string;
    // Legacy fields
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
    siteConditions: string;
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
      return String(dateStr).split("T")[0];
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
    approvalMilestones: string;
    designRevisionLimit: number;
    // Design Costs
    designFeeBasis: string;
    designPrice: string;
    designCost: string;
    // Legacy/Construction
    buildSpecifications: string;
  }>,
) => {
  const existing = await getBidDesignBuildData(bidId, organizationId);

  // Helper to convert date string to date format
  const toDateOrUndefined = (dateStr?: string): string | undefined => {
    if (!dateStr || dateStr.trim() === "") return undefined;
    try {
      return String(dateStr).split("T")[0];
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
// Service Bid Data Operations
// ============================

export const getBidServiceData = async (
  bidId: string,
  _organizationId: string,
) => {
  const [serviceData] = await db
    .select()
    .from(bidServiceData)
    .where(
      and(eq(bidServiceData.bidId, bidId), eq(bidServiceData.isDeleted, false)),
    );
  return serviceData || null;
};

export const updateBidServiceData = async (
  bidId: string,
  organizationId: string,
  data: Partial<{
    // Bid-creation fields
    serviceType: string;
    equipmentType: string;
    issueCategory: string;
    reportedIssue: string;
    preliminaryAssessment: string;
    estimatedWorkScope: string;
    leadTechnicianId: number | null;
    helperTechnicianId: number | null;
    pricingModel: string;
    numberOfTechs: number;
    laborHours: string;
    laborRate: string;
    materialsCost: string;
    travelCost: string;
    serviceMarkup: string;
    flatRatePrice: string;
    diagnosticFee: string;
    estimatedRepairCost: string;
    pricingNotes: string;
    // Execution-phase fields
    serviceCallTechnician: number | null;
    timeIn: string | null;
    timeOut: string | null;
    serviceDescription: string | null;
    plumbingSystemCheck: boolean;
    thermostatCheck: boolean;
    hvacSystemCheck: boolean;
    clientCommunicationCheck: boolean;
    customerSignaturePath: string | null;
    customerSignatureDate: Date | null;
    serviceNotes: string | null;
  }>,
) => {
  const existing = await getBidServiceData(bidId, organizationId);

  if (existing) {
    const [serviceData] = await db
      .update(bidServiceData)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(bidServiceData.id, existing.id))
      .returning();
    return serviceData;
  } else {
    const [serviceData] = await db
      .insert(bidServiceData)
      .values({
        bidId,
        ...data,
      })
      .returning();
    return serviceData;
  }
};

// ============================
// Preventative Maintenance Bid Data Operations
// ============================

export const getBidPreventativeMaintenanceData = async (
  bidId: string,
  _organizationId: string,
) => {
  const [pmData] = await db
    .select()
    .from(bidPreventativeMaintenanceData)
    .where(
      and(
        eq(bidPreventativeMaintenanceData.bidId, bidId),
        eq(bidPreventativeMaintenanceData.isDeleted, false),
      ),
    );
  return pmData || null;
};

export const updateBidPreventativeMaintenanceData = async (
  bidId: string,
  organizationId: string,
  data: Partial<{
    pmType: string | null;
    previousPmJobId: string | null;
    maintenanceFrequency: string | null;
    numberOfBuildings: number | null;
    numberOfUnits: number | null;
    buildingNumbers: string | null;
    expectedUnitTags: string | null;
    filterReplacementIncluded: boolean;
    coilCleaningIncluded: boolean;
    temperatureReadingsIncluded: boolean;
    visualInspectionIncluded: boolean;
    serviceScope: string | null;
    specialRequirements: string | null;
    clientPmRequirements: string | null;
    // Pricing fields
    pricingModel: string | null;
    pricePerUnit: string | null;
    flatRatePerVisit: string | null;
    annualContractValue: string | null;
    includeFilterReplacement: boolean;
    filterReplacementCost: string | null;
    includeCoilCleaning: boolean;
    coilCleaningCost: string | null;
    emergencyServiceRate: string | null;
    paymentSchedule: string | null;
    pricingNotes: string | null;
  }>,
) => {
  const existing = await getBidPreventativeMaintenanceData(
    bidId,
    organizationId,
  );

  if (existing) {
    const [pmData] = await db
      .update(bidPreventativeMaintenanceData)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(bidPreventativeMaintenanceData.id, existing.id))
      .returning();
    return pmData;
  } else {
    const [pmData] = await db
      .insert(bidPreventativeMaintenanceData)
      .values({
        bidId,
        ...data,
      })
      .returning();
    return pmData;
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

export type BidTimelinePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const getBidTimelinePaginated = async (
  bidId: string,
  page: number,
  limit: number,
) => {
  const where = and(
    eq(bidTimeline.bidId, bidId),
    eq(bidTimeline.isDeleted, false),
  );
  const countResult = await db
    .select({ total: count() })
    .from(bidTimeline)
    .where(where);
  const total = Number(countResult[0]?.total ?? 0);
  const offset = (page - 1) * limit;
  const data = await db
    .select()
    .from(bidTimeline)
    .where(where)
    .orderBy(asc(bidTimeline.sortOrder), asc(bidTimeline.eventDate))
    .limit(limit)
    .offset(offset);
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    } satisfies BidTimelinePagination,
  };
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

export const getBidNotes = async (bidId: string, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  const countResult = await db
    .select({ total: count() })
    .from(bidNotes)
    .where(and(eq(bidNotes.bidId, bidId), eq(bidNotes.isDeleted, false)));
  const total = countResult[0]?.total ?? 0;

  const notes = await db
    .select({
      ...getTableColumns(bidNotes),
      createdByName: createdByUser.fullName,
    })
    .from(bidNotes)
    .leftJoin(createdByUser, eq(bidNotes.createdBy, createdByUser.id))
    .where(and(eq(bidNotes.bidId, bidId), eq(bidNotes.isDeleted, false)))
    .orderBy(desc(bidNotes.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    data: notes.map(({ createdByName, ...note }) => ({
      ...note,
      createdByName: createdByName ?? null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const getBidNoteById = async (noteId: string) => {
  const [row] = await db
    .select({
      ...getTableColumns(bidNotes),
      createdByName: createdByUser.fullName,
    })
    .from(bidNotes)
    .leftJoin(createdByUser, eq(bidNotes.createdBy, createdByUser.id))
    .where(and(eq(bidNotes.id, noteId), eq(bidNotes.isDeleted, false)));
  if (!row) return null;
  const { createdByName, ...note } = row;
  return { ...note, createdByName: createdByName ?? null };
};

export const createBidNote = async (data: {
  bidId: string;
  note: string;
  createdBy: string;
}) => {
  const [note] = await db.insert(bidNotes).values(data).returning();
  return note;
};

export const updateBidNote = async (
  id: string,
  data: {
    note: string;
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

export const getBidHistory = async (bidId: string, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  const countResult = await db
    .select({ total: count() })
    .from(bidHistory)
    .where(eq(bidHistory.bidId, bidId));
  const total = countResult[0]?.total ?? 0;

  const data = await db
    .select({
      id: bidHistory.id,
      bidId: bidHistory.bidId,
      action: bidHistory.action,
      oldValue: bidHistory.oldValue,
      newValue: bidHistory.newValue,
      description: bidHistory.description,
      performedBy: bidHistory.performedBy,
      createdAt: bidHistory.createdAt,
      userName: users.fullName,
      userId: users.id,
    })
    .from(bidHistory)
    .leftJoin(users, eq(bidHistory.performedBy, users.id))
    .where(eq(bidHistory.bidId, bidId))
    .orderBy(desc(bidHistory.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const createBidHistoryEntry = async (data: {
  bidId: string;
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
    case "service":
      await db.insert(bidServiceData).values({
        bidId,
      });
      break;
    case "preventative_maintenance":
      await db.insert(bidPreventativeMaintenanceData).values({
        bidId,
      });
      break;
    case "general":
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
    serviceData,
    preventativeMaintenanceData,
    timeline,
    notes,
    history,
    clientInfo,
    operatingExpenses,
    documents,
    media,
    planSpecFiles,
    designBuildFiles,
  ] = await Promise.all([
    getBidFinancialBreakdown(id, organizationId),
    getBidMaterials(id, organizationId),
    getBidLabor(id),
    getBidSurveyData(id, organizationId),
    getBidPlanSpecData(id, organizationId),
    getBidDesignBuildData(id, organizationId),
    getBidServiceData(id, organizationId),
    getBidPreventativeMaintenanceData(id, organizationId),
    getBidTimeline(id),
    getBidNotes(id).then((r) => r.data),
    getBidHistory(id).then((r) => r.data),
    getOrganizationById(organizationId),
    getBidOperatingExpenses(id, organizationId),
    getBidDocuments(id),
    getBidMedia(id),
    getBidPlanSpecFiles(id),
    getBidDesignBuildFiles(id),
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
    planSpecFiles,
    designBuildData,
    designBuildFiles,
    serviceData,
    preventativeMaintenanceData,
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

/** Ordered document rows (before tags map); used for full list and pagination */
async function fetchBidDocumentsRows(
  bidId: string,
  options?: {
    tagIds?: string[];
    fileType?: "pdf" | "word" | "excel";
    dateRange?: "today" | "this_week" | "this_month" | "this_year";
    sortBy?: "date" | "name" | "size";
    sortOrder?: "asc" | "desc";
  },
): Promise<
  {
    document: typeof bidDocuments.$inferSelect;
    uploadedByName: string | null;
  }[]
> {
  const tagIds = options?.tagIds?.filter(Boolean);
  const hasTagFilter = (tagIds?.length ?? 0) > 0;

  const conditions: any[] = [
    eq(bidDocuments.bidId, bidId),
    eq(bidDocuments.isDeleted, false),
  ];

  if (options?.fileType) {
    const mimeMap: Record<string, string[]> = {
      pdf: ["application/pdf"],
      word: [
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      excel: [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
    };
    const mimeTypes = mimeMap[options.fileType] ?? [];
    if (mimeTypes.length === 1) {
      conditions.push(eq(bidDocuments.fileType, mimeTypes[0]!));
    } else if (mimeTypes.length > 1) {
      conditions.push(inArray(bidDocuments.fileType, mimeTypes));
    }
  }

  if (options?.dateRange) {
    const now = new Date();
    let from: Date;
    if (options.dateRange === "today") {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (options.dateRange === "this_week") {
      const day = now.getDay();
      from = new Date(now);
      from.setDate(now.getDate() - day);
      from.setHours(0, 0, 0, 0);
    } else if (options.dateRange === "this_month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      from = new Date(now.getFullYear(), 0, 1);
    }
    conditions.push(sql`${bidDocuments.createdAt} >= ${from.toISOString()}`);
  }

  const baseConditions = and(...conditions);

  const sortField =
    options?.sortBy === "name"
      ? bidDocuments.fileName
      : options?.sortBy === "size"
        ? bidDocuments.fileSize
        : bidDocuments.createdAt;
  const orderBy =
    options?.sortOrder === "asc" ? asc(sortField) : desc(sortField);

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
      .orderBy(orderBy);
    const seen = new Set<string>();
    return withTagLinks.filter((row) => {
      if (seen.has(row.document.id)) return false;
      seen.add(row.document.id);
      return true;
    });
  }

  return db
    .select({
      document: bidDocuments,
      uploadedByName: users.fullName,
    })
    .from(bidDocuments)
    .leftJoin(users, eq(bidDocuments.uploadedBy, users.id))
    .where(baseConditions)
    .orderBy(orderBy);
}

export const getBidDocuments = async (
  bidId: string,
  options?: {
    tagIds?: string[];
    fileType?: "pdf" | "word" | "excel";
    dateRange?: "today" | "this_week" | "this_month" | "this_year";
    sortBy?: "date" | "name" | "size";
    sortOrder?: "asc" | "desc";
  },
) => {
  const documentsResult = await fetchBidDocumentsRows(bidId, options);
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

export type BidDocumentsPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const getBidDocumentsPaginated = async (
  bidId: string,
  page: number,
  limit: number,
  options?: {
    tagIds?: string[];
    fileType?: "pdf" | "word" | "excel";
    dateRange?: "today" | "this_week" | "this_month" | "this_year";
    sortBy?: "date" | "name" | "size";
    sortOrder?: "asc" | "desc";
  },
) => {
  const rows = await fetchBidDocumentsRows(bidId, options);
  const total = rows.length;
  const offset = (page - 1) * limit;
  const slice = rows.slice(offset, offset + limit);
  const documentTagsMap = await getDocumentTagsMapForDocuments(
    bidId,
    slice.map((r) => r.document.id),
  );
  const data = slice.map((doc) => ({
    ...doc.document,
    uploadedByName: doc.uploadedByName || null,
    tags: documentTagsMap.get(doc.document.id) ?? [],
  }));
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    } satisfies BidDocumentsPagination,
  };
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

function buildBidMediaWhereAndOrder(
  bidId: string,
  options?: {
    mediaType?: "photo" | "video" | "audio";
    dateRange?: "today" | "this_week" | "this_month" | "this_year";
    sortBy?: "date" | "name" | "size";
    sortOrder?: "asc" | "desc";
  },
) {
  const conditions: any[] = [
    eq(bidMedia.bidId, bidId),
    eq(bidMedia.isDeleted, false),
  ];

  if (options?.mediaType) {
    conditions.push(eq(bidMedia.mediaType, options.mediaType));
  }

  if (options?.dateRange) {
    const now = new Date();
    let from: Date;
    if (options.dateRange === "today") {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (options.dateRange === "this_week") {
      from = new Date(now);
      from.setDate(now.getDate() - now.getDay());
      from.setHours(0, 0, 0, 0);
    } else if (options.dateRange === "this_month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      from = new Date(now.getFullYear(), 0, 1);
    }
    conditions.push(sql`${bidMedia.createdAt} >= ${from.toISOString()}`);
  }

  const sortField =
    options?.sortBy === "name"
      ? bidMedia.fileName
      : options?.sortBy === "size"
        ? bidMedia.fileSize
        : bidMedia.createdAt;
  const orderBy =
    options?.sortOrder === "asc" ? asc(sortField) : desc(sortField);

  return { where: and(...conditions), orderBy };
}

export const getBidMedia = async (
  bidId: string,
  options?: {
    mediaType?: "photo" | "video" | "audio";
    dateRange?: "today" | "this_week" | "this_month" | "this_year";
    sortBy?: "date" | "name" | "size";
    sortOrder?: "asc" | "desc";
  },
) => {
  const { where, orderBy } = buildBidMediaWhereAndOrder(bidId, options);

  const mediaResult = await db
    .select({
      media: bidMedia,
      uploadedByName: users.fullName,
    })
    .from(bidMedia)
    .leftJoin(users, eq(bidMedia.uploadedBy, users.id))
    .where(where)
    .orderBy(orderBy);

  return mediaResult.map((item) => ({
    ...item.media,
    uploadedByName: item.uploadedByName || null,
  }));
};

export type BidMediaPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const getBidMediaPaginated = async (
  bidId: string,
  page: number,
  limit: number,
  options?: {
    mediaType?: "photo" | "video" | "audio";
    dateRange?: "today" | "this_week" | "this_month" | "this_year";
    sortBy?: "date" | "name" | "size";
    sortOrder?: "asc" | "desc";
  },
) => {
  const { where, orderBy } = buildBidMediaWhereAndOrder(bidId, options);
  const offset = (page - 1) * limit;

  const countResult = await db
    .select({ total: count() })
    .from(bidMedia)
    .where(where);
  const total = Number(countResult[0]?.total ?? 0);

  const mediaResult = await db
    .select({
      media: bidMedia,
      uploadedByName: users.fullName,
    })
    .from(bidMedia)
    .leftJoin(users, eq(bidMedia.uploadedBy, users.id))
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const data = mediaResult.map((item) => ({
    ...item.media,
    uploadedByName: item.uploadedByName || null,
  }));

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    } satisfies BidMediaPagination,
  };
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

const computeBidsKPIs = async () => {
  const [
    [totalBidValueRow],
    [activeBidsRow],
    [pendingBidsRow],
    [wonBidsRow],
    [avgProfitMarginRow],
  ] = await Promise.all([
    db
      .select({
        totalBidValue: sql<string>`COALESCE(SUM(CAST(${bidFinancialBreakdown.actualTotalPrice} AS NUMERIC)), 0)`,
      })
      .from(bidsTable)
      .leftJoin(
        bidFinancialBreakdown,
        and(
          eq(bidsTable.id, bidFinancialBreakdown.bidId),
          eq(bidFinancialBreakdown.isDeleted, false),
        ),
      )
      .where(eq(bidsTable.isDeleted, false)),
    db
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
      ),
    db
      .select({ count: count() })
      .from(bidsTable)
      .where(and(eq(bidsTable.isDeleted, false), eq(bidsTable.status, "draft"))),
    db
      .select({ count: count() })
      .from(bidsTable)
      .where(
        and(
          eq(bidsTable.isDeleted, false),
          or(eq(bidsTable.status, "accepted"), eq(bidsTable.status, "won")),
        ),
      ),
    db
      .select({
        avgProfitMargin: sql<string>`COALESCE(AVG(CAST(${bidsTable.profitMargin} AS NUMERIC)), 0)`,
      })
      .from(bidsTable)
      .where(eq(bidsTable.isDeleted, false)),
  ]);

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

export const getBidsKPIs = async () =>
  cachedOrgAggregate("bids-kpis", computeBidsKPIs);

// Get KPIs for a specific bid
export const getBidKPIs = async (bidId: string) => {
  const [bid] = await db
    .select({
      actualTotalPrice: bidFinancialBreakdown.actualTotalPrice,
      estimatedDuration: bidsTable.estimatedDuration,
      profitMargin: bidsTable.profitMargin,
      endDate: bidsTable.endDate,
      plannedStartDate: bidsTable.plannedStartDate,
      estimatedCompletion: bidsTable.estimatedCompletion,
    })
    .from(bidsTable)
    .leftJoin(
      bidFinancialBreakdown,
      and(
        eq(bidsTable.id, bidFinancialBreakdown.bidId),
        eq(bidFinancialBreakdown.isDeleted, false),
      ),
    )
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
    bidAmount: Number(bid.actualTotalPrice || 0),
    estimatedDuration: calculatedDuration,
    profitMargin: Number(bid.profitMargin || 0),
    expiresIn: expiresInDaysFromToday(bid),
  };
};

/** Statuses that should be auto-expired when endDate has passed */
const BID_STATUSES_TO_EXPIRE = ["draft", "submitted", "in_progress"] as const;

/**
 * Expire bids whose endDate has passed. Used by cron job.
 * Updates status to "expired" and creates history entry when CRON_SYSTEM_USER_ID is set.
 */
export const expireExpiredBids = async (): Promise<{
  expired: number;
  errors: number;
}> => {
  // Use server-local date so a bid expiring "today" doesn't expire early due to UTC date rollover
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

  const expireConcurrency = 6;
  for (let i = 0; i < expiredBids.length; i += expireConcurrency) {
    const chunk = expiredBids.slice(i, i + expireConcurrency);
    const settled = await Promise.allSettled(
      chunk.map(async (bid) => {
        await updateBid(bid.id, bid.organizationId, { status: "expired" });
        if (systemUserId) {
          await createBidHistoryEntry({
            bidId: bid.id,
            action: "status_changed",
            oldValue: bid.status,
            newValue: "expired",
            description: "Bid automatically expired (end date passed)",
            performedBy: systemUserId,
          });
        }
      }),
    );
    for (const r of settled) {
      if (r.status === "fulfilled") expired++;
      else errors++;
    }
  }

  return { expired, errors };
};

// ===========================================================================
// Bulk Delete
// ===========================================================================

export const bulkDeleteBids = async (ids: string[], deletedBy: string) => {
  const now = new Date();

  // 1. Collect job IDs for all these bids
  const jobRows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(inArray(jobs.bidId, ids), eq(jobs.isDeleted, false)));
  const jobIds = jobRows.map((r) => r.id);

  if (jobIds.length > 0) {
    const taskRows = await db
      .select({ id: dispatchTasks.id })
      .from(dispatchTasks)
      .where(
        and(
          inArray(dispatchTasks.jobId, jobIds),
          eq(dispatchTasks.isDeleted, false),
        ),
      );
    const taskIds = taskRows.map((r) => r.id);

    if (taskIds.length > 0) {
      await db
        .update(dispatchAssignments)
        .set({ isDeleted: true, updatedAt: now })
        .where(
          and(
            inArray(dispatchAssignments.taskId, taskIds),
            eq(dispatchAssignments.isDeleted, false),
          ),
        );
    }

    await db
      .update(dispatchTasks)
      .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
      .where(
        and(
          inArray(dispatchTasks.jobId, jobIds),
          eq(dispatchTasks.isDeleted, false),
        ),
      );

    await db
      .update(jobTeamMembers)
      .set({ isActive: false })
      .where(inArray(jobTeamMembers.jobId, jobIds));

    await Promise.all([
      db
        .update(jobTasks)
        .set({ isDeleted: true, updatedAt: now })
        .where(
          and(inArray(jobTasks.jobId, jobIds), eq(jobTasks.isDeleted, false)),
        ),
      db
        .update(jobSurveys)
        .set({ isDeleted: true, updatedAt: now })
        .where(
          and(
            inArray(jobSurveys.jobId, jobIds),
            eq(jobSurveys.isDeleted, false),
          ),
        ),
      db
        .update(jobExpenses)
        .set({ isDeleted: true, updatedAt: now })
        .where(
          and(
            inArray(jobExpenses.jobId, jobIds),
            eq(jobExpenses.isDeleted, false),
          ),
        ),
    ]);

    await db
      .update(jobs)
      .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
      .where(and(inArray(jobs.id, jobIds), eq(jobs.isDeleted, false)));
  }

  // 2. Soft-delete bid travel (tied to bidLabor, not directly to bid)
  const laborRows = await db
    .select({ id: bidLabor.id })
    .from(bidLabor)
    .where(inArray(bidLabor.bidId, ids));
  if (laborRows.length > 0) {
    const laborIds = laborRows.map((r) => r.id);
    await db
      .update(bidTravel)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          inArray(bidTravel.bidLaborId, laborIds),
          eq(bidTravel.isDeleted, false),
        ),
      );
  }

  // 3. Soft-delete all bid sub-tables (in parallel)
  await Promise.all([
    db
      .update(bidFinancialBreakdown)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          inArray(bidFinancialBreakdown.bidId, ids),
          eq(bidFinancialBreakdown.isDeleted, false),
        ),
      ),
    db
      .update(bidMaterials)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          inArray(bidMaterials.bidId, ids),
          eq(bidMaterials.isDeleted, false),
        ),
      ),
    db
      .update(bidLabor)
      .set({ isDeleted: true, updatedAt: now })
      .where(and(inArray(bidLabor.bidId, ids), eq(bidLabor.isDeleted, false))),
    db
      .update(bidOperatingExpenses)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          inArray(bidOperatingExpenses.bidId, ids),
          eq(bidOperatingExpenses.isDeleted, false),
        ),
      ),
    db
      .update(bidPlanSpecData)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          inArray(bidPlanSpecData.bidId, ids),
          eq(bidPlanSpecData.isDeleted, false),
        ),
      ),
    db
      .update(bidSurveyData)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          inArray(bidSurveyData.bidId, ids),
          eq(bidSurveyData.isDeleted, false),
        ),
      ),
    db
      .update(bidDesignBuildData)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          inArray(bidDesignBuildData.bidId, ids),
          eq(bidDesignBuildData.isDeleted, false),
        ),
      ),
    db
      .update(bidServiceData)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          inArray(bidServiceData.bidId, ids),
          eq(bidServiceData.isDeleted, false),
        ),
      ),
    db
      .update(bidPreventativeMaintenanceData)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          inArray(bidPreventativeMaintenanceData.bidId, ids),
          eq(bidPreventativeMaintenanceData.isDeleted, false),
        ),
      ),
    db
      .update(bidTimeline)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(inArray(bidTimeline.bidId, ids), eq(bidTimeline.isDeleted, false)),
      ),
    db
      .update(bidNotes)
      .set({ isDeleted: true, updatedAt: now })
      .where(and(inArray(bidNotes.bidId, ids), eq(bidNotes.isDeleted, false))),
    db
      .update(bidDocuments)
      .set({ isDeleted: true, deletedAt: now, updatedAt: now })
      .where(
        and(
          inArray(bidDocuments.bidId, ids),
          eq(bidDocuments.isDeleted, false),
        ),
      ),
    db
      .update(bidMedia)
      .set({ isDeleted: true, deletedAt: now, updatedAt: now })
      .where(and(inArray(bidMedia.bidId, ids), eq(bidMedia.isDeleted, false))),
    db
      .update(bidPlanSpecFiles)
      .set({ isDeleted: true, deletedAt: now })
      .where(
        and(
          inArray(bidPlanSpecFiles.bidId, ids),
          eq(bidPlanSpecFiles.isDeleted, false),
        ),
      ),
    db
      .update(bidDesignBuildFiles)
      .set({ isDeleted: true, deletedAt: now })
      .where(
        and(
          inArray(bidDesignBuildFiles.bidId, ids),
          eq(bidDesignBuildFiles.isDeleted, false),
        ),
      ),
  ]);

  // 4. Soft-delete the bids
  const result = await db
    .update(bidsTable)
    .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
    .where(and(inArray(bidsTable.id, ids), eq(bidsTable.isDeleted, false)))
    .returning({ id: bidsTable.id });
  return { deleted: result.length, skipped: ids.length - result.length };
};

// ============================
// Plan Spec Files Operations
// ============================

export const getBidPlanSpecFiles = async (bidId: string) => {
  return db
    .select()
    .from(bidPlanSpecFiles)
    .where(
      and(
        eq(bidPlanSpecFiles.bidId, bidId),
        eq(bidPlanSpecFiles.isDeleted, false),
      ),
    )
    .orderBy(desc(bidPlanSpecFiles.createdAt));
};

export const createBidPlanSpecFile = async (data: {
  organizationId: string;
  bidId: string;
  fileType: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  uploadedBy: string;
}) => {
  const [file] = await db.insert(bidPlanSpecFiles).values(data).returning();
  return file;
};

export const deleteBidPlanSpecFile = async (fileId: string) => {
  const now = new Date();
  const [deleted] = await db
    .update(bidPlanSpecFiles)
    .set({ isDeleted: true, deletedAt: now })
    .where(
      and(
        eq(bidPlanSpecFiles.id, fileId),
        eq(bidPlanSpecFiles.isDeleted, false),
      ),
    )
    .returning();
  return deleted ?? null;
};

// ============================
// Design Build Files Operations
// ============================

export const getBidDesignBuildFiles = async (bidId: string) => {
  return db
    .select()
    .from(bidDesignBuildFiles)
    .where(
      and(
        eq(bidDesignBuildFiles.bidId, bidId),
        eq(bidDesignBuildFiles.isDeleted, false),
      ),
    )
    .orderBy(desc(bidDesignBuildFiles.createdAt));
};

export const createBidDesignBuildFile = async (data: {
  organizationId: string;
  bidId: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  uploadedBy: string;
}) => {
  const [file] = await db.insert(bidDesignBuildFiles).values(data).returning();
  return file;
};

export const deleteBidDesignBuildFile = async (fileId: string) => {
  const now = new Date();
  const [deleted] = await db
    .update(bidDesignBuildFiles)
    .set({ isDeleted: true, deletedAt: now })
    .where(
      and(
        eq(bidDesignBuildFiles.id, fileId),
        eq(bidDesignBuildFiles.isDeleted, false),
      ),
    )
    .returning();
  return deleted ?? null;
};
