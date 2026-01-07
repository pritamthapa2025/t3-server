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

router.get(
  "/vehicles",
  validate(getVehiclesQuerySchema),
  getVehiclesHandler
);

router.get(
  "/vehicles/:id",
  validate(getVehicleByIdSchema),
  getVehicleByIdHandler
);

router.post(
  "/vehicles",
  validate(createVehicleSchema),
  createVehicleHandler
);

router.put(
  "/vehicles/:id",
  validate(updateVehicleSchema),
  updateVehicleHandler
);

router.delete(
  "/vehicles/:id",
  validate(deleteVehicleSchema),
  deleteVehicleHandler
);

// ============================
// Maintenance Records Routes
// ============================

router.get(
  "/maintenance",
  validate(getMaintenanceRecordsQuerySchema),
  getMaintenanceRecordsHandler
);

router.get(
  "/maintenance/:id",
  validate(getMaintenanceRecordByIdSchema),
  getMaintenanceRecordByIdHandler
);

router.post(
  "/maintenance",
  validate(createMaintenanceRecordSchema),
  createMaintenanceRecordHandler
);

router.put(
  "/maintenance/:id",
  validate(updateMaintenanceRecordSchema),
  updateMaintenanceRecordHandler
);

router.delete(
  "/maintenance/:id",
  validate(deleteMaintenanceRecordSchema),
  deleteMaintenanceRecordHandler
);

// ============================
// Repair Records Routes
// ============================

router.get(
  "/repairs",
  validate(getRepairRecordsQuerySchema),
  getRepairRecordsHandler
);

router.get(
  "/repairs/:id",
  validate(getRepairRecordByIdSchema),
  getRepairRecordByIdHandler
);

router.post(
  "/repairs",
  validate(createRepairRecordSchema),
  createRepairRecordHandler
);

router.put(
  "/repairs/:id",
  validate(updateRepairRecordSchema),
  updateRepairRecordHandler
);

router.delete(
  "/repairs/:id",
  validate(deleteRepairRecordSchema),
  deleteRepairRecordHandler
);

// ============================
// Safety Inspections Routes
// ============================

router.get(
  "/inspections",
  validate(getSafetyInspectionsQuerySchema),
  getSafetyInspectionsHandler
);

router.get(
  "/inspections/:id",
  validate(getSafetyInspectionByIdSchema),
  getSafetyInspectionByIdHandler
);

router.post(
  "/inspections",
  validate(createSafetyInspectionSchema),
  createSafetyInspectionHandler
);

router.put(
  "/inspections/:id",
  validate(updateSafetyInspectionSchema),
  updateSafetyInspectionHandler
);

router.delete(
  "/inspections/:id",
  validate(deleteSafetyInspectionSchema),
  deleteSafetyInspectionHandler
);

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

router.get(
  "/fuel",
  validate(getFuelRecordsQuerySchema),
  getFuelRecordsHandler
);

router.get(
  "/fuel/:id",
  validate(getFuelRecordByIdSchema),
  getFuelRecordByIdHandler
);

router.post(
  "/fuel",
  validate(createFuelRecordSchema),
  createFuelRecordHandler
);

router.put(
  "/fuel/:id",
  validate(updateFuelRecordSchema),
  updateFuelRecordHandler
);

router.delete(
  "/fuel/:id",
  validate(deleteFuelRecordSchema),
  deleteFuelRecordHandler
);

// ============================
// Check-In/Out Records Routes
// ============================

router.get(
  "/check-in-out",
  validate(getCheckInOutRecordsQuerySchema),
  getCheckInOutRecordsHandler
);

router.get(
  "/check-in-out/:id",
  validate(getCheckInOutRecordByIdSchema),
  getCheckInOutRecordByIdHandler
);

router.post(
  "/check-in-out",
  validate(createCheckInOutRecordSchema),
  createCheckInOutRecordHandler
);

router.put(
  "/check-in-out/:id",
  validate(updateCheckInOutRecordSchema),
  updateCheckInOutRecordHandler
);

router.delete(
  "/check-in-out/:id",
  validate(deleteCheckInOutRecordSchema),
  deleteCheckInOutRecordHandler
);

export default router;

