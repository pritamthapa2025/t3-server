import type { Request, Response } from "express";
import { asSingleString } from "../utils/request-helpers.js";
import { getDataFilterConditions } from "../services/featurePermission.service.js";
import { STALE_DATA, staleDataResponse } from "../utils/optimistic-lock.js";

// Access control: use USER data (req.user.id), not organization.
// Organization = CLIENT data (see .cursorrules). For bid handlers, get client org from the bid (bid.organizationId) when needed.
const validateUserAccess = (req: Request, res: Response): string | null => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(403).json({
      success: false,
      message: "Access denied. Authentication required.",
    });
    return null;
  }

  return userId;
};

// Helper function to validate required params
const validateParams = (
  req: Request,
  res: Response,
  paramNames: string[],
): boolean => {
  for (const paramName of paramNames) {
    if (!req.params[paramName]) {
      res.status(400).json({
        success: false,
        message: `${paramName} is required`,
      });
      return false;
    }
  }
  return true;
};

import { logger } from "../utils/logger.js";
import {
  parseDatabaseError,
  isDatabaseError,
} from "../utils/database-error-parser.js";
import {
  uploadToSpaces,
  resolveStorageUrl,
} from "../services/storage.service.js";
import { getUserRoles } from "../services/role.service.js";
import {
  getBids,
  getBidById,
  getBidByIdSimple,
  createBid,
  updateBid,
  patchBidMarked,
  deleteBid,
  bulkDeleteBids,
  getBidFinancialBreakdown,
  updateBidFinancialBreakdown,
  getBidMaterials,
  getBidMaterialById,
  createBidMaterial,
  updateBidMaterial,
  deleteBidMaterial,
  getBidLabor,
  getBidLaborById,
  createBidLabor,
  updateBidLabor,
  deleteBidLabor,
  getBidTravel,
  getAllBidTravel,
  getBidTravelById,
  createBidTravel,
  updateBidTravel,
  deleteBidTravel,
  createBulkLaborAndTravel,
  getBidSurveyData,
  updateBidSurveyData,
  getBidPlanSpecData,
  updateBidPlanSpecData,
  getBidDesignBuildData,
  updateBidDesignBuildData,
  getBidServiceData,
  updateBidServiceData,
  getBidPreventativeMaintenanceData,
  updateBidPreventativeMaintenanceData,
  getBidOperatingExpenses,
  createBidOperatingExpenses,
  updateBidOperatingExpenses,
  deleteBidOperatingExpenses,
  getBidTimeline,
  getBidTimelinePaginated,
  createBidTimelineEvent,
  updateBidTimelineEvent,
  deleteBidTimelineEvent,
  getBidNotes,
  createBidNote,
  updateBidNote,
  deleteBidNote,
  getBidHistory,
  createBidHistoryEntry,
  getBidWithAllData,
  getBidVersionInfo,
  getRelatedBids,
  createBidDocument,
  getBidDocuments,
  getBidDocumentsPaginated,
  getBidDocumentById,
  updateBidDocument,
  getBidsKPIs,
  getBidKPIs,
  deleteBidDocument,
  updateDocumentTags,
  updateMediaTags,
  getDistinctMediaTags,
  updateWalkPhotoTags,
  getDistinctWalkPhotoTags,
  createBidMedia,
  getBidMedia,
  getBidMediaPaginated,
  getBidMediaById,
  updateBidMedia,
  deleteBidMedia,
  createBidWalkPhoto,
  getBidWalkPhotos,
  getBidWalkPhotosPaginated,
  getBidWalkPhotoById,
  updateBidWalkPhoto,
  deleteBidWalkPhoto,
  getBidPlanSpecFiles,
  createBidPlanSpecFile,
  deleteBidPlanSpecFile,
  getBidDesignBuildFiles,
  createBidDesignBuildFile,
  deleteBidDesignBuildFile,
} from "../services/bid.service.js";
import { appendJobHistoryForBid } from "../services/job.service.js";
import { getOrganizationById } from "../services/client.service.js";
import {
  prepareQuoteDataForPDF,
  generateQuotePDF,
  issuerCompanyFromGeneralSettings,
} from "../services/pdf.service.js";
import { getGeneralSettings } from "../services/settings.service.js";
import { sendQuoteEmail as sendQuoteEmailService } from "../services/email.service.js";

async function quotePdfIssuerOptions() {
  const general = await getGeneralSettings();
  return { issuer: issuerCompanyFromGeneralSettings(general) };
}

// ============================
// Main Bid Operations
// ============================

/**
 * Compute total price (and cost where applicable) from job-type-specific
 * pricing data. Returns null when the data is absent or yields a zero total.
 * Used to backfill bid_financial_breakdown.total_price after saving job-type
 * data so that the bids list always returns an accurate bidAmount.
 */
/**
 * Compute job-type-specific financial totals for backfilling bid_financial_breakdown.
 *
 * @param directCosts - Pre-existing direct costs from the financial breakdown
 *   (materialsEquipment + labor + travel). Passed in so that job-type pricing
 *   (e.g. PM contract value) can be added ON TOP of direct costs rather than
 *   replacing them.
 */
function computeJobTypeFinancials(
  jobType: string | null | undefined,
  data: Record<string, unknown> | null | undefined,
  directCosts: {
    materialsEquipment: number;
    labor: number;
    travel: number;
  } = { materialsEquipment: 0, labor: 0, travel: 0 },
): { totalPrice: string; totalCost: string; grossProfit: string } | null {
  if (!jobType || !data) return null;

  const n = (v: unknown): number => parseFloat(String(v ?? "0")) || 0;
  const directCostTotal =
    directCosts.materialsEquipment + directCosts.labor + directCosts.travel;
  let totalPrice = 0;
  let totalCost = 0;

  switch (jobType) {
    case "survey": {
      totalPrice = n(data.totalSurveyFee);
      if (totalPrice === 0) {
        if (data.pricingModel === "flat_fee")
          totalPrice = n(data.flatSurveyFee);
        else if (data.pricingModel === "time_materials")
          totalPrice =
            n(data.estimatedHours) * n(data.hourlyRate) +
            n(data.estimatedExpenses);
      }
      // Survey fee is the revenue; direct costs (materials etc.) are the cost.
      totalCost = directCostTotal;
      break;
    }
    case "service": {
      if (data.pricingModel === "flat_rate") {
        totalPrice = n(data.flatRatePrice);
        // Direct costs (materials, labour, travel) recorded in the breakdown.
        totalCost = directCostTotal;
      } else if (data.pricingModel === "diagnostic_repair") {
        totalPrice = n(data.diagnosticFee) + n(data.estimatedRepairCost);
        totalCost = directCostTotal;
      } else {
        // time_and_materials: service data carries its own cost/price fields.
        totalCost =
          n(data.laborHours) * n(data.laborRate) +
          n(data.materialsCost) +
          n(data.travelCost);
        totalPrice = totalCost * (1 + n(data.serviceMarkup) / 100);
      }
      break;
    }
    case "preventative_maintenance": {
      // PM contract value = revenue the client pays for the PM service.
      // Direct costs (materials, filters, etc.) are tracked separately in the
      // financial breakdown and are billed on top of the PM contract value.
      let pmContractValue = 0;
      if (data.pricingModel === "flat_rate")
        pmContractValue = n(data.flatRatePerVisit);
      else if (data.pricingModel === "annual_contract")
        pmContractValue = n(data.annualContractValue);
      else
        pmContractValue =
          n(data.pricePerUnit) * Math.max(n(data.numberOfUnits), 1);

      totalCost = directCostTotal;
      // Client invoice = PM contract value + any direct material/labour costs.
      totalPrice = pmContractValue + directCostTotal;
      break;
    }
    case "design_build": {
      totalPrice = n(data.designPrice);
      totalCost = n(data.designCost);
      break;
    }
    default:
      return null;
  }

  if (totalPrice === 0) return null;
  const grossProfit = totalPrice - totalCost;
  return {
    totalPrice: totalPrice.toFixed(2),
    totalCost: totalCost.toFixed(2),
    grossProfit: grossProfit.toFixed(2),
  };
}

export const getBidsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    // Validate user access (user data, not org)
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const offset = (page - 1) * limit;

    const filters: {
      organizationIds?: string[];
      status?: string[];
      jobType?: string[];
      priority?: string;
      assignedTo?: string;
      search?: string;
      sortBy?: "newest" | "oldest" | "value_high" | "value_low";
    } = {};

    if (req.query.organizationId) {
      const raw = req.query.organizationId;
      filters.organizationIds = Array.isArray(raw)
        ? (raw as string[])
        : [raw as string];
    }

    if (req.query.status) {
      const raw = req.query.status;
      filters.status = Array.isArray(raw) ? (raw as string[]) : [raw as string];
    }
    if (req.query.jobType) {
      const raw = req.query.jobType;
      filters.jobType = Array.isArray(raw) ? (raw as string[]) : [raw as string];
    }
    if (req.query.priority) filters.priority = req.query.priority as string;
    if (req.query.assignedTo)
      filters.assignedTo = req.query.assignedTo as string;
    if (req.query.search) filters.search = req.query.search as string;
    if (req.query.sortBy)
      filters.sortBy = req.query.sortBy as
        | "newest"
        | "oldest"
        | "value_high"
        | "value_low";

    const dataFilter = await getDataFilterConditions(userId, "bids");
    const bidOptions = dataFilter.assignedOnly
      ? { userId, applyAssignedOrTeamFilter: true }
      : undefined;

    const bids = await getBids(
      offset,
      limit,
      Object.keys(filters).length > 0 ? filters : undefined,
      bidOptions,
    );

    logger.info("Bids fetched successfully");
    return res.status(200).json({
      success: true,
      data: bids.data,
      total: bids.total,
      pagination: bids.pagination,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getBidByIdHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["id"])) return;
    const id = asSingleString(req.params.id);

    // Validate user access
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(id!);

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    // Users with view_assigned can only view bids they are assigned to
    if (req.userAccessLevel === "view_assigned" && bid.assignedTo !== userId) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to view this bid. You can only view bids assigned to you.",
      });
    }

    // Get documents and client (organization) info for the bid
    const [documents, clientInfo] = await Promise.all([
      getBidDocuments(id!),
      getOrganizationById(bid.organizationId),
    ]);

    logger.info("Bid fetched successfully");
    return res.status(200).json({
      success: true,
      data: {
        ...bid,
        documents,
        clientInfo: clientInfo?.organization ?? null,
      },
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createBidHandler = async (req: Request, res: Response) => {
  try {
    // Validate user access (returns userId for createdBy)
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const createdBy = userId;
    const { organizationId } = req.body;

    // organizationId is required - it's the CLIENT organization ID (not T3)
    // Bids are created FOR client organizations BY T3 employees
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message:
          "organizationId is required. This should be the client organization ID.",
      });
    }

    // Get user's role to determine bid status
    const userRole = await getUserRoles(userId);
    let bidStatus = req.body.status; // Use status from request body as default

    // Set status based on role
    if (userRole?.roleName === "Executive") {
      bidStatus = "in_progress";
    } else if (userRole?.roleName === "Manager") {
      bidStatus = "draft";
    }

    // Extract nested objects from request body
    const {
      financialBreakdown,
      operatingExpenses,
      materials,
      laborAndTravel,
      surveyData,
      planSpecData,
      designBuildData,
      serviceData,
      preventativeMaintenanceData,
      ...bidFields
    } = req.body;

    // Strip auto-generated field - bidNumber is always system-generated
    delete bidFields.bidNumber;

    // Create bid with only bid fields (excluding nested objects)
    const bidData = {
      ...bidFields,
      organizationId,
      createdBy,
      status: bidStatus, // Override status based on role
    };

    const bid = await createBid(bidData);

    if (!bid) {
      return res.status(500).json({
        success: false,
        message: "Failed to create bid",
      });
    }

    // Create related records if provided
    const createdRecords: any = {};

    // Update financial breakdown if provided
    if (financialBreakdown) {
      createdRecords.financialBreakdown = await updateBidFinancialBreakdown(
        bid.id,
        organizationId,
        financialBreakdown,
        true,
      );
    }

    // Update operating expenses if provided
    if (operatingExpenses) {
      createdRecords.operatingExpenses = await updateBidOperatingExpenses(
        bid.id,
        organizationId,
        operatingExpenses,
        true,
      );
    }

    // Create materials if provided
    if (materials && Array.isArray(materials) && materials.length > 0) {
      createdRecords.materials = [];
      for (const material of materials) {
        const createdMaterial = await createBidMaterial({
          ...material,
          bidId: bid.id,
        });
        createdRecords.materials.push(createdMaterial);
      }
    }

    // Create labor and travel in bulk if provided
    if (laborAndTravel) {
      const { labor, travel } = laborAndTravel;
      if (labor && travel && Array.isArray(labor) && Array.isArray(travel)) {
        if (labor.length === travel.length && labor.length > 0) {
          const bulkResult = await createBulkLaborAndTravel(
            bid.id,
            labor,
            travel,
          );
          createdRecords.labor = bulkResult.labor;
          createdRecords.travel = bulkResult.travel;
        }
      }
    }

    // Update type-specific data if provided
    if (surveyData && bid.jobType === "survey") {
      createdRecords.surveyData = await updateBidSurveyData(
        bid.id,
        organizationId,
        surveyData,
      );
    } else if (planSpecData && bid.jobType === "plan_spec") {
      createdRecords.planSpecData = await updateBidPlanSpecData(
        bid.id,
        organizationId,
        planSpecData,
      );
    } else if (designBuildData && bid.jobType === "design_build") {
      createdRecords.designBuildData = await updateBidDesignBuildData(
        bid.id,
        organizationId,
        designBuildData,
      );
    } else if (serviceData && bid.jobType === "service") {
      createdRecords.serviceData = await updateBidServiceData(
        bid.id,
        organizationId,
        serviceData,
      );
    } else if (
      preventativeMaintenanceData &&
      bid.jobType === "preventative_maintenance"
    ) {
      createdRecords.preventativeMaintenanceData =
        await updateBidPreventativeMaintenanceData(
          bid.id,
          organizationId,
          preventativeMaintenanceData,
        );
    }

    // Compute financial breakdown from job-type pricing data.
    // For PM/service/survey bids this ALWAYS runs (regardless of whether the
    // client already sent a financialBreakdown.totalPrice) so that the server
    // is the authoritative source for totalPrice, totalCost, and grossProfit.
    // For general/plan_spec bids there is no job-type pricing function, so the
    // client-supplied breakdown is used as-is.
    const jtData =
      surveyData ??
      serviceData ??
      preventativeMaintenanceData ??
      designBuildData ??
      null;
    if (jtData) {
      // Read the direct costs (materials/labour/travel) that were just saved so
      // computeJobTypeFinancials can incorporate them correctly (e.g. PM bids
      // bill materials on top of the contract value).
      const savedFb = createdRecords.financialBreakdown;
      const nb = (v: unknown): number => parseFloat(String(v ?? "0")) || 0;
      const directCosts = {
        materialsEquipment: nb(savedFb?.actualMaterialsEquipment),
        labor: nb(savedFb?.actualLabor),
        travel: nb(savedFb?.actualTravel),
      };
      const computed = computeJobTypeFinancials(
        bid.jobType,
        jtData as Record<string, unknown>,
        directCosts,
      );
      if (computed) {
        const isFirstWrite = !createdRecords.financialBreakdown;
        createdRecords.financialBreakdown = await updateBidFinancialBreakdown(
          bid.id,
          organizationId,
          computed,
          isFirstWrite,
        );
      }
    }

    // Handle document uploads if provided (document_0, document_1, etc.)
    const files = (req.files as Express.Multer.File[]) || [];
    const documentFiles = files.filter((file) =>
      file.fieldname.startsWith("document_"),
    );

    if (documentFiles.length > 0) {
      const uploadedDocuments = [];
      for (let i = 0; i < documentFiles.length; i++) {
        const file = documentFiles[i];
        if (!file) continue;

        try {
          const uploadResult = await uploadToSpaces(
            file.buffer,
            file.originalname,
            "bid-documents",
          );

          const document = await createBidDocument({
            bidId: bid.id,
            fileName: file.originalname,
            filePath: uploadResult.url,
            fileType: file.mimetype,
            fileSize: file.size,
            uploadedBy: createdBy,
          });

          uploadedDocuments.push(document);
        } catch (uploadError: any) {
          logger.error(
            `Error uploading document ${file.originalname}:`,
            uploadError,
          );
        }
      }

      if (uploadedDocuments.length > 0) {
        createdRecords.documents = uploadedDocuments;
      }
    }

    // Handle media uploads if provided (media_0, media_1, etc.)
    const mediaFiles = files.filter((file) =>
      file.fieldname.startsWith("media_"),
    );

    if (mediaFiles.length > 0) {
      const uploadedMedia = [];
      for (let i = 0; i < mediaFiles.length; i++) {
        const file = mediaFiles[i];
        if (!file) continue;

        try {
          const uploadResult = await uploadToSpaces(
            file.buffer,
            file.originalname,
            "bid-media",
          );

          let mediaType = "other";
          if (file.mimetype.startsWith("image/")) mediaType = "photo";
          else if (file.mimetype.startsWith("video/")) mediaType = "video";
          else if (file.mimetype.startsWith("audio/")) mediaType = "audio";

          const media = await createBidMedia({
            bidId: bid.id,
            fileName: file.originalname,
            filePath: uploadResult.filePath,
            fileUrl: uploadResult.url,
            fileType: file.mimetype,
            fileSize: file.size,
            mediaType,
            uploadedBy: createdBy,
          });

          uploadedMedia.push(media);
        } catch (uploadError: any) {
          logger.error(
            `Error uploading media ${file.originalname}:`,
            uploadError,
          );
        }
      }

      if (uploadedMedia.length > 0) {
        createdRecords.media = uploadedMedia;
      }
    }

    // Handle bid walk photo uploads if provided (walk_photo_0, walk_photo_1, etc.)
    const walkPhotoFiles = files.filter((file) =>
      file.fieldname.startsWith("walk_photo_"),
    );

    if (walkPhotoFiles.length > 0) {
      const uploadedWalk: Awaited<ReturnType<typeof createBidWalkPhoto>>[] =
        [];
      for (let i = 0; i < walkPhotoFiles.length; i++) {
        const file = walkPhotoFiles[i];
        if (!file) continue;

        try {
          const uploadResult = await uploadToSpaces(
            file.buffer,
            file.originalname,
            "bid-walk-photos",
          );

          let mediaTypeWalk = "other";
          if (file.mimetype.startsWith("image/")) mediaTypeWalk = "photo";
          else if (file.mimetype.startsWith("video/")) mediaTypeWalk = "video";
          else if (file.mimetype.startsWith("audio/")) mediaTypeWalk = "audio";

          const row = await createBidWalkPhoto({
            bidId: bid.id,
            fileName: file.originalname,
            filePath: uploadResult.filePath,
            fileUrl: uploadResult.url,
            fileType: file.mimetype,
            fileSize: file.size,
            mediaType: mediaTypeWalk,
            uploadedBy: createdBy,
          });
          if (row) uploadedWalk.push(row);
        } catch (uploadError: any) {
          logger.error(
            `Error uploading bid walk photo ${file.originalname}:`,
            uploadError,
          );
        }
      }

      if (uploadedWalk.length > 0) {
        createdRecords.walkPhotos = uploadedWalk;
        const uploadedNames = uploadedWalk
          .map((m) => m?.fileName ?? "")
          .join(", ");
        const n = uploadedWalk.length;
        const desc = `${n} bid walk photo${n === 1 ? "" : "s"} uploaded: ${uploadedNames}`;
        await createBidHistoryEntry({
          bidId: bid.id,
          action: "walk_photo_uploaded",
          newValue: uploadedNames,
          description: desc,
          performedBy: createdBy,
        });
        await appendJobHistoryForBid(bid.id, {
          action: "walk_photo_uploaded",
          newValue: uploadedNames,
          description: desc,
          createdBy: createdBy,
        });
      }
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bid.id,
      action: "bid_created",
      newValue: "Created new bid",
      description: `Bid "${bid.projectName || bid.bidNumber}" was created with related records`,
      performedBy: createdBy,
    });

    logger.info("Bid created successfully with related records");
    return res.status(201).json({
      success: true,
      data: {
        bid,
        ...createdRecords,
      },
      message: "Bid created successfully with all related records",
    });
  } catch (error: any) {
    logger.logApiError("Error creating bid", error, req);

    // Use database error parser for consistent, human-readable error messages
    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);

      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
        technicalDetails:
          process.env.NODE_ENV === "development"
            ? parsedError.technicalMessage
            : undefined,
      });
    }

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while creating the bid",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * PATCH /bids/:bidId/marked
 * Lightweight endpoint — updates only the `marked` column and writes one
 * history entry.  Much faster than the full PUT /bids/:id.
 */
export const patchBidMarkedHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const { marked } = req.body as { marked?: string };
    if (marked === undefined) {
      return res.status(400).json({ success: false, message: "'marked' field is required" });
    }

    const result = await patchBidMarked(bidId!, marked);
    if (!result) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    await createBidHistoryEntry({
      bidId: bidId!,
      action: "field_updated_marked",
      newValue: marked,
      description: marked === "selected" ? "Bid marked as client approved" : "Client approval cleared",
      performedBy: userId,
    });

    logger.info(`Bid ${bidId} marked field updated to "${marked}"`);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.logApiError("Error patching bid marked", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateBidHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["id"])) return;
    const id = asSingleString(req.params.id);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    // Get original bid for history tracking; client org comes from the bid
    const originalBid = await getBidById(id!);
    if (!originalBid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const clientOrgId = originalBid.organizationId;

    // Extract nested objects from request body (same as create)
    const {
      financialBreakdown,
      operatingExpenses,
      materials,
      laborAndTravel,
      surveyData,
      planSpecData,
      designBuildData,
      serviceData,
      preventativeMaintenanceData,
      documentIdsToUpdate,
      documentUpdates,
      documentIdsToDelete,
      updatedAt: clientUpdatedAt,
      ...bidFields
    } = req.body;

    // Strip auto-generated field - bidNumber is always system-generated
    delete bidFields.bidNumber;

    // Update bid with only bid fields (excluding nested objects)
    const updatedBid = await updateBid(
      id!,
      clientOrgId,
      bidFields,
      clientUpdatedAt,
    );

    if (updatedBid === STALE_DATA) {
      return res.status(409).json(staleDataResponse);
    }

    if (!updatedBid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found or failed to update",
      });
    }

    // Update related records if provided
    const updatedRecords: any = {};

    // Update financial breakdown if provided.
    // Compare incoming values with existing row before writing so we can gate
    // history logging on an actual change.
    let financialBreakdownActuallyChanged = false;
    if (financialBreakdown) {
      const existingFb = await getBidFinancialBreakdown(id!, clientOrgId);
      if (existingFb) {
        const normFb = (v: unknown): string =>
          v === null || v === undefined ? "" : String(v);
        const fbChangedKeys = Object.keys(financialBreakdown).filter((k) => {
          const incoming = (financialBreakdown as any)[k];
          const stored = (existingFb as any)[k];
          return normFb(incoming) !== normFb(stored);
        });
        financialBreakdownActuallyChanged = fbChangedKeys.length > 0;
      } else {
        financialBreakdownActuallyChanged = true;
      }
      updatedRecords.financialBreakdown = await updateBidFinancialBreakdown(
        id!,
        clientOrgId,
        financialBreakdown,
      );
    }

    // Update operating expenses if provided.
    // Before writing, compare incoming values with the existing row so we can
    // decide later whether anything genuinely changed (used for history logging).
    let operatingExpensesActuallyChanged = false;
    if (operatingExpenses) {
      const existingOpEx = await getBidOperatingExpenses(id!, clientOrgId);
      if (existingOpEx) {
        // Compare every incoming key against the stored value.
        // Normalise null / undefined / "" to "" before comparing (same logic as
        // the base-field history normaliser above).
        const normOp = (v: unknown): string =>
          v === null || v === undefined ? "" : String(v);
        const opExChangedKeys = Object.keys(operatingExpenses).filter((k) => {
          const incoming = (operatingExpenses as any)[k];
          const stored = (existingOpEx as any)[k];
          return normOp(incoming) !== normOp(stored);
        });
        operatingExpensesActuallyChanged = opExChangedKeys.length > 0;
      } else {
        // No row exists yet — creating one counts as a change
        operatingExpensesActuallyChanged = true;
      }
      updatedRecords.operatingExpenses = await updateBidOperatingExpenses(
        id!,
        clientOrgId,
        operatingExpenses,
      );
    }

    // Update materials if provided
    // Entries with an id → update only actual fields in-place (initial stays frozen)
    // Entries without an id → new material, create it (initial = actual)
    if (materials && Array.isArray(materials)) {
      updatedRecords.materials = [];
      for (const material of materials) {
        const { id: materialId, ...materialData } = material;
        if (materialId) {
          const updated = await updateBidMaterial(
            materialId,
            clientOrgId,
            materialData,
          );
          if (updated) updatedRecords.materials.push(updated);
        } else {
          const created = await createBidMaterial({
            ...materialData,
            bidId: id!,
          });
          if (created) updatedRecords.materials.push(created);
        }
      }
    }

    // Update labor and travel if provided
    // Entries with an id → update only actual fields in-place (initial stays frozen)
    // Entries without an id → new pair, create it (initial = actual)
    // Labor and travel arrays must be the same length and are paired by index.
    if (laborAndTravel) {
      const { labor, travel } = laborAndTravel;
      if (
        labor &&
        travel &&
        Array.isArray(labor) &&
        Array.isArray(travel) &&
        labor.length === travel.length
      ) {
        updatedRecords.labor = [];
        updatedRecords.travel = [];

        for (let i = 0; i < labor.length; i++) {
          const laborEntry = labor[i]!;
          const travelEntry = travel[i]!;
          const { id: laborId, ...laborData } = laborEntry;
          const { id: travelId, ...travelData } = travelEntry;

          if (laborId) {
            // Update existing labor's actual fields only
            const updatedLabor = await updateBidLabor(laborId, laborData);
            if (updatedLabor) updatedRecords.labor.push(updatedLabor);

            // Update paired travel's actual fields only
            if (travelId) {
              const updatedTravel = await updateBidTravel(travelId, travelData);
              if (updatedTravel) updatedRecords.travel.push(updatedTravel);
            } else {
              // No travel id provided — find the travel entry linked to this labor
              const linkedTravel = await getBidTravel(laborId);
              if (linkedTravel && linkedTravel.length > 0) {
                const updatedTravel = await updateBidTravel(
                  linkedTravel[0]!.id,
                  travelData,
                );
                if (updatedTravel) updatedRecords.travel.push(updatedTravel);
              }
            }
          } else {
            // New labor + travel pair — create with initial = actual
            const createdLabor = await createBidLabor({
              ...laborData,
              bidId: id!,
            });
            if (createdLabor) {
              updatedRecords.labor.push(createdLabor);
              const createdTravel = await createBidTravel({
                ...travelData,
                bidLaborId: createdLabor.id,
              });
              if (createdTravel) updatedRecords.travel.push(createdTravel);
            }
          }
        }
      }
    }

    // Update type-specific data if provided (jobType comes from original bid; it is not updated)
    const jobType = originalBid.jobType;
    if (surveyData && jobType === "survey") {
      updatedRecords.surveyData = await updateBidSurveyData(
        id!,
        clientOrgId,
        surveyData,
      );
    } else if (planSpecData && jobType === "plan_spec") {
      updatedRecords.planSpecData = await updateBidPlanSpecData(
        id!,
        clientOrgId,
        planSpecData,
      );
    } else if (designBuildData && jobType === "design_build") {
      updatedRecords.designBuildData = await updateBidDesignBuildData(
        id!,
        clientOrgId,
        designBuildData,
      );
    } else if (serviceData && jobType === "service") {
      updatedRecords.serviceData = await updateBidServiceData(
        id!,
        clientOrgId,
        serviceData,
      );
    } else if (
      preventativeMaintenanceData &&
      jobType === "preventative_maintenance"
    ) {
      updatedRecords.preventativeMaintenanceData =
        await updateBidPreventativeMaintenanceData(
          id!,
          clientOrgId,
          preventativeMaintenanceData,
        );
    }

    // Recompute financial breakdown from job-type pricing data whenever
    // job-type-specific data is present in the request.  For PM/service/survey
    // bids the server is the authoritative source for totalPrice, totalCost, and
    // grossProfit so we always overwrite rather than only backfilling zeros.
    // For general/plan_spec bids there is no job-type function so the client
    // breakdown is used as-is (already saved above via financialBreakdown block).
    const jtData =
      surveyData ??
      serviceData ??
      preventativeMaintenanceData ??
      designBuildData ??
      null;
    if (jtData) {
      // Pull direct costs from the most recent breakdown (just updated or existing).
      const currentFb =
        updatedRecords.financialBreakdown ??
        (await getBidFinancialBreakdown(id!, clientOrgId));
      const nb = (v: unknown): number => parseFloat(String(v ?? "0")) || 0;
      const directCosts = {
        materialsEquipment: nb(currentFb?.actualMaterialsEquipment),
        labor: nb(currentFb?.actualLabor),
        travel: nb(currentFb?.actualTravel),
      };
      const computed = computeJobTypeFinancials(
        jobType,
        jtData as Record<string, unknown>,
        directCosts,
      );
      if (computed) {
        updatedRecords.financialBreakdown = await updateBidFinancialBreakdown(
          id!,
          clientOrgId,
          computed,
          false,
        );
      }
    }

    // Handle document operations
    const documentUpdatesResult: any = {};

    // Handle new document uploads (document_0, document_1, etc.)
    const files = (req.files as Express.Multer.File[]) || [];
    const documentFiles = files.filter((file) =>
      file.fieldname.startsWith("document_"),
    );

    if (documentFiles.length > 0) {
      const uploadedDocuments = [];
      for (let i = 0; i < documentFiles.length; i++) {
        const file = documentFiles[i];
        if (!file) continue;

        try {
          const uploadResult = await uploadToSpaces(
            file.buffer,
            file.originalname,
            "bid-documents",
          );

          const document = await createBidDocument({
            bidId: id!,
            fileName: file.originalname,
            filePath: uploadResult.url,
            fileType: file.mimetype,
            fileSize: file.size,
            uploadedBy: performedBy,
          });

          uploadedDocuments.push(document);
        } catch (uploadError: any) {
          logger.error(
            `Error uploading document ${file.originalname}:`,
            uploadError,
          );
        }
      }

      if (uploadedDocuments.length > 0) {
        documentUpdatesResult.added = uploadedDocuments;
      }
    }

    // Handle document updates (if documentIdsToUpdate is provided)
    if (documentIdsToUpdate && Array.isArray(documentIdsToUpdate)) {
      const documentUpdatesList = documentUpdates || [];
      const updatedDocuments = [];

      for (let i = 0; i < documentIdsToUpdate.length; i++) {
        const documentId = documentIdsToUpdate[i];
        const updateData = documentUpdatesList[i] || {};

        try {
          const existingDoc = await getBidDocumentById(documentId);
          if (existingDoc && existingDoc.bidId === id!) {
            const updated = await updateBidDocument(documentId, {
              fileName: updateData.fileName,
              documentType: updateData.documentType,
            });
            if (updated) updatedDocuments.push(updated);
          }
        } catch (error: any) {
          logger.error(`Error updating document ${documentId}:`, error);
        }
      }

      if (updatedDocuments.length > 0) {
        documentUpdatesResult.updated = updatedDocuments;
      }
    }

    // Handle document deletions (if documentIdsToDelete is provided)
    if (documentIdsToDelete && Array.isArray(documentIdsToDelete)) {
      const deletedDocuments = [];

      for (const documentId of documentIdsToDelete) {
        try {
          const existingDoc = await getBidDocumentById(documentId);
          if (existingDoc && existingDoc.bidId === id!) {
            const deleted = await deleteBidDocument(documentId);
            if (deleted) deletedDocuments.push(deleted);
          }
        } catch (error: any) {
          logger.error(`Error deleting document ${documentId}:`, error);
        }
      }

      if (deletedDocuments.length > 0) {
        documentUpdatesResult.deleted = deletedDocuments;
      }
    }

    // Create history entries for changed base bid fields.
    // Normalise null / undefined / "" to a common empty sentinel so that
    // sending an empty string for a field that was NULL in the DB (or vice-versa)
    // does NOT generate a spurious history entry.
    const normalise = (v: unknown): string =>
      v === null || v === undefined ? "" : String(v);

    for (const [key, value] of Object.entries(bidFields)) {
      const oldValue = (originalBid as any)[key];
      const oldNorm = normalise(oldValue);
      const newNorm = normalise(value);

      // Skip if effectively identical
      if (oldNorm === newNorm) continue;

      await createBidHistoryEntry({
        bidId: id!,
        action: `field_updated_${key}`,
        oldValue: oldNorm,
        newValue: newNorm,
        description: `Field "${key}" was updated`,
        performedBy: performedBy,
      });
    }

    // Create history entries for nested data updates
    // Only log a history entry when something was actually changed/created,
    // not just because the client sent an empty payload.
    if (
      updatedRecords.financialBreakdown &&
      financialBreakdownActuallyChanged
    ) {
      await createBidHistoryEntry({
        bidId: id!,
        action: "financial_breakdown_updated",
        description: "Financial breakdown was updated",
        performedBy: performedBy,
      });
    }

    if (updatedRecords.operatingExpenses && operatingExpensesActuallyChanged) {
      await createBidHistoryEntry({
        bidId: id!,
        action: "operating_expenses_updated",
        description: "Operating expenses were updated",
        performedBy: performedBy,
      });
    }

    if (updatedRecords.materials && updatedRecords.materials.length > 0) {
      await createBidHistoryEntry({
        bidId: id!,
        action: "materials_updated",
        description: `Materials were updated: ${updatedRecords.materials.length} items`,
        performedBy: performedBy,
      });
    }

    if (
      (updatedRecords.labor && updatedRecords.labor.length > 0) ||
      (updatedRecords.travel && updatedRecords.travel.length > 0)
    ) {
      await createBidHistoryEntry({
        bidId: id!,
        action: "labor_travel_updated",
        description: `Labor and travel were updated: ${updatedRecords.labor?.length || 0} labor entries, ${updatedRecords.travel?.length || 0} travel entries`,
        performedBy: performedBy,
      });
    }

    if (
      updatedRecords.surveyData ||
      updatedRecords.planSpecData ||
      updatedRecords.designBuildData ||
      updatedRecords.serviceData ||
      updatedRecords.preventativeMaintenanceData
    ) {
      await createBidHistoryEntry({
        bidId: id!,
        action: "job_type_data_updated",
        description: "Job-type specific data was updated",
        performedBy: performedBy,
      });
    }

    // Create history entry for document operations
    if (Object.keys(documentUpdatesResult).length > 0) {
      await createBidHistoryEntry({
        bidId: id!,
        action: "documents_updated",
        description: `Documents updated: ${documentUpdatesResult.added?.length || 0} added, ${documentUpdatesResult.updated?.length || 0} updated, ${documentUpdatesResult.deleted?.length || 0} deleted`,
        performedBy: performedBy,
      });
    }

    logger.info("Bid updated successfully with all related records");
    return res.status(200).json({
      success: true,
      data: {
        bid: updatedBid,
        ...updatedRecords,
        ...(Object.keys(documentUpdatesResult).length > 0 && {
          documentUpdates: documentUpdatesResult,
        }),
      },
      message: "Bid updated successfully with all related records",
    });
  } catch (error: any) {
    logger.logApiError("Error updating bid", error, req);

    // Use database error parser for consistent, human-readable error messages
    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);

      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
        technicalDetails:
          process.env.NODE_ENV === "development"
            ? parsedError.technicalMessage
            : undefined,
      });
    }

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while updating the bid",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deleteBidHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["id"])) return;
    const id = asSingleString(req.params.id);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    // Get the bid first so we have its organizationId (bids.organizationId = client org, not user id)
    const existingBid = await getBidByIdSimple(id!);
    if (!existingBid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const deletedBid = await deleteBid(
      id!,
      existingBid.organizationId,
      performedBy,
    );

    if (!deletedBid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    // Soft delete all documents associated with the bid
    const documents = await getBidDocuments(id!);
    for (const document of documents) {
      try {
        await deleteBidDocument(document.id);
      } catch (error: any) {
        logger.error(`Error deleting document ${document.id}:`, error);
      }
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: id!,
      action: "bid_deleted",
      description: `Bid "${deletedBid.projectName || deletedBid.bidNumber}" was deleted`,
      performedBy: performedBy,
    });

    logger.info("Bid deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Bid deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Financial Breakdown Operations
// ============================

export const getBidFinancialBreakdownHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const breakdown = await getBidFinancialBreakdown(bidId!, clientOrgId);

    logger.info("Bid financial breakdown fetched successfully");
    return res.status(200).json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateBidFinancialBreakdownHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const breakdown = await updateBidFinancialBreakdown(
      bidId!,
      clientOrgId,
      req.body,
    );

    if (!breakdown) {
      return res.status(404).json({
        success: false,
        message: "Financial breakdown not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "financial_breakdown_updated",
      description: "Financial breakdown was updated",
      performedBy: performedBy,
    });

    logger.info("Bid financial breakdown updated successfully");
    return res.status(200).json({
      success: true,
      data: breakdown,
      message: "Financial breakdown updated successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Operating Expenses Operations
// ============================

export const getBidOperatingExpensesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const operatingExpenses = await getBidOperatingExpenses(
      bidId!,
      clientOrgId,
    );

    logger.info("Bid operating expenses fetched successfully");
    return res.status(200).json({
      success: true,
      data: operatingExpenses,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createBidOperatingExpensesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const result = await createBidOperatingExpenses(
      bidId!,
      clientOrgId,
      req.body ?? {},
    );

    if (result === null) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    if (result === "exists") {
      return res.status(409).json({
        success: false,
        message:
          "Operating expenses already exist for this bid. Use PUT to update.",
      });
    }

    await createBidHistoryEntry({
      bidId: bidId!,
      action: "operating_expenses_created",
      description: "Operating expenses were created",
      performedBy: userId,
    });

    logger.info("Bid operating expenses created successfully");
    return res.status(201).json({
      success: true,
      data: result,
      message: "Operating expenses created successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateBidOperatingExpensesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const operatingExpenses = await updateBidOperatingExpenses(
      bidId!,
      clientOrgId,
      req.body ?? {},
    );

    if (!operatingExpenses) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    await createBidHistoryEntry({
      bidId: bidId!,
      action: "operating_expenses_updated",
      description: "Operating expenses were updated",
      performedBy: userId,
    });

    logger.info("Bid operating expenses updated successfully");
    return res.status(200).json({
      success: true,
      data: operatingExpenses,
      message: "Operating expenses updated successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteBidOperatingExpensesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const operatingExpenses = await deleteBidOperatingExpenses(
      bidId!,
      clientOrgId,
    );

    if (!operatingExpenses) {
      return res.status(404).json({
        success: false,
        message: "Operating expenses not found for this bid",
      });
    }

    await createBidHistoryEntry({
      bidId: bidId!,
      action: "operating_expenses_deleted",
      description: "Operating expenses were removed",
      performedBy: userId,
    });

    logger.info("Bid operating expenses deleted successfully");
    return res.status(200).json({
      success: true,
      data: operatingExpenses,
      message: "Operating expenses deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Materials Operations
// ============================

export const getBidMaterialsHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const materials = await getBidMaterials(bidId!, clientOrgId);

    logger.info("Bid materials fetched successfully");
    return res.status(200).json({
      success: true,
      data: materials,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getBidMaterialByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId", "materialId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const materialId = asSingleString(req.params.materialId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const material = await getBidMaterialById(materialId!, clientOrgId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    // Verify material belongs to the specified bid
    if (material.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Material not found in this bid",
      });
    }

    logger.info("Bid material fetched successfully");
    return res.status(200).json({
      success: true,
      data: material,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createBidMaterialHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const materialData = {
      ...req.body,
      bidId: bidId!,
    };

    const material = await createBidMaterial(materialData);

    if (!material) {
      return res.status(500).json({
        success: false,
        message: "Failed to create material",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "material_added",
      newValue: material.description || "Material",
      description: `Material "${material.description}" was added`,
      performedBy: performedBy,
    });

    logger.info("Bid material created successfully");
    return res.status(201).json({
      success: true,
      data: material,
      message: "Material added successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateBidMaterialHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["materialId", "bidId"])) return;
    const materialId = asSingleString(req.params.materialId);
    const bidId = asSingleString(req.params.bidId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }
    const clientOrgId = bid.organizationId;

    const material = await updateBidMaterial(
      materialId!,
      clientOrgId,
      req.body,
    );

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    // Create history entry using the bid's organizationId
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "material_updated",
      description: `Material "${material.description}" was updated`,
      performedBy: performedBy,
    });

    logger.info("Bid material updated successfully");
    return res.status(200).json({
      success: true,
      data: material,
      message: "Material updated successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteBidMaterialHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["materialId", "bidId"])) return;
    const materialId = asSingleString(req.params.materialId);
    const bidId = asSingleString(req.params.bidId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }
    const clientOrgId = bid.organizationId;

    const material = await deleteBidMaterial(materialId!, clientOrgId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    // Create history entry using the bid's organizationId
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "material_deleted",
      description: `Material "${material.description}" was deleted`,
      performedBy: performedBy,
    });

    logger.info("Bid material deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Material deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Labor Operations
// ============================

export const getBidLaborHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const labor = await getBidLabor(bidId!);

    logger.info("Bid labor fetched successfully");
    return res.status(200).json({
      success: true,
      data: labor,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getBidLaborByIdHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "laborId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const laborId = asSingleString(req.params.laborId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const labor = await getBidLaborById(laborId!);

    if (!labor) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found",
      });
    }

    // Verify labor belongs to the specified bid
    if (labor.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found in this bid",
      });
    }

    logger.info("Bid labor entry fetched successfully");
    return res.status(200).json({
      success: true,
      data: labor,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createBidLaborHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const laborData = {
      ...req.body,
      bidId: bidId!,
    };

    const labor = await createBidLabor(laborData);

    if (!labor) {
      return res.status(500).json({
        success: false,
        message: "Failed to create labor entry",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "labor_added",
      newValue: `Position ID: ${labor.positionId}`,
      description: `Labor entry for position ID ${labor.positionId} was added`,
      performedBy: performedBy,
    });

    logger.info("Bid labor created successfully");
    return res.status(201).json({
      success: true,
      data: labor,
      message: "Labor added successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateBidLaborHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["laborId", "bidId"])) return;
    const laborId = asSingleString(req.params.laborId);
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const labor = await updateBidLabor(laborId!, req.body);

    if (!labor) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "labor_updated",
      description: `Labor entry for position ID ${labor?.positionId || "Unknown"} was updated`,
      performedBy: performedBy,
    });

    logger.info("Bid labor updated successfully");
    return res.status(200).json({
      success: true,
      data: labor,
      message: "Labor updated successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteBidLaborHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["laborId", "bidId"])) return;
    const laborId = asSingleString(req.params.laborId);
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const labor = await deleteBidLabor(laborId!);

    if (!labor) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "labor_deleted",
      description: `Labor entry for position ID ${labor?.positionId || "Unknown"} was deleted`,
      performedBy: performedBy,
    });

    return res.status(200).json({
      success: true,
      message: "Labor deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Travel Operations
// ============================

export const getBidTravelHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "laborId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const laborId = asSingleString(req.params.laborId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Verify labor belongs to the specified bid
    const laborEntry = await getBidLaborById(laborId!);
    if (!laborEntry) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found",
      });
    }

    if (laborEntry.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found in this bid",
      });
    }

    const travel = await getBidTravel(laborId!);

    logger.info("Bid travel fetched successfully");
    return res.status(200).json({
      success: true,
      data: travel,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getAllBidTravelHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const travel = await getAllBidTravel(bidId!);

    logger.info("All bid travel entries fetched successfully");
    return res.status(200).json({
      success: true,
      data: travel,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getBidTravelByIdHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "travelId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const travelId = asSingleString(req.params.travelId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const travel = await getBidTravelById(travelId!);

    if (!travel) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found",
      });
    }

    // Verify the travel entry belongs to the specified bid through its labor entry
    const laborEntry = await getBidLaborById(travel.bidLaborId);
    if (!laborEntry || laborEntry.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found in this bid",
      });
    }

    logger.info("Bid travel entry fetched successfully");
    return res.status(200).json({
      success: true,
      data: travel,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createBidTravelDirectHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    // Verify the labor entry exists and belongs to the bid
    const { laborId, ...travelData } = req.body;
    const laborEntry = await getBidLaborById(laborId);
    if (!laborEntry) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found",
      });
    }

    if (laborEntry.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found in this bid",
      });
    }

    const travel = await createBidTravel({
      ...travelData,
      bidLaborId: laborId,
    });

    if (!travel) {
      return res.status(500).json({
        success: false,
        message: "Failed to create travel entry",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "travel_added",
      newValue: `Travel: ${travel.roundTripMiles} miles`,
      description: "Travel entry was added",
      performedBy: performedBy,
    });

    logger.info("Bid travel created successfully");
    return res.status(201).json({
      success: true,
      data: travel,
      message: "Travel added successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateBidTravelDirectHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId", "travelId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const travelId = asSingleString(req.params.travelId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    // Verify the travel entry exists and belongs to the bid
    const existingTravel = await getBidTravelById(travelId!);
    if (!existingTravel) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found",
      });
    }

    // Verify the associated labor entry belongs to this bid
    const laborEntry = await getBidLaborById(existingTravel.bidLaborId);
    if (!laborEntry || laborEntry.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found in this bid",
      });
    }

    const travel = await updateBidTravel(travelId!, req.body);

    if (!travel) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "travel_updated",
      description: "Travel entry was updated",
      performedBy: performedBy,
    });

    logger.info("Bid travel updated successfully");
    return res.status(200).json({
      success: true,
      data: travel,
      message: "Travel updated successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteBidTravelDirectHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId", "travelId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const travelId = asSingleString(req.params.travelId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    // Verify the travel entry exists and belongs to the bid
    const existingTravel = await getBidTravelById(travelId!);
    if (!existingTravel) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found",
      });
    }

    // Verify the associated labor entry belongs to this bid
    const laborEntry = await getBidLaborById(existingTravel.bidLaborId);
    if (!laborEntry || laborEntry.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found in this bid",
      });
    }

    const deletedTravel = await deleteBidTravel(travelId!);

    if (!deletedTravel) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "travel_deleted",
      description: "Travel entry was deleted",
      performedBy: performedBy,
    });

    logger.info("Bid travel deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Travel deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createBidTravelHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "laborId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const laborId = asSingleString(req.params.laborId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    // Verify labor belongs to the specified bid
    const laborEntry = await getBidLaborById(laborId!);
    if (!laborEntry) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found",
      });
    }

    if (laborEntry.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found in this bid",
      });
    }

    const travelData = {
      ...req.body,
      bidLaborId: laborId!,
    };

    const travel = await createBidTravel(travelData);

    if (!travel) {
      return res.status(500).json({
        success: false,
        message: "Failed to create travel entry",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "travel_added",
      newValue: `Travel: ${travel.roundTripMiles} miles`,
      description: "Travel entry was added",
      performedBy: performedBy,
    });

    logger.info("Bid travel created successfully");
    return res.status(201).json({
      success: true,
      data: travel,
      message: "Travel added successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateBidTravelHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "laborId", "travelId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const laborId = asSingleString(req.params.laborId);
    const travelId = asSingleString(req.params.travelId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    // Verify labor belongs to the specified bid
    const laborEntry = await getBidLaborById(laborId!);
    if (!laborEntry) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found",
      });
    }

    if (laborEntry.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found in this bid",
      });
    }

    const travel = await updateBidTravel(travelId!, req.body);

    if (!travel) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "travel_updated",
      description: "Travel entry was updated",
      performedBy: performedBy,
    });

    logger.info("Bid travel updated successfully");
    return res.status(200).json({
      success: true,
      data: travel,
      message: "Travel updated successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteBidTravelHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "laborId", "travelId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const laborId = asSingleString(req.params.laborId);
    const travelId = asSingleString(req.params.travelId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    // Verify labor belongs to the specified bid
    const laborEntry = await getBidLaborById(laborId!);
    if (!laborEntry) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found",
      });
    }

    if (laborEntry.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found in this bid",
      });
    }

    const deletedTravel = await deleteBidTravel(travelId!);

    if (!deletedTravel) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "travel_deleted",
      description: "Travel entry was deleted",
      performedBy: performedBy,
    });

    logger.info("Bid travel deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Travel deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Bulk Labor & Travel Operations
// ============================

export const createBulkLaborAndTravelHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;
    const { labor, travel } = req.body;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    // Validate arrays have same length
    if (!Array.isArray(labor) || !Array.isArray(travel)) {
      return res.status(400).json({
        success: false,
        message: "Labor and travel must be arrays",
      });
    }

    if (labor.length !== travel.length) {
      return res.status(400).json({
        success: false,
        message: "Number of labor entries must equal number of travel entries",
      });
    }

    if (labor.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one labor and travel entry is required",
      });
    }

    const result = await createBulkLaborAndTravel(bidId!, labor, travel);

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "bulk_labor_travel_added",
      newValue: `${result.labor.length} labor entries and ${result.travel.length} travel entries`,
      description: `Bulk created ${result.labor.length} labor entries with corresponding travel entries`,
      performedBy: performedBy,
    });

    logger.info("Bulk labor and travel created successfully");
    return res.status(201).json({
      success: true,
      data: result,
      message: `Successfully created ${result.labor.length} labor entries and ${result.travel.length} travel entries`,
    });
  } catch (error: any) {
    logger.logApiError("Bid error", error, req);

    if (error.message.includes("must equal")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================
// Job-Type Specific Data Operations
// ============================

export const getBidSurveyDataHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const surveyData = await getBidSurveyData(bidId!, clientOrgId);

    logger.info("Bid survey data fetched successfully");
    return res.status(200).json({
      success: true,
      data: surveyData,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateBidSurveyDataHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const surveyData = await updateBidSurveyData(bidId!, clientOrgId, req.body);

    if (!surveyData) {
      return res.status(404).json({
        success: false,
        message: "Survey data not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "survey_data_updated",
      description: "Survey data was updated",
      performedBy: performedBy,
    });

    logger.info("Bid survey data updated successfully");
    return res.status(200).json({
      success: true,
      data: surveyData,
      message: "Survey data updated successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getBidPlanSpecDataHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const planSpecData = await getBidPlanSpecData(bidId!, clientOrgId);

    logger.info("Bid plan spec data fetched successfully");
    return res.status(200).json({
      success: true,
      data: planSpecData,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateBidPlanSpecDataHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const planSpecData = await updateBidPlanSpecData(
      bidId!,
      clientOrgId,
      req.body,
    );

    if (!planSpecData) {
      return res.status(404).json({
        success: false,
        message: "Plan & Spec data not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "plan_spec_data_updated",
      description: "Plan & Spec data was updated",
      performedBy: performedBy,
    });

    logger.info("Bid plan spec data updated successfully");
    return res.status(200).json({
      success: true,
      data: planSpecData,
      message: "Plan & Spec data updated successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getBidDesignBuildDataHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const designBuildData = await getBidDesignBuildData(bidId!, clientOrgId);

    logger.info("Bid design build data fetched successfully");
    return res.status(200).json({
      success: true,
      data: designBuildData,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateBidDesignBuildDataHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const designBuildData = await updateBidDesignBuildData(
      bidId!,
      clientOrgId,
      req.body,
    );

    if (!designBuildData) {
      return res.status(404).json({
        success: false,
        message: "Design Build data not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "design_build_data_updated",
      description: "Design Build data was updated",
      performedBy: performedBy,
    });

    logger.info("Bid design build data updated successfully");
    return res.status(200).json({
      success: true,
      data: designBuildData,
      message: "Design Build data updated successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Service Data Operations
// ============================

export const getBidServiceDataHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const serviceData = await getBidServiceData(bidId!, clientOrgId);

    logger.info("Bid service data fetched successfully");
    return res.status(200).json({
      success: true,
      data: serviceData,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateBidServiceDataHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const serviceData = await updateBidServiceData(
      bidId!,
      clientOrgId,
      req.body,
    );

    if (!serviceData) {
      return res.status(404).json({
        success: false,
        message: "Service data not found",
      });
    }

    await createBidHistoryEntry({
      bidId: bidId!,
      action: "service_data_updated",
      description: "Service data was updated",
      performedBy: performedBy,
    });

    logger.info("Bid service data updated successfully");
    return res.status(200).json({
      success: true,
      data: serviceData,
      message: "Service data updated successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Preventative Maintenance Data Operations
// ============================

export const getBidPreventativeMaintenanceDataHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const pmData = await getBidPreventativeMaintenanceData(bidId!, clientOrgId);

    logger.info("Bid preventative maintenance data fetched successfully");
    return res.status(200).json({
      success: true,
      data: pmData,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateBidPreventativeMaintenanceDataHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }
    const clientOrgId = bid.organizationId;

    const pmData = await updateBidPreventativeMaintenanceData(
      bidId!,
      clientOrgId,
      req.body,
    );

    if (!pmData) {
      return res.status(404).json({
        success: false,
        message: "Preventative Maintenance data not found",
      });
    }

    await createBidHistoryEntry({
      bidId: bidId!,
      action: "pm_data_updated",
      description: "Preventative Maintenance data was updated",
      performedBy: performedBy,
    });

    logger.info("Bid preventative maintenance data updated successfully");
    return res.status(200).json({
      success: true,
      data: pmData,
      message: "Preventative Maintenance data updated successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Timeline Operations
// ============================

export const getBidTimelineHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const wantsPagination =
      req.query.page !== undefined || req.query.limit !== undefined;

    if (!wantsPagination) {
      const timeline = await getBidTimeline(bidId!);
      logger.info("Bid timeline fetched successfully");
      return res.status(200).json({
        success: true,
        data: timeline,
      });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 9));

    const result = await getBidTimelinePaginated(bidId!, page, limit);

    logger.info("Bid timeline fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createBidTimelineEventHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const eventData = {
      ...req.body,
      bidId: bidId!,
      createdBy: performedBy,
    };

    const event = await createBidTimelineEvent(eventData);

    if (!event) {
      return res.status(500).json({
        success: false,
        message: "Failed to create timeline event",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "timeline_event_added",
      newValue: event.event || "Unknown",
      description: `Timeline event "${event.event}" was added`,
      performedBy: performedBy,
    });

    logger.info("Bid timeline event created successfully");
    return res.status(201).json({
      success: true,
      data: event,
      message: "Timeline event added successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateBidTimelineEventHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["eventId", "bidId"])) return;
    const eventId = asSingleString(req.params.eventId);
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const event = await updateBidTimelineEvent(eventId!, req.body);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Timeline event not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "timeline_event_updated",
      description: `Timeline event "${event?.event || "Unknown"}" was updated`,
      performedBy: performedBy,
    });

    logger.info("Bid timeline event updated successfully");
    return res.status(200).json({
      success: true,
      data: event,
      message: "Timeline event updated successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteBidTimelineEventHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["eventId", "bidId"])) return;
    const eventId = asSingleString(req.params.eventId);
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const event = await deleteBidTimelineEvent(eventId!);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Timeline event not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "timeline_event_deleted",
      description: `Timeline event "${event?.event || "Unknown"}" was deleted`,
      performedBy: performedBy,
    });

    logger.info("Bid timeline event deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Timeline event deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Notes Operations
// ============================

export const getBidNotesHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await getBidNotes(bidId!, page, limit);

    logger.info("Bid notes fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createBidNoteHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const noteData = {
      ...req.body,
      bidId: bidId!,
      createdBy: performedBy,
    };

    const note = await createBidNote(noteData);

    if (!note) {
      return res.status(500).json({
        success: false,
        message: "Failed to create note",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "note_added",
      description: "Note was added to bid",
      performedBy: performedBy,
    });

    logger.info("Bid note created successfully");
    return res.status(201).json({
      success: true,
      data: note,
      message: "Note added successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateBidNoteHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["noteId", "bidId"])) return;
    const noteId = asSingleString(req.params.noteId);
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const note = await updateBidNote(noteId!, req.body);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "note_updated",
      description: "Note was updated",
      performedBy: performedBy,
    });

    logger.info("Bid note updated successfully");
    return res.status(200).json({
      success: true,
      data: note,
      message: "Note updated successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteBidNoteHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["noteId", "bidId"])) return;
    const noteId = asSingleString(req.params.noteId);
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const note = await deleteBidNote(noteId!);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      action: "note_deleted",
      description: "Note was deleted",
      performedBy: performedBy,
    });

    logger.info("Bid note deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Note deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// History Operations
// ============================

export const getBidHistoryHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await getBidHistory(bidId!, page, limit);

    logger.info("Bid history fetched successfully");
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Complete Bid Data
// ============================

export const getBidWithAllDataHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["id"])) return;
    const id = asSingleString(req.params.id);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bidData = await getBidWithAllData(id!);

    if (!bidData) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    // Users with view_assigned can only view bids they are assigned to
    const bidForAccessCheck = bidData.bid as { assignedTo?: string | null };
    if (
      req.userAccessLevel === "view_assigned" &&
      bidForAccessCheck?.assignedTo !== userId
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to view this bid. You can only view bids assigned to you.",
      });
    }

    // Same format as POST create: bid fields at top level of data (no nested bid object), plus financialBreakdown, materials, labor, travel, documents, media, etc.
    const { bid, ...rest } = bidData;
    logger.info("Bid with all data fetched successfully");
    return res.status(200).json({
      success: true,
      data: {
        ...bid,
        ...rest,
      },
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getRelatedBidsHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Users with view_assigned must be assigned to the parent bid to view related bids
    if (req.userAccessLevel === "view_assigned") {
      const parentBid = await getBidByIdSimple(bidId!);
      if (!parentBid || parentBid.assignedTo !== userId) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to view this bid. You can only view bids assigned to you.",
        });
      }
    }

    const result = await getRelatedBids(bidId!);

    if (result === null) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    logger.info("Version family fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      familyRootId: result.familyRootId,
      total: result.total,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /bids/:bidId/version-info
 * Returns version metadata for a bid that is about to become a parent.
 * currentVersion is computed from versionNumber (e.g. versionNumber=2 → "V2").
 * nextVersion is the auto-computed next sequential version for a new child bid.
 */
export const getBidVersionInfoHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const info = await getBidVersionInfo(bidId!);

    if (!info) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    logger.info("Bid version info fetched successfully");
    return res.status(200).json({
      success: true,
      data: info,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Bid Documents Operations
// ============================

export const createBidDocumentsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Verify bid exists
    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    // Extract files with pattern document_0, document_1, etc.
    const files = (req.files as Express.Multer.File[]) || [];
    const documentFiles = files.filter((file) =>
      file.fieldname.startsWith("document_"),
    );

    if (documentFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No files provided. Files must be uploaded with field names like 'document_0', 'document_1', etc.",
      });
    }

    // Upload files and create document records
    const uploadedDocuments = [];
    const errors: string[] = [];

    for (let i = 0; i < documentFiles.length; i++) {
      const file = documentFiles[i];
      if (!file) continue;

      try {
        // Upload file to storage
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "bid-documents",
        );

        // Create document record
        const document = await createBidDocument({
          bidId: bidId!,
          fileName: file.originalname,
          filePath: uploadResult.url,
          fileType: file.mimetype,
          fileSize: file.size,
          uploadedBy: userId,
        });

        uploadedDocuments.push(document);
      } catch (uploadError: any) {
        logger.error(
          `Error uploading document ${file.originalname}:`,
          uploadError,
        );
        errors.push(
          `Failed to upload ${file.originalname}: ${uploadError.message || "Unknown error"}`,
        );
      }
    }

    if (uploadedDocuments.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload any documents",
        errors,
      });
    }

    logger.info(
      `Successfully uploaded ${uploadedDocuments.length} document(s) for bid ${bidId}`,
    );

    await createBidHistoryEntry({
      bidId: bidId!,
      action: "document_uploaded",
      newValue: uploadedDocuments.map((d) => d?.fileName ?? "").join(", "),
      description: `${uploadedDocuments.length} document(s) uploaded: ${uploadedDocuments.map((d) => d?.fileName ?? "").join(", ")}`,
      performedBy: userId,
    });

    return res.status(201).json({
      success: true,
      data: uploadedDocuments,
      message: `Successfully uploaded ${uploadedDocuments.length} document(s)`,
      ...(errors.length > 0 && {
        warnings: errors,
        partialSuccess: true,
      }),
    });
  } catch (error: any) {
    logger.logApiError("Error uploading bid documents", error, req);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while uploading documents",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getBidDocumentsHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;

    const bidId = asSingleString(req.params.bidId);

    // Verify bid exists
    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const rawTagIds = req.query.tagIds;
    const tagIds: string[] | undefined = Array.isArray(rawTagIds)
      ? (rawTagIds as string[]).filter((s) => typeof s === "string")
      : typeof rawTagIds === "string"
        ? rawTagIds
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const options: {
      tagIds?: string[];
      fileType?: "pdf" | "word" | "excel";
      dateRange?: "today" | "this_week" | "this_month" | "this_year";
      sortBy?: "date" | "name" | "size";
      sortOrder?: "asc" | "desc";
    } = {};

    if (tagIds?.length) options.tagIds = tagIds;
    if (req.query.fileType)
      options.fileType = req.query.fileType as "pdf" | "word" | "excel";
    if (req.query.dateRange)
      options.dateRange = req.query.dateRange as
        | "today"
        | "this_week"
        | "this_month"
        | "this_year";
    if (req.query.sortBy)
      options.sortBy = req.query.sortBy as "date" | "name" | "size";
    if (req.query.sortOrder)
      options.sortOrder = req.query.sortOrder as "asc" | "desc";

    const filterOpts = Object.keys(options).length > 0 ? options : undefined;
    const wantsPagination =
      req.query.page !== undefined || req.query.limit !== undefined;

    if (!wantsPagination) {
      const documents = await getBidDocuments(bidId!, filterOpts);
      logger.info(`Bid documents fetched successfully for bid ${bidId}`);
      return res.status(200).json({
        success: true,
        data: documents,
      });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 9));

    const result = await getBidDocumentsPaginated(
      bidId!,
      page,
      limit,
      filterOpts,
    );

    logger.info(`Bid documents fetched successfully for bid ${bidId}`);
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getBidDocumentByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId", "documentId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const documentId = asSingleString(req.params.documentId);

    // Verify bid exists
    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const document = await getBidDocumentById(documentId!);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Verify document belongs to the bid
    if (document.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    logger.info(`Bid document ${documentId} fetched successfully`);
    return res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const previewBidDocumentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId", "documentId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const documentId = asSingleString(req.params.documentId);

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const document = await getBidDocumentById(documentId!);
    if (!document || document.bidId !== bidId) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    const previewUrl = resolveStorageUrl(document.filePath);
    if (!previewUrl) {
      return res
        .status(404)
        .json({ success: false, message: "File URL not available" });
    }

    // Return preview URL with metadata so the client can render inline
    return res.status(200).json({
      success: true,
      data: {
        previewUrl,
        fileName: document.fileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
      },
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const updateBidDocumentHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "documentId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const documentId = asSingleString(req.params.documentId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Verify bid exists
    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    // Verify document exists and belongs to bid
    const existingDocument = await getBidDocumentById(documentId!);
    if (!existingDocument || existingDocument.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Handle file upload if provided
    let uploadedFileUrl: string | null = null;
    const file = req.file;
    if (file) {
      try {
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "bid-documents",
        );
        uploadedFileUrl = uploadResult.url;
      } catch (uploadError: any) {
        logger.logApiError("File upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload new document file. Please try again.",
        });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (req.body.fileName) updateData.fileName = req.body.fileName;
    if (req.body.documentType) updateData.documentType = req.body.documentType;
    if (uploadedFileUrl) {
      updateData.filePath = uploadedFileUrl;
      if (file) {
        updateData.fileName = file.originalname;
        updateData.fileType = file.mimetype;
        updateData.fileSize = file.size;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    const updatedDocument = await updateBidDocument(documentId!, updateData);

    if (!updatedDocument) {
      return res.status(404).json({
        success: false,
        message: "Document not found or failed to update",
      });
    }

    logger.info(`Bid document ${documentId} updated successfully`);

    await createBidHistoryEntry({
      bidId: bidId!,
      action: "document_updated",
      description: `Document "${updatedDocument.fileName}" was updated`,
      performedBy: userId,
    });

    return res.status(200).json({
      success: true,
      data: updatedDocument,
      message: "Document updated successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error updating bid document", error, req);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while updating the document",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deleteBidDocumentHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "documentId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const documentId = asSingleString(req.params.documentId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Verify bid exists
    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    // Verify document exists and belongs to bid
    const existingDocument = await getBidDocumentById(documentId!);
    if (!existingDocument || existingDocument.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const deletedDocument = await deleteBidDocument(documentId!);

    if (!deletedDocument) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    logger.info(`Bid document ${documentId} deleted successfully`);

    await createBidHistoryEntry({
      bidId: bidId!,
      action: "document_deleted",
      description: `Document "${existingDocument.fileName}" was deleted`,
      performedBy: userId,
    });

    return res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Bid Document / Media Tags Handlers
// ============================

export const updateDocumentTagsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId", "documentId"])) return;
    const documentId = asSingleString(req.params.documentId);
    const { tags } = (req as any).body as { tags: string[] };
    await updateDocumentTags(documentId!, tags ?? []);
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getDistinctMediaTagsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const tags = await getDistinctMediaTags(bidId!);
    return res.status(200).json({ success: true, data: tags });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateMediaTagsHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "mediaId"])) return;
    const mediaId = asSingleString(req.params.mediaId);
    const { tags } = (req as any).body as { tags: string[] };
    await updateMediaTags(mediaId!, tags ?? []);
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getDistinctWalkPhotoTagsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const tags = await getDistinctWalkPhotoTags(bidId!);
    return res.status(200).json({ success: true, data: tags });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateWalkPhotoTagsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId", "walkPhotoId"])) return;
    const walkPhotoId = asSingleString(req.params.walkPhotoId);
    const { tags } = (req as any).body as { tags: string[] };
    await updateWalkPhotoTags(walkPhotoId!, tags ?? []);
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ============================
// Bid Media Handlers
// ============================

export const createBidMediaHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Verify bid exists
    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    // Extract files with pattern media_0, media_1, etc.
    const files = (req.files as Express.Multer.File[]) || [];
    const mediaFiles = files.filter((file) =>
      file.fieldname.startsWith("media_"),
    );

    if (mediaFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No files provided. Files must be uploaded with field names like 'media_0', 'media_1', etc.",
      });
    }

    // Upload files and create media records
    const uploadedMedia = [];
    const errors: string[] = [];

    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i];
      if (!file) continue;

      try {
        // Upload file to storage
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "bid-media",
        );

        // Determine media type from MIME type
        let mediaType = "other";
        if (file.mimetype.startsWith("image/")) {
          mediaType = "photo";
        } else if (file.mimetype.startsWith("video/")) {
          mediaType = "video";
        } else if (file.mimetype.startsWith("audio/")) {
          mediaType = "audio";
        }

        const bodyTags: string[] = Array.isArray(req.body.tags)
          ? req.body.tags
          : req.body.tags
            ? [req.body.tags]
            : [];

        // Create media record
        const media = await createBidMedia({
          bidId: bidId!,
          fileName: file.originalname,
          filePath: uploadResult.filePath,
          fileUrl: uploadResult.url,
          fileType: file.mimetype,
          fileSize: file.size,
          mediaType,
          caption: req.body.caption || undefined,
          uploadedBy: userId!,
          tags: bodyTags,
        });

        uploadedMedia.push(media);
      } catch (uploadError: any) {
        logger.logApiError(
          `File upload error for ${file.originalname}`,
          uploadError,
          req,
        );
        errors.push(
          `Failed to upload ${file.originalname}: ${uploadError.message}`,
        );
      }
    }

    if (uploadedMedia.length === 0) {
      return res.status(500).json({
        success: false,
        message: "All file uploads failed",
        errors,
      });
    }

    const uploadedNames = uploadedMedia
      .map((m) => m?.fileName ?? "")
      .join(", ");
    const n = uploadedMedia.length;
    const sitePhotoUploadDesc = `${n} site photo${n === 1 ? "" : "s"} uploaded: ${uploadedNames}`;

    logger.info(`${n} site photo(s) uploaded for bid ${bidId}`);

    await createBidHistoryEntry({
      bidId: bidId!,
      action: "media_uploaded",
      newValue: uploadedNames,
      description: sitePhotoUploadDesc,
      performedBy: userId!,
    });

    await appendJobHistoryForBid(bidId!, {
      action: "media_uploaded",
      newValue: uploadedNames,
      description: sitePhotoUploadDesc,
      createdBy: userId!,
    });

    return res.status(201).json({
      success: true,
      data: uploadedMedia,
      message: `${uploadedMedia.length} file(s) uploaded successfully`,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error: unknown) {
    logger.logApiError("Bid media upload error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
    });
  }
};

export const getBidMediaHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;

    const bidId = asSingleString(req.params.bidId);

    // Verify bid exists
    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const options: {
      mediaType?: "photo" | "video" | "audio";
      dateRange?: "today" | "this_week" | "this_month" | "this_year";
      sortBy?: "date" | "name" | "size";
      sortOrder?: "asc" | "desc";
    } = {};

    if (req.query.mediaType)
      options.mediaType = req.query.mediaType as "photo" | "video" | "audio";
    if (req.query.dateRange)
      options.dateRange = req.query.dateRange as
        | "today"
        | "this_week"
        | "this_month"
        | "this_year";
    if (req.query.sortBy)
      options.sortBy = req.query.sortBy as "date" | "name" | "size";
    if (req.query.sortOrder)
      options.sortOrder = req.query.sortOrder as "asc" | "desc";

    const filterOpts = Object.keys(options).length > 0 ? options : undefined;
    const wantsPagination =
      req.query.page !== undefined || req.query.limit !== undefined;

    if (!wantsPagination) {
      const media = await getBidMedia(bidId!, filterOpts);
      logger.info(`Bid media fetched successfully for bid ${bidId}`);
      return res.status(200).json({
        success: true,
        data: media,
      });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 9));

    const result = await getBidMediaPaginated(bidId!, page, limit, filterOpts);

    logger.info(`Bid media fetched successfully for bid ${bidId}`);
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getBidMediaByIdHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "mediaId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const mediaId = asSingleString(req.params.mediaId);

    // Verify bid exists
    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const media = await getBidMediaById(mediaId!);

    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Media not found",
      });
    }

    // Verify media belongs to the bid
    if (media.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Media not found",
      });
    }

    logger.info(`Bid media ${mediaId} fetched successfully`);
    return res.status(200).json({
      success: true,
      data: media,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const previewBidMediaHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "mediaId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const mediaId = asSingleString(req.params.mediaId);

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const media = await getBidMediaById(mediaId!);
    if (!media || media.bidId !== bidId) {
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    }

    const previewUrl = resolveStorageUrl(media.fileUrl || media.filePath);
    if (!previewUrl) {
      return res
        .status(404)
        .json({ success: false, message: "File URL not available" });
    }

    // Return preview URL with metadata so the client can render inline
    return res.status(200).json({
      success: true,
      data: {
        previewUrl,
        fileName: media.fileName,
        fileType: media.fileType,
        mediaType: media.mediaType,
        fileSize: media.fileSize,
      },
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const downloadBidDocumentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId", "documentId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const documentId = asSingleString(req.params.documentId);

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const document = await getBidDocumentById(documentId!);
    if (!document || document.bidId !== bidId) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    const downloadUrl = resolveStorageUrl(document.filePath);
    if (!downloadUrl) {
      return res
        .status(404)
        .json({ success: false, message: "File URL not available" });
    }

    const upstream = await globalThis.fetch(downloadUrl);
    if (!upstream.ok) {
      return res.status(502).json({
        success: false,
        message: "Failed to fetch file from storage",
      });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = (document.fileName || "document-file").replace(/"/g, "");

    res.setHeader(
      "Content-Type",
      document.fileType || "application/octet-stream",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    return res.status(200).send(buffer);
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const downloadBidMediaHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "mediaId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const mediaId = asSingleString(req.params.mediaId);

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const media = await getBidMediaById(mediaId!);
    if (!media || media.bidId !== bidId) {
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    }

    const downloadUrl = resolveStorageUrl(media.fileUrl || media.filePath);
    if (!downloadUrl) {
      return res
        .status(404)
        .json({ success: false, message: "File URL not available" });
    }

    const upstream = await globalThis.fetch(downloadUrl);
    if (!upstream.ok) {
      return res.status(502).json({
        success: false,
        message: "Failed to fetch file from storage",
      });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = (media.fileName || "media-file").replace(/"/g, "");

    res.setHeader("Content-Type", media.fileType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    return res.status(200).send(buffer);
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const updateBidMediaHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "mediaId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const mediaId = asSingleString(req.params.mediaId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Verify bid exists
    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    // Verify media exists and belongs to bid
    const existingMedia = await getBidMediaById(mediaId!);
    if (!existingMedia || existingMedia.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Media not found",
      });
    }

    // Handle file upload if provided
    let uploadedFileUrl: string | null = null;
    const file = req.file;
    if (file) {
      try {
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "bid-media",
        );
        uploadedFileUrl = uploadResult.url;
      } catch (uploadError: any) {
        logger.logApiError("File upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload new site photo. Please try again.",
        });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (req.body.fileName) updateData.fileName = req.body.fileName;
    if (req.body.mediaType) updateData.mediaType = req.body.mediaType;
    if (req.body.caption) updateData.caption = req.body.caption;
    if (uploadedFileUrl) {
      updateData.fileUrl = uploadedFileUrl;
      updateData.filePath = uploadedFileUrl; // Assuming filePath stores the same URL
    }

    const updatedMedia = await updateBidMedia(mediaId!, updateData);

    if (!updatedMedia) {
      return res.status(404).json({
        success: false,
        message: "Site photo not found",
      });
    }

    logger.info(`Bid site photo ${mediaId} updated successfully`);

    await createBidHistoryEntry({
      bidId: bidId!,
      action: "media_updated",
      description: `Site photo "${updatedMedia.fileName}" was updated`,
      performedBy: userId,
    });

    await appendJobHistoryForBid(bidId!, {
      action: "media_updated",
      description: `Site photo "${updatedMedia.fileName}" was updated`,
      createdBy: userId,
    });

    return res.status(200).json({
      success: true,
      data: updatedMedia,
      message: "Site photo updated successfully",
    });
  } catch (error: unknown) {
    logger.logApiError("Bid media update error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
    });
  }
};

export const deleteBidMediaHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "mediaId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const mediaId = asSingleString(req.params.mediaId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Verify bid exists
    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    // Verify media exists and belongs to bid
    const existingMedia = await getBidMediaById(mediaId!);
    if (!existingMedia || existingMedia.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Site photo not found",
      });
    }

    const deletedMedia = await deleteBidMedia(mediaId!);

    if (!deletedMedia) {
      return res.status(404).json({
        success: false,
        message: "Site photo not found",
      });
    }

    logger.info(`Bid site photo ${mediaId} deleted successfully`);

    await createBidHistoryEntry({
      bidId: bidId!,
      action: "media_deleted",
      description: `Site photo "${existingMedia.fileName}" was deleted`,
      performedBy: userId,
    });

    await appendJobHistoryForBid(bidId!, {
      action: "media_deleted",
      description: `Site photo "${existingMedia.fileName}" was deleted`,
      createdBy: userId,
    });

    return res.status(200).json({
      success: true,
      message: "Site photo deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Bid Walk Photos Handlers
// ============================

export const createBidWalkPhotosHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    const mediaFiles = files.filter((file) =>
      file.fieldname.startsWith("media_"),
    );

    if (mediaFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No files provided. Files must be uploaded with field names like 'media_0', 'media_1', etc.",
      });
    }

    const uploaded: Awaited<ReturnType<typeof createBidWalkPhoto>>[] = [];
    const errors: string[] = [];

    for (const file of mediaFiles) {
      if (!file) continue;
      try {
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "bid-walk-photos",
        );

        let mediaType = "other";
        if (file.mimetype.startsWith("image/")) {
          mediaType = "photo";
        } else if (file.mimetype.startsWith("video/")) {
          mediaType = "video";
        } else if (file.mimetype.startsWith("audio/")) {
          mediaType = "audio";
        }

        const walkTags: string[] = Array.isArray(req.body.tags)
          ? req.body.tags
          : req.body.tags
            ? [req.body.tags]
            : [];

        const row = await createBidWalkPhoto({
          bidId: bidId!,
          fileName: file.originalname,
          filePath: uploadResult.filePath,
          fileUrl: uploadResult.url,
          fileType: file.mimetype,
          fileSize: file.size,
          mediaType,
          caption: req.body.caption || undefined,
          uploadedBy: userId!,
          tags: walkTags,
        });
        if (row) uploaded.push(row);
      } catch (uploadError: any) {
        logger.logApiError(
          `Bid walk photo upload error for ${file.originalname}`,
          uploadError,
          req,
        );
        errors.push(
          `Failed to upload ${file.originalname}: ${uploadError.message}`,
        );
      }
    }

    if (uploaded.length === 0) {
      return res.status(500).json({
        success: false,
        message: "All file uploads failed",
        errors,
      });
    }

    const uploadedNames = uploaded.map((m) => m?.fileName ?? "").join(", ");
    const n = uploaded.length;
    const desc = `${n} bid walk photo${n === 1 ? "" : "s"} uploaded: ${uploadedNames}`;

    await createBidHistoryEntry({
      bidId: bidId!,
      action: "walk_photo_uploaded",
      newValue: uploadedNames,
      description: desc,
      performedBy: userId!,
    });

    await appendJobHistoryForBid(bidId!, {
      action: "walk_photo_uploaded",
      newValue: uploadedNames,
      description: desc,
      createdBy: userId!,
    });

    return res.status(201).json({
      success: true,
      data: uploaded,
      message: `${uploaded.length} file(s) uploaded successfully`,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error: unknown) {
    logger.logApiError("Bid walk photos upload error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getBidWalkPhotosHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;

    const bidId = asSingleString(req.params.bidId);

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const options: Parameters<typeof getBidWalkPhotos>[1] = {};
    if (req.query.mediaType)
      options.mediaType = req.query.mediaType as "photo" | "video" | "audio";
    if (req.query.dateRange)
      options.dateRange = req.query.dateRange as
        | "today"
        | "this_week"
        | "this_month"
        | "this_year";
    if (req.query.sortBy)
      options.sortBy = req.query.sortBy as "date" | "name" | "size";
    if (req.query.sortOrder)
      options.sortOrder = req.query.sortOrder as "asc" | "desc";

    const filterOpts = Object.keys(options).length > 0 ? options : undefined;
    const wantsPagination =
      req.query.page !== undefined || req.query.limit !== undefined;

    if (!wantsPagination) {
      const data = await getBidWalkPhotos(bidId!, filterOpts);
      return res.status(200).json({ success: true, data });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 9));

    const result = await getBidWalkPhotosPaginated(
      bidId!,
      page,
      limit,
      filterOpts,
    );

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getBidWalkPhotoByIdHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "walkPhotoId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const walkPhotoId = asSingleString(req.params.walkPhotoId);

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const photo = await getBidWalkPhotoById(walkPhotoId!);
    if (!photo || photo.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Walk photo not found",
      });
    }

    return res.status(200).json({ success: true, data: photo });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const previewBidWalkPhotoHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "walkPhotoId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const walkPhotoId = asSingleString(req.params.walkPhotoId);

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const photo = await getBidWalkPhotoById(walkPhotoId!);
    if (!photo || photo.bidId !== bidId) {
      return res
        .status(404)
        .json({ success: false, message: "Walk photo not found" });
    }

    const previewUrl = resolveStorageUrl(photo.fileUrl || photo.filePath);
    if (!previewUrl) {
      return res
        .status(404)
        .json({ success: false, message: "File URL not available" });
    }

    return res.status(200).json({
      success: true,
      data: {
        previewUrl,
        fileName: photo.fileName,
        fileType: photo.fileType,
        mediaType: photo.mediaType,
        fileSize: photo.fileSize,
      },
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const downloadBidWalkPhotoHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "walkPhotoId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const walkPhotoId = asSingleString(req.params.walkPhotoId);

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({ success: false, message: "Bid not found" });
    }

    const photo = await getBidWalkPhotoById(walkPhotoId!);
    if (!photo || photo.bidId !== bidId) {
      return res
        .status(404)
        .json({ success: false, message: "Walk photo not found" });
    }

    const downloadUrl = resolveStorageUrl(photo.fileUrl || photo.filePath);
    if (!downloadUrl) {
      return res
        .status(404)
        .json({ success: false, message: "File URL not available" });
    }

    const upstream = await globalThis.fetch(downloadUrl);
    if (!upstream.ok) {
      return res.status(502).json({
        success: false,
        message: "Failed to fetch file from storage",
      });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = (photo.fileName || "walk-photo").replace(/"/g, "");

    res.setHeader("Content-Type", photo.fileType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    return res.status(200).send(buffer);
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const updateBidWalkPhotoHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "walkPhotoId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const walkPhotoId = asSingleString(req.params.walkPhotoId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const existing = await getBidWalkPhotoById(walkPhotoId!);
    if (!existing || existing.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Walk photo not found",
      });
    }

    let uploadedFileUrl: string | null = null;
    const file = req.file;
    if (file) {
      try {
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "bid-walk-photos",
        );
        uploadedFileUrl = uploadResult.url;
      } catch (uploadError: any) {
        logger.logApiError("File upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload new walk photo. Please try again.",
        });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (req.body.fileName) updateData.fileName = req.body.fileName;
    if (req.body.mediaType) updateData.mediaType = req.body.mediaType;
    if (req.body.caption) updateData.caption = req.body.caption;
    if (uploadedFileUrl) {
      updateData.fileUrl = uploadedFileUrl;
      updateData.filePath = uploadedFileUrl;
    }

    const updated = await updateBidWalkPhoto(walkPhotoId!, updateData as any);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Walk photo not found",
      });
    }

    await createBidHistoryEntry({
      bidId: bidId!,
      action: "walk_photo_updated",
      description: `Bid walk photo "${updated.fileName}" was updated`,
      performedBy: userId,
    });

    await appendJobHistoryForBid(bidId!, {
      action: "walk_photo_updated",
      description: `Bid walk photo "${updated.fileName}" was updated`,
      createdBy: userId,
    });

    return res.status(200).json({
      success: true,
      data: updated,
      message: "Walk photo updated successfully",
    });
  } catch (error: unknown) {
    logger.logApiError("Bid walk photo update error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteBidWalkPhotoHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "walkPhotoId"])) return;

    const bidId = asSingleString(req.params.bidId);
    const walkPhotoId = asSingleString(req.params.walkPhotoId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const existing = await getBidWalkPhotoById(walkPhotoId!);
    if (!existing || existing.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Walk photo not found",
      });
    }

    const deleted = await deleteBidWalkPhoto(walkPhotoId!);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Walk photo not found",
      });
    }

    await createBidHistoryEntry({
      bidId: bidId!,
      action: "walk_photo_deleted",
      description: `Bid walk photo "${existing.fileName}" was deleted`,
      performedBy: userId,
    });

    await appendJobHistoryForBid(bidId!, {
      action: "walk_photo_deleted",
      description: `Bid walk photo "${existing.fileName}" was deleted`,
      createdBy: userId,
    });

    return res.status(200).json({
      success: true,
      message: "Walk photo deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/** Financial + job-type rows for quote PDF (includes secondary service/PM when bid mixes types). */
async function loadQuotePdfTypeData(
  bidId: string,
  organizationId: string,
  jobType: string | null | undefined,
) {
  const jt = jobType ?? "general";
  const primaryLoader = () => {
    switch (jt) {
      case "survey":
        return getBidSurveyData(bidId, organizationId);
      case "plan_spec":
        return getBidPlanSpecData(bidId, organizationId);
      case "design_build":
        return getBidDesignBuildData(bidId, organizationId);
      case "service":
        return getBidServiceData(bidId, organizationId);
      case "preventative_maintenance":
        return getBidPreventativeMaintenanceData(bidId, organizationId);
      default:
        return Promise.resolve(null);
    }
  };
  const loadSecondaryService =
    jt !== "service"
      ? getBidServiceData(bidId, organizationId)
      : Promise.resolve(null);
  const loadSecondaryPm =
    jt !== "preventative_maintenance"
      ? getBidPreventativeMaintenanceData(bidId, organizationId)
      : Promise.resolve(null);

  const [financialBreakdown, typeSpecificData, secondaryService, secondaryPm] =
    await Promise.all([
      getBidFinancialBreakdown(bidId, organizationId),
      primaryLoader(),
      loadSecondaryService,
      loadSecondaryPm,
    ]);

  return {
    financialBreakdown,
    typeSpecificData,
    typeSpecificSecondary: {
      serviceData: secondaryService,
      pmData: secondaryPm,
    },
  };
}

/**
 * Download quote (bid) as PDF
 * GET /bids/:id/pdf
 */
export const downloadBidQuotePDF = async (req: Request, res: Response) => {
  try {
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Bid ID is required",
      });
    }

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidById(id);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const organizationId = bid.organizationId;
    const client = await getOrganizationById(organizationId);
    if (!client?.organization) {
      return res.status(500).json({
        success: false,
        message: "Client organization not found",
      });
    }

    const { financialBreakdown, typeSpecificData, typeSpecificSecondary } =
      await loadQuotePdfTypeData(id, organizationId, bid.jobType);

    const quoteIssuerOpts = await quotePdfIssuerOptions();

    // Use bid's primary contact if available, else fall back to organization's primary contact
    const contactForQuote =
      bid.primaryContact ??
      (client.organization.primaryContact && client.organization.email
        ? {
            fullName: client.organization.primaryContact,
            email: client.organization.email,
          }
        : null);

    const pdfData = prepareQuoteDataForPDF(
      bid,
      client.organization,
      financialBreakdown,
      contactForQuote,
      bid.property ?? null,
      quoteIssuerOpts,
      typeSpecificData,
      typeSpecificSecondary,
    );

    const pdfBuffer = await generateQuotePDF(pdfData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="quote-${bid.bidNumber}.pdf"`,
    );
    res.setHeader("Content-Length", String(pdfBuffer.length));

    logger.info(`Quote PDF downloaded for bid: ${id}`);

    await createBidHistoryEntry({
      bidId: id,
      action: "quote_pdf_downloaded",
      description: `Quote PDF downloaded (bid #${bid.bidNumber})`,
      performedBy: userId,
    });

    res.send(pdfBuffer);
  } catch (error: any) {
    logger.logApiError("Error generating quote PDF", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to generate quote PDF",
      error: error.message,
    });
  }
};

/**
 * Preview quote (bid) PDF (inline display)
 * GET /bids/:id/pdf/preview
 */
export const previewBidQuotePDF = async (req: Request, res: Response) => {
  try {
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Bid ID is required",
      });
    }

    const bid = await getBidById(id);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const organizationId = bid.organizationId;
    const client = await getOrganizationById(organizationId);
    if (!client?.organization) {
      return res.status(500).json({
        success: false,
        message: "Client organization not found",
      });
    }

    const { financialBreakdown, typeSpecificData, typeSpecificSecondary } =
      await loadQuotePdfTypeData(id, organizationId, bid.jobType);

    const quoteIssuerOpts = await quotePdfIssuerOptions();

    // Use bid's primary contact if available, else fall back to organization's primary contact
    const contactForQuote =
      bid.primaryContact ??
      (client.organization.primaryContact && client.organization.email
        ? {
            fullName: client.organization.primaryContact,
            email: client.organization.email,
          }
        : null);

    const pdfData = prepareQuoteDataForPDF(
      bid,
      client.organization,
      financialBreakdown,
      contactForQuote,
      bid.property ?? null,
      quoteIssuerOpts,
      typeSpecificData,
      typeSpecificSecondary,
    );

    const pdfBuffer = await generateQuotePDF(pdfData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="quote-${bid.bidNumber}.pdf"`,
    );
    res.setHeader("Content-Length", String(pdfBuffer.length));

    logger.info(`Quote PDF previewed for bid: ${id}`);
    res.send(pdfBuffer);
  } catch (error: any) {
    logger.logApiError("Error previewing quote PDF", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to preview quote PDF",
      error: error.message,
    });
  }
};

/**
 * Send quote (bid) to client via email
 * POST /bids/:id/send
 */
export const sendQuoteEmail = async (req: Request, res: Response) => {
  try {
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Bid ID is required",
      });
    }

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidById(id);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const organizationId = bid.organizationId;
    const client = await getOrganizationById(organizationId);
    if (!client?.organization) {
      return res.status(500).json({
        success: false,
        message: "Client organization not found",
      });
    }

    // Collect all email recipients: bid's primary contact + org email
    const allRecipients: { fullName?: string | null; email: string }[] = [];

    if (bid.primaryContact?.email) {
      allRecipients.push({
        fullName: bid.primaryContact.fullName,
        email: bid.primaryContact.email,
      });
    }

    if (client.organization.email) {
      const orgEmail = client.organization.email;
      const alreadyAdded = allRecipients.some(
        (r) => r.email.toLowerCase() === orgEmail.toLowerCase(),
      );
      if (!alreadyAdded) {
        allRecipients.push({
          fullName:
            client.organization.primaryContact ??
            client.organization.name ??
            orgEmail,
          email: orgEmail,
        });
      }
    }

    if (allRecipients.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No email recipients found for this bid. Please set a primary contact or ensure the organization has an email address.",
      });
    }

    // Use the first recipient for PDF personalization (length guard above ensures it exists)
    const primaryContact = allRecipients[0]!;
    const ccEmails = allRecipients.slice(1).map((r) => r.email);

    const { financialBreakdown, typeSpecificData, typeSpecificSecondary } =
      await loadQuotePdfTypeData(id, organizationId, bid.jobType);

    const quoteIssuerOpts = await quotePdfIssuerOptions();

    const pdfData = prepareQuoteDataForPDF(
      bid,
      client.organization,
      financialBreakdown,
      primaryContact ?? null,
      bid.property ?? null,
      quoteIssuerOpts,
      typeSpecificData,
      typeSpecificSecondary,
    );

    const pdfBuffer = await generateQuotePDF(pdfData);

    const { subject, message } = req.body as {
      subject?: string;
      message?: string;
    };

    await sendQuoteEmailService(
      primaryContact.email,
      subject || `Quote ${bid.bidNumber} from T3 Mechanical`,
      message,
      {
        content: Buffer.from(pdfBuffer),
        filename: `quote-${bid.bidNumber}.pdf`,
      },
      ccEmails.length > 0 ? ccEmails : undefined,
    );

    const sentTo = allRecipients.map((r) => r.email).join(", ");
    logger.info(`Quote ${id} sent successfully to ${sentTo}`);

    await createBidHistoryEntry({
      bidId: id,
      action: "quote_sent_to_client",
      newValue: sentTo,
      description: `Quote emailed to: ${sentTo}`,
      performedBy: userId,
    });

    res.json({
      success: true,
      data: {
        sentAt: new Date().toISOString(),
        sentTo: primaryContact.email,
        ccTo: ccEmails.length > 0 ? ccEmails : undefined,
        contactName: primaryContact.fullName ?? primaryContact.email,
        note:
          ccEmails.length > 0
            ? `Quote email sent to primary contact and CC'd to ${ccEmails.join(", ")}`
            : "Quote email sent to primary contact",
      },
      message: "Quote sent successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error sending quote", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to send quote",
      error: error.message,
    });
  }
};

const TEST_QUOTE_EMAIL = "pritam.thapa@quixta.in";

/**
 * Send quote via email to test address (pritam.thapa@quixta.in). Does not send to client.
 * POST /bids/:id/send-test
 */
export const sendQuoteEmailTest = async (req: Request, res: Response) => {
  try {
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Bid ID is required",
      });
    }

    const bid = await getBidById(id);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const organizationId = bid.organizationId;
    const client = await getOrganizationById(organizationId);
    if (!client?.organization) {
      return res.status(500).json({
        success: false,
        message: "Client organization not found for this bid",
      });
    }

    const { financialBreakdown, typeSpecificData, typeSpecificSecondary } =
      await loadQuotePdfTypeData(id, organizationId, bid.jobType);

    const quoteIssuerOpts = await quotePdfIssuerOptions();

    // Use bid's primary contact if available, else fall back to organization's primary contact
    const primaryContact =
      bid.primaryContact ??
      (client.organization.primaryContact && client.organization.email
        ? {
            fullName: client.organization.primaryContact,
            email: client.organization.email,
          }
        : null);

    const pdfData = prepareQuoteDataForPDF(
      bid,
      client.organization,
      financialBreakdown,
      primaryContact,
      bid.property ?? null,
      quoteIssuerOpts,
      typeSpecificData,
      typeSpecificSecondary,
    );

    let pdfAttachment: { content: Buffer; filename: string } | undefined;
    let pdfError: string | undefined;
    try {
      const pdfBuffer = await generateQuotePDF(pdfData);
      pdfAttachment = {
        content: Buffer.from(pdfBuffer),
        filename: `quote-${bid.bidNumber}.pdf`,
      };
    } catch (err: any) {
      pdfError = err?.message ?? String(err);
      logger.warn(`Send-test quote: Failed to generate PDF: ${pdfError}`, {
        stack: err?.stack,
      });
    }

    const body = req.body as { subject?: string; message?: string } | undefined;
    const subject =
      body?.subject ?? `[TEST] Quote ${bid.bidNumber} from T3 Mechanical`;
    const message = body?.message;

    await sendQuoteEmailService(
      TEST_QUOTE_EMAIL,
      subject,
      message,
      pdfAttachment,
    );

    logger.info(`Quote ${id} test sent to ${TEST_QUOTE_EMAIL}`);
    res.json({
      success: true,
      data: {
        sentAt: new Date().toISOString(),
        sentTo: TEST_QUOTE_EMAIL,
        pdfAttached: !!pdfAttachment,
        ...(pdfError && { pdfError }),
        note: "Test quote email sent. Client was not emailed.",
      },
      message: "Test quote email sent successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error sending test quote", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to send test quote",
      error: error.message,
    });
  }
};

// ============================
// Bids KPIs Handler
// ============================

export const getBidsKPIsHandler = async (req: Request, res: Response) => {
  try {
    // Validate user access
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const kpis = await getBidsKPIs();

    res.json({
      success: true,
      data: kpis,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching bids KPIs", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bids KPIs",
      error: error.message,
    });
  }
};

/**
 * Get KPIs for a specific bid
 * GET /bids/:bidId/kpis
 */
export const getBidKPIsHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);

    // Validate user access
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const kpis = await getBidKPIs(bidId!);

    if (!kpis) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    logger.info("Bid KPIs fetched successfully", { bidId });
    res.json({
      success: true,
      data: kpis,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching bid KPIs", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bid KPIs",
      error: error.message,
    });
  }
};

// ===========================================================================
// Bulk Delete
// ===========================================================================

export const bulkDeleteBidsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res
        .status(403)
        .json({ success: false, message: "Authentication required" });

    const { ids } = req.body as { ids: string[] };
    const result = await bulkDeleteBids(ids, userId);

    logger.info(`Bulk deleted ${result.deleted} bids by ${userId}`);
    return res.status(200).json({
      success: true,
      message: `${result.deleted} bid(s) deleted. ${result.skipped} skipped (already deleted or not found).`,
      data: result,
    });
  } catch (error) {
    logger.logApiError("Bulk delete bids error", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ============================
// Plan Spec Files Operations
// ============================

export const getBidPlanSpecFilesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const files = await getBidPlanSpecFiles(bidId!);
    return res.status(200).json({ success: true, data: files });
  } catch (error) {
    logger.logApiError("Bid plan spec files error", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const createBidPlanSpecFilesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid)
      return res.status(404).json({ success: false, message: "Bid not found" });

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No files provided" });
    }

    const uploadedFiles = [];
    for (const file of files) {
      try {
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "bid-plan-spec-files",
        );
        const fileType =
          req.body.fileType ||
          (file.fieldname.includes("spec") ? "spec" : "plan");
        const created = await createBidPlanSpecFile({
          organizationId: bid.organizationId,
          bidId: bidId!,
          fileType,
          fileName: file.originalname,
          filePath: uploadResult.url,
          fileSize: file.size,
          uploadedBy: userId,
        });
        if (created) uploadedFiles.push(created);
      } catch (uploadError: any) {
        logger.error(
          `Error uploading plan spec file ${file.originalname}:`,
          uploadError,
        );
      }
    }

    if (uploadedFiles.length > 0) {
      await createBidHistoryEntry({
        bidId: bidId!,
        action: "plan_spec_file_uploaded",
        newValue: uploadedFiles.map((f) => f.fileName).join(", "),
        description: `${uploadedFiles.length} plan/spec file(s) uploaded: ${uploadedFiles.map((f) => f.fileName).join(", ")}`,
        performedBy: userId,
      });
    }

    return res.status(201).json({
      success: true,
      data: uploadedFiles,
      message: "Plan spec files uploaded successfully",
    });
  } catch (error) {
    logger.logApiError("Bid plan spec files upload error", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const deleteBidPlanSpecFileHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId", "fileId"])) return;
    const fileId = asSingleString(req.params.fileId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const deleted = await deleteBidPlanSpecFile(fileId!);
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "File not found" });

    await createBidHistoryEntry({
      bidId: deleted.bidId,
      action: "plan_spec_file_deleted",
      description: `Plan/spec file "${deleted.fileName}" was deleted`,
      performedBy: userId,
    });

    return res
      .status(200)
      .json({ success: true, message: "Plan spec file deleted successfully" });
  } catch (error) {
    logger.logApiError("Bid plan spec file delete error", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ============================
// Design Build Files Operations
// ============================

export const getBidDesignBuildFilesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const files = await getBidDesignBuildFiles(bidId!);
    return res.status(200).json({ success: true, data: files });
  } catch (error) {
    logger.logApiError("Bid design build files error", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const createBidDesignBuildFilesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidByIdSimple(bidId!);
    if (!bid)
      return res.status(404).json({ success: false, message: "Bid not found" });

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No files provided" });
    }

    const uploadedFiles = [];
    for (const file of files) {
      try {
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "bid-design-build-files",
        );
        const created = await createBidDesignBuildFile({
          organizationId: bid.organizationId,
          bidId: bidId!,
          fileName: file.originalname,
          filePath: uploadResult.url,
          fileSize: file.size,
          uploadedBy: userId,
        });
        if (created) uploadedFiles.push(created);
      } catch (uploadError: any) {
        logger.error(
          `Error uploading design build file ${file.originalname}:`,
          uploadError,
        );
      }
    }

    if (uploadedFiles.length > 0) {
      await createBidHistoryEntry({
        bidId: bidId!,
        action: "design_build_file_uploaded",
        newValue: uploadedFiles.map((f) => f.fileName).join(", "),
        description: `${uploadedFiles.length} design build file(s) uploaded: ${uploadedFiles.map((f) => f.fileName).join(", ")}`,
        performedBy: userId,
      });
    }

    return res.status(201).json({
      success: true,
      data: uploadedFiles,
      message: "Design build files uploaded successfully",
    });
  } catch (error) {
    logger.logApiError("Bid design build files upload error", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const deleteBidDesignBuildFileHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId", "fileId"])) return;
    const fileId = asSingleString(req.params.fileId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const deleted = await deleteBidDesignBuildFile(fileId!);
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "File not found" });

    await createBidHistoryEntry({
      bidId: deleted.bidId,
      action: "design_build_file_deleted",
      description: `Design build file "${deleted.fileName}" was deleted`,
      performedBy: userId,
    });

    return res.status(200).json({
      success: true,
      message: "Design build file deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Bid design build file delete error", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
