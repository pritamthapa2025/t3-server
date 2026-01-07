// ============================
// Bid Management Types
// ============================

export type BidStatus = 
  | "draft"
  | "in_progress"
  | "pending"
  | "submitted"
  | "accepted"
  | "won"
  | "rejected"
  | "lost"
  | "expired"
  | "cancelled";

export type BidPriority = "low" | "medium" | "high" | "urgent";

export type BidJobType = "survey" | "plan_spec" | "design_build";

export type TimelineStatus = "completed" | "pending" | "in_progress" | "cancelled";

// ============================
// Main Bid Interface
// ============================

export interface Bid {
  id: string;
  bidNumber: string;
  title: string;
  jobType: BidJobType;
  status: BidStatus;
  priority: BidPriority;
  organizationId: string;
  
  // Client Information
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  city?: string;
  superClient?: string;
  superPrimaryContact?: string;
  primaryContact?: string;
  industryClassification?: string;
  
  // Project Details
  projectName?: string;
  siteAddress?: string;
  buildingSuiteNumber?: string;
  property?: string;
  acrossValuations?: string;
  scopeOfWork?: string;
  specialRequirements?: string;
  description?: string;
  
  // Dates
  startDate?: string;
  endDate?: string;
  plannedStartDate?: string;
  estimatedCompletion?: string;
  createdDate?: Date;
  expiresDate?: Date;
  removalDate?: string;
  
  // Financial
  bidAmount: string;
  estimatedDuration?: number;
  profitMargin?: string;
  expiresIn?: number;
  
  // Terms & Conditions
  paymentTerms?: string;
  warrantyPeriod?: string;
  warrantyPeriodLabor?: string;
  warrantyDetails?: string;
  specialTerms?: string;
  exclusions?: string;
  proposalBasis?: string;
  referenceDate?: string;
  templateSelection?: string;
  
  // Team Assignment
  primaryTeammate?: string;
  supervisorManager?: string;
  technicianId?: string;
  createdBy: string;
  assignedTo?: string;
  
  // Metadata
  qtyNumber?: string;
  marked?: string;
  convertToJob?: boolean;
  jobId?: string;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================
// Financial Breakdown Interface
// ============================

export interface BidFinancialBreakdown {
  id: string;
  bidId: string;
  organizationId: string;
  materialsEquipment: string;
  labor: string;
  travel: string;
  operatingExpenses: string;
  totalCost: string;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================
// Materials Interface
// ============================

export interface BidMaterial {
  id: string;
  bidId: string;
  organizationId: string;
  description: string;
  quantity: string;
  unitCost: string;
  markup: string;
  totalCost: string;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================
// Labor Interface
// ============================

export interface BidLabor {
  id: string;
  bidId: string;
  organizationId: string;
  role: string;
  quantity: number;
  days: number;
  hoursPerDay: string;
  totalHours: string;
  costRate: string;
  billableRate: string;
  totalCost: string;
  totalPrice: string;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================
// Travel Interface
// ============================

export interface BidTravel {
  id: string;
  bidId: string;
  organizationId: string;
  employeeName?: string;
  vehicleName?: string;
  roundTripMiles: string;
  mileageRate: string;
  vehicleDayRate: string;
  days: number;
  mileageCost: string;
  vehicleCost: string;
  markup: string;
  totalCost: string;
  totalPrice: string;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================
// Job-Type Specific Data Interfaces
// ============================

export interface BidSurveyData {
  id: string;
  bidId: string;
  organizationId: string;
  buildingNumber?: string;
  siteLocation?: string;
  workType?: string;
  hasExistingUnit?: boolean;
  unitTag?: string;
  unitLocation?: string;
  make?: string;
  model?: string;
  serial?: string;
  systemType?: string;
  powerStatus?: string;
  voltagePhase?: string;
  overallCondition?: string;
  siteAccessNotes?: string;
  siteConditions?: string;
  clientRequirements?: string;
  technicianId?: string;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BidPlanSpecData {
  id: string;
  bidId: string;
  organizationId: string;
  specifications?: string;
  designRequirements?: string;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BidDesignBuildData {
  id: string;
  bidId: string;
  organizationId: string;
  designRequirements?: string;
  buildSpecifications?: string;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================
// Timeline Interface
// ============================

export interface BidTimelineEvent {
  id: string;
  bidId: string;
  organizationId: string;
  event: string;
  eventDate: Date;
  status: TimelineStatus;
  description?: string;
  sortOrder?: number;
  createdBy?: string;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================
// Notes Interface
// ============================

export interface BidNote {
  id: string;
  bidId: string;
  organizationId: string;
  note: string;
  createdBy: string;
  isInternal?: boolean;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================
// History Interface
// ============================

export interface BidHistoryEntry {
  id: string;
  bidId: string;
  organizationId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
  performedBy: string;
  createdAt: Date;
}

// ============================
// Complete Bid Data Interface
// ============================

export interface CompleteBidData {
  bid: Bid;
  financialBreakdown?: BidFinancialBreakdown;
  materials: BidMaterial[];
  labor: BidLabor[];
  travel: BidTravel[];
  surveyData?: BidSurveyData;
  planSpecData?: BidPlanSpecData;
  designBuildData?: BidDesignBuildData;
  timeline: BidTimelineEvent[];
  notes: BidNote[];
  history: BidHistoryEntry[];
}

// ============================
// API Response Types
// ============================

export interface BidListResponse {
  success: boolean;
  data: Bid[];
  total: number;
  page: number;
  limit: number;
}

export interface BidResponse {
  success: boolean;
  data: Bid;
  message?: string;
}

export interface CompleteBidResponse {
  success: boolean;
  data: CompleteBidData;
}

// ============================
// Filter Types
// ============================

export interface BidFilters {
  status?: BidStatus;
  jobType?: BidJobType;
  priority?: BidPriority;
  assignedTo?: string;
}

// ============================
// Create/Update Types
// ============================

export type CreateBidData = Omit<Bid, 'id' | 'bidNumber' | 'createdAt' | 'updatedAt'>;
export type UpdateBidData = Partial<Omit<Bid, 'id' | 'bidNumber' | 'organizationId' | 'createdBy' | 'createdAt' | 'updatedAt'>>;

export type CreateMaterialData = Omit<BidMaterial, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateMaterialData = Partial<Omit<BidMaterial, 'id' | 'bidId' | 'organizationId' | 'createdAt' | 'updatedAt'>>;

export type CreateLaborData = Omit<BidLabor, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateLaborData = Partial<Omit<BidLabor, 'id' | 'bidId' | 'organizationId' | 'createdAt' | 'updatedAt'>>;

export type CreateTravelData = Omit<BidTravel, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateTravelData = Partial<Omit<BidTravel, 'id' | 'bidId' | 'organizationId' | 'createdAt' | 'updatedAt'>>;

export type CreateTimelineEventData = Omit<BidTimelineEvent, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateTimelineEventData = Partial<Omit<BidTimelineEvent, 'id' | 'bidId' | 'organizationId' | 'createdAt' | 'updatedAt'>>;

export type CreateNoteData = Omit<BidNote, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateNoteData = Partial<Omit<BidNote, 'id' | 'bidId' | 'organizationId' | 'createdBy' | 'createdAt' | 'updatedAt'>>;























