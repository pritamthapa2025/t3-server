import { count, eq, and, desc, sql, or, ilike } from "drizzle-orm";
import { db } from "../config/db.js";
import {
  jobs,
  jobTeamMembers,
} from "../drizzle/schema/jobs.schema.js";
import { 
  bidsTable,
  bidFinancialBreakdown,
} from "../drizzle/schema/bids.schema.js";
import { employees, positions } from "../drizzle/schema/org.schema.js";
import { 
  getBidFinancialBreakdown,
  getBidOperatingExpenses,
  getBidMaterials,
  getBidLabor,
  getBidTravel,
  getBidTimeline,
  getBidNotes,
  getBidHistory,
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
  }
) => {
  let whereCondition = and(
    eq(jobs.isDeleted, false)
  );

  // Add filters
  if (filters?.status) {
    whereCondition = and(whereCondition, eq(jobs.status, filters.status as any));
  }

  if (filters?.priority) {
    whereCondition = and(whereCondition, eq(bidsTable.priority, filters.priority as any));
  }

  // Note: assignedTo filter removed - use team members endpoint to filter by assigned employees

  if (filters?.search) {
    whereCondition = and(
      whereCondition,
      or(
        ilike(jobs.jobNumber, `%${filters.search}%`),
        ilike(jobs.description, `%${filters.search}%`)
      )
    );
  }

  // Get all jobs without organization filter
  const jobsData = await db
    .select({
      job: jobs,
      bid: bidsTable,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
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
  const jobsList = jobsData.map(item => ({
    ...item.job,
    priority: item.bid.priority, // Use bid priority instead of job priority
    name: item.bid.projectName, // Derive name from bid.projectName
    organizationId: item.bid.organizationId, // Include organization info
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
      totalPages: Math.ceil(totalCount / limit)
    }
  };
};

export const getJobById = async (id: string) => {
  const [result] = await db
    .select({
      jobs: jobs,
      bid: bidsTable,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        eq(jobs.id, id),
        eq(jobs.isDeleted, false)
      )
    );
  if (!result) return null;
  // Return job with bid priority and name instead of job priority
  return {
    ...result.jobs,
    priority: result.bid.priority,
    name: result.bid.projectName, // Derive name from bid.projectName
    organizationId: result.bid.organizationId,
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
    await updateBid(data.bidId, bid.organizationId, { priority: data.priority });
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
      scheduledStartDate: new Date(data.scheduledStartDate).toISOString().split("T")[0],
      scheduledEndDate: new Date(data.scheduledEndDate).toISOString().split("T")[0],
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
          ...(member.positionId !== undefined && { positionId: member.positionId }),
        })
      )
    );
  }
  
  // Get updated bid to include priority in response
  const [updatedBid] = await db
    .select()
    .from(bidsTable)
    .where(eq(bidsTable.id, data.bidId))
    .limit(1);
  
  // Return job with bid priority and name
  return {
    ...job,
    priority: updatedBid?.priority,
    name: updatedBid?.projectName, // Derive name from bid.projectName
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
  }>
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
    .where(
      and(
        eq(jobs.id, id),
        eq(jobs.isDeleted, false)
      )
    )
    .limit(1);

  if (!jobData) {
    return null;
  }

  // Update bid priority if provided
  if (data.priority !== undefined) {
    const { updateBid } = await import("./bid.service.js");
    await updateBid(jobData.bidId, jobData.organizationId, { priority: data.priority });
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
    .where(
      and(
        eq(jobs.id, id),
        eq(jobs.isDeleted, false)
      )
    )
    .returning();
  
  if (!job) return null;

  // Get updated bid to include priority in response
  const [updatedBid] = await db
    .select()
    .from(bidsTable)
    .where(eq(bidsTable.id, jobData.bidId))
    .limit(1);

  // Return job with bid priority and name
  return {
    ...job,
    priority: updatedBid?.priority,
    name: updatedBid?.title || updatedBid?.projectName || updatedBid?.bidNumber, // Derive name from bid
    organizationId: jobData.organizationId,
  };
};

export const deleteJob = async (id: string) => {
  const [job] = await db
    .update(jobs)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobs.id, id),
        eq(jobs.isDeleted, false)
      )
    )
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
        eq(jobs.isDeleted, false)
      )
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
  employeeId: number
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
        eq(jobTeamMembers.isActive, true)
      )
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
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.isDeleted, false)
      )
    );

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
    history
  ] = await Promise.all([
    getBidFinancialBreakdown(jobData.bidId, jobData.organizationId),
    getBidMaterials(jobData.bidId, jobData.organizationId),
    getBidLabor(jobData.bidId),
    getBidOperatingExpenses(jobData.bidId, jobData.organizationId),
    getBidTimeline(jobData.bidId, jobData.organizationId),
    getBidNotes(jobData.bidId, jobData.organizationId),
    getBidHistory(jobData.bidId, jobData.organizationId)
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
    history
  };
};

// ============================
// Utility Functions
// ============================

const generateJobNumber = async (organizationId: string): Promise<string> => {
  try {
    // Try to use atomic database function first
    const result = await db.execute<{ next_value: string }>(
      sql.raw(`SELECT org.get_next_counter('${organizationId}'::uuid, 'job_number') as next_value`)
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
          sql`${jobs.jobNumber} ~ '^JOB-\\d+$'` // Only count properly formatted job numbers
        )
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
  organizationId: string
): Promise<boolean> => {
  const [result] = await db
    .select({ count: count() })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        eq(jobs.jobNumber, jobNumber),
        eq(bidsTable.organizationId, organizationId),
        eq(jobs.isDeleted, false)
      )
    );
  return (result?.count ?? 0) > 0;
};

// ============================
// Job Financial Operations
// ============================

export const getJobFinancialSummary = async (jobId: string, organizationId: string) => {
  const result = await db
    .select({
      job: jobs,
      bid: bidsTable,
      financialBreakdown: bidFinancialBreakdown,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(bidFinancialBreakdown, eq(bidsTable.id, bidFinancialBreakdown.bidId))
    .where(
      and(
        eq(jobs.id, jobId),
        eq(bidsTable.organizationId, organizationId),
        eq(jobs.isDeleted, false)
      )
    );

  if (!result[0]) return null;

  // Include bid priority and name in job object for consistency
  return {
    ...result[0],
    job: {
      ...result[0].job,
      priority: result[0].bid.priority,
      name: result[0].bid.projectName, // Derive name from bid.projectName
    },
  };
};

export const updateJobFinancialSummary = async (
  jobId: string,
  organizationId: string,
  data: {
    materialsEquipment?: string;
    labor?: string;
    travel?: string;
    operatingExpenses?: string;
  }
) => {
  // Get the job's bid
  const jobData = await getJobById(jobId);
  if (!jobData) return null;

  // Update the bid's financial breakdown
  const result = await db
    .update(bidFinancialBreakdown)
    .set({
      ...data,
      totalCost: sql`CAST(COALESCE(${data.materialsEquipment || '0'}, '0') AS NUMERIC) + 
                     CAST(COALESCE(${data.labor || '0'}, '0') AS NUMERIC) + 
                     CAST(COALESCE(${data.travel || '0'}, '0') AS NUMERIC) + 
                     CAST(COALESCE(${data.operatingExpenses || '0'}, '0') AS NUMERIC)`,
      updatedAt: new Date(),
    })
    .where(eq(bidFinancialBreakdown.bidId, jobData.bidId))
    .returning();

  return result[0];
};

export const getJobPlannedFinancialBreakdown = async (jobId: string, organizationId: string) => {
  return await getJobFinancialSummary(jobId, organizationId);
};

// ============================
// Job Materials Operations (Placeholder - would need materials table)
// ============================

export const getJobMaterials = async (_jobId: string, _organizationId: string) => {
  // Placeholder - would need a job_materials table
  return [];
};

export const createJobMaterial = async (data: {
  jobId: string;
  organizationId: string;
  materialName: string;
  quantity: number;
  unitCost: string;
  totalCost: string;
}) => {
  // Placeholder - would need a job_materials table
  return { id: "placeholder", ...data, createdAt: new Date() };
};

export const updateJobMaterial = async (
  id: string,
  jobId: string,
  organizationId: string,
  data: Partial<{
    materialName: string;
    quantity: number;
    unitCost: string;
    totalCost: string;
  }>
) => {
  // Placeholder - would need a job_materials table
  return { id, ...data, updatedAt: new Date() };
};

export const deleteJobMaterial = async (id: string, _jobId: string, _organizationId: string) => {
  // Placeholder - would need a job_materials table
  return { id, isDeleted: true, updatedAt: new Date() };
};

// ============================
// Job Labor Operations (Placeholder)
// ============================

export const getJobLabor = async (_jobId: string, _organizationId: string) => {
  return [];
};

export const createJobLabor = async (data: {
  jobId: string;
  organizationId: string;
  employeeId: string;
  hours: number;
  hourlyRate: string;
  totalCost: string;
}) => {
  return { id: "placeholder", ...data, createdAt: new Date() };
};

export const updateJobLabor = async (
  id: string,
  jobId: string,
  organizationId: string,
  data: Partial<{
    employeeId: string;
    hours: number;
    hourlyRate: string;
    totalCost: string;
  }>
) => {
  return { id, ...data, updatedAt: new Date() };
};

export const deleteJobLabor = async (id: string, _jobId: string, _organizationId: string) => {
  return { id, isDeleted: true, updatedAt: new Date() };
};

// ============================
// Job Travel Operations (Placeholder)
// ============================

export const getJobTravel = async (_jobId: string, _organizationId: string) => {
  return [];
};

export const createJobTravel = async (data: {
  jobId: string;
  organizationId: string;
  description: string;
  distance?: number;
  cost: string;
}) => {
  return { id: "placeholder", ...data, createdAt: new Date() };
};

export const updateJobTravel = async (
  id: string,
  jobId: string,
  organizationId: string,
  data: Partial<{
    description: string;
    distance: number;
    cost: string;
  }>
) => {
  return { id, ...data, updatedAt: new Date() };
};

export const deleteJobTravel = async (id: string, _jobId: string, _organizationId: string) => {
  return { id, isDeleted: true, updatedAt: new Date() };
};

export const getJobPlannedOperatingExpenses = async (jobId: string, organizationId: string) => {
  // Return operating expenses from the financial breakdown
  const financial = await getJobFinancialSummary(jobId, organizationId);
  return {
    operatingExpenses: financial?.financialBreakdown?.operatingExpenses || "0",
    breakdown: [] // Placeholder for detailed breakdown
  };
};

// ============================
// Job Timeline Operations (Placeholder)
// ============================

export const getJobTimeline = async (_jobId: string, _organizationId: string) => {
  return [];
};

export const createJobTimelineEvent = async (data: {
  jobId: string;
  organizationId: string;
  eventName: string;
  eventDate: string;
  description?: string;
}) => {
  return { id: "placeholder", ...data, createdAt: new Date() };
};

export const updateJobTimelineEvent = async (
  id: string,
  jobId: string,
  organizationId: string,
  data: Partial<{
    eventName: string;
    eventDate: string;
    description: string;
  }>
) => {
  return { id, ...data, updatedAt: new Date() };
};

export const deleteJobTimelineEvent = async (id: string, _jobId: string, _organizationId: string) => {
  return { id, isDeleted: true, updatedAt: new Date() };
};

// ============================
// Job Notes Operations (Placeholder)
// ============================

export const getJobNotes = async (_jobId: string, _organizationId: string) => {
  return [];
};

export const createJobNote = async (data: {
  jobId: string;
  organizationId: string;
  title: string;
  content: string;
  createdBy: string;
}) => {
  return { id: "placeholder", ...data, createdAt: new Date() };
};

export const updateJobNote = async (
  id: string,
  jobId: string,
  organizationId: string,
  data: Partial<{
    title: string;
    content: string;
  }>
) => {
  return { id, ...data, updatedAt: new Date() };
};

export const deleteJobNote = async (id: string, _jobId: string, _organizationId: string) => {
  return { id, isDeleted: true, updatedAt: new Date() };
};

// ============================
// Job History Operations (Placeholder)
// ============================

export const getJobHistory = async (_jobId: string, _organizationId: string) => {
  return [];
};

export const createJobHistoryEntry = async (data: {
  jobId: string;
  organizationId: string;
  action: string;
  description: string;
  createdBy: string;
}) => {
  return { id: "placeholder", ...data, createdAt: new Date() };
};

// ============================
// Job Tasks Operations (Placeholder)
// ============================

export const getJobTasks = async (_jobId: string, _organizationId: string) => {
  return [];
};

export const createJobTask = async (data: {
  jobId: string;
  organizationId: string;
  taskName: string;
  description?: string;
  assignedTo?: string;
  dueDate?: string;
}) => {
  return { id: "placeholder", ...data, createdAt: new Date() };
};

export const updateJobTask = async (
  id: string,
  jobId: string,
  organizationId: string,
  data: Partial<{
    taskName: string;
    description: string;
    assignedTo: string;
    dueDate: string;
    status: string;
  }>
) => {
  return { id, ...data, updatedAt: new Date() };
};

export const deleteJobTask = async (id: string, _jobId: string, _organizationId: string) => {
  return { id, isDeleted: true, updatedAt: new Date() };
};

// ============================
// Job Expenses Operations (Placeholder)
// ============================

export const getJobExpenses = async (_jobId: string, _organizationId: string) => {
  return [];
};

export const createJobExpense = async (data: {
  jobId: string;
  organizationId: string;
  expenseName: string;
  amount: string;
  category?: string;
  date?: string;
}) => {
  return { id: "placeholder", ...data, createdAt: new Date() };
};

export const updateJobExpense = async (
  id: string,
  jobId: string,
  organizationId: string,
  data: Partial<{
    expenseName: string;
    amount: string;
    category: string;
    date: string;
  }>
) => {
  return { id, ...data, updatedAt: new Date() };
};

export const deleteJobExpense = async (id: string, _jobId: string, _organizationId: string) => {
  return { id, isDeleted: true, updatedAt: new Date() };
};

// ============================
// Job Documents Operations (Placeholder)
// ============================

export const getJobDocuments = async (_jobId: string, _organizationId: string) => {
  return [];
};

export const createJobDocument = async (data: {
  jobId: string;
  organizationId: string;
  documentName: string;
  filePath: string;
  uploadedBy: string;
}) => {
  return { id: "placeholder", ...data, createdAt: new Date() };
};

export const deleteJobDocument = async (id: string, _jobId: string, _organizationId: string) => {
  return { id, isDeleted: true, updatedAt: new Date() };
};


