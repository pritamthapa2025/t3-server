import { Router } from "express";
import {
  getFleetDashboardKPIsHandler,
  getVehiclesHandler,
  getVehicleByIdHandler,
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
} from "../../controllers/FleetController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getFleetDashboardKPIsQuerySchema,
  getVehiclesQuerySchema,
  getVehicleByIdSchema,
  createVehicleSchema,
  updateVehicleSchema,
  deleteVehicleSchema,
  getMaintenanceRecordsQuerySchema,
  getMaintenanceRecordByIdSchema,
  createMaintenanceRecordSchema,
  updateMaintenanceRecordSchema,
  deleteMaintenanceRecordSchema,
  getRepairRecordsQuerySchema,
  getRepairRecordByIdSchema,
  createRepairRecordSchema,
  updateRepairRecordSchema,
  deleteRepairRecordSchema,
  getSafetyInspectionsQuerySchema,
  getSafetyInspectionByIdSchema,
  createSafetyInspectionSchema,
  updateSafetyInspectionSchema,
  deleteSafetyInspectionSchema,
  getSafetyInspectionItemsSchema,
  createSafetyInspectionItemSchema,
  getFuelRecordsQuerySchema,
  getFuelRecordByIdSchema,
  createFuelRecordSchema,
  updateFuelRecordSchema,
  deleteFuelRecordSchema,
  getCheckInOutRecordsQuerySchema,
  getCheckInOutRecordByIdSchema,
  createCheckInOutRecordSchema,
  updateCheckInOutRecordSchema,
  deleteCheckInOutRecordSchema,
} from "../../validations/fleet.validations.js";
import { generalTransformer } from "../../middleware/response-transformer.js";

const router = Router();

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
  getFleetDashboardKPIsHandler
);

// ============================
// Vehicles Routes
// ============================

router
  .route("/vehicles")
  .get(validate(getVehiclesQuerySchema), getVehiclesHandler)
  .post(validate(createVehicleSchema), createVehicleHandler);

router
  .route("/vehicles/:id")
  .get(validate(getVehicleByIdSchema), getVehicleByIdHandler)
  .put(validate(updateVehicleSchema), updateVehicleHandler)
  .delete(validate(deleteVehicleSchema), deleteVehicleHandler);

// ============================
// Maintenance Records Routes
// ============================

router
  .route("/maintenance")
  .get(validate(getMaintenanceRecordsQuerySchema), getMaintenanceRecordsHandler)
  .post(validate(createMaintenanceRecordSchema), createMaintenanceRecordHandler);

router
  .route("/maintenance/:id")
  .get(validate(getMaintenanceRecordByIdSchema), getMaintenanceRecordByIdHandler)
  .put(validate(updateMaintenanceRecordSchema), updateMaintenanceRecordHandler)
  .delete(validate(deleteMaintenanceRecordSchema), deleteMaintenanceRecordHandler);

// ============================
// Repair Records Routes
// ============================

router
  .route("/repairs")
  .get(validate(getRepairRecordsQuerySchema), getRepairRecordsHandler)
  .post(validate(createRepairRecordSchema), createRepairRecordHandler);

router
  .route("/repairs/:id")
  .get(validate(getRepairRecordByIdSchema), getRepairRecordByIdHandler)
  .put(validate(updateRepairRecordSchema), updateRepairRecordHandler)
  .delete(validate(deleteRepairRecordSchema), deleteRepairRecordHandler);

// ============================
// Safety Inspections Routes
// ============================

router
  .route("/inspections")
  .get(validate(getSafetyInspectionsQuerySchema), getSafetyInspectionsHandler)
  .post(validate(createSafetyInspectionSchema), createSafetyInspectionHandler);

router
  .route("/inspections/:id")
  .get(validate(getSafetyInspectionByIdSchema), getSafetyInspectionByIdHandler)
  .put(validate(updateSafetyInspectionSchema), updateSafetyInspectionHandler)
  .delete(validate(deleteSafetyInspectionSchema), deleteSafetyInspectionHandler);

// ============================
// Safety Inspection Items Routes
// ============================

router.get(
  "/inspections/:inspectionId/items",
  validate(getSafetyInspectionItemsSchema),
  getSafetyInspectionItemsHandler
);

router.post(
  "/inspections/items",
  validate(createSafetyInspectionItemSchema),
  createSafetyInspectionItemHandler
);

// ============================
// Fuel Records Routes
// ============================

router
  .route("/fuel")
  .get(validate(getFuelRecordsQuerySchema), getFuelRecordsHandler)
  .post(validate(createFuelRecordSchema), createFuelRecordHandler);

router
  .route("/fuel/:id")
  .get(validate(getFuelRecordByIdSchema), getFuelRecordByIdHandler)
  .put(validate(updateFuelRecordSchema), updateFuelRecordHandler)
  .delete(validate(deleteFuelRecordSchema), deleteFuelRecordHandler);

// ============================
// Check-In/Out Records Routes
// ============================

router
  .route("/check-in-out")
  .get(validate(getCheckInOutRecordsQuerySchema), getCheckInOutRecordsHandler)
  .post(validate(createCheckInOutRecordSchema), createCheckInOutRecordHandler);

router
  .route("/check-in-out/:id")
  .get(validate(getCheckInOutRecordByIdSchema), getCheckInOutRecordByIdHandler)
  .put(validate(updateCheckInOutRecordSchema), updateCheckInOutRecordHandler)
  .delete(validate(deleteCheckInOutRecordSchema), deleteCheckInOutRecordHandler);

export default router;

