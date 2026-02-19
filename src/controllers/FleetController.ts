import type { Request, Response } from "express";
import { asSingleString } from "../utils/request-helpers.js";
import {
  getVehicles,
  getVehicleById,
  getVehicleSettings,
  updateVehicleSettings,
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
  getAssignmentHistoryByVehicleId,
  getVehicleMetrics,
  getVehicleMedia,
  getVehicleMediaById,
  createVehicleMedia,
  updateVehicleMedia,
  deleteVehicleMedia,
  getVehicleDocuments,
  getVehicleDocumentById,
  createVehicleDocument,
  updateVehicleDocument,
  deleteVehicleDocument,
  getFleetDashboardKPIs,
  bulkDeleteVehicles,
} from "../services/fleet.service.js";
import {
  createExpenseFromSource,
  getDefaultExpenseCategory,
} from "../services/expense.service.js";
import {
  uploadToSpaces,
  deleteFromSpaces,
  getPresignedUploadUrl,
} from "../services/storage.service.js";
import { logger } from "../utils/logger.js";
import { getDataFilterConditions } from "../services/featurePermission.service.js";
import { db } from "../config/db.js";
import { eq, and } from "drizzle-orm";
import { employees } from "../drizzle/schema/org.schema.js";
import { vehicles } from "../drizzle/schema/fleet.schema.js";

// ============================
// DASHBOARD KPIs HANDLERS
// ============================

export const getFleetDashboardKPIsHandler = async (
  req: Request,
  res: Response,
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
    const { search, status, type, assignedToEmployeeId, sortBy, sortOrder } =
      req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};

    if (search) filters.search = search as string;
    if (status) filters.status = status as string;
    if (type) filters.type = type as string;
    if (assignedToEmployeeId)
      filters.assignedToEmployeeId = parseInt(assignedToEmployeeId as string);
    if (sortBy) filters.sortBy = sortBy as string;
    if (sortOrder) filters.sortOrder = sortOrder as "asc" | "desc";

    // assigned_only: Technicians see only vehicles assigned to them
    const userId = req.user?.id;
    if (userId && filters.assignedToEmployeeId === undefined) {
      const dataFilter = await getDataFilterConditions(userId, "fleet");
      if (dataFilter.assignedOnly) {
        const [emp] = await db
          .select({ id: employees.id })
          .from(employees)
          .where(eq(employees.userId, userId))
          .limit(1);
        if (emp) filters.assignedToEmployeeId = emp.id;
      }
    }

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

/** Check if user with assigned_only can access this vehicle. Returns true if allowed, sends 403 and returns false otherwise. */
const checkVehicleAssignedAccess = async (
  req: Request,
  res: Response,
  vehicleOrId: { assignedToEmployeeId?: number | null } | string,
): Promise<boolean> => {
  const userId = req.user?.id;
  if (!userId) return true;

  const dataFilter = await getDataFilterConditions(userId, "fleet");
  if (!dataFilter.assignedOnly) return true;

  let assignedToEmployeeId: number | null | undefined;
  if (typeof vehicleOrId === "string") {
    const [row] = await db
      .select({ assignedToEmployeeId: vehicles.assignedToEmployeeId })
      .from(vehicles)
      .where(and(eq(vehicles.id, vehicleOrId), eq(vehicles.isDeleted, false)))
      .limit(1);
    assignedToEmployeeId = row?.assignedToEmployeeId ?? null;
  } else {
    assignedToEmployeeId = vehicleOrId.assignedToEmployeeId;
  }

  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.userId, userId))
    .limit(1);

  if (!emp || assignedToEmployeeId !== emp.id) {
    res.status(403).json({
      success: false,
      message: "You can only view vehicles assigned to you.",
    });
    return false;
  }
  return true;
};

export const getVehicleByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = asSingleString(req.params.id);
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

    if (!(await checkVehicleAssignedAccess(req, res, vehicle))) return;

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
    const vehicleData = { ...req.body };
    const isExpense = Boolean(vehicleData.isExpense);
    delete (vehicleData as Record<string, unknown>).isExpense;

    // Upload vehicle image to Digital Ocean Spaces if file provided (field: "vehicle")
    if (req.file) {
      try {
        const uploadResult = await uploadToSpaces(
          req.file.buffer,
          req.file.originalname,
          "vehicle-images",
        );
        vehicleData.image = uploadResult.url;
      } catch (uploadError: unknown) {
        logger.logApiError("Vehicle image upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload vehicle image. Please try again.",
        });
      }
    }

    const newVehicle = await createVehicle(vehicleData);

    if (!newVehicle) {
      return res.status(500).json({
        success: false,
        message: "Failed to create vehicle",
      });
    }

    if (
      isExpense &&
      req.user?.id &&
      newVehicle.purchaseCost &&
      parseFloat(newVehicle.purchaseCost) > 0
    ) {
      try {
        const category = getDefaultExpenseCategory();
        const purchaseDate = newVehicle.purchaseDate;
        const expenseDate =
          (typeof purchaseDate === "string"
            ? purchaseDate.slice(0, 10)
            : purchaseDate
              ? new Date(purchaseDate as string | Date).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0]) as string;
        await createExpenseFromSource({
          sourceId: newVehicle.id,
          category,
          expenseType: "fleet_purchase",
          amount: newVehicle.purchaseCost,
          expenseDate,
          description: `Vehicle: ${newVehicle.make} ${newVehicle.model} (${newVehicle.vehicleId})`,
          title: "Fleet vehicle purchase",
          vendor: newVehicle.dealer ?? null,
          createdBy: req.user.id,
          source: "fleet",
        });
      } catch (expenseErr) {
        logger.logApiError("Error creating expense from vehicle creation", expenseErr, req);
      }
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
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }
    if (!(await checkVehicleAssignedAccess(req, res, id))) return;
    const updateData = { ...req.body };

    // Upload vehicle image to Digital Ocean Spaces if file provided (field: "vehicle")
    if (req.file) {
      const currentVehicle = await getVehicleById(id);
      if (currentVehicle?.image) {
        try {
          await deleteFromSpaces(currentVehicle.image);
          logger.info("Old vehicle image deleted from DigitalOcean Spaces");
        } catch (error) {
          logger.logApiError(
            "Error deleting old vehicle image from storage",
            error,
            req,
          );
        }
      }
      try {
        const uploadResult = await uploadToSpaces(
          req.file.buffer,
          req.file.originalname,
          "vehicle-images",
        );
        updateData.image = uploadResult.url;
      } catch (uploadError: unknown) {
        logger.logApiError("Vehicle image upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload vehicle image. Please try again.",
        });
      }
    }

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
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }
    if (!(await checkVehicleAssignedAccess(req, res, id))) return;

    const userId = req.user?.id;
    const deletedVehicle = await deleteVehicle(id, userId);

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
// VEHICLE SETTINGS HANDLERS
// ============================

export const getVehicleSettingsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }
    if (!(await checkVehicleAssignedAccess(req, res, id))) return;
    const settings = await getVehicleSettings(id);
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    logger.logApiError("Error fetching vehicle settings", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateVehicleSettingsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }
    if (!(await checkVehicleAssignedAccess(req, res, id))) return;
    const settings = await updateVehicleSettings(id, req.body);
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    logger.logApiError("Error updating vehicle settings", error, req);
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
  res: Response,
) => {
  try {
    const vehicleIdFromPath = req.params.vehicleId as string | undefined;
    const vehicleIdFromQuery = req.query.vehicleId as string | undefined;
    const vehicleIdToCheck = (vehicleIdFromPath || vehicleIdFromQuery) as string | undefined;
    if (vehicleIdToCheck && !(await checkVehicleAssignedAccess(req, res, vehicleIdToCheck))) return;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const {
      organizationId: _organizationId,
      vehicleId,
      status,
      priority,
      sortBy,
      sortOrder,
    } = req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};
    if (vehicleIdFromPath) filters.vehicleId = vehicleIdFromPath;
    else if (vehicleId) filters.vehicleId = vehicleId as string;
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
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Maintenance record ID is required",
      });
    }
    if (vehicleIdParam && !(await checkVehicleAssignedAccess(req, res, vehicleIdParam))) return;

    const record = await getMaintenanceRecordById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Maintenance record not found",
      });
    }

    if (vehicleIdParam && record.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Maintenance record not found for this vehicle",
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
  res: Response,
) => {
  try {
    const vehicleIdFromPath = req.params.vehicleId as string | undefined;
    if (vehicleIdFromPath && !(await checkVehicleAssignedAccess(req, res, vehicleIdFromPath))) return;
    const recordData = vehicleIdFromPath
      ? { ...req.body, vehicleId: vehicleIdFromPath }
      : req.body;
    const createdBy = req.user?.id;
    if (createdBy) (recordData as any).createdBy = createdBy;

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
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Maintenance record ID is required",
      });
    }
    if (vehicleIdParam && !(await checkVehicleAssignedAccess(req, res, vehicleIdParam))) return;
    const isExpense = Boolean(req.body?.isExpense);
    const updateData = { ...req.body };
    delete (updateData as Record<string, unknown>).isExpense;

    const updatedRecord = await updateMaintenanceRecord(id, updateData);

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: "Maintenance record not found",
      });
    }
    if (vehicleIdParam && updatedRecord.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Maintenance record not found for this vehicle",
      });
    }

    if (
      isExpense &&
      updatedRecord.status === "approved" &&
      updatedRecord.cost &&
      parseFloat(updatedRecord.cost) > 0 &&
      req.user?.id
    ) {
      try {
        const category = getDefaultExpenseCategory();
        const rawDate = updatedRecord.date;
        const expenseDate =
          (typeof rawDate === "string"
            ? rawDate.slice(0, 10)
            : rawDate
              ? new Date(rawDate as string | Date).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0]) as string;
        await createExpenseFromSource({
          sourceId: updatedRecord.id,
          category,
          expenseType: "fleet_maintenance",
          amount: updatedRecord.cost,
          expenseDate,
          description: updatedRecord.description ?? "Fleet maintenance",
          title: updatedRecord.type ?? "Fleet maintenance",
          vendor: updatedRecord.vendor ?? null,
          createdBy: req.user.id,
          source: "fleet",
        });
      } catch (expenseErr) {
        logger.logApiError("Error creating expense from maintenance approval", expenseErr, req);
      }
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
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Maintenance record ID is required",
      });
    }
    if (vehicleIdParam && !(await checkVehicleAssignedAccess(req, res, vehicleIdParam))) return;

    const deletedRecord = await deleteMaintenanceRecord(id);

    if (!deletedRecord) {
      return res.status(404).json({
        success: false,
        message: "Maintenance record not found",
      });
    }
    if (vehicleIdParam && deletedRecord.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Maintenance record not found for this vehicle",
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
    const vehicleIdFromPath = req.params.vehicleId as string | undefined;
    const vehicleIdFromQuery = req.query.vehicleId as string | undefined;
    const vehicleIdToCheck = (vehicleIdFromPath || vehicleIdFromQuery) as string | undefined;
    if (vehicleIdToCheck && !(await checkVehicleAssignedAccess(req, res, vehicleIdToCheck))) return;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const {
      organizationId: _organizationId,
      vehicleId,
      status,
      priority,
      sortBy,
      sortOrder,
    } = req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};
    if (vehicleIdFromPath) filters.vehicleId = vehicleIdFromPath;
    else if (vehicleId) filters.vehicleId = vehicleId as string;
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
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Repair record ID is required",
      });
    }
    if (vehicleIdParam && !(await checkVehicleAssignedAccess(req, res, vehicleIdParam))) return;

    const record = await getRepairRecordById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Repair record not found",
      });
    }
    if (vehicleIdParam && record.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Repair record not found for this vehicle",
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
  res: Response,
) => {
  try {
    const vehicleIdFromPath = req.params.vehicleId as string | undefined;
    if (vehicleIdFromPath && !(await checkVehicleAssignedAccess(req, res, vehicleIdFromPath))) return;
    const recordData = vehicleIdFromPath
      ? { ...req.body, vehicleId: vehicleIdFromPath }
      : req.body;
    const createdBy = req.user?.id;
    if (createdBy) (recordData as any).createdBy = createdBy;

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
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Repair record ID is required",
      });
    }
    if (vehicleIdParam && !(await checkVehicleAssignedAccess(req, res, vehicleIdParam))) return;
    const isExpense = Boolean(req.body?.isExpense);
    const updateData = { ...req.body };
    delete (updateData as Record<string, unknown>).isExpense;

    const updatedRecord = await updateRepairRecord(id, updateData);

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: "Repair record not found",
      });
    }
    if (vehicleIdParam && updatedRecord.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Repair record not found for this vehicle",
      });
    }

    if (
      isExpense &&
      updatedRecord.status === "approved" &&
      updatedRecord.cost &&
      parseFloat(updatedRecord.cost) > 0 &&
      req.user?.id
    ) {
      try {
        const category = getDefaultExpenseCategory();
        const rawDate = updatedRecord.date;
        const expenseDate =
          (typeof rawDate === "string"
            ? rawDate.slice(0, 10)
            : rawDate
              ? new Date(rawDate as string | Date).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0]) as string;
        await createExpenseFromSource({
          sourceId: updatedRecord.id,
          category,
          expenseType: "fleet_repair",
          amount: updatedRecord.cost,
          expenseDate,
          description: updatedRecord.description ?? "Fleet repair",
          title: updatedRecord.type ?? "Fleet repair",
          vendor: updatedRecord.vendor ?? null,
          createdBy: req.user.id,
          source: "fleet",
        });
      } catch (expenseErr) {
        logger.logApiError("Error creating expense from repair approval", expenseErr, req);
      }
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
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Repair record ID is required",
      });
    }
    if (vehicleIdParam && !(await checkVehicleAssignedAccess(req, res, vehicleIdParam))) return;

    const deletedRecord = await deleteRepairRecord(id);

    if (!deletedRecord) {
      return res.status(404).json({
        success: false,
        message: "Repair record not found",
      });
    }
    if (vehicleIdParam && deletedRecord.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Repair record not found for this vehicle",
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
  res: Response,
) => {
  try {
    const vehicleIdFromPath = req.params.vehicleId as string | undefined;
    const vehicleIdFromQuery = req.query.vehicleId as string | undefined;
    const vehicleIdToCheck = (vehicleIdFromPath || vehicleIdFromQuery) as string | undefined;
    if (vehicleIdToCheck && !(await checkVehicleAssignedAccess(req, res, vehicleIdToCheck))) return;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const { vehicleId, overallStatus, sortBy, sortOrder } = req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};
    if (vehicleIdFromPath) filters.vehicleId = vehicleIdFromPath;
    else if (vehicleId) filters.vehicleId = vehicleId as string;
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
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Safety inspection ID is required",
      });
    }
    if (vehicleIdParam && !(await checkVehicleAssignedAccess(req, res, vehicleIdParam))) return;

    const inspection = await getSafetyInspectionById(id);

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: "Safety inspection not found",
      });
    }
    if (vehicleIdParam && inspection.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Safety inspection not found for this vehicle",
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
  res: Response,
) => {
  try {
    const vehicleIdFromPath = req.params.vehicleId as string | undefined;
    if (vehicleIdFromPath && !(await checkVehicleAssignedAccess(req, res, vehicleIdFromPath))) return;
    const inspectionData = vehicleIdFromPath
      ? { ...req.body, vehicleId: vehicleIdFromPath }
      : req.body;
    const createdBy = req.user?.id;
    if (createdBy) (inspectionData as any).createdBy = createdBy;

    // Handle multiple image uploads (exterior_0, exterior_1, interior_0, interior_1, etc.)
    const exteriorPhotos: string[] = [];
    const interiorPhotos: string[] = [];

    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        try {
          const uploadResult = await uploadToSpaces(
            file.buffer,
            file.originalname,
            "inspection-photos",
          );

          // Determine if it's exterior or interior based on fieldname
          if (file.fieldname.startsWith("exterior_")) {
            exteriorPhotos.push(uploadResult.url);
          } else if (file.fieldname.startsWith("interior_")) {
            interiorPhotos.push(uploadResult.url);
          }
        } catch (uploadError: unknown) {
          logger.logApiError("Inspection photo upload error", uploadError, req);
          return res.status(500).json({
            success: false,
            message: "Failed to upload inspection photos. Please try again.",
          });
        }
      }
    }

    // Add uploaded photo URLs to inspection data
    if (exteriorPhotos.length > 0) {
      inspectionData.exteriorPhotos = exteriorPhotos;
    }
    if (interiorPhotos.length > 0) {
      inspectionData.interiorPhotos = interiorPhotos;
    }

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
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Safety inspection ID is required",
      });
    }
    const updateData = req.body;

    // Handle multiple image uploads (exterior_0, exterior_1, interior_0, interior_1, etc.)
    const exteriorPhotos: string[] = [];
    const interiorPhotos: string[] = [];

    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        try {
          const uploadResult = await uploadToSpaces(
            file.buffer,
            file.originalname,
            "inspection-photos",
          );

          // Determine if it's exterior or interior based on fieldname
          if (file.fieldname.startsWith("exterior_")) {
            exteriorPhotos.push(uploadResult.url);
          } else if (file.fieldname.startsWith("interior_")) {
            interiorPhotos.push(uploadResult.url);
          }
        } catch (uploadError: unknown) {
          logger.logApiError("Inspection photo upload error", uploadError, req);
          return res.status(500).json({
            success: false,
            message: "Failed to upload inspection photos. Please try again.",
          });
        }
      }
    }

    // Add uploaded photo URLs to update data (merge with existing if any)
    if (exteriorPhotos.length > 0) {
      updateData.exteriorPhotos = exteriorPhotos;
    }
    if (interiorPhotos.length > 0) {
      updateData.interiorPhotos = interiorPhotos;
    }

    const updatedInspection = await updateSafetyInspection(id, updateData);

    if (!updatedInspection) {
      return res.status(404).json({
        success: false,
        message: "Safety inspection not found",
      });
    }
    if (vehicleIdParam && updatedInspection.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Safety inspection not found for this vehicle",
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
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
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
    if (vehicleIdParam && deletedInspection.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Safety inspection not found for this vehicle",
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
  res: Response,
) => {
  try {
    const inspectionId = asSingleString(req.params.inspectionId); // works for both /inspections/:inspectionId/items and /vehicles/:vehicleId/inspections/:inspectionId/items
    if (!inspectionId) {
      return res.status(400).json({
        success: false,
        message: "Inspection ID is required",
      });
    }

    const items = await getSafetyInspectionItems(inspectionId);

    logger.info(
      `Safety inspection items for ${inspectionId} fetched successfully`,
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
  res: Response,
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
    const vehicleIdFromPath = req.params.vehicleId as string | undefined;
    const vehicleIdFromQuery = req.query.vehicleId as string | undefined;
    const vehicleIdToCheck = (vehicleIdFromPath || vehicleIdFromQuery) as string | undefined;
    if (vehicleIdToCheck && !(await checkVehicleAssignedAccess(req, res, vehicleIdToCheck))) return;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const { vehicleId, fuelType, sortBy, sortOrder } = req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};
    if (vehicleIdFromPath) filters.vehicleId = vehicleIdFromPath;
    else if (vehicleId) filters.vehicleId = vehicleId as string;
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

export const getFuelRecordByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
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
    if (vehicleIdParam && record.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Fuel record not found for this vehicle",
      });
    }

    if (!(await checkVehicleAssignedAccess(req, res, record.vehicleId))) return;

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
    const vehicleIdFromPath = req.params.vehicleId as string | undefined;
    if (vehicleIdFromPath && !(await checkVehicleAssignedAccess(req, res, vehicleIdFromPath))) return;
    const recordData = vehicleIdFromPath
      ? { ...req.body, vehicleId: vehicleIdFromPath }
      : req.body;
    const createdBy = req.user?.id;
    if (createdBy) (recordData as any).createdBy = createdBy;

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
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
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
    if (vehicleIdParam && updatedRecord.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Fuel record not found for this vehicle",
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
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
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
    if (vehicleIdParam && deletedRecord.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Fuel record not found for this vehicle",
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
  res: Response,
) => {
  try {
    const vehicleIdFromPath = req.params.vehicleId as string | undefined;
    const vehicleIdFromQuery = req.query.vehicleId as string | undefined;
    const vehicleIdToCheck = (vehicleIdFromPath || vehicleIdFromQuery) as string | undefined;
    if (vehicleIdToCheck && !(await checkVehicleAssignedAccess(req, res, vehicleIdToCheck))) return;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const { vehicleId, type, sortBy, sortOrder } = req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};
    if (vehicleIdFromPath) filters.vehicleId = vehicleIdFromPath;
    else if (vehicleId) filters.vehicleId = vehicleId as string;
    if (type) filters.type = type as string;
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
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
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
    if (vehicleIdParam && record.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Check-in/out record not found for this vehicle",
      });
    }

    if (!(await checkVehicleAssignedAccess(req, res, record.vehicleId))) return;

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
  res: Response,
) => {
  try {
    const vehicleIdFromPath = req.params.vehicleId as string | undefined;
    if (vehicleIdFromPath && !(await checkVehicleAssignedAccess(req, res, vehicleIdFromPath))) return;
    const recordData = vehicleIdFromPath
      ? { ...req.body, vehicleId: vehicleIdFromPath }
      : req.body;
    const createdBy = req.user?.id;
    if (createdBy) (recordData as any).createdBy = createdBy;

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
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
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
    if (vehicleIdParam && updatedRecord.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Check-in/out record not found for this vehicle",
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
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
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
    if (vehicleIdParam && deletedRecord.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Check-in/out record not found for this vehicle",
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

// ============================
// ASSIGNMENT HISTORY HANDLERS
// ============================

export const getAssignmentHistoryHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const vehicleId = asSingleString(req.params.vehicleId);
    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }
    if (!(await checkVehicleAssignedAccess(req, res, vehicleId))) return;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const sortBy = (req.query.sortBy as string) || "startDate";
    const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

    const result = await getAssignmentHistoryByVehicleId(
      vehicleId,
      offset,
      limit,
      {
        ...(status ? { status } : {}),
        sortBy,
        sortOrder,
      },
    );
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching assignment history", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// VEHICLE METRICS HANDLERS
// ============================

export const getVehicleMetricsHandler = async (req: Request, res: Response) => {
  try {
    const vehicleId = asSingleString(req.params.vehicleId);
    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }
    if (!(await checkVehicleAssignedAccess(req, res, vehicleId))) return;
    const metrics = await getVehicleMetrics(vehicleId);
    if (!metrics) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.logApiError("Error fetching vehicle metrics", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// VEHICLE MEDIA HANDLERS
// ============================

export const getVehicleMediaHandler = async (req: Request, res: Response) => {
  try {
    const vehicleId = asSingleString(req.params.vehicleId);
    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }
    if (!(await checkVehicleAssignedAccess(req, res, vehicleId))) return;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

    const result = await getVehicleMedia(vehicleId, offset, limit, {
      sortBy,
      sortOrder,
    });
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching vehicle media", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getVehicleMediaByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
    const media = await getVehicleMediaById(id!);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Vehicle media not found",
      });
    }
    if (vehicleIdParam && media.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Vehicle media not found for this vehicle",
      });
    }
    if (!(await checkVehicleAssignedAccess(req, res, media.vehicleId))) return;
    return res.status(200).json({ success: true, data: media });
  } catch (error) {
    logger.logApiError("Error fetching vehicle media", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createVehicleMediaHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const vehicleId = asSingleString(req.params.vehicleId);
    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }
    if (!(await checkVehicleAssignedAccess(req, res, vehicleId))) return;
    const uploadedBy = req.user?.id;
    if (!uploadedBy) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
    const body = req.body as {
      name?: string;
      type?: string;
      size?: string;
      url?: string;
      thumbnailUrl?: string;
      tags?: unknown;
    };
    const mediaData: any = {
      vehicleId,
      name: body.name || (req.file?.originalname ?? "Unnamed"),
      uploadedBy,
    };
    if (body.type) mediaData.type = body.type;
    if (body.size) mediaData.size = body.size;
    if (body.thumbnailUrl) mediaData.thumbnailUrl = body.thumbnailUrl;
    if (body.tags !== undefined) mediaData.tags = body.tags;

    if (req.file) {
      try {
        const uploadResult = await uploadToSpaces(
          req.file.buffer,
          req.file.originalname,
          "vehicle-media",
        );
        mediaData.url = uploadResult.url;
        mediaData.type = mediaData.type || req.file.mimetype;
        mediaData.size = String((req.file.size / (1024 * 1024)).toFixed(2));
      } catch (uploadError: unknown) {
        logger.logApiError("Vehicle media upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload file",
        });
      }
    } else if (body.url) {
      mediaData.url = body.url;
    }

    const newMedia = await createVehicleMedia(mediaData);
    return res.status(201).json({
      success: true,
      data: newMedia,
      message: "Vehicle media created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating vehicle media", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateVehicleMediaHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
    const media = await getVehicleMediaById(id!);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Vehicle media not found",
      });
    }
    if (vehicleIdParam && media.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Vehicle media not found for this vehicle",
      });
    }
    const updateData = req.body;
    if (req.file) {
      if (media.url) {
        try {
          await deleteFromSpaces(media.url);
        } catch {
          // ignore
        }
      }
      const uploadResult = await uploadToSpaces(
        req.file.buffer,
        req.file.originalname,
        "vehicle-media",
      );
      (updateData as any).url = uploadResult.url;
      (updateData as any).type = req.file.mimetype;
      (updateData as any).size = String(
        (req.file.size / (1024 * 1024)).toFixed(2),
      );
    }
    const updated = await updateVehicleMedia(id!, updateData);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Vehicle media not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: updated,
      message: "Vehicle media updated successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error updating vehicle media", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deleteVehicleMediaHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
    const media = await getVehicleMediaById(id!);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Vehicle media not found",
      });
    }
    if (vehicleIdParam && media.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Vehicle media not found for this vehicle",
      });
    }
    await deleteVehicleMedia(id!);
    if (media.url) {
      try {
        await deleteFromSpaces(media.url);
      } catch {
        // ignore
      }
    }
    return res.status(200).json({
      success: true,
      message: "Vehicle media deleted successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error deleting vehicle media", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ============================
// VEHICLE DOCUMENTS HANDLERS
// ============================

export const getVehicleDocumentsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const vehicleId = asSingleString(req.params.vehicleId);
    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }
    if (!(await checkVehicleAssignedAccess(req, res, vehicleId))) return;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const documentType = req.query.documentType as string | undefined;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

    const filters: {
      documentType?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = { sortBy, sortOrder };
    if (documentType) filters.documentType = documentType;

    const result = await getVehicleDocuments(vehicleId, offset, limit, filters);
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching vehicle documents", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getVehicleDocumentByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
    const doc = await getVehicleDocumentById(id!);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Vehicle document not found",
      });
    }
    if (vehicleIdParam && doc.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Vehicle document not found for this vehicle",
      });
    }
    if (!(await checkVehicleAssignedAccess(req, res, doc.vehicleId))) return;
    return res.status(200).json({ success: true, data: doc });
  } catch (error) {
    logger.logApiError("Error fetching vehicle document", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get a presigned URL for direct upload to storage. Client uploads file to uploadUrl
 * (PUT with Content-Type header), then POSTs to create document with filePath set to key.
 */
export const getVehicleDocumentPresignedUrlHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
    const { fileName } = req.body as { fileName: string };
    const result = await getPresignedUploadUrl(
      fileName,
      "vehicle-documents",
      3600,
    );
    return res.status(200).json({
      success: true,
      data: {
        uploadUrl: result.uploadUrl,
        filePath: result.key,
        url: result.url,
        contentType: result.contentType,
        expiresIn: result.expiresIn,
      },
    });
  } catch (error: any) {
    logger.logApiError("Error getting vehicle document presigned URL", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const createVehicleDocumentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const vehicleId = asSingleString(req.params.vehicleId);
    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: "Vehicle ID is required",
      });
    }
    if (!(await checkVehicleAssignedAccess(req, res, vehicleId))) return;
    const uploadedBy = req.user?.id;
    if (!uploadedBy) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
    const body = req.body as {
      fileName?: string;
      filePath?: string;
      fileType?: string;
      fileSize?: number;
      documentType?: string;
      description?: string;
      expirationDate?: string;
    };
    const docData: any = {
      vehicleId,
      fileName: body.fileName ?? req.file?.originalname ?? "document",
      filePath: "",
      uploadedBy,
    };
    if (body.fileType) docData.fileType = body.fileType;
    if (body.fileSize !== undefined) docData.fileSize = body.fileSize;
    if (body.documentType) docData.documentType = body.documentType;
    if (body.description !== undefined) docData.description = body.description;
    if (body.expirationDate) docData.expirationDate = body.expirationDate;

    if (req.file) {
      try {
        const uploadResult = await uploadToSpaces(
          req.file.buffer,
          req.file.originalname,
          "vehicle-documents",
        );
        docData.filePath = uploadResult.url;
        docData.fileType = docData.fileType || req.file.mimetype;
        docData.fileSize = req.file.size;
      } catch (uploadError: unknown) {
        logger.logApiError("Vehicle document upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload file",
        });
      }
    } else if (body.filePath) {
      docData.filePath = body.filePath;
    } else {
      return res.status(400).json({
        success: false,
        message: "File or filePath is required",
      });
    }

    const newDoc = await createVehicleDocument(docData);
    return res.status(201).json({
      success: true,
      data: newDoc,
      message: "Vehicle document created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating vehicle document", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateVehicleDocumentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
    const doc = await getVehicleDocumentById(id!);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Vehicle document not found",
      });
    }
    if (vehicleIdParam && doc.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Vehicle document not found for this vehicle",
      });
    }
    const updateData = req.body;
    if (req.file) {
      if (doc.filePath) {
        try {
          await deleteFromSpaces(doc.filePath);
        } catch {
          // ignore
        }
      }
      const uploadResult = await uploadToSpaces(
        req.file.buffer,
        req.file.originalname,
        "vehicle-documents",
      );
      (updateData as any).filePath = uploadResult.url;
      (updateData as any).fileName = req.file.originalname;
      (updateData as any).fileType = req.file.mimetype;
      (updateData as any).fileSize = req.file.size;
    }
    const updated = await updateVehicleDocument(id!, updateData);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Vehicle document not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: updated,
      message: "Vehicle document updated successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error updating vehicle document", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deleteVehicleDocumentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    const vehicleIdParam = asSingleString(req.params.vehicleId);
    const doc = await getVehicleDocumentById(id!);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Vehicle document not found",
      });
    }
    if (vehicleIdParam && doc.vehicleId !== vehicleIdParam) {
      return res.status(404).json({
        success: false,
        message: "Vehicle document not found for this vehicle",
      });
    }
    await deleteVehicleDocument(id!);
    if (doc.filePath) {
      try {
        await deleteFromSpaces(doc.filePath);
      } catch {
        // ignore
      }
    }
    return res.status(200).json({
      success: true,
      message: "Vehicle document deleted successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error deleting vehicle document", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ===========================================================================
// Bulk Delete
// ===========================================================================

export const bulkDeleteVehiclesHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(403).json({ success: false, message: "Authentication required" });

    const { ids } = req.body as { ids: string[] };
    const result = await bulkDeleteVehicles(ids, userId);

    logger.info(`Bulk deleted ${result.deleted} vehicles by ${userId}`);
    return res.status(200).json({
      success: true,
      message: `${result.deleted} vehicle(s) deleted. ${result.skipped} skipped (already deleted or not found).`,
      data: result,
    });
  } catch (error) {
    logger.logApiError("Bulk delete vehicles error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
