import { Router, type IRouter } from "express";
import multer from "multer";
import {
  getPropertiesHandler,
  getPropertyByIdHandler,
  createPropertyHandler,
  updatePropertyHandler,
  deletePropertyHandler,
  createPropertyContactHandler,
  getPropertyEquipmentHandler,
  getPropertyEquipmentByIdHandler,
  createPropertyEquipmentHandler,
  updatePropertyEquipmentHandler,
  deletePropertyEquipmentHandler,
  createPropertyDocumentHandler,
  createServiceHistoryHandler,
  getPropertyKPIsHandler,
} from "../../controllers/PropertyController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getPropertiesQuerySchema,
  getPropertyByIdSchema,
  createPropertySchema,
  updatePropertySchema,
  deletePropertySchema,
  createPropertyContactSchema,
  getPropertyEquipmentSchema,
  getPropertyEquipmentByIdSchema,
  createPropertyEquipmentSchema,
  updatePropertyEquipmentSchema,
  deletePropertyEquipmentSchema,
  createPropertyDocumentSchema,
  createServiceHistorySchema,
} from "../../validations/property.validations.js";

const router: IRouter = Router();

// Configure multer for document uploads
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
        message: "File size too large. Maximum size is 50MB.",
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

// Apply authentication middleware to all property routes
router.use(authenticate);


// Property KPIs route
router.get("/properties/kpis", getPropertyKPIsHandler);

// Main property routes
router
  .route("/properties")
  .get(validate(getPropertiesQuerySchema), getPropertiesHandler)
  .post(validate(createPropertySchema), createPropertyHandler);

router
  .route("/properties/:id")
  .get(validate(getPropertyByIdSchema), getPropertyByIdHandler)
  .put(validate(updatePropertySchema), updatePropertyHandler)
  .delete(validate(deletePropertySchema), deletePropertyHandler);

// Property contacts routes
router
  .route("/properties/:propertyId/contacts")
  .post(validate(createPropertyContactSchema), createPropertyContactHandler);

// Property equipment routes
router
  .route("/properties/:propertyId/equipment")
  .get(
    validate(getPropertyEquipmentSchema),
    getPropertyEquipmentHandler
  )
  .post(
    validate(createPropertyEquipmentSchema),
    createPropertyEquipmentHandler
  );

router
  .route("/properties/:propertyId/equipment/:id")
  .get(
    validate(getPropertyEquipmentByIdSchema),
    getPropertyEquipmentByIdHandler
  )
  .put(
    validate(updatePropertyEquipmentSchema),
    updatePropertyEquipmentHandler
  )
  .delete(
    validate(deletePropertyEquipmentSchema),
    deletePropertyEquipmentHandler
  );

// Property documents routes
router
  .route("/properties/:propertyId/documents")
  .post(
    (req, res, next) => {
      // Apply multer only if Content-Type is multipart/form-data
      if (req.headers["content-type"]?.includes("multipart/form-data")) {
        uploadDocument(req, res, (err) => {
          if (err) {
            return handleMulterError(err, req, res, next);
          }
          next();
        });
      } else {
        // Skip multer for JSON requests
        next();
      }
    },
    validate(createPropertyDocumentSchema),
    createPropertyDocumentHandler
  );

// Property service history routes
router
  .route("/properties/:propertyId/service-history")
  .post(validate(createServiceHistorySchema), createServiceHistoryHandler);

export default router;
