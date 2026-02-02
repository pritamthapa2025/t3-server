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
  assignedVehicleId?: string;
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
  notes?: string;
  attachments?: string[];
  assignedVehicleId?: string;
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
  notes?: string;
  attachments?: string[];
  assignedVehicleId?: string;
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

// Technician Availability Types
export interface TechnicianAvailability {
  id: string;
  employeeId: number;
  date: Date;
  status: "available" | "on_job" | "off_shift" | "break" | "pto";
  shiftStart?: string;
  shiftEnd?: string;
  hoursScheduled?: string;
  role?: string;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTechnicianAvailabilityData {
  employeeId: number;
  date: Date;
  status?: "available" | "on_job" | "off_shift" | "break" | "pto";
  shiftStart?: string;
  shiftEnd?: string;
  hoursScheduled?: string;
  role?: string;
  notes?: string;
}

export interface UpdateTechnicianAvailabilityData {
  employeeId?: number;
  date?: Date;
  status?: "available" | "on_job" | "off_shift" | "break" | "pto";
  shiftStart?: string;
  shiftEnd?: string;
  hoursScheduled?: string;
  role?: string;
  notes?: string;
}
