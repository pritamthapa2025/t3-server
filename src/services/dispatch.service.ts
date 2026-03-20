import { db } from "../config/db.js";
import {
  dispatchTasks,
  dispatchAssignments,
} from "../drizzle/schema/dispatch.schema.js";
import { vehicles } from "../drizzle/schema/fleet.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import {
  employees,
  departments,
  positions,
} from "../drizzle/schema/org.schema.js";
import { NotificationService } from "./notification.service.js";
import { logger } from "../utils/logger.js";
import { isStale, STALE_DATA } from "../utils/optimistic-lock.js";
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
  ilike,
  or,
  inArray,
  getTableColumns,
  sql,
} from "drizzle-orm";
import type {
  CreateDispatchTaskData,
  UpdateDispatchTaskData,
  CreateDispatchAssignmentData,
  UpdateDispatchAssignmentData,
} from "../types/dispatch.types.js";

// ============================
// DISPATCH TASKS SERVICE
// ============================

/**
 * Wraps a naive datetime string ("YYYY-MM-DDTHH:mm:ss") for Drizzle's PgTimestamp columns.
 * Appending "Z" makes JS treat it as UTC, so Drizzle's .toISOString() round-trips
 * the same literal digits. PostgreSQL's TIMESTAMP WITHOUT TIME ZONE then strips the
 * offset and stores/compares exactly what the user typed — no timezone shift.
 */
const naiveDT = (s: string): Date => new Date(s.endsWith("Z") ? s : `${s}Z`);

// Alias for joining users table
const createdByUser = alias(users, "created_by_user");

// Get Dispatch Tasks with Pagination
export type GetDispatchTasksOptions = {
  ownEmployeeId: number;
};

export const getDispatchTasks = async (
  offset: number,
  limit: number,
  filters: {
    search?: string;
    jobId?: string;
    status?: string;
    taskType?: string;
    priority?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
  options?: GetDispatchTasksOptions,
) => {
  const {
    search,
    jobId,
    status,
    taskType,
    priority,
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
    ...(startDate
      ? [gte(dispatchTasks.startTime, naiveDT(`${startDate}T00:00:00`))]
      : []),
    ...(endDate
      ? [lte(dispatchTasks.endTime, naiveDT(`${endDate}T23:59:59`))]
      : []),
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

  // assigned_only: Technicians see only tasks they are assigned to
  if (options?.ownEmployeeId !== undefined) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM org.dispatch_assignments da WHERE da.task_id = ${dispatchTasks.id} AND da.technician_id = ${options.ownEmployeeId} AND da.is_deleted = false)`,
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

  // Load technicianIds from dispatch_assignments for all tasks in one query
  const taskIds = tasks.map((t) => t.id);
  const assignmentsByTask =
    taskIds.length > 0
      ? await db
          .select({
            taskId: dispatchAssignments.taskId,
            technicianId: dispatchAssignments.technicianId,
          })
          .from(dispatchAssignments)
          .where(
            and(
              inArray(dispatchAssignments.taskId, taskIds),
              eq(dispatchAssignments.isDeleted, false),
            ),
          )
      : [];
  const technicianIdsByTaskId = new Map<string, number[]>();
  for (const a of assignmentsByTask) {
    if (a.technicianId == null) continue;
    const list = technicianIdsByTaskId.get(a.taskId) ?? [];
    list.push(a.technicianId);
    technicianIdsByTaskId.set(a.taskId, list);
  }

  return {
    data: tasks.map((task) => {
      const { createdByName, ...record } = task;
      return {
        ...record,
        createdByName: createdByName ?? null,
        technicianIds: technicianIdsByTaskId.get(task.id) ?? [],
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

// Get Dispatch Task by ID (with assignments / technicianIds from dispatch_assignments)
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
  const assignments = await getAssignmentsByTaskId(id);
  const technicianIds = assignments.map((a) => a.technicianId);
  return {
    ...record,
    createdByName: createdByName ?? null,
    technicianIds,
    assignments,
  };
};

// Format a raw datetime string (no Date object) for display in notifications.
// Parses "YYYY-MM-DDTHH:MM:SS" or "YYYY-MM-DD HH:MM:SS" without any timezone conversion.
const parseRawDTParts = (raw: string) => {
  const normalized = String(raw).replace(" ", "T");
  const [datePart = "", timePart = ""] = normalized.split("T");
  const [year = 0, month = 0, day = 0] = datePart.split("-").map(Number);
  const [hours = 0, minutes = 0] = timePart.split(":").map(Number);
  return { year, month, day, hours, minutes };
};
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const formatRawDateStr = (raw: string): string => {
  const { year, month, day } = parseRawDTParts(raw);
  return `${MONTHS_SHORT[month - 1] ?? ""} ${day}, ${year}`;
};
const formatRawTimeStr = (raw: string): string => {
  const { hours, minutes } = parseRawDTParts(raw);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
};

// ─────────────────────────────────────────────────────────────
// Notification helper: fire "technician_assigned_to_dispatch"
// for each newly assigned technician.
// ─────────────────────────────────────────────────────────────
async function fireDispatchAssignmentNotifications(
  taskId: string,
  technicianIds: number[],
  triggeredByUserId?: string,
): Promise<void> {
  if (!technicianIds.length) return;

  try {
    // 1. Load the dispatch task (title, startTime, endTime, description, jobId)
    const task = await getDispatchTaskById(taskId);
    if (!task) return;

    // 2. Load the related job (jobNumber)
    const [jobRow] = await db
      .select({ jobNumber: jobs.jobNumber })
      .from(jobs)
      .where(eq(jobs.id, task.jobId))
      .limit(1);
    const jobNumber = jobRow?.jobNumber ?? task.jobId;

    // 3. Resolve employee names + user UUIDs for the assigned technicians
    const empRows = await db
      .select({
        id: employees.id,
        userId: employees.userId,
        fullName: users.fullName,
      })
      .from(employees)
      .leftJoin(users, eq(employees.userId, users.id))
      .where(inArray(employees.id, technicianIds));

    const assignedTechnicianUserIds = empRows
      .map((e) => e.userId)
      .filter((id): id is string => !!id);

    const assignedTechNames = empRows
      .map((e) => e.fullName ?? `Technician #${e.id}`)
      .filter(Boolean);

    if (!assignedTechnicianUserIds.length) return;

    // 4. Format date and times directly from raw strings (no timezone conversion)
    const dateStr = formatRawDateStr(String(task.startTime));
    const startTimeStr = formatRawTimeStr(String(task.startTime));
    const endTimeStr = formatRawTimeStr(String(task.endTime));

    // 5. Build additionalNotes JSON (parsed by frontend notification-detail-modal)
    const additionalNotes = JSON.stringify({
      jobNumber,
      dispatchTitle: task.title,
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      assignedTechs: assignedTechNames,
      tasks: [task.title],
      description: task.description ?? "",
    });

    // 6. Build the full message string
    const techList = assignedTechNames.join(", ");
    const message =
      `You have been assigned to ${task.title} (${jobNumber}) ` +
      `on ${dateStr} from ${startTimeStr} to ${endTimeStr}. ` +
      `Assigned techs: ${techList}. ` +
      (task.description ? `Description: ${task.description}` : "");
    const shortMessage = `New dispatch assignment: ${task.title} (${jobNumber})`;

    const notificationService = new NotificationService();
    await notificationService.triggerNotification({
      type: "technician_assigned_to_dispatch",
      category: "dispatch",
      priority: "high",
      ...(triggeredByUserId ? { triggeredBy: triggeredByUserId } : {}),
      data: {
        entityType: "Job",
        entityId: jobNumber,
        entityName: task.title,
        title: "New Dispatch Assignment",
        message,
        shortMessage,
        actionUrl: `/dashboard/jobs/${task.jobId}`,
        notes: additionalNotes,
        assignedTechnicianIds: assignedTechnicianUserIds,
      },
    });
  } catch (err) {
    // Notification failure must never break the dispatch creation
    logger.error("Failed to fire dispatch assignment notifications:", err);
  }
}

// Create Dispatch Task
export const createDispatchTask = async (data: CreateDispatchTaskData) => {
  const insertData: any = {
    jobId: data.jobId,
    title: data.title,
    taskType: data.taskType,
    priority: data.priority || "medium",
    status: data.status || "pending",
    startTime: naiveDT(data.startTime),
    endTime: naiveDT(data.endTime),
    // Derive date-only from the startTime string directly
    date: String(data.startTime).split("T")[0],
  };

  if (data.description) insertData.description = data.description;
  if (data.estimatedDuration !== undefined)
    insertData.estimatedDuration = data.estimatedDuration;
  if (data.linkedJobTaskIds)
    insertData.linkedJobTaskIds = data.linkedJobTaskIds;
  if (data.notes) insertData.notes = data.notes;
  if (data.attachments) insertData.attachments = data.attachments;
  if (data.createdBy) insertData.createdBy = data.createdBy;

  const result = await db.insert(dispatchTasks).values(insertData).returning();
  const inserted = result[0];
  if (!inserted) throw new Error("Failed to create dispatch task");

  // Create dispatch_assignments for each technicianId
  const technicianIds = data.technicianIds ?? [];
  for (const technicianId of technicianIds) {
    await createDispatchAssignment({
      taskId: inserted.id,
      technicianId,
    });
  }

  // Fire "New Dispatch Assignment" notifications to each assigned technician
  if (technicianIds.length > 0) {
    void fireDispatchAssignmentNotifications(
      inserted.id,
      technicianIds,
      (data as any).createdBy,
    );
  }

  return await getDispatchTaskById(inserted.id);
};

// Update Dispatch Task
export const updateDispatchTask = async (
  id: string,
  data: UpdateDispatchTaskData,
  clientUpdatedAt?: string,
) => {
  if (clientUpdatedAt) {
    const [current] = await db
      .select({ updatedAt: dispatchTasks.updatedAt })
      .from(dispatchTasks)
      .where(and(eq(dispatchTasks.id, id), eq(dispatchTasks.isDeleted, false)))
      .limit(1);
    if (!current) return null;
    if (isStale(current.updatedAt, clientUpdatedAt)) return STALE_DATA;
  }

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
    updateData.startTime = naiveDT(data.startTime);
  if (data.endTime !== undefined) updateData.endTime = naiveDT(data.endTime);
  if (data.estimatedDuration !== undefined)
    updateData.estimatedDuration = data.estimatedDuration;
  if (data.linkedJobTaskIds !== undefined)
    updateData.linkedJobTaskIds = data.linkedJobTaskIds;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.attachments !== undefined) updateData.attachments = data.attachments;

  const result = await db
    .update(dispatchTasks)
    .set(updateData)
    .where(and(eq(dispatchTasks.id, id), eq(dispatchTasks.isDeleted, false)))
    .returning();

  const updated = result[0];
  if (!updated) return null;

  // If technicianIds provided, replace assignments: soft-delete existing, create new
  if (data.technicianIds !== undefined) {
    // Track which techs were already assigned so we only notify NEW additions
    const existingAssignments = await db
      .select({ technicianId: dispatchAssignments.technicianId })
      .from(dispatchAssignments)
      .where(
        and(
          eq(dispatchAssignments.taskId, id),
          eq(dispatchAssignments.isDeleted, false),
        ),
      );
    const existingTechIds = new Set(
      existingAssignments
        .map((a) => a.technicianId)
        .filter((t): t is number => t != null),
    );
    const newlyAddedTechIds = data.technicianIds.filter(
      (tid) => !existingTechIds.has(tid),
    );

    await db
      .update(dispatchAssignments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(
        and(
          eq(dispatchAssignments.taskId, id),
          eq(dispatchAssignments.isDeleted, false),
        ),
      );
    for (const technicianId of data.technicianIds) {
      await createDispatchAssignment({ taskId: id, technicianId });
    }

    // Notify only techs that were just added
    if (newlyAddedTechIds.length > 0) {
      void fireDispatchAssignmentNotifications(id, newlyAddedTechIds);
    }
  }

  return await getDispatchTaskById(id);
};

// Soft Delete Dispatch Task
export const deleteDispatchTask = async (id: string, deletedBy: string) => {
  const now = new Date();

  // 1. Soft-delete all assignments for this task + nullify vehicle currentDispatchTaskId (in parallel)
  await Promise.all([
    db
      .update(dispatchAssignments)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          eq(dispatchAssignments.taskId, id),
          eq(dispatchAssignments.isDeleted, false),
        ),
      ),
    db
      .update(vehicles)
      .set({ currentDispatchTaskId: null, updatedAt: now })
      .where(eq(vehicles.currentDispatchTaskId, id)),
  ]);

  // 2. Soft-delete the dispatch task
  const result = await db
    .update(dispatchTasks)
    .set({
      isDeleted: true,
      deletedAt: now,
      deletedBy,
      updatedAt: now,
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
    // clockIn removed from schema; sort by createdAt instead
    orderBy =
      sortOrder === "asc"
        ? asc(dispatchAssignments.createdAt)
        : desc(dispatchAssignments.createdAt);
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

  // clockIn, clockOut, actualDuration removed from schema (tracked via timesheets)
  if (data.role) insertData.role = data.role;

  const result = await db
    .insert(dispatchAssignments)
    .values(insertData)
    .returning();

  const assignment = result[0];

  // Fire technician_assigned_to_dispatch notification (fire-and-forget)
  void (async () => {
    try {
      const [empData] = await db
        .select({ userId: employees.userId })
        .from(employees)
        .where(eq(employees.id, data.technicianId))
        .limit(1);

      if (!empData?.userId) return;

      // Get task info for entity name
      const [taskData] = await db
        .select({ title: dispatchTasks.title, id: dispatchTasks.id })
        .from(dispatchTasks)
        .where(eq(dispatchTasks.id, data.taskId))
        .limit(1);

      const { NotificationService } = await import("./notification.service.js");
      await new NotificationService().triggerNotification({
        type: "technician_assigned_to_dispatch",
        category: "dispatch",
        priority: "high",
        data: {
          entityType: "Dispatch",
          entityId: data.taskId,
          entityName: taskData?.title || `Dispatch Task #${data.taskId}`,
          assignedTechnicianId: empData.userId,
        },
      });
    } catch (err) {
      console.error(
        "[Notification] technician_assigned_to_dispatch failed:",
        err,
      );
    }
  })();

  return assignment;
};

// Update Dispatch Assignment
export const updateDispatchAssignment = async (
  id: string,
  data: UpdateDispatchAssignmentData,
  clientUpdatedAt?: string,
) => {
  // Get current assignment before update to detect technician reassignment
  const [existing] = await db
    .select({
      technicianId: dispatchAssignments.technicianId,
      taskId: dispatchAssignments.taskId,
      updatedAt: dispatchAssignments.updatedAt,
    })
    .from(dispatchAssignments)
    .where(
      and(
        eq(dispatchAssignments.id, id),
        eq(dispatchAssignments.isDeleted, false),
      ),
    )
    .limit(1);

  if (!existing) return null;
  if (isStale(existing.updatedAt, clientUpdatedAt)) return STALE_DATA;

  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.taskId !== undefined) updateData.taskId = data.taskId;
  if (data.technicianId !== undefined)
    updateData.technicianId = data.technicianId;
  if (data.status !== undefined) updateData.status = data.status;
  // clockIn, clockOut, actualDuration removed from schema (tracked via timesheets)
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

  const updated = result[0] || null;

  // Fire dispatch_reassigned notification when technician changes (fire-and-forget)
  if (
    updated &&
    existing &&
    data.technicianId !== undefined &&
    existing.technicianId !== data.technicianId
  ) {
    void (async () => {
      try {
        const taskId = existing.taskId;
        const [taskData] = await db
          .select({ title: dispatchTasks.title })
          .from(dispatchTasks)
          .where(eq(dispatchTasks.id, taskId))
          .limit(1);

        const [newEmpData] = await db
          .select({ userId: employees.userId })
          .from(employees)
          .where(eq(employees.id, data.technicianId!))
          .limit(1);

        const oldEmpData =
          existing.technicianId !== null
            ? (
                await db
                  .select({ userId: employees.userId })
                  .from(employees)
                  .where(eq(employees.id, existing.technicianId))
                  .limit(1)
              )[0]
            : undefined;

        const { NotificationService } =
          await import("./notification.service.js");
        const svc = new NotificationService();
        const entityName = taskData?.title || `Dispatch Task #${taskId}`;

        if (newEmpData?.userId) {
          await svc.triggerNotification({
            type: "dispatch_reassigned",
            category: "dispatch",
            priority: "high",
            data: {
              entityType: "Dispatch",
              entityId: taskId,
              entityName,
              assignedTechnicianId: newEmpData.userId,
            },
          });
        }
        if (oldEmpData?.userId) {
          await svc.triggerNotification({
            type: "dispatch_reassigned",
            category: "dispatch",
            priority: "high",
            data: {
              entityType: "Dispatch",
              entityId: taskId,
              entityName,
              assignedTechnicianId: oldEmpData.userId,
            },
          });
        }
      } catch (err) {
        console.error("[Notification] dispatch_reassigned failed:", err);
      }
    })();
  }

  return updated;
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
    conditions.push(
      gte(dispatchTasks.startTime, naiveDT(`${filters.date}T00:00:00`)),
    );
    conditions.push(
      lte(dispatchTasks.startTime, naiveDT(`${filters.date}T23:59:59`)),
    );
  } else {
    // Filter by date range using task startTime (only if specific date is not provided)
    if (filters?.startDate) {
      conditions.push(
        gte(dispatchTasks.startTime, naiveDT(`${filters.startDate}T00:00:00`)),
      );
    }
    if (filters?.endDate) {
      conditions.push(
        lte(dispatchTasks.startTime, naiveDT(`${filters.endDate}T23:59:59`)),
      );
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
      jobName: jobs.description,
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
// AVAILABLE EMPLOYEES (for dispatch assignment)
// ============================
// Returns employees with status = 'available' as full objects (source of truth: employees table)

export const getAvailableEmployeesForDispatch = async (
  offset: number,
  limit: number,
) => {
  const conditions = [
    eq(employees.isDeleted, false),
    eq(employees.status, "available"),
  ];

  const totalResult = await db
    .select({ count: count() })
    .from(employees)
    .where(and(...conditions));

  const total = totalResult[0]?.count || 0;

  const rows = await db
    .select({
      id: employees.id,
      userId: employees.userId,
      employeeId: employees.employeeId,
      departmentId: employees.departmentId,
      positionId: employees.positionId,
      status: employees.status,
      hireDate: employees.hireDate,
      terminationDate: employees.terminationDate,
      startDate: employees.startDate,
      endDate: employees.endDate,
      isDeleted: employees.isDeleted,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
      employeeName: users.fullName,
      email: users.email,
      phone: users.phone,
      departmentName: departments.name,
      positionName: positions.name,
    })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .where(and(...conditions))
    .orderBy(employees.id)
    .limit(limit)
    .offset(offset);

  const data = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    employeeId: row.employeeId,
    departmentId: row.departmentId,
    positionId: row.positionId,
    status: row.status,
    hireDate: row.hireDate,
    terminationDate: row.terminationDate,
    startDate: row.startDate,
    endDate: row.endDate,
    isDeleted: row.isDeleted,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    employeeName: row.employeeName ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    departmentName: row.departmentName ?? null,
    positionName: row.positionName ?? null,
  }));

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

// ============================
// EMPLOYEES WITH ASSIGNED TASKS
// ============================
// Returns list of employees, each with a tasks array (dispatch tasks assigned to them). Empty tasks if none.

/**
 * When onlyForEmployeeId is set (e.g. Technician view), only that employee is returned with their tasks.
 */
export const getEmployeesWithAssignedTasks = async (
  offset: number,
  limit: number,
  filters?: { status?: string; onlyForEmployeeId?: number; search?: string },
) => {
  const employeeConditions = [eq(employees.isDeleted, false)];
  if (filters?.onlyForEmployeeId != null) {
    employeeConditions.push(eq(employees.id, filters.onlyForEmployeeId));
  }
  if (filters?.search) {
    employeeConditions.push(ilike(users.fullName, `%${filters.search}%`));
  }
  if (filters?.status) {
    if (filters.status === "active") {
      employeeConditions.push(
        inArray(employees.status, ["available", "on_leave", "in_field"]),
      );
    } else {
      employeeConditions.push(eq(employees.status, filters.status as any));
    }
  }

  const totalResult = await db
    .select({ count: count() })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .where(and(...employeeConditions));

  const total = totalResult[0]?.count || 0;

  const employeeRows = await db
    .select({
      id: employees.id,
      userId: employees.userId,
      employeeId: employees.employeeId,
      departmentId: employees.departmentId,
      positionId: employees.positionId,
      status: employees.status,
      hireDate: employees.hireDate,
      terminationDate: employees.terminationDate,
      startDate: employees.startDate,
      endDate: employees.endDate,
      isDeleted: employees.isDeleted,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
      employeeName: users.fullName,
      email: users.email,
      phone: users.phone,
      departmentName: departments.name,
      positionName: positions.name,
    })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .where(and(...employeeConditions))
    .orderBy(employees.id)
    .limit(limit)
    .offset(offset);

  const employeeIds = employeeRows.map((r) => r.id);
  const tasksByEmployeeId = new Map<number, any[]>();

  if (employeeIds.length > 0) {
    const assignments = await db
      .select({
        technicianId: dispatchAssignments.technicianId,
        assignmentId: dispatchAssignments.id,
        assignmentStatus: dispatchAssignments.status,
        taskId: dispatchTasks.id,
        taskTitle: dispatchTasks.title,
        taskDescription: dispatchTasks.description,
        taskType: dispatchTasks.taskType,
        taskPriority: dispatchTasks.priority,
        taskStatus: dispatchTasks.status,
        startTime: dispatchTasks.startTime,
        endTime: dispatchTasks.endTime,
        jobId: dispatchTasks.jobId,
        jobNumber: jobs.jobNumber,
        jobName: jobs.description,
      })
      .from(dispatchAssignments)
      .innerJoin(
        dispatchTasks,
        eq(dispatchAssignments.taskId, dispatchTasks.id),
      )
      .leftJoin(jobs, eq(dispatchTasks.jobId, jobs.id))
      .where(
        and(
          inArray(dispatchAssignments.technicianId, employeeIds),
          eq(dispatchAssignments.isDeleted, false),
          eq(dispatchTasks.isDeleted, false),
        ),
      )
      .orderBy(asc(dispatchTasks.startTime));

    for (const a of assignments) {
      if (a.technicianId == null) continue;
      const list = tasksByEmployeeId.get(a.technicianId) ?? [];
      list.push({
        assignmentId: a.assignmentId,
        assignmentStatus: a.assignmentStatus,
        taskId: a.taskId,
        taskTitle: a.taskTitle,
        taskDescription: a.taskDescription,
        taskType: a.taskType,
        taskPriority: a.taskPriority,
        taskStatus: a.taskStatus,
        startTime: a.startTime,
        endTime: a.endTime,
        jobId: a.jobId,
        jobNumber: a.jobNumber,
        jobName: a.jobName,
      });
      tasksByEmployeeId.set(a.technicianId, list);
    }
  }

  const data = employeeRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    employeeId: row.employeeId,
    departmentId: row.departmentId,
    positionId: row.positionId,
    status: row.status,
    hireDate: row.hireDate,
    terminationDate: row.terminationDate,
    startDate: row.startDate,
    endDate: row.endDate,
    isDeleted: row.isDeleted,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    employeeName: row.employeeName ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    departmentName: row.departmentName ?? null,
    positionName: row.positionName ?? null,
    tasks: tasksByEmployeeId.get(row.id) ?? [],
  }));

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

// ============================
// Dispatch KPIs
// ============================

export const getDispatchKPIs = async () => {
  // Active tasks (status: assigned, in_progress)
  const [activeTasksRow] = await db
    .select({ count: count() })
    .from(dispatchTasks)
    .where(
      and(
        eq(dispatchTasks.isDeleted, false),
        or(
          eq(dispatchTasks.status, "assigned"),
          eq(dispatchTasks.status, "in_progress"),
        ),
      ),
    );

  // Completed today (status: completed and endTime is today) — UTC-safe naive boundaries
  const _todayStr = new Date().toISOString().split("T")[0];
  const today = naiveDT(`${_todayStr}T00:00:00`);
  const tomorrow = naiveDT(`${_todayStr}T23:59:59`);

  const [completedTodayRow] = await db
    .select({ count: count() })
    .from(dispatchTasks)
    .where(
      and(
        eq(dispatchTasks.isDeleted, false),
        eq(dispatchTasks.status, "completed"),
        gte(dispatchTasks.endTime, today),
        lte(dispatchTasks.endTime, tomorrow),
      ),
    );

  // Available technicians (employees with status = 'available')
  const [availableTechniciansRow] = await db
    .select({ count: count() })
    .from(employees)
    .where(
      and(eq(employees.isDeleted, false), eq(employees.status, "available")),
    );

  // In field (employees with status = 'in_field')
  const [inFieldRow] = await db
    .select({ count: count() })
    .from(employees)
    .where(
      and(eq(employees.isDeleted, false), eq(employees.status, "in_field")),
    );

  // Overdue tasks (endTime < now and status not completed/cancelled)
  const now = new Date();
  const [overdueTasksRow] = await db
    .select({ count: count() })
    .from(dispatchTasks)
    .where(
      and(
        eq(dispatchTasks.isDeleted, false),
        lte(dispatchTasks.endTime, now),
        or(
          eq(dispatchTasks.status, "pending"),
          eq(dispatchTasks.status, "assigned"),
          eq(dispatchTasks.status, "in_progress"),
        ),
      ),
    );

  return {
    activeTasks: activeTasksRow?.count || 0,
    completedToday: completedTodayRow?.count || 0,
    availableTechnicians: availableTechniciansRow?.count || 0,
    inField: inFieldRow?.count || 0,
    overdueTasks: overdueTasksRow?.count || 0,
  };
};

// ===========================================================================
// Bulk Delete
// ===========================================================================

export const bulkDeleteDispatchTasks = async (
  ids: string[],
  deletedBy: string,
) => {
  const now = new Date();
  const result = await db
    .update(dispatchTasks)
    .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
    .where(
      and(inArray(dispatchTasks.id, ids), eq(dispatchTasks.isDeleted, false)),
    )
    .returning({ id: dispatchTasks.id });
  return { deleted: result.length, skipped: ids.length - result.length };
};

// ===========================================================================
// Log Hours for Assignment
// ===========================================================================

export const logHoursForAssignment = async (
  assignmentId: string,
  data: {
    actualStartTime: string;
    actualEndTime: string;
    actualHours: number;
    logNotes?: string;
  },
  loggedBy: string,
) => {
  const [existing] = await db
    .select({ id: dispatchAssignments.id })
    .from(dispatchAssignments)
    .where(
      and(
        eq(dispatchAssignments.id, assignmentId),
        eq(dispatchAssignments.isDeleted, false),
      ),
    )
    .limit(1);

  if (!existing) return null;

  const [updated] = await db
    .update(dispatchAssignments)
    .set({
      actualStartTime: naiveDT(data.actualStartTime),
      actualEndTime: naiveDT(data.actualEndTime),
      actualHours: String(data.actualHours),
      logNotes: data.logNotes ?? null,
      loggedAt: new Date(),
      loggedBy,
      updatedAt: new Date(),
    })
    .where(eq(dispatchAssignments.id, assignmentId))
    .returning();

  return updated ?? null;
};

// Get all assignments for a task, enriched with technician name
export const getAssignmentLoggedHours = async (taskId: string) => {
  const rows = await db
    .select({
      id: dispatchAssignments.id,
      taskId: dispatchAssignments.taskId,
      technicianId: dispatchAssignments.technicianId,
      status: dispatchAssignments.status,
      role: dispatchAssignments.role,
      actualStartTime: dispatchAssignments.actualStartTime,
      actualEndTime: dispatchAssignments.actualEndTime,
      actualHours: dispatchAssignments.actualHours,
      logNotes: dispatchAssignments.logNotes,
      loggedAt: dispatchAssignments.loggedAt,
      loggedBy: dispatchAssignments.loggedBy,
      technicianName: users.fullName,
      employeeIdStr: employees.employeeId,
    })
    .from(dispatchAssignments)
    .leftJoin(employees, eq(dispatchAssignments.technicianId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(
      and(
        eq(dispatchAssignments.taskId, taskId),
        eq(dispatchAssignments.isDeleted, false),
      ),
    )
    .orderBy(asc(dispatchAssignments.createdAt));

  return rows;
};
