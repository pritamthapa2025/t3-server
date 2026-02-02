import { Router } from "express";
import multer from "multer";
import {
  getFleetDashboardKPIsHandler,
  getVehiclesHandler,
  getVehicleByIdHandler,
  getVehicleSettingsHandler,
  updateVehicleSettingsHandler,
  createVehicleHandler,
  updateVehicleHandler,
  deleteVehicleHandler,
  getMaintenanceRecordsHandler,
  getMaintenanceRecordByIdHandler,
  createMaintenanceRecordHandler,
  updateMaintenanceRecordHandler,
  deleteMaintenanceRecordHandler,
  getRepairRecordsHandler,
  getRepairRecordByIdHandler,
  createRepairRecordHandler,
  updateRepairRecordHandler,
  deleteRepairRecordHandler,
  getSafetyInspectionsHandler,
  getSafetyInspectionByIdHandler,
  createSafetyInspectionHandler,
  updateSafetyInspectionHandler,
  deleteSafetyInspectionHandler,
  getSafetyInspectionItemsHandler,
  createSafetyInspectionItemHandler,
  getFuelRecordsHandler,
  getFuelRecordByIdHandler,
  createFuelRecordHandler,
  updateFuelRecordHandler,
  deleteFuelRecordHandler,
  getCheckInOutRecordsHandler,
  getCheckInOutRecordByIdHandler,
  createCheckInOutRecordHandler,
  updateCheckInOutRecordHandler,
  deleteCheckInOutRecordHandler,
  getAssignmentHistoryHandler,
  getVehicleMetricsHandler,
  getVehicleMediaHandler,
  getVehicleMediaByIdHandler,
  createVehicleMediaHandler,
  updateVehicleMediaHandler,
  deleteVehicleMediaHandler,
  getVehicleDocumentsHandler,
  getVehicleDocumentByIdHandler,
  createVehicleDocumentHandler,
  updateVehicleDocumentHandler,
  deleteVehicleDocumentHandler,
} from "../../controllers/FleetController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getFleetDashboardKPIsQuerySchema,
  getVehiclesQuerySchema,
  getVehicleByIdSchema,
  getVehicleSettingsSchema,
  updateVehicleSettingsSchema,
  createVehicleSchema,
  updateVehicleSchema,
  deleteVehicleSchema,
  getMaintenanceRecordsByVehicleQuerySchema,
  createMaintenanceRecordByVehicleSchema,
  getMaintenanceRecordByVehicleByIdSchema,
  updateMaintenanceRecordByVehicleSchema,
  deleteMaintenanceRecordByVehicleSchema,
  getRepairRecordsByVehicleQuerySchema,
  createRepairRecordByVehicleSchema,
  getRepairRecordByVehicleByIdSchema,
  updateRepairRecordByVehicleSchema,
  deleteRepairRecordByVehicleSchema,
  getSafetyInspectionsByVehicleQuerySchema,
  createSafetyInspectionByVehicleSchema,
  getSafetyInspectionByVehicleByIdSchema,
  updateSafetyInspectionByVehicleSchema,
  deleteSafetyInspectionByVehicleSchema,
  getSafetyInspectionItemsByVehicleSchema,
  createSafetyInspectionItemByVehicleSchema,
  getFuelRecordsByVehicleQuerySchema,
  createFuelRecordByVehicleSchema,
  getFuelRecordByVehicleByIdSchema,
  updateFuelRecordByVehicleSchema,
  deleteFuelRecordByVehicleSchema,
  getCheckInOutRecordsByVehicleQuerySchema,
  createCheckInOutRecordByVehicleSchema,
  getCheckInOutRecordByVehicleByIdSchema,
  updateCheckInOutRecordByVehicleSchema,
  deleteCheckInOutRecordByVehicleSchema,
  getAssignmentHistoryByVehicleQuerySchema,
  getVehicleMetricsByVehicleSchema,
  getVehicleMediaByVehicleQuerySchema,
  getVehicleMediaByVehicleByIdSchema,
  createVehicleMediaByVehicleSchema,
  updateVehicleMediaByVehicleSchema,
  deleteVehicleMediaByVehicleSchema,
  getVehicleDocumentsByVehicleQuerySchema,
  getVehicleDocumentByVehicleByIdSchema,
  createVehicleDocumentByVehicleSchema,
  updateVehicleDocumentByVehicleSchema,
  deleteVehicleDocumentByVehicleSchema,
} from "../../validations/fleet.validations.js";
import { generalTransformer } from "../../middleware/response-transformer.js";

const router = Router();

// Configure multer for single vehicle image upload (field name: "vehicle")
const uploadVehicle = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for vehicle image"));
    }
  },
}).single("vehicle");

// Configure multer for safety inspection images (exterior_0, exterior_1, interior_0, interior_1, etc.)
const uploadInspectionImages = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 20, // Maximum 20 files total
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for inspection photos"));
    }
  },
}).any(); // Accept any files with dynamic field names

// Middleware to parse JSON "data" field from multipart/form-data
const parseFormData = (req: any, res: any, next: any) => {
  if (
    req.headers["content-type"]?.includes("multipart/form-data") &&
    req.body?.data
  ) {
    try {
      const parsedData =
        typeof req.body.data === "string"
          ? JSON.parse(req.body.data)
          : req.body.data;
      req.body = { ...parsedData, ...req.body };
      delete req.body.data;
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON in 'data' field",
      });
    }
  }
  next();
};

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
  if (err instanceof Error) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  if (err) {
    return res.status(500).json({
      success: false,
      message: "File upload error",
    });
  }
  next();
};

// Multer for vehicle media (images; optional single file)
const uploadVehicleMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for vehicle media"));
    }
  },
}).single("file");

// Multer for vehicle documents (PDF, images)
const uploadVehicleDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowed =
      file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
    if (allowed) cb(null, true);
    else
      cb(
        new Error(
          "Only images and PDF files are allowed for vehicle documents",
        ),
      );
  },
}).single("file");

// Apply authentication to all routes
router.use(authenticate);

// Apply timezone transformation to all GET responses
router.use(generalTransformer);

// ============================
// Dashboard Routes
// ============================

router.get(
  "/dashboard",
  validate(getFleetDashboardKPIsQuerySchema),
  getFleetDashboardKPIsHandler,
);

// ============================
// Vehicles Routes
// ============================

router
  .route("/vehicles")
  .get(validate(getVehiclesQuerySchema), getVehiclesHandler)
  .post(
    uploadVehicle,
    handleMulterError,
    parseFormData,
    validate(createVehicleSchema),
    createVehicleHandler,
  );

router
  .route("/vehicles/:id")
  .get(validate(getVehicleByIdSchema), getVehicleByIdHandler)
  .put(
    uploadVehicle,
    handleMulterError,
    parseFormData,
    validate(updateVehicleSchema),
    updateVehicleHandler,
  )
  .delete(validate(deleteVehicleSchema), deleteVehicleHandler);

router
  .route("/vehicles/:id/settings")
  .get(validate(getVehicleSettingsSchema), getVehicleSettingsHandler)
  .put(validate(updateVehicleSettingsSchema), updateVehicleSettingsHandler);

// ============================
// Nested: /vehicles/:vehicleId/maintenance | repairs | inspections | fuel | check-in-out
// ============================

router
  .route("/vehicles/:vehicleId/maintenance")
  .get(
    validate(getMaintenanceRecordsByVehicleQuerySchema),
    getMaintenanceRecordsHandler,
  )
  .post(
    validate(createMaintenanceRecordByVehicleSchema),
    createMaintenanceRecordHandler,
  );

router
  .route("/vehicles/:vehicleId/maintenance/:id")
  .get(
    validate(getMaintenanceRecordByVehicleByIdSchema),
    getMaintenanceRecordByIdHandler,
  )
  .put(
    validate(updateMaintenanceRecordByVehicleSchema),
    updateMaintenanceRecordHandler,
  )
  .delete(
    validate(deleteMaintenanceRecordByVehicleSchema),
    deleteMaintenanceRecordHandler,
  );

router
  .route("/vehicles/:vehicleId/repairs")
  .get(validate(getRepairRecordsByVehicleQuerySchema), getRepairRecordsHandler)
  .post(validate(createRepairRecordByVehicleSchema), createRepairRecordHandler);

router
  .route("/vehicles/:vehicleId/repairs/:id")
  .get(validate(getRepairRecordByVehicleByIdSchema), getRepairRecordByIdHandler)
  .put(validate(updateRepairRecordByVehicleSchema), updateRepairRecordHandler)
  .delete(
    validate(deleteRepairRecordByVehicleSchema),
    deleteRepairRecordHandler,
  );

router
  .route("/vehicles/:vehicleId/inspections")
  .get(
    validate(getSafetyInspectionsByVehicleQuerySchema),
    getSafetyInspectionsHandler,
  )
  .post(
    uploadInspectionImages,
    handleMulterError,
    parseFormData,
    validate(createSafetyInspectionByVehicleSchema),
    createSafetyInspectionHandler,
  );

router
  .route("/vehicles/:vehicleId/inspections/:id")
  .get(
    validate(getSafetyInspectionByVehicleByIdSchema),
    getSafetyInspectionByIdHandler,
  )
  .put(
    uploadInspectionImages,
    handleMulterError,
    parseFormData,
    validate(updateSafetyInspectionByVehicleSchema),
    updateSafetyInspectionHandler,
  )
  .delete(
    validate(deleteSafetyInspectionByVehicleSchema),
    deleteSafetyInspectionHandler,
  );

router.get(
  "/vehicles/:vehicleId/inspections/:inspectionId/items",
  validate(getSafetyInspectionItemsByVehicleSchema),
  getSafetyInspectionItemsHandler,
);

router.post(
  "/vehicles/:vehicleId/inspections/items",
  validate(createSafetyInspectionItemByVehicleSchema),
  createSafetyInspectionItemHandler,
);

router
  .route("/vehicles/:vehicleId/fuel")
  .get(validate(getFuelRecordsByVehicleQuerySchema), getFuelRecordsHandler)
  .post(validate(createFuelRecordByVehicleSchema), createFuelRecordHandler);

router
  .route("/vehicles/:vehicleId/fuel/:id")
  .get(validate(getFuelRecordByVehicleByIdSchema), getFuelRecordByIdHandler)
  .put(validate(updateFuelRecordByVehicleSchema), updateFuelRecordHandler)
  .delete(validate(deleteFuelRecordByVehicleSchema), deleteFuelRecordHandler);

router
  .route("/vehicles/:vehicleId/check-in-out")
  .get(
    validate(getCheckInOutRecordsByVehicleQuerySchema),
    getCheckInOutRecordsHandler,
  )
  .post(
    validate(createCheckInOutRecordByVehicleSchema),
    createCheckInOutRecordHandler,
  );

router
  .route("/vehicles/:vehicleId/check-in-out/:id")
  .get(
    validate(getCheckInOutRecordByVehicleByIdSchema),
    getCheckInOutRecordByIdHandler,
  )
  .put(
    validate(updateCheckInOutRecordByVehicleSchema),
    updateCheckInOutRecordHandler,
  )
  .delete(
    validate(deleteCheckInOutRecordByVehicleSchema),
    deleteCheckInOutRecordHandler,
  );

// ============================
// Assignment History Routes (by vehicle)
// ============================

router.get(
  "/vehicles/:vehicleId/assignment-history",
  validate(getAssignmentHistoryByVehicleQuerySchema),
  getAssignmentHistoryHandler,
);

router.get(
  "/vehicles/:vehicleId/metrics",
  validate(getVehicleMetricsByVehicleSchema),
  getVehicleMetricsHandler,
);

// ============================
// Vehicle Media Routes (by vehicle)
// ============================

router
  .route("/vehicles/:vehicleId/media")
  .get(validate(getVehicleMediaByVehicleQuerySchema), getVehicleMediaHandler)
  .post(
    uploadVehicleMedia,
    handleMulterError,
    validate(createVehicleMediaByVehicleSchema),
    createVehicleMediaHandler,
  );

router
  .route("/vehicles/:vehicleId/media/:id")
  .get(validate(getVehicleMediaByVehicleByIdSchema), getVehicleMediaByIdHandler)
  .put(
    uploadVehicleMedia,
    handleMulterError,
    validate(updateVehicleMediaByVehicleSchema),
    updateVehicleMediaHandler,
  )
  .delete(
    validate(deleteVehicleMediaByVehicleSchema),
    deleteVehicleMediaHandler,
  );

// ============================
// Vehicle Documents Routes (by vehicle)
// ============================

router
  .route("/vehicles/:vehicleId/documents")
  .get(
    validate(getVehicleDocumentsByVehicleQuerySchema),
    getVehicleDocumentsHandler,
  )
  .post(
    uploadVehicleDocument,
    handleMulterError,
    validate(createVehicleDocumentByVehicleSchema),
    createVehicleDocumentHandler,
  );

router
  .route("/vehicles/:vehicleId/documents/:id")
  .get(
    validate(getVehicleDocumentByVehicleByIdSchema),
    getVehicleDocumentByIdHandler,
  )
  .put(
    uploadVehicleDocument,
    handleMulterError,
    validate(updateVehicleDocumentByVehicleSchema),
    updateVehicleDocumentHandler,
  )
  .delete(
    validate(deleteVehicleDocumentByVehicleSchema),
    deleteVehicleDocumentHandler,
  );

export default router;
