import { db } from "../config/db.js";
import {
  vehicles,
  maintenanceRecords,
  repairRecords,
  safetyInspections,
  safetyInspectionItems,
  fuelRecords,
  checkInOutRecords,
  vehicleMedia,
  vehicleDocuments,
  assignmentHistory,
} from "../drizzle/schema/fleet.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";
import { alias } from "drizzle-orm/pg-core";
import {
  eq,
  and,
  desc,
  asc,
  count,
  sql,
  gte,
  lte,
  like,
  or,
  isNotNull,
  getTableColumns,
  notInArray,
} from "drizzle-orm";
import type {
  CreateVehicleData,
  UpdateVehicleData,
  CreateMaintenanceRecordData,
  UpdateMaintenanceRecordData,
  CreateRepairRecordData,
  UpdateRepairRecordData,
  CreateSafetyInspectionData,
  UpdateSafetyInspectionData,
  CreateSafetyInspectionItemData,
  CreateFuelRecordData,
  UpdateFuelRecordData,
  CreateCheckInOutRecordData,
  UpdateCheckInOutRecordData,
  CreateVehicleMediaData,
  UpdateVehicleMediaData,
  CreateVehicleDocumentData,
  UpdateVehicleDocumentData,
  FleetDashboardKPIs,
  VehicleMetrics,
  VehicleSettings,
  UpdateVehicleSettingsData,
} from "../types/fleet.types.js";

// ============================
// VEHICLES SERVICE
// ============================

// Get Vehicles with Pagination
export const getVehicles = async (
  offset: number,
  limit: number,
  filters: {
    search?: string;
    status?: string;
    type?: string;
    assignedToEmployeeId?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
) => {
  const {
    search,
    status,
    type,
    assignedToEmployeeId,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  // Build conditions
  const conditions = [
    eq(vehicles.isDeleted, false),
    ...(status ? [eq(vehicles.status, status as any)] : []),
    ...(type ? [eq(vehicles.type, type as any)] : []),
    ...(assignedToEmployeeId
      ? [eq(vehicles.assignedToEmployeeId, assignedToEmployeeId)]
      : []),
  ];

  // Add search conditions
  if (search) {
    conditions.push(
      or(
        like(vehicles.vehicleId, `%${search}%`),
        like(vehicles.make, `%${search}%`),
        like(vehicles.model, `%${search}%`),
        like(vehicles.licensePlate, `%${search}%`),
        like(vehicles.vin, `%${search}%`),
      )!,
    );
  }

  // Build sort order
  let orderBy: any;
  if (sortBy === "createdAt") {
    orderBy =
      sortOrder === "asc" ? asc(vehicles.createdAt) : desc(vehicles.createdAt);
  } else if (sortBy === "make") {
    orderBy = sortOrder === "asc" ? asc(vehicles.make) : desc(vehicles.make);
  } else if (sortBy === "model") {
    orderBy = sortOrder === "asc" ? asc(vehicles.model) : desc(vehicles.model);
  } else if (sortBy === "year") {
    orderBy = sortOrder === "asc" ? asc(vehicles.year) : desc(vehicles.year);
  } else {
    orderBy = desc(vehicles.createdAt);
  }

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(vehicles)
    .where(and(...conditions));

  const total = totalResult[0]?.count || 0;

  // Get paginated results
  const vehiclesList = await db
    .select()
    .from(vehicles)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data: vehiclesList,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get Vehicle by ID (with createdByName)
export const getVehicleById = async (id: string) => {
  const [row] = await db
    .select({
      ...getTableColumns(vehicles),
      createdByName: createdByUser.fullName,
    })
    .from(vehicles)
    .leftJoin(createdByUser, eq(vehicles.createdBy, createdByUser.id))
    .where(and(eq(vehicles.id, id), eq(vehicles.isDeleted, false)));

  if (!row) return null;

  const { createdByName, ...record } = row;
  return {
    ...record,
    createdByName: createdByName ?? null,
  };
};

// Get vehicle settings (configuration + intervals + notification toggles)
export const getVehicleSettings = async (
  id: string,
): Promise<VehicleSettings | null> => {
  const [row] = await db
    .select({
      fuelType: vehicles.fuelType,
      type: vehicles.type,
      oilChangeIntervalMiles: vehicles.oilChangeIntervalMiles,
      tireRotationIntervalMiles: vehicles.tireRotationIntervalMiles,
      brakeInspectionIntervalMiles: vehicles.brakeInspectionIntervalMiles,
      safetyInspectionIntervalMonths: vehicles.safetyInspectionIntervalMonths,
      maintenanceRemindersEnabled: vehicles.maintenanceRemindersEnabled,
      overdueRepairsAlertsEnabled: vehicles.overdueRepairsAlertsEnabled,
      safetyInspectionRemindersEnabled:
        vehicles.safetyInspectionRemindersEnabled,
    })
    .from(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.isDeleted, false)))
    .limit(1);
  if (!row) return null;
  return {
    fuelType: row.fuelType ?? null,
    type: row.type,
    oilChangeIntervalMiles: row.oilChangeIntervalMiles ?? null,
    tireRotationIntervalMiles: row.tireRotationIntervalMiles ?? null,
    brakeInspectionIntervalMiles: row.brakeInspectionIntervalMiles ?? null,
    safetyInspectionIntervalMonths: row.safetyInspectionIntervalMonths ?? null,
    maintenanceRemindersEnabled: row.maintenanceRemindersEnabled ?? true,
    overdueRepairsAlertsEnabled: row.overdueRepairsAlertsEnabled ?? true,
    safetyInspectionRemindersEnabled:
      row.safetyInspectionRemindersEnabled ?? true,
  };
};

// Update vehicle settings
export const updateVehicleSettings = async (
  id: string,
  data: UpdateVehicleSettingsData,
): Promise<VehicleSettings | null> => {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.fuelType !== undefined) updateData.fuelType = data.fuelType;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.oilChangeIntervalMiles !== undefined)
    updateData.oilChangeIntervalMiles = data.oilChangeIntervalMiles;
  if (data.tireRotationIntervalMiles !== undefined)
    updateData.tireRotationIntervalMiles = data.tireRotationIntervalMiles;
  if (data.brakeInspectionIntervalMiles !== undefined)
    updateData.brakeInspectionIntervalMiles = data.brakeInspectionIntervalMiles;
  if (data.safetyInspectionIntervalMonths !== undefined)
    updateData.safetyInspectionIntervalMonths =
      data.safetyInspectionIntervalMonths;
  if (data.maintenanceRemindersEnabled !== undefined)
    updateData.maintenanceRemindersEnabled = data.maintenanceRemindersEnabled;
  if (data.overdueRepairsAlertsEnabled !== undefined)
    updateData.overdueRepairsAlertsEnabled = data.overdueRepairsAlertsEnabled;
  if (data.safetyInspectionRemindersEnabled !== undefined)
    updateData.safetyInspectionRemindersEnabled =
      data.safetyInspectionRemindersEnabled;

  const result = await db
    .update(vehicles)
    .set(updateData as any)
    .where(and(eq(vehicles.id, id), eq(vehicles.isDeleted, false)))
    .returning();
  if (!result[0]) return null;
  return getVehicleSettings(id);
};

// Generate Vehicle ID using PostgreSQL sequence (thread-safe), format: VEH-000001
export const generateVehicleId = async (): Promise<string> => {
  try {
    const result = await db.execute<{ nextval: string }>(
      sql.raw(`SELECT nextval('org.vehicle_id_seq')::text as nextval`),
    );
    const nextNumber = parseInt(result.rows[0]?.nextval || "1");
    return `VEH-${String(nextNumber).padStart(6, "0")}`;
  } catch (error) {
    console.warn(
      "Vehicle ID sequence not found or error occurred, using fallback method:",
      error,
    );
    try {
      const maxNumResult = await db.execute<{ max_num: string | null }>(
        sql.raw(`
          SELECT COALESCE(
            MAX(CAST(SUBSTRING(vehicle_id FROM 'VEH-(\\d+)') AS INTEGER)),
            0
          ) as max_num
          FROM org.vehicles
          WHERE vehicle_id ~ '^VEH-\\d+$'
            AND is_deleted = false
        `),
      );
      const maxNum = maxNumResult.rows[0]?.max_num;
      const nextIdNumber = maxNum ? parseInt(maxNum, 10) + 1 : 1;
      return `VEH-${String(nextIdNumber).padStart(6, "0")}`;
    } catch (sqlError) {
      console.warn("Vehicle ID fallback failed:", sqlError);
      return `VEH-${String(Date.now() % 1000000).padStart(6, "0")}`;
    }
  }
};

// Create Vehicle
export const createVehicle = async (data: CreateVehicleData) => {
  const vehicleId = await generateVehicleId();
  const insertData: any = {
    vehicleId,
    make: data.make,
    model: data.model,
    year: data.year,
    licensePlate: data.licensePlate,
    type: data.type,
    status: data.status || "active",
    mileage: data.mileage || "0",
  };

  // Optional fields
  if (data.color) insertData.color = data.color;
  if (data.vin) insertData.vin = data.vin;
  if (data.assignedToEmployeeId)
    insertData.assignedToEmployeeId = data.assignedToEmployeeId;
  if (data.fuelLevel) insertData.fuelLevel = data.fuelLevel;
  if (data.purchaseDate)
    insertData.purchaseDate =
      data.purchaseDate instanceof Date
        ? data.purchaseDate.toISOString().split("T")[0]
        : data.purchaseDate;
  if (data.purchaseCost) insertData.purchaseCost = data.purchaseCost;
  if (data.dealer) insertData.dealer = data.dealer;
  if (data.monthlyPayment) insertData.monthlyPayment = data.monthlyPayment;
  if (data.loanBalance) insertData.loanBalance = data.loanBalance;
  if (data.estimatedValue) insertData.estimatedValue = data.estimatedValue;
  if (data.insuranceProvider)
    insertData.insuranceProvider = data.insuranceProvider;
  if (data.insurancePolicyNumber)
    insertData.insurancePolicyNumber = data.insurancePolicyNumber;
  if (data.insuranceCoverage)
    insertData.insuranceCoverage = data.insuranceCoverage;
  if (data.insuranceExpiration)
    insertData.insuranceExpiration =
      data.insuranceExpiration instanceof Date
        ? data.insuranceExpiration.toISOString().split("T")[0]
        : data.insuranceExpiration;
  if (data.insuranceAnnualPremium)
    insertData.insuranceAnnualPremium = data.insuranceAnnualPremium;
  if (data.registrationState)
    insertData.registrationState = data.registrationState;
  if (data.registrationNumber)
    insertData.registrationNumber = data.registrationNumber;
  if (data.registrationExpiration)
    insertData.registrationExpiration =
      data.registrationExpiration instanceof Date
        ? data.registrationExpiration.toISOString().split("T")[0]
        : data.registrationExpiration;
  if (data.mileageRate) insertData.mileageRate = data.mileageRate;
  if (data.vehicleDayRate) insertData.vehicleDayRate = data.vehicleDayRate;
  if (data.mpg) insertData.mpg = data.mpg;
  if (data.image) insertData.image = data.image;

  const result = await db.insert(vehicles).values(insertData).returning();

  // Return enriched data with names (following cursor rule)
  const inserted = result[0];
  if (!inserted) throw new Error("Failed to create vehicle");
  return await getVehicleById(inserted.id);
};

// Update Vehicle
export const updateVehicle = async (id: string, data: UpdateVehicleData) => {
  const updateData: any = {
    updatedAt: new Date(),
  };

  // Update only provided fields
  if (data.vehicleId !== undefined) updateData.vehicleId = data.vehicleId;
  if (data.make !== undefined) updateData.make = data.make;
  if (data.model !== undefined) updateData.model = data.model;
  if (data.year !== undefined) updateData.year = data.year;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.vin !== undefined) updateData.vin = data.vin;
  if (data.licensePlate !== undefined)
    updateData.licensePlate = data.licensePlate;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.assignedToEmployeeId !== undefined)
    updateData.assignedToEmployeeId = data.assignedToEmployeeId;
  if (data.currentJobId !== undefined)
    updateData.currentJobId = data.currentJobId;
  if (data.currentDispatchTaskId !== undefined)
    updateData.currentDispatchTaskId = data.currentDispatchTaskId;
  if (data.mileage !== undefined) updateData.mileage = data.mileage;
  if (data.fuelLevel !== undefined) updateData.fuelLevel = data.fuelLevel;
  if (data.lastService !== undefined)
    updateData.lastService =
      data.lastService instanceof Date
        ? data.lastService.toISOString().split("T")[0]
        : data.lastService;
  if (data.nextService !== undefined)
    updateData.nextService =
      data.nextService instanceof Date
        ? data.nextService.toISOString().split("T")[0]
        : data.nextService;
  if (data.nextServiceDue !== undefined)
    updateData.nextServiceDue =
      data.nextServiceDue instanceof Date
        ? data.nextServiceDue.toISOString().split("T")[0]
        : data.nextServiceDue;
  if (data.nextServiceDays !== undefined)
    updateData.nextServiceDays = data.nextServiceDays;
  if (data.nextInspectionDue !== undefined)
    updateData.nextInspectionDue =
      data.nextInspectionDue instanceof Date
        ? data.nextInspectionDue.toISOString().split("T")[0]
        : data.nextInspectionDue;
  if (data.nextInspectionDays !== undefined)
    updateData.nextInspectionDays = data.nextInspectionDays;
  if (data.purchaseDate !== undefined)
    updateData.purchaseDate =
      data.purchaseDate instanceof Date
        ? data.purchaseDate.toISOString().split("T")[0]
        : data.purchaseDate;
  if (data.purchaseCost !== undefined)
    updateData.purchaseCost = data.purchaseCost;
  if (data.dealer !== undefined) updateData.dealer = data.dealer;
  if (data.monthlyPayment !== undefined)
    updateData.monthlyPayment = data.monthlyPayment;
  if (data.loanBalance !== undefined) updateData.loanBalance = data.loanBalance;
  if (data.estimatedValue !== undefined)
    updateData.estimatedValue = data.estimatedValue;
  if (data.insuranceProvider !== undefined)
    updateData.insuranceProvider = data.insuranceProvider;
  if (data.insurancePolicyNumber !== undefined)
    updateData.insurancePolicyNumber = data.insurancePolicyNumber;
  if (data.insuranceCoverage !== undefined)
    updateData.insuranceCoverage = data.insuranceCoverage;
  if (data.insuranceExpiration !== undefined)
    updateData.insuranceExpiration =
      data.insuranceExpiration instanceof Date
        ? data.insuranceExpiration.toISOString().split("T")[0]
        : data.insuranceExpiration;
  if (data.insuranceAnnualPremium !== undefined)
    updateData.insuranceAnnualPremium = data.insuranceAnnualPremium;
  if (data.registrationState !== undefined)
    updateData.registrationState = data.registrationState;
  if (data.registrationNumber !== undefined)
    updateData.registrationNumber = data.registrationNumber;
  if (data.registrationExpiration !== undefined)
    updateData.registrationExpiration =
      data.registrationExpiration instanceof Date
        ? data.registrationExpiration.toISOString().split("T")[0]
        : data.registrationExpiration;
  if (data.mileageRate !== undefined) updateData.mileageRate = data.mileageRate;
  if (data.vehicleDayRate !== undefined)
    updateData.vehicleDayRate = data.vehicleDayRate;
  if (data.mpg !== undefined) updateData.mpg = data.mpg;
  if (data.milesLast12Months !== undefined)
    updateData.milesLast12Months = data.milesLast12Months;
  if (data.serviceHistoryCostLast12Months !== undefined)
    updateData.serviceHistoryCostLast12Months =
      data.serviceHistoryCostLast12Months;
  if (data.deliveryCompleted !== undefined)
    updateData.deliveryCompleted = data.deliveryCompleted;
  if (data.currentLocationLat !== undefined)
    updateData.currentLocationLat = data.currentLocationLat;
  if (data.currentLocationLng !== undefined)
    updateData.currentLocationLng = data.currentLocationLng;
  if (data.currentLocationAddress !== undefined)
    updateData.currentLocationAddress = data.currentLocationAddress;
  if (data.image !== undefined) updateData.image = data.image;

  // When assignedToEmployeeId changes: end current assignment and optionally start a new one
  if (data.assignedToEmployeeId !== undefined) {
    const today = new Date().toISOString().split("T")[0]!;
    // End any active assignment for this vehicle
    await db
      .update(assignmentHistory)
      .set({
        endDate: today,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(assignmentHistory.vehicleId, id),
          eq(assignmentHistory.status, "active"),
          eq(assignmentHistory.isDeleted, false),
        ),
      );
    // If assigning to a new driver, create a new assignment history row (driver from vehicles.assignedToEmployeeId, job from vehicles.currentDispatchTaskId)
    if (data.assignedToEmployeeId != null) {
      await db.insert(assignmentHistory).values({
        vehicleId: id,
        startDate: today,
        status: "active",
      });
    }
  }

  const result = await db
    .update(vehicles)
    .set(updateData)
    .where(and(eq(vehicles.id, id), eq(vehicles.isDeleted, false)))
    .returning();

  return result[0] || null;
};

// Soft Delete Vehicle
export const deleteVehicle = async (id: string) => {
  const result = await db
    .update(vehicles)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(vehicles.id, id), eq(vehicles.isDeleted, false)))
    .returning();

  return result[0] || null;
};

// ============================
// ASSIGNMENT HISTORY SERVICE
// ============================

export const getAssignmentHistoryByVehicleId = async (
  vehicleId: string,
  offset: number,
  limit: number,
  filters: {
    status?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } = {},
) => {
  const { status, sortBy = "startDate", sortOrder = "desc" } = filters;
  const conditions = [
    eq(assignmentHistory.vehicleId, vehicleId),
    eq(assignmentHistory.isDeleted, false),
    ...(status ? [eq(assignmentHistory.status, status)] : []),
  ];
  const orderBy =
    sortBy === "endDate"
      ? sortOrder === "asc"
        ? asc(assignmentHistory.endDate)
        : desc(assignmentHistory.endDate)
      : sortBy === "createdAt"
        ? sortOrder === "asc"
          ? asc(assignmentHistory.createdAt)
          : desc(assignmentHistory.createdAt)
        : sortOrder === "asc"
          ? asc(assignmentHistory.startDate)
          : desc(assignmentHistory.startDate);

  const totalResult = await db
    .select({ count: count() })
    .from(assignmentHistory)
    .where(and(...conditions));
  const total = totalResult[0]?.count || 0;

  const rows = await db
    .select()
    .from(assignmentHistory)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data: rows,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ============================
// VEHICLE METRICS (derived for dashboard cards)
// ============================

/**
 * Vehicle condition is derived in this order:
 * 1. Last safety inspection: passed/conditional_pass → Good, failed → Poor, scheduled/overdue → Fair.
 * 2. If no inspections: use vehicle status + open/overdue repairs + overdue maintenance:
 *    - out_of_service → Poor.
 *    - Open repair with status overdue → Poor (repair neglected).
 *    - in_maintenance, or any open repair, or overdue maintenance → Fair (under care or minor issues).
 *    - Active, no open repairs, no overdue maintenance → Good.
 */
export const getVehicleMetrics = async (
  vehicleId: string,
): Promise<VehicleMetrics | null> => {
  const [vehicle] = await db
    .select({
      mileage: vehicles.mileage,
      estimatedValue: vehicles.estimatedValue,
      deliveryCompleted: vehicles.deliveryCompleted,
      status: vehicles.status,
    })
    .from(vehicles)
    .where(and(eq(vehicles.id, vehicleId), eq(vehicles.isDeleted, false)))
    .limit(1);

  if (!vehicle) return null;

  const [maintenanceCount] = await db
    .select({ count: count() })
    .from(maintenanceRecords)
    .where(
      and(
        eq(maintenanceRecords.vehicleId, vehicleId),
        eq(maintenanceRecords.isDeleted, false),
      ),
    );

  const [overdueMaintenanceCount] = await db
    .select({ count: count() })
    .from(maintenanceRecords)
    .where(
      and(
        eq(maintenanceRecords.vehicleId, vehicleId),
        eq(maintenanceRecords.isDeleted, false),
        eq(maintenanceRecords.status, "overdue"),
      ),
    );

  const openRepairs = await db
    .select({
      status: repairRecords.status,
      priority: repairRecords.priority,
    })
    .from(repairRecords)
    .where(
      and(
        eq(repairRecords.vehicleId, vehicleId),
        eq(repairRecords.isDeleted, false),
        notInArray(repairRecords.status, ["completed", "cancelled"]),
      ),
    );

  const inspectionRows = await db
    .select({ overallStatus: safetyInspections.overallStatus })
    .from(safetyInspections)
    .where(
      and(
        eq(safetyInspections.vehicleId, vehicleId),
        eq(safetyInspections.isDeleted, false),
      ),
    )
    .orderBy(desc(safetyInspections.date));
  const totalInspections = inspectionRows.length;
  const passedInspections = inspectionRows.filter(
    (r) =>
      r.overallStatus === "passed" || r.overallStatus === "conditional_pass",
  ).length;
  const inspectionPct =
    totalInspections > 0
      ? Math.round((passedInspections / totalInspections) * 100)
      : 0;

  const mileageStr =
    vehicle.mileage != null
      ? `${Number(vehicle.mileage).toLocaleString("en-US", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })} mi`
      : "0 mi";

  const valueStr =
    vehicle.estimatedValue != null && Number(vehicle.estimatedValue) > 0
      ? `$${Number(vehicle.estimatedValue).toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}`
      : "—";

  const deliveries = vehicle.deliveryCompleted ?? 0;

  const lastInspection = inspectionRows[inspectionRows.length - 1];
  let condition: string;
  if (lastInspection) {
    if (
      lastInspection.overallStatus === "passed" ||
      lastInspection.overallStatus === "conditional_pass"
    )
      condition = "Good";
    else if (lastInspection.overallStatus === "failed") condition = "Poor";
    else condition = "Fair";
  } else {
    const vehicleStatus = vehicle.status ?? "active";
    const overdueCount = overdueMaintenanceCount?.count ?? 0;
    const hasOpenRepairs = openRepairs.length > 0;
    const hasOverdueRepair = openRepairs.some((r) => r.status === "overdue");
    if (vehicleStatus === "out_of_service") condition = "Poor";
    else if (hasOverdueRepair) condition = "Poor";
    else if (
      vehicleStatus === "in_maintenance" ||
      hasOpenRepairs ||
      overdueCount > 0
    )
      condition = "Fair";
    else condition = "Good";
  }

  return {
    mileage: mileageStr,
    maintenance: maintenanceCount?.count ?? 0,
    inspection: inspectionPct,
    value: valueStr,
    deliveries,
    condition,
  };
};

// ============================
// MAINTENANCE RECORDS SERVICE
// ============================

// Get Maintenance Records with Pagination
export const getMaintenanceRecords = async (
  offset: number,
  limit: number,
  filters: {
    vehicleId?: string;
    status?: string;
    priority?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
) => {
  const {
    vehicleId,
    status,
    priority,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const conditions = [
    eq(maintenanceRecords.isDeleted, false),
    ...(vehicleId ? [eq(maintenanceRecords.vehicleId, vehicleId)] : []),
    ...(status ? [eq(maintenanceRecords.status, status as any)] : []),
    ...(priority ? [eq(maintenanceRecords.priority, priority as any)] : []),
  ];

  let orderBy: any;
  if (sortBy === "createdAt") {
    orderBy =
      sortOrder === "asc"
        ? asc(maintenanceRecords.createdAt)
        : desc(maintenanceRecords.createdAt);
  } else if (sortBy === "date") {
    orderBy =
      sortOrder === "asc"
        ? asc(maintenanceRecords.date)
        : desc(maintenanceRecords.date);
  } else {
    orderBy = desc(maintenanceRecords.createdAt);
  }

  const totalResult = await db
    .select({ count: count() })
    .from(maintenanceRecords)
    .where(and(...conditions));

  const total = totalResult[0]?.count || 0;

  const records = await db
    .select()
    .from(maintenanceRecords)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data: records,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Aliases for joining users table multiple times (createdBy, approvedBy, rejectedBy, assignedToEmployee)
const createdByUser = alias(users, "created_by_user");
const approvedByUser = alias(users, "approved_by_user");
const rejectedByUser = alias(users, "rejected_by_user");
const assignedToUser = alias(users, "assigned_to_user");

// Get Maintenance Record by ID (with createdByName, approvedByName, rejectedByName, assignedToEmployeeName)
export const getMaintenanceRecordById = async (id: string) => {
  const [row] = await db
    .select({
      ...getTableColumns(maintenanceRecords),
      createdByName: createdByUser.fullName,
      approvedByName: approvedByUser.fullName,
      rejectedByName: rejectedByUser.fullName,
      assignedToEmployeeName: assignedToUser.fullName,
    })
    .from(maintenanceRecords)
    .leftJoin(createdByUser, eq(maintenanceRecords.createdBy, createdByUser.id))
    .leftJoin(
      approvedByUser,
      eq(maintenanceRecords.approvedBy, approvedByUser.id),
    )
    .leftJoin(
      rejectedByUser,
      eq(maintenanceRecords.rejectedBy, rejectedByUser.id),
    )
    .leftJoin(
      employees,
      eq(maintenanceRecords.assignedToEmployeeId, employees.id),
    )
    .leftJoin(assignedToUser, eq(employees.userId, assignedToUser.id))
    .where(
      and(
        eq(maintenanceRecords.id, id),
        eq(maintenanceRecords.isDeleted, false),
      ),
    );

  if (!row) return null;

  const {
    createdByName,
    approvedByName,
    rejectedByName,
    assignedToEmployeeName,
    ...record
  } = row;
  return {
    ...record,
    createdByName: createdByName ?? null,
    approvedByName: approvedByName ?? null,
    rejectedByName: rejectedByName ?? null,
    assignedToEmployeeName: assignedToEmployeeName ?? null,
    // performedBy is free-text; expose as performedByName for consistent API
    performedByName: record.performedBy ?? null,
  };
};

// Create Maintenance Record
export const createMaintenanceRecord = async (
  data: CreateMaintenanceRecordData,
) => {
  const insertData: any = {
    vehicleId: data.vehicleId,
    type: data.type,
    description: data.description,
    status: data.status || "scheduled",
    cost: data.cost || "0",
    date:
      data.date instanceof Date
        ? data.date.toISOString().split("T")[0]
        : data.date,
  };

  if (data.priority) insertData.priority = data.priority;
  if (data.mileage) insertData.mileage = data.mileage;
  if (data.scheduledDate)
    insertData.scheduledDate =
      data.scheduledDate instanceof Date
        ? data.scheduledDate.toISOString().split("T")[0]
        : data.scheduledDate;
  if (data.estimatedDuration)
    insertData.estimatedDuration = data.estimatedDuration;
  if (data.vendor) insertData.vendor = data.vendor;
  if (data.performedBy) insertData.performedBy = data.performedBy;
  if (data.assignedToEmployeeId)
    insertData.assignedToEmployeeId = data.assignedToEmployeeId;
  if (data.needsApproval !== undefined)
    insertData.needsApproval = data.needsApproval;
  if (data.note) insertData.note = data.note;
  if (data.createdBy) insertData.createdBy = data.createdBy;

  const result = await db
    .insert(maintenanceRecords)
    .values(insertData)
    .returning();

  // Return enriched data with names (following cursor rule)
  const inserted = result[0];
  if (!inserted) throw new Error("Failed to create maintenance record");
  return await getMaintenanceRecordById(inserted.id);
};

// Update Maintenance Record
export const updateMaintenanceRecord = async (
  id: string,
  data: UpdateMaintenanceRecordData,
) => {
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.type !== undefined) updateData.type = data.type;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.cost !== undefined) updateData.cost = data.cost;
  if (data.date !== undefined)
    updateData.date =
      data.date instanceof Date
        ? data.date.toISOString().split("T")[0]
        : data.date;
  if (data.mileage !== undefined) updateData.mileage = data.mileage;
  if (data.scheduledDate !== undefined)
    updateData.scheduledDate =
      data.scheduledDate instanceof Date
        ? data.scheduledDate.toISOString().split("T")[0]
        : data.scheduledDate;
  if (data.estimatedDuration !== undefined)
    updateData.estimatedDuration = data.estimatedDuration;
  if (data.vendor !== undefined) updateData.vendor = data.vendor;
  if (data.performedBy !== undefined) updateData.performedBy = data.performedBy;
  if (data.assignedToEmployeeId !== undefined)
    updateData.assignedToEmployeeId = data.assignedToEmployeeId;
  if (data.needsApproval !== undefined)
    updateData.needsApproval = data.needsApproval;
  if (data.approvedBy !== undefined) updateData.approvedBy = data.approvedBy;
  if (data.approvedDate !== undefined)
    updateData.approvedDate = data.approvedDate;
  if (data.approvalComments !== undefined)
    updateData.approvalComments = data.approvalComments;
  if (data.rejectedBy !== undefined) updateData.rejectedBy = data.rejectedBy;
  if (data.rejectedDate !== undefined)
    updateData.rejectedDate = data.rejectedDate;
  if (data.rejectionReason !== undefined)
    updateData.rejectionReason = data.rejectionReason;
  if (data.note !== undefined) updateData.note = data.note;

  const result = await db
    .update(maintenanceRecords)
    .set(updateData)
    .where(
      and(
        eq(maintenanceRecords.id, id),
        eq(maintenanceRecords.isDeleted, false),
      ),
    )
    .returning();

  return result[0] || null;
};

// Soft Delete Maintenance Record
export const deleteMaintenanceRecord = async (id: string) => {
  const result = await db
    .update(maintenanceRecords)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(maintenanceRecords.id, id),
        eq(maintenanceRecords.isDeleted, false),
      ),
    )
    .returning();

  return result[0] || null;
};

// ============================
// REPAIR RECORDS SERVICE
// ============================

// Get Repair Records with Pagination
export const getRepairRecords = async (
  offset: number,
  limit: number,
  filters: {
    vehicleId?: string;
    status?: string;
    priority?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
) => {
  const {
    vehicleId,
    status,
    priority,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const conditions = [
    eq(repairRecords.isDeleted, false),
    ...(vehicleId ? [eq(repairRecords.vehicleId, vehicleId)] : []),
    ...(status ? [eq(repairRecords.status, status as any)] : []),
    ...(priority ? [eq(repairRecords.priority, priority as any)] : []),
  ];

  let orderBy: any;
  if (sortBy === "createdAt") {
    orderBy =
      sortOrder === "asc"
        ? asc(repairRecords.createdAt)
        : desc(repairRecords.createdAt);
  } else if (sortBy === "date") {
    orderBy =
      sortOrder === "asc" ? asc(repairRecords.date) : desc(repairRecords.date);
  } else {
    orderBy = desc(repairRecords.createdAt);
  }

  const totalResult = await db
    .select({ count: count() })
    .from(repairRecords)
    .where(and(...conditions));

  const total = totalResult[0]?.count || 0;

  const records = await db
    .select()
    .from(repairRecords)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data: records,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get Repair Record by ID (with createdByName, approvedByName, rejectedByName, assignedToEmployeeName)
export const getRepairRecordById = async (id: string) => {
  const [row] = await db
    .select({
      ...getTableColumns(repairRecords),
      createdByName: createdByUser.fullName,
      approvedByName: approvedByUser.fullName,
      rejectedByName: rejectedByUser.fullName,
      assignedToEmployeeName: assignedToUser.fullName,
    })
    .from(repairRecords)
    .leftJoin(createdByUser, eq(repairRecords.createdBy, createdByUser.id))
    .leftJoin(approvedByUser, eq(repairRecords.approvedBy, approvedByUser.id))
    .leftJoin(rejectedByUser, eq(repairRecords.rejectedBy, rejectedByUser.id))
    .leftJoin(employees, eq(repairRecords.assignedToEmployeeId, employees.id))
    .leftJoin(assignedToUser, eq(employees.userId, assignedToUser.id))
    .where(and(eq(repairRecords.id, id), eq(repairRecords.isDeleted, false)));

  if (!row) return null;

  const {
    createdByName,
    approvedByName,
    rejectedByName,
    assignedToEmployeeName,
    ...record
  } = row;
  return {
    ...record,
    createdByName: createdByName ?? null,
    approvedByName: approvedByName ?? null,
    rejectedByName: rejectedByName ?? null,
    assignedToEmployeeName: assignedToEmployeeName ?? null,
    // reportedBy is free-text; expose as reportedByName for consistency
    reportedByName: record.reportedBy ?? null,
  };
};

// Create Repair Record
export const createRepairRecord = async (data: CreateRepairRecordData) => {
  const insertData: any = {
    vehicleId: data.vehicleId,
    type: data.type,
    description: data.description,
    status: data.status || "scheduled",
    cost: data.cost || "0",
    date:
      data.date instanceof Date
        ? data.date.toISOString().split("T")[0]
        : data.date,
  };

  if (data.priority) insertData.priority = data.priority;
  if (data.mileage) insertData.mileage = data.mileage;
  if (data.scheduledDate)
    insertData.scheduledDate =
      data.scheduledDate instanceof Date
        ? data.scheduledDate.toISOString().split("T")[0]
        : data.scheduledDate;
  if (data.estimatedDuration)
    insertData.estimatedDuration = data.estimatedDuration;
  if (data.reportedBy) insertData.reportedBy = data.reportedBy;
  if (data.vendor) insertData.vendor = data.vendor;
  if (data.assignedToEmployeeId)
    insertData.assignedToEmployeeId = data.assignedToEmployeeId;
  if (data.linkedMaintenanceId)
    insertData.linkedMaintenanceId = data.linkedMaintenanceId;
  if (data.linkedInspectionId)
    insertData.linkedInspectionId = data.linkedInspectionId;
  if (data.needsApproval !== undefined)
    insertData.needsApproval = data.needsApproval;
  if (data.notes) insertData.notes = data.notes;
  if (data.createdBy) insertData.createdBy = data.createdBy;

  const result = await db.insert(repairRecords).values(insertData).returning();

  // Return enriched data with names (following cursor rule)
  const inserted = result[0];
  if (!inserted) throw new Error("Failed to create repair record");
  return await getRepairRecordById(inserted.id);
};

// Update Repair Record
export const updateRepairRecord = async (
  id: string,
  data: UpdateRepairRecordData,
) => {
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.type !== undefined) updateData.type = data.type;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.cost !== undefined) updateData.cost = data.cost;
  if (data.date !== undefined)
    updateData.date =
      data.date instanceof Date
        ? data.date.toISOString().split("T")[0]
        : data.date;
  if (data.mileage !== undefined) updateData.mileage = data.mileage;
  if (data.scheduledDate !== undefined)
    updateData.scheduledDate =
      data.scheduledDate instanceof Date
        ? data.scheduledDate.toISOString().split("T")[0]
        : data.scheduledDate;
  if (data.estimatedDuration !== undefined)
    updateData.estimatedDuration = data.estimatedDuration;
  if (data.reportedBy !== undefined) updateData.reportedBy = data.reportedBy;
  if (data.vendor !== undefined) updateData.vendor = data.vendor;
  if (data.assignedToEmployeeId !== undefined)
    updateData.assignedToEmployeeId = data.assignedToEmployeeId;
  if (data.linkedMaintenanceId !== undefined)
    updateData.linkedMaintenanceId = data.linkedMaintenanceId;
  if (data.linkedInspectionId !== undefined)
    updateData.linkedInspectionId = data.linkedInspectionId;
  if (data.needsApproval !== undefined)
    updateData.needsApproval = data.needsApproval;
  if (data.approvedBy !== undefined) updateData.approvedBy = data.approvedBy;
  if (data.approvedDate !== undefined)
    updateData.approvedDate = data.approvedDate;
  if (data.approvalComments !== undefined)
    updateData.approvalComments = data.approvalComments;
  if (data.rejectedBy !== undefined) updateData.rejectedBy = data.rejectedBy;
  if (data.rejectedDate !== undefined)
    updateData.rejectedDate = data.rejectedDate;
  if (data.rejectionReason !== undefined)
    updateData.rejectionReason = data.rejectionReason;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const result = await db
    .update(repairRecords)
    .set(updateData)
    .where(and(eq(repairRecords.id, id), eq(repairRecords.isDeleted, false)))
    .returning();

  return result[0] || null;
};

// Soft Delete Repair Record
export const deleteRepairRecord = async (id: string) => {
  const result = await db
    .update(repairRecords)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(repairRecords.id, id), eq(repairRecords.isDeleted, false)))
    .returning();

  return result[0] || null;
};

// ============================
// SAFETY INSPECTIONS SERVICE
// ============================

// Get Safety Inspections with Pagination
export const getSafetyInspections = async (
  offset: number,
  limit: number,
  filters: {
    vehicleId?: string;
    overallStatus?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
) => {
  const {
    vehicleId,
    overallStatus,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const conditions = [
    eq(safetyInspections.isDeleted, false),
    ...(vehicleId ? [eq(safetyInspections.vehicleId, vehicleId)] : []),
    ...(overallStatus
      ? [eq(safetyInspections.overallStatus, overallStatus as any)]
      : []),
  ];

  let orderBy: any;
  if (sortBy === "createdAt") {
    orderBy =
      sortOrder === "asc"
        ? asc(safetyInspections.createdAt)
        : desc(safetyInspections.createdAt);
  } else if (sortBy === "date") {
    orderBy =
      sortOrder === "asc"
        ? asc(safetyInspections.date)
        : desc(safetyInspections.date);
  } else {
    orderBy = desc(safetyInspections.createdAt);
  }

  const totalResult = await db
    .select({ count: count() })
    .from(safetyInspections)
    .where(and(...conditions));

  const total = totalResult[0]?.count || 0;

  const inspections = await db
    .select()
    .from(safetyInspections)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data: inspections,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get Safety Inspection by ID (with createdByName, employeeName, performedByName)
export const getSafetyInspectionById = async (id: string) => {
  const employeeUser = alias(users, "employee_user");
  const [row] = await db
    .select({
      ...getTableColumns(safetyInspections),
      createdByName: createdByUser.fullName,
      employeeName: employeeUser.fullName,
    })
    .from(safetyInspections)
    .leftJoin(createdByUser, eq(safetyInspections.createdBy, createdByUser.id))
    .leftJoin(employees, eq(safetyInspections.employeeId, employees.id))
    .leftJoin(employeeUser, eq(employees.userId, employeeUser.id))
    .where(
      and(eq(safetyInspections.id, id), eq(safetyInspections.isDeleted, false)),
    );

  if (!row) return null;

  const { createdByName, employeeName, ...record } = row;
  return {
    ...record,
    createdByName: createdByName ?? null,
    employeeName: employeeName ?? null,
    // performedBy is free-text; expose as performedByName for consistency
    performedByName: record.performedBy ?? null,
  };
};

// Create Safety Inspection
export const createSafetyInspection = async (
  data: CreateSafetyInspectionData,
) => {
  const insertData: any = {
    vehicleId: data.vehicleId,
    date:
      data.date instanceof Date
        ? data.date.toISOString().split("T")[0]
        : data.date,
    overallStatus: data.overallStatus,
    isTeamMember: data.isTeamMember,
  };

  // Handle team member vs external performer logic
  if (data.isTeamMember) {
    if (data.employeeId) {
      insertData.employeeId = data.employeeId;
    }
    // performedBy will be null for team members (employee name will be used)
  } else {
    if (data.performedBy) {
      insertData.performedBy = data.performedBy;
    }
    // employeeId will be null for external performers
  }

  if (data.mileage) insertData.mileage = data.mileage;
  if (data.inspectionNotes) insertData.inspectionNotes = data.inspectionNotes;
  if (data.checklist) insertData.checklist = data.checklist;
  if (data.exteriorPhotos) insertData.exteriorPhotos = data.exteriorPhotos;
  if (data.interiorPhotos) insertData.interiorPhotos = data.interiorPhotos;
  if (data.createdBy) insertData.createdBy = data.createdBy;

  const result = await db
    .insert(safetyInspections)
    .values(insertData)
    .returning();

  // Return enriched data with names (following cursor rule)
  const inserted = result[0];
  if (!inserted) throw new Error("Failed to create safety inspection");
  return await getSafetyInspectionById(inserted.id);
};

// Update Safety Inspection
export const updateSafetyInspection = async (
  id: string,
  data: UpdateSafetyInspectionData,
) => {
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.date !== undefined)
    updateData.date =
      data.date instanceof Date
        ? data.date.toISOString().split("T")[0]
        : data.date;
  if (data.mileage !== undefined) updateData.mileage = data.mileage;
  if (data.performedBy !== undefined) updateData.performedBy = data.performedBy;
  if (data.overallStatus !== undefined)
    updateData.overallStatus = data.overallStatus;
  if (data.inspectionNotes !== undefined)
    updateData.inspectionNotes = data.inspectionNotes;
  if (data.checklist !== undefined) updateData.checklist = data.checklist;
  if (data.isTeamMember !== undefined) {
    updateData.isTeamMember = data.isTeamMember;
    // Handle logic change: if switching to team member, clear performedBy
    if (data.isTeamMember) {
      updateData.performedBy = null;
    } else {
      updateData.employeeId = null;
    }
  }
  if (data.employeeId !== undefined) updateData.employeeId = data.employeeId;
  if (data.exteriorPhotos !== undefined)
    updateData.exteriorPhotos = data.exteriorPhotos;
  if (data.interiorPhotos !== undefined)
    updateData.interiorPhotos = data.interiorPhotos;

  const result = await db
    .update(safetyInspections)
    .set(updateData)
    .where(
      and(eq(safetyInspections.id, id), eq(safetyInspections.isDeleted, false)),
    )
    .returning();

  return result[0] || null;
};

// Soft Delete Safety Inspection
export const deleteSafetyInspection = async (id: string) => {
  const result = await db
    .update(safetyInspections)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(eq(safetyInspections.id, id), eq(safetyInspections.isDeleted, false)),
    )
    .returning();

  return result[0] || null;
};

// ============================
// SAFETY INSPECTION ITEMS SERVICE
// ============================

// Get Safety Inspection Items by Inspection ID
export const getSafetyInspectionItems = async (inspectionId: string) => {
  const items = await db
    .select()
    .from(safetyInspectionItems)
    .where(
      and(
        eq(safetyInspectionItems.inspectionId, inspectionId),
        eq(safetyInspectionItems.isDeleted, false),
      ),
    )
    .orderBy(
      asc(safetyInspectionItems.category),
      asc(safetyInspectionItems.item),
    );

  return items;
};

// Create Safety Inspection Item
export const createSafetyInspectionItem = async (
  data: CreateSafetyInspectionItemData,
) => {
  const insertData: any = {
    inspectionId: data.inspectionId,
    category: data.category,
    item: data.item,
    status: data.status,
  };

  if (data.notes) insertData.notes = data.notes;

  const result = await db
    .insert(safetyInspectionItems)
    .values(insertData)
    .returning();

  return result[0];
};

// ============================
// FUEL RECORDS SERVICE
// ============================

// Get Fuel Records with Pagination
export const getFuelRecords = async (
  offset: number,
  limit: number,
  filters: {
    vehicleId?: string;
    fuelType?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
) => {
  const {
    vehicleId,
    fuelType,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const conditions = [
    eq(fuelRecords.isDeleted, false),
    ...(vehicleId ? [eq(fuelRecords.vehicleId, vehicleId)] : []),
    ...(fuelType ? [eq(fuelRecords.fuelType, fuelType as any)] : []),
  ];

  let orderBy: any;
  if (sortBy === "createdAt") {
    orderBy =
      sortOrder === "asc"
        ? asc(fuelRecords.createdAt)
        : desc(fuelRecords.createdAt);
  } else if (sortBy === "date") {
    orderBy =
      sortOrder === "asc" ? asc(fuelRecords.date) : desc(fuelRecords.date);
  } else {
    orderBy = desc(fuelRecords.createdAt);
  }

  const totalResult = await db
    .select({ count: count() })
    .from(fuelRecords)
    .where(and(...conditions));

  const total = totalResult[0]?.count || 0;

  const records = await db
    .select()
    .from(fuelRecords)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data: records,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get Fuel Record by ID (with createdByName, employeeName)
export const getFuelRecordById = async (id: string) => {
  const employeeUser = alias(users, "employee_user");
  const [row] = await db
    .select({
      ...getTableColumns(fuelRecords),
      createdByName: createdByUser.fullName,
      employeeName: employeeUser.fullName,
    })
    .from(fuelRecords)
    .leftJoin(createdByUser, eq(fuelRecords.createdBy, createdByUser.id))
    .leftJoin(employees, eq(fuelRecords.employeeId, employees.id))
    .leftJoin(employeeUser, eq(employees.userId, employeeUser.id))
    .where(and(eq(fuelRecords.id, id), eq(fuelRecords.isDeleted, false)));

  if (!row) return null;

  const { createdByName, employeeName, ...record } = row;
  return {
    ...record,
    createdByName: createdByName ?? null,
    employeeName: employeeName ?? null,
  };
};

// Create Fuel Record
export const createFuelRecord = async (data: CreateFuelRecordData) => {
  const insertData: any = {
    vehicleId: data.vehicleId,
    date:
      data.date instanceof Date
        ? data.date.toISOString().split("T")[0]
        : data.date,
    odometer: data.odometer,
    gallons: data.gallons,
    cost: data.cost,
    fuelType: data.fuelType,
  };

  if (data.location) insertData.location = data.location;
  if (data.employeeId) insertData.employeeId = data.employeeId;
  if (data.notes) insertData.notes = data.notes;
  if (data.createdBy) insertData.createdBy = data.createdBy;

  const result = await db.insert(fuelRecords).values(insertData).returning();

  // Return enriched data with names (following cursor rule)
  const inserted = result[0];
  if (!inserted) throw new Error("Failed to create fuel record");
  return await getFuelRecordById(inserted.id);
};

// Update Fuel Record
export const updateFuelRecord = async (
  id: string,
  data: UpdateFuelRecordData,
) => {
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.date !== undefined)
    updateData.date =
      data.date instanceof Date
        ? data.date.toISOString().split("T")[0]
        : data.date;
  if (data.odometer !== undefined) updateData.odometer = data.odometer;
  if (data.gallons !== undefined) updateData.gallons = data.gallons;
  if (data.cost !== undefined) updateData.cost = data.cost;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.fuelType !== undefined) updateData.fuelType = data.fuelType;
  if (data.employeeId !== undefined) updateData.employeeId = data.employeeId;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const result = await db
    .update(fuelRecords)
    .set(updateData)
    .where(and(eq(fuelRecords.id, id), eq(fuelRecords.isDeleted, false)))
    .returning();

  return result[0] || null;
};

// Soft Delete Fuel Record
export const deleteFuelRecord = async (id: string) => {
  const result = await db
    .update(fuelRecords)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(fuelRecords.id, id), eq(fuelRecords.isDeleted, false)))
    .returning();

  return result[0] || null;
};

// ============================
// CHECK-IN/OUT RECORDS SERVICE
// ============================

// Get Check-In/Out Records with Pagination
export const getCheckInOutRecords = async (
  offset: number,
  limit: number,
  filters: {
    vehicleId?: string;
    type?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
) => {
  const { vehicleId, type, sortBy = "createdAt", sortOrder = "desc" } = filters;

  const conditions = [
    eq(checkInOutRecords.isDeleted, false),
    ...(vehicleId ? [eq(checkInOutRecords.vehicleId, vehicleId)] : []),
    ...(type ? [eq(checkInOutRecords.type, type as any)] : []),
  ];

  let orderBy: any;
  if (sortBy === "createdAt") {
    orderBy =
      sortOrder === "asc"
        ? asc(checkInOutRecords.createdAt)
        : desc(checkInOutRecords.createdAt);
  } else if (sortBy === "timestamp") {
    orderBy =
      sortOrder === "asc"
        ? asc(checkInOutRecords.timestamp)
        : desc(checkInOutRecords.timestamp);
  } else {
    orderBy = desc(checkInOutRecords.createdAt);
  }

  const totalResult = await db
    .select({ count: count() })
    .from(checkInOutRecords)
    .where(and(...conditions));

  const total = totalResult[0]?.count || 0;

  const records = await db
    .select()
    .from(checkInOutRecords)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data: records,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get Check-In/Out Record by ID (with createdByName; driver from vehicles.assignedToEmployeeId)
export const getCheckInOutRecordById = async (id: string) => {
  const [row] = await db
    .select({
      ...getTableColumns(checkInOutRecords),
      createdByName: createdByUser.fullName,
    })
    .from(checkInOutRecords)
    .leftJoin(createdByUser, eq(checkInOutRecords.createdBy, createdByUser.id))
    .where(
      and(eq(checkInOutRecords.id, id), eq(checkInOutRecords.isDeleted, false)),
    );

  if (!row) return null;

  const { createdByName, ...record } = row;
  return {
    ...record,
    createdByName: createdByName ?? null,
  };
};

// Create Check-In/Out Record
export const createCheckInOutRecord = async (
  data: CreateCheckInOutRecordData,
) => {
  const insertData: any = {
    vehicleId: data.vehicleId,
    type: data.type,
    date:
      data.date instanceof Date
        ? data.date.toISOString().split("T")[0]
        : data.date,
    time: data.time,
    timestamp: data.timestamp,
  };

  if (data.odometer) insertData.odometer = data.odometer;
  if (data.fuelLevel) insertData.fuelLevel = data.fuelLevel;
  if (data.dispatchTaskId) insertData.dispatchTaskId = data.dispatchTaskId;
  if (data.notes) insertData.notes = data.notes;
  if (data.createdBy) insertData.createdBy = data.createdBy;

  const result = await db
    .insert(checkInOutRecords)
    .values(insertData)
    .returning();

  // Return enriched data with names (following cursor rule)
  const inserted = result[0];
  if (!inserted) throw new Error("Failed to create check-in/out record");
  return await getCheckInOutRecordById(inserted.id);
};

// Update Check-In/Out Record
export const updateCheckInOutRecord = async (
  id: string,
  data: UpdateCheckInOutRecordData,
) => {
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.vehicleId !== undefined) updateData.vehicleId = data.vehicleId;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.date !== undefined)
    updateData.date =
      data.date instanceof Date
        ? data.date.toISOString().split("T")[0]
        : data.date;
  if (data.time !== undefined) updateData.time = data.time;
  if (data.timestamp !== undefined) updateData.timestamp = data.timestamp;
  if (data.odometer !== undefined) updateData.odometer = data.odometer;
  if (data.fuelLevel !== undefined) updateData.fuelLevel = data.fuelLevel;
  if (data.dispatchTaskId !== undefined)
    updateData.dispatchTaskId = data.dispatchTaskId;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const result = await db
    .update(checkInOutRecords)
    .set(updateData)
    .where(
      and(eq(checkInOutRecords.id, id), eq(checkInOutRecords.isDeleted, false)),
    )
    .returning();

  return result[0] || null;
};

// Soft Delete Check-In/Out Record
export const deleteCheckInOutRecord = async (id: string) => {
  const result = await db
    .update(checkInOutRecords)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(eq(checkInOutRecords.id, id), eq(checkInOutRecords.isDeleted, false)),
    )
    .returning();

  return result[0] || null;
};

// ============================
// VEHICLE MEDIA SERVICE
// ============================

export const getVehicleMedia = async (
  vehicleId: string,
  offset: number,
  limit: number,
  filters: { sortBy?: string; sortOrder?: "asc" | "desc" } = {},
) => {
  const { sortBy = "createdAt", sortOrder = "desc" } = filters;
  const conditions = [
    eq(vehicleMedia.vehicleId, vehicleId),
    eq(vehicleMedia.isDeleted, false),
  ];
  let orderBy: any =
    sortBy === "uploadedDate"
      ? sortOrder === "asc"
        ? asc(vehicleMedia.uploadedDate)
        : desc(vehicleMedia.uploadedDate)
      : sortBy === "name"
        ? sortOrder === "asc"
          ? asc(vehicleMedia.name)
          : desc(vehicleMedia.name)
        : sortOrder === "asc"
          ? asc(vehicleMedia.createdAt)
          : desc(vehicleMedia.createdAt);

  const totalResult = await db
    .select({ count: count() })
    .from(vehicleMedia)
    .where(and(...conditions));
  const total = totalResult[0]?.count || 0;

  const rows = await db
    .select({
      ...getTableColumns(vehicleMedia),
      uploadedByName: createdByUser.fullName,
    })
    .from(vehicleMedia)
    .leftJoin(createdByUser, eq(vehicleMedia.uploadedBy, createdByUser.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const data = rows.map((row) => {
    const { uploadedByName, ...record } = row;
    return { ...record, uploadedByName: uploadedByName ?? null };
  });

  return {
    data,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getVehicleMediaById = async (id: string) => {
  const [row] = await db
    .select({
      ...getTableColumns(vehicleMedia),
      uploadedByName: createdByUser.fullName,
    })
    .from(vehicleMedia)
    .leftJoin(createdByUser, eq(vehicleMedia.uploadedBy, createdByUser.id))
    .where(and(eq(vehicleMedia.id, id), eq(vehicleMedia.isDeleted, false)));
  if (!row) return null;
  const { uploadedByName, ...record } = row;
  return { ...record, uploadedByName: uploadedByName ?? null };
};

export const createVehicleMedia = async (data: CreateVehicleMediaData) => {
  const insertData: any = {
    vehicleId: data.vehicleId,
    name: data.name,
    uploadedBy: data.uploadedBy,
  };
  if (data.type) insertData.type = data.type;
  if (data.size) insertData.size = data.size;
  if (data.url) insertData.url = data.url;
  if (data.thumbnailUrl) insertData.thumbnailUrl = data.thumbnailUrl;
  if (data.tags !== undefined) insertData.tags = data.tags;

  const result = await db.insert(vehicleMedia).values(insertData).returning();
  const inserted = result[0];
  if (!inserted) throw new Error("Failed to create vehicle media");
  return await getVehicleMediaById(inserted.id);
};

export const updateVehicleMedia = async (
  id: string,
  data: UpdateVehicleMediaData,
) => {
  const updateData: any = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.size !== undefined) updateData.size = data.size;
  if (data.url !== undefined) updateData.url = data.url;
  if (data.thumbnailUrl !== undefined)
    updateData.thumbnailUrl = data.thumbnailUrl;
  if (data.tags !== undefined) updateData.tags = data.tags;

  const result = await db
    .update(vehicleMedia)
    .set(updateData)
    .where(and(eq(vehicleMedia.id, id), eq(vehicleMedia.isDeleted, false)))
    .returning();
  return result[0] ? await getVehicleMediaById(result[0].id) : null;
};

export const deleteVehicleMedia = async (id: string) => {
  const result = await db
    .update(vehicleMedia)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(and(eq(vehicleMedia.id, id), eq(vehicleMedia.isDeleted, false)))
    .returning();
  return result[0] || null;
};

// ============================
// VEHICLE DOCUMENTS SERVICE
// ============================

export const getVehicleDocuments = async (
  vehicleId: string,
  offset: number,
  limit: number,
  filters: {
    documentType?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } = {},
) => {
  const { documentType, sortBy = "createdAt", sortOrder = "desc" } = filters;
  const conditions = [
    eq(vehicleDocuments.vehicleId, vehicleId),
    eq(vehicleDocuments.isDeleted, false),
    ...(documentType ? [eq(vehicleDocuments.documentType, documentType)] : []),
  ];
  let orderBy: any =
    sortBy === "expirationDate"
      ? sortOrder === "asc"
        ? asc(vehicleDocuments.expirationDate)
        : desc(vehicleDocuments.expirationDate)
      : sortBy === "fileName"
        ? sortOrder === "asc"
          ? asc(vehicleDocuments.fileName)
          : desc(vehicleDocuments.fileName)
        : sortOrder === "asc"
          ? asc(vehicleDocuments.createdAt)
          : desc(vehicleDocuments.createdAt);

  const totalResult = await db
    .select({ count: count() })
    .from(vehicleDocuments)
    .where(and(...conditions));
  const total = totalResult[0]?.count || 0;

  const rows = await db
    .select({
      ...getTableColumns(vehicleDocuments),
      uploadedByName: createdByUser.fullName,
    })
    .from(vehicleDocuments)
    .leftJoin(createdByUser, eq(vehicleDocuments.uploadedBy, createdByUser.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const data = rows.map((row) => {
    const { uploadedByName, ...record } = row;
    return { ...record, uploadedByName: uploadedByName ?? null };
  });

  return {
    data,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getVehicleDocumentById = async (id: string) => {
  const [row] = await db
    .select({
      ...getTableColumns(vehicleDocuments),
      uploadedByName: createdByUser.fullName,
    })
    .from(vehicleDocuments)
    .leftJoin(createdByUser, eq(vehicleDocuments.uploadedBy, createdByUser.id))
    .where(
      and(eq(vehicleDocuments.id, id), eq(vehicleDocuments.isDeleted, false)),
    );
  if (!row) return null;
  const { uploadedByName, ...record } = row;
  return { ...record, uploadedByName: uploadedByName ?? null };
};

export const createVehicleDocument = async (
  data: CreateVehicleDocumentData,
) => {
  const insertData: any = {
    vehicleId: data.vehicleId,
    fileName: data.fileName,
    filePath: data.filePath,
    uploadedBy: data.uploadedBy,
  };
  if (data.fileType) insertData.fileType = data.fileType;
  if (data.fileSize !== undefined) insertData.fileSize = data.fileSize;
  if (data.documentType) insertData.documentType = data.documentType;
  if (data.description !== undefined) insertData.description = data.description;
  if (data.expirationDate !== undefined)
    insertData.expirationDate = data.expirationDate as string | Date;

  const result = await db
    .insert(vehicleDocuments)
    .values(insertData)
    .returning();
  const inserted = result[0];
  if (!inserted) throw new Error("Failed to create vehicle document");
  return await getVehicleDocumentById(inserted.id);
};

export const updateVehicleDocument = async (
  id: string,
  data: UpdateVehicleDocumentData,
) => {
  const updateData: any = { updatedAt: new Date() };
  if (data.fileName !== undefined) updateData.fileName = data.fileName;
  if (data.filePath !== undefined) updateData.filePath = data.filePath;
  if (data.fileType !== undefined) updateData.fileType = data.fileType;
  if (data.fileSize !== undefined) updateData.fileSize = data.fileSize;
  if (data.documentType !== undefined)
    updateData.documentType = data.documentType;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.expirationDate !== undefined)
    updateData.expirationDate = data.expirationDate;

  const result = await db
    .update(vehicleDocuments)
    .set(updateData)
    .where(
      and(eq(vehicleDocuments.id, id), eq(vehicleDocuments.isDeleted, false)),
    )
    .returning();
  return result[0] ? await getVehicleDocumentById(result[0].id) : null;
};

export const deleteVehicleDocument = async (id: string) => {
  const result = await db
    .update(vehicleDocuments)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(
      and(eq(vehicleDocuments.id, id), eq(vehicleDocuments.isDeleted, false)),
    )
    .returning();
  return result[0] || null;
};

// ============================
// DASHBOARD KPIs SERVICE
// ============================

export const getFleetDashboardKPIs = async (): Promise<FleetDashboardKPIs> => {
  const conditions = [eq(vehicles.isDeleted, false)];

  // Total Vehicles
  const totalVehiclesResult = await db
    .select({ count: count() })
    .from(vehicles)
    .where(and(...conditions));

  // Active Vehicles
  const activeVehiclesResult = await db
    .select({ count: count() })
    .from(vehicles)
    .where(and(...conditions, eq(vehicles.status, "active")));

  // In Maintenance
  const inMaintenanceResult = await db
    .select({ count: count() })
    .from(vehicles)
    .where(and(...conditions, eq(vehicles.status, "in_maintenance")));

  // Out of Service
  const outOfServiceResult = await db
    .select({ count: count() })
    .from(vehicles)
    .where(and(...conditions, eq(vehicles.status, "out_of_service")));

  // Upcoming Maintenance (next 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const upcomingMaintenanceResult = await db
    .select({ count: count() })
    .from(maintenanceRecords)
    .where(
      and(
        eq(maintenanceRecords.isDeleted, false),
        eq(maintenanceRecords.status, "scheduled"),
        gte(
          maintenanceRecords.scheduledDate,
          new Date().toISOString().split("T")[0]!,
        ),
        lte(
          maintenanceRecords.scheduledDate,
          thirtyDaysFromNow.toISOString().split("T")[0]!,
        ),
      ),
    );

  // Overdue Maintenance
  const overdueMaintenanceResult = await db
    .select({ count: count() })
    .from(maintenanceRecords)
    .where(
      and(
        eq(maintenanceRecords.isDeleted, false),
        or(
          eq(maintenanceRecords.status, "overdue"),
          eq(maintenanceRecords.status, "scheduled"),
        ),
        lte(
          maintenanceRecords.scheduledDate,
          new Date().toISOString().split("T")[0]!,
        ),
      ),
    );

  // Upcoming Inspections (next 30 days)
  const upcomingInspectionsResult = await db
    .select({ count: count() })
    .from(vehicles)
    .where(
      and(
        ...conditions,
        isNotNull(vehicles.nextInspectionDue),
        gte(
          vehicles.nextInspectionDue,
          new Date().toISOString().split("T")[0]!,
        ),
        lte(
          vehicles.nextInspectionDue,
          thirtyDaysFromNow.toISOString().split("T")[0]!,
        ),
      ),
    );

  // Overdue Inspections
  const overdueInspectionsResult = await db
    .select({ count: count() })
    .from(vehicles)
    .where(
      and(
        ...conditions,
        isNotNull(vehicles.nextInspectionDue),
        lte(
          vehicles.nextInspectionDue,
          new Date().toISOString().split("T")[0]!,
        ),
      ),
    );

  // Total Maintenance Cost (last 12 months)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const totalMaintenanceCostResult = await db
    .select({
      total: sql<string>`COALESCE(SUM(${maintenanceRecords.cost}), 0)`,
    })
    .from(maintenanceRecords)
    .where(
      and(
        eq(maintenanceRecords.isDeleted, false),
        eq(maintenanceRecords.status, "completed"),
        gte(maintenanceRecords.date, oneYearAgo.toISOString().split("T")[0]!),
      ),
    );

  // Total Fuel Cost (last 12 months)
  const totalFuelCostResult = await db
    .select({
      total: sql<string>`COALESCE(SUM(${fuelRecords.totalCost}), 0)`,
    })
    .from(fuelRecords)
    .where(
      and(
        eq(fuelRecords.isDeleted, false),
        gte(fuelRecords.date, oneYearAgo.toISOString().split("T")[0]!),
      ),
    );

  // Average MPG (last 12 months)
  // Calculate MPG for each fuel record: (current_odometer - previous_odometer) / gallons
  // Then average all MPG values
  const oneYearAgoDate = oneYearAgo.toISOString().split("T")[0]!;
  const avgMPGResult = await db.execute<{ avgMPG: string }>(
    sql`
      SELECT COALESCE(AVG(mpg), 0) as "avgMPG"
      FROM (
        SELECT 
          (odometer::numeric - LAG(odometer::numeric) OVER (PARTITION BY vehicle_id ORDER BY date)) / NULLIF(gallons::numeric, 0) as mpg
        FROM "org"."fuel_records"
        WHERE is_deleted = false 
          AND date >= ${oneYearAgoDate}
      ) subquery
      WHERE mpg IS NOT NULL AND mpg > 0
    `,
  );

  return {
    totalVehicles: totalVehiclesResult[0]?.count || 0,
    activeVehicles: activeVehiclesResult[0]?.count || 0,
    inMaintenance: inMaintenanceResult[0]?.count || 0,
    outOfService: outOfServiceResult[0]?.count || 0,
    upcomingMaintenance: upcomingMaintenanceResult[0]?.count || 0,
    overdueMaintenance: overdueMaintenanceResult[0]?.count || 0,
    upcomingInspections: upcomingInspectionsResult[0]?.count || 0,
    overdueInspections: overdueInspectionsResult[0]?.count || 0,
    totalMaintenanceCost: totalMaintenanceCostResult[0]?.total || "0",
    totalFuelCost: totalFuelCostResult[0]?.total || "0",
    averageMPG: avgMPGResult.rows[0]?.avgMPG || "0",
  };
};
