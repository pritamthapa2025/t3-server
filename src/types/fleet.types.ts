// Fleet Types

// Vehicle Types
export interface Vehicle {
  id: string;
  vehicleId: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  vin?: string;
  licensePlate: string;
  type: "truck" | "van" | "car" | "specialized";
  status: "active" | "in_maintenance" | "out_of_service";
  assignedToEmployeeId?: number;
  currentJobId?: string;
  currentDispatchTaskId?: string;
  mileage: string;
  fuelLevel?: string;
  lastService?: Date;
  nextService?: Date;
  nextServiceDue?: Date;
  nextServiceDays?: number;
  nextInspectionDue?: Date;
  nextInspectionDays?: number;
  purchaseDate?: Date;
  purchaseCost?: string;
  dealer?: string;
  monthlyPayment?: string;
  loanBalance?: string;
  estimatedValue?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceCoverage?: string;
  insuranceExpiration?: Date;
  insuranceAnnualPremium?: string;
  registrationState?: string;
  registrationNumber?: string;
  registrationExpiration?: Date;
  mileageRate?: string;
  vehicleDayRate?: string;
  mpg?: string;
  milesLast12Months?: string;
  serviceHistoryCostLast12Months?: string;
  deliveryCompleted?: number;
  currentLocationLat?: string;
  currentLocationLng?: string;
  currentLocationAddress?: string;
  currentLocationLastUpdated?: Date;
  image?: string;
  createdBy?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleData {
  vehicleId?: string; // Optional; auto-generated as VEH-000001, VEH-000002, etc. if omitted
  make: string;
  model: string;
  year: number;
  color?: string;
  vin?: string;
  licensePlate: string;
  type: "truck" | "van" | "car" | "specialized";
  status?: "active" | "in_maintenance" | "out_of_service";
  assignedToEmployeeId?: number;
  mileage?: string;
  fuelLevel?: string;
  purchaseDate?: Date;
  purchaseCost?: string;
  dealer?: string;
  monthlyPayment?: string;
  loanBalance?: string;
  estimatedValue?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceCoverage?: string;
  insuranceExpiration?: Date;
  insuranceAnnualPremium?: string;
  registrationState?: string;
  registrationNumber?: string;
  registrationExpiration?: Date;
  mileageRate?: string;
  vehicleDayRate?: string;
  mpg?: string;
  image?: string;
}

export interface UpdateVehicleData {
  vehicleId?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  vin?: string;
  licensePlate?: string;
  type?: "truck" | "van" | "car" | "specialized";
  status?: "active" | "in_maintenance" | "out_of_service";
  assignedToEmployeeId?: number;
  currentJobId?: string;
  currentDispatchTaskId?: string;
  mileage?: string;
  fuelLevel?: string;
  lastService?: Date;
  nextService?: Date;
  nextServiceDue?: Date;
  nextServiceDays?: number;
  nextInspectionDue?: Date;
  nextInspectionDays?: number;
  purchaseDate?: Date;
  purchaseCost?: string;
  dealer?: string;
  monthlyPayment?: string;
  loanBalance?: string;
  estimatedValue?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceCoverage?: string;
  insuranceExpiration?: Date;
  insuranceAnnualPremium?: string;
  registrationState?: string;
  registrationNumber?: string;
  registrationExpiration?: Date;
  mileageRate?: string;
  vehicleDayRate?: string;
  mpg?: string;
  milesLast12Months?: string;
  serviceHistoryCostLast12Months?: string;
  deliveryCompleted?: number;
  currentLocationLat?: string;
  currentLocationLng?: string;
  currentLocationAddress?: string;
  image?: string;
}

// Vehicle settings (configuration + maintenance intervals + notification toggles)
export interface VehicleSettings {
  fuelType: "gasoline" | "diesel" | "electric" | null;
  type: "truck" | "van" | "car" | "specialized";
  oilChangeIntervalMiles: number | null;
  tireRotationIntervalMiles: number | null;
  brakeInspectionIntervalMiles: number | null;
  safetyInspectionIntervalMonths: number | null;
  maintenanceRemindersEnabled: boolean;
  overdueRepairsAlertsEnabled: boolean;
  safetyInspectionRemindersEnabled: boolean;
}

export interface UpdateVehicleSettingsData {
  fuelType?: "gasoline" | "diesel" | "electric";
  type?: "truck" | "van" | "car" | "specialized";
  oilChangeIntervalMiles?: number;
  tireRotationIntervalMiles?: number;
  brakeInspectionIntervalMiles?: number;
  safetyInspectionIntervalMonths?: number;
  maintenanceRemindersEnabled?: boolean;
  overdueRepairsAlertsEnabled?: boolean;
  safetyInspectionRemindersEnabled?: boolean;
}

// Maintenance Record Types
export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  type: string;
  description: string;
  status:
    | "completed"
    | "in_progress"
    | "scheduled"
    | "overdue"
    | "cancelled"
    | "pending_approval"
    | "approved"
    | "rejected";
  priority?: "low" | "medium" | "high" | "critical";
  cost: string;
  date: Date;
  mileage?: string;
  scheduledDate?: Date;
  estimatedDuration?: string;
  vendor?: string;
  performedBy?: string;
  assignedTo?: string;
  assignedToEmployeeId?: number;
  needsApproval?: boolean;
  approvedBy?: string;
  approvedDate?: Date;
  approvalComments?: string;
  rejectedBy?: string;
  rejectedDate?: Date;
  rejectionReason?: string;
  note?: string;
  createdBy?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMaintenanceRecordData {
  vehicleId: string;
  type: string;
  description: string;
  status?:
    | "completed"
    | "in_progress"
    | "scheduled"
    | "overdue"
    | "cancelled"
    | "pending_approval"
    | "approved"
    | "rejected";
  priority?: "low" | "medium" | "high" | "critical";
  cost?: string;
  date: Date;
  mileage?: string;
  scheduledDate?: Date;
  estimatedDuration?: string;
  vendor?: string;
  performedBy?: string;
  assignedToEmployeeId?: number;
  needsApproval?: boolean;
  note?: string;
  createdBy?: string; // Set server-side from req.user.id
}

export interface UpdateMaintenanceRecordData {
  type?: string;
  description?: string;
  status?:
    | "completed"
    | "in_progress"
    | "scheduled"
    | "overdue"
    | "cancelled"
    | "pending_approval"
    | "approved"
    | "rejected";
  priority?: "low" | "medium" | "high" | "critical";
  cost?: string;
  date?: Date;
  mileage?: string;
  scheduledDate?: Date;
  estimatedDuration?: string;
  vendor?: string;
  performedBy?: string;
  assignedToEmployeeId?: number;
  needsApproval?: boolean;
  approvedBy?: string;
  approvedDate?: Date;
  approvalComments?: string;
  rejectedBy?: string;
  rejectedDate?: Date;
  rejectionReason?: string;
  note?: string;
}

// Repair Record Types
export interface RepairRecord {
  id: string;
  vehicleId: string;
  type: string;
  description: string;
  status:
    | "completed"
    | "in_progress"
    | "scheduled"
    | "overdue"
    | "cancelled"
    | "pending_approval"
    | "approved"
    | "rejected";
  priority?: "low" | "medium" | "high" | "critical";
  cost: string;
  date: Date;
  mileage?: string;
  scheduledDate?: Date;
  estimatedDuration?: string;
  reportedBy?: string;
  vendor?: string;
  assignedTo?: string;
  assignedToEmployeeId?: number;
  linkedMaintenanceId?: string;
  linkedInspectionId?: string;
  needsApproval?: boolean;
  approvedBy?: string;
  approvedDate?: Date;
  approvalComments?: string;
  rejectedBy?: string;
  rejectedDate?: Date;
  rejectionReason?: string;
  notes?: string;
  createdBy?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRepairRecordData {
  vehicleId: string;
  type: string;
  description: string;
  status?:
    | "completed"
    | "in_progress"
    | "scheduled"
    | "overdue"
    | "cancelled"
    | "pending_approval"
    | "approved"
    | "rejected";
  priority?: "low" | "medium" | "high" | "critical";
  cost?: string;
  date: Date;
  mileage?: string;
  scheduledDate?: Date;
  estimatedDuration?: string;
  reportedBy?: string;
  vendor?: string;
  assignedToEmployeeId?: number;
  linkedMaintenanceId?: string;
  linkedInspectionId?: string;
  needsApproval?: boolean;
  notes?: string;
  createdBy?: string;
}

export interface UpdateRepairRecordData {
  type?: string;
  description?: string;
  status?:
    | "completed"
    | "in_progress"
    | "scheduled"
    | "overdue"
    | "cancelled"
    | "pending_approval"
    | "approved"
    | "rejected";
  priority?: "low" | "medium" | "high" | "critical";
  cost?: string;
  date?: Date;
  mileage?: string;
  scheduledDate?: Date;
  estimatedDuration?: string;
  reportedBy?: string;
  vendor?: string;
  assignedToEmployeeId?: number;
  linkedMaintenanceId?: string;
  linkedInspectionId?: string;
  needsApproval?: boolean;
  approvedBy?: string;
  approvedDate?: Date;
  approvalComments?: string;
  rejectedBy?: string;
  rejectedDate?: Date;
  rejectionReason?: string;
  notes?: string;
}

// Safety Inspection Types
export interface SafetyInspection {
  id: string;
  vehicleId: string;
  date: Date;
  mileage?: string;
  performedBy?: string; // Nullable - only used when isTeamMember = false
  overallStatus:
    | "passed"
    | "failed"
    | "conditional_pass"
    | "scheduled"
    | "overdue";
  inspectionNotes?: string;
  checklist?: any; // JSON checklist data
  isTeamMember: boolean;
  employeeId?: number;
  exteriorPhotos?: string[];
  interiorPhotos?: string[];
  createdBy?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSafetyInspectionData {
  vehicleId: string;
  date: Date;
  mileage?: string;
  performedBy?: string; // Optional when isTeamMember is true
  overallStatus:
    | "passed"
    | "failed"
    | "conditional_pass"
    | "scheduled"
    | "overdue";
  inspectionNotes?: string;
  checklist?: any; // JSON checklist data
  isTeamMember: boolean;
  employeeId?: number; // Required when isTeamMember is true
  exteriorPhotos?: string[];
  interiorPhotos?: string[];
  createdBy?: string;
}

export interface UpdateSafetyInspectionData {
  date?: Date;
  mileage?: string;
  performedBy?: string;
  overallStatus?:
    | "passed"
    | "failed"
    | "conditional_pass"
    | "scheduled"
    | "overdue";
  inspectionNotes?: string;
  checklist?: any; // JSON checklist data
  isTeamMember?: boolean;
  employeeId?: number;
  exteriorPhotos?: string[];
  interiorPhotos?: string[];
}

// Safety Inspection Item Types
export interface SafetyInspectionItem {
  id: string;
  inspectionId: string;
  category: string;
  item: string;
  status: "passed" | "failed" | "not_applicable";
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSafetyInspectionItemData {
  inspectionId: string;
  category: string;
  item: string;
  status: "passed" | "failed" | "not_applicable";
  notes?: string;
}

// Fuel Record Types
export interface FuelRecord {
  id: string;
  vehicleId: string;
  date: Date;
  odometer: string;
  gallons: string;
  cost: string;
  location?: string;
  fuelType: "gasoline" | "diesel" | "electric" | "hybrid";
  employeeId?: number;
  notes?: string;
  createdBy?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFuelRecordData {
  vehicleId: string;
  date: Date;
  odometer: string;
  gallons: string;
  cost: string;
  location?: string;
  fuelType: "gasoline" | "diesel" | "electric" | "hybrid";
  employeeId?: number;
  notes?: string;
  createdBy?: string;
}

export interface UpdateFuelRecordData {
  date?: Date;
  odometer?: string;
  gallons?: string;
  cost?: string;
  location?: string;
  fuelType?: "gasoline" | "diesel" | "electric" | "hybrid";
  employeeId?: number;
  notes?: string;
}

// Check-In/Out Record Types (driver from vehicles.assignedToEmployeeId, job from vehicles.currentDispatchTaskId)
export interface CheckInOutRecord {
  id: string;
  vehicleId: string;
  type: "check_in" | "check_out";
  date: Date;
  time: string;
  timestamp: Date;
  odometer?: string;
  fuelLevel?: string;
  dispatchTaskId?: string;
  notes?: string;
  createdBy?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCheckInOutRecordData {
  vehicleId: string;
  type: "check_in" | "check_out";
  date: Date;
  time: string;
  timestamp: Date;
  odometer?: string;
  fuelLevel?: string;
  dispatchTaskId?: string;
  notes?: string;
  createdBy?: string;
}

export interface UpdateCheckInOutRecordData {
  vehicleId?: string;
  type?: "check_in" | "check_out";
  date?: Date;
  time?: string;
  timestamp?: Date;
  odometer?: string;
  fuelLevel?: string;
  dispatchTaskId?: string;
  notes?: string;
}

// Fleet Dashboard KPIs
export interface FleetDashboardKPIs {
  totalVehicles: number;
  activeVehicles: number;
  inMaintenance: number;
  outOfService: number;
  upcomingMaintenance: number;
  overdueMaintenance: number;
  upcomingInspections: number;
  overdueInspections: number;
  totalMaintenanceCost: string;
  totalFuelCost: string;
  averageMPG: string;
}

// Vehicle metrics (derived for dashboard cards)
export interface VehicleMetrics {
  mileage: string; // e.g. "25,000.5 mi"
  maintenance: number; // count of maintenance records
  inspection: number; // percentage 0–100 (passed / total inspections)
  value: string; // e.g. "$25,000"
  deliveries: number; // completed deliveries/jobs for this vehicle
  condition: string; // "Good" | "Fair" | "Poor" | "Unknown"
}

// Vehicle Media Types
export interface VehicleMedia {
  id: string;
  vehicleId: string;
  name: string;
  type?: string | null;
  size?: string | null;
  url?: string | null;
  thumbnailUrl?: string | null;
  tags?: unknown;
  uploadedBy: string;
  uploadedByName?: string | null;
  uploadedDate: string;
  isDeleted: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateVehicleMediaData {
  vehicleId: string;
  name: string;
  type?: string;
  size?: string;
  url?: string;
  thumbnailUrl?: string;
  tags?: unknown;
  uploadedBy: string;
  createdBy?: string;
}

export interface UpdateVehicleMediaData {
  name?: string;
  type?: string;
  size?: string;
  url?: string;
  thumbnailUrl?: string;
  tags?: unknown;
}

// Vehicle Document Types
export interface VehicleDocument {
  id: string;
  vehicleId: string;
  fileName: string;
  filePath: string;
  fileType?: string | null;
  fileSize?: number | null;
  documentType?: string | null;
  description?: string | null;
  expirationDate?: string | null;
  uploadedBy: string;
  uploadedByName?: string | null;
  isDeleted: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateVehicleDocumentData {
  vehicleId: string;
  fileName: string;
  filePath: string;
  fileType?: string;
  fileSize?: number;
  documentType?: string;
  description?: string;
  expirationDate?: string;
  uploadedBy: string;
  createdBy?: string;
}

export interface UpdateVehicleDocumentData {
  fileName?: string;
  filePath?: string;
  fileType?: string;
  fileSize?: number;
  documentType?: string;
  description?: string;
  expirationDate?: string;
}
