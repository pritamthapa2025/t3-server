import { count, eq, and, desc, asc, max, sql, or, ilike } from "drizzle-orm";
import { db } from "../config/db.js";
import {
  jobs,
  jobTeamMembers,
} from "../drizzle/schema/jobs.schema.js";
import { 
  bidsTable,
  bidFinancialBreakdown,
  bidMaterials,
  bidLabor,
  bidTravel,
  bidOperatingExpenses,
  bidTimeline,
  bidDocuments,
  bidNotes,
  bidHistory,
} from "../drizzle/schema/bids.schema.js";
import { organizations } from "../drizzle/schema/client.schema.js";
import { employees, positions } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
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
  organizationId: string,
  offset: number,
  limit: number,
  filters?: {
    status?: string;
    priority?: string;
    assignedTo?: string;
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
    whereCondition = and(whereCondition, eq(jobs.priority, filters.priority as any));
  }

  if (filters?.assignedTo) {
    whereCondition = and(
      whereCondition,
      or(
        eq(jobs.projectManager, filters.assignedTo),
        eq(jobs.leadTechnician, filters.assignedTo)
      )
    );
  }

  if (filters?.search) {
    whereCondition = and(
      whereCondition,
      or(
        ilike(jobs.name, `%${filters.search}%`),
        ilike(jobs.jobNumber, `%${filters.search}%`),
        ilike(jobs.description, `%${filters.search}%`)
      )
    );
  }

  // Get jobs with bid organization filter
  const jobsData = await db
    .select({
      job: jobs,
      bid: bidsTable,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        whereCondition,
        eq(bidsTable.organizationId, organizationId)
      )
    )
    .orderBy(desc(jobs.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const totalCountResult = await db
    .select({ count: count() })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        whereCondition,
        eq(bidsTable.organizationId, organizationId)
      )
    );
  
  const totalCount = totalCountResult[0]?.count || 0;

  const jobsList = jobsData.map(item => item.job);
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

export const getJobById = async (id: string, organizationId: string) => {
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
        eq(bidsTable.organizationId, organizationId),
        eq(jobs.isDeleted, false)
      )
    );
  return result?.jobs || null;
};

export const createJob = async (data: {
  name: string;
  status?: string;
  priority?: string;
  jobType?: string;
  serviceType?: string;
  bidId: string; // Now required
  description?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  siteAddress?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  accessInstructions?: string;
  contractValue?: string;
  projectManager?: string;
  leadTechnician?: string;
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

  // Generate job number atomically
  const jobNumber = await generateJobNumber(bid.organizationId);

  // Insert job
  const result = await db
    .insert(jobs)
    .values({
      jobNumber,
      name: data.name,
      createdBy: data.createdBy,
      status: (data.status as any) || "planned",
      priority: (data.priority as any) || "medium",
      jobType: data.jobType,
      serviceType: data.serviceType,
      bidId: data.bidId,
      description: data.description,
      scheduledStartDate: data.scheduledStartDate
        ? new Date(data.scheduledStartDate).toISOString().split("T")[0]
        : null,
      scheduledEndDate: data.scheduledEndDate
        ? new Date(data.scheduledEndDate).toISOString().split("T")[0]
        : null,
      siteAddress: data.siteAddress,
      siteContactName: data.siteContactName,
      siteContactPhone: data.siteContactPhone,
      accessInstructions: data.accessInstructions,
      contractValue: data.contractValue,
      projectManager: data.projectManager,
      leadTechnician: data.leadTechnician,
    })
    .returning();

  const job = (result as any[])[0];
  return job;
};

export const updateJob = async (
  id: string,
  organizationId: string,
  data: Partial<{
    name: string;
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
    projectManager: string;
    leadTechnician: string;
    completionNotes: string;
    completionPercentage: string;
  }>
) => {
  const [job] = await db
    .update(jobs)
    .set({
      ...data,
      scheduledStartDate: data.scheduledStartDate
        ? new Date(data.scheduledStartDate).toISOString().split("T")[0]
        : undefined,
      scheduledEndDate: data.scheduledEndDate
        ? new Date(data.scheduledEndDate).toISOString().split("T")[0]
        : undefined,
      actualStartDate: data.actualStartDate
        ? new Date(data.actualStartDate).toISOString().split("T")[0]
        : undefined,
      actualEndDate: data.actualEndDate
        ? new Date(data.actualEndDate).toISOString().split("T")[0]
        : undefined,
      updatedAt: new Date(),
    })
    .from(bidsTable)
    .where(
      and(
        eq(jobs.id, id),
        eq(jobs.bidId, bidsTable.id),
        eq(bidsTable.organizationId, organizationId),
        eq(jobs.isDeleted, false)
      )
    )
    .returning();
  return job;
};

export const deleteJob = async (id: string, organizationId: string) => {
  const [job] = await db
    .update(jobs)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .from(bidsTable)
    .where(
      and(
        eq(jobs.id, id),
        eq(jobs.bidId, bidsTable.id),
        eq(bidsTable.organizationId, organizationId),
        eq(jobs.isDeleted, false)
      )
    )
    .returning();
  return job;
};

// ============================
// Job Team Members
// ============================

export const getJobTeamMembers = async (jobId: string, organizationId: string) => {
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
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        eq(jobTeamMembers.jobId, jobId),
        eq(bidsTable.organizationId, organizationId),
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
  employeeId: number,
  organizationId: string
) => {
  const [member] = await db
    .update(jobTeamMembers)
    .set({
      isActive: false,
      removedDate: new Date().toISOString().split("T")[0],
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        eq(jobTeamMembers.jobId, jobId),
        eq(jobTeamMembers.employeeId, employeeId),
        eq(jobs.id, jobId),
        eq(bidsTable.organizationId, organizationId),
        eq(jobTeamMembers.isActive, true)
      )
    )
    .returning();
  return member;
};

// ============================
// Job with All Data (from Bid)
// ============================

export const getJobWithAllData = async (jobId: string, organizationId: string) => {
  // Get job with bid info
  const [jobData] = await db
    .select({
      job: jobs,
      bidId: jobs.bidId,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        eq(jobs.id, jobId),
        eq(bidsTable.organizationId, organizationId),
        eq(jobs.isDeleted, false)
      )
    );

  if (!jobData) {
    throw new Error("Job not found");
  }

  // Get team members (job-specific)
  const teamMembers = await getJobTeamMembers(jobId, organizationId);

  // Fetch all data from bid tables using job.bidId
  const [
    financialBreakdown,
    materials,
    labor,
    operatingExpenses,
    timeline,
    notes,
    history
  ] = await Promise.all([
    getBidFinancialBreakdown(jobData.bidId, organizationId),
    getBidMaterials(jobData.bidId, organizationId),
    getBidLabor(jobData.bidId),
    getBidOperatingExpenses(jobData.bidId, organizationId),
    getBidTimeline(jobData.bidId, organizationId),
    getBidNotes(jobData.bidId, organizationId),
    getBidHistory(jobData.bidId, organizationId)
  ]);

  // Get travel for each labor entry
  const travelPromises = labor.map((laborEntry) => getBidTravel(laborEntry.id));
  const travelArrays = await Promise.all(travelPromises);
  const travel = travelArrays.flat();

  return {
    job: jobData.job,
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
    // Use atomic counter from organization
    const result = await db.execute(
      sql`SELECT org.get_next_counter(${organizationId}, 'job') as next_number`
    );
    
    const nextNumber = (result as any)[0]?.next_number;
    if (!nextNumber) {
      throw new Error("Failed to generate job number");
    }

    return `JOB-${nextNumber.toString().padStart(5, "0")}`;
  } catch (error) {
    console.error("Error generating job number:", error);
    throw new Error("Failed to generate job number");
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

  return result[0] || null;
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
  const jobData = await getJobById(jobId, organizationId);
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

export const getJobMaterials = async (jobId: string, organizationId: string) => {
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

export const deleteJobMaterial = async (id: string, jobId: string, organizationId: string) => {
  // Placeholder - would need a job_materials table
  return { id, isDeleted: true, updatedAt: new Date() };
};

// ============================
// Job Labor Operations (Placeholder)
// ============================

export const getJobLabor = async (jobId: string, organizationId: string) => {
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

export const deleteJobLabor = async (id: string, jobId: string, organizationId: string) => {
  return { id, isDeleted: true, updatedAt: new Date() };
};

// ============================
// Job Travel Operations (Placeholder)
// ============================

export const getJobTravel = async (jobId: string, organizationId: string) => {
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

export const deleteJobTravel = async (id: string, jobId: string, organizationId: string) => {
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

export const getJobTimeline = async (jobId: string, organizationId: string) => {
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

export const deleteJobTimelineEvent = async (id: string, jobId: string, organizationId: string) => {
  return { id, isDeleted: true, updatedAt: new Date() };
};

// ============================
// Job Notes Operations (Placeholder)
// ============================

export const getJobNotes = async (jobId: string, organizationId: string) => {
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

export const deleteJobNote = async (id: string, jobId: string, organizationId: string) => {
  return { id, isDeleted: true, updatedAt: new Date() };
};

// ============================
// Job History Operations (Placeholder)
// ============================

export const getJobHistory = async (jobId: string, organizationId: string) => {
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

export const getJobTasks = async (jobId: string, organizationId: string) => {
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

export const deleteJobTask = async (id: string, jobId: string, organizationId: string) => {
  return { id, isDeleted: true, updatedAt: new Date() };
};

// ============================
// Job Expenses Operations (Placeholder)
// ============================

export const getJobExpenses = async (jobId: string, organizationId: string) => {
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

export const deleteJobExpense = async (id: string, jobId: string, organizationId: string) => {
  return { id, isDeleted: true, updatedAt: new Date() };
};

// ============================
// Job Documents Operations (Placeholder)
// ============================

export const getJobDocuments = async (jobId: string, organizationId: string) => {
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

export const deleteJobDocument = async (id: string, jobId: string, organizationId: string) => {
  return { id, isDeleted: true, updatedAt: new Date() };
};