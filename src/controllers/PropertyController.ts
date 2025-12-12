import type { Request, Response } from "express";
import {
  getProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  createPropertyEquipment,
  createServiceHistoryEntry,
  getPropertyKPIs,
} from "../services/property.service.js";
import { logger } from "../utils/logger.js";

// Get all properties with pagination
export const getPropertiesHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;

    const offset = (page - 1) * limit;

    const filters: {
      organizationId?: string;
      propertyType?: string;
      status?: string;
      city?: string;
      state?: string;
      search?: string;
    } = {};

    if (req.query.organizationId)
      filters.organizationId = req.query.organizationId as string;
    if (req.query.propertyType)
      filters.propertyType = req.query.propertyType as string;
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.city) filters.city = req.query.city as string;
    if (req.query.state) filters.state = req.query.state as string;
    if (search) filters.search = search;

    const result = await getProperties(
      offset,
      limit,
      Object.keys(filters).length > 0 ? filters : undefined
    );

    logger.info("Properties fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching properties", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch properties" });
  }
};

// Get property by ID with full details
export const getPropertyByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Property ID is required" });
    }

    const property = await getPropertyById(id);

    if (!property) {
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    }

    logger.info("Property fetched successfully");
    return res.status(200).json({
      success: true,
      data: property,
    });
  } catch (error) {
    logger.logApiError("Error fetching property", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch property" });
  }
};

// Create new property
export const createPropertyHandler = async (req: Request, res: Response) => {
  try {
    const propertyData = {
      ...req.body,
      createdBy: req.user?.id,
    };

    const property = await createProperty(propertyData);

    logger.info("Property created successfully");
    return res.status(201).json({
      success: true,
      message: "Property created successfully",
      data: property,
    });
  } catch (error) {
    logger.logApiError("Error creating property", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create property" });
  }
};

// Update property
export const updatePropertyHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Property ID is required" });
    }

    const property = await updateProperty(id, req.body);

    if (!property) {
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    }

    logger.info("Property updated successfully");
    return res.status(200).json({
      success: true,
      message: "Property updated successfully",
      data: property,
    });
  } catch (error) {
    logger.logApiError("Error updating property", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update property" });
  }
};

// Delete property (soft delete)
export const deletePropertyHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Property ID is required" });
    }

    const success = await deleteProperty(id);

    if (!success) {
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    }

    logger.info("Property deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Property deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting property", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete property" });
  }
};

// Create property contact (placeholder)
export const createPropertyContactHandler = async (
  req: Request,
  res: Response
) => {
  try {
    logger.info("Property contact feature requested");
    return res.status(201).json({
      success: true,
      message: "Property contact feature coming soon",
    });
  } catch (error) {
    logger.logApiError("Error creating property contact", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create property contact" });
  }
};

// Create property equipment
export const createPropertyEquipmentHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { propertyId } = req.params;
    const equipmentData = {
      ...req.body,
      propertyId,
    };

    const equipment = await createPropertyEquipment(equipmentData);

    logger.info("Property equipment created successfully");
    return res.status(201).json({
      success: true,
      message: "Equipment added successfully",
      data: equipment,
    });
  } catch (error) {
    logger.logApiError("Error creating equipment", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to add equipment" });
  }
};

// Create property document (placeholder)
export const createPropertyDocumentHandler = async (
  req: Request,
  res: Response
) => {
  try {
    logger.info("Property document upload requested");
    return res.status(201).json({
      success: true,
      message: "Document upload feature coming soon",
    });
  } catch (error) {
    logger.logApiError("Error uploading document", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to upload document" });
  }
};

// Create service history entry
export const createServiceHistoryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { propertyId } = req.params;
    const serviceData = {
      ...req.body,
      propertyId,
      performedBy: req.user?.id,
    };

    const service = await createServiceHistoryEntry(serviceData);

    logger.info("Property service history entry created successfully");
    return res.status(201).json({
      success: true,
      message: "Service history entry created successfully",
      data: service,
    });
  } catch (error) {
    logger.logApiError("Error creating service history", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create service history" });
  }
};

// Get Property KPIs for dashboard
export const getPropertyKPIsHandler = async (req: Request, res: Response) => {
  try {
    const kpis = await getPropertyKPIs();

    logger.info("Property KPIs fetched successfully");
    return res.status(200).json({
      success: true,
      data: kpis,
    });
  } catch (error) {
    logger.logApiError("Error fetching property KPIs", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
