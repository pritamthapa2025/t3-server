import type { Request, Response } from "express";

// Helper function to validate organization access
// Note: organizationId in bids refers to CLIENT organizations (not T3)
// Bids are created FOR client organizations BY T3 employees
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

// Legacy function for backward compatibility
const validateOrganizationAccess = validateUserAccess;

// Helper function to validate required params
const validateParams = (
  req: Request,
  res: Response,
  paramNames: string[]
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
  getBids,
  getBidById,
  createBid,
  updateBid,
  deleteBid,
  getBidFinancialBreakdown,
  updateBidFinancialBreakdown,
  getBidMaterials,
  createBidMaterial,
  updateBidMaterial,
  deleteBidMaterial,
  getBidLabor,
  createBidLabor,
  updateBidLabor,
  deleteBidLabor,
  getBidTravel,
  createBidTravel,
  updateBidTravel,
  deleteBidTravel,
  getBidSurveyData,
  updateBidSurveyData,
  getBidPlanSpecData,
  updateBidPlanSpecData,
  getBidDesignBuildData,
  updateBidDesignBuildData,
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
} from "../services/bid.service.js";

// ============================
// Main Bid Operations
// ============================

export const getBidsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

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
    if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo as string;
    if (req.query.search) filters.search = req.query.search as string;

    const bids = await getBids(organizationId, offset, limit, Object.keys(filters).length > 0 ? filters : undefined);

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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const bid = await getBidById(id!, organizationId);

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    logger.info("Bid fetched successfully");
    return res.status(200).json({
      success: true,
      data: bid,
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
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const createdBy = req.user!.id;

    const bidData = {
      ...req.body,
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

    // Create history entry
    await createBidHistoryEntry({
      bidId: bid.id,
      organizationId: organizationId,
      action: "bid_created",
      newValue: "Created new bid",
      description: `Bid "${bid.title}" was created`,
      performedBy: createdBy,
    });

    logger.info("Bid created successfully");
    return res.status(201).json({
      success: true,
      data: bid,
      message: "Bid created successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateBidHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["id"])) return;
    const { id } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    // Get original bid for history tracking
    const originalBid = await getBidById(id!, organizationId);
    if (!originalBid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const updatedBid = await updateBid(id!, organizationId, req.body);

    if (!updatedBid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found or failed to update",
      });
    }

    // Create history entries for changed fields
    for (const [key, value] of Object.entries(req.body)) {
      const oldValue = (originalBid as any)[key];
      if (oldValue !== value) {
        await createBidHistoryEntry({
          bidId: id!,
          organizationId: organizationId,
          action: `field_updated_${key}`,
          oldValue: String(oldValue || ""),
          newValue: String(value || ""),
          description: `Field "${key}" was updated`,
          performedBy: performedBy,
        });
      }
    }

    logger.info("Bid updated successfully");
    return res.status(200).json({
      success: true,
      data: updatedBid,
      message: "Bid updated successfully",
    });
  } catch (error) {
    logger.logApiError("Bid error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteBidHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["id"])) return;
    const { id } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const deletedBid = await deleteBid(id!, organizationId);

    if (!deletedBid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: id!,
      organizationId: organizationId,
      action: "bid_deleted",
      description: `Bid "${deletedBid.title}" was deleted`,
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
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const { bidId } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const breakdown = await getBidFinancialBreakdown(bidId!, organizationId);

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
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const { bidId } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const breakdown = await updateBidFinancialBreakdown(
      bidId!,
      organizationId,
      req.body
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
      organizationId,
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const materials = await getBidMaterials(bidId!, organizationId);

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

export const createBidMaterialHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const { bidId } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const materialData = {
      ...req.body,
      bidId: bidId!,
      organizationId,
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
      organizationId,
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const material = await updateBidMaterial(
      materialId!,
      organizationId,
      req.body
    );

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      organizationId,
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const material = await deleteBidMaterial(materialId!, organizationId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      organizationId,
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
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const labor = await getBidLabor(bidId!, organizationId);

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

export const createBidLaborHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const { bidId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const laborData = {
      ...req.body,
      bidId: bidId!,
      organizationId,
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
      organizationId,
      action: "labor_added",
      newValue: labor.role || "Unknown",
      description: `Labor role "${labor.role}" was added`,
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
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const labor = await updateBidLabor(laborId!, organizationId, req.body);

    if (!labor) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      organizationId,
      action: "labor_updated",
      description: `Labor role "${labor?.role || "Unknown"}" was updated`,
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
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const labor = await deleteBidLabor(laborId!, organizationId);

    if (!labor) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      organizationId,
      action: "labor_deleted",
      description: `Labor role "${labor?.role || "Unknown"}" was deleted`,
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
    if (!validateParams(req, res, ["bidId"])) return;
    const { bidId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const travel = await getBidTravel(bidId!, organizationId);

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

export const createBidTravelHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const { bidId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const travelData = {
      ...req.body,
      bidId: bidId!,
      organizationId,
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
      organizationId,
      action: "travel_added",
      newValue: travel.employeeName || travel.vehicleName || "Travel entry",
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
    if (!validateParams(req, res, ["travelId", "bidId"])) return;
    const { travelId } = req.params;
    const { bidId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const travel = await updateBidTravel(travelId!, organizationId, req.body);

    if (!travel) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      organizationId,
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
    if (!validateParams(req, res, ["travelId", "bidId"])) return;
    const { travelId } = req.params;
    const { bidId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const travel = await deleteBidTravel(travelId!, organizationId);

    if (!travel) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      organizationId,
      action: "travel_deleted",
      description: "Travel entry was deleted",
      performedBy: performedBy,
    });

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
// Job-Type Specific Data Operations
// ============================

export const getBidSurveyDataHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const { bidId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const surveyData = await getBidSurveyData(bidId!, organizationId);

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
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const { bidId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const surveyData = await updateBidSurveyData(
      bidId!,
      organizationId,
      req.body
    );

    if (!surveyData) {
      return res.status(404).json({
        success: false,
        message: "Survey data not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      organizationId,
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
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const { bidId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const planSpecData = await getBidPlanSpecData(bidId!, organizationId);

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
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const { bidId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const planSpecData = await updateBidPlanSpecData(
      bidId!,
      organizationId,
      req.body
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
      organizationId,
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
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const { bidId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const designBuildData = await getBidDesignBuildData(bidId!, organizationId);

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
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const { bidId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const designBuildData = await updateBidDesignBuildData(
      bidId!,
      organizationId,
      req.body
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
      organizationId,
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
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const timeline = await getBidTimeline(bidId!, organizationId);

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
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["bidId"])) return;
    const { bidId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const eventData = {
      ...req.body,
      bidId: bidId!,
      organizationId,
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
      organizationId,
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
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["eventId", "bidId"])) return;
    const { eventId } = req.params;
    const { bidId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const event = await updateBidTimelineEvent(
      eventId!,
      organizationId,
      req.body
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Timeline event not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      organizationId,
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
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["eventId", "bidId"])) return;
    const { eventId } = req.params;
    const { bidId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const event = await deleteBidTimelineEvent(eventId!, organizationId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Timeline event not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      organizationId,
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
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const notes = await getBidNotes(bidId!, organizationId);

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
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const noteData = {
      ...req.body,
      bidId: bidId!,
      organizationId,
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
      organizationId,
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
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const note = await updateBidNote(noteId!, organizationId, req.body);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      organizationId,
      action: "note_updated",
      description: "Note was updated",
      performedBy: performedBy,
    });

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
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const note = await deleteBidNote(noteId!, organizationId);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    // Create history entry
    await createBidHistoryEntry({
      bidId: bidId!,
      organizationId,
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
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const history = await getBidHistory(bidId!, organizationId);

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
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const bidData = await getBidWithAllData(id!, organizationId);

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
