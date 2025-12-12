import type { Request, Response } from "express";
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  createClientContact,
  createClientNote,
  getClientKPIs,
} from "../services/client.service.js";
import { uploadToSpaces } from "../services/storage.service.js";
import { logger } from "../utils/logger.js";

// Get all clients with pagination
export const getClientsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;

    const offset = (page - 1) * limit;

    // Handle status filter - support both single value and array
    let statusFilter: string | string[] | undefined;
    if (req.query.status) {
      if (Array.isArray(req.query.status)) {
        statusFilter = req.query.status as string[];
      } else {
        statusFilter = req.query.status as string;
      }
    }

    const filters: {
      status?: string | string[];
      clientType?: string;
      search?: string;
    } = {};

    if (statusFilter !== undefined) filters.status = statusFilter;
    if (req.query.clientType)
      filters.clientType = req.query.clientType as string;
    if (search) filters.search = search;

    const result = await getClients(
      offset,
      limit,
      Object.keys(filters).length > 0 ? filters : undefined
    );

    logger.info("Clients fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching clients", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch clients" });
  }
};

// Get client by ID with full details
export const getClientByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Client ID is required" });
    }

    const client = await getClientById(id);

    if (!client) {
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });
    }

    logger.info("Client fetched successfully");
    return res.status(200).json({
      success: true,
      data: client,
    });
  } catch (error) {
    logger.logApiError("Error fetching client", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch client" });
  }
};

// Create new client
export const createClientHandler = async (req: Request, res: Response) => {
  let uploadedLogoUrl: string | null = null;
  try {
    // Parse client data - either from JSON body or from form-data field
    let clientData: any;
    if (req.headers["content-type"]?.includes("application/json")) {
      // JSON request - data is in req.body
      clientData = req.body;
    } else {
      // Multipart form-data - parse JSON from 'data' field
      if (req.body.data) {
        try {
          clientData =
            typeof req.body.data === "string"
              ? JSON.parse(req.body.data)
              : req.body.data;
        } catch (parseError) {
          return res.status(400).json({
            success: false,
            message: "Invalid JSON in 'data' field",
          });
        }
      } else {
        // Fallback: use req.body directly
        clientData = req.body;
      }
    }

    // Handle file upload for company logo if provided
    const file = req.file;
    if (file) {
      try {
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "client-logos"
        );
        uploadedLogoUrl = uploadResult.url;
        clientData.companyLogo = uploadedLogoUrl;
      } catch (uploadError: any) {
        logger.logApiError("File upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload company logo. Please try again.",
        });
      }
    }

    // Add createdBy
    clientData.createdBy = req.user?.id;

    // Create client with contacts and properties
    const client = await createClient(clientData);

    logger.info("Client created successfully");
    return res.status(201).json({
      success: true,
      message: "Client created successfully",
      data: client,
    });
  } catch (error: any) {
    logger.logApiError("Error creating client", error, req);

    // Handle specific errors
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Client with this name already exists",
      });
    }
    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid reference (organization, account manager, etc.)",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create client",
    });
  }
};

// Update client
export const updateClientHandler = async (req: Request, res: Response) => {
  let uploadedLogoUrl: string | null = null;
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Client ID is required" });
    }

    // Parse update data - either from JSON body or from form-data field
    let updateData: any;
    if (req.headers["content-type"]?.includes("application/json")) {
      updateData = req.body;
    } else {
      if (req.body.data) {
        try {
          updateData =
            typeof req.body.data === "string"
              ? JSON.parse(req.body.data)
              : req.body.data;
        } catch (parseError) {
          return res.status(400).json({
            success: false,
            message: "Invalid JSON in 'data' field",
          });
        }
      } else {
        updateData = req.body;
      }
    }

    // Handle file upload for company logo if provided
    const file = req.file;
    if (file) {
      try {
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "client-logos"
        );
        uploadedLogoUrl = uploadResult.url;
        updateData.companyLogo = uploadedLogoUrl;
      } catch (uploadError: any) {
        logger.logApiError("File upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload company logo. Please try again.",
        });
      }
    }

    // Handle logo in tags if provided
    if (updateData.companyLogo) {
      // Get existing client to preserve other tags
      const existingClient = await getClientById(id);
      let tags = existingClient?.tags || [];
      if (Array.isArray(tags)) {
        tags = [...tags, { logo: updateData.companyLogo }];
      } else if (typeof tags === "object") {
        tags = { ...tags, logo: updateData.companyLogo };
      } else {
        tags = { logo: updateData.companyLogo };
      }
      updateData.tags = tags;
      delete updateData.companyLogo; // Remove from updateData as it's not a direct field
    }

    const client = await updateClient(id, updateData);

    if (!client) {
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });
    }

    logger.info("Client updated successfully");
    return res.status(200).json({
      success: true,
      message: "Client updated successfully",
      data: client,
    });
  } catch (error: any) {
    logger.logApiError("Error updating client", error, req);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Client with this name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update client",
    });
  }
};

// Delete client (soft delete)
export const deleteClientHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Client ID is required" });
    }

    const success = await deleteClient(id);

    if (!success) {
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });
    }

    logger.info("Client deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Client deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting client", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete client" });
  }
};

// Create client contact
export const createClientContactHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { clientId } = req.params;
    const contactData = {
      ...req.body,
      organizationId: clientId,
    };

    const contact = await createClientContact(contactData);

    logger.info("Client contact created successfully");
    return res.status(201).json({
      success: true,
      message: "Contact created successfully",
      data: contact,
    });
  } catch (error) {
    logger.logApiError("Error creating contact", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create contact" });
  }
};

// Create client note
export const createClientNoteHandler = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const noteData = {
      ...req.body,
      organizationId: clientId,
      createdBy: req.user?.id,
    };

    const note = await createClientNote(noteData);

    logger.info("Client note created successfully");
    return res.status(201).json({
      success: true,
      message: "Note created successfully",
      data: note,
    });
  } catch (error) {
    logger.logApiError("Error creating note", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create note" });
  }
};

// Create client document (placeholder)
export const createClientDocumentHandler = async (
  req: Request,
  res: Response
) => {
  try {
    logger.info("Client document upload requested");
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

// Get Client KPIs for dashboard
export const getClientKPIsHandler = async (req: Request, res: Response) => {
  try {
    const kpis = await getClientKPIs();

    logger.info("Client KPIs fetched successfully");
    return res.status(200).json({
      success: true,
      data: kpis,
    });
  } catch (error) {
    logger.logApiError("Error fetching client KPIs", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
