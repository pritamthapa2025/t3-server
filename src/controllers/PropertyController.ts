import type { Request, Response } from "express";
import { asSingleString } from "../utils/request-helpers.js";
import {
  getProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  createPropertyContact,
  createPropertyDocument,
  createPropertyEquipment,
  getPropertyEquipment,
  getPropertyEquipmentById,
  updatePropertyEquipment,
  deletePropertyEquipment,
  createServiceHistoryEntry,
  getPropertyKPIs,
} from "../services/property.service.js";
import { logger } from "../utils/logger.js";
import { uploadToSpaces } from "../services/storage.service.js";
import { getDataFilterConditions } from "../services/featurePermission.service.js";
import { db } from "../config/db.js";
import { eq } from "drizzle-orm";
import { employees } from "../drizzle/schema/org.schema.js";

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

    // view_assigned: Technicians see only properties for jobs they're team members of
    const userId = req.user?.id;
    let propertyOptions: { ownEmployeeId?: number } | undefined;
    if (userId) {
      const dataFilter = await getDataFilterConditions(userId, "properties");
      if (dataFilter.assignedOnly) {
        const [emp] = await db
          .select({ id: employees.id })
          .from(employees)
          .where(eq(employees.userId, userId))
          .limit(1);
        if (emp) propertyOptions = { ownEmployeeId: emp.id };
      }
    }

    const result = await getProperties(
      offset,
      limit,
      Object.keys(filters).length > 0 ? filters : undefined,
      propertyOptions,
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
    const id = asSingleString(req.params.id);

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
    const id = asSingleString(req.params.id);

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
    const id = asSingleString(req.params.id);

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

// Create property contact
export const createPropertyContactHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["propertyId"])) return;
    const propertyId = asSingleString(req.params.propertyId);

    const contactData = {
      propertyId: propertyId!,
      ...req.body,
    };

    const contact = await createPropertyContact(contactData);

    if (!contact) {
      return res.status(500).json({
        success: false,
        message: "Failed to create property contact",
      });
    }

    logger.info("Property contact created successfully");
    return res.status(201).json({
      success: true,
      message: "Property contact created successfully",
      data: contact,
    });
  } catch (error) {
    logger.logApiError("Error creating property contact", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create property contact" });
  }
};

// Get property equipment
export const getPropertyEquipmentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const propertyId = asSingleString(req.params.propertyId);

    if (!propertyId) {
      return res
        .status(400)
        .json({ success: false, message: "Property ID is required" });
    }

    const equipment = await getPropertyEquipment(propertyId);

    logger.info("Property equipment fetched successfully");
    return res.status(200).json({
      success: true,
      data: equipment,
    });
  } catch (error) {
    logger.logApiError("Error fetching equipment", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch equipment" });
  }
};

// Get property equipment by ID
export const getPropertyEquipmentByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Equipment ID is required" });
    }

    const equipment = await getPropertyEquipmentById(id);

    if (!equipment) {
      return res
        .status(404)
        .json({ success: false, message: "Equipment not found" });
    }

    logger.info("Property equipment fetched successfully");
    return res.status(200).json({
      success: true,
      data: equipment,
    });
  } catch (error) {
    logger.logApiError("Error fetching equipment", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch equipment" });
  }
};

// Create property equipment
export const createPropertyEquipmentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const propertyId = asSingleString(req.params.propertyId);
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

// Update property equipment
export const updatePropertyEquipmentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Equipment ID is required" });
    }

    const equipment = await updatePropertyEquipment(id, req.body);

    if (!equipment) {
      return res
        .status(404)
        .json({ success: false, message: "Equipment not found" });
    }

    logger.info("Property equipment updated successfully");
    return res.status(200).json({
      success: true,
      message: "Equipment updated successfully",
      data: equipment,
    });
  } catch (error) {
    logger.logApiError("Error updating equipment", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update equipment" });
  }
};

// Delete property equipment
export const deletePropertyEquipmentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Equipment ID is required" });
    }

    const equipment = await deletePropertyEquipment(id);

    if (!equipment) {
      return res
        .status(404)
        .json({ success: false, message: "Equipment not found" });
    }

    logger.info("Property equipment deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Equipment deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting equipment", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete equipment" });
  }
};

// Create property document
export const createPropertyDocumentHandler = async (
  req: Request,
  res: Response,
) => {
  let uploadedFilePath: string | null = null;
  try {
    if (!validateParams(req, res, ["propertyId"])) return;
    const propertyId = asSingleString(req.params.propertyId);

    // Get user ID for uploadedBy
    const uploadedBy = req.user?.id;
    if (!uploadedBy) {
      return res.status(403).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Parse document data - either from JSON body or from form-data field
    let documentData: any;
    if (req.headers["content-type"]?.includes("application/json")) {
      // JSON request - data is in req.body
      documentData = req.body;
    } else {
      // Multipart form-data - parse JSON from 'data' field
      if (req.body.data) {
        try {
          documentData =
            typeof req.body.data === "string"
              ? JSON.parse(req.body.data)
              : req.body.data;
        } catch {
          return res.status(400).json({
            success: false,
            message: "Invalid JSON in 'data' field",
          });
        }
      } else {
        // Fallback: use req.body directly
        documentData = req.body;
      }
    }

    // Handle file upload if provided
    const file = req.file;
    if (file) {
      try {
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "property-documents",
        );
        uploadedFilePath = uploadResult.url;
        documentData.filePath = uploadedFilePath;
        documentData.fileName = file.originalname;
        documentData.fileType = file.mimetype;
        documentData.fileSize = file.size;
      } catch (uploadError: any) {
        logger.logApiError("File upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload document. Please try again.",
        });
      }
    }

    // Validate required fields
    if (!documentData.fileName || !documentData.filePath) {
      return res.status(400).json({
        success: false,
        message: "File name and file path are required",
      });
    }

    const document = await createPropertyDocument({
      propertyId: propertyId!,
      fileName: documentData.fileName,
      filePath: documentData.filePath,
      fileType: documentData.fileType,
      fileSize: documentData.fileSize,
      documentType: documentData.documentType,
      description: documentData.description,
      uploadedBy,
    });

    if (!document) {
      return res.status(500).json({
        success: false,
        message: "Failed to create property document",
      });
    }

    logger.info("Property document created successfully");
    return res.status(201).json({
      success: true,
      message: "Property document created successfully",
      data: document,
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
  res: Response,
) => {
  try {
    const propertyId = asSingleString(req.params.propertyId);
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
