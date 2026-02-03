// Dispatch Types

// Dispatch Task Types
export interface DispatchTask {
  id: string;
  jobId: string;
  title: string;
  description?: string;
  taskType: "service" | "pm" | "install" | "emergency" | "survey";
  priority: "low" | "medium" | "high" | "emergency";
  status: "pending" | "assigned" | "in_progress" | "completed" | "cancelled";
  startTime: Date;
  endTime: Date;
  estimatedDuration?: number;
  linkedJobTaskIds?: string[];
  notes?: string;
  attachments?: string[];
  /** Technician IDs from dispatch_assignments (derived, not stored on task) */
  technicianIds?: number[];
  assignments?: DispatchAssignment[];
  createdBy?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDispatchTaskData {
  jobId: string;
  title: string;
  description?: string;
  taskType: "service" | "pm" | "install" | "emergency" | "survey";
  priority?: "low" | "medium" | "high" | "emergency";
  status?: "pending" | "assigned" | "in_progress" | "completed" | "cancelled";
  startTime: Date;
  endTime: Date;
  estimatedDuration?: number;
  linkedJobTaskIds?: string[];
  /** Create dispatch_assignments for these employee IDs */
  technicianIds?: number[];
  notes?: string;
  attachments?: string[];
  createdBy?: string;
}

export interface UpdateDispatchTaskData {
  jobId?: string;
  title?: string;
  description?: string;
  taskType?: "service" | "pm" | "install" | "emergency" | "survey";
  priority?: "low" | "medium" | "high" | "emergency";
  status?: "pending" | "assigned" | "in_progress" | "completed" | "cancelled";
  startTime?: Date;
  endTime?: Date;
  estimatedDuration?: number;
  linkedJobTaskIds?: string[];
  /** Replace task assignments with these employee IDs (creates dispatch_assignments) */
  technicianIds?: number[];
  notes?: string;
  attachments?: string[];
}

// Dispatch Assignment Types
export interface DispatchAssignment {
  id: string;
  taskId: string;
  technicianId: number;
  status: "pending" | "started" | "completed";
  clockIn?: Date;
  clockOut?: Date;
  actualDuration?: number;
  role?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDispatchAssignmentData {
  taskId: string;
  technicianId: number;
  status?: "pending" | "started" | "completed";
  clockIn?: Date;
  clockOut?: Date;
  actualDuration?: number;
  role?: string;
}

export interface UpdateDispatchAssignmentData {
  taskId?: string;
  technicianId?: number;
  status?: "pending" | "started" | "completed";
  clockIn?: Date;
  clockOut?: Date;
  actualDuration?: number;
  role?: string;
}
