import type { Request, Response } from "express";
import { asSingleString } from "../utils/request-helpers.js";
import { getDataFilterConditions } from "../services/featurePermission.service.js";

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
import { uploadToSpaces } from "../services/storage.service.js";
import { getUserRoles } from "../services/role.service.js";
import {
  getBids,
  getBidById,
  getBidByIdSimple,
  createBid,
  updateBid,
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
  getBidOperatingExpenses,
  createBidOperatingExpenses,
  updateBidOperatingExpenses,
  deleteBidOperatingExpenses,
  getBidTimeline,
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
  getRelatedBids,
  createBidDocument,
  getBidDocuments,
  getBidDocumentById,
  updateBidDocument,
  getBidsKPIs,
  getBidKPIs,
  deleteBidDocument,
  getBidDocumentTags,
  getBidDocumentTagById,
  createBidDocumentTag,
  updateBidDocumentTag,
  deleteBidDocumentTag,
  getDocumentTags,
  linkDocumentTag,
  unlinkDocumentTag,
  createBidMedia,
  getBidMedia,
  getBidMediaById,
  updateBidMedia,
  deleteBidMedia,
} from "../services/bid.service.js";
import { getOrganizationById } from "../services/client.service.js";
import {
  prepareQuoteDataForPDF,
  generateQuotePDF,
} from "../services/pdf.service.js";
import { sendQuoteEmail as sendQuoteEmailService } from "../services/email.service.js";

// ============================
// Main Bid Operations
// ============================

export const getBidsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    // Validate user access (user data, not org)
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Optional filter: client organizationId from query (client data, not user)
    // If not provided, returns all bids
    const organizationId = req.query.organizationId as string | undefined;

    const offset = (page - 1) * limit;

    const filters: {
      status?: string;
      jobType?: string;
      priority?: string;
      assignedTo?: string;
      search?: string;
    } = {};

    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.jobType) filters.jobType = req.query.jobType as string;
    if (req.query.priority) filters.priority = req.query.priority as string;
    if (req.query.assignedTo)
      filters.assignedTo = req.query.assignedTo as string;
    if (req.query.search) filters.search = req.query.search as string;

    const dataFilter = await getDataFilterConditions(userId, "bids");
    const bidOptions = dataFilter.assignedOnly
      ? { userId, applyAssignedOrTeamFilter: true }
      : undefined;

    const bids = await getBids(
      organizationId,
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

    // Create history entry
    await createBidHistoryEntry({
      bidId: bid.id,
      organizationId: organizationId,
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
      documentIdsToUpdate,
      documentUpdates,
      documentIdsToDelete,
      ...bidFields
    } = req.body;

    // Strip auto-generated field - bidNumber is always system-generated
    delete bidFields.bidNumber;

    // Update bid with only bid fields (excluding nested objects)
    const updatedBid = await updateBid(id!, clientOrgId, bidFields);

    if (!updatedBid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found or failed to update",
      });
    }

    // Update related records if provided
    const updatedRecords: any = {};

    // Update financial breakdown if provided
    if (financialBreakdown) {
      updatedRecords.financialBreakdown = await updateBidFinancialBreakdown(
        id!,
        clientOrgId,
        financialBreakdown,
      );
    }

    // Update operating expenses if provided
    if (operatingExpenses) {
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

    // Create history entries for changed base bid fields
    for (const [key, value] of Object.entries(bidFields)) {
      const oldValue = (originalBid as any)[key];
      if (oldValue !== value) {
        await createBidHistoryEntry({
          bidId: id!,
          organizationId: clientOrgId,
          action: `field_updated_${key}`,
          oldValue: String(oldValue || ""),
          newValue: String(value || ""),
          description: `Field "${key}" was updated`,
          performedBy: performedBy,
        });
      }
    }

    // Create history entries for nested data updates
    if (financialBreakdown) {
      await createBidHistoryEntry({
        bidId: id!,
        organizationId: clientOrgId,
        action: "financial_breakdown_updated",
        description: "Financial breakdown was updated",
        performedBy: performedBy,
      });
    }

    if (operatingExpenses) {
      await createBidHistoryEntry({
        bidId: id!,
        organizationId: clientOrgId,
        action: "operating_expenses_updated",
        description: "Operating expenses were updated",
        performedBy: performedBy,
      });
    }

    if (materials) {
      await createBidHistoryEntry({
        bidId: id!,
        organizationId: clientOrgId,
        action: "materials_updated",
        description: `Materials were updated: ${materials.length} items`,
        performedBy: performedBy,
      });
    }

    if (laborAndTravel) {
      await createBidHistoryEntry({
        bidId: id!,
        organizationId: clientOrgId,
        action: "labor_travel_updated",
        description: `Labor and travel were updated: ${laborAndTravel.labor?.length || 0} labor entries, ${laborAndTravel.travel?.length || 0} travel entries`,
        performedBy: performedBy,
      });
    }

    if (surveyData || planSpecData || designBuildData) {
      await createBidHistoryEntry({
        bidId: id!,
        organizationId: clientOrgId,
        action: "job_type_data_updated",
        description: "Job-type specific data was updated",
        performedBy: performedBy,
      });
    }

    // Create history entry for document operations
    if (Object.keys(documentUpdatesResult).length > 0) {
      await createBidHistoryEntry({
        bidId: id!,
        organizationId: clientOrgId,
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
      organizationId: existingBid.organizationId,
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
      organizationId: clientOrgId,
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
      organizationId: clientOrgId,
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
      organizationId: clientOrgId,
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
      organizationId: clientOrgId,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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
      organizationId: bid.organizationId,
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
      organizationId: bid.organizationId,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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
      organizationId: clientOrgId,
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
      organizationId: clientOrgId,
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
      organizationId: clientOrgId,
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

    const timeline = await getBidTimeline(bidId!);

    logger.info("Bid timeline fetched successfully");
    return res.status(200).json({
      success: true,
      data: timeline,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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

    const notes = await getBidNotes(bidId!);

    logger.info("Bid notes fetched successfully");
    return res.status(200).json({
      success: true,
      data: notes,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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
    const clientOrgId = bid.organizationId;

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
      organizationId: clientOrgId,
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

    const history = await getBidHistory(bidId!);

    logger.info("Bid history fetched successfully");
    return res.status(200).json({
      success: true,
      data: history,
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

    logger.info("Related bids fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
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
    const options = tagIds?.length
      ? ({ tagIds } as { tagIds: string[] })
      : undefined;
    const documents = await getBidDocuments(bidId!, options);

    logger.info(`Bid documents fetched successfully for bid ${bidId}`);
    return res.status(200).json({
      success: true,
      data: documents,
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
// Bid Document Tags Handlers
// ============================

export const getBidDocumentTagsHandler = async (
  req: Request,
  res: Response,
) => {
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

    const tags = await getBidDocumentTags(bidId!);
    return res.status(200).json({ success: true, data: tags });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getBidDocumentTagByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId", "tagId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const tagId = asSingleString(req.params.tagId);

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const tag = await getBidDocumentTagById(tagId!);
    if (!tag || tag.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    return res.status(200).json({ success: true, data: tag });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createBidDocumentTagHandler = async (
  req: Request,
  res: Response,
) => {
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

    const { name } = (req as any).body as { name: string };
    const tag = await createBidDocumentTag(bidId!, name);
    return res.status(201).json({ success: true, data: tag });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateBidDocumentTagHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId", "tagId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const tagId = asSingleString(req.params.tagId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const tag = await getBidDocumentTagById(tagId!);
    if (!tag || tag.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    const { name } = (req as any).body as { name: string };
    const updated = await updateBidDocumentTag(tagId!, { name });
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteBidDocumentTagHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["bidId", "tagId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const tagId = asSingleString(req.params.tagId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const tag = await getBidDocumentTagById(tagId!);
    if (!tag || tag.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    await deleteBidDocumentTag(tagId!);
    return res.status(200).json({
      success: true,
      message: "Tag deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getDocumentTagsHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "documentId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const documentId = asSingleString(req.params.documentId);

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const document = await getBidDocumentById(documentId!);
    if (!document || document.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const tags = await getDocumentTags(bidId!, documentId!);
    return res.status(200).json({ success: true, data: tags });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const linkDocumentTagHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "documentId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const documentId = asSingleString(req.params.documentId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const document = await getBidDocumentById(documentId!);
    if (!document || document.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const body = (req as any).body as { tagId?: string; tagName?: string };
    const link = await linkDocumentTag({
      bidId: bidId!,
      documentId: documentId!,
      ...(body.tagId != null && { tagId: body.tagId }),
      ...(body.tagName != null && { tagName: body.tagName }),
    });

    if (!link) {
      return res.status(400).json({
        success: false,
        message: "Either tagId or tagName is required",
      });
    }

    return res.status(201).json({ success: true, data: link });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const unlinkDocumentTagHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId", "documentId", "tagId"])) return;
    const bidId = asSingleString(req.params.bidId);
    const documentId = asSingleString(req.params.documentId);
    const tagId = asSingleString(req.params.tagId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const document = await getBidDocumentById(documentId!);
    if (!document || document.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const tag = await getBidDocumentTagById(tagId!);
    if (!tag || tag.bidId !== bidId) {
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    const result = await unlinkDocumentTag(documentId!, tagId!);
    if (!result.unlinked) {
      return res.status(404).json({
        success: false,
        message: "Tag was not linked to this document",
      });
    }

    return res.status(200).json({
      success: true,
      message: result.tagDeleted
        ? "Tag unlinked and deleted (had no other documents)"
        : "Tag unlinked successfully",
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

    logger.info(
      `${uploadedMedia.length} media files uploaded for bid ${bidId}`,
    );
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

    const media = await getBidMedia(bidId!);

    logger.info(`Bid media fetched successfully for bid ${bidId}`);
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
          message: "Failed to upload new media file. Please try again.",
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
        message: "Media not found",
      });
    }

    logger.info(`Bid media ${mediaId} updated successfully`);
    return res.status(200).json({
      success: true,
      data: updatedMedia,
      message: "Media updated successfully",
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
        message: "Media not found",
      });
    }

    const deletedMedia = await deleteBidMedia(mediaId!);

    if (!deletedMedia) {
      return res.status(404).json({
        success: false,
        message: "Media not found",
      });
    }

    logger.info(`Bid media ${mediaId} deleted successfully`);
    return res.status(200).json({
      success: true,
      message: "Media deleted successfully",
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

    const financialBreakdown = await getBidFinancialBreakdown(
      id,
      organizationId,
    );

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
    );

    const pdfBuffer = await generateQuotePDF(pdfData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="quote-${bid.bidNumber}.pdf"`,
    );
    res.setHeader("Content-Length", String(pdfBuffer.length));

    logger.info(`Quote PDF downloaded for bid: ${id}`);
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

    const financialBreakdown = await getBidFinancialBreakdown(
      id,
      organizationId,
    );

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

    const financialBreakdown = await getBidFinancialBreakdown(
      id,
      organizationId,
    );

    const pdfData = prepareQuoteDataForPDF(
      bid,
      client.organization,
      financialBreakdown,
      primaryContact ?? null,
      bid.property ?? null,
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

    const financialBreakdown = await getBidFinancialBreakdown(
      id,
      organizationId,
    );

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
