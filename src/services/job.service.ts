import { count, eq, and, desc, asc, sql, or, ilike } from "drizzle-orm";
import { db } from "../config/db.js";
import {
  jobs,
  jobTeamMembers,
  jobTasks,
  jobExpenses,
} from "../drizzle/schema/jobs.schema.js";
import {
  bidsTable,
  bidFinancialBreakdown,
} from "../drizzle/schema/bids.schema.js";
import { expenseCategories } from "../drizzle/schema/expenses.schema.js";
import { createExpenseFromSource } from "./expense.service.js";
import { employees, positions } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import {
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

export const getJobs = async (
  offset: number,
  limit: number,
  filters?: {
    status?: string;
    priority?: string;
    search?: string;
  },
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

  // Note: assignedTo filter removed - use team members endpoint to filter by assigned employees

  if (filters?.search) {
    whereCondition = and(
      whereCondition,
      or(
        ilike(jobs.jobNumber, `%${filters.search}%`),
        ilike(jobs.description, `%${filters.search}%`),
      ),
    );
  }

  // Get all jobs without organization filter
  const jobsData = await db
    .select({
      job: jobs,
      bid: bidsTable,
      createdByName: users.fullName,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(users, eq(jobs.createdBy, users.id))
    .where(whereCondition)
    .orderBy(desc(jobs.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const totalCountResult = await db
    .select({ count: count() })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(whereCondition);

  const totalCount = totalCountResult[0]?.count || 0;

  // Map jobs and add bid priority and name to each job
  const jobsList = jobsData.map((item) => ({
    ...item.job,
    priority: item.bid.priority, // Use bid priority instead of job priority
    name: item.bid.projectName, // Derive name from bid.projectName
    organizationId: item.bid.organizationId, // Include organization info
    createdByName: item.createdByName || null, // Include created by name
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

export const getJobById = async (id: string) => {
  const [result] = await db
    .select({
      jobs: jobs,
      bid: bidsTable,
      createdByName: users.fullName,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(users, eq(jobs.createdBy, users.id))
    .where(and(eq(jobs.id, id), eq(jobs.isDeleted, false)));
  if (!result) return null;
  // Return job with bid priority and name instead of job priority
  return {
    ...result.jobs,
    priority: result.bid.priority,
    name: result.bid.projectName, // Derive name from bid.projectName
    organizationId: result.bid.organizationId,
    createdByName: result.createdByName || null,
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
  contractValue?: string;
  assignedTeamMembers?: Array<{
    employeeId: number;
    positionId?: number;
  }>;
  createdBy: string;
}) => {
  // Get organizationId from bid
  const [bid] = await db
    .select({ organizationId: bidsTable.organizationId })
    .from(bidsTable)
    .where(eq(bidsTable.id, data.bidId))
    .limit(1);

  if (!bid) {
    throw new Error("Bid not found");
  }

  // Update bid priority if provided
  if (data.priority) {
    const { updateBid } = await import("./bid.service.js");
    await updateBid(data.bidId, bid.organizationId, {
      priority: data.priority,
    });
  }

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
      contractValue: data.contractValue,
    })
    .returning();

  const job = (result as any[])[0];

  // Add team members if provided
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
    contractValue: string;
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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

  // Return job with bid priority and name
  return {
    ...job,
    priority: updatedBid?.priority,
    name: updatedBid?.title || updatedBid?.projectName || updatedBid?.bidNumber, // Derive name from bid
    organizationId: jobData.organizationId,
    createdByName,
  };
};

export const deleteJob = async (id: string) => {
  const [job] = await db
    .update(jobs)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, id), eq(jobs.isDeleted, false)))
    .returning();
  return job;
};

// ============================
// Job Team Members
// ============================

export const getJobTeamMembers = async (jobId: string) => {
  const members = await db
    .select({
      teamMember: jobTeamMembers,
      employee: employees,
      position: positions,
    })
    .from(jobTeamMembers)
    .leftJoin(employees, eq(jobTeamMembers.employeeId, employees.id))
    .leftJoin(positions, eq(jobTeamMembers.positionId, positions.id))
    .innerJoin(jobs, eq(jobTeamMembers.jobId, jobs.id))
    .where(
      and(
        eq(jobTeamMembers.jobId, jobId),
        eq(jobTeamMembers.isActive, true),
        eq(jobs.isDeleted, false),
      ),
    );
  return members;
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
  ] = await Promise.all([
    getBidFinancialBreakdown(jobData.bidId, jobData.organizationId),
    getBidMaterials(jobData.bidId, jobData.organizationId),
    getBidLabor(jobData.bidId),
    getBidOperatingExpenses(jobData.bidId, jobData.organizationId),
    getBidTimeline(jobData.bidId, jobData.organizationId),
    getBidNotes(jobData.bidId, jobData.organizationId),
    getBidHistory(jobData.bidId, jobData.organizationId),
  ]);

  // Get travel for each labor entry
  const travelPromises = labor.map((laborEntry) => getBidTravel(laborEntry.id));
  const travelArrays = await Promise.all(travelPromises);
  const travel = travelArrays.flat();

  // Get bid to include priority
  const [bid] = await db
    .select()
    .from(bidsTable)
    .where(eq(bidsTable.id, jobData.bidId))
    .limit(1);

  return {
    job: {
      ...jobData.job,
      priority: bid?.priority, // Use bid priority instead of job priority
      name: bid?.projectName, // Derive name from bid.projectName
      organizationId: jobData.organizationId,
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
  };
};

// ============================
// Utility Functions
// ============================

const generateJobNumber = async (organizationId: string): Promise<string> => {
  try {
    // Try to use atomic database function first
    const result = await db.execute<{ next_value: string }>(
      sql.raw(
        `SELECT org.get_next_counter('${organizationId}'::uuid, 'job_number') as next_value`,
      ),
    );

    const nextNumber = parseInt(result.rows[0]?.next_value || "1");
    return `JOB-${nextNumber.toString().padStart(5, "0")}`;
  } catch (error) {
    // Fallback to manual counter if database function doesn't exist
    console.warn("Counter function not found, using fallback method:", error);

    // Get the highest existing job number for this organization
    const maxResult = await db
      .select({ maxJobNumber: sql<string>`MAX(${jobs.jobNumber})` })
      .from(jobs)
      .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(
        and(
          eq(bidsTable.organizationId, organizationId),
          eq(jobs.isDeleted, false),
          sql`${jobs.jobNumber} ~ '^JOB-\\d+$'`, // Only count properly formatted job numbers
        ),
      );

    let nextNumber = 1;
    const maxJobNumber = maxResult[0]?.maxJobNumber;
    if (maxJobNumber) {
      const match = maxJobNumber.match(/^JOB-(\d+)$/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `JOB-${nextNumber.toString().padStart(5, "0")}`;
  }
};

export const checkJobNumberExists = async (
  jobNumber: string,
  organizationId: string,
): Promise<boolean> => {
  const [result] = await db
    .select({ count: count() })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
      .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get timeline events from the bid
  const timeline = await getBidTimeline(jobData.bidId, jobData.organizationId);

  return timeline;
};

export const createJobTimelineEvent = async (data: {
  jobId: string;
  organizationId: string;
  event: string;
  eventDate: string;
  status?: string;
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, data.jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Create timeline event in the bid
  const timelineEvent = await createBidTimelineEvent({
    bidId: jobData.bidId,
    organizationId: jobData.organizationId,
    event: data.event,
    eventDate: data.eventDate,
    ...(data.status && { status: data.status }),
    ...(data.description && { description: data.description }),
    ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    ...(data.createdBy && { createdBy: data.createdBy }),
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get the timeline event from the bid
  const timelineEvent = await getBidTimelineEventById(
    eventId,
    jobData.organizationId,
  );

  return timelineEvent;
};

export const updateJobTimelineEvent = async (
  id: string,
  jobId: string,
  organizationId: string,
  data: Partial<{
    event: string;
    eventDate: string;
    status: string;
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Update timeline event using bid service
  const timelineEvent = await updateBidTimelineEvent(
    id,
    jobData.organizationId,
    data,
  );

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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Delete timeline event using bid service
  const timelineEvent = await deleteBidTimelineEvent(
    id,
    jobData.organizationId,
  );

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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get notes from the bid
  const notes = await getBidNotes(jobData.bidId, jobData.organizationId);

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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, data.jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Create note in the bid
  const note = await createBidNote({
    bidId: jobData.bidId,
    organizationId: jobData.organizationId,
    note: data.note,
    ...(data.isInternal !== undefined && { isInternal: data.isInternal }),
    createdBy: data.createdBy,
  });

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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get the note from the bid
  const note = await getBidNoteById(noteId, jobData.organizationId);

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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Update note using bid service
  const note = await updateBidNote(id, jobData.organizationId, data);

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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Delete note using bid service
  const note = await deleteBidNote(id, jobData.organizationId);

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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
  const history = await getBidHistory(jobData.bidId, jobData.organizationId);

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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
// Job Tasks Operations (Placeholder)
// ============================

export const getJobTasks = async (jobId: string) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      jobId: jobs.id,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get tasks for this job
  const tasks = await db
    .select()
    .from(jobTasks)
    .where(
      and(
        eq(jobTasks.jobId, jobId),
        eq(jobTasks.organizationId, jobData.organizationId),
        eq(jobTasks.isDeleted, false),
      ),
    )
    .orderBy(asc(jobTasks.sortOrder), asc(jobTasks.dueDate));

  return tasks;
};

export const getJobTaskById = async (jobId: string, taskId: string) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      jobId: jobs.id,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Get the task from the job_tasks table
  const [task] = await db
    .select()
    .from(jobTasks)
    .where(
      and(
        eq(jobTasks.id, taskId),
        eq(jobTasks.jobId, jobId),
        eq(jobTasks.organizationId, jobData.organizationId),
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
}) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      jobId: jobs.id,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, data.jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Create the task in the database
  const [task] = await db
    .insert(jobTasks)
    .values({
      jobId: data.jobId,
      organizationId: jobData.organizationId,
      taskName: data.taskName,
      description: data.description,
      status: (data.status as any) || "pending",
      priority: data.priority || "medium",
      assignedTo: data.assignedTo || null,
      dueDate: data.dueDate || null,
      estimatedHours: data.estimatedHours || null,
      sortOrder: data.sortOrder || 0,
      createdBy: data.createdBy,
    })
    .returning();

  return task;
};

export const updateJobTask = async (
  id: string,
  jobId: string,
  organizationId: string,
  data: Partial<{
    taskName: string;
    description: string;
    status: string;
    priority: string;
    assignedTo: string;
    dueDate: string;
    completedDate: string;
    estimatedHours: string;
    actualHours: string;
    sortOrder: number;
  }>,
) => {
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      jobId: jobs.id,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Update the task in the database
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
        eq(jobTasks.organizationId, jobData.organizationId),
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
  // Get job with bid info to retrieve the bid's organizationId
  const [jobData] = await db
    .select({
      jobId: jobs.id,
      organizationId: bidsTable.organizationId,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Soft delete the task
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
        eq(jobTasks.organizationId, jobData.organizationId),
        eq(jobTasks.isDeleted, false),
      ),
    )
    .returning();

  return task || null;
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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

async function getDefaultExpenseCategoryId(): Promise<string> {
  const [row] = await db
    .select({ id: expenseCategories.id })
    .from(expenseCategories)
    .limit(1);
  if (!row?.id) throw new Error("No expense category found");
  return row.id;
}

export const createJobExpense = async (data: {
  jobId: string;
  expenseType: string;
  expenseCategoryId?: string;
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, data.jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Create the expense in the database (job_expenses has no organizationId column)
  const [expense] = await db
    .insert(jobExpenses)
    .values({
      jobId: data.jobId,
      expenseCategoryId:
        data.expenseCategoryId ?? (await getDefaultExpenseCategoryId()),
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
    const categoryId =
      data.expenseCategoryId ?? (await getDefaultExpenseCategoryId());
    await createExpenseFromSource({
      sourceId: expense.id,
      jobId: data.jobId,
      categoryId,
      expenseType: data.expenseType,
      amount: data.amount,
      expenseDate: data.expenseDate,
      description: data.description,
      title: data.expenseType,
      vendor: data.vendorName ?? null,
      createdBy: data.createdBy,
      source: "job",
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
    expenseCategoryId: string;
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Update the expense in the database (job_expenses has no organizationId - filter by jobId only)
  const [expense] = await db
    .update(jobExpenses)
    .set({
      ...data,
      approvedAt: data.approvedBy ? new Date() : undefined,
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.isDeleted, false)));

  if (!jobData) {
    return null;
  }

  // Delete document using bid service
  const document = await deleteBidDocument(id);

  return document;
};
