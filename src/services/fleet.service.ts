import { db } from "../config/db.js";
import {
  vehicles,
  maintenanceRecords,
  repairRecords,
  safetyInspections,
  safetyInspectionItems,
  fuelRecords,
  checkInOutRecords,
} from "../drizzle/schema/fleet.schema.js";
import { employees, organizations } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
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
  inArray,
  isNotNull,
} from "drizzle-orm";
import type {
  Vehicle,
  CreateVehicleData,
  UpdateVehicleData,
  MaintenanceRecord,
  CreateMaintenanceRecordData,
  UpdateMaintenanceRecordData,
  RepairRecord,
  CreateRepairRecordData,
  UpdateRepairRecordData,
  SafetyInspection,
  CreateSafetyInspectionData,
  UpdateSafetyInspectionData,
  SafetyInspectionItem,
  CreateSafetyInspectionItemData,
  FuelRecord,
  CreateFuelRecordData,
  UpdateFuelRecordData,
  CheckInOutRecord,
  CreateCheckInOutRecordData,
  UpdateCheckInOutRecordData,
  FleetDashboardKPIs,
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
  }
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
        like(vehicles.vin, `%${search}%`)
      )!
    );
  }

  // Build sort order
  let orderBy: any;
  if (sortBy === "createdAt") {
    orderBy =
      sortOrder === "asc"
        ? asc(vehicles.createdAt)
        : desc(vehicles.createdAt);
  } else if (sortBy === "make") {
    orderBy = sortOrder === "asc" ? asc(vehicles.make) : desc(vehicles.make);
  } else if (sortBy === "model") {
    orderBy =
      sortOrder === "asc" ? asc(vehicles.model) : desc(vehicles.model);
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

// Get Vehicle by ID
export const getVehicleById = async (id: string) => {
  const vehicleResult = await db
    .select()
    .from(vehicles)
    .where(
      and(eq(vehicles.id, id), eq(vehicles.isDeleted, false))
    );

  return vehicleResult[0] || null;
};

// Create Vehicle
export const createVehicle = async (data: CreateVehicleData) => {
  const insertData: any = {
    vehicleId: data.vehicleId,
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
  if (data.insuranceProvider) insertData.insuranceProvider = data.insuranceProvider;
  if (data.insurancePolicyNumber)
    insertData.insurancePolicyNumber = data.insurancePolicyNumber;
  if (data.insuranceCoverage) insertData.insuranceCoverage = data.insuranceCoverage;
  if (data.insuranceExpiration)
    insertData.insuranceExpiration =
      data.insuranceExpiration instanceof Date
        ? data.insuranceExpiration.toISOString().split("T")[0]
        : data.insuranceExpiration;
  if (data.insuranceAnnualPremium)
    insertData.insuranceAnnualPremium = data.insuranceAnnualPremium;
  if (data.registrationState) insertData.registrationState = data.registrationState;
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

  return result[0];
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
  if (data.purchaseCost !== undefined) updateData.purchaseCost = data.purchaseCost;
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
  }
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

// Get Maintenance Record by ID
export const getMaintenanceRecordById = async (id: string) => {
  const result = await db
    .select()
    .from(maintenanceRecords)
    .where(
      and(eq(maintenanceRecords.id, id), eq(maintenanceRecords.isDeleted, false))
    );

  return result[0] || null;
};

// Create Maintenance Record
export const createMaintenanceRecord = async (
  data: CreateMaintenanceRecordData
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
  if (data.estimatedDuration) insertData.estimatedDuration = data.estimatedDuration;
  if (data.vendor) insertData.vendor = data.vendor;
  if (data.performedBy) insertData.performedBy = data.performedBy;
  if (data.assignedTo) insertData.assignedTo = data.assignedTo;
  if (data.assignedToEmployeeId)
    insertData.assignedToEmployeeId = data.assignedToEmployeeId;
  if (data.needsApproval !== undefined)
    insertData.needsApproval = data.needsApproval;
  if (data.note) insertData.note = data.note;

  const result = await db
    .insert(maintenanceRecords)
    .values(insertData)
    .returning();

  return result[0];
};

// Update Maintenance Record
export const updateMaintenanceRecord = async (
  id: string,
  data: UpdateMaintenanceRecordData
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
  if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
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
  if (data.rejectedDate !== undefined) updateData.rejectedDate = data.rejectedDate;
  if (data.rejectionReason !== undefined)
    updateData.rejectionReason = data.rejectionReason;
  if (data.note !== undefined) updateData.note = data.note;

  const result = await db
    .update(maintenanceRecords)
    .set(updateData)
    .where(
      and(
        eq(maintenanceRecords.id, id),
        eq(maintenanceRecords.isDeleted, false)
      )
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
        eq(maintenanceRecords.isDeleted, false)
      )
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
  }
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

// Get Repair Record by ID
export const getRepairRecordById = async (id: string) => {
  const result = await db
    .select()
    .from(repairRecords)
    .where(and(eq(repairRecords.id, id), eq(repairRecords.isDeleted, false)));

  return result[0] || null;
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
  if (data.estimatedDuration) insertData.estimatedDuration = data.estimatedDuration;
  if (data.reportedBy) insertData.reportedBy = data.reportedBy;
  if (data.vendor) insertData.vendor = data.vendor;
  if (data.assignedTo) insertData.assignedTo = data.assignedTo;
  if (data.assignedToEmployeeId)
    insertData.assignedToEmployeeId = data.assignedToEmployeeId;
  if (data.linkedMaintenanceId)
    insertData.linkedMaintenanceId = data.linkedMaintenanceId;
  if (data.linkedInspectionId)
    insertData.linkedInspectionId = data.linkedInspectionId;
  if (data.needsApproval !== undefined)
    insertData.needsApproval = data.needsApproval;
  if (data.notes) insertData.notes = data.notes;

  const result = await db.insert(repairRecords).values(insertData).returning();

  return result[0];
};

// Update Repair Record
export const updateRepairRecord = async (
  id: string,
  data: UpdateRepairRecordData
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
  if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
  if (data.assignedToEmployeeId !== undefined)
    updateData.assignedToEmployeeId = data.assignedToEmployeeId;
  if (data.linkedMaintenanceId !== undefined)
    updateData.linkedMaintenanceId = data.linkedMaintenanceId;
  if (data.linkedInspectionId !== undefined)
    updateData.linkedInspectionId = data.linkedInspectionId;
  if (data.needsApproval !== undefined)
    updateData.needsApproval = data.needsApproval;
  if (data.approvedBy !== undefined) updateData.approvedBy = data.approvedBy;
  if (data.approvedDate !== undefined) updateData.approvedDate = data.approvedDate;
  if (data.approvalComments !== undefined)
    updateData.approvalComments = data.approvalComments;
  if (data.rejectedBy !== undefined) updateData.rejectedBy = data.rejectedBy;
  if (data.rejectedDate !== undefined) updateData.rejectedDate = data.rejectedDate;
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
  }
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

// Get Safety Inspection by ID
export const getSafetyInspectionById = async (id: string) => {
  const result = await db
    .select()
    .from(safetyInspections)
    .where(
      and(
        eq(safetyInspections.id, id),
        eq(safetyInspections.isDeleted, false)
      )
    );

  return result[0] || null;
};

// Create Safety Inspection
export const createSafetyInspection = async (
  data: CreateSafetyInspectionData
) => {
  const insertData: any = {
    vehicleId: data.vehicleId,
    date:
      data.date instanceof Date
        ? data.date.toISOString().split("T")[0]
        : data.date,
    performedBy: data.performedBy,
    overallStatus: data.overallStatus,
  };

  if (data.mileage) insertData.mileage = data.mileage;
  if (data.inspectionNotes) insertData.inspectionNotes = data.inspectionNotes;
  if (data.beforePhotos) insertData.beforePhotos = data.beforePhotos;
  if (data.exteriorPhotos) insertData.exteriorPhotos = data.exteriorPhotos;
  if (data.interiorPhotos) insertData.interiorPhotos = data.interiorPhotos;

  const result = await db
    .insert(safetyInspections)
    .values(insertData)
    .returning();

  return result[0];
};

// Update Safety Inspection
export const updateSafetyInspection = async (
  id: string,
  data: UpdateSafetyInspectionData
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
  if (data.beforePhotos !== undefined)
    updateData.beforePhotos = data.beforePhotos;
  if (data.exteriorPhotos !== undefined)
    updateData.exteriorPhotos = data.exteriorPhotos;
  if (data.interiorPhotos !== undefined)
    updateData.interiorPhotos = data.interiorPhotos;

  const result = await db
    .update(safetyInspections)
    .set(updateData)
    .where(
      and(
        eq(safetyInspections.id, id),
        eq(safetyInspections.isDeleted, false)
      )
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
      and(
        eq(safetyInspections.id, id),
        eq(safetyInspections.isDeleted, false)
      )
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
        eq(safetyInspectionItems.isDeleted, false)
      )
    )
    .orderBy(asc(safetyInspectionItems.category), asc(safetyInspectionItems.item));

  return items;
};

// Create Safety Inspection Item
export const createSafetyInspectionItem = async (
  data: CreateSafetyInspectionItemData
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
  }
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

// Get Fuel Record by ID
export const getFuelRecordById = async (id: string) => {
  const result = await db
    .select()
    .from(fuelRecords)
    .where(and(eq(fuelRecords.id, id), eq(fuelRecords.isDeleted, false)));

  return result[0] || null;
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

  const result = await db.insert(fuelRecords).values(insertData).returning();

  return result[0];
};

// Update Fuel Record
export const updateFuelRecord = async (
  id: string,
  data: UpdateFuelRecordData
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
    driverId?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }
) => {
  const {
    vehicleId,
    type,
    driverId,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const conditions = [
    eq(checkInOutRecords.isDeleted, false),
    ...(vehicleId ? [eq(checkInOutRecords.vehicleId, vehicleId)] : []),
    ...(type ? [eq(checkInOutRecords.type, type as any)] : []),
    ...(driverId ? [eq(checkInOutRecords.driverId, driverId)] : []),
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

// Get Check-In/Out Record by ID
export const getCheckInOutRecordById = async (id: string) => {
  const result = await db
    .select()
    .from(checkInOutRecords)
    .where(
      and(eq(checkInOutRecords.id, id), eq(checkInOutRecords.isDeleted, false))
    );

  return result[0] || null;
};

// Create Check-In/Out Record
export const createCheckInOutRecord = async (
  data: CreateCheckInOutRecordData
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

  if (data.driverId) insertData.driverId = data.driverId;
  if (data.driverName) insertData.driverName = data.driverName;
  if (data.odometer) insertData.odometer = data.odometer;
  if (data.fuelLevel) insertData.fuelLevel = data.fuelLevel;
  if (data.jobId) insertData.jobId = data.jobId;
  if (data.jobLocation) insertData.jobLocation = data.jobLocation;
  if (data.dispatchTaskId) insertData.dispatchTaskId = data.dispatchTaskId;
  if (data.notes) insertData.notes = data.notes;

  const result = await db
    .insert(checkInOutRecords)
    .values(insertData)
    .returning();

  return result[0];
};

// Update Check-In/Out Record
export const updateCheckInOutRecord = async (
  id: string,
  data: UpdateCheckInOutRecordData
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
  if (data.driverId !== undefined) updateData.driverId = data.driverId;
  if (data.driverName !== undefined) updateData.driverName = data.driverName;
  if (data.odometer !== undefined) updateData.odometer = data.odometer;
  if (data.fuelLevel !== undefined) updateData.fuelLevel = data.fuelLevel;
  if (data.jobId !== undefined) updateData.jobId = data.jobId;
  if (data.jobLocation !== undefined) updateData.jobLocation = data.jobLocation;
  if (data.dispatchTaskId !== undefined)
    updateData.dispatchTaskId = data.dispatchTaskId;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const result = await db
    .update(checkInOutRecords)
    .set(updateData)
    .where(
      and(eq(checkInOutRecords.id, id), eq(checkInOutRecords.isDeleted, false))
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
      and(eq(checkInOutRecords.id, id), eq(checkInOutRecords.isDeleted, false))
    )
    .returning();

  return result[0] || null;
};

// ============================
// DASHBOARD KPIs SERVICE
// ============================

export const getFleetDashboardKPIs = async (): Promise<FleetDashboardKPIs> => {
  const conditions = [
    eq(vehicles.isDeleted, false),
  ];

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
        gte(maintenanceRecords.scheduledDate, new Date().toISOString().split("T")[0]!),
        lte(maintenanceRecords.scheduledDate, thirtyDaysFromNow.toISOString().split("T")[0]!)
      )
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
          eq(maintenanceRecords.status, "scheduled")
        ),
        lte(maintenanceRecords.scheduledDate, new Date().toISOString().split("T")[0]!)
      )
    );

  // Upcoming Inspections (next 30 days)
  const upcomingInspectionsResult = await db
    .select({ count: count() })
    .from(vehicles)
    .where(
      and(
        ...conditions,
        isNotNull(vehicles.nextInspectionDue),
        gte(vehicles.nextInspectionDue, new Date().toISOString().split("T")[0]!),
        lte(vehicles.nextInspectionDue, thirtyDaysFromNow.toISOString().split("T")[0]!)
      )
    );

  // Overdue Inspections
  const overdueInspectionsResult = await db
    .select({ count: count() })
    .from(vehicles)
    .where(
      and(
        ...conditions,
        isNotNull(vehicles.nextInspectionDue),
        lte(vehicles.nextInspectionDue, new Date().toISOString().split("T")[0]!)
      )
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
        gte(maintenanceRecords.date, oneYearAgo.toISOString().split("T")[0]!)
      )
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
        gte(fuelRecords.date, oneYearAgo.toISOString().split("T")[0]!)
      )
    );

  // Average MPG (last 12 months)
  const avgMPGResult = await db
    .select({
      avgMPG: sql<string>`COALESCE(AVG(${fuelRecords.gallons}::numeric / NULLIF(${fuelRecords.odometer}::numeric - LAG(${fuelRecords.odometer}::numeric) OVER (PARTITION BY ${fuelRecords.vehicleId} ORDER BY ${fuelRecords.date}), 0)), 0)`,
    })
    .from(fuelRecords)
    .where(
      and(
        eq(fuelRecords.isDeleted, false),
        gte(fuelRecords.date, oneYearAgo.toISOString().split("T")[0]!)
      )
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
    averageMPG: avgMPGResult[0]?.avgMPG || "0",
  };
};

