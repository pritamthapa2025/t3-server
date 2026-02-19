import { Router, type IRouter } from "express";
import multer from "multer";
import {
  getClientsHandler,
  getClientByIdHandler,
  createClientHandler,
  updateClientHandler,
  deleteClientHandler,
  getClientContactsHandler,
  getClientContactByIdHandler,
  createClientContactHandler,
  updateClientContactHandler,
  deleteClientContactHandler,
  getClientNotesHandler,
  getClientNoteByIdHandler,
  createClientNoteHandler,
  updateClientNoteHandler,
  deleteClientNoteHandler,
  getClientKPIsHandler,
  getClientTypesHandler,
  getClientTypeByIdHandler,
  createClientTypeHandler,
  updateClientTypeHandler,
  deleteClientTypeHandler,
  getIndustryClassificationsHandler,
  getIndustryClassificationByIdHandler,
  createIndustryClassificationHandler,
  updateIndustryClassificationHandler,
  deleteIndustryClassificationHandler,
  getDocumentCategoriesHandler,
  getDocumentCategoryByIdHandler,
  createDocumentCategoryHandler,
  updateDocumentCategoryHandler,
  deleteDocumentCategoryHandler,
  assignDocumentCategoriesHandler,
  createClientDocumentHandler,
  getClientDocumentsHandler,
  getClientDocumentByIdHandler,
  updateClientDocumentHandler,
  deleteClientDocumentHandler,
  createCategoryAndAssignToDocumentHandler,
  getClientDocumentCategoriesHandler,
  removeDocumentCategoryHandler,
  getClientSettingsHandler,
  updateClientSettingsHandler,
  bulkDeleteClientsHandler,
} from "../../controllers/ClientController.js";
import { authenticate } from "../../middleware/auth.js";
import { authorizeFeature } from "../../middleware/featureAuthorize.js";
import { validate } from "../../middleware/validate.js";
import { bulkDeleteUuidSchema } from "../../validations/bulk-delete.validations.js";
import {
  getClientsQuerySchema,
  getClientByIdSchema,
  createClientSchema,
  updateClientSchema,
  deleteClientSchema,
  getClientContactsSchema,
  getClientContactByIdSchema,
  createClientContactSchema,
  updateClientContactSchema,
  deleteClientContactSchema,
  getClientNotesSchema,
  getClientNoteByIdSchema,
  createClientNoteSchema,
  updateClientNoteSchema,
  deleteClientNoteSchema,
  createClientTypeSchema,
  getClientTypeByIdSchema,
  updateClientTypeSchema,
  createIndustryClassificationSchema,
  getIndustryClassificationByIdSchema,
  updateIndustryClassificationSchema,
  createDocumentCategorySchema,
  getDocumentCategoryByIdSchema,
  updateDocumentCategorySchema,
  deleteDocumentCategorySchema,
  assignDocumentCategoriesSchema,
  createClientDocumentSchema,
  getClientDocumentsSchema,
  updateClientDocumentSchema,
  createCategoryAndAssignToDocumentSchema,
  getClientSettingsSchema,
  updateClientSettingsSchema,
} from "../../validations/client.validations.js";

const router: IRouter = Router();

// Configure multer for memory storage (for company logo + contact pictures upload)
// Using .any() to accept dynamic number of files with pattern matching
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
  fileFilter: (req, file, cb) => {
    // Accept image files and common document types
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/msword" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.mimetype === "text/plain" ||
      file.mimetype === "text/csv"
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only image files and documents are allowed (PNG, JPG, SVG, PDF, DOC, DOCX, XLSX, XLS, CSV, TXT)",
        ),
      );
    }
  },
}).any(); // Accept any files - controller will handle companyLogo and contactPicture_X pattern

// Configure multer for contact picture uploads
const uploadContactPicture = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (PNG, JPG, SVG)"));
    }
  },
}).single("contactPicture"); // Handle the contactPicture field

// Configure multer for document uploads (all file types)
const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for documents
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types for documents
    cb(null, true);
  },
}).single("document"); // Handle the document field

// Multer error handler middleware
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB.",
      });
    }
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

// Middleware to parse JSON data field from multipart/form-data
const parseFormData = (req: any, res: any, next: any) => {
  if (req.body && req.body.data) {
    try {
      // Parse the stringified JSON data field
      const parsedData = JSON.parse(req.body.data);
      // Replace req.body with the parsed data, preserving files
      req.body = parsedData;
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON data in request body",
      });
    }
  }
  next();
};

// Apply authentication middleware to all client routes
router.use(authenticate);


// Feature shorthand constants
// Technicians can view basic info; Managers/Executives have full access
const viewClients = authorizeFeature("clients", "view_clients");
const createClient = authorizeFeature("clients", "create_client");
const editClient = authorizeFeature("clients", "edit_client");
const deleteClient = authorizeFeature("clients", "delete_client");
const addContacts = authorizeFeature("clients", "add_contacts");
const viewFinancial = authorizeFeature("clients", "view_financial_info");

// Client KPIs route — Manager/Executive only (financial data)
router.get("/clients/kpis", viewFinancial, getClientKPIsHandler);

// Reference data routes — Manager/Executive only (write); all can read
router
  .route("/client-types")
  .get(viewClients, getClientTypesHandler)
  .post(editClient, validate(createClientTypeSchema), createClientTypeHandler);

router
  .route("/client-types/:id")
  .get(viewClients, validate(getClientTypeByIdSchema), getClientTypeByIdHandler)
  .put(editClient, validate(updateClientTypeSchema), updateClientTypeHandler)
  .delete(editClient, deleteClientTypeHandler);

router
  .route("/industry-classifications")
  .get(viewClients, getIndustryClassificationsHandler)
  .post(
    editClient,
    validate(createIndustryClassificationSchema),
    createIndustryClassificationHandler,
  );

router
  .route("/industry-classifications/:id")
  .get(
    viewClients,
    validate(getIndustryClassificationByIdSchema),
    getIndustryClassificationByIdHandler,
  )
  .put(
    editClient,
    validate(updateIndustryClassificationSchema),
    updateIndustryClassificationHandler,
  )
  .delete(editClient, deleteIndustryClassificationHandler);

// Main client routes
router
  .route("/clients")
  .get(viewClients, validate(getClientsQuerySchema), getClientsHandler)
  .post(
    createClient,
    upload,
    handleMulterError,
    parseFormData,
    validate(createClientSchema),
    createClientHandler,
  );

router
  .route("/clients/:id")
  .get(viewClients, validate(getClientByIdSchema), getClientByIdHandler)
  .put(
    editClient,
    upload,
    handleMulterError,
    parseFormData,
    validate(updateClientSchema),
    updateClientHandler,
  )
  .delete(deleteClient, validate(deleteClientSchema), deleteClientHandler);

// Client settings routes — Manager/Executive (financial/billing settings)
router
  .route("/clients/:id/settings")
  .get(
    viewFinancial,
    validate(getClientSettingsSchema),
    getClientSettingsHandler,
  )
  .put(
    editClient,
    validate(updateClientSettingsSchema),
    updateClientSettingsHandler,
  );

// Client contacts routes — Technicians can view; Managers/Executives can manage
router
  .route("/clients/:id/contacts")
  .get(viewClients, validate(getClientContactsSchema), getClientContactsHandler)
  .post(
    addContacts,
    uploadContactPicture,
    handleMulterError,
    validate(createClientContactSchema),
    createClientContactHandler,
  );

router
  .route("/clients/:id/contacts/:contactId")
  .get(
    viewClients,
    validate(getClientContactByIdSchema),
    getClientContactByIdHandler,
  )
  .put(
    addContacts,
    uploadContactPicture,
    handleMulterError,
    validate(updateClientContactSchema),
    updateClientContactHandler,
  )
  .delete(
    addContacts,
    validate(deleteClientContactSchema),
    deleteClientContactHandler,
  );

// Client notes routes — all viewers can read; Manager/Executive can manage
router
  .route("/clients/:id/notes")
  .get(viewClients, validate(getClientNotesSchema), getClientNotesHandler)
  .post(editClient, validate(createClientNoteSchema), createClientNoteHandler);

router
  .route("/clients/:id/notes/:noteId")
  .get(viewClients, validate(getClientNoteByIdSchema), getClientNoteByIdHandler)
  .put(editClient, validate(updateClientNoteSchema), updateClientNoteHandler)
  .delete(
    editClient,
    validate(deleteClientNoteSchema),
    deleteClientNoteHandler,
  );

// Client documents routes — Technician can upload job-related; Manager/Executive manage all
router
  .route("/clients/:id/documents")
  .get(
    viewClients,
    validate(getClientDocumentsSchema),
    getClientDocumentsHandler,
  )
  .post(
    viewClients,
    uploadDocument,
    handleMulterError,
    validate(createClientDocumentSchema),
    createClientDocumentHandler,
  );

router
  .route("/clients/:id/documents/:documentId")
  .get(viewClients, getClientDocumentByIdHandler)
  .put(
    editClient,
    uploadDocument,
    handleMulterError,
    validate(updateClientDocumentSchema),
    updateClientDocumentHandler,
  )
  .delete(editClient, deleteClientDocumentHandler);

// Create category and assign to document — Manager/Executive only
router
  .route("/clients/:id/documents/:documentId/categories")
  .post(
    editClient,
    validate(createCategoryAndAssignToDocumentSchema),
    createCategoryAndAssignToDocumentHandler,
  );

router
  .route("/clients/:id/documents/:documentId/categories")
  .get(viewClients, getClientDocumentCategoriesHandler);

// Remove category from document — Manager/Executive only
router
  .route("/clients/:id/documents/:documentId/categories/:categoryId")
  .delete(editClient, removeDocumentCategoryHandler);

// Document Categories routes — all can view; Manager/Executive can manage
router
  .route("/document-categories")
  .get(viewClients, getDocumentCategoriesHandler)
  .post(
    editClient,
    validate(createDocumentCategorySchema),
    createDocumentCategoryHandler,
  );

router
  .route("/document-categories/:id")
  .get(
    viewClients,
    validate(getDocumentCategoryByIdSchema),
    getDocumentCategoryByIdHandler,
  )
  .put(
    editClient,
    validate(updateDocumentCategorySchema),
    updateDocumentCategoryHandler,
  )
  .delete(
    editClient,
    validate(deleteDocumentCategorySchema),
    deleteDocumentCategoryHandler,
  );

// Document Category Assignment routes — Manager/Executive only
router
  .route("/documents/:documentId/categories")
  .put(
    editClient,
    validate(assignDocumentCategoriesSchema),
    assignDocumentCategoriesHandler,
  );

// Bulk delete clients (Executive only)
router.post(
  "/clients/bulk-delete",
  authorizeFeature("clients", "bulk_delete"),
  validate(bulkDeleteUuidSchema),
  bulkDeleteClientsHandler,
);

export default router;
