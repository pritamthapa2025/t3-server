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
  getClientTypes,
  getIndustryClassifications,
  createClientType,
  createIndustryClassification,
  getDocumentCategories,
  getDocumentCategories2,
  createDocumentCategory,
  assignDocumentCategories,
  createClientDocument,
  getClientDocumentById,
  deleteClientDocument,
  createCategoryAndAssignToDocument,
  removeDocumentCategoryLink,
  updateClientSettings,
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
      clientTypeId?: number;
      priority?: string;
      search?: string;
    } = {};

    if (statusFilter !== undefined) filters.status = statusFilter;
    if (req.query.clientTypeId)
      filters.clientTypeId = parseInt(req.query.clientTypeId as string);
    if (req.query.priority) filters.priority = req.query.priority as string;
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
  let uploadedPictureUrl: string | null = null;
  try {
    const { id } = req.params;

    // Parse contact data - either from JSON body or from form-data field
    let contactData: any;
    if (req.headers["content-type"]?.includes("application/json")) {
      // JSON request - data is in req.body
      contactData = req.body;
    } else {
      // Multipart form-data - parse JSON from 'data' field
      if (req.body.data) {
        try {
          contactData =
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
        contactData = req.body;
      }
    }

    // Handle file upload for contact picture if provided
    const file = req.file;
    if (file) {
      try {
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "contact-pictures"
        );
        uploadedPictureUrl = uploadResult.url;
        contactData.picture = uploadedPictureUrl;
      } catch (uploadError: any) {
        logger.logApiError("File upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload contact picture. Please try again.",
        });
      }
    }

    contactData.organizationId = id;
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
    const { id } = req.params;
    const noteData = {
      ...req.body,
      organizationId: id,
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

// Client Types Management
export const getClientTypesHandler = async (req: Request, res: Response) => {
  try {
    const clientTypes = await getClientTypes();

    logger.info("Client types fetched successfully");
    return res.status(200).json({
      success: true,
      data: clientTypes,
    });
  } catch (error) {
    logger.logApiError("Error fetching client types", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch client types",
    });
  }
};

export const createClientTypeHandler = async (req: Request, res: Response) => {
  try {
    const clientType = await createClientType(req.body);

    logger.info("Client type created successfully");
    return res.status(201).json({
      success: true,
      message: "Client type created successfully",
      data: clientType,
    });
  } catch (error: any) {
    logger.logApiError("Error creating client type", error, req);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Client type with this name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create client type",
    });
  }
};

// Industry Classifications Management
export const getIndustryClassificationsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const industries = await getIndustryClassifications();

    logger.info("Industry classifications fetched successfully");
    return res.status(200).json({
      success: true,
      data: industries,
    });
  } catch (error) {
    logger.logApiError("Error fetching industry classifications", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch industry classifications",
    });
  }
};

export const createIndustryClassificationHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const industry = await createIndustryClassification(req.body);

    logger.info("Industry classification created successfully");
    return res.status(201).json({
      success: true,
      message: "Industry classification created successfully",
      data: industry,
    });
  } catch (error: any) {
    logger.logApiError("Error creating industry classification", error, req);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Industry classification with this name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create industry classification",
    });
  }
};

// Document Categories Management
export const getDocumentCategoriesHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const categories = await getDocumentCategories();

    logger.info("Document categories fetched successfully");
    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    logger.logApiError("Error fetching document categories", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch document categories",
    });
  }
};

export const createDocumentCategoryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const category = await createDocumentCategory(req.body);

    logger.info("Document category created successfully");
    return res.status(201).json({
      success: true,
      message: "Document category created successfully",
      data: category,
    });
  } catch (error: any) {
    logger.logApiError("Error creating document category", error, req);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Document category with this name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create document category",
    });
  }
};

export const assignDocumentCategoriesHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { documentId } = req.params;
    const { categoryIds } = req.body;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required",
      });
    }

    await assignDocumentCategories(documentId, categoryIds);

    logger.info("Document categories assigned successfully");
    return res.status(200).json({
      success: true,
      message: "Document categories assigned successfully",
    });
  } catch (error) {
    logger.logApiError("Error assigning document categories", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to assign document categories",
    });
  }
};

// Client Documents Management
export const createClientDocumentHandler = async (
  req: Request,
  res: Response
) => {
  let uploadedFileUrl: string | null = null;
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required",
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
        } catch (parseError) {
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
          "client-documents"
        );
        uploadedFileUrl = uploadResult.url;
        documentData.filePath = uploadedFileUrl;
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

    if (!documentData.fileName || !documentData.filePath) {
      return res.status(400).json({
        success: false,
        message: "File name and path are required",
      });
    }

    documentData.organizationId = id;
    documentData.uploadedBy = req.user?.id;

    const document = await createClientDocument(documentData);

    logger.info("Client document created successfully");
    return res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: document,
    });
  } catch (error: any) {
    logger.logApiError("Error creating document", error, req);

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID or category ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to upload document",
    });
  }
};

export const getClientDocumentByIdHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required",
      });
    }

    const document = await getClientDocumentById(documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    logger.info("Client document fetched successfully");
    return res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    logger.logApiError("Error fetching document", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch document",
    });
  }
};

export const deleteClientDocumentHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required",
      });
    }

    const success = await deleteClientDocument(documentId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    logger.info("Client document deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting document", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to delete document",
    });
  }
};

export const createCategoryAndAssignToDocumentHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id, documentId } = req.params;
    const categoryData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required",
      });
    }

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required",
      });
    }

    if (!categoryData.name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const result = await createCategoryAndAssignToDocument(
      documentId,
      categoryData
    );

    logger.info("Category created and assigned to document successfully");
    return res.status(201).json({
      success: true,
      message: result.wasNewCategory
        ? "New category created and assigned to document"
        : result.wasAlreadyAssigned
        ? "Document was already assigned to this existing category"
        : "Document assigned to existing category",
      data: {
        category: result.category,
        wasNewCategory: result.wasNewCategory,
        wasAlreadyAssigned: result.wasAlreadyAssigned,
      },
    });
  } catch (error: any) {
    logger.logApiError(
      "Error creating category and assigning to document",
      error,
      req
    );

    if (error.message === "Document not found") {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Category with this name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create category and assign to document",
    });
  }
};

export const getClientDocumentCategoriesHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id, documentId } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required",
      });
    }

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required",
      });
    }

    const categories = await getDocumentCategories2(documentId);

    logger.info("Document categories fetched successfully");
    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    logger.logApiError("Error fetching document categories", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch document categories",
    });
  }
};

export const removeDocumentCategoryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id, documentId, categoryId } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required",
      });
    }

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required",
      });
    }

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "Category ID is required",
      });
    }

    const categoryIdNum = parseInt(categoryId);
    if (isNaN(categoryIdNum)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const result = await removeDocumentCategoryLink(documentId, categoryIdNum);

    logger.info("Document category link removed successfully");
    return res.status(200).json({
      success: true,
      message: result.categoryDeleted
        ? "Category was completely deleted as it had no other linked documents"
        : "Document unlinked from category successfully",
      data: {
        category: result.category,
        linkRemoved: result.linkRemoved,
        categoryDeleted: result.categoryDeleted,
        remainingLinkedDocuments: result.remainingLinkedDocuments,
      },
    });
  } catch (error: any) {
    logger.logApiError("Error removing document category link", error, req);

    if (error.message === "Document not found") {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    if (error.message === "Category not found") {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (error.message === "Document is not linked to this category") {
      return res.status(404).json({
        success: false,
        message: "Document is not linked to this category",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to remove document category link",
    });
  }
};

// Update client settings
export const updateClientSettingsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Client ID is required" });
    }

    const client = await updateClientSettings(id, req.body);

    if (!client) {
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });
    }

    logger.info("Client settings updated successfully");
    return res.status(200).json({
      success: true,
      message: "Client settings updated successfully",
      data: {
        id: client.id,
        creditLimit: client.creditLimit,
        paymentTerms: client.paymentTerms,
        preferredPaymentMethod: client.preferredPaymentMethod,
        billingContactId: client.billingContactId,
        billingDay: client.billingDay,
        taxExempt: client.taxExempt,
        updatedAt: client.updatedAt,
      },
    });
  } catch (error: any) {
    logger.logApiError("Error updating client settings", error, req);

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid billing contact ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update client settings",
    });
  }
};
