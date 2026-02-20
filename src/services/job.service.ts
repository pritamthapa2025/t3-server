import {
  count,
  eq,
  and,
  desc,
  asc,
  sql,
  or,
  ilike,
  max,
  lte,
  inArray,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../config/db.js";
import {
  jobs,
  jobTeamMembers,
  jobTasks,
  taskComments,
  jobExpenses,
  jobSurveys,
} from "../drizzle/schema/jobs.schema.js";
import { invoices } from "../drizzle/schema/invoicing.schema.js";
import {
  dispatchTasks,
  dispatchAssignments,
} from "../drizzle/schema/dispatch.schema.js";
import {
  vehicles,
  checkInOutRecords,
  assignmentHistory,
} from "../drizzle/schema/fleet.schema.js";
import { payrollTimesheetEntries } from "../drizzle/schema/payroll.schema.js";
import { timesheets } from "../drizzle/schema/timesheet.schema.js";
import {
  bidsTable,
  bidFinancialBreakdown,
} from "../drizzle/schema/bids.schema.js";
import { properties } from "../drizzle/schema/client.schema.js";
import { getDefaultExpenseCategory } from "./expense.service.js";
import { createExpenseFromSource } from "./expense.service.js";
import { employees, positions } from "../drizzle/schema/org.schema.js";
import { users, userRoles, roles } from "../drizzle/schema/auth.schema.js";
import { organizations } from "../drizzle/schema/client.schema.js";
import { getOrganizationById } from "./client.service.js";
import {
  getBidById,
  getBidFinancialBreakdown,
  getBidOperatingExpenses,
  getBidMaterials,
  getBidMaterialById,
  getBidLabor,
  getBidLaborById,
  createBidLabor,
  updateBidLabor,
  deleteBidLabor,
  getBidTravel,
  getBidTravelById,
  createBidTravel,
  updateBidTravel,
  deleteBidTravel,
  getBidTimeline,
  getBidTimelineEventById,
  createBidTimelineEvent,
  updateBidTimelineEvent,
  deleteBidTimelineEvent,
  getBidNotes,
  getBidNoteById,
  createBidNote,
  updateBidNote,
  deleteBidNote,
  getBidHistory,
  createBidHistoryEntry,
  getBidDocuments,
  createBidDocument,
  deleteBidDocument,
} from "./bid.service.js";

// ============================
// Main Job Operations
// ============================

/** Options for assigned/team-member filtering (e.g. Technician sees only their jobs) */
export type GetJobsFilterOptions = {
  userId: string;
  applyAssignedOrTeamFilter: boolean;
};

export const getJobs = async (
  offset: number,
  limit: number,
  filters?: {
    status?: string;
    priority?: string;
    search?: string;
  },
  options?: GetJobsFilterOptions,
) => {
  let whereCondition = and(eq(jobs.isDeleted, false));

  // Add filters
  if (filters?.status) {
    whereCondition = and(
      whereCondition,
      eq(jobs.status, filters.status as any),
    );
  }

  if (filters?.priority) {
    whereCondition = and(
      whereCondition,
      eq(bidsTable.priority, filters.priority as any),
    );
  }

  if (filters?.search) {
    whereCondition = and(
      whereCondition,
      or(
        ilike(jobs.jobNumber, `%${filters.search}%`),
        ilike(jobs.description, `%${filters.search}%`),
      ),
    );
  }

  // Technician / assigned-only: show jobs where (1) bid.assignedTo = userId OR (2) user is in job_team_members
  if (options?.applyAssignedOrTeamFilter && options?.userId) {
    const [emp] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.userId, options.userId))
      .limit(1);
    const employeeId = emp?.id ?? null;

    const assignedOrTeamCondition =
      employeeId === null
        ? eq(bidsTable.assignedTo, options.userId)
        : or(
            eq(bidsTable.assignedTo, options.userId),
            sql`EXISTS (SELECT 1 FROM org.job_team_members jtm WHERE jtm.job_id = ${jobs.id} AND jtm.employee_id = ${employeeId} AND jtm.is_active = true)`,
          );
    whereCondition = and(whereCondition, assignedOrTeamCondition);
  }

  // Get all jobs (with optional assigned/team filter)
  const jobsData = await db
    .select({
      job: jobs,
      bid: bidsTable,
      totalPrice: bidFinancialBreakdown.totalPrice,
      actualTotalPrice: bidFinancialBreakdown.actualTotalPrice,
      createdByName: users.fullName,
      organizationName: organizations.name,
      organizationStreetAddress: organizations.streetAddress,
      organizationCity: organizations.city,
      organizationState: organizations.state,
      organizationZipCode: organizations.zipCode,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .leftJoin(
      bidFinancialBreakdown,
      and(
        eq(bidsTable.id, bidFinancialBreakdown.bidId),
        eq(bidFinancialBreakdown.isDeleted, false),
      ),
    )
    .leftJoin(users, eq(jobs.createdBy, users.id))
    .leftJoin(organizations, eq(bidsTable.organizationId, organizations.id))
    .where(whereCondition)
    .orderBy(desc(jobs.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const totalCountResult = await db
    .select({ count: count() })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(whereCondition);

  const totalCount = totalCountResult[0]?.count || 0;

  // Map jobs and add bid priority, name, organization info, and totalPrice from bid_financial_breakdown
  const jobsList = jobsData.map((item) => ({
    ...item.job,
    priority: item.bid.priority, // Use bid priority instead of job priority
    name: item.bid.projectName, // Derive name from bid.projectName
    organizationId: item.bid.organizationId, // Include organization info
    totalPrice: item.totalPrice ?? null,
    jobAmount: item.actualTotalPrice ?? null,
    createdByName: item.createdByName || null, // Include created by name
    organizationName: item.organizationName ?? null,
    organizationLocation:
      item.organizationCity && item.organizationState
        ? `${item.organizationCity}, ${item.organizationState}`
        : (item.organizationCity ?? item.organizationState ?? null),
    organizationStreetAddress: item.organizationStreetAddress ?? null,
    organizationCity: item.organizationCity ?? null,
    organizationState: item.organizationState ?? null,
    organizationZipCode: item.organizationZipCode ?? null,
  }));
  return {
    jobs: jobsList,
    totalCount,
    // Also return structure expected by controller
    data: jobsList,
    total: totalCount,
    pagination: {
      offset,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

export const getJobById = async (
  id: string,
  options?: GetJobsFilterOptions,
) => {
  let whereCondition = and(eq(jobs.id, id), eq(jobs.isDeleted, false));

  if (options?.applyAssignedOrTeamFilter && options?.userId) {
    const [emp] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.userId, options.userId))
      .limit(1);
    const employeeId = emp?.id ?? null;

    const assignedOrTeamCondition =
      employeeId === null
        ? eq(bidsTable.assignedTo, options.userId)
        : or(
            eq(bidsTable.assignedTo, options.userId),
            sql`EXISTS (SELECT 1 FROM org.job_team_members jtm WHERE jtm.job_id = ${jobs.id} AND jtm.employee_id = ${employeeId} AND jtm.is_active = true)`,
          );
    whereCondition = and(whereCondition, assignedOrTeamCondition);
  }

  const [result] = await db
    .select({
      jobs: jobs,
      bid: bidsTable,
      createdByName: users.fullName,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .leftJoin(users, eq(jobs.createdBy, users.id))
    .where(whereCondition);
  if (!result) return null;

  // Get bid with primaryContact and property (minimal data)
  const bidWithContactAndProperty = await getBidById(result.bid.id);
  const primaryContact = bidWithContactAndProperty?.primaryContact ?? null;
  const property = bidWithContactAndProperty?.property ?? null;

  // Financial summary (totalContractValue, profitMargin, estimatedProfit, startDate=createdAt, endDate, remaining)
  const financialBreakdown = await getBidFinancialBreakdown(
    result.bid.id,
    result.bid.organizationId,
  );
  const jobSummary = getJobFinancialSummaryFields(
    result.jobs,
    financialBreakdown,
    financialBreakdown?.actualTotalPrice,
  );

  const progress = await getJobProgressPercentages(
    result.jobs.id,
    financialBreakdown?.actualTotalPrice ?? null,
  );

  // Return job with bid priority and name, plus primaryContact, property, and summary
  return {
    ...result.jobs,
    priority: result.bid.priority,
    name: result.bid.projectName, // Derive name from bid.projectName
    organizationId: result.bid.organizationId,
    createdByName: result.createdByName || null,
    jobAmount: financialBreakdown?.actualTotalPrice ?? null,
    ...(primaryContact && { primaryContact }),
    ...(property && { property }),
    totalContractValue: jobSummary.totalContractValue,
    profitMargin: jobSummary.profitMargin,
    estimatedProfit: jobSummary.estimatedProfit,
    startDate: jobSummary.startDate,
    endDate: jobSummary.endDate,
    remaining: jobSummary.remaining,
    paymentProgressPercent: progress.paymentProgressPercent,
    taskProgressPercent: progress.taskProgressPercent,
  };
};

export const createJob = async (data: {
  status?: string;
  priority?: string;
  jobType?: string;
  serviceType?: string;
  bidId: string; // Now required
  description?: string;
  scheduledStartDate: string; // Required
  scheduledEndDate: string; // Required
  siteAddress?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  accessInstructions?: string;
  assignedTeamMembers?: Array<{
    employeeId: number;
    positionId?: number;
  }>;
  createdBy: string;
}) => {
  // Get organizationId, current status, primaryTechnicianId, supervisorManager, and name from bid
  const [bid] = await db
    .select({
      organizationId: bidsTable.organizationId,
      currentStatus: bidsTable.status,
      assignedTo: bidsTable.assignedTo,
      primaryTechnicianId: bidsTable.primaryTechnicianId,
      supervisorManager: bidsTable.supervisorManager,
      projectName: bidsTable.projectName,
      bidNumber: bidsTable.bidNumber,
    })
    .from(bidsTable)
    .where(eq(bidsTable.id, data.bidId))
    .limit(1);

  if (!bid) {
    throw new Error("Bid not found");
  }

  // Update bid status to "won" and set convertToJob flag when creating a job from a bid
  const { updateBid } = await import("./bid.service.js");
  const bidUpdateData: any = {
    status: "won",
  };

  // Update bid priority if provided
  if (data.priority) {
    bidUpdateData.priority = data.priority;
  }

  await updateBid(data.bidId, bid.organizationId, bidUpdateData);

  // Also update the convertToJob flag
  await db
    .update(bidsTable)
    .set({ convertToJob: true })
    .where(eq(bidsTable.id, data.bidId));

  // Create history entry for bid status change to "won"
  await createBidHistoryEntry({
    bidId: data.bidId,
    organizationId: bid.organizationId,
    action: "status_changed",
    oldValue: bid.currentStatus,
    newValue: "won",
    description: "Bid status changed to 'won' - Job created",
    performedBy: data.createdBy,
  });

  // Generate job number atomically
  const jobNumber = await generateJobNumber(bid.organizationId);

  // Insert job (without priority field)
  const result = await db
    .insert(jobs)
    .values({
      jobNumber,
      createdBy: data.createdBy,
      status: (data.status as any) || "planned",
      jobType: data.jobType,
      serviceType: data.serviceType,
      bidId: data.bidId,
      description: data.description,
      scheduledStartDate: new Date(data.scheduledStartDate)
        .toISOString()
        .split("T")[0],
      scheduledEndDate: new Date(data.scheduledEndDate)
        .toISOString()
        .split("T")[0],
      siteAddress: data.siteAddress,
      siteContactName: data.siteContactName,
      siteContactPhone: data.siteContactPhone,
      accessInstructions: data.accessInstructions,
    })
    .returning();

  const job = (result as any[])[0];

  // Add team members if provided
  // addJobTeamMember already fires job_assigned for each team member
  if (data.assignedTeamMembers && data.assignedTeamMembers.length > 0) {
    await Promise.all(
      data.assignedTeamMembers.map((member) =>
        addJobTeamMember({
          jobId: job.id,
          employeeId: member.employeeId,
          ...(member.positionId !== undefined && {
            positionId: member.positionId,
          }),
        }),
      ),
    );
  }

  // Fire job_assigned for primary technician and supervisors (fire-and-forget)
  void (async () => {
    try {
      const jobName =
        bid.projectName || bid.bidNumber || job.jobNumber || "Job";
      const { NotificationService } = await import("./notification.service.js");
      const svc = new NotificationService();

      // Fetch client / organization name
      const [orgData] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, bid.organizationId))
        .limit(1);
      const clientName = orgData?.name || null;

      // Build structured job details for the email info card
      const formatDate = (d: string | null | undefined) =>
        d
          ? new Date(d).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : null;

      const startDateFormatted =
        formatDate(data.scheduledStartDate) || data.scheduledStartDate;
      const endDateFormatted =
        formatDate(data.scheduledEndDate) || data.scheduledEndDate;
      const jobStatus =
        (data.status || "planned").charAt(0).toUpperCase() +
        (data.status || "planned").slice(1);

      const jobDetails: Record<string, string> = {};
      if (clientName) jobDetails["Client"] = clientName;
      jobDetails["Job Number"] = job.jobNumber || "";
      jobDetails["Status"] = jobStatus;
      jobDetails["Start Date"] = startDateFormatted;
      jobDetails["End Date"] = endDateFormatted;
      if (data.siteAddress) jobDetails["Site Address"] = data.siteAddress;
      if (data.jobType) jobDetails["Job Type"] = data.jobType;
      if (data.serviceType) jobDetails["Service Type"] = data.serviceType;

      const notesJson = JSON.stringify(jobDetails);

      // Inline message for the technician — client + dates visible without clicking
      const clientLine = clientName ? ` for client ${clientName}` : "";
      const technicianMessage = `You have been assigned to job "${jobName}"${clientLine}. The work is scheduled from ${startDateFormatted} to ${endDateFormatted}. Please review the details below and prepare accordingly.`;

      // Track notified users to avoid duplicate notifications
      const notifiedUsers = new Set<string>();

      // --- Resolve technician & supervisors upfront ---
      let techUserId: string | null = null;
      let techReportsTo: string | null = null;
      let technicianName = "A team member";

      if (bid.primaryTechnicianId) {
        const [techEmployee] = await db
          .select({ userId: employees.userId, reportsTo: employees.reportsTo })
          .from(employees)
          .where(eq(employees.id, bid.primaryTechnicianId))
          .limit(1);
        techUserId = techEmployee?.userId ?? null;
        techReportsTo = techEmployee?.reportsTo ?? null;

        if (techUserId) {
          const [techUser] = await db
            .select({ fullName: users.fullName })
            .from(users)
            .where(eq(users.id, techUserId))
            .limit(1);
          technicianName = techUser?.fullName || "A team member";
        } else {
          console.warn(
            `[Notification] Skipped job_assigned for primaryTechnicianId ${bid.primaryTechnicianId} — employee has no linked userId`,
          );
        }
      }

      let supervisorManagerUserId: string | null = null;
      if (bid.supervisorManager) {
        const [supervisorEmployee] = await db
          .select({ userId: employees.userId })
          .from(employees)
          .where(eq(employees.id, bid.supervisorManager))
          .limit(1);
        supervisorManagerUserId = supervisorEmployee?.userId ?? null;
        if (!supervisorManagerUserId) {
          console.warn(
            `[Notification] Skipped job_assigned for supervisorManager ${bid.supervisorManager} — employee has no linked userId`,
          );
        }
      }

      // 1. Notify the technician — they are directly assigned to the job
      if (techUserId) {
        notifiedUsers.add(techUserId);
        await svc.triggerNotification({
          type: "job_assigned",
          category: "job",
          priority: "high",
          triggeredBy: data.createdBy,
          data: {
            entityType: "Job",
            entityId: job.id,
            entityName: jobName,
            assignedTechnicianId: techUserId,
            message: technicianMessage,
            shortMessage: `New job assigned: ${jobName}${clientName ? ` — ${clientName}` : ""}`,
            notes: notesJson,
          },
        });
      }

      // 2. Notify the supervisorManager — they are directly assigned to supervise this job
      if (supervisorManagerUserId && !notifiedUsers.has(supervisorManagerUserId)) {
        notifiedUsers.add(supervisorManagerUserId);
        await svc.triggerNotification({
          type: "job_assigned",
          category: "job",
          priority: "high",
          triggeredBy: data.createdBy,
          data: {
            entityType: "Job",
            entityId: job.id,
            entityName: jobName,
            assignedTechnicianId: supervisorManagerUserId,
            message: `You have been assigned as the supervisor for job "${jobName}"${clientLine}. The work is scheduled from ${startDateFormatted} to ${endDateFormatted}. Please review the details below and coordinate with the assigned technician to ensure a smooth start.`,
            shortMessage: `Supervisor assignment: ${jobName}${clientName ? ` — ${clientName}` : ""}`,
            notes: notesJson,
          },
        });
      }

      // 3. Notify the technician's reportsTo manager — ONLY if different from supervisorManager
      //    This person needs to know their department member was assigned
      if (techReportsTo && !notifiedUsers.has(techReportsTo)) {
        notifiedUsers.add(techReportsTo);
        await svc.triggerNotification({
          type: "job_assigned",
          category: "job",
          priority: "high",
          triggeredBy: data.createdBy,
          data: {
            entityType: "Job",
            entityId: job.id,
            entityName: jobName,
            assignedTechnicianId: techReportsTo,
            message: `${technicianName}, who reports to you, has been assigned to job "${jobName}"${clientLine}. The work is scheduled from ${startDateFormatted} to ${endDateFormatted}. Please review the details below for more information.`,
            shortMessage: `Your team member ${technicianName} was assigned to ${jobName}`,
            notes: notesJson,
          },
        });
      }
    } catch (err) {
      console.error("[Notification] job_assigned (bid assignees) failed:", err);
    }
  })();

  // Get updated bid to include priority in response
  const [updatedBid] = await db
    .select()
    .from(bidsTable)
    .where(eq(bidsTable.id, data.bidId))
    .limit(1);

  // Get createdBy user name
  let createdByName: string | null = null;
  if (job.createdBy) {
    const [creator] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, job.createdBy))
      .limit(1);
    createdByName = creator?.fullName || null;
  }

  // Return job with bid priority and name
  return {
    ...job,
    priority: updatedBid?.priority,
    name: updatedBid?.projectName, // Derive name from bid.projectName
    createdByName,
  };
};

export const updateJob = async (
  id: string,
  data: Partial<{
    status: string;
    priority: string;
    jobType: string;
    serviceType: string;
    description: string;
    scheduledStartDate: string;
    scheduledEndDate: string;
    actualStartDate: string;
    actualEndDate: string;
    siteAddress: string;
    siteContactName: string;
    siteContactPhone: string;
    accessInstructions: string;
    actualCost: string;
    completionNotes: string;
    completionPercentage: string;
  }>,
) => {
  // Get job to find bidId
  const [jobData] = await db
    .select({
      job: jobs,
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, id), eq(jobs.isDeleted, false)))
    .limit(1);

  if (!jobData) {
    return null;
  }

  // Update bid priority if provided
  if (data.priority !== undefined) {
    const { updateBid } = await import("./bid.service.js");
    await updateBid(jobData.bidId, jobData.organizationId, {
      priority: data.priority,
    });
  }

  // Remove priority from data as it's not a job field anymore
  const { priority: _priority, ...jobUpdateData } = data;

  const [job] = await db
    .update(jobs)
    .set({
      ...jobUpdateData,
      scheduledStartDate: jobUpdateData.scheduledStartDate
        ? new Date(jobUpdateData.scheduledStartDate).toISOString().split("T")[0]
        : undefined,
      scheduledEndDate: jobUpdateData.scheduledEndDate
        ? new Date(jobUpdateData.scheduledEndDate).toISOString().split("T")[0]
        : undefined,
      actualStartDate: jobUpdateData.actualStartDate
        ? new Date(jobUpdateData.actualStartDate).toISOString().split("T")[0]
        : undefined,
      actualEndDate: jobUpdateData.actualEndDate
        ? new Date(jobUpdateData.actualEndDate).toISOString().split("T")[0]
        : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, id), eq(jobs.isDeleted, false)))
    .returning();

  if (!job) return null;

  // Get updated bid to include priority in response
  const [updatedBid] = await db
    .select()
    .from(bidsTable)
    .where(eq(bidsTable.id, jobData.bidId))
    .limit(1);

  // Get createdBy user name
  let createdByName: string | null = null;
  if (job.createdBy) {
    const [creator] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, job.createdBy))
      .limit(1);
    createdByName = creator?.fullName || null;
  }

  // Fire status-change notifications (fire-and-forget, does not block response)
  if (data.status && (jobData.job as any).status !== data.status) {
    void (async () => {
      try {
        const { NotificationService } =
          await import("./notification.service.js");
        const svc = new NotificationService();
        const jobName =
          updatedBid?.projectName ||
          updatedBid?.bidNumber ||
          job.jobNumber ||
          "Job";

        if (data.status === "in_progress") {
          await svc.triggerNotification({
            type: "job_started",
            category: "job",
            priority: "medium",
            data: { entityType: "Job", entityId: job.id, entityName: jobName },
          });
        } else if (data.status === "completed") {
          await svc.triggerNotification({
            type: "job_completed",
            category: "job",
            priority: "medium",
            data: { entityType: "Job", entityId: job.id, entityName: jobName },
          });
        } else if (data.status === "cancelled") {
          await svc.triggerNotification({
            type: "job_cancelled",
            category: "job",
            priority: "medium",
            data: { entityType: "Job", entityId: job.id, entityName: jobName },
          });
        } else {
          await svc.triggerNotification({
            type: "job_status_changed",
            category: "job",
            priority: "medium",
            data: { entityType: "Job", entityId: job.id, entityName: jobName },
          });
        }
      } catch (err) {
        console.error(
          "[Notification] job status change notification failed:",
          err,
        );
      }
    })();
  }

  // Return job with bid priority and name
  return {
    ...job,
    priority: updatedBid?.priority,
    name: updatedBid?.projectName || updatedBid?.bidNumber, // Derive name from bid
    organizationId: jobData.organizationId,
    createdByName,
  };
};

export const deleteJob = async (id: string, deletedBy: string) => {
  const now = new Date();

  // 1. Collect dispatch task IDs for this job
  const taskRows = await db
    .select({ id: dispatchTasks.id })
    .from(dispatchTasks)
    .where(
      and(eq(dispatchTasks.jobId, id), eq(dispatchTasks.isDeleted, false)),
    );
  const taskIds = taskRows.map((r) => r.id);

  // 2. Soft-delete dispatch assignments
  if (taskIds.length > 0) {
    await db
      .update(dispatchAssignments)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          inArray(dispatchAssignments.taskId, taskIds),
          eq(dispatchAssignments.isDeleted, false),
        ),
      );
  }

  // 3. Soft-delete dispatch tasks, job tasks, surveys, expenses + deactivate team members (in parallel)
  await Promise.all([
    db
      .update(dispatchTasks)
      .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
      .where(
        and(eq(dispatchTasks.jobId, id), eq(dispatchTasks.isDeleted, false)),
      ),
    db
      .update(jobTeamMembers)
      .set({ isActive: false })
      .where(eq(jobTeamMembers.jobId, id)),
    db
      .update(jobTasks)
      .set({ isDeleted: true, updatedAt: now })
      .where(and(eq(jobTasks.jobId, id), eq(jobTasks.isDeleted, false))),
    db
      .update(jobSurveys)
      .set({ isDeleted: true, updatedAt: now })
      .where(and(eq(jobSurveys.jobId, id), eq(jobSurveys.isDeleted, false))),
    db
      .update(jobExpenses)
      .set({ isDeleted: true, updatedAt: now })
      .where(and(eq(jobExpenses.jobId, id), eq(jobExpenses.isDeleted, false))),
    // Nullify FK pointers (preserve financial/historical records, just clear job link)
    db
      .update(vehicles)
      .set({ currentJobId: null, updatedAt: now })
      .where(eq(vehicles.currentJobId, id)),
    db
      .update(checkInOutRecords)
      .set({ jobId: null, updatedAt: now })
      .where(eq(checkInOutRecords.jobId, id)),
    db
      .update(assignmentHistory)
      .set({ jobId: null, updatedAt: now })
      .where(eq(assignmentHistory.jobId, id)),
  ]);

  // 4. Soft-delete the job
  const [job] = await db
    .update(jobs)
    .set({
      isDeleted: true,
      deletedAt: now,
      deletedBy,
      updatedAt: now,
    })
    .where(and(eq(jobs.id, id), eq(jobs.isDeleted, false)))
    .returning();
  return job;
};

// ============================
// Job Team Members
// ============================

export const getJobTeamMembers = async (
  jobId: string,
  options?: { roleName?: string },
) => {
  const conditions = [
    eq(jobTeamMembers.jobId, jobId),
    eq(jobTeamMembers.isActive, true),
    eq(jobs.isDeleted, false),
  ];
  if (options?.roleName?.trim()) {
    conditions.push(eq(roles.name, options.roleName.trim()));
  }

  const members = await db
    .select({
      teamMember: jobTeamMembers,
      employee: employees,
      employeeName: users.fullName,
      position: positions,
      roleName: roles.name,
    })
    .from(jobTeamMembers)
    .leftJoin(employees, eq(jobTeamMembers.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(positions, eq(jobTeamMembers.positionId, positions.id))
    .innerJoin(jobs, eq(jobTeamMembers.jobId, jobs.id))
    .where(and(...conditions));

  return members.map((m) => ({
    ...m.teamMember,
    employee: m.employee,
    employeeName: m.employeeName ?? null,
    position: m.position,
    role: m.roleName ?? null,
  }));
};

export const addJobTeamMember = async (data: {
  jobId: string;
  employeeId: number;
  positionId?: number;
}) => {
  const [member] = await db
    .insert(jobTeamMembers)
    .values({
      jobId: data.jobId,
      employeeId: data.employeeId,
      positionId: data.positionId,
      isActive: true,
    })
    .returning();

  // Fire job_assigned notification (fire-and-forget, does not block response)
  void (async () => {
    try {
      const [techEmployee] = await db
        .select({ userId: employees.userId, reportsTo: employees.reportsTo })
        .from(employees)
        .where(eq(employees.id, data.employeeId))
        .limit(1);

      if (!techEmployee?.userId) return;

      const [jobBid] = await db
        .select({
          name: bidsTable.projectName,
          bidNumber: bidsTable.bidNumber,
          organizationId: bidsTable.organizationId,
          supervisorManager: bidsTable.supervisorManager,
          jobNumber: jobs.jobNumber,
          jobStatus: jobs.status,
          scheduledStartDate: jobs.scheduledStartDate,
          scheduledEndDate: jobs.scheduledEndDate,
          siteAddress: jobs.siteAddress,
          jobType: jobs.jobType,
          serviceType: jobs.serviceType,
        })
        .from(jobs)
        .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
        .where(eq(jobs.id, data.jobId))
        .limit(1);

      // Fetch client / organization name
      let clientName: string | null = null;
      if (jobBid?.organizationId) {
        const [orgData] = await db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, jobBid.organizationId))
          .limit(1);
        clientName = orgData?.name || null;
      }

      const formatDate = (d: string | null | undefined) =>
        d
          ? new Date(d).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : null;

      const startDateFormatted =
        formatDate(jobBid?.scheduledStartDate) ||
        jobBid?.scheduledStartDate ||
        "";
      const endDateFormatted =
        formatDate(jobBid?.scheduledEndDate) || jobBid?.scheduledEndDate || "";
      const jobStatus = jobBid?.jobStatus
        ? jobBid.jobStatus.charAt(0).toUpperCase() + jobBid.jobStatus.slice(1)
        : "Planned";

      const jobDetails: Record<string, string> = {};
      if (clientName) jobDetails["Client"] = clientName;
      jobDetails["Job Number"] = jobBid?.jobNumber || "";
      jobDetails["Status"] = jobStatus;
      jobDetails["Start Date"] = startDateFormatted;
      jobDetails["End Date"] = endDateFormatted;
      if (jobBid?.siteAddress) jobDetails["Site Address"] = jobBid.siteAddress;
      if (jobBid?.jobType) jobDetails["Job Type"] = jobBid.jobType;
      if (jobBid?.serviceType) jobDetails["Service Type"] = jobBid.serviceType;

      const jobName = jobBid?.name || jobBid?.bidNumber || "Job";
      const notesJson = JSON.stringify(jobDetails);
      const clientLine = clientName ? ` for client ${clientName}` : "";

      // Fetch team member's name for the supervisor email
      const [techUser] = await db
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, techEmployee.userId))
        .limit(1);
      const technicianName = techUser?.fullName || "A team member";

      // Resolve supervisorManager userId
      let supervisorManagerUserId: string | null = null;
      if (jobBid?.supervisorManager) {
        const [se] = await db
          .select({ userId: employees.userId })
          .from(employees)
          .where(eq(employees.id, jobBid.supervisorManager))
          .limit(1);
        supervisorManagerUserId = se?.userId ?? null;
      }

      const { NotificationService } = await import("./notification.service.js");
      const svc = new NotificationService();
      const notifiedUsers = new Set<string>();

      // 1. Notify the team member — they are directly assigned
      notifiedUsers.add(techEmployee.userId);
      await svc.triggerNotification({
        type: "job_assigned",
        category: "job",
        priority: "high",
        data: {
          entityType: "Job",
          entityId: data.jobId,
          entityName: jobName,
          assignedTechnicianId: techEmployee.userId,
          message: `You have been assigned to job "${jobName}"${clientLine}. The work is scheduled from ${startDateFormatted} to ${endDateFormatted}. Please review the details below and prepare accordingly.`,
          shortMessage: `New job assigned: ${jobName}${clientName ? ` — ${clientName}` : ""}`,
          notes: notesJson,
        },
      });

      // 2. Notify the supervisorManager — they are directly assigned to supervise this job
      if (supervisorManagerUserId && !notifiedUsers.has(supervisorManagerUserId)) {
        notifiedUsers.add(supervisorManagerUserId);
        await svc.triggerNotification({
          type: "job_assigned",
          category: "job",
          priority: "high",
          data: {
            entityType: "Job",
            entityId: data.jobId,
            entityName: jobName,
            assignedTechnicianId: supervisorManagerUserId,
            message: `You have been assigned as the supervisor for job "${jobName}"${clientLine}. The work is scheduled from ${startDateFormatted} to ${endDateFormatted}. Please review the details below and coordinate with the assigned technician to ensure a smooth start.`,
            shortMessage: `Supervisor assignment: ${jobName}${clientName ? ` — ${clientName}` : ""}`,
            notes: notesJson,
          },
        });
      }

      // 3. Notify the technician's reportsTo manager — ONLY if different from supervisorManager
      //    This person needs to know their department member was assigned
      if (techEmployee.reportsTo && !notifiedUsers.has(techEmployee.reportsTo)) {
        notifiedUsers.add(techEmployee.reportsTo);
        await svc.triggerNotification({
          type: "job_assigned",
          category: "job",
          priority: "high",
          data: {
            entityType: "Job",
            entityId: data.jobId,
            entityName: jobName,
            assignedTechnicianId: techEmployee.reportsTo,
            message: `${technicianName}, who reports to you, has been assigned to job "${jobName}"${clientLine}. The work is scheduled from ${startDateFormatted} to ${endDateFormatted}. Please review the details below for more information.`,
            shortMessage: `Your team member ${technicianName} was assigned to ${jobName}`,
            notes: notesJson,
          },
        });
      }
    } catch (err) {
      console.error("[Notification] job_assigned failed:", err);
    }
  })();

  return member;
};

export const removeJobTeamMember = async (
  jobId: string,
  employeeId: number,
) => {
  const [member] = await db
    .update(jobTeamMembers)
    .set({
      isActive: false,
      removedDate: new Date().toISOString().split("T")[0],
    })
    .where(
      and(
        eq(jobTeamMembers.jobId, jobId),
        eq(jobTeamMembers.employeeId, employeeId),
        eq(jobTeamMembers.isActive, true),
      ),
    )
    .returning();
  return member;
};

// ============================
// Job Summary (for get-by-id and get-by-id-complete)
// ============================

export type JobFinancialSummary = {
  totalContractValue: string;
  profitMargin: number;
  estimatedProfit: string;
  startDate: string | null;
  endDate: string | null;
  remaining: string;
};

function toDecimal2(value: number): string {
  return value.toFixed(2);
}

export const getJobFinancialSummaryFields = (
  job: {
    actualCost?: string | null;
    createdAt?: Date | null;
    scheduledEndDate?: string | null;
    actualEndDate?: string | null;
  },
  financialBreakdown: {
    totalCost?: string | null;
    actualTotalCost?: string | null;
  } | null,
  bidActualTotalPrice?: string | null,
): JobFinancialSummary => {
  const contractVal = Number(bidActualTotalPrice) || 0;
  const _plannedCost = Number(financialBreakdown?.totalCost) || 0;
  const actualBidCost =
    Number(
      financialBreakdown?.actualTotalCost || financialBreakdown?.totalCost,
    ) || 0;
  const actualCostNum = job.actualCost != null ? Number(job.actualCost) : null;
  const costForRemaining = actualCostNum ?? actualBidCost;
  const estimatedProfit = contractVal - actualBidCost;
  const profitMargin = contractVal ? (estimatedProfit / contractVal) * 100 : 0;
  const remaining = contractVal - costForRemaining;

  const startDate: string | null = job.createdAt
    ? (new Date(job.createdAt).toISOString().split("T")[0] ?? null)
    : null;
  const rawEndDate = job.actualEndDate ?? job.scheduledEndDate;
  const endDate: string | null = rawEndDate != null ? rawEndDate : null;

  return {
    totalContractValue: toDecimal2(contractVal),
    profitMargin: Math.round(profitMargin * 100) / 100,
    estimatedProfit: toDecimal2(estimatedProfit),
    startDate,
    endDate,
    remaining: toDecimal2(remaining),
  };
};

// ============================
// Job with All Data (from Bid)
// ============================

export const getJobWithAllData = async (jobId: string) => {
  // Get job with bid info
  const [jobData] = await db
    .select({
      job: jobs,
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    throw new Error("Job not found");
  }

  // Get team members (job-specific)
  const teamMembers = await getJobTeamMembers(jobId);

  // Fetch all data from bid tables using job.bidId and organizationId
  const [
    financialBreakdown,
    materials,
    labor,
    operatingExpenses,
    timeline,
    notes,
    history,
    clientInfo,
  ] = await Promise.all([
    getBidFinancialBreakdown(jobData.bidId, jobData.organizationId),
    getBidMaterials(jobData.bidId, jobData.organizationId),
    getBidLabor(jobData.bidId),
    getBidOperatingExpenses(jobData.bidId, jobData.organizationId),
    getBidTimeline(jobData.bidId),
    getBidNotes(jobData.bidId),
    getBidHistory(jobData.bidId),
    getOrganizationById(jobData.organizationId),
  ]);

  // Get travel for each labor entry
  const travelPromises = labor.map((laborEntry) => getBidTravel(laborEntry.id));
  const travelArrays = await Promise.all(travelPromises);
  const travel = travelArrays.flat();

  // Get bid to include priority and all necessary fields for editing
  const [bid] = await db
    .select()
    .from(bidsTable)
    .where(eq(bidsTable.id, jobData.bidId))
    .limit(1);

  // Get property info if available
  let property = null;
  if (bid?.propertyId) {
    const [propertyData] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, bid.propertyId))
      .limit(1);
    property = propertyData || null;
  }

  // Financial summary (totalContractValue, profitMargin, estimatedProfit, startDate=createdAt, endDate, remaining)
  const jobSummary = getJobFinancialSummaryFields(
    jobData.job,
    financialBreakdown,
    financialBreakdown?.actualTotalPrice,
  );

  const progress = await getJobProgressPercentages(
    jobId,
    financialBreakdown?.actualTotalPrice ?? null,
  );

  return {
    job: {
      ...jobData.job,
      priority: bid?.priority, // Use bid priority instead of job priority
      name: bid?.projectName, // Derive name from bid.projectName
      organizationId: jobData.organizationId,
      jobAmount: financialBreakdown?.actualTotalPrice ?? null,
      totalContractValue: jobSummary.totalContractValue,
      profitMargin: jobSummary.profitMargin,
      estimatedProfit: jobSummary.estimatedProfit,
      startDate: jobSummary.startDate,
      endDate: jobSummary.endDate,
      remaining: jobSummary.remaining,
      paymentProgressPercent: progress.paymentProgressPercent,
      taskProgressPercent: progress.taskProgressPercent,
      bid: bid
        ? {
            id: bid.id,
            bidNumber: bid.bidNumber,
            title: bid.title,
            projectName: bid.projectName,
            priority: bid.priority,
            propertyId: bid.propertyId,
            siteAddress: bid.siteAddress,
            buildingSuiteNumber: bid.buildingSuiteNumber,
            scopeOfWork: bid.scopeOfWork,
            specialRequirements: bid.specialRequirements,
            paymentTerms: bid.paymentTerms,
            warrantyPeriod: bid.warrantyPeriod,
            warrantyPeriodLabor: bid.warrantyPeriodLabor,
            warrantyDetails: bid.warrantyDetails,
            exclusions: bid.exclusions,
            proposalBasis: bid.proposalBasis,
            expectedStartDate: bid.expectedStartDate,
            expectedCompletionDate: bid.expectedCompletionDate,
          }
        : undefined,
      property: property
        ? {
            id: property.id,
            name: property.propertyName,
            address: property.addressLine1,
          }
        : undefined,
    },
    teamMembers,
    financialBreakdown,
    materials,
    labor,
    travel,
    operatingExpenses,
    timeline,
    notes,
    history,
    clientInfo: clientInfo?.organization ?? null,
  };
};

// ============================
// Utility Functions
// ============================

// Generate next job number
// Format: JOB-2025-0001 (name-year-4digit, auto-expands to 5, 6+ as needed)
const generateJobNumber = async (organizationId: string): Promise<string> => {
  const year = new Date().getFullYear();

  try {
    // Try to use atomic database function first
    const result = await db.execute<{ next_value: string }>(
      sql.raw(
        `SELECT org.get_next_counter('${organizationId}'::uuid, 'job_number') as next_value`,
      ),
    );

    const nextNumber = parseInt(result.rows[0]?.next_value || "1");
    // Use 4 digits minimum, auto-expand when exceeds 9999
    const padding = Math.max(4, nextNumber.toString().length);
    return `JOB-${year}-${nextNumber.toString().padStart(padding, "0")}`;
  } catch (error) {
    // Fallback to manual counter if database function doesn't exist
    console.warn("Counter function not found, using fallback method:", error);

    // Get the highest existing job number for this organization and year
    const maxResult = await db
      .select({ maxJobNumber: sql<string>`MAX(${jobs.jobNumber})` })
      .from(jobs)
      .innerJoin(
        bidsTable,
        and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
      )
      .where(
        and(
          eq(bidsTable.organizationId, organizationId),
          eq(jobs.isDeleted, false),
          sql`${jobs.jobNumber} ~ ${`^JOB-${year}-\\d+$`}`, // Only count job numbers for current year
        ),
      );

    let nextNumber = 1;
    const maxJobNumber = maxResult[0]?.maxJobNumber;
    if (maxJobNumber) {
      const match = maxJobNumber.match(/^JOB-\d+-(\d+)$/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Use 4 digits minimum, auto-expand when exceeds 9999
    const padding = Math.max(4, nextNumber.toString().length);
    return `JOB-${year}-${nextNumber.toString().padStart(padding, "0")}`;
  }
};

export const checkJobNumberExists = async (
  jobNumber: string,
  organizationId: string,
): Promise<boolean> => {
  const [result] = await db
    .select({ count: count() })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(
      and(
        eq(jobs.jobNumber, jobNumber),
        eq(bidsTable.organizationId, organizationId),
        eq(jobs.isDeleted, false),
      ),
    );
  return (result?.count ?? 0) > 0;
};

// ============================
// Job Financial Operations
// ============================

export const getJobFinancialSummary = async (jobId: string) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      job: jobs,
      bid: bidsTable,
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get the financial breakdown using the bid's organizationId
  const financialBreakdown = await getBidFinancialBreakdown(
    jobData.bidId,
    jobData.organizationId,
  );

  return financialBreakdown;
};

export const updateJobFinancialSummary = async (
  jobId: string,
  organizationId: string,
  data: {
    materialsEquipment?: string;
    labor?: string;
    travel?: string;
    operatingExpenses?: string;
  },
) => {
  // Get the job's bid
  const jobData = await getJobById(jobId);
  if (!jobData) return null;

  // Update the bid's financial breakdown
  const result = await db
    .update(bidFinancialBreakdown)
    .set({
      ...data,
      totalCost: sql`CAST(COALESCE(${data.materialsEquipment || "0"}, '0') AS NUMERIC) + 
                     CAST(COALESCE(${data.labor || "0"}, '0') AS NUMERIC) + 
                     CAST(COALESCE(${data.travel || "0"}, '0') AS NUMERIC) + 
                     CAST(COALESCE(${data.operatingExpenses || "0"}, '0') AS NUMERIC)`,
      updatedAt: new Date(),
    })
    .where(eq(bidFinancialBreakdown.bidId, jobData.bidId))
    .returning();

  return result[0];
};

export const getJobPlannedFinancialBreakdown = async (
  jobId: string,
  _organizationId: string,
) => {
  return await getJobFinancialSummary(jobId);
};

// ============================
// Job Materials Operations (Placeholder - would need materials table)
// ============================

export const getJobMaterials = async (jobId: string) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get materials from the bid
  const materials = await getBidMaterials(
    jobData.bidId,
    jobData.organizationId,
  );

  return materials;
};

export const getJobMaterialById = async (jobId: string, materialId: string) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get the material from the bid
  const material = await getBidMaterialById(materialId, jobData.organizationId);

  return material;
};

export const createJobMaterial = async (data: {
  jobId: string;
  description: string;
  quantity: string;
  unitCost: string;
  markup?: string;
  totalCost: string;
}) => {
  // Get job to retrieve bidId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, data.jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    throw new Error("Job not found");
  }

  // Create material in bid_materials table
  const { createBidMaterial } = await import("./bid.service.js");
  const material = await createBidMaterial({
    bidId: jobData.bidId,
    description: data.description,
    quantity: data.quantity,
    unitCost: data.unitCost,
    markup: data.markup || "0",
    totalCost: data.totalCost,
  });

  return material;
};

export const updateJobMaterial = async (
  id: string,
  jobId: string,
  data: Partial<{
    description: string;
    quantity: string;
    unitCost: string;
    markup: string;
    totalCost: string;
  }>,
) => {
  // Get job to retrieve bidId and organizationId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    throw new Error("Job not found");
  }

  // Update material in bid_materials table
  const { updateBidMaterial } = await import("./bid.service.js");
  const material = await updateBidMaterial(id, jobData.organizationId, data);

  return material;
};

export const deleteJobMaterial = async (id: string, jobId: string) => {
  // Get job to retrieve organizationId
  const [jobData] = await db
    .select({
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    throw new Error("Job not found");
  }

  // Delete material from bid_materials table
  const { deleteBidMaterial } = await import("./bid.service.js");
  const material = await deleteBidMaterial(id, jobData.organizationId);

  return material;
};

// ============================
// Job Labor Operations (Placeholder)
// ============================

export const getJobLabor = async (jobId: string) => {
  // Get job with bid info to retrieve the bidId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get labor from the bid (getBidLabor doesn't require organizationId)
  const labor = await getBidLabor(jobData.bidId);

  return labor;
};

export const getJobLaborById = async (jobId: string, laborId: string) => {
  // Get job with bid info to retrieve the bidId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get the labor entry from the bid
  const labor = await getBidLaborById(laborId);

  return labor;
};

export const createJobLabor = async (data: {
  jobId: string;
  organizationId: string;
  positionId: number;
  days: number;
  hoursPerDay: string;
  totalHours: string;
  costRate: string;
  billableRate: string;
  totalCost: string;
  totalPrice: string;
}) => {
  try {
    // Get job with bid info to retrieve the bidId
    // organizationId in data is the job's client org (from bid), set by controller
    const [jobData] = await db
      .select({
        bidId: jobs.bidId,
        organizationId: bidsTable.organizationId,
      })
      .from(jobs)
      .innerJoin(
        bidsTable,
        and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
      )
      .where(
        and(
          eq(jobs.id, data.jobId),
          eq(jobs.isDeleted, false),
          eq(bidsTable.isDeleted, false),
        ),
      );

    if (!jobData) {
      return null;
    }

    // Create labor entry for the bid
    const labor = await createBidLabor({
      bidId: jobData.bidId,
      positionId: data.positionId,
      days: data.days,
      hoursPerDay: data.hoursPerDay,
      totalHours: data.totalHours,
      costRate: data.costRate,
      billableRate: data.billableRate,
      totalCost: data.totalCost,
      totalPrice: data.totalPrice,
    });

    if (!labor) {
      return null;
    }

    return {
      ...labor,
      jobId: data.jobId,
      organizationId: jobData.organizationId,
    };
  } catch (error) {
    console.error("Error in createJobLabor:", error);
    throw error;
  }
};

export const updateJobLabor = async (
  id: string,
  jobId: string,
  organizationId: string,
  data: Partial<{
    positionId: number;
    days: number;
    hoursPerDay: string;
    totalHours: string;
    costRate: string;
    billableRate: string;
    totalCost: string;
    totalPrice: string;
  }>,
) => {
  // Verify the labor entry belongs to the job's bid
  // organizationId is the job's client org (from bid), passed by controller
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.isDeleted, false),
        eq(bidsTable.isDeleted, false),
      ),
    );

  if (!jobData) {
    return null;
  }

  // Update the labor entry in the bid
  const labor = await updateBidLabor(id, data);

  if (!labor) {
    return null;
  }

  return {
    ...labor,
    jobId,
    organizationId: jobData.organizationId,
  };
};

export const deleteJobLabor = async (
  id: string,
  jobId: string,
  _organizationId: string,
) => {
  // Verify the job exists
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.isDeleted, false),
        eq(bidsTable.isDeleted, false),
      ),
    );

  if (!jobData) {
    return null;
  }

  // Delete the labor entry from the bid
  const labor = await deleteBidLabor(id);

  return labor;
};

// ============================
// Job Travel Operations (Placeholder)
// ============================

export const getJobTravel = async (jobId: string) => {
  // Get job with bid info to retrieve the bidId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get all labor entries for this bid
  const labor = await getBidLabor(jobData.bidId);

  // Get travel for each labor entry
  const travelPromises = labor.map((laborEntry) => getBidTravel(laborEntry.id));
  const travelArrays = await Promise.all(travelPromises);
  const travel = travelArrays.flat();

  return travel;
};

export const getJobTravelById = async (jobId: string, travelId: string) => {
  // Get job with bid info to retrieve the bidId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get the travel entry from the bid
  const travel = await getBidTravelById(travelId);

  return travel;
};

export const createJobTravel = async (data: {
  jobId: string;
  organizationId: string;
  bidLaborId: string;
  roundTripMiles: string;
  mileageRate: string;
  vehicleDayRate: string;
  days: number;
  mileageCost: string;
  vehicleCost: string;
  markup: string;
  totalCost: string;
  totalPrice: string;
}) => {
  // Verify the job exists and get bidId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, data.jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Create travel entry using bid service
  const travel = await createBidTravel({
    bidLaborId: data.bidLaborId,
    roundTripMiles: data.roundTripMiles,
    mileageRate: data.mileageRate,
    vehicleDayRate: data.vehicleDayRate,
    days: data.days,
    mileageCost: data.mileageCost,
    vehicleCost: data.vehicleCost,
    markup: data.markup,
    totalCost: data.totalCost,
    totalPrice: data.totalPrice,
  });

  return travel;
};

export const updateJobTravel = async (
  id: string,
  jobId: string,
  organizationId: string,
  data: Partial<{
    bidLaborId: string;
    vehicleName: string;
    roundTripMiles: string;
    mileageRate: string;
    vehicleDayRate: string;
    days: number;
    mileageCost: string;
    vehicleCost: string;
    markup: string;
    totalCost: string;
    totalPrice: string;
  }>,
) => {
  // Verify the job exists
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Update travel entry using bid service
  const travel = await updateBidTravel(id, data);

  return travel;
};

export const deleteJobTravel = async (
  id: string,
  jobId: string,
  _organizationId: string,
) => {
  // Verify the job exists
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Delete travel entry using bid service
  const travel = await deleteBidTravel(id);

  return travel;
};

export const getJobPlannedOperatingExpenses = async (jobId: string) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get operating expenses from the bid
  const operatingExpenses = await getBidOperatingExpenses(
    jobData.bidId,
    jobData.organizationId,
  );

  return operatingExpenses;
};

// ============================
// Job Timeline Operations (Placeholder)
// ============================

export const getJobTimeline = async (jobId: string) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get timeline events from the bid
  const timeline = await getBidTimeline(jobData.bidId);

  return timeline;
};

export const createJobTimelineEvent = async (data: {
  jobId: string;
  organizationId: string;
  event: string;
  eventDate: string;
  estimatedDuration: number;
  durationType: string;
  isCompleted?: boolean;
  description?: string;
  sortOrder?: number;
  createdBy?: string;
}) => {
  // Get job with bid info to retrieve the bidId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, data.jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Create timeline event in the bid
  const timelineEvent = await createBidTimelineEvent({
    bidId: jobData.bidId,
    event: data.event,
    eventDate: data.eventDate,
    estimatedDuration: data.estimatedDuration,
    durationType: data.durationType,
    isCompleted: data.isCompleted ?? false,
    ...(data.description !== undefined && { description: data.description }),
    ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    ...(data.createdBy !== undefined && { createdBy: data.createdBy }),
  });

  return timelineEvent;
};

export const getJobTimelineEventById = async (
  jobId: string,
  eventId: string,
) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get the timeline event from the bid
  const timelineEvent = await getBidTimelineEventById(eventId);

  return timelineEvent;
};

export const updateJobTimelineEvent = async (
  id: string,
  jobId: string,
  organizationId: string,
  data: Partial<{
    event: string;
    eventDate: string;
    estimatedDuration: number;
    durationType: string;
    isCompleted: boolean;
    description: string;
    sortOrder: number;
  }>,
) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Update timeline event using bid service
  const timelineEvent = await updateBidTimelineEvent(id, data);

  return timelineEvent;
};

export const deleteJobTimelineEvent = async (
  id: string,
  jobId: string,
  _organizationId: string,
) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Delete timeline event using bid service
  const timelineEvent = await deleteBidTimelineEvent(id);

  return timelineEvent;
};

// ============================
// Job Notes Operations (Placeholder)
// ============================

export const getJobNotes = async (jobId: string) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get notes from the bid
  const notes = await getBidNotes(jobData.bidId);

  return notes;
};

export const createJobNote = async (data: {
  jobId: string;
  organizationId: string;
  note: string;
  isInternal?: boolean;
  createdBy: string;
}) => {
  // Get job with bid info to retrieve the bidId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, data.jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Create note in the bid
  const note = await createBidNote({
    bidId: jobData.bidId,
    note: data.note,
    ...(data.isInternal !== undefined && { isInternal: data.isInternal }),
    createdBy: data.createdBy,
  });

  // Fire job_site_notes_added notification (fire-and-forget)
  if (note) {
    void (async () => {
      try {
        const [jobBid] = await db
          .select({
            name: bidsTable.projectName,
            bidNumber: bidsTable.bidNumber,
          })
          .from(jobs)
          .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
          .where(eq(jobs.id, data.jobId))
          .limit(1);
        const { NotificationService } =
          await import("./notification.service.js");
        await new NotificationService().triggerNotification({
          type: "job_site_notes_added",
          category: "job",
          priority: "low",
          triggeredBy: data.createdBy,
          data: {
            entityType: "Job",
            entityId: data.jobId,
            entityName: jobBid?.name || jobBid?.bidNumber || "Job",
          },
        });
      } catch (err) {
        console.error("[Notification] job_site_notes_added failed:", err);
      }
    })();
  }

  return note;
};

export const getJobNoteById = async (jobId: string, noteId: string) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get the note from the bid
  const note = await getBidNoteById(noteId);

  return note;
};

export const updateJobNote = async (
  id: string,
  jobId: string,
  organizationId: string,
  data: {
    note: string;
    isInternal?: boolean;
  },
) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Update note using bid service
  const note = await updateBidNote(id, data);

  return note;
};

export const deleteJobNote = async (
  id: string,
  jobId: string,
  _organizationId: string,
) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Delete note using bid service
  const note = await deleteBidNote(id);

  return note;
};

// ============================
// Job History Operations (Placeholder)
// ============================

export const getJobHistory = async (jobId: string, _organizationId: string) => {
  // Get job with bid info to retrieve the bidId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.isDeleted, false),
        eq(bidsTable.isDeleted, false),
      ),
    );

  if (!jobData) {
    return [];
  }

  // Get history from the bid
  const history = await getBidHistory(jobData.bidId);

  return history;
};

export const createJobHistoryEntry = async (data: {
  jobId: string;
  organizationId: string;
  action: string;
  description: string;
  createdBy: string;
}) => {
  // Get job with bid info to retrieve the bidId and client org
  // organizationId in data is the job's client org (from bid), set by controller
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(
      and(
        eq(jobs.id, data.jobId),
        eq(jobs.isDeleted, false),
        eq(bidsTable.isDeleted, false),
      ),
    );

  if (!jobData) {
    return null;
  }

  // Create history entry in the bid
  const historyEntry = await createBidHistoryEntry({
    bidId: jobData.bidId,
    organizationId: jobData.organizationId,
    action: data.action,
    description: data.description,
    performedBy: data.createdBy,
  });

  return historyEntry;
};

// ============================
// Job Tasks Operations
// ============================

// Generate next task number: TASK-YYYY-NNNN (name-year-4digit, auto-expands)
const generateTaskNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const [result] = await db
    .select({
      maxTaskNumber: max(jobTasks.taskNumber),
    })
    .from(jobTasks)
    .where(sql`${jobTasks.taskNumber} ~ ${`^TASK-${year}-\\d+$`}`);

  const maxTaskNumber = result?.maxTaskNumber;
  let nextNumber = 1;
  if (maxTaskNumber) {
    const match = String(maxTaskNumber).match(/TASK-\d+-(\d+)/);
    if (match?.[1]) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }
  const padding = Math.max(4, nextNumber.toString().length);
  return `TASK-${year}-${nextNumber.toString().padStart(padding, "0")}`;
};

export const getJobTasks = async (jobId: string) => {
  const [jobRow] = await db
    .select({ jobId: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobRow) {
    return null;
  }

  const tasks = await db
    .select()
    .from(jobTasks)
    .where(and(eq(jobTasks.jobId, jobId), eq(jobTasks.isDeleted, false)))
    .orderBy(asc(jobTasks.sortOrder), asc(jobTasks.dueDate));

  return tasks;
};

export const getJobTaskById = async (jobId: string, taskId: string) => {
  const [jobRow] = await db
    .select({ jobId: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobRow) {
    return null;
  }

  const [task] = await db
    .select()
    .from(jobTasks)
    .where(
      and(
        eq(jobTasks.id, taskId),
        eq(jobTasks.jobId, jobId),
        eq(jobTasks.isDeleted, false),
      ),
    );

  return task || null;
};

export const createJobTask = async (data: {
  jobId: string;
  taskName: string;
  description?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  dueDate?: string;
  estimatedHours?: string;
  sortOrder?: number;
  createdBy: string;
}): Promise<{
  task: typeof jobTasks.$inferSelect;
  organizationId: string;
} | null> => {
  const [jobData] = await db
    .select({
      jobId: jobs.id,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, data.jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  const taskNumber = await generateTaskNumber();

  const [task] = await db
    .insert(jobTasks)
    .values({
      jobId: data.jobId,
      taskNumber,
      taskName: data.taskName,
      description: data.description,
      status: (data.status as any) || "backlog",
      priority: data.priority || "medium",
      assignedTo: data.assignedTo || null,
      dueDate: data.dueDate || null,
      estimatedHours: data.estimatedHours || null,
      sortOrder: data.sortOrder ?? 0,
      createdBy: data.createdBy,
    })
    .returning();

  if (!task) return null;
  return { task, organizationId: jobData.organizationId };
};

type JobTaskStatus = "backlog" | "in_progress" | "in_review" | "done";

export const updateJobTask = async (
  id: string,
  jobId: string,
  _organizationId: string,
  data: Partial<{
    taskName: string;
    description: string;
    status: JobTaskStatus;
    priority: string;
    assignedTo: string;
    dueDate: string;
    completedDate: string;
    estimatedHours: string;
    actualHours: string;
    sortOrder: number;
  }>,
) => {
  const [jobRow] = await db
    .select({ jobId: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobRow) {
    return null;
  }

  const [task] = await db
    .update(jobTasks)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobTasks.id, id),
        eq(jobTasks.jobId, jobId),
        eq(jobTasks.isDeleted, false),
      ),
    )
    .returning();

  return task || null;
};

export const deleteJobTask = async (
  id: string,
  jobId: string,
  _organizationId: string,
) => {
  const [jobRow] = await db
    .select({ jobId: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobRow) {
    return null;
  }

  const [task] = await db
    .update(jobTasks)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobTasks.id, id),
        eq(jobTasks.jobId, jobId),
        eq(jobTasks.isDeleted, false),
      ),
    )
    .returning();

  return task || null;
};

// ============================
// Task Comments Operations
// ============================

const taskCommentCreatedByUser = alias(users, "task_comment_created_by");

/** Ensure task exists and belongs to job; return taskId or null */
const ensureTaskBelongsToJob = async (
  jobId: string,
  taskId: string,
): Promise<string | null> => {
  const [row] = await db
    .select({ id: jobTasks.id })
    .from(jobTasks)
    .where(
      and(
        eq(jobTasks.id, taskId),
        eq(jobTasks.jobId, jobId),
        eq(jobTasks.isDeleted, false),
      ),
    );
  return row?.id ?? null;
};

export const getTaskComments = async (
  jobId: string,
  taskId: string,
): Promise<Array<{
  id: string;
  jobTaskId: string;
  comment: string;
  createdBy: string | null;
  createdByName: string | null;
  isDeleted: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}> | null> => {
  const tid = await ensureTaskBelongsToJob(jobId, taskId);
  if (!tid) return null;

  const rows = await db
    .select({
      id: taskComments.id,
      jobTaskId: taskComments.jobTaskId,
      comment: taskComments.comment,
      createdBy: taskComments.createdBy,
      createdByName: taskCommentCreatedByUser.fullName,
      isDeleted: taskComments.isDeleted,
      createdAt: taskComments.createdAt,
      updatedAt: taskComments.updatedAt,
    })
    .from(taskComments)
    .leftJoin(
      taskCommentCreatedByUser,
      eq(taskComments.createdBy, taskCommentCreatedByUser.id),
    )
    .where(
      and(eq(taskComments.jobTaskId, tid), eq(taskComments.isDeleted, false)),
    )
    .orderBy(desc(taskComments.createdAt));

  return rows.map((r) => ({
    ...r,
    createdByName: r.createdByName ?? null,
    isDeleted: r.isDeleted ?? false,
  }));
};

export const getTaskCommentById = async (
  jobId: string,
  taskId: string,
  commentId: string,
) => {
  const tid = await ensureTaskBelongsToJob(jobId, taskId);
  if (!tid) return null;

  const [row] = await db
    .select({
      id: taskComments.id,
      jobTaskId: taskComments.jobTaskId,
      comment: taskComments.comment,
      createdBy: taskComments.createdBy,
      createdByName: taskCommentCreatedByUser.fullName,
      isDeleted: taskComments.isDeleted,
      createdAt: taskComments.createdAt,
      updatedAt: taskComments.updatedAt,
    })
    .from(taskComments)
    .leftJoin(
      taskCommentCreatedByUser,
      eq(taskComments.createdBy, taskCommentCreatedByUser.id),
    )
    .where(
      and(
        eq(taskComments.id, commentId),
        eq(taskComments.jobTaskId, tid),
        eq(taskComments.isDeleted, false),
      ),
    );

  if (!row) return null;
  return {
    ...row,
    createdByName: row.createdByName ?? null,
  };
};

export const createTaskComment = async (data: {
  jobId: string;
  taskId: string;
  comment: string;
  createdBy: string;
}) => {
  const tid = await ensureTaskBelongsToJob(data.jobId, data.taskId);
  if (!tid) return null;

  const [inserted] = await db
    .insert(taskComments)
    .values({
      jobTaskId: tid,
      comment: data.comment,
      createdBy: data.createdBy,
    })
    .returning();

  if (!inserted) return null;
  return getTaskCommentById(data.jobId, data.taskId, inserted.id);
};

export const updateTaskComment = async (
  commentId: string,
  jobId: string,
  taskId: string,
  data: { comment?: string },
) => {
  const tid = await ensureTaskBelongsToJob(jobId, taskId);
  if (!tid) return null;

  const [updated] = await db
    .update(taskComments)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(taskComments.id, commentId),
        eq(taskComments.jobTaskId, tid),
        eq(taskComments.isDeleted, false),
      ),
    )
    .returning();

  if (!updated) return null;
  return getTaskCommentById(jobId, taskId, commentId);
};

export const deleteTaskComment = async (
  commentId: string,
  jobId: string,
  taskId: string,
) => {
  const tid = await ensureTaskBelongsToJob(jobId, taskId);
  if (!tid) return null;

  const [softDeleted] = await db
    .update(taskComments)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(
      and(
        eq(taskComments.id, commentId),
        eq(taskComments.jobTaskId, tid),
        eq(taskComments.isDeleted, false),
      ),
    )
    .returning();

  return softDeleted ?? null;
};

// ============================
// Job Survey Operations
// ============================

const surveyCreatedByUser = alias(users, "survey_created_by");
const surveyTechnicianUser = alias(users, "survey_technician_user");

export const getJobSurveys = async (jobId: string) => {
  const [jobRow] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));
  if (!jobRow) return null;

  const rows = await db
    .select({
      survey: jobSurveys,
      createdByName: surveyCreatedByUser.fullName,
      technicianName: surveyTechnicianUser.fullName,
    })
    .from(jobSurveys)
    .leftJoin(
      surveyCreatedByUser,
      eq(jobSurveys.createdBy, surveyCreatedByUser.id),
    )
    .leftJoin(employees, eq(jobSurveys.technicianId, employees.id))
    .leftJoin(
      surveyTechnicianUser,
      eq(employees.userId, surveyTechnicianUser.id),
    )
    .where(and(eq(jobSurveys.jobId, jobId), eq(jobSurveys.isDeleted, false)))
    .orderBy(desc(jobSurveys.createdAt));

  return rows.map((r) => ({
    ...r.survey,
    createdByName: r.createdByName ?? null,
    technicianName: r.technicianName ?? null,
  }));
};

export const getJobSurveyById = async (jobId: string, surveyId: string) => {
  const [row] = await db
    .select({
      survey: jobSurveys,
      createdByName: surveyCreatedByUser.fullName,
      technicianName: surveyTechnicianUser.fullName,
    })
    .from(jobSurveys)
    .leftJoin(
      surveyCreatedByUser,
      eq(jobSurveys.createdBy, surveyCreatedByUser.id),
    )
    .leftJoin(employees, eq(jobSurveys.technicianId, employees.id))
    .leftJoin(
      surveyTechnicianUser,
      eq(employees.userId, surveyTechnicianUser.id),
    )
    .where(
      and(
        eq(jobSurveys.id, surveyId),
        eq(jobSurveys.jobId, jobId),
        eq(jobSurveys.isDeleted, false),
      ),
    );

  if (!row) return null;
  return {
    ...row.survey,
    createdByName: row.createdByName ?? null,
    technicianName: row.technicianName ?? null,
  };
};

type JobSurveyInsert = Partial<{
  buildingNumber: string;
  unitTagLabel: string;
  unitLocation: string;
  technicianId: number;
  make: string;
  modelNumber: string;
  serialNumber: string;
  systemType: string;
  powerStatus: string;
  voltagePhase: string;
  overallUnitCondition: string;
  physicalConditionNotes: string;
  corrosionOrRust: boolean;
  debrisOrBlockage: boolean;
  refrigerantLineCondition: string;
  electricalComponentsCondition: string;
  ductingCondition: string;
  condensateLineCondition: string;
  cabinetIntegrity: string;
  filterPresent: boolean;
  filterSize: string;
  filterCondition: string;
  blowerMotorStatus: string;
  blowerMotorCondition: string;
  airflowOutput: string;
  beltCondition: string;
  temperatureSplitSupplyF: string;
  temperatureSplitReturnF: string;
  coolingCoilCondition: string;
  compressorStatus: string;
  refrigerantLineTemperatureF: string;
  coolingFunctionality: string;
  heatingFunctionality: string;
  gasValveCondition: string;
  heatingCoilCondition: string;
  photosMedia: unknown;
  pros: string;
  cons: string;
  status: string;
}>;

export const createJobSurvey = async (
  data: {
    jobId: string;
    createdBy: string;
  } & JobSurveyInsert,
) => {
  const { jobId, createdBy, ...rest } = data;
  const [jobRow] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));
  if (!jobRow) return null;

  if (rest.technicianId != null && typeof rest.technicianId === "number") {
    const [emp] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.id, rest.technicianId));
    if (!emp) {
      const err = new Error(
        "The employee you selected does not exist. Please choose a valid employee.",
      ) as Error & { code?: string };
      err.code = "INVALID_TECHNICIAN";
      throw err;
    }
  }

  const [inserted] = await db
    .insert(jobSurveys)
    .values({
      jobId,
      createdBy,
      ...rest,
    })
    .returning();
  if (!inserted) return null;
  return getJobSurveyById(jobId, inserted.id);
};

export const updateJobSurvey = async (
  surveyId: string,
  jobId: string,
  data: JobSurveyInsert,
) => {
  if (data.technicianId != null && typeof data.technicianId === "number") {
    const [emp] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.id, data.technicianId));
    if (!emp) {
      const err = new Error(
        "The employee you selected does not exist. Please choose a valid employee.",
      ) as Error & { code?: string };
      err.code = "INVALID_TECHNICIAN";
      throw err;
    }
  }

  const [updated] = await db
    .update(jobSurveys)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(jobSurveys.id, surveyId),
        eq(jobSurveys.jobId, jobId),
        eq(jobSurveys.isDeleted, false),
      ),
    )
    .returning();
  if (!updated) return null;
  return getJobSurveyById(jobId, surveyId);
};

export const deleteJobSurvey = async (surveyId: string, jobId: string) => {
  const [softDeleted] = await db
    .update(jobSurveys)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(
      and(
        eq(jobSurveys.id, surveyId),
        eq(jobSurveys.jobId, jobId),
        eq(jobSurveys.isDeleted, false),
      ),
    )
    .returning();
  return softDeleted ?? null;
};

// ============================
// Job Expenses Operations (Placeholder)
// ============================

export const getJobExpenses = async (
  jobId: string,
  _organizationId: string,
) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      jobId: jobs.id,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get expenses for this job (job_expenses has no organizationId - filter by jobId only)
  const expenses = await db
    .select()
    .from(jobExpenses)
    .where(and(eq(jobExpenses.jobId, jobId), eq(jobExpenses.isDeleted, false)))
    .orderBy(desc(jobExpenses.expenseDate));

  return expenses;
};

export const getJobExpenseById = async (jobId: string, expenseId: string) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      jobId: jobs.id,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get the expense from the job_expenses table (no organizationId on table)
  const [expense] = await db
    .select()
    .from(jobExpenses)
    .where(
      and(
        eq(jobExpenses.id, expenseId),
        eq(jobExpenses.jobId, jobId),
        eq(jobExpenses.isDeleted, false),
      ),
    );

  return expense || null;
};

export const createJobExpense = async (data: {
  jobId: string;
  expenseType: string;
  category?: string;
  description: string;
  quantity?: number;
  amount: string;
  expenseDate: string;
  vendorName?: string;
  invoiceNumber?: string;
  receiptPath?: string;
  approvedBy?: string;
  createdBy: string;
}) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      jobId: jobs.id,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, data.jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  const category = (data.category ??
    getDefaultExpenseCategory()) as typeof jobExpenses.$inferSelect.category;

  // Create the expense in the database (job_expenses has no organizationId column)
  const [expense] = await db
    .insert(jobExpenses)
    .values({
      jobId: data.jobId,
      category,
      expenseType: data.expenseType,
      description: data.description,
      quantity: data.quantity ?? 1,
      amount: data.amount,
      expenseDate: data.expenseDate,
      vendorName: data.vendorName,
      invoiceNumber: data.invoiceNumber,
      receiptPath: data.receiptPath,
      approvedBy: data.approvedBy,
      createdBy: data.createdBy,
    })
    .returning();

  // Sync to org.expenses for unified expense tracking (source_id = job_expense.id, expense_type = job_*)
  if (expense) {
    await createExpenseFromSource({
      sourceId: expense.id,
      jobId: data.jobId,
      category,
      expenseType: data.expenseType,
      amount: data.amount,
      expenseDate: data.expenseDate,
      description: data.description,
      title: data.expenseType,
      vendor: data.vendorName ?? null,
      createdBy: data.createdBy,
      source: "job",
      approvedBy: data.approvedBy ?? null,
    });
  }

  return expense ? { expense, organizationId: jobData.organizationId } : null;
};

export const updateJobExpense = async (
  id: string,
  jobId: string,
  organizationId: string,
  data: Partial<{
    expenseType: string;
    category: string;
    description: string;
    quantity: number;
    amount: string;
    expenseDate: string;
    vendorName: string;
    invoiceNumber: string;
    receiptPath: string;
    approvedBy: string;
  }>,
) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      jobId: jobs.id,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Update the expense in the database (job_expenses has no organizationId - filter by jobId only)
  const { category: categoryVal, ...rest } = data;
  const setData: Partial<typeof jobExpenses.$inferInsert> = {
    ...rest,
    ...(categoryVal !== undefined && {
      category: categoryVal as typeof jobExpenses.$inferSelect.category,
    }),
    approvedAt: data.approvedBy ? new Date() : undefined,
    updatedAt: new Date(),
  };
  const [expense] = await db
    .update(jobExpenses)
    .set(setData)
    .where(
      and(
        eq(jobExpenses.id, id),
        eq(jobExpenses.jobId, jobId),
        eq(jobExpenses.isDeleted, false),
      ),
    )
    .returning();

  return expense || null;
};

export const deleteJobExpense = async (
  id: string,
  jobId: string,
  _organizationId: string,
) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      jobId: jobs.id,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Soft delete the expense (job_expenses has no organizationId)
  const [expense] = await db
    .update(jobExpenses)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobExpenses.id, id),
        eq(jobExpenses.jobId, jobId),
        eq(jobExpenses.isDeleted, false),
      ),
    )
    .returning();

  return expense || null;
};

// ============================
// Job Documents Operations (Placeholder)
// ============================

export const getJobDocuments = async (
  jobId: string,
  _organizationId: string,
) => {
  // Get job with bid info to retrieve the bidId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get documents from the bid
  const documents = await getBidDocuments(jobData.bidId);

  return documents;
};

export const createJobDocument = async (data: {
  jobId: string;
  organizationId: string;
  fileName: string;
  filePath: string;
  fileType?: string;
  fileSize?: number;
  documentType?: string;
  uploadedBy: string;
}) => {
  // Get job with bid info to retrieve the bidId
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, data.jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Create document in the bid
  const document = await createBidDocument({
    bidId: jobData.bidId,
    fileName: data.fileName,
    filePath: data.filePath,
    ...(data.fileType && { fileType: data.fileType }),
    ...(data.fileSize && { fileSize: data.fileSize }),
    ...(data.documentType && { documentType: data.documentType }),
    uploadedBy: data.uploadedBy,
  });

  return document;
};

export const deleteJobDocument = async (
  id: string,
  jobId: string,
  _organizationId: string,
) => {
  // Verify the job exists
  const [jobData] = await db
    .select({
      bidId: jobs.bidId,
    })
    .from(jobs)
    .innerJoin(
      bidsTable,
      and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
    )
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Delete document using bid service
  const document = await deleteBidDocument(id);

  return document;
};

/**
 * Get payment and task progress percentages for a job.
 * - paymentProgressPercent: (total paid from invoices / bid actualTotalPrice) * 100
 * - taskProgressPercent: (completed tasks / total tasks) * 100
 */
export const getJobProgressPercentages = async (
  jobId: string,
  actualTotalPrice: string | null,
): Promise<{ paymentProgressPercent: number; taskProgressPercent: number }> => {
  const [invoiceRow, taskRows] = await Promise.all([
    db
      .select({
        totalPaid: sql<string>`COALESCE(SUM(${invoices.amountPaid}), 0)`,
      })
      .from(invoices)
      .where(and(eq(invoices.jobId, jobId), eq(invoices.isDeleted, false))),
    db
      .select({
        total: count(),
        completed: sql<number>`COUNT(*) FILTER (WHERE ${jobTasks.status} = 'done')`,
      })
      .from(jobTasks)
      .where(and(eq(jobTasks.jobId, jobId), eq(jobTasks.isDeleted, false))),
  ]);

  const totalPaid = parseFloat(invoiceRow[0]?.totalPaid ?? "0");
  const denom = actualTotalPrice ? parseFloat(actualTotalPrice) : 0;
  const paymentProgressPercent =
    denom > 0 ? Math.round((totalPaid / denom) * 100) : 0;

  const taskTotal = Number(taskRows[0]?.total ?? 0);
  const taskCompleted = Number(taskRows[0]?.completed ?? 0);
  const taskProgressPercent =
    taskTotal > 0 ? Math.round((taskCompleted / taskTotal) * 100) : 0;

  return { paymentProgressPercent, taskProgressPercent };
};

/**
 * Get invoice KPIs for a specific job
 * Returns: totalDue, totalInvoiced, invoiceOverdue count, invoicesCreated count
 */
export const getJobInvoiceKPIs = async (jobId: string) => {
  // Validate job exists
  const jobData = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)))
    .limit(1);

  if (!jobData || jobData.length === 0) {
    throw new Error("Job not found");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0]!;

  // Get all invoice metrics in parallel
  const [summaryResult, overdueResult] = await Promise.all([
    // Main summary: total invoiced, total paid, balance due, invoice count
    db
      .select({
        invoicesCreated: count(),
        totalInvoiced: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
        totalPaid: sql<string>`COALESCE(SUM(${invoices.amountPaid}), 0)`,
        totalDue: sql<string>`COALESCE(SUM(${invoices.balanceDue}), 0)`,
      })
      .from(invoices)
      .where(and(eq(invoices.jobId, jobId), eq(invoices.isDeleted, false))),

    // Overdue invoices: due date passed and not fully paid
    db
      .select({
        count: count(),
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.jobId, jobId),
          eq(invoices.isDeleted, false),
          lte(invoices.dueDate, todayStr),
          sql`${invoices.status} NOT IN ('paid', 'cancelled', 'void')`,
        ),
      ),
  ]);

  const summary = summaryResult[0];
  const invoicesCreated = Number(summary?.invoicesCreated ?? 0);
  const totalInvoiced = parseFloat(summary?.totalInvoiced ?? "0");
  const totalDue = parseFloat(summary?.totalDue ?? "0");
  const invoiceOverdue = Number(overdueResult[0]?.count ?? 0);

  return {
    totalDue: parseFloat(totalDue.toFixed(2)),
    totalInvoiced: parseFloat(totalInvoiced.toFixed(2)),
    invoiceOverdue,
    invoicesCreated,
  };
};

/**
 * Get labor cost tracking for a job based on dispatch (planned) and timesheets (actual)
 * Planned: from dispatch_tasks.estimatedDuration (or startTime - endTime) × hourly rates
 * Actual: from payroll_timesheet_entries.jobHours for this job × hourly rates
 */
export const getJobLaborCostTracking = async (jobId: string) => {
  // Validate job exists
  const jobData = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)))
    .limit(1);

  if (!jobData || jobData.length === 0) {
    throw new Error("Job not found");
  }

  // PLANNED COST: Get dispatch tasks for this job with assignments
  const tasksWithAssignments = await db
    .select({
      taskId: dispatchTasks.id,
      startTime: dispatchTasks.startTime,
      endTime: dispatchTasks.endTime,
      estimatedDuration: dispatchTasks.estimatedDuration, // in minutes
      assignmentId: dispatchAssignments.id,
      technicianId: dispatchAssignments.technicianId,
      employeeId: employees.employeeId,
      hourlyRate: employees.hourlyRate,
      fullName: users.fullName,
    })
    .from(dispatchTasks)
    .leftJoin(
      dispatchAssignments,
      and(
        eq(dispatchTasks.id, dispatchAssignments.taskId),
        eq(dispatchAssignments.isDeleted, false),
      ),
    )
    .leftJoin(employees, eq(dispatchAssignments.technicianId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(
      and(eq(dispatchTasks.jobId, jobId), eq(dispatchTasks.isDeleted, false)),
    );

  // Calculate planned cost
  let plannedCostTotal = 0;
  let plannedHoursTotal = 0;

  tasksWithAssignments.forEach((row) => {
    if (row.hourlyRate) {
      let estimatedHours = 0;

      // Use estimatedDuration if available, otherwise calculate from startTime - endTime
      if (row.estimatedDuration) {
        estimatedHours = row.estimatedDuration / 60;
      } else if (row.startTime && row.endTime) {
        const start = new Date(row.startTime);
        const end = new Date(row.endTime);
        estimatedHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }

      if (estimatedHours > 0) {
        const hourlyRate = parseFloat(row.hourlyRate);
        plannedCostTotal += estimatedHours * hourlyRate;
        plannedHoursTotal += estimatedHours;
      }
    }
  });

  // ACTUAL COST: Get actual hours from payroll_timesheet_entries for this job
  const actualJobHours = await db
    .select({
      jobHours: payrollTimesheetEntries.jobHours,
      hoursIncluded: payrollTimesheetEntries.hoursIncluded,
      overtimeHours: payrollTimesheetEntries.overtimeHours,
      doubleOvertimeHours: payrollTimesheetEntries.doubleOvertimeHours,
      timesheetId: payrollTimesheetEntries.timesheetId,
      employeeId: timesheets.employeeId,
      hourlyRate: employees.hourlyRate,
    })
    .from(payrollTimesheetEntries)
    .innerJoin(
      timesheets,
      eq(payrollTimesheetEntries.timesheetId, timesheets.id),
    )
    .innerJoin(employees, eq(timesheets.employeeId, employees.id))
    .where(eq(payrollTimesheetEntries.jobId, jobId));

  let actualCostTotal = 0;
  let totalHours = 0;
  let regularHours = 0;
  let overtimeHours = 0;
  let doubleOTHours = 0;

  actualJobHours.forEach((row) => {
    const jobHrs = parseFloat(row.jobHours || "0");
    const totalTimesheetHrs =
      parseFloat(row.hoursIncluded || "0") +
      parseFloat(row.overtimeHours || "0") +
      parseFloat(row.doubleOvertimeHours || "0");
    const hourlyRate = parseFloat(row.hourlyRate || "0");
    const otRate = hourlyRate * 1.5; // employees table has no overtimeRate; use 1.5x
    const dblOTRate = hourlyRate * 2;

    if (totalTimesheetHrs > 0 && jobHrs > 0) {
      // Calculate proportional breakdown for this job based on timesheet's OT distribution
      const regHrs =
        (parseFloat(row.hoursIncluded || "0") / totalTimesheetHrs) * jobHrs;
      const otHrs =
        (parseFloat(row.overtimeHours || "0") / totalTimesheetHrs) * jobHrs;
      const dblOTHrs =
        (parseFloat(row.doubleOvertimeHours || "0") / totalTimesheetHrs) *
        jobHrs;

      // Accumulate hours
      totalHours += jobHrs;
      regularHours += regHrs;
      overtimeHours += otHrs;
      doubleOTHours += dblOTHrs;

      // Calculate cost
      actualCostTotal +=
        regHrs * hourlyRate + otHrs * otRate + dblOTHrs * dblOTRate;
    } else if (jobHrs > 0) {
      // If no breakdown available, treat all job hours as regular hours
      totalHours += jobHrs;
      regularHours += jobHrs;
      actualCostTotal += jobHrs * hourlyRate;
    }
  });

  // Calculate status
  let status = "Under Budget";
  let statusPercentage = 0;

  if (plannedCostTotal > 0) {
    const variance = actualCostTotal - plannedCostTotal;
    statusPercentage = (variance / plannedCostTotal) * 100;

    if (variance > 0) {
      status = "Over Budget";
    } else if (variance === 0) {
      status = "On Budget";
    }
  }

  // Format hours as "H h: MM m"
  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h} h: ${m.toString().padStart(2, "0")} m`;
  };

  return {
    plannedCost: parseFloat(plannedCostTotal.toFixed(2)),
    plannedHours: formatHours(plannedHoursTotal),
    plannedHoursNumeric: parseFloat(plannedHoursTotal.toFixed(2)),
    actualCost: parseFloat(actualCostTotal.toFixed(2)),
    status,
    statusPercentage: parseFloat(statusPercentage.toFixed(1)),
    totalHours: formatHours(totalHours),
    regularHours: formatHours(regularHours),
    overtimeHours: formatHours(overtimeHours),
    doubleOTHours: formatHours(doubleOTHours),
    totalCost: parseFloat(actualCostTotal.toFixed(2)),
    // Additional metrics
    totalHoursNumeric: parseFloat(totalHours.toFixed(2)),
    regularHoursNumeric: parseFloat(regularHours.toFixed(2)),
    overtimeHoursNumeric: parseFloat(overtimeHours.toFixed(2)),
    doubleOTHoursNumeric: parseFloat(doubleOTHours.toFixed(2)),
  };
};

// ============================
// Jobs KPIs
// ============================

/** Base condition for job KPIs; when options set, restricts to assigned/team jobs (technician view). */
async function jobsKpiBaseCondition(options?: GetJobsFilterOptions) {
  const base = and(eq(jobs.isDeleted, false));
  if (!options?.applyAssignedOrTeamFilter || !options?.userId) return base;

  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.userId, options.userId))
    .limit(1);
  const employeeId = emp?.id ?? null;

  const assignedOrTeamCondition =
    employeeId === null
      ? eq(bidsTable.assignedTo, options.userId)
      : or(
          eq(bidsTable.assignedTo, options.userId),
          sql`EXISTS (SELECT 1 FROM org.job_team_members jtm WHERE jtm.job_id = ${jobs.id} AND jtm.employee_id = ${employeeId} AND jtm.is_active = true)`,
        );
  return and(base, assignedOrTeamCondition);
}

export const getJobsKPIs = async (options?: GetJobsFilterOptions) => {
  const baseCondition = await jobsKpiBaseCondition(options);
  const joinBids = and(
    eq(jobs.bidId, bidsTable.id),
    eq(bidsTable.isDeleted, false),
  );

  // Active jobs (status: in_progress)
  const activeJobsQ = db
    .select({ count: count() })
    .from(jobs)
    .innerJoin(bidsTable, joinBids)
    .where(and(baseCondition, eq(jobs.status, "in_progress")));
  const [activeJobsRow] = options
    ? await activeJobsQ
    : await db
        .select({ count: count() })
        .from(jobs)
        .where(and(eq(jobs.isDeleted, false), eq(jobs.status, "in_progress")));

  // Pending invoices (count invoices where status is pending or sent), scoped to accessible jobs when options set
  let pendingInvoicesRow: { count: number } | undefined;
  if (options) {
    [pendingInvoicesRow] = await db
      .select({ count: count() })
      .from(invoices)
      .innerJoin(jobs, eq(invoices.jobId, jobs.id))
      .innerJoin(bidsTable, joinBids)
      .where(
        and(
          eq(invoices.isDeleted, false),
          or(eq(invoices.status, "pending"), eq(invoices.status, "sent")),
          baseCondition,
        ),
      );
  } else {
    [pendingInvoicesRow] = await db
      .select({ count: count() })
      .from(invoices)
      .where(
        and(
          eq(invoices.isDeleted, false),
          or(eq(invoices.status, "pending"), eq(invoices.status, "sent")),
        ),
      );
  }

  // Total completed jobs (status: completed)
  const completedJobsQ = db
    .select({ count: count() })
    .from(jobs)
    .innerJoin(bidsTable, joinBids)
    .where(and(baseCondition, eq(jobs.status, "completed")));
  const [completedJobsRow] = options
    ? await completedJobsQ
    : await db
        .select({ count: count() })
        .from(jobs)
        .where(and(eq(jobs.isDeleted, false), eq(jobs.status, "completed")));

  // Average profit margin - get from bidsTable
  const avgMarginQ = db
    .select({
      avgProfitMargin: sql<string>`COALESCE(AVG(CAST(${bidsTable.profitMargin} AS NUMERIC)), 0)`,
    })
    .from(jobs)
    .innerJoin(bidsTable, joinBids)
    .where(and(baseCondition, eq(bidsTable.isDeleted, false)));
  const [avgProfitMarginRow] = options
    ? await avgMarginQ
    : await db
        .select({
          avgProfitMargin: sql<string>`COALESCE(AVG(CAST(${bidsTable.profitMargin} AS NUMERIC)), 0)`,
        })
        .from(jobs)
        .innerJoin(
          bidsTable,
          and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)),
        )
        .where(and(eq(jobs.isDeleted, false), eq(bidsTable.isDeleted, false)));

  // Overdue jobs
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueCondition = and(
    eq(jobs.isDeleted, false),
    lte(jobs.scheduledEndDate, today.toISOString().split("T")[0]),
    or(
      eq(jobs.status, "planned"),
      eq(jobs.status, "scheduled"),
      eq(jobs.status, "in_progress"),
      eq(jobs.status, "on_hold"),
    ),
  );
  const overdueJobsQ = db
    .select({ count: count() })
    .from(jobs)
    .innerJoin(bidsTable, joinBids)
    .where(and(baseCondition, overdueCondition));
  const [overdueJobsRow] = options
    ? await overdueJobsQ
    : await db.select({ count: count() }).from(jobs).where(overdueCondition);

  return {
    activeJobs: activeJobsRow?.count ?? 0,
    pendingInvoices: pendingInvoicesRow?.count ?? 0,
    totalCompletedJobs: completedJobsRow?.count ?? 0,
    avgProfitMargin: Number(avgProfitMarginRow?.avgProfitMargin ?? 0),
    overdueJobs: overdueJobsRow?.count ?? 0,
  };
};

// ===========================================================================
// Bulk Delete
// ===========================================================================

export const bulkDeleteJobs = async (ids: string[], deletedBy: string) => {
  const now = new Date();

  const taskRows = await db
    .select({ id: dispatchTasks.id })
    .from(dispatchTasks)
    .where(
      and(
        inArray(dispatchTasks.jobId, ids),
        eq(dispatchTasks.isDeleted, false),
      ),
    );
  const taskIds = taskRows.map((r) => r.id);

  if (taskIds.length > 0) {
    await db
      .update(dispatchAssignments)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          inArray(dispatchAssignments.taskId, taskIds),
          eq(dispatchAssignments.isDeleted, false),
        ),
      );
  }

  await Promise.all([
    db
      .update(dispatchTasks)
      .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
      .where(
        and(
          inArray(dispatchTasks.jobId, ids),
          eq(dispatchTasks.isDeleted, false),
        ),
      ),
    db
      .update(jobTeamMembers)
      .set({ isActive: false })
      .where(inArray(jobTeamMembers.jobId, ids)),
    db
      .update(jobTasks)
      .set({ isDeleted: true, updatedAt: now })
      .where(and(inArray(jobTasks.jobId, ids), eq(jobTasks.isDeleted, false))),
    db
      .update(jobSurveys)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(inArray(jobSurveys.jobId, ids), eq(jobSurveys.isDeleted, false)),
      ),
    db
      .update(jobExpenses)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(inArray(jobExpenses.jobId, ids), eq(jobExpenses.isDeleted, false)),
      ),
    db
      .update(vehicles)
      .set({ currentJobId: null, updatedAt: now })
      .where(inArray(vehicles.currentJobId, ids)),
    db
      .update(checkInOutRecords)
      .set({ jobId: null, updatedAt: now })
      .where(inArray(checkInOutRecords.jobId, ids)),
    db
      .update(assignmentHistory)
      .set({ jobId: null, updatedAt: now })
      .where(inArray(assignmentHistory.jobId, ids)),
  ]);

  const result = await db
    .update(jobs)
    .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
    .where(and(inArray(jobs.id, ids), eq(jobs.isDeleted, false)))
    .returning({ id: jobs.id });
  return { deleted: result.length, skipped: ids.length - result.length };
};
