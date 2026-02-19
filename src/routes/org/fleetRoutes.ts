import { Router, type IRouter } from "express";
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
  getVehicleDocumentPresignedUrlHandler,
  createVehicleDocumentHandler,
  updateVehicleDocumentHandler,
  deleteVehicleDocumentHandler,
  bulkDeleteVehiclesHandler,
} from "../../controllers/FleetController.js";
import { authenticate } from "../../middleware/auth.js";
import {
  authorizeFeature,
  authorizeAnyFeature,
} from "../../middleware/featureAuthorize.js";
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
  getVehicleDocumentPresignedUrlSchema,
  createVehicleDocumentByVehicleSchema,
  updateVehicleDocumentByVehicleSchema,
  deleteVehicleDocumentByVehicleSchema,
} from "../../validations/fleet.validations.js";
import { bulkDeleteUuidSchema } from "../../validations/bulk-delete.validations.js";

const router: IRouter = Router();

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

// Multer for vehicle documents (PDF, images) - accept "file" or "document" field name
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
}).fields([
  { name: "file", maxCount: 1 },
  { name: "document", maxCount: 1 },
]);

// Normalize vehicle document upload: set req.file from whichever field was used
const normalizeVehicleDocumentFile = (req: any, _res: any, next: any) => {
  if (req.file) return next();
  const files = req.files as
    | { file?: Express.Multer.File[]; document?: Express.Multer.File[] }
    | undefined;
  if (files?.file?.[0]) req.file = files.file[0];
  else if (files?.document?.[0]) req.file = files.document[0];
  next();
};

// Apply authentication to all routes
router.use(authenticate);


// Feature shorthand constants based on seed data:
// view_fleet: Technician=view_assigned, Manager=view, Executive=admin
// add_vehicle: Technician=none, Manager=none, Executive=admin
// edit_vehicle_info: Technician=none, Manager=edit_all, Executive=admin
// delete_vehicle: Technician=none, Manager=none, Executive=admin
const viewFleet = authorizeFeature("fleet", "view_fleet");
const addVehicle = authorizeFeature("fleet", "add_vehicle");
const editVehicle = authorizeAnyFeature("fleet", [
  "edit_vehicle_info",
  "edit_vehicle",
]);
const deleteVehicle = authorizeFeature("fleet", "delete_vehicle");

// ============================
// Dashboard Routes — all fleet viewers
// ============================

router.get(
  "/dashboard",
  viewFleet,
  validate(getFleetDashboardKPIsQuerySchema),
  getFleetDashboardKPIsHandler,
);

// ============================
// Vehicles Routes
// ============================

router
  .route("/vehicles")
  .get(viewFleet, validate(getVehiclesQuerySchema), getVehiclesHandler)
  .post(
    addVehicle, // Executive only
    uploadVehicle,
    handleMulterError,
    parseFormData,
    validate(createVehicleSchema),
    createVehicleHandler,
  );

router
  .route("/vehicles/:id")
  .get(viewFleet, validate(getVehicleByIdSchema), getVehicleByIdHandler)
  .put(
    editVehicle, // Manager/Executive
    uploadVehicle,
    handleMulterError,
    parseFormData,
    validate(updateVehicleSchema),
    updateVehicleHandler,
  )
  .delete(deleteVehicle, validate(deleteVehicleSchema), deleteVehicleHandler); // Executive only

// Vehicle settings — Manager/Executive only (financial and operational settings)
router
  .route("/vehicles/:id/settings")
  .get(
    editVehicle,
    validate(getVehicleSettingsSchema),
    getVehicleSettingsHandler,
  )
  .put(
    editVehicle,
    validate(updateVehicleSettingsSchema),
    updateVehicleSettingsHandler,
  );

// ============================
// Nested: /vehicles/:vehicleId/maintenance | repairs | inspections | fuel | check-in-out
// ============================

// Maintenance: Technicians can view + submit their assigned; Managers/Executives manage all
router
  .route("/vehicles/:vehicleId/maintenance")
  .get(
    viewFleet,
    validate(getMaintenanceRecordsByVehicleQuerySchema),
    getMaintenanceRecordsHandler,
  )
  .post(
    viewFleet, // Technicians can submit maintenance records for their assigned vehicles
    validate(createMaintenanceRecordByVehicleSchema),
    createMaintenanceRecordHandler,
  );

router
  .route("/vehicles/:vehicleId/maintenance/:id")
  .get(
    viewFleet,
    validate(getMaintenanceRecordByVehicleByIdSchema),
    getMaintenanceRecordByIdHandler,
  )
  .put(
    editVehicle, // Manager/Executive only
    validate(updateMaintenanceRecordByVehicleSchema),
    updateMaintenanceRecordHandler,
  )
  .delete(
    editVehicle, // Manager/Executive only
    validate(deleteMaintenanceRecordByVehicleSchema),
    deleteMaintenanceRecordHandler,
  );

// Repairs: Technicians can view assigned; Managers/Executives manage all
router
  .route("/vehicles/:vehicleId/repairs")
  .get(
    viewFleet,
    validate(getRepairRecordsByVehicleQuerySchema),
    getRepairRecordsHandler,
  )
  .post(
    viewFleet,
    validate(createRepairRecordByVehicleSchema),
    createRepairRecordHandler,
  );

router
  .route("/vehicles/:vehicleId/repairs/:id")
  .get(
    viewFleet,
    validate(getRepairRecordByVehicleByIdSchema),
    getRepairRecordByIdHandler,
  )
  .put(
    editVehicle,
    validate(updateRepairRecordByVehicleSchema),
    updateRepairRecordHandler,
  )
  .delete(
    editVehicle,
    validate(deleteRepairRecordByVehicleSchema),
    deleteRepairRecordHandler,
  );

// Safety Inspections: Technicians can view + perform on assigned vehicles
router
  .route("/vehicles/:vehicleId/inspections")
  .get(
    viewFleet,
    validate(getSafetyInspectionsByVehicleQuerySchema),
    getSafetyInspectionsHandler,
  )
  .post(
    viewFleet, // Technicians can perform safety inspections on assigned vehicles
    uploadInspectionImages,
    handleMulterError,
    parseFormData,
    validate(createSafetyInspectionByVehicleSchema),
    createSafetyInspectionHandler,
  );

router
  .route("/vehicles/:vehicleId/inspections/:id")
  .get(
    viewFleet,
    validate(getSafetyInspectionByVehicleByIdSchema),
    getSafetyInspectionByIdHandler,
  )
  .put(
    viewFleet, // Technicians can update their own inspections
    uploadInspectionImages,
    handleMulterError,
    parseFormData,
    validate(updateSafetyInspectionByVehicleSchema),
    updateSafetyInspectionHandler,
  )
  .delete(
    editVehicle, // Manager/Executive only
    validate(deleteSafetyInspectionByVehicleSchema),
    deleteSafetyInspectionHandler,
  );

router.get(
  "/vehicles/:vehicleId/inspections/:inspectionId/items",
  viewFleet,
  validate(getSafetyInspectionItemsByVehicleSchema),
  getSafetyInspectionItemsHandler,
);

router.post(
  "/vehicles/:vehicleId/inspections/items",
  viewFleet,
  validate(createSafetyInspectionItemByVehicleSchema),
  createSafetyInspectionItemHandler,
);

// Fuel: Technicians can view + record for assigned vehicles
router
  .route("/vehicles/:vehicleId/fuel")
  .get(
    viewFleet,
    validate(getFuelRecordsByVehicleQuerySchema),
    getFuelRecordsHandler,
  )
  .post(
    viewFleet,
    validate(createFuelRecordByVehicleSchema),
    createFuelRecordHandler,
  );

router
  .route("/vehicles/:vehicleId/fuel/:id")
  .get(
    viewFleet,
    validate(getFuelRecordByVehicleByIdSchema),
    getFuelRecordByIdHandler,
  )
  .put(
    viewFleet,
    validate(updateFuelRecordByVehicleSchema),
    updateFuelRecordHandler,
  )
  .delete(
    editVehicle,
    validate(deleteFuelRecordByVehicleSchema),
    deleteFuelRecordHandler,
  );

// Check-In/Out: Technicians can check in/out assigned vehicles
router
  .route("/vehicles/:vehicleId/check-in-out")
  .get(
    viewFleet,
    validate(getCheckInOutRecordsByVehicleQuerySchema),
    getCheckInOutRecordsHandler,
  )
  .post(
    viewFleet,
    validate(createCheckInOutRecordByVehicleSchema),
    createCheckInOutRecordHandler,
  );

router
  .route("/vehicles/:vehicleId/check-in-out/:id")
  .get(
    viewFleet,
    validate(getCheckInOutRecordByVehicleByIdSchema),
    getCheckInOutRecordByIdHandler,
  )
  .put(
    viewFleet,
    validate(updateCheckInOutRecordByVehicleSchema),
    updateCheckInOutRecordHandler,
  )
  .delete(
    editVehicle,
    validate(deleteCheckInOutRecordByVehicleSchema),
    deleteCheckInOutRecordHandler,
  );

// ============================
// Assignment History Routes — all fleet viewers
// ============================

router.get(
  "/vehicles/:vehicleId/assignment-history",
  viewFleet,
  validate(getAssignmentHistoryByVehicleQuerySchema),
  getAssignmentHistoryHandler,
);

// Metrics — Manager/Executive only (financial and cost data)
router.get(
  "/vehicles/:vehicleId/metrics",
  editVehicle,
  validate(getVehicleMetricsByVehicleSchema),
  getVehicleMetricsHandler,
);

// ============================
// Vehicle Media Routes — Technicians can view + upload for assigned vehicles
// ============================

router
  .route("/vehicles/:vehicleId/media")
  .get(
    viewFleet,
    validate(getVehicleMediaByVehicleQuerySchema),
    getVehicleMediaHandler,
  )
  .post(
    viewFleet, // Technicians can upload photos for assigned vehicles
    uploadVehicleMedia,
    handleMulterError,
    validate(createVehicleMediaByVehicleSchema),
    createVehicleMediaHandler,
  );

router
  .route("/vehicles/:vehicleId/media/:id")
  .get(
    viewFleet,
    validate(getVehicleMediaByVehicleByIdSchema),
    getVehicleMediaByIdHandler,
  )
  .put(
    viewFleet,
    uploadVehicleMedia,
    handleMulterError,
    validate(updateVehicleMediaByVehicleSchema),
    updateVehicleMediaHandler,
  )
  .delete(
    editVehicle, // Manager/Executive can delete media
    validate(deleteVehicleMediaByVehicleSchema),
    deleteVehicleMediaHandler,
  );

// ============================
// Vehicle Documents Routes — Technicians can view + submit for assigned vehicles
// ============================

// Presigned URL for direct upload
router.post(
  "/vehicles/:vehicleId/documents/presigned-url",
  viewFleet,
  validate(getVehicleDocumentPresignedUrlSchema),
  getVehicleDocumentPresignedUrlHandler,
);

router
  .route("/vehicles/:vehicleId/documents")
  .get(
    viewFleet,
    validate(getVehicleDocumentsByVehicleQuerySchema),
    getVehicleDocumentsHandler,
  )
  .post(
    viewFleet, // Technicians can submit documents (requires approval)
    uploadVehicleDocument,
    normalizeVehicleDocumentFile,
    handleMulterError,
    validate(createVehicleDocumentByVehicleSchema),
    createVehicleDocumentHandler,
  );

router
  .route("/vehicles/:vehicleId/documents/:id")
  .get(
    viewFleet,
    validate(getVehicleDocumentByVehicleByIdSchema),
    getVehicleDocumentByIdHandler,
  )
  .put(
    editVehicle, // Manager/Executive can edit documents
    uploadVehicleDocument,
    normalizeVehicleDocumentFile,
    handleMulterError,
    validate(updateVehicleDocumentByVehicleSchema),
    updateVehicleDocumentHandler,
  )
  .delete(
    editVehicle, // Manager/Executive can delete documents
    validate(deleteVehicleDocumentByVehicleSchema),
    deleteVehicleDocumentHandler,
  );

// Bulk delete vehicles (Executive only)
router.post(
  "/vehicles/bulk-delete",
  authorizeFeature("fleet", "bulk_delete"),
  validate(bulkDeleteUuidSchema),
  bulkDeleteVehiclesHandler,
);

export default router;
