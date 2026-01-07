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
  vehicleId: string;
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

// Maintenance Record Types
export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  type: string;
  description: string;
  status: "completed" | "in_progress" | "scheduled" | "overdue" | "cancelled" | "pending_approval" | "approved" | "rejected";
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
  status?: "completed" | "in_progress" | "scheduled" | "overdue" | "cancelled" | "pending_approval" | "approved" | "rejected";
  priority?: "low" | "medium" | "high" | "critical";
  cost?: string;
  date: Date;
  mileage?: string;
  scheduledDate?: Date;
  estimatedDuration?: string;
  vendor?: string;
  performedBy?: string;
  assignedTo?: string;
  assignedToEmployeeId?: number;
  needsApproval?: boolean;
  note?: string;
}

export interface UpdateMaintenanceRecordData {
  type?: string;
  description?: string;
  status?: "completed" | "in_progress" | "scheduled" | "overdue" | "cancelled" | "pending_approval" | "approved" | "rejected";
  priority?: "low" | "medium" | "high" | "critical";
  cost?: string;
  date?: Date;
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
}

// Repair Record Types
export interface RepairRecord {
  id: string;
  vehicleId: string;
  type: string;
  description: string;
  status: "completed" | "in_progress" | "scheduled" | "overdue" | "cancelled" | "pending_approval" | "approved" | "rejected";
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
  status?: "completed" | "in_progress" | "scheduled" | "overdue" | "cancelled" | "pending_approval" | "approved" | "rejected";
  priority?: "low" | "medium" | "high" | "critical";
  cost?: string;
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
  notes?: string;
}

export interface UpdateRepairRecordData {
  type?: string;
  description?: string;
  status?: "completed" | "in_progress" | "scheduled" | "overdue" | "cancelled" | "pending_approval" | "approved" | "rejected";
  priority?: "low" | "medium" | "high" | "critical";
  cost?: string;
  date?: Date;
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
}

// Safety Inspection Types
export interface SafetyInspection {
  id: string;
  vehicleId: string;
  date: Date;
  mileage?: string;
  performedBy: string;
  overallStatus: "passed" | "failed" | "conditional_pass" | "scheduled" | "overdue";
  inspectionNotes?: string;
  beforePhotos?: string[];
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
  performedBy: string;
  overallStatus: "passed" | "failed" | "conditional_pass" | "scheduled" | "overdue";
  inspectionNotes?: string;
  beforePhotos?: string[];
  exteriorPhotos?: string[];
  interiorPhotos?: string[];
}

export interface UpdateSafetyInspectionData {
  date?: Date;
  mileage?: string;
  performedBy?: string;
  overallStatus?: "passed" | "failed" | "conditional_pass" | "scheduled" | "overdue";
  inspectionNotes?: string;
  beforePhotos?: string[];
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

// Check-In/Out Record Types
export interface CheckInOutRecord {
  id: string;
  vehicleId: string;
  type: "check_in" | "check_out";
  date: Date;
  time: string;
  timestamp: Date;
  driverId?: number;
  driverName?: string;
  odometer?: string;
  fuelLevel?: string;
  jobId?: string;
  jobLocation?: string;
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
  driverId?: number;
  driverName?: string;
  odometer?: string;
  fuelLevel?: string;
  jobId?: string;
  jobLocation?: string;
  dispatchTaskId?: string;
  notes?: string;
}

export interface UpdateCheckInOutRecordData {
  vehicleId?: string;
  type?: "check_in" | "check_out";
  date?: Date;
  time?: string;
  timestamp?: Date;
  driverId?: number;
  driverName?: string;
  odometer?: string;
  fuelLevel?: string;
  jobId?: string;
  jobLocation?: string;
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

