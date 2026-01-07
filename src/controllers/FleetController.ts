import type { Request, Response } from "express";
import {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getMaintenanceRecords,
  getMaintenanceRecordById,
  createMaintenanceRecord,
  updateMaintenanceRecord,
  deleteMaintenanceRecord,
  getRepairRecords,
  getRepairRecordById,
  createRepairRecord,
  updateRepairRecord,
  deleteRepairRecord,
  getSafetyInspections,
  getSafetyInspectionById,
  createSafetyInspection,
  updateSafetyInspection,
  deleteSafetyInspection,
  getSafetyInspectionItems,
  createSafetyInspectionItem,
  getFuelRecords,
  getFuelRecordById,
  createFuelRecord,
  updateFuelRecord,
  deleteFuelRecord,
  getCheckInOutRecords,
  getCheckInOutRecordById,
  createCheckInOutRecord,
  updateCheckInOutRecord,
  deleteCheckInOutRecord,
  getFleetDashboardKPIs,
} from "../services/fleet.service.js";
import { logger } from "../utils/logger.js";

// ============================
// DASHBOARD KPIs HANDLERS
// ============================

export const getFleetDashboardKPIsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const kpis = await getFleetDashboardKPIs();

    logger.info("Fleet dashboard KPIs fetched successfully");
    return res.status(200).json({
      success: true,
      data: kpis,
    });
  } catch (error) {
    logger.logApiError("Error fetching fleet dashboard KPIs", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// VEHICLES HANDLERS
// ============================

export const getVehiclesHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const {
      search,
      status,
      type,
      assignedToEmployeeId,
      sortBy,
      sortOrder,
    } = req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};

    if (search) filters.search = search as string;
    if (status) filters.status = status as string;
    if (type) filters.type = type as string;
    if (assignedToEmployeeId)
      filters.assignedToEmployeeId = parseInt(assignedToEmployeeId as string);
    if (sortBy) filters.sortBy = sortBy as string;
    if (sortOrder) filters.sortOrder = sortOrder as "asc" | "desc";

    const result = await getVehicles(offset, limit, filters);

    logger.info("Vehicles fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching vehicles", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getVehicleByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }

    const vehicle = await getVehicleById(id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    logger.info(`Vehicle ${id} fetched successfully`);
    return res.status(200).json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    logger.logApiError("Error fetching vehicle", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createVehicleHandler = async (req: Request, res: Response) => {
  try {
    const vehicleData = req.body;

    const newVehicle = await createVehicle(vehicleData);

    if (!newVehicle) {
      return res.status(500).json({
        success: false,
        message: "Failed to create vehicle",
      });
    }

    logger.info(`Vehicle ${newVehicle.vehicleId} created successfully`);
    return res.status(201).json({
      success: true,
      data: newVehicle,
      message: "Vehicle created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating vehicle", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateVehicleHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }
    const updateData = req.body;

    const updatedVehicle = await updateVehicle(id, updateData);

    if (!updatedVehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    logger.info(`Vehicle ${id} updated successfully`);
    return res.status(200).json({
      success: true,
      data: updatedVehicle,
      message: "Vehicle updated successfully",
    });
  } catch (error) {
    logger.logApiError("Error updating vehicle", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteVehicleHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }

    const deletedVehicle = await deleteVehicle(id);

    if (!deletedVehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    logger.info(`Vehicle ${id} deleted successfully`);
    return res.status(200).json({
      success: true,
      message: "Vehicle deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting vehicle", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// MAINTENANCE RECORDS HANDLERS
// ============================

export const getMaintenanceRecordsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const {
      organizationId,
      vehicleId,
      status,
      priority,
      sortBy,
      sortOrder,
    } = req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};

    if (vehicleId) filters.vehicleId = vehicleId as string;
    if (status) filters.status = status as string;
    if (priority) filters.priority = priority as string;
    if (sortBy) filters.sortBy = sortBy as string;
    if (sortOrder) filters.sortOrder = sortOrder as "asc" | "desc";

    const result = await getMaintenanceRecords(offset, limit, filters);

    logger.info("Maintenance records fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching maintenance records", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getMaintenanceRecordByIdHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Maintenance record ID is required",
      });
    }

    const record = await getMaintenanceRecordById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Maintenance record not found",
      });
    }

    logger.info(`Maintenance record ${id} fetched successfully`);
    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    logger.logApiError("Error fetching maintenance record", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createMaintenanceRecordHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const recordData = req.body;

    const newRecord = await createMaintenanceRecord(recordData);

    if (!newRecord) {
      return res.status(500).json({
        success: false,
        message: "Failed to create maintenance record",
      });
    }

    logger.info(`Maintenance record ${newRecord.id} created successfully`);
    return res.status(201).json({
      success: true,
      data: newRecord,
      message: "Maintenance record created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating maintenance record", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateMaintenanceRecordHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Maintenance record ID is required",
      });
    }
    const updateData = req.body;

    const updatedRecord = await updateMaintenanceRecord(id, updateData);

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: "Maintenance record not found",
      });
    }

    logger.info(`Maintenance record ${id} updated successfully`);
    return res.status(200).json({
      success: true,
      data: updatedRecord,
      message: "Maintenance record updated successfully",
    });
  } catch (error) {
    logger.logApiError("Error updating maintenance record", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteMaintenanceRecordHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Maintenance record ID is required",
      });
    }

    const deletedRecord = await deleteMaintenanceRecord(id);

    if (!deletedRecord) {
      return res.status(404).json({
        success: false,
        message: "Maintenance record not found",
      });
    }

    logger.info(`Maintenance record ${id} deleted successfully`);
    return res.status(200).json({
      success: true,
      message: "Maintenance record deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting maintenance record", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// REPAIR RECORDS HANDLERS
// ============================

export const getRepairRecordsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const {
      organizationId,
      vehicleId,
      status,
      priority,
      sortBy,
      sortOrder,
    } = req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};

    if (vehicleId) filters.vehicleId = vehicleId as string;
    if (status) filters.status = status as string;
    if (priority) filters.priority = priority as string;
    if (sortBy) filters.sortBy = sortBy as string;
    if (sortOrder) filters.sortOrder = sortOrder as "asc" | "desc";

    const result = await getRepairRecords(offset, limit, filters);

    logger.info("Repair records fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching repair records", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getRepairRecordByIdHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Repair record ID is required",
      });
    }

    const record = await getRepairRecordById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Repair record not found",
      });
    }

    logger.info(`Repair record ${id} fetched successfully`);
    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    logger.logApiError("Error fetching repair record", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createRepairRecordHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const recordData = req.body;

    const newRecord = await createRepairRecord(recordData);

    if (!newRecord) {
      return res.status(500).json({
        success: false,
        message: "Failed to create repair record",
      });
    }

    logger.info(`Repair record ${newRecord.id} created successfully`);
    return res.status(201).json({
      success: true,
      data: newRecord,
      message: "Repair record created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating repair record", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateRepairRecordHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Repair record ID is required",
      });
    }
    const updateData = req.body;

    const updatedRecord = await updateRepairRecord(id, updateData);

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: "Repair record not found",
      });
    }

    logger.info(`Repair record ${id} updated successfully`);
    return res.status(200).json({
      success: true,
      data: updatedRecord,
      message: "Repair record updated successfully",
    });
  } catch (error) {
    logger.logApiError("Error updating repair record", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteRepairRecordHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Repair record ID is required",
      });
    }

    const deletedRecord = await deleteRepairRecord(id);

    if (!deletedRecord) {
      return res.status(404).json({
        success: false,
        message: "Repair record not found",
      });
    }

    logger.info(`Repair record ${id} deleted successfully`);
    return res.status(200).json({
      success: true,
      message: "Repair record deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting repair record", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// SAFETY INSPECTIONS HANDLERS
// ============================

export const getSafetyInspectionsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const { vehicleId, overallStatus, sortBy, sortOrder } =
      req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};

    if (vehicleId) filters.vehicleId = vehicleId as string;
    if (overallStatus) filters.overallStatus = overallStatus as string;
    if (sortBy) filters.sortBy = sortBy as string;
    if (sortOrder) filters.sortOrder = sortOrder as "asc" | "desc";

    const result = await getSafetyInspections(offset, limit, filters);

    logger.info("Safety inspections fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching safety inspections", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getSafetyInspectionByIdHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Safety inspection ID is required",
      });
    }

    const inspection = await getSafetyInspectionById(id);

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: "Safety inspection not found",
      });
    }

    logger.info(`Safety inspection ${id} fetched successfully`);
    return res.status(200).json({
      success: true,
      data: inspection,
    });
  } catch (error) {
    logger.logApiError("Error fetching safety inspection", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createSafetyInspectionHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const inspectionData = req.body;

    const newInspection = await createSafetyInspection(inspectionData);

    if (!newInspection) {
      return res.status(500).json({
        success: false,
        message: "Failed to create safety inspection",
      });
    }

    logger.info(`Safety inspection ${newInspection.id} created successfully`);
    return res.status(201).json({
      success: true,
      data: newInspection,
      message: "Safety inspection created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating safety inspection", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateSafetyInspectionHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Safety inspection ID is required",
      });
    }
    const updateData = req.body;

    const updatedInspection = await updateSafetyInspection(id, updateData);

    if (!updatedInspection) {
      return res.status(404).json({
        success: false,
        message: "Safety inspection not found",
      });
    }

    logger.info(`Safety inspection ${id} updated successfully`);
    return res.status(200).json({
      success: true,
      data: updatedInspection,
      message: "Safety inspection updated successfully",
    });
  } catch (error) {
    logger.logApiError("Error updating safety inspection", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteSafetyInspectionHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Safety inspection ID is required",
      });
    }

    const deletedInspection = await deleteSafetyInspection(id);

    if (!deletedInspection) {
      return res.status(404).json({
        success: false,
        message: "Safety inspection not found",
      });
    }

    logger.info(`Safety inspection ${id} deleted successfully`);
    return res.status(200).json({
      success: true,
      message: "Safety inspection deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting safety inspection", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// SAFETY INSPECTION ITEMS HANDLERS
// ============================

export const getSafetyInspectionItemsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { inspectionId } = req.params;
    if (!inspectionId) {
      return res.status(400).json({
        success: false,
        message: "Inspection ID is required",
      });
    }

    const items = await getSafetyInspectionItems(inspectionId);

    logger.info(
      `Safety inspection items for ${inspectionId} fetched successfully`
    );
    return res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    logger.logApiError("Error fetching safety inspection items", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createSafetyInspectionItemHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const itemData = req.body;

    const newItem = await createSafetyInspectionItem(itemData);

    if (!newItem) {
      return res.status(500).json({
        success: false,
        message: "Failed to create safety inspection item",
      });
    }

    logger.info(`Safety inspection item ${newItem.id} created successfully`);
    return res.status(201).json({
      success: true,
      data: newItem,
      message: "Safety inspection item created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating safety inspection item", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ============================
// FUEL RECORDS HANDLERS
// ============================

export const getFuelRecordsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const { vehicleId, fuelType, sortBy, sortOrder } =
      req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};

    if (vehicleId) filters.vehicleId = vehicleId as string;
    if (fuelType) filters.fuelType = fuelType as string;
    if (sortBy) filters.sortBy = sortBy as string;
    if (sortOrder) filters.sortOrder = sortOrder as "asc" | "desc";

    const result = await getFuelRecords(offset, limit, filters);

    logger.info("Fuel records fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching fuel records", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getFuelRecordByIdHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Fuel record ID is required",
      });
    }

    const record = await getFuelRecordById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Fuel record not found",
      });
    }

    logger.info(`Fuel record ${id} fetched successfully`);
    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    logger.logApiError("Error fetching fuel record", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createFuelRecordHandler = async (req: Request, res: Response) => {
  try {
    const recordData = req.body;

    const newRecord = await createFuelRecord(recordData);

    if (!newRecord) {
      return res.status(500).json({
        success: false,
        message: "Failed to create fuel record",
      });
    }

    logger.info(`Fuel record ${newRecord.id} created successfully`);
    return res.status(201).json({
      success: true,
      data: newRecord,
      message: "Fuel record created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating fuel record", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateFuelRecordHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Fuel record ID is required",
      });
    }
    const updateData = req.body;

    const updatedRecord = await updateFuelRecord(id, updateData);

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: "Fuel record not found",
      });
    }

    logger.info(`Fuel record ${id} updated successfully`);
    return res.status(200).json({
      success: true,
      data: updatedRecord,
      message: "Fuel record updated successfully",
    });
  } catch (error) {
    logger.logApiError("Error updating fuel record", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteFuelRecordHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Fuel record ID is required",
      });
    }

    const deletedRecord = await deleteFuelRecord(id);

    if (!deletedRecord) {
      return res.status(404).json({
        success: false,
        message: "Fuel record not found",
      });
    }

    logger.info(`Fuel record ${id} deleted successfully`);
    return res.status(200).json({
      success: true,
      message: "Fuel record deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting fuel record", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// CHECK-IN/OUT RECORDS HANDLERS
// ============================

export const getCheckInOutRecordsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const { vehicleId, type, driverId, sortBy, sortOrder } =
      req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};

    if (vehicleId) filters.vehicleId = vehicleId as string;
    if (type) filters.type = type as string;
    if (driverId) filters.driverId = parseInt(driverId as string);
    if (sortBy) filters.sortBy = sortBy as string;
    if (sortOrder) filters.sortOrder = sortOrder as "asc" | "desc";

    const result = await getCheckInOutRecords(offset, limit, filters);

    logger.info("Check-in/out records fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching check-in/out records", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getCheckInOutRecordByIdHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Check-in/out record ID is required",
      });
    }

    const record = await getCheckInOutRecordById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Check-in/out record not found",
      });
    }

    logger.info(`Check-in/out record ${id} fetched successfully`);
    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    logger.logApiError("Error fetching check-in/out record", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createCheckInOutRecordHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const recordData = req.body;

    const newRecord = await createCheckInOutRecord(recordData);

    if (!newRecord) {
      return res.status(500).json({
        success: false,
        message: "Failed to create check-in/out record",
      });
    }

    logger.info(`Check-in/out record ${newRecord.id} created successfully`);
    return res.status(201).json({
      success: true,
      data: newRecord,
      message: "Check-in/out record created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating check-in/out record", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateCheckInOutRecordHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Check-in/out record ID is required",
      });
    }
    const updateData = req.body;

    const updatedRecord = await updateCheckInOutRecord(id, updateData);

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: "Check-in/out record not found",
      });
    }

    logger.info(`Check-in/out record ${id} updated successfully`);
    return res.status(200).json({
      success: true,
      data: updatedRecord,
      message: "Check-in/out record updated successfully",
    });
  } catch (error) {
    logger.logApiError("Error updating check-in/out record", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteCheckInOutRecordHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Check-in/out record ID is required",
      });
    }

    const deletedRecord = await deleteCheckInOutRecord(id);

    if (!deletedRecord) {
      return res.status(404).json({
        success: false,
        message: "Check-in/out record not found",
      });
    }

    logger.info(`Check-in/out record ${id} deleted successfully`);
    return res.status(200).json({
      success: true,
      message: "Check-in/out record deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting check-in/out record", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

