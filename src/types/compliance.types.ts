// Compliance Case Types
export interface ComplianceCase {
  id: string;
  organizationId: string;
  jobId?: string;
  employeeId: number;
  caseNumber: string;
  type: "safety" | "timesheet" | "conduct" | "training" | "certification" | "other";
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "investigating" | "resolved" | "closed" | "escalated";
  title: string;
  description: string;
  notes?: string;
  openedOn: Date;
  dueDate?: Date;
  resolvedDate?: Date;
  reportedBy?: string;
  assignedTo?: string;
  resolvedBy?: string;
  impactLevel?: "low_risk" | "medium_risk" | "high_risk";
  correctiveAction?: string;
  preventiveAction?: string;
  attachments?: string[];
  evidencePhotos?: string[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  employeeName?: string;
  employeeEmail?: string;
}

export interface CreateComplianceCaseData {
  organizationId: string;
  jobId?: string;
  employeeId: number;
  caseNumber: string;
  type: "safety" | "timesheet" | "conduct" | "training" | "certification" | "other";
  severity: "low" | "medium" | "high" | "critical";
  status?: "open" | "investigating" | "resolved" | "closed" | "escalated";
  title: string;
  description: string;
  notes?: string;
  openedOn: Date;
  dueDate?: Date;
  reportedBy?: string;
  assignedTo?: string;
  impactLevel?: "low_risk" | "medium_risk" | "high_risk";
  correctiveAction?: string;
  preventiveAction?: string;
  attachments?: string[];
  evidencePhotos?: string[];
}

export interface UpdateComplianceCaseData {
  jobId?: string;
  employeeId?: number;
  caseNumber?: string;
  type?: "safety" | "timesheet" | "conduct" | "training" | "certification" | "other";
  severity?: "low" | "medium" | "high" | "critical";
  status?: "open" | "investigating" | "resolved" | "closed" | "escalated";
  title?: string;
  description?: string;
  notes?: string;
  dueDate?: Date;
  resolvedDate?: Date;
  assignedTo?: string;
  resolvedBy?: string;
  impactLevel?: "low_risk" | "medium_risk" | "high_risk";
  correctiveAction?: string;
  preventiveAction?: string;
  attachments?: string[];
  evidencePhotos?: string[];
}

// Dashboard KPIs
export interface DashboardKPIs {
  activeCases: number;
  highSeverity: number;
  suspendedStaff: number;
  avgResolutionDays: number;
}

// Violation Watchlist
export interface ViolationWatchlistItem {
  employeeId: number;
  employeeName: string;
  employeeEmail: string;
  department: string;
  violationCount: number;
  status: string;
  lastViolationDate: Date;
}

// Violation Counts
export interface ViolationCounts {
  count: number;
  type?: string;
  severity?: string;
  employeeId?: number;
  employeeName?: string;
  department?: string;
  jobId?: string;
}




