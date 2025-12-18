import { Router } from "express";
import multer from "multer";
import {
  getClientsHandler,
  getClientByIdHandler,
  createClientHandler,
  updateClientHandler,
  deleteClientHandler,
  createClientContactHandler,
  createClientNoteHandler,
  getClientKPIsHandler,
  getClientTypesHandler,
  createClientTypeHandler,
  getIndustryClassificationsHandler,
  createIndustryClassificationHandler,
  getDocumentCategoriesHandler,
  createDocumentCategoryHandler,
  assignDocumentCategoriesHandler,
  createClientDocumentHandler,
  getClientDocumentByIdHandler,
  deleteClientDocumentHandler,
  createCategoryAndAssignToDocumentHandler,
  getClientDocumentCategoriesHandler,
  removeDocumentCategoryHandler,
  updateClientSettingsHandler,
} from "../../controllers/ClientController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { generalTransformer } from "../../middleware/response-transformer.js";
import {
  getClientsQuerySchema,
  getClientByIdSchema,
  createClientSchema,
  updateClientSchema,
  deleteClientSchema,
  createClientContactSchema,
  createClientNoteSchema,
  createClientTypeSchema,
  createIndustryClassificationSchema,
  createDocumentCategorySchema,
  assignDocumentCategoriesSchema,
  createClientDocumentSchema,
  createCategoryAndAssignToDocumentSchema,
  updateClientSettingsSchema,
} from "../../validations/client.validations.js";

const router = Router();

// Configure multer for memory storage (for company logo + contact pictures upload)
// Using .any() to accept dynamic number of files with pattern matching
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (PNG, JPG, SVG)"));
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
    } catch (error) {
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

// Apply timezone transformation to all GET responses
router.use(generalTransformer);

// Client KPIs route
router.get("/clients/kpis", getClientKPIsHandler);

// Reference data routes
router
  .route("/client-types")
  .get(getClientTypesHandler)
  .post(validate(createClientTypeSchema), createClientTypeHandler);

router
  .route("/industry-classifications")
  .get(getIndustryClassificationsHandler)
  .post(
    validate(createIndustryClassificationSchema),
    createIndustryClassificationHandler
  );

// Main client routes
router
  .route("/clients")
  .get(validate(getClientsQuerySchema), getClientsHandler)
  .post(
    upload,
    handleMulterError,
    parseFormData,
    validate(createClientSchema),
    createClientHandler
  );

router
  .route("/clients/:id")
  .get(validate(getClientByIdSchema), getClientByIdHandler)
  .put(
    upload,
    handleMulterError,
    parseFormData,
    validate(updateClientSchema),
    updateClientHandler
  )
  .delete(validate(deleteClientSchema), deleteClientHandler);

// Client settings route - update only settings fields
router
  .route("/clients/:id/settings")
  .put(validate(updateClientSettingsSchema), updateClientSettingsHandler);

// Client contacts routes
router
  .route("/clients/:id/contacts")
  .post(
    uploadContactPicture,
    handleMulterError,
    validate(createClientContactSchema),
    createClientContactHandler
  );

// Client notes routes
router
  .route("/clients/:id/notes")
  .post(validate(createClientNoteSchema), createClientNoteHandler);

// Client documents routes
router
  .route("/clients/:id/documents")
  .post(
    uploadDocument,
    handleMulterError,
    validate(createClientDocumentSchema),
    createClientDocumentHandler
  );

router
  .route("/clients/:id/documents/:documentId")
  .get(getClientDocumentByIdHandler)
  .delete(deleteClientDocumentHandler);

// Create category and assign to document
router
  .route("/clients/:id/documents/:documentId/categories")
  .post(
    validate(createCategoryAndAssignToDocumentSchema),
    createCategoryAndAssignToDocumentHandler
  );

router
  .route("/clients/:id/documents/:documentId/categories")
  .get(getClientDocumentCategoriesHandler);

// Remove category from document
router
  .route("/clients/:id/documents/:documentId/categories/:categoryId")
  .delete(removeDocumentCategoryHandler);

// Document Categories routes
router
  .route("/document-categories")
  .get(getDocumentCategoriesHandler)
  .post(validate(createDocumentCategorySchema), createDocumentCategoryHandler);

// Document Category Assignment routes
router
  .route("/documents/:documentId/categories")
  .put(
    validate(assignDocumentCategoriesSchema),
    assignDocumentCategoriesHandler
  );

export default router;
