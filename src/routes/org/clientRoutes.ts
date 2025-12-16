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
  // createClientDocumentHandler,
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
  // createClientDocumentSchema,
} from "../../validations/client.validations.js";

const router = Router();

// Configure multer for memory storage (for company logo upload)
const upload = multer({
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
}).single("companyLogo"); // Handle the companyLogo field

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

// Apply authentication middleware to all client routes
router.use(authenticate);

// Apply timezone transformation to all GET responses
router.use(generalTransformer);

// Client KPIs route
router.get("/clients/kpis", getClientKPIsHandler);

// Main client routes
router
  .route("/clients")
  .get(validate(getClientsQuerySchema), getClientsHandler)
  .post(
    upload,
    handleMulterError,
    validate(createClientSchema),
    createClientHandler
  );

router
  .route("/clients/:id")
  .get(validate(getClientByIdSchema), getClientByIdHandler)
  .put(
    upload,
    handleMulterError,
    validate(updateClientSchema),
    updateClientHandler
  )
  .delete(validate(deleteClientSchema), deleteClientHandler);

// Client contacts routes
router
  .route("/clients/:clientId/contacts")
  .post(validate(createClientContactSchema), createClientContactHandler);

// Client notes routes
router
  .route("/clients/:clientId/notes")
  .post(validate(createClientNoteSchema), createClientNoteHandler);

// Client documents routes (coming soon)
// router
//   .route("/clients/:clientId/documents")
//   .post(validate(createClientDocumentSchema), createClientDocumentHandler);

export default router;
