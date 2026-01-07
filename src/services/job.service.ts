import { count, eq, and, desc, asc, max, sql, or, ilike } from "drizzle-orm";
import { db } from "../config/db.js";
import {
  jobs,
  jobTeamMembers,
  jobFinancialSummary,
  jobFinancialBreakdown,
  jobMaterials,
  jobLabor,
  jobTravel,
  jobOperatingExpenses,
  jobTimeline,
  jobDocuments,
  jobNotes,
  jobHistory,
  jobTasks,
  jobExpenses,
} from "../drizzle/schema/jobs.schema.js";

// ============================
// Main Job Operations
// ============================

export const getJobs = async (
  organizationId: string,
  offset: number,
  limit: number,
  filters?: {
    status?: string;
    jobType?: string;
    priority?: string;
    projectManager?: string;
    leadTechnician?: string;
    search?: string;
  }
) => {
  let whereCondition = and(
    eq(jobs.organizationId, organizationId),
    eq(jobs.isDeleted, false)
  );

  if (filters?.status) {
    whereCondition = and(
      whereCondition,
      eq(jobs.status, filters.status as any)
    );
  }
  if (filters?.jobType) {
    whereCondition = and(
      whereCondition,
      eq(jobs.jobType, filters.jobType)
    );
  }
  if (filters?.priority) {
    whereCondition = and(
      whereCondition,
      eq(jobs.priority, filters.priority as any)
    );
  }
  if (filters?.projectManager) {
    whereCondition = and(
      whereCondition,
      eq(jobs.projectManager, filters.projectManager)
    );
  }
  if (filters?.leadTechnician) {
    whereCondition = and(
      whereCondition,
      eq(jobs.leadTechnician, filters.leadTechnician)
    );
  }
  if (filters?.search) {
    whereCondition = and(
      whereCondition,
      or(
        ilike(jobs.name, `%${filters.search}%`),
        ilike(jobs.jobNumber, `%${filters.search}%`),
        ilike(jobs.siteAddress, `%${filters.search}%`),
        ilike(jobs.description, `%${filters.search}%`)
      )!
    );
  }

  const result = await db
    .select()
    .from(jobs)
    .where(whereCondition)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(jobs.createdAt));

  const totalCount = await db
    .select({ count: count() })
    .from(jobs)
    .where(whereCondition);

  const total = totalCount[0]?.count ?? 0;

  return {
    data: result || [],
    total: total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit: limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getJobById = async (id: string, organizationId: string) => {
  const [job] = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.id, id),
        eq(jobs.organizationId, organizationId),
        eq(jobs.isDeleted, false)
      )
    );
  return job || null;
};

export const createJob = async (data: {
  organizationId: string;
  name: string;
  status?: string;
  priority?: string;
  jobType?: string;
  serviceType?: string;
  propertyId?: string;
  bidId?: string;
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
  // Generate job number atomically
  const jobNumber = await generateJobNumber(data.organizationId);

  // Insert job
  const result = await db
    .insert(jobs)
    .values({
      jobNumber,
      name: data.name,
      organizationId: data.organizationId,
      createdBy: data.createdBy,
      status: (data.status as any) || "planned",
      priority: (data.priority as any) || "medium",
      jobType: data.jobType,
      serviceType: data.serviceType,
      propertyId: data.propertyId,
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

  // Create related records
  if (job) {
    await createRelatedRecords(job.id, data.organizationId);
  }

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
    propertyId: string;
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
      name: data.name,
      status: data.status as any,
      priority: data.priority as any,
      jobType: data.jobType,
      serviceType: data.serviceType,
      propertyId: data.propertyId,
      description: data.description,
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
      siteAddress: data.siteAddress,
      siteContactName: data.siteContactName,
      siteContactPhone: data.siteContactPhone,
      accessInstructions: data.accessInstructions,
      contractValue: data.contractValue,
      actualCost: data.actualCost,
      projectManager: data.projectManager,
      leadTechnician: data.leadTechnician,
      completionNotes: data.completionNotes,
      completionPercentage: data.completionPercentage,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobs.id, id),
        eq(jobs.organizationId, organizationId),
        eq(jobs.isDeleted, false)
      )
    )
    .returning();

  return job || null;
};

export const deleteJob = async (id: string, organizationId: string) => {
  const [job] = await db
    .update(jobs)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobs.id, id),
        eq(jobs.organizationId, organizationId),
        eq(jobs.isDeleted, false)
      )
    )
    .returning();

  return job || null;
};

// ============================
// Team Members Operations
// ============================

export const getJobTeamMembers = async (
  jobId: string,
  organizationId: string
) => {
  const teamMembers = await db
    .select()
    .from(jobTeamMembers)
    .where(
      and(
        eq(jobTeamMembers.jobId, jobId),
        eq(jobTeamMembers.isActive, true)
      )
    );
  return teamMembers;
};

export const addJobTeamMember = async (data: {
  jobId: string;
  employeeId: number;
  role?: string;
}) => {
  const [member] = await db
    .insert(jobTeamMembers)
    .values({
      jobId: data.jobId,
      employeeId: data.employeeId,
      role: data.role,
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
// Financial Summary Operations
// ============================

export const getJobFinancialSummary = async (
  jobId: string,
  organizationId: string
) => {
  const [summary] = await db
    .select()
    .from(jobFinancialSummary)
    .where(
      and(
        eq(jobFinancialSummary.jobId, jobId),
        eq(jobFinancialSummary.organizationId, organizationId)
      )
    );
  return summary || null;
};

export const updateJobFinancialSummary = async (
  jobId: string,
  organizationId: string,
  data: Partial<{
    contractValue: string;
    totalInvoiced: string;
    totalPaid: string;
    vendorsOwed: string;
    laborPaidToDate: string;
    jobCompletionRate: string;
    profitability: string;
    profitMargin: string;
  }>
) => {
  const existing = await getJobFinancialSummary(jobId, organizationId);

  if (existing) {
    const [summary] = await db
      .update(jobFinancialSummary)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(jobFinancialSummary.id, existing.id))
      .returning();
    return summary;
  } else {
    const [summary] = await db
      .insert(jobFinancialSummary)
      .values({
        jobId,
        organizationId,
        contractValue: data.contractValue || "0",
        totalInvoiced: data.totalInvoiced || "0",
        totalPaid: data.totalPaid || "0",
        vendorsOwed: data.vendorsOwed || "0",
        laborPaidToDate: data.laborPaidToDate || "0",
        jobCompletionRate: data.jobCompletionRate,
        profitability: data.profitability,
        profitMargin: data.profitMargin,
      })
      .returning();
    return summary;
  }
};

// ============================
// Financial Breakdown Operations
// ============================

export const getJobFinancialBreakdown = async (
  jobId: string,
  organizationId: string
) => {
  const [breakdown] = await db
    .select()
    .from(jobFinancialBreakdown)
    .where(
      and(
        eq(jobFinancialBreakdown.jobId, jobId),
        eq(jobFinancialBreakdown.organizationId, organizationId),
        eq(jobFinancialBreakdown.isDeleted, false)
      )
    );
  return breakdown || null;
};

export const updateJobFinancialBreakdown = async (
  jobId: string,
  organizationId: string,
  data: {
    materialsEquipment: string;
    labor: string;
    travel: string;
    operatingExpenses: string;
    totalCost: string;
  }
) => {
  const existing = await getJobFinancialBreakdown(jobId, organizationId);

  if (existing) {
    const [breakdown] = await db
      .update(jobFinancialBreakdown)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(jobFinancialBreakdown.id, existing.id))
      .returning();
    return breakdown;
  } else {
    const [breakdown] = await db
      .insert(jobFinancialBreakdown)
      .values({
        jobId,
        organizationId,
        ...data,
      })
      .returning();
    return breakdown;
  }
};

// ============================
// Materials Operations
// ============================

export const getJobMaterials = async (
  jobId: string,
  organizationId: string
) => {
  const materials = await db
    .select()
    .from(jobMaterials)
    .where(
      and(
        eq(jobMaterials.jobId, jobId),
        eq(jobMaterials.organizationId, organizationId),
        eq(jobMaterials.isDeleted, false)
      )
    );
  return materials;
};

export const createJobMaterial = async (data: {
  jobId: string;
  organizationId: string;
  description: string;
  quantity: string;
  unitCost: string;
  markup: string;
  totalCost: string;
  isActual?: boolean;
}) => {
  const [material] = await db
    .insert(jobMaterials)
    .values({
      ...data,
      isActual: data.isActual ?? false,
    })
    .returning();
  return material;
};

export const updateJobMaterial = async (
  id: string,
  organizationId: string,
  data: Partial<{
    description: string;
    quantity: string;
    unitCost: string;
    markup: string;
    totalCost: string;
    isActual: boolean;
  }>
) => {
  const [material] = await db
    .update(jobMaterials)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobMaterials.id, id),
        eq(jobMaterials.organizationId, organizationId),
        eq(jobMaterials.isDeleted, false)
      )
    )
    .returning();
  return material;
};

export const deleteJobMaterial = async (id: string, organizationId: string) => {
  const [material] = await db
    .update(jobMaterials)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobMaterials.id, id),
        eq(jobMaterials.organizationId, organizationId),
        eq(jobMaterials.isDeleted, false)
      )
    )
    .returning();
  return material;
};

// ============================
// Labor Operations
// ============================

export const getJobLabor = async (jobId: string, organizationId: string) => {
  const labor = await db
    .select()
    .from(jobLabor)
    .where(
      and(
        eq(jobLabor.jobId, jobId),
        eq(jobLabor.organizationId, organizationId),
        eq(jobLabor.isDeleted, false)
      )
    );
  return labor;
};

export const createJobLabor = async (data: {
  jobId: string;
  organizationId: string;
  employeeId?: number;
  role: string;
  quantity: number;
  days: number;
  hoursPerDay: string;
  totalHours: string;
  costRate: string;
  billableRate: string;
  totalCost: string;
  totalPrice: string;
  isActual?: boolean;
}) => {
  const [labor] = await db
    .insert(jobLabor)
    .values({
      ...data,
      isActual: data.isActual ?? false,
    })
    .returning();
  return labor;
};

export const updateJobLabor = async (
  id: string,
  organizationId: string,
  data: Partial<{
    employeeId: number;
    role: string;
    quantity: number;
    days: number;
    hoursPerDay: string;
    totalHours: string;
    costRate: string;
    billableRate: string;
    totalCost: string;
    totalPrice: string;
    isActual: boolean;
  }>
) => {
  const [labor] = await db
    .update(jobLabor)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobLabor.id, id),
        eq(jobLabor.organizationId, organizationId),
        eq(jobLabor.isDeleted, false)
      )
    )
    .returning();
  return labor;
};

export const deleteJobLabor = async (id: string, organizationId: string) => {
  const [labor] = await db
    .update(jobLabor)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobLabor.id, id),
        eq(jobLabor.organizationId, organizationId),
        eq(jobLabor.isDeleted, false)
      )
    )
    .returning();
  return labor;
};

// ============================
// Travel Operations
// ============================

export const getJobTravel = async (jobId: string, organizationId: string) => {
  const travel = await db
    .select()
    .from(jobTravel)
    .where(
      and(
        eq(jobTravel.jobId, jobId),
        eq(jobTravel.organizationId, organizationId),
        eq(jobTravel.isDeleted, false)
      )
    );
  return travel;
};

export const createJobTravel = async (data: {
  jobId: string;
  organizationId: string;
  employeeId?: number;
  employeeName?: string;
  vehicleId?: string;
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
  isActual?: boolean;
}) => {
  const [travel] = await db
    .insert(jobTravel)
    .values({
      ...data,
      isActual: data.isActual ?? false,
    })
    .returning();
  return travel;
};

export const updateJobTravel = async (
  id: string,
  organizationId: string,
  data: Partial<{
    employeeId: number;
    employeeName: string;
    vehicleId: string;
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
    isActual: boolean;
  }>
) => {
  const [travel] = await db
    .update(jobTravel)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobTravel.id, id),
        eq(jobTravel.organizationId, organizationId),
        eq(jobTravel.isDeleted, false)
      )
    )
    .returning();
  return travel;
};

export const deleteJobTravel = async (id: string, organizationId: string) => {
  const [travel] = await db
    .update(jobTravel)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobTravel.id, id),
        eq(jobTravel.organizationId, organizationId),
        eq(jobTravel.isDeleted, false)
      )
    )
    .returning();
  return travel;
};

// ============================
// Operating Expenses Operations
// ============================

export const getJobOperatingExpenses = async (
  jobId: string,
  organizationId: string
) => {
  const [expenses] = await db
    .select()
    .from(jobOperatingExpenses)
    .where(
      and(
        eq(jobOperatingExpenses.jobId, jobId),
        eq(jobOperatingExpenses.organizationId, organizationId),
        eq(jobOperatingExpenses.isDeleted, false)
      )
    );
  return expenses || null;
};

export const updateJobOperatingExpenses = async (
  jobId: string,
  organizationId: string,
  data: Partial<{
    enabled: boolean;
    grossRevenuePreviousYear: string;
    currentJobAmount: string;
    operatingCostPreviousYear: string;
    inflationAdjustedOperatingCost: string;
    inflationRate: string;
    utilizationPercentage: string;
    calculatedOperatingCost: string;
    applyMarkup: boolean;
    markupPercentage: string;
    operatingPrice: string;
  }>
) => {
  const existing = await getJobOperatingExpenses(jobId, organizationId);

  if (existing) {
    const [expenses] = await db
      .update(jobOperatingExpenses)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(jobOperatingExpenses.id, existing.id))
      .returning();
    return expenses;
  } else {
    const [expenses] = await db
      .insert(jobOperatingExpenses)
      .values({
        jobId,
        organizationId,
        ...data,
      })
      .returning();
    return expenses;
  }
};

// ============================
// Timeline Operations
// ============================

export const getJobTimeline = async (jobId: string, organizationId: string) => {
  const timeline = await db
    .select()
    .from(jobTimeline)
    .where(
      and(
        eq(jobTimeline.jobId, jobId),
        eq(jobTimeline.organizationId, organizationId),
        eq(jobTimeline.isDeleted, false)
      )
    )
    .orderBy(asc(jobTimeline.sortOrder), asc(jobTimeline.eventDate));
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
  createdBy: string;
}) => {
  const [event] = await db
    .insert(jobTimeline)
    .values({
      jobId: data.jobId,
      organizationId: data.organizationId,
      event: data.event,
      eventDate: new Date(data.eventDate),
      status: (data.status as any) || "pending",
      description: data.description,
      sortOrder: data.sortOrder || 0,
      createdBy: data.createdBy,
    })
    .returning();
  return event;
};

export const updateJobTimelineEvent = async (
  id: string,
  organizationId: string,
  data: Partial<{
    event: string;
    eventDate: string;
    status: string;
    description: string;
    sortOrder: number;
  }>
) => {
  const [event] = await db
    .update(jobTimeline)
    .set({
      event: data.event,
      eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
      status: data.status as any,
      description: data.description,
      sortOrder: data.sortOrder,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobTimeline.id, id),
        eq(jobTimeline.organizationId, organizationId),
        eq(jobTimeline.isDeleted, false)
      )
    )
    .returning();
  return event;
};

export const deleteJobTimelineEvent = async (
  id: string,
  organizationId: string
) => {
  const [event] = await db
    .update(jobTimeline)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobTimeline.id, id),
        eq(jobTimeline.organizationId, organizationId),
        eq(jobTimeline.isDeleted, false)
      )
    )
    .returning();
  return event;
};

// ============================
// Documents Operations
// ============================

export const getJobDocuments = async (
  jobId: string,
  organizationId: string
) => {
  const documents = await db
    .select()
    .from(jobDocuments)
    .where(
      and(
        eq(jobDocuments.jobId, jobId),
        eq(jobDocuments.organizationId, organizationId),
        eq(jobDocuments.isDeleted, false)
      )
    );
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
  const [document] = await db.insert(jobDocuments).values(data).returning();
  return document;
};

export const deleteJobDocument = async (id: string, organizationId: string) => {
  const [document] = await db
    .update(jobDocuments)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobDocuments.id, id),
        eq(jobDocuments.organizationId, organizationId),
        eq(jobDocuments.isDeleted, false)
      )
    )
    .returning();
  return document;
};

// ============================
// Notes Operations
// ============================

export const getJobNotes = async (jobId: string, organizationId: string) => {
  const notes = await db
    .select()
    .from(jobNotes)
    .where(
      and(
        eq(jobNotes.jobId, jobId),
        eq(jobNotes.organizationId, organizationId),
        eq(jobNotes.isDeleted, false)
      )
    )
    .orderBy(desc(jobNotes.createdAt));
  return notes;
};

export const createJobNote = async (data: {
  jobId: string;
  organizationId: string;
  note: string;
  createdBy: string;
  isInternal?: boolean;
}) => {
  const [note] = await db
    .insert(jobNotes)
    .values({
      ...data,
      isInternal: data.isInternal ?? true,
    })
    .returning();
  return note;
};

export const updateJobNote = async (
  id: string,
  organizationId: string,
  data: Partial<{
    note: string;
    isInternal: boolean;
  }>
) => {
  const [note] = await db
    .update(jobNotes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobNotes.id, id),
        eq(jobNotes.organizationId, organizationId),
        eq(jobNotes.isDeleted, false)
      )
    )
    .returning();
  return note;
};

export const deleteJobNote = async (id: string, organizationId: string) => {
  const [note] = await db
    .update(jobNotes)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobNotes.id, id),
        eq(jobNotes.organizationId, organizationId),
        eq(jobNotes.isDeleted, false)
      )
    )
    .returning();
  return note;
};

// ============================
// History Operations
// ============================

export const getJobHistory = async (jobId: string, organizationId: string) => {
  const history = await db
    .select()
    .from(jobHistory)
    .where(
      and(
        eq(jobHistory.jobId, jobId),
        eq(jobHistory.organizationId, organizationId)
      )
    )
    .orderBy(desc(jobHistory.createdAt));
  return history;
};

export const createJobHistoryEntry = async (data: {
  jobId: string;
  organizationId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
  performedBy: string;
}) => {
  const [entry] = await db.insert(jobHistory).values(data).returning();
  return entry;
};

// ============================
// Tasks Operations
// ============================

export const getJobTasks = async (jobId: string, organizationId: string) => {
  const tasks = await db
    .select()
    .from(jobTasks)
    .where(
      and(
        eq(jobTasks.jobId, jobId),
        eq(jobTasks.organizationId, organizationId),
        eq(jobTasks.isDeleted, false)
      )
    )
    .orderBy(asc(jobTasks.sortOrder), asc(jobTasks.dueDate));
  return tasks;
};

export const createJobTask = async (data: {
  jobId: string;
  organizationId: string;
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
  const [task] = await db
    .insert(jobTasks)
    .values({
      jobId: data.jobId,
      organizationId: data.organizationId,
      taskName: data.taskName,
      description: data.description,
      status: data.status || "pending",
      priority: data.priority || "medium",
      assignedTo: data.assignedTo,
      dueDate: data.dueDate
        ? new Date(data.dueDate).toISOString().split("T")[0]
        : null,
      estimatedHours: data.estimatedHours,
      sortOrder: data.sortOrder || 0,
      createdBy: data.createdBy,
    })
    .returning();
  return task;
};

export const updateJobTask = async (
  id: string,
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
  }>
) => {
  const [task] = await db
    .update(jobTasks)
    .set({
      taskName: data.taskName,
      description: data.description,
      status: data.status,
      priority: data.priority,
      assignedTo: data.assignedTo,
      dueDate: data.dueDate
        ? new Date(data.dueDate).toISOString().split("T")[0]
        : undefined,
      completedDate: data.completedDate
        ? new Date(data.completedDate).toISOString().split("T")[0]
        : undefined,
      estimatedHours: data.estimatedHours,
      actualHours: data.actualHours,
      sortOrder: data.sortOrder,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobTasks.id, id),
        eq(jobTasks.organizationId, organizationId),
        eq(jobTasks.isDeleted, false)
      )
    )
    .returning();
  return task;
};

export const deleteJobTask = async (id: string, organizationId: string) => {
  const [task] = await db
    .update(jobTasks)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobTasks.id, id),
        eq(jobTasks.organizationId, organizationId),
        eq(jobTasks.isDeleted, false)
      )
    )
    .returning();
  return task;
};

// ============================
// Expenses Operations
// ============================

export const getJobExpenses = async (jobId: string, organizationId: string) => {
  const expenses = await db
    .select()
    .from(jobExpenses)
    .where(
      and(
        eq(jobExpenses.jobId, jobId),
        eq(jobExpenses.organizationId, organizationId),
        eq(jobExpenses.isDeleted, false)
      )
    )
    .orderBy(desc(jobExpenses.expenseDate));
  return expenses;
};

export const createJobExpense = async (data: {
  jobId: string;
  organizationId: string;
  expenseType: string;
  description: string;
  amount: string;
  expenseDate: string;
  vendorName?: string;
  invoiceNumber?: string;
  receiptPath?: string;
  approvedBy?: string;
  createdBy: string;
}) => {
  // Ensure expenseDate is properly formatted
  const formattedDate = new Date(data.expenseDate).toISOString().split("T")[0];
  if (!formattedDate) {
    throw new Error("Invalid expense date");
  }

  const [expense] = await db
    .insert(jobExpenses)
    .values({
      jobId: data.jobId,
      organizationId: data.organizationId,
      expenseType: data.expenseType,
      description: data.description,
      amount: data.amount,
      expenseDate: formattedDate,
      vendorName: data.vendorName,
      invoiceNumber: data.invoiceNumber,
      receiptPath: data.receiptPath,
      approvedBy: data.approvedBy,
      approvedAt: data.approvedBy ? new Date() : null,
      createdBy: data.createdBy,
    })
    .returning();
  return expense;
};

export const updateJobExpense = async (
  id: string,
  organizationId: string,
  data: Partial<{
    expenseType: string;
    description: string;
    amount: string;
    expenseDate: string;
    vendorName: string;
    invoiceNumber: string;
    receiptPath: string;
    approvedBy: string;
  }>
) => {
  const [expense] = await db
    .update(jobExpenses)
    .set({
      expenseType: data.expenseType,
      description: data.description,
      amount: data.amount,
      expenseDate: data.expenseDate
        ? new Date(data.expenseDate).toISOString().split("T")[0]
        : undefined,
      vendorName: data.vendorName,
      invoiceNumber: data.invoiceNumber,
      receiptPath: data.receiptPath,
      approvedBy: data.approvedBy,
      approvedAt: data.approvedBy ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobExpenses.id, id),
        eq(jobExpenses.organizationId, organizationId),
        eq(jobExpenses.isDeleted, false)
      )
    )
    .returning();
  return expense;
};

export const deleteJobExpense = async (id: string, organizationId: string) => {
  const [expense] = await db
    .update(jobExpenses)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobExpenses.id, id),
        eq(jobExpenses.organizationId, organizationId),
        eq(jobExpenses.isDeleted, false)
      )
    )
    .returning();
  return expense;
};

// ============================
// Helper Functions
// ============================

// Generate next job number using atomic database function
const generateJobNumber = async (organizationId: string): Promise<string> => {
  try {
    // Use atomic database function to get next counter value
    const result = await db.execute<{ next_value: string }>(
      sql.raw(
        `SELECT org.get_next_counter('${organizationId}'::uuid, 'job_number') as next_value`
      )
    );

    const nextNumber = parseInt(result.rows[0]?.next_value || "1");
    return `JOB-${nextNumber.toString().padStart(5, "0")}`;
  } catch (error) {
    // Fallback to old method if function doesn't exist yet
    console.warn("Counter function not found, using fallback method:", error);

    const maxResult = await db
      .select({
        maxJobNumber: max(jobs.jobNumber),
      })
      .from(jobs)
      .where(eq(jobs.organizationId, organizationId));

    const maxJobNumber = maxResult[0]?.maxJobNumber;
    let nextNumber = 1;

    if (maxJobNumber) {
      const match = maxJobNumber.match(/JOB-(\d+)/);
      if (match && match[1]) {
        const currentNumber = parseInt(match[1], 10);
        nextNumber = currentNumber + 1;
      }
    }

    return `JOB-${nextNumber.toString().padStart(5, "0")}`;
  }
};

const createRelatedRecords = async (
  jobId: string,
  organizationId: string
) => {
  // Create financial breakdown
  await db.insert(jobFinancialBreakdown).values({
    jobId,
    organizationId,
    materialsEquipment: "0",
    labor: "0",
    travel: "0",
    operatingExpenses: "0",
    totalCost: "0",
  });

  // Create operating expenses
  await db.insert(jobOperatingExpenses).values({
    jobId,
    organizationId,
  });
};

// ============================
// Complete Job Data with Relations
// ============================

export const getJobWithAllData = async (id: string, organizationId: string) => {
  const job = await getJobById(id, organizationId);
  if (!job) return null;

  const [
    financialSummary,
    financialBreakdown,
    materials,
    labor,
    travel,
    operatingExpenses,
    timeline,
    notes,
    history,
    tasks,
    expenses,
    teamMembers,
    documents,
  ] = await Promise.all([
    getJobFinancialSummary(id, organizationId),
    getJobFinancialBreakdown(id, organizationId),
    getJobMaterials(id, organizationId),
    getJobLabor(id, organizationId),
    getJobTravel(id, organizationId),
    getJobOperatingExpenses(id, organizationId),
    getJobTimeline(id, organizationId),
    getJobNotes(id, organizationId),
    getJobHistory(id, organizationId),
    getJobTasks(id, organizationId),
    getJobExpenses(id, organizationId),
    getJobTeamMembers(id, organizationId),
    getJobDocuments(id, organizationId),
  ]);

  return {
    job,
    financialSummary,
    financialBreakdown,
    materials,
    labor,
    travel,
    operatingExpenses,
    timeline,
    notes,
    history,
    tasks,
    expenses,
    teamMembers,
    documents,
  };
};


