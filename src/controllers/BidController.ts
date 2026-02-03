import type { Request, Response } from "express";

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
  checkBidNumberExists,
  validateUniqueFields,
  buildConflictResponse,
} from "../utils/validation-helpers.js";
import {
  parseDatabaseError,
  isDatabaseError,
} from "../utils/database-error-parser.js";
import { uploadToSpaces } from "../services/storage.service.js";
import {
  getBids,
  getBidById,
  getBidByIdSimple,
  createBid,
  updateBid,
  deleteBid,
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
  updateBidOperatingExpenses,
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
  deleteBidDocument,
} from "../services/bid.service.js";
import { getOrganizationById } from "../services/client.service.js";

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

    const bids = await getBids(
      organizationId,
      offset,
      limit,
      Object.keys(filters).length > 0 ? filters : undefined,
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
    const { id } = req.params;

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
    const { bidNumber, organizationId } = req.body;

    // organizationId is required - it's the CLIENT organization ID (not T3)
    // Bids are created FOR client organizations BY T3 employees
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message:
          "organizationId is required. This should be the client organization ID.",
      });
    }

    // Pre-validate unique fields before attempting to create
    const uniqueFieldChecks = [];

    // Check bid number uniqueness within the organization
    if (bidNumber) {
      uniqueFieldChecks.push({
        field: "bidNumber",
        value: bidNumber,
        checkFunction: () => checkBidNumberExists(bidNumber, organizationId),
        message: `A bid with number '${bidNumber}' already exists in this organization`,
      });
    }

    // Validate all unique fields
    const validationErrors = await validateUniqueFields(uniqueFieldChecks);
    if (validationErrors.length > 0) {
      return res.status(409).json(buildConflictResponse(validationErrors));
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

    // Create bid with only bid fields (excluding nested objects)
    const bidData = {
      ...bidFields,
      organizationId,
      createdBy,
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
      );
    }

    // Update operating expenses if provided
    if (operatingExpenses) {
      createdRecords.operatingExpenses = await updateBidOperatingExpenses(
        bid.id,
        organizationId,
        operatingExpenses,
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
    const { id } = req.params;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;
    const { bidNumber } = req.body;

    // Get original bid for history tracking; client org comes from the bid
    const originalBid = await getBidById(id!);
    if (!originalBid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const clientOrgId = originalBid.organizationId;

    // Pre-validate unique fields before attempting to update
    const uniqueFieldChecks = [];

    // Check bid number uniqueness (if provided and different from current)
    if (bidNumber && bidNumber !== originalBid.bidNumber) {
      uniqueFieldChecks.push({
        field: "bidNumber",
        value: bidNumber,
        checkFunction: () => checkBidNumberExists(bidNumber, clientOrgId, id),
        message: `A bid with number '${bidNumber}' already exists in this organization`,
      });
    }

    // Validate all unique fields
    const validationErrors = await validateUniqueFields(uniqueFieldChecks);
    if (validationErrors.length > 0) {
      return res.status(409).json(buildConflictResponse(validationErrors));
    }

    const updatedBid = await updateBid(id!, clientOrgId, req.body);

    if (!updatedBid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found or failed to update",
      });
    }

    // Handle document operations
    const documentUpdates: any = {};

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
        documentUpdates.added = uploadedDocuments;
      }
    }

    // Handle document updates (if documentIdsToUpdate is provided)
    if (
      req.body.documentIdsToUpdate &&
      Array.isArray(req.body.documentIdsToUpdate)
    ) {
      const documentUpdatesList = req.body.documentUpdates || [];
      const updatedDocuments = [];

      for (let i = 0; i < req.body.documentIdsToUpdate.length; i++) {
        const documentId = req.body.documentIdsToUpdate[i];
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
        documentUpdates.updated = updatedDocuments;
      }
    }

    // Handle document deletions (if documentIdsToDelete is provided)
    if (
      req.body.documentIdsToDelete &&
      Array.isArray(req.body.documentIdsToDelete)
    ) {
      const deletedDocuments = [];

      for (const documentId of req.body.documentIdsToDelete) {
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
        documentUpdates.deleted = deletedDocuments;
      }
    }

    // Create history entries for changed fields
    for (const [key, value] of Object.entries(req.body)) {
      // Skip document-related fields
      if (
        key === "documentIdsToUpdate" ||
        key === "documentUpdates" ||
        key === "documentIdsToDelete"
      ) {
        continue;
      }
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

    // Create history entry for document operations
    if (Object.keys(documentUpdates).length > 0) {
      await createBidHistoryEntry({
        bidId: id!,
        organizationId: clientOrgId,
        action: "documents_updated",
        description: `Documents updated: ${documentUpdates.added?.length || 0} added, ${documentUpdates.updated?.length || 0} updated, ${documentUpdates.deleted?.length || 0} deleted`,
        performedBy: performedBy,
      });
    }

    logger.info("Bid updated successfully");
    return res.status(200).json({
      success: true,
      data: {
        ...updatedBid,
        ...(Object.keys(documentUpdates).length > 0 && { documentUpdates }),
      },
      message: "Bid updated successfully",
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
    const { id } = req.params;

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

    const deletedBid = await deleteBid(id!, existingBid.organizationId);

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
    const { bidId } = req.params;

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
    const { bidId } = req.params;

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
// Materials Operations
// ============================

export const getBidMaterialsHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const { bidId } = req.params;

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
    const { bidId, materialId } = req.params;

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
    const { bidId } = req.params;

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
    const { materialId, bidId } = req.params;

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
    const { materialId, bidId } = req.params;

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
    const { bidId } = req.params;
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
    const { bidId, laborId } = req.params;

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
    const { bidId } = req.params;
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
    const { laborId } = req.params;
    const { bidId } = req.params;
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
    const { laborId } = req.params;
    const { bidId } = req.params;
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
    const { bidId, laborId } = req.params;
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
    const { bidId } = req.params;

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
    const { bidId, travelId } = req.params;

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
    const { bidId } = req.params;

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
    const { bidId, travelId } = req.params;

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
    const { bidId, travelId } = req.params;

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
    const { bidId, laborId } = req.params;
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
    const { bidId, laborId, travelId } = req.params;
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
    const { bidId, laborId, travelId } = req.params;
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
    const { bidId } = req.params;
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
    const { bidId } = req.params;
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
    const { bidId } = req.params;
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
    const { bidId } = req.params;
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
    const { bidId } = req.params;
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
    const { bidId } = req.params;
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
    const { bidId } = req.params;
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
    const { bidId } = req.params;
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
    const { bidId } = req.params;
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
    const { eventId } = req.params;
    const { bidId } = req.params;
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
    const { eventId } = req.params;
    const { bidId } = req.params;
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
    const { bidId } = req.params;
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
    const { bidId } = req.params;
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
    const { noteId } = req.params;
    const { bidId } = req.params;
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
    const { noteId } = req.params;
    const { bidId } = req.params;
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
    const { bidId } = req.params;
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
    const { id } = req.params;
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const bidData = await getBidWithAllData(id!);

    if (!bidData) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    logger.info("Bid with all data fetched successfully");
    return res.status(200).json({
      success: true,
      data: bidData,
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
    const { bidId } = req.params;
    const userId = validateUserAccess(req, res);
    if (!userId) return;

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

    const { bidId } = req.params;
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

    const { bidId } = req.params;

    // Verify bid exists
    const bid = await getBidById(bidId!);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const documents = await getBidDocuments(bidId!);

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

    const { bidId, documentId } = req.params;

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

    const { bidId, documentId } = req.params;
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

    const { bidId, documentId } = req.params;
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
