import { z } from "zod";

const uuidSchema = z.string().uuid({ message: "Invalid ID format - must be a valid UUID" });

// ============================
// Dashboard KPIs Query Schema
// ============================

export const getFleetDashboardKPIsQuerySchema = z.object({
  query: z.object({}),
});

// ============================
// Vehicles Validations
// ============================

export const getVehiclesQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    search: z.string().optional(),
    status: z.enum(["active", "in_maintenance", "out_of_service"]).optional(),
    type: z.enum(["truck", "van", "car", "specialized"]).optional(),
    assignedToEmployeeId: z.string().transform(Number).optional(),
    sortBy: z.enum(["createdAt", "make", "model", "year"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const getVehicleByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const createVehicleSchema = z.object({
  body: z.object({
    vehicleId: z.string().min(1).max(50),
    make: z.string().min(1).max(100),
    model: z.string().min(1).max(100),
    year: z.number().int().min(1900).max(2100),
    color: z.string().max(50).optional(),
    vin: z.string().max(50).optional(),
    licensePlate: z.string().min(1).max(20),
    type: z.enum(["truck", "van", "car", "specialized"]),
    status: z.enum(["active", "in_maintenance", "out_of_service"]).optional(),
    assignedToEmployeeId: z.number().int().positive().optional(),
    mileage: z.string().optional(),
    fuelLevel: z.string().optional(),
    purchaseDate: z.string().transform((str) => new Date(str)).optional(),
    purchaseCost: z.string().optional(),
    dealer: z.string().max(255).optional(),
    monthlyPayment: z.string().optional(),
    loanBalance: z.string().optional(),
    estimatedValue: z.string().optional(),
    insuranceProvider: z.string().max(255).optional(),
    insurancePolicyNumber: z.string().max(100).optional(),
    insuranceCoverage: z.string().max(100).optional(),
    insuranceExpiration: z.string().transform((str) => new Date(str)).optional(),
    insuranceAnnualPremium: z.string().optional(),
    registrationState: z.string().max(50).optional(),
    registrationNumber: z.string().max(100).optional(),
    registrationExpiration: z.string().transform((str) => new Date(str)).optional(),
    mileageRate: z.string().optional(),
    vehicleDayRate: z.string().optional(),
    mpg: z.string().optional(),
    image: z.string().max(500).optional(),
  }),
});

export const updateVehicleSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    vehicleId: z.string().min(1).max(50).optional(),
    make: z.string().min(1).max(100).optional(),
    model: z.string().min(1).max(100).optional(),
    year: z.number().int().min(1900).max(2100).optional(),
    color: z.string().max(50).optional(),
    vin: z.string().max(50).optional(),
    licensePlate: z.string().min(1).max(20).optional(),
    type: z.enum(["truck", "van", "car", "specialized"]).optional(),
    status: z.enum(["active", "in_maintenance", "out_of_service"]).optional(),
    assignedToEmployeeId: z.number().int().positive().optional(),
    currentJobId: uuidSchema.optional(),
    currentDispatchTaskId: uuidSchema.optional(),
    mileage: z.string().optional(),
    fuelLevel: z.string().optional(),
    lastService: z.string().transform((str) => new Date(str)).optional(),
    nextService: z.string().transform((str) => new Date(str)).optional(),
    nextServiceDue: z.string().transform((str) => new Date(str)).optional(),
    nextServiceDays: z.number().int().optional(),
    nextInspectionDue: z.string().transform((str) => new Date(str)).optional(),
    nextInspectionDays: z.number().int().optional(),
    purchaseDate: z.string().transform((str) => new Date(str)).optional(),
    purchaseCost: z.string().optional(),
    dealer: z.string().max(255).optional(),
    monthlyPayment: z.string().optional(),
    loanBalance: z.string().optional(),
    estimatedValue: z.string().optional(),
    insuranceProvider: z.string().max(255).optional(),
    insurancePolicyNumber: z.string().max(100).optional(),
    insuranceCoverage: z.string().max(100).optional(),
    insuranceExpiration: z.string().transform((str) => new Date(str)).optional(),
    insuranceAnnualPremium: z.string().optional(),
    registrationState: z.string().max(50).optional(),
    registrationNumber: z.string().max(100).optional(),
    registrationExpiration: z.string().transform((str) => new Date(str)).optional(),
    mileageRate: z.string().optional(),
    vehicleDayRate: z.string().optional(),
    mpg: z.string().optional(),
    milesLast12Months: z.string().optional(),
    serviceHistoryCostLast12Months: z.string().optional(),
    deliveryCompleted: z.number().int().optional(),
    currentLocationLat: z.string().optional(),
    currentLocationLng: z.string().optional(),
    currentLocationAddress: z.string().optional(),
    image: z.string().max(500).optional(),
  }),
});

export const deleteVehicleSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ============================
// Maintenance Records Validations
// ============================

export const getMaintenanceRecordsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    vehicleId: uuidSchema.optional(),
    status: z.enum([
      "completed",
      "in_progress",
      "scheduled",
      "overdue",
      "cancelled",
      "pending_approval",
      "approved",
      "rejected",
    ]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    sortBy: z.enum(["createdAt", "date"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const getMaintenanceRecordByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const createMaintenanceRecordSchema = z.object({
  body: z.object({
    vehicleId: uuidSchema,
    type: z.string().min(1).max(100),
    description: z.string().min(1),
    status: z.enum([
      "completed",
      "in_progress",
      "scheduled",
      "overdue",
      "cancelled",
      "pending_approval",
      "approved",
      "rejected",
    ]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    cost: z.string().optional(),
    date: z.string().transform((str) => new Date(str)),
    mileage: z.string().max(50).optional(),
    scheduledDate: z.string().transform((str) => new Date(str)).optional(),
    estimatedDuration: z.string().max(50).optional(),
    vendor: z.string().max(255).optional(),
    performedBy: z.string().max(255).optional(),
    assignedTo: z.string().max(255).optional(),
    assignedToEmployeeId: z.number().int().positive().optional(),
    needsApproval: z.boolean().optional(),
    note: z.string().optional(),
  }),
});

export const updateMaintenanceRecordSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    type: z.string().min(1).max(100).optional(),
    description: z.string().min(1).optional(),
    status: z.enum([
      "completed",
      "in_progress",
      "scheduled",
      "overdue",
      "cancelled",
      "pending_approval",
      "approved",
      "rejected",
    ]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    cost: z.string().optional(),
    date: z.string().transform((str) => new Date(str)).optional(),
    mileage: z.string().max(50).optional(),
    scheduledDate: z.string().transform((str) => new Date(str)).optional(),
    estimatedDuration: z.string().max(50).optional(),
    vendor: z.string().max(255).optional(),
    performedBy: z.string().max(255).optional(),
    assignedTo: z.string().max(255).optional(),
    assignedToEmployeeId: z.number().int().positive().optional(),
    needsApproval: z.boolean().optional(),
    approvedBy: uuidSchema.optional(),
    approvedDate: z.string().transform((str) => new Date(str)).optional(),
    approvalComments: z.string().optional(),
    rejectedBy: uuidSchema.optional(),
    rejectedDate: z.string().transform((str) => new Date(str)).optional(),
    rejectionReason: z.string().optional(),
    note: z.string().optional(),
  }),
});

export const deleteMaintenanceRecordSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ============================
// Repair Records Validations
// ============================

export const getRepairRecordsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    vehicleId: uuidSchema.optional(),
    status: z.enum([
      "completed",
      "in_progress",
      "scheduled",
      "overdue",
      "cancelled",
      "pending_approval",
      "approved",
      "rejected",
    ]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    sortBy: z.enum(["createdAt", "date"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const getRepairRecordByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const createRepairRecordSchema = z.object({
  body: z.object({
    vehicleId: uuidSchema,
    type: z.string().min(1).max(100),
    description: z.string().min(1),
    status: z.enum([
      "completed",
      "in_progress",
      "scheduled",
      "overdue",
      "cancelled",
      "pending_approval",
      "approved",
      "rejected",
    ]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    cost: z.string().optional(),
    date: z.string().transform((str) => new Date(str)),
    mileage: z.string().max(50).optional(),
    scheduledDate: z.string().transform((str) => new Date(str)).optional(),
    estimatedDuration: z.string().max(50).optional(),
    reportedBy: z.string().max(255).optional(),
    vendor: z.string().max(255).optional(),
    assignedTo: z.string().max(255).optional(),
    assignedToEmployeeId: z.number().int().positive().optional(),
    linkedMaintenanceId: uuidSchema.optional(),
    linkedInspectionId: uuidSchema.optional(),
    needsApproval: z.boolean().optional(),
    notes: z.string().optional(),
  }),
});

export const updateRepairRecordSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    type: z.string().min(1).max(100).optional(),
    description: z.string().min(1).optional(),
    status: z.enum([
      "completed",
      "in_progress",
      "scheduled",
      "overdue",
      "cancelled",
      "pending_approval",
      "approved",
      "rejected",
    ]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    cost: z.string().optional(),
    date: z.string().transform((str) => new Date(str)).optional(),
    mileage: z.string().max(50).optional(),
    scheduledDate: z.string().transform((str) => new Date(str)).optional(),
    estimatedDuration: z.string().max(50).optional(),
    reportedBy: z.string().max(255).optional(),
    vendor: z.string().max(255).optional(),
    assignedTo: z.string().max(255).optional(),
    assignedToEmployeeId: z.number().int().positive().optional(),
    linkedMaintenanceId: uuidSchema.optional(),
    linkedInspectionId: uuidSchema.optional(),
    needsApproval: z.boolean().optional(),
    approvedBy: uuidSchema.optional(),
    approvedDate: z.string().transform((str) => new Date(str)).optional(),
    approvalComments: z.string().optional(),
    rejectedBy: uuidSchema.optional(),
    rejectedDate: z.string().transform((str) => new Date(str)).optional(),
    rejectionReason: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const deleteRepairRecordSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ============================
// Safety Inspections Validations
// ============================

export const getSafetyInspectionsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    vehicleId: uuidSchema.optional(),
    overallStatus: z.enum(["passed", "failed", "conditional_pass", "scheduled", "overdue"]).optional(),
    sortBy: z.enum(["createdAt", "date"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const getSafetyInspectionByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const createSafetyInspectionSchema = z.object({
  body: z.object({
    vehicleId: uuidSchema,
    date: z.string().transform((str) => new Date(str)),
    mileage: z.string().max(50).optional(),
    performedBy: z.string().min(1).max(255),
    overallStatus: z.enum(["passed", "failed", "conditional_pass", "scheduled", "overdue"]),
    inspectionNotes: z.string().optional(),
    beforePhotos: z.array(z.string()).optional(),
    exteriorPhotos: z.array(z.string()).optional(),
    interiorPhotos: z.array(z.string()).optional(),
  }),
});

export const updateSafetyInspectionSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    date: z.string().transform((str) => new Date(str)).optional(),
    mileage: z.string().max(50).optional(),
    performedBy: z.string().min(1).max(255).optional(),
    overallStatus: z.enum(["passed", "failed", "conditional_pass", "scheduled", "overdue"]).optional(),
    inspectionNotes: z.string().optional(),
    beforePhotos: z.array(z.string()).optional(),
    exteriorPhotos: z.array(z.string()).optional(),
    interiorPhotos: z.array(z.string()).optional(),
  }),
});

export const deleteSafetyInspectionSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ============================
// Safety Inspection Items Validations
// ============================

export const getSafetyInspectionItemsSchema = z.object({
  params: z.object({
    inspectionId: uuidSchema,
  }),
});

export const createSafetyInspectionItemSchema = z.object({
  body: z.object({
    inspectionId: uuidSchema,
    category: z.string().min(1).max(100),
    item: z.string().min(1).max(255),
    status: z.enum(["passed", "failed", "not_applicable"]),
    notes: z.string().optional(),
  }),
});

// ============================
// Fuel Records Validations
// ============================

export const getFuelRecordsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    vehicleId: uuidSchema.optional(),
    fuelType: z.enum(["gasoline", "diesel", "electric", "hybrid"]).optional(),
    sortBy: z.enum(["createdAt", "date"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const getFuelRecordByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const createFuelRecordSchema = z.object({
  body: z.object({
    vehicleId: uuidSchema,
    date: z.string().transform((str) => new Date(str)),
    odometer: z.string().min(1),
    gallons: z.string().min(1),
    cost: z.string().min(1),
    location: z.string().max(255).optional(),
    fuelType: z.enum(["gasoline", "diesel", "electric", "hybrid"]),
    employeeId: z.number().int().positive().optional(),
    notes: z.string().optional(),
  }),
});

export const updateFuelRecordSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    date: z.string().transform((str) => new Date(str)).optional(),
    odometer: z.string().optional(),
    gallons: z.string().optional(),
    cost: z.string().optional(),
    location: z.string().max(255).optional(),
    fuelType: z.enum(["gasoline", "diesel", "electric", "hybrid"]).optional(),
    employeeId: z.number().int().positive().optional(),
    notes: z.string().optional(),
  }),
});

export const deleteFuelRecordSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ============================
// Check-In/Out Records Validations
// ============================

export const getCheckInOutRecordsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    vehicleId: uuidSchema.optional(),
    type: z.enum(["check_in", "check_out"]).optional(),
    driverId: z.string().transform(Number).optional(),
    sortBy: z.enum(["createdAt", "timestamp"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const getCheckInOutRecordByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const createCheckInOutRecordSchema = z.object({
  body: z.object({
    vehicleId: uuidSchema,
    type: z.enum(["check_in", "check_out"]),
    date: z.string().transform((str) => new Date(str)),
    time: z.string().min(1),
    timestamp: z.string().transform((str) => new Date(str)),
    driverId: z.number().int().positive().optional(),
    driverName: z.string().max(255).optional(),
    odometer: z.string().optional(),
    fuelLevel: z.string().optional(),
    jobId: uuidSchema.optional(),
    jobLocation: z.string().max(255).optional(),
    dispatchTaskId: uuidSchema.optional(),
    notes: z.string().optional(),
  }),
});

export const updateCheckInOutRecordSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    vehicleId: uuidSchema.optional(),
    type: z.enum(["check_in", "check_out"]).optional(),
    date: z.string().transform((str) => new Date(str)).optional(),
    time: z.string().optional(),
    timestamp: z.string().transform((str) => new Date(str)).optional(),
    driverId: z.number().int().positive().optional(),
    driverName: z.string().max(255).optional(),
    odometer: z.string().optional(),
    fuelLevel: z.string().optional(),
    jobId: uuidSchema.optional(),
    jobLocation: z.string().max(255).optional(),
    dispatchTaskId: uuidSchema.optional(),
    notes: z.string().optional(),
  }),
});

export const deleteCheckInOutRecordSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Common schemas
export const uuidParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

