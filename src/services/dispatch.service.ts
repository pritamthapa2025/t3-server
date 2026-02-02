import { db } from "../config/db.js";
import {
  dispatchTasks,
  dispatchAssignments,
  technicianAvailability,
} from "../drizzle/schema/dispatch.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { alias } from "drizzle-orm/pg-core";
import {
  eq,
  and,
  desc,
  asc,
  count,
  gte,
  lte,
  like,
  or,
  getTableColumns,
} from "drizzle-orm";
import type {
  CreateDispatchTaskData,
  UpdateDispatchTaskData,
  CreateDispatchAssignmentData,
  UpdateDispatchAssignmentData,
  CreateTechnicianAvailabilityData,
  UpdateTechnicianAvailabilityData,
} from "../types/dispatch.types.js";

// ============================
// DISPATCH TASKS SERVICE
// ============================

// Alias for joining users table
const createdByUser = alias(users, "created_by_user");

// Get Dispatch Tasks with Pagination
export const getDispatchTasks = async (
  offset: number,
  limit: number,
  filters: {
    search?: string;
    jobId?: string;
    status?: string;
    taskType?: string;
    priority?: string;
    assignedVehicleId?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
) => {
  const {
    search,
    jobId,
    status,
    taskType,
    priority,
    assignedVehicleId,
    startDate,
    endDate,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  // Build conditions
  const conditions = [
    eq(dispatchTasks.isDeleted, false),
    ...(jobId ? [eq(dispatchTasks.jobId, jobId)] : []),
    ...(status ? [eq(dispatchTasks.status, status as any)] : []),
    ...(taskType ? [eq(dispatchTasks.taskType, taskType as any)] : []),
    ...(priority ? [eq(dispatchTasks.priority, priority as any)] : []),
    ...(assignedVehicleId
      ? [eq(dispatchTasks.assignedVehicleId, assignedVehicleId)]
      : []),
    ...(startDate ? [gte(dispatchTasks.startTime, new Date(startDate))] : []),
    ...(endDate ? [lte(dispatchTasks.endTime, new Date(endDate))] : []),
  ];

  // Add search conditions
  if (search) {
    conditions.push(
      or(
        like(dispatchTasks.title, `%${search}%`),
        like(dispatchTasks.description, `%${search}%`),
      )!,
    );
  }

  // Build sort order
  let orderBy: any;
  if (sortBy === "createdAt") {
    orderBy =
      sortOrder === "asc"
        ? asc(dispatchTasks.createdAt)
        : desc(dispatchTasks.createdAt);
  } else if (sortBy === "startTime") {
    orderBy =
      sortOrder === "asc"
        ? asc(dispatchTasks.startTime)
        : desc(dispatchTasks.startTime);
  } else if (sortBy === "endTime") {
    orderBy =
      sortOrder === "asc"
        ? asc(dispatchTasks.endTime)
        : desc(dispatchTasks.endTime);
  } else if (sortBy === "priority") {
    orderBy =
      sortOrder === "asc"
        ? asc(dispatchTasks.priority)
        : desc(dispatchTasks.priority);
  } else {
    orderBy = desc(dispatchTasks.createdAt);
  }

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(dispatchTasks)
    .where(and(...conditions));

  const total = totalResult[0]?.count || 0;

  // Get paginated results
  const tasks = await db
    .select({
      ...getTableColumns(dispatchTasks),
      createdByName: createdByUser.fullName,
    })
    .from(dispatchTasks)
    .leftJoin(createdByUser, eq(dispatchTasks.createdBy, createdByUser.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data: tasks.map((task) => {
      const { createdByName, ...record } = task;
      return {
        ...record,
        createdByName: createdByName ?? null,
      };
    }),
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get Dispatch Task by ID
export const getDispatchTaskById = async (id: string) => {
  const [row] = await db
    .select({
      ...getTableColumns(dispatchTasks),
      createdByName: createdByUser.fullName,
    })
    .from(dispatchTasks)
    .leftJoin(createdByUser, eq(dispatchTasks.createdBy, createdByUser.id))
    .where(and(eq(dispatchTasks.id, id), eq(dispatchTasks.isDeleted, false)));

  if (!row) return null;

  const { createdByName, ...record } = row;
  return {
    ...record,
    createdByName: createdByName ?? null,
  };
};

// Create Dispatch Task
export const createDispatchTask = async (data: CreateDispatchTaskData) => {
  const insertData: any = {
    jobId: data.jobId,
    title: data.title,
    taskType: data.taskType,
    priority: data.priority || "medium",
    status: data.status || "pending",
    startTime:
      data.startTime instanceof Date
        ? data.startTime
        : new Date(data.startTime),
    endTime:
      data.endTime instanceof Date ? data.endTime : new Date(data.endTime),
  };

  if (data.description) insertData.description = data.description;
  if (data.estimatedDuration !== undefined)
    insertData.estimatedDuration = data.estimatedDuration;
  if (data.linkedJobTaskIds)
    insertData.linkedJobTaskIds = data.linkedJobTaskIds;
  if (data.notes) insertData.notes = data.notes;
  if (data.attachments) insertData.attachments = data.attachments;
  if (data.assignedVehicleId)
    insertData.assignedVehicleId = data.assignedVehicleId;
  if (data.createdBy) insertData.createdBy = data.createdBy;

  const result = await db.insert(dispatchTasks).values(insertData).returning();

  // Return enriched data with names (following cursor rule)
  const inserted = result[0];
  if (!inserted) throw new Error("Failed to create dispatch task");
  return await getDispatchTaskById(inserted.id);
};

// Update Dispatch Task
export const updateDispatchTask = async (
  id: string,
  data: UpdateDispatchTaskData,
) => {
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.jobId !== undefined) updateData.jobId = data.jobId;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.taskType !== undefined) updateData.taskType = data.taskType;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.startTime !== undefined)
    updateData.startTime =
      data.startTime instanceof Date
        ? data.startTime
        : new Date(data.startTime);
  if (data.endTime !== undefined)
    updateData.endTime =
      data.endTime instanceof Date ? data.endTime : new Date(data.endTime);
  if (data.estimatedDuration !== undefined)
    updateData.estimatedDuration = data.estimatedDuration;
  if (data.linkedJobTaskIds !== undefined)
    updateData.linkedJobTaskIds = data.linkedJobTaskIds;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.attachments !== undefined) updateData.attachments = data.attachments;
  if (data.assignedVehicleId !== undefined)
    updateData.assignedVehicleId = data.assignedVehicleId;

  const result = await db
    .update(dispatchTasks)
    .set(updateData)
    .where(and(eq(dispatchTasks.id, id), eq(dispatchTasks.isDeleted, false)))
    .returning();

  return result[0] || null;
};

// Soft Delete Dispatch Task
export const deleteDispatchTask = async (id: string) => {
  const result = await db
    .update(dispatchTasks)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(dispatchTasks.id, id), eq(dispatchTasks.isDeleted, false)))
    .returning();

  return result[0] || null;
};

// ============================
// DISPATCH ASSIGNMENTS SERVICE
// ============================

// Get Dispatch Assignments with Pagination
export const getDispatchAssignments = async (
  offset: number,
  limit: number,
  filters: {
    taskId?: string;
    technicianId?: number;
    status?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
) => {
  const {
    taskId,
    technicianId,
    status,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const conditions = [
    eq(dispatchAssignments.isDeleted, false),
    ...(taskId ? [eq(dispatchAssignments.taskId, taskId)] : []),
    ...(technicianId
      ? [eq(dispatchAssignments.technicianId, technicianId)]
      : []),
    ...(status ? [eq(dispatchAssignments.status, status as any)] : []),
  ];

  let orderBy: any;
  if (sortBy === "createdAt") {
    orderBy =
      sortOrder === "asc"
        ? asc(dispatchAssignments.createdAt)
        : desc(dispatchAssignments.createdAt);
  } else if (sortBy === "clockIn") {
    orderBy =
      sortOrder === "asc"
        ? asc(dispatchAssignments.clockIn)
        : desc(dispatchAssignments.clockIn);
  } else {
    orderBy = desc(dispatchAssignments.createdAt);
  }

  const totalResult = await db
    .select({ count: count() })
    .from(dispatchAssignments)
    .where(and(...conditions));

  const total = totalResult[0]?.count || 0;

  const assignments = await db
    .select()
    .from(dispatchAssignments)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data: assignments,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get Dispatch Assignment by ID
export const getDispatchAssignmentById = async (id: string) => {
  const result = await db
    .select()
    .from(dispatchAssignments)
    .where(
      and(
        eq(dispatchAssignments.id, id),
        eq(dispatchAssignments.isDeleted, false),
      ),
    );

  return result[0] || null;
};

// Create Dispatch Assignment
export const createDispatchAssignment = async (
  data: CreateDispatchAssignmentData,
) => {
  const insertData: any = {
    taskId: data.taskId,
    technicianId: data.technicianId,
    status: data.status || "pending",
  };

  if (data.clockIn)
    insertData.clockIn =
      data.clockIn instanceof Date ? data.clockIn : new Date(data.clockIn);
  if (data.clockOut)
    insertData.clockOut =
      data.clockOut instanceof Date ? data.clockOut : new Date(data.clockOut);
  if (data.actualDuration !== undefined)
    insertData.actualDuration = data.actualDuration;
  if (data.role) insertData.role = data.role;

  const result = await db
    .insert(dispatchAssignments)
    .values(insertData)
    .returning();

  return result[0];
};

// Update Dispatch Assignment
export const updateDispatchAssignment = async (
  id: string,
  data: UpdateDispatchAssignmentData,
) => {
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.taskId !== undefined) updateData.taskId = data.taskId;
  if (data.technicianId !== undefined)
    updateData.technicianId = data.technicianId;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.clockIn !== undefined)
    updateData.clockIn =
      data.clockIn instanceof Date ? data.clockIn : new Date(data.clockIn);
  if (data.clockOut !== undefined)
    updateData.clockOut =
      data.clockOut instanceof Date ? data.clockOut : new Date(data.clockOut);
  if (data.actualDuration !== undefined)
    updateData.actualDuration = data.actualDuration;
  if (data.role !== undefined) updateData.role = data.role;

  const result = await db
    .update(dispatchAssignments)
    .set(updateData)
    .where(
      and(
        eq(dispatchAssignments.id, id),
        eq(dispatchAssignments.isDeleted, false),
      ),
    )
    .returning();

  return result[0] || null;
};

// Soft Delete Dispatch Assignment
export const deleteDispatchAssignment = async (id: string) => {
  const result = await db
    .update(dispatchAssignments)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(dispatchAssignments.id, id),
        eq(dispatchAssignments.isDeleted, false),
      ),
    )
    .returning();

  return result[0] || null;
};

// Get Assignments by Task ID
export const getAssignmentsByTaskId = async (taskId: string) => {
  const assignments = await db
    .select()
    .from(dispatchAssignments)
    .where(
      and(
        eq(dispatchAssignments.taskId, taskId),
        eq(dispatchAssignments.isDeleted, false),
      ),
    )
    .orderBy(asc(dispatchAssignments.createdAt));

  return assignments;
};

// Get Assignments by Technician ID
export const getAssignmentsByTechnicianId = async (
  technicianId: number,
  filters?: {
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  },
) => {
  const conditions = [
    eq(dispatchAssignments.technicianId, technicianId),
    eq(dispatchAssignments.isDeleted, false),
    eq(dispatchTasks.isDeleted, false),
  ];

  if (filters?.status) {
    conditions.push(eq(dispatchAssignments.status, filters.status as any));
  }

  // Filter by specific date (takes priority over date range)
  if (filters?.date) {
    const dateObj = new Date(filters.date);
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(gte(dispatchTasks.startTime, startOfDay));
    conditions.push(lte(dispatchTasks.startTime, endOfDay));
  } else {
    // Filter by date range using task startTime (only if specific date is not provided)
    if (filters?.startDate) {
      // Get assignments where task startTime is on or after startDate
      const startDateObj = new Date(filters.startDate);
      startDateObj.setHours(0, 0, 0, 0); // Start of day
      conditions.push(gte(dispatchTasks.startTime, startDateObj));
    }

    if (filters?.endDate) {
      // Get assignments where task startTime is on or before endDate
      const endDateObj = new Date(filters.endDate);
      endDateObj.setHours(23, 59, 59, 999); // End of day
      conditions.push(lte(dispatchTasks.startTime, endDateObj));
    }
  }

  // Join with tasks and jobs to get full job details
  const assignments = await db
    .select({
      // Assignment fields
      id: dispatchAssignments.id,
      taskId: dispatchAssignments.taskId,
      status: dispatchAssignments.status,
      isDeleted: dispatchAssignments.isDeleted,
      createdAt: dispatchAssignments.createdAt,
      updatedAt: dispatchAssignments.updatedAt,
      // Task fields
      taskTitle: dispatchTasks.title,
      taskDescription: dispatchTasks.description,
      taskType: dispatchTasks.taskType,
      taskPriority: dispatchTasks.priority,
      taskStatus: dispatchTasks.status,
      startTime: dispatchTasks.startTime,
      endTime: dispatchTasks.endTime,
      // Job fields (for display format: "#2024-001 — HVAC System Installation")
      jobId: dispatchTasks.jobId,
      jobNumber: jobs.jobNumber,
      jobName: jobs.name,
      jobDescription: jobs.description,
      jobStatus: jobs.status,
      jobType: jobs.jobType,
      serviceType: jobs.serviceType,
    })
    .from(dispatchAssignments)
    .innerJoin(dispatchTasks, eq(dispatchAssignments.taskId, dispatchTasks.id))
    .leftJoin(jobs, eq(dispatchTasks.jobId, jobs.id))
    .where(and(...conditions))
    .orderBy(asc(dispatchTasks.startTime));

  return assignments;
};

// ============================
// TECHNICIAN AVAILABILITY SERVICE
// ============================

// Get Technician Availability with Pagination
export const getTechnicianAvailability = async (
  offset: number,
  limit: number,
  filters: {
    employeeId?: number;
    date?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
) => {
  const {
    employeeId,
    date,
    status,
    startDate,
    endDate,
    sortBy = "date",
    sortOrder = "desc",
  } = filters;

  const conditions = [
    eq(technicianAvailability.isDeleted, false),
    ...(employeeId ? [eq(technicianAvailability.employeeId, employeeId)] : []),
    ...(status ? [eq(technicianAvailability.status, status as any)] : []),
    ...(date
      ? [
          gte(
            technicianAvailability.date,
            new Date(new Date(date).setHours(0, 0, 0, 0)),
          ),
          lte(
            technicianAvailability.date,
            new Date(new Date(date).setHours(23, 59, 59, 999)),
          ),
        ]
      : []),
    ...(startDate
      ? [gte(technicianAvailability.date, new Date(startDate))]
      : []),
    ...(endDate ? [lte(technicianAvailability.date, new Date(endDate))] : []),
  ];

  let orderBy: any;
  if (sortBy === "date") {
    orderBy =
      sortOrder === "asc"
        ? asc(technicianAvailability.date)
        : desc(technicianAvailability.date);
  } else if (sortBy === "createdAt") {
    orderBy =
      sortOrder === "asc"
        ? asc(technicianAvailability.createdAt)
        : desc(technicianAvailability.createdAt);
  } else {
    orderBy = desc(technicianAvailability.date);
  }

  const totalResult = await db
    .select({ count: count() })
    .from(technicianAvailability)
    .where(and(...conditions));

  const total = totalResult[0]?.count || 0;

  const availability = await db
    .select()
    .from(technicianAvailability)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data: availability,
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get Technician Availability by ID
export const getTechnicianAvailabilityById = async (id: string) => {
  const result = await db
    .select()
    .from(technicianAvailability)
    .where(
      and(
        eq(technicianAvailability.id, id),
        eq(technicianAvailability.isDeleted, false),
      ),
    );

  return result[0] || null;
};

// Create Technician Availability
export const createTechnicianAvailability = async (
  data: CreateTechnicianAvailabilityData,
) => {
  const insertData: any = {
    employeeId: data.employeeId,
    date: data.date instanceof Date ? data.date : new Date(data.date),
    status: data.status || "available",
  };

  if (data.shiftStart) insertData.shiftStart = data.shiftStart;
  if (data.shiftEnd) insertData.shiftEnd = data.shiftEnd;
  if (data.hoursScheduled) insertData.hoursScheduled = data.hoursScheduled;
  if (data.role) insertData.role = data.role;
  if (data.notes) insertData.notes = data.notes;

  const result = await db
    .insert(technicianAvailability)
    .values(insertData)
    .returning();

  return result[0];
};

// Update Technician Availability
export const updateTechnicianAvailability = async (
  id: string,
  data: UpdateTechnicianAvailabilityData,
) => {
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.employeeId !== undefined) updateData.employeeId = data.employeeId;
  if (data.date !== undefined)
    updateData.date =
      data.date instanceof Date ? data.date : new Date(data.date);
  if (data.status !== undefined) updateData.status = data.status;
  if (data.shiftStart !== undefined) updateData.shiftStart = data.shiftStart;
  if (data.shiftEnd !== undefined) updateData.shiftEnd = data.shiftEnd;
  if (data.hoursScheduled !== undefined)
    updateData.hoursScheduled = data.hoursScheduled;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const result = await db
    .update(technicianAvailability)
    .set(updateData)
    .where(
      and(
        eq(technicianAvailability.id, id),
        eq(technicianAvailability.isDeleted, false),
      ),
    )
    .returning();

  return result[0] || null;
};

// Soft Delete Technician Availability
export const deleteTechnicianAvailability = async (id: string) => {
  const result = await db
    .update(technicianAvailability)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(technicianAvailability.id, id),
        eq(technicianAvailability.isDeleted, false),
      ),
    )
    .returning();

  return result[0] || null;
};

// Get Availability by Employee ID and Date Range
export const getAvailabilityByEmployeeId = async (
  employeeId: number,
  startDate: string,
  endDate: string,
) => {
  const availability = await db
    .select()
    .from(technicianAvailability)
    .where(
      and(
        eq(technicianAvailability.employeeId, employeeId),
        eq(technicianAvailability.isDeleted, false),
        gte(technicianAvailability.date, new Date(startDate)),
        lte(technicianAvailability.date, new Date(endDate)),
      ),
    )
    .orderBy(asc(technicianAvailability.date));

  return availability;
};
