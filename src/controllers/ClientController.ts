import type { Request, Response } from "express";
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  createClientContact,
  getClientContacts,
  getClientContactById,
  updateClientContact,
  deleteClientContact,
  createClientNote,
  getClientNotes,
  getClientNoteById,
  updateClientNote,
  deleteClientNote,
  getClientKPIs,
  getClientTypes,
  getIndustryClassifications,
  createClientType,
  createIndustryClassification,
  updateClientType,
  updateIndustryClassification,
  deleteClientType,
  deleteIndustryClassification,
  getDocumentCategories,
  getDocumentCategories2,
  createDocumentCategory,
  updateDocumentCategory,
  deleteDocumentCategory,
  assignDocumentCategories,
  createClientDocument,
  getClientDocuments,
  getClientDocumentById,
  updateClientDocument,
  deleteClientDocument,
  createCategoryAndAssignToDocument,
  removeDocumentCategoryLink,
  getClientSettings,
  updateClientSettings,
} from "../services/client.service.js";
import { uploadToSpaces, deleteFromSpaces } from "../services/storage.service.js";
import { logger } from "../utils/logger.js";
import {
  checkOrganizationNameExists,
  checkClientIdExists,
  validateUniqueFields,
  buildConflictResponse,
} from "../utils/validation-helpers.js";
import { ErrorMessages, handleDatabaseError } from "../utils/error-messages.js";
import {
  parseDatabaseError,
  isDatabaseError,
} from "../utils/database-error-parser.js";

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

    // Handle file uploads for company logo and contact pictures
    const files = req.files as Express.Multer.File[];

    if (files && files.length > 0) {
      // Upload company logo if provided
      const companyLogoFile = files.find((f) => f.fieldname === "companyLogo");
      if (companyLogoFile) {
        try {
          const uploadResult = await uploadToSpaces(
            companyLogoFile.buffer,
            companyLogoFile.originalname,
            "client-logos"
          );
          uploadedLogoUrl = uploadResult.url;
          clientData.companyLogo = uploadedLogoUrl;
        } catch (uploadError: any) {
          logger.logApiError("Company logo upload error", uploadError, req);
          return res.status(500).json({
            success: false,
            message: "Failed to upload company logo. Please try again.",
          });
        }
      }

      // Upload contact pictures if provided and match them to contacts by index
      // Pattern: contactPicture_0, contactPicture_1, etc.
      if (clientData.contacts && Array.isArray(clientData.contacts)) {
        const contactPictureFiles = files.filter((f) =>
          f.fieldname.startsWith("contactPicture_")
        );

        for (const pictureFile of contactPictureFiles) {
          // Extract index from fieldname (e.g., "contactPicture_0" -> 0)
          const match = pictureFile.fieldname.match(/^contactPicture_(\d+)$/);
          if (match && match[1]) {
            const index = parseInt(match[1], 10);
            if (index >= 0 && index < clientData.contacts.length) {
              try {
                const uploadResult = await uploadToSpaces(
                  pictureFile.buffer,
                  pictureFile.originalname,
                  "contact-pictures"
                );
                clientData.contacts[index].picture = uploadResult.url;
              } catch (uploadError: any) {
                logger.logApiError(
                  `Contact picture ${index} upload error`,
                  uploadError,
                  req
                );
                return res.status(500).json({
                  success: false,
                  message: `Failed to upload contact picture for contact ${
                    index + 1
                  }. Please try again.`,
                });
              }
            }
          }
        }
      }
    }

    // Add createdBy
    clientData.createdBy = req.user?.id;

    // Pre-validate unique fields before attempting to create
    const uniqueFieldChecks = [];

    // Check organization name uniqueness
    if (clientData.name) {
      uniqueFieldChecks.push({
        field: "name",
        value: clientData.name,
        checkFunction: () => checkOrganizationNameExists(clientData.name),
        message: `A client with the name '${clientData.name}' already exists`,
      });
    }

    // Check client ID uniqueness
    if (clientData.clientId) {
      uniqueFieldChecks.push({
        field: "clientId",
        value: clientData.clientId,
        checkFunction: () => checkClientIdExists(clientData.clientId),
        message: `Client ID '${clientData.clientId}' is already in use`,
      });
    }

    // Validate all unique fields
    const validationErrors = await validateUniqueFields(uniqueFieldChecks);
    if (validationErrors.length > 0) {
      return res.status(409).json(buildConflictResponse(validationErrors));
    }

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
      message: "An unexpected error occurred while creating the client",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
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
    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
      const companyLogoFile = files.find((f) => f.fieldname === "companyLogo");
      if (companyLogoFile) {
        try {
          const uploadResult = await uploadToSpaces(
            companyLogoFile.buffer,
            companyLogoFile.originalname,
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
    }

    // Get current client data to check for existing logo
    const currentClient = await getClientById(id);
    if (!currentClient) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Handle logo deletion when user sends companyLogo: null
    if (updateData.companyLogo === null && currentClient.logo) {
      try {
        const deleted = await deleteFromSpaces(currentClient.logo);
        if (deleted) {
          logger.info("Company logo deleted from DigitalOcean Spaces");
        }
      } catch (error) {
        logger.logApiError("Error deleting company logo from storage", error, req);
        // Continue with database update even if file deletion fails
      }
      updateData.logo = null;
      delete updateData.companyLogo;
    }
    // Map companyLogo to logo field in database (for new uploads)
    else if (updateData.companyLogo) {
      // Delete old logo if uploading new one
      if (currentClient.logo) {
        try {
          await deleteFromSpaces(currentClient.logo);
          logger.info("Old company logo deleted from DigitalOcean Spaces");
        } catch (error) {
          logger.logApiError("Error deleting old company logo from storage", error, req);
        }
      }
      updateData.logo = updateData.companyLogo;
      delete updateData.companyLogo;
    }

    // Pre-validate unique fields before attempting to update
    const uniqueFieldChecks = [];

    // Get existing client for comparison
    const existingClient = await getClientById(id);
    if (!existingClient) {
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });
    }

    // Check organization name uniqueness (if provided and different from current)
    if (updateData.name && updateData.name !== existingClient.name) {
      uniqueFieldChecks.push({
        field: "name",
        value: updateData.name,
        checkFunction: () => checkOrganizationNameExists(updateData.name, id),
        message: `A client with the name '${updateData.name}' already exists`,
      });
    }

    // Check client ID uniqueness (if provided and different from current)
    if (
      updateData.clientId &&
      updateData.clientId !== existingClient.clientId
    ) {
      uniqueFieldChecks.push({
        field: "clientId",
        value: updateData.clientId,
        checkFunction: () => checkClientIdExists(updateData.clientId, id),
        message: `Client ID '${updateData.clientId}' is already in use`,
      });
    }

    // Validate all unique fields
    const validationErrors = await validateUniqueFields(uniqueFieldChecks);
    if (validationErrors.length > 0) {
      return res.status(409).json(buildConflictResponse(validationErrors));
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
      message: "An unexpected error occurred while updating the client",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
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

// Get all client contacts
export const getClientContactsHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Client ID is required" });
    }

    const contacts = await getClientContacts(id);

    logger.info("Client contacts fetched successfully");
    return res.status(200).json({
      success: true,
      data: contacts,
    });
  } catch (error) {
    logger.logApiError("Error fetching contacts", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch contacts" });
  }
};

// Get single client contact
export const getClientContactByIdHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { contactId } = req.params;

    if (!contactId) {
      return res
        .status(400)
        .json({ success: false, message: "Contact ID is required" });
    }

    const contact = await getClientContactById(contactId);

    if (!contact) {
      return res
        .status(404)
        .json({ success: false, message: "Contact not found" });
    }

    logger.info("Client contact fetched successfully");
    return res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    logger.logApiError("Error fetching contact", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch contact" });
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

// Update client contact
export const updateClientContactHandler = async (
  req: Request,
  res: Response
) => {
  let uploadedPictureUrl: string | null = null;
  try {
    const { contactId } = req.params;

    if (!contactId) {
      return res
        .status(400)
        .json({ success: false, message: "Contact ID is required" });
    }

    // Parse contact data - either from JSON body or from form-data field
    let contactData: any;
    if (req.headers["content-type"]?.includes("application/json")) {
      contactData = req.body;
    } else {
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
        contactData = req.body;
      }
    }

    // Get current contact data to check for existing picture
    const currentContact = await getClientContactById(contactId);
    if (!currentContact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    // Handle picture deletion when user sends picture: null
    if (contactData.picture === null && currentContact.picture) {
      try {
        const deleted = await deleteFromSpaces(currentContact.picture);
        if (deleted) {
          logger.info("Contact picture deleted from DigitalOcean Spaces");
        }
      } catch (error) {
        logger.logApiError("Error deleting contact picture from storage", error, req);
        // Continue with database update even if file deletion fails
      }
    }

    // Handle file upload for contact picture if provided
    const file = req.file;
    if (file) {
      // Delete old picture if uploading new one
      if (currentContact.picture) {
        try {
          await deleteFromSpaces(currentContact.picture);
          logger.info("Old contact picture deleted from DigitalOcean Spaces");
        } catch (error) {
          logger.logApiError("Error deleting old contact picture from storage", error, req);
        }
      }
    }
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

    const contact = await updateClientContact(contactId, contactData);

    if (!contact) {
      return res
        .status(404)
        .json({ success: false, message: "Contact not found" });
    }

    logger.info("Client contact updated successfully");
    return res.status(200).json({
      success: true,
      message: "Contact updated successfully",
      data: contact,
    });
  } catch (error: any) {
    logger.logApiError("Error updating contact", error, req);

    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);
      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
      });
    }

    return res
      .status(500)
      .json({ success: false, message: "Failed to update contact" });
  }
};

// Delete client contact
export const deleteClientContactHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { contactId } = req.params;

    if (!contactId) {
      return res
        .status(400)
        .json({ success: false, message: "Contact ID is required" });
    }

    const contact = await deleteClientContact(contactId);

    if (!contact) {
      return res
        .status(404)
        .json({ success: false, message: "Contact not found" });
    }

    logger.info("Client contact deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Contact deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting contact", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete contact" });
  }
};

// Get all client notes
export const getClientNotesHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Client ID is required" });
    }

    const notes = await getClientNotes(id, limit);

    logger.info("Client notes fetched successfully");
    return res.status(200).json({
      success: true,
      data: notes,
    });
  } catch (error) {
    logger.logApiError("Error fetching notes", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch notes" });
  }
};

// Get single client note
export const getClientNoteByIdHandler = async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;

    if (!noteId) {
      return res
        .status(400)
        .json({ success: false, message: "Note ID is required" });
    }

    const note = await getClientNoteById(noteId);

    if (!note) {
      return res
        .status(404)
        .json({ success: false, message: "Note not found" });
    }

    logger.info("Client note fetched successfully");
    return res.status(200).json({
      success: true,
      data: note,
    });
  } catch (error) {
    logger.logApiError("Error fetching note", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch note" });
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

// Update client note
export const updateClientNoteHandler = async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;

    if (!noteId) {
      return res
        .status(400)
        .json({ success: false, message: "Note ID is required" });
    }

    const note = await updateClientNote(noteId, req.body);

    if (!note) {
      return res
        .status(404)
        .json({ success: false, message: "Note not found" });
    }

    logger.info("Client note updated successfully");
    return res.status(200).json({
      success: true,
      message: "Note updated successfully",
      data: note,
    });
  } catch (error: any) {
    logger.logApiError("Error updating note", error, req);

    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);
      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
      });
    }

    return res
      .status(500)
      .json({ success: false, message: "Failed to update note" });
  }
};

// Delete client note
export const deleteClientNoteHandler = async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;

    if (!noteId) {
      return res
        .status(400)
        .json({ success: false, message: "Note ID is required" });
    }

    const note = await deleteClientNote(noteId);

    if (!note) {
      return res
        .status(404)
        .json({ success: false, message: "Note not found" });
    }

    logger.info("Client note deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Note deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting note", error, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete note" });
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
      message: "An unexpected error occurred while creating the client type",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const updateClientTypeHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Client type ID is required",
      });
    }

    const clientTypeId = parseInt(id);

    if (isNaN(clientTypeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client type ID",
      });
    }

    const clientType = await updateClientType(clientTypeId, req.body);

    if (!clientType) {
      return res.status(404).json({
        success: false,
        message: "Client type not found",
      });
    }

    logger.info("Client type updated successfully");
    return res.status(200).json({
      success: true,
      message: "Client type updated successfully",
      data: clientType,
    });
  } catch (error: any) {
    logger.logApiError("Error updating client type", error, req);

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
      message: "An unexpected error occurred while updating the client type",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deleteClientTypeHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Client type ID is required",
      });
    }

    const clientTypeId = parseInt(id);

    if (isNaN(clientTypeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client type ID",
      });
    }

    const success = await deleteClientType(clientTypeId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Client type not found",
      });
    }

    logger.info("Client type deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Client type deleted successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error deleting client type", error, req);

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
      message: "An unexpected error occurred while deleting the client type",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
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
      message:
        "An unexpected error occurred while creating the industry classification",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const updateIndustryClassificationHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Industry classification ID is required",
      });
    }

    const industryId = parseInt(id);

    if (isNaN(industryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid industry classification ID",
      });
    }

    const industry = await updateIndustryClassification(industryId, req.body);

    if (!industry) {
      return res.status(404).json({
        success: false,
        message: "Industry classification not found",
      });
    }

    logger.info("Industry classification updated successfully");
    return res.status(200).json({
      success: true,
      message: "Industry classification updated successfully",
      data: industry,
    });
  } catch (error: any) {
    logger.logApiError("Error updating industry classification", error, req);

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
      message:
        "An unexpected error occurred while updating the industry classification",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deleteIndustryClassificationHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Industry classification ID is required",
      });
    }

    const industryId = parseInt(id);

    if (isNaN(industryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid industry classification ID",
      });
    }

    const success = await deleteIndustryClassification(industryId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Industry classification not found",
      });
    }

    logger.info("Industry classification deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Industry classification deleted successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error deleting industry classification", error, req);

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
      message:
        "An unexpected error occurred while deleting the industry classification",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
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
      message:
        "An unexpected error occurred while creating the document category",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update document category
export const updateDocumentCategoryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Document category ID is required",
      });
    }

    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document category ID",
      });
    }

    const category = await updateDocumentCategory(categoryId, req.body);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Document category not found",
      });
    }

    logger.info("Document category updated successfully");
    return res.status(200).json({
      success: true,
      message: "Document category updated successfully",
      data: category,
    });
  } catch (error: any) {
    logger.logApiError("Error updating document category", error, req);

    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);

      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while updating the document category",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete document category
export const deleteDocumentCategoryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Document category ID is required",
      });
    }

    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document category ID",
      });
    }

    const category = await deleteDocumentCategory(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Document category not found",
      });
    }

    logger.info("Document category deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Document category deleted successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error deleting document category", error, req);

    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);

      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while deleting the document category",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
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
      message: "An unexpected error occurred while creating the document",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getClientDocumentsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id: organizationId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required",
      });
    }

    const documents = await getClientDocuments(organizationId, limit);

    logger.info("Client documents fetched successfully");
    return res.status(200).json({
      success: true,
      data: documents,
      total: documents.length,
    });
  } catch (error) {
    logger.logApiError("Error fetching client documents", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch client documents",
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

// Update client document
export const updateClientDocumentHandler = async (
  req: Request,
  res: Response
) => {
  let uploadedFileUrl: string | null = null;
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required",
      });
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

    // Get current document to check for existing file
    const currentDocument = await getClientDocumentById(documentId);
    if (!currentDocument) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Handle file replacement if new file is provided
    const file = req.file;
    if (file) {
      // Delete old file from DigitalOcean if it exists
      if (currentDocument.filePath) {
        try {
          await deleteFromSpaces(currentDocument.filePath);
          logger.info("Old document file deleted from DigitalOcean Spaces");
        } catch (error) {
          logger.logApiError("Error deleting old document file from storage", error, req);
        }
      }

      // Upload new file
      try {
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "client-documents"
        );
        uploadedFileUrl = uploadResult.url;
        updateData.filePath = uploadedFileUrl;
        updateData.fileName = file.originalname;
        updateData.fileType = file.mimetype;
        updateData.fileSize = file.size;
      } catch (uploadError: any) {
        logger.logApiError("File upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload new document file. Please try again.",
        });
      }
    }

    const document = await updateClientDocument(documentId, updateData);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    logger.info("Client document updated successfully");
    return res.status(200).json({
      success: true,
      message: "Document updated successfully",
      data: document,
    });
  } catch (error: any) {
    logger.logApiError("Error updating document", error, req);

    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);

      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update document",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
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

    // Get current document to retrieve file path for deletion
    const currentDocument = await getClientDocumentById(documentId);
    if (!currentDocument) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Delete file from DigitalOcean Spaces first
    if (currentDocument.filePath) {
      try {
        const deleted = await deleteFromSpaces(currentDocument.filePath);
        if (deleted) {
          logger.info("Document file deleted from DigitalOcean Spaces");
        }
      } catch (error) {
        logger.logApiError("Error deleting document file from storage", error, req);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Then soft delete from database
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

// Get client settings
export const getClientSettingsHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Client ID is required" });
    }

    const settings = await getClientSettings(id);

    if (!settings) {
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });
    }

    logger.info("Client settings fetched successfully");
    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching client settings", error, req);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch client settings",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
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
      message:
        "An unexpected error occurred while updating the client settings",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
