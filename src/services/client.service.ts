import { count, eq, and, desc, asc, max, sql, or, ilike, inArray } from "drizzle-orm";
import { db } from "../config/db.js";
import {
  organizations,
  clientTypes,
  industryClassifications,
  properties,
  clientContacts,
  clientNotes,
  clientDocuments,
  documentCategories,
  clientDocumentCategories,
  propertyContacts,
  propertyEquipment,
  propertyDocuments,
  propertyServiceHistory,
  financialSummary,
  financialCostCategories,
  profitTrend,
  cashFlowProjection,
  cashFlowScenarios,
  revenueForecast,
  financialReports,
} from "../drizzle/schema/client.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { bidsTable, bidFinancialBreakdown } from "../drizzle/schema/bids.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";

// ============================
// Organization Operations
// ============================

export const getClients = async (
  offset: number,
  limit: number,
  filters?: {
    type?: string;
    status?: string;
    search?: string;
    tags?: string[];
  }
) => {
  let whereCondition = eq(organizations.isDeleted, false);

  // Add filters
  if (filters?.type) {
    whereCondition = and(whereCondition, eq(organizations.clientTypeId, parseInt(filters.type))) ?? whereCondition;
  }

  if (filters?.status) {
    whereCondition = and(whereCondition, eq(organizations.status, filters.status as any)) ?? whereCondition;
  }

  if (filters?.search) {
    whereCondition = and(
      whereCondition,
      or(
        ilike(organizations.name, `%${filters.search}%`),
        ilike(organizations.website, `%${filters.search}%`),
        ilike(organizations.streetAddress, `%${filters.search}%`)
      )
    ) ?? whereCondition;
  }

  const orgsData = await db
    .select({
      organization: organizations,
      clientType: clientTypes,
    })
    .from(organizations)
    .leftJoin(clientTypes, eq(organizations.clientTypeId, clientTypes.id))
    .where(whereCondition)
    .orderBy(desc(organizations.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const totalCountResult = await db
    .select({ count: count() })
    .from(organizations)
    .where(whereCondition);
  
  const totalCount = totalCountResult[0]?.count || 0;

  return {
    data: orgsData,
    total: totalCount,
    pagination: {
      offset,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
};

// Keep original function for backward compatibility
export const getOrganizations = getClients;

export const getClientById = async (id: string) => {
  const result = await db
    .select({
      organization: organizations,
      clientType: clientTypes,
    })
    .from(organizations)
    .leftJoin(clientTypes, eq(organizations.clientTypeId, clientTypes.id))
    .where(and(eq(organizations.id, id), eq(organizations.isDeleted, false)));

  return result[0] || null;
};

// Keep original function for backward compatibility
export const getOrganizationById = getClientById;

export const getOrganizationDashboard = async (organizationId: string) => {
  const client = await getOrganizationById(organizationId);
  if (!client) {
    throw new Error("Organization not found");
  }

  try {
    // Get jobs and bids summary
    const jobsSummary = await db
      .select({
        totalJobs: count(jobs.id),
        totalContractValue: sql<string>`COALESCE(SUM(${jobs.contractValue}), 0)`,
      })
      .from(jobs)
      .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(
        and(
          eq(bidsTable.organizationId, organizationId),
          eq(jobs.isDeleted, false)
        )
      );

    const summary = jobsSummary[0] || {
      totalJobs: 0,
      totalContractValue: "0",
    };

    // Get active jobs count
    const activeJobsCount = await db
      .select({ count: count() })
      .from(jobs)
      .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(
        and(
          eq(bidsTable.organizationId, organizationId),
          eq(jobs.isDeleted, false),
          inArray(jobs.status, [
            "planned",
            "in_progress",
            "on_hold",
          ])
        )
      );

    // Get recent jobs
    const recentJobs = await db
      .select({
        job: jobs,
        bid: bidsTable,
      })
      .from(jobs)
      .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(
        and(
          eq(bidsTable.organizationId, organizationId),
          eq(jobs.isDeleted, false)
        )
      )
      .orderBy(desc(jobs.createdAt))
      .limit(5);

    // Get properties count
    const propertiesCount = await db
      .select({ count: count() })
      .from(properties)
      .where(
        and(
          eq(properties.organizationId, organizationId),
          eq(properties.isDeleted, false)
        )
      );

    return {
      organization: client.organization,
      organizationType: client.organization,
      summary: {
        totalJobs: summary.totalJobs,
        totalContractValue: summary.totalContractValue || "0",
        activeJobs: activeJobsCount[0]?.count || 0,
        totalProperties: propertiesCount[0]?.count || 0,
      },
      recentJobs: recentJobs.map(item => ({
        ...item.job,
        bid: item.bid,
      })),
    };
  } catch (error) {
    console.error("Error fetching organization dashboard:", error);
    throw new Error("Failed to fetch organization dashboard");
  }
};

export const createClient = async (data: {
  name: string;
  clientTypeId?: number;
  status?: string;
  website?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  taxId?: string;
  industryClassificationId?: number;
  description?: string;
  createdBy: string;
}) => {
  // Generate unique client ID
  const clientIdResult = await db
    .select({ maxId: max(organizations.clientId) })
    .from(organizations);
  
  const maxId = clientIdResult[0]?.maxId || "CL-000000";
  const nextIdNumber = parseInt(maxId.replace("CL-", "")) + 1;
  const clientId = `CL-${nextIdNumber.toString().padStart(6, "0")}`;

  const result = await db
    .insert(organizations)
    .values({
      clientId,
      name: data.name,
      clientTypeId: data.clientTypeId,
      status: (data.status as any) || "prospect",
      website: data.website,
      streetAddress: data.streetAddress,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      taxId: data.taxId,
      industryClassificationId: data.industryClassificationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

// Keep original function for backward compatibility  
export const createOrganization = createClient;

export const updateClient = async (
  id: string,
  data: Partial<{
    name: string;
    clientTypeId: number;
    status: string;
    website: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    taxId: string;
    industryClassificationId: number;
  }>
) => {
  const result = await db
    .update(organizations)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(organizations.id, id), eq(organizations.isDeleted, false)))
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

// Keep original function for backward compatibility
export const updateOrganization = updateClient;

export const deleteClient = async (id: string) => {
  const result = await db
    .update(organizations)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(organizations.id, id), eq(organizations.isDeleted, false)))
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

// Keep original function for backward compatibility
export const deleteOrganization = deleteClient;

// ============================
// Organization Types
// ============================

export const getClientTypes = async () => {
  return await db
    .select()
    .from(clientTypes)
    .where(eq(clientTypes.isActive, true))
    .orderBy(asc(clientTypes.name));
};

export const getIndustryClassifications = async () => {
  return await db
    .select()
    .from(industryClassifications)
    .where(eq(industryClassifications.isActive, true))
    .orderBy(asc(industryClassifications.name));
};

export const createClientType = async (data: {
  name: string;
  description?: string;
  sortOrder?: number;
}) => {
  const result = await db
    .insert(clientTypes)
    .values({
      ...data,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

export const createIndustryClassification = async (data: {
  name: string;
  code?: string;
  description?: string;
  sortOrder?: number;
}) => {
  const result = await db
    .insert(industryClassifications)
    .values({
      ...data,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

export const updateClientType = async (
  id: number,
  data: Partial<{
    name: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
  }>
) => {
  const result = await db
    .update(clientTypes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(clientTypes.id, id))
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

export const updateIndustryClassification = async (
  id: number,
  data: Partial<{
    name: string;
    code: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
  }>
) => {
  const result = await db
    .update(industryClassifications)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(industryClassifications.id, id))
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

export const deleteClientType = async (id: number) => {
  const result = await db
    .update(clientTypes)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(clientTypes.id, id))
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

export const deleteIndustryClassification = async (id: number) => {
  const result = await db
    .update(industryClassifications)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(industryClassifications.id, id))
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

// Keep original function for backward compatibility
export const getOrganizationTypes = getClientTypes;

// ============================
// Properties Operations
// ============================

export const getOrganizationProperties = async (
  organizationId: string,
  offset: number,
  limit: number,
  filters?: {
    type?: string;
    status?: string;
    search?: string;
  }
) => {
  let whereCondition = and(
    eq(properties.organizationId, organizationId),
    eq(properties.isDeleted, false)
  );

  if (filters?.type) {
    whereCondition = and(whereCondition, eq(properties.propertyType, filters.type)) ?? whereCondition;
  }

  if (filters?.status) {
    whereCondition = and(whereCondition, eq(properties.status, filters.status as any)) ?? whereCondition;
  }

  if (filters?.search) {
    whereCondition = and(
      whereCondition,
      or(
        ilike(properties.propertyName, `%${filters.search}%`),
        ilike(properties.addressLine1, `%${filters.search}%`)
      )
    ) ?? whereCondition;
  }

  const propertiesData = await db
    .select({
      property: properties,
    })
    .from(properties)
    .where(whereCondition)
    .orderBy(desc(properties.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: count() })
    .from(properties)
    .where(whereCondition);
  const totalCount = countResult[0]?.count || 0;

  return {
    properties: propertiesData,
    totalCount,
  };
};

// ============================
// Contacts Operations  
// ============================

export const getClientContacts = async (
  organizationId: string,
  offset: number = 0,
  limit: number = 50,
  filters?: {
    type?: string;
    search?: string;
  }
) => {
  let whereCondition = and(
    eq(clientContacts.organizationId, organizationId),
    eq(clientContacts.isDeleted, false)
  );

  if (filters?.search) {
    whereCondition = and(
      whereCondition,
      or(
        ilike(clientContacts.fullName, `%${filters.search}%`),
        ilike(clientContacts.email, `%${filters.search}%`)
      )
    );
  }

  const contactsData = await db
    .select()
    .from(clientContacts)
    .where(whereCondition)
    .orderBy(desc(clientContacts.createdAt))
    .limit(limit)
    .offset(offset);

  const totalCountResult = await db
    .select({ count: count() })
    .from(clientContacts)
    .where(whereCondition);

  const totalCount = totalCountResult[0]?.count || 0;

  return {
    contacts: contactsData,
    totalCount,
  };
};

export const getClientContactById = async (id: string) => {
  const result = await db
    .select()
    .from(clientContacts)
    .where(and(eq(clientContacts.id, id), eq(clientContacts.isDeleted, false)));

  return result[0] || null;
};

export const createClientContact = async (data: {
  organizationId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position?: string;
  isPrimary?: boolean;
}) => {
  const { firstName, lastName, position, ...rest } = data;
  const result = await db
    .insert(clientContacts)
    .values({
      ...rest,
      fullName: `${firstName} ${lastName}`,
      title: position,
    })
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

export const updateClientContact = async (
  id: string,
  data: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    position: string;
    isPrimary: boolean;
  }>
) => {
  const { firstName, lastName, position, ...rest } = data;
  const updateData: any = { ...rest };
  
  if (firstName && lastName) {
    updateData.fullName = `${firstName} ${lastName}`;
  }
  
  if (position !== undefined) {
    updateData.title = position;
  }
  
  const result = await db
    .update(clientContacts)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(and(eq(clientContacts.id, id), eq(clientContacts.isDeleted, false)))
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

export const deleteClientContact = async (id: string) => {
  const result = await db
    .update(clientContacts)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(clientContacts.id, id), eq(clientContacts.isDeleted, false)))
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

// Keep original function for backward compatibility
export const getOrganizationContacts = getClientContacts;

// ============================
// Client Notes Operations  
// ============================

export const getClientNotes = async (
  organizationId: string,
  offset: number = 0,
  limit: number = 50
) => {
  const notesData = await db
    .select()
    .from(clientNotes)
    .where(and(eq(clientNotes.organizationId, organizationId), eq(clientNotes.isDeleted, false)))
    .orderBy(desc(clientNotes.createdAt))
    .limit(limit)
    .offset(offset);

  const totalCountResult = await db
    .select({ count: count() })
    .from(clientNotes)
    .where(and(eq(clientNotes.organizationId, organizationId), eq(clientNotes.isDeleted, false)));

  return {
    notes: notesData,
    totalCount: totalCountResult[0]?.count || 0,
  };
};

export const getClientNoteById = async (id: string) => {
  const result = await db
    .select()
    .from(clientNotes)
    .where(and(eq(clientNotes.id, id), eq(clientNotes.isDeleted, false)));

  return result[0] || null;
};

export const createClientNote = async (data: {
  organizationId: string;
  title: string;
  content: string;
  type?: string;
  createdBy: string;
}) => {
  const result = await db
    .insert(clientNotes)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

export const updateClientNote = async (
  id: string,
  data: Partial<{
    title: string;
    content: string;
    type: string;
  }>
) => {
  const result = await db
    .update(clientNotes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(clientNotes.id, id), eq(clientNotes.isDeleted, false)))
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

export const deleteClientNote = async (id: string) => {
  const result = await db
    .update(clientNotes)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(clientNotes.id, id), eq(clientNotes.isDeleted, false)))
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

// ============================
// Client Documents Operations  
// ============================

export const getClientDocuments = async (
  organizationId: string,
  offset: number = 0,
  limit: number = 50
) => {
  const documentsData = await db
    .select()
    .from(clientDocuments)
    .where(and(eq(clientDocuments.organizationId, organizationId), eq(clientDocuments.isDeleted, false)))
    .orderBy(desc(clientDocuments.createdAt))
    .limit(limit)
    .offset(offset);

  const totalCountResult = await db
    .select({ count: count() })
    .from(clientDocuments)
    .where(and(eq(clientDocuments.organizationId, organizationId), eq(clientDocuments.isDeleted, false)));

  return {
    documents: documentsData,
    totalCount: totalCountResult[0]?.count || 0,
  };
};

export const getClientDocumentById = async (id: string) => {
  const result = await db
    .select()
    .from(clientDocuments)
    .where(and(eq(clientDocuments.id, id), eq(clientDocuments.isDeleted, false)));

  return result[0] || null;
};

export const createClientDocument = async (data: {
  organizationId: string;
  name: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy: string;
}) => {
  const result = await db
    .insert(clientDocuments)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

export const updateClientDocument = async (
  id: string,
  data: Partial<{
    name: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
  }>
) => {
  const result = await db
    .update(clientDocuments)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(clientDocuments.id, id), eq(clientDocuments.isDeleted, false)))
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

export const deleteClientDocument = async (id: string) => {
  const result = await db
    .update(clientDocuments)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(clientDocuments.id, id), eq(clientDocuments.isDeleted, false)))
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

// ============================
// Document Categories Operations  
// ============================

export const getDocumentCategories = async () => {
  return await db
    .select()
    .from(documentCategories)
    .where(eq(documentCategories.isActive, true))
    .orderBy(asc(documentCategories.name));
};

export const getDocumentCategories2 = async () => {
  return await db
    .select()
    .from(documentCategories)
    .where(eq(documentCategories.isActive, true))
    .orderBy(asc(documentCategories.sortOrder));
};

export const createDocumentCategory = async (data: {
  name: string;
  description?: string;
  color?: string;
  sortOrder?: number;
}) => {
  const result = await db
    .insert(documentCategories)
    .values({
      ...data,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

export const updateDocumentCategory = async (
  id: number,
  data: Partial<{
    name: string;
    description: string;
    color: string;
    sortOrder: number;
    isActive: boolean;
  }>
) => {
  const result = await db
    .update(documentCategories)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(documentCategories.id, id))
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

export const deleteDocumentCategory = async (id: number) => {
  const result = await db
    .update(documentCategories)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(documentCategories.id, id))
    .returning();
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
};

export const assignDocumentCategories = async (
  documentId: string,
  categoryIds: number[]
) => {
  // First remove existing assignments
  await db
    .delete(clientDocumentCategories)
    .where(eq(clientDocumentCategories.documentId, documentId));

  // Then add new assignments
  const assignments = categoryIds.map(categoryId => ({
    documentId,
    categoryId,
    createdAt: new Date(),
  }));

  if (assignments.length > 0) {
    await db
      .insert(clientDocumentCategories)
      .values(assignments);
  }

  return { success: true };
};

export const createCategoryAndAssignToDocument = async (
  documentId: string,
  categoryData: {
    name: string;
    description?: string;
    color?: string;
  }
) => {
  const category = await createDocumentCategory(categoryData);
  await assignDocumentCategories(documentId, [category.id]);
  return category;
};

export const removeDocumentCategoryLink = async (
  documentId: string,
  categoryId: number
) => {
  const result = await db
    .delete(clientDocumentCategories)
    .where(
      and(
        eq(clientDocumentCategories.documentId, documentId),
        eq(clientDocumentCategories.categoryId, categoryId)
      )
    );
  return { success: true };
};

// ============================
// Client KPIs and Settings
// ============================

export const getClientKPIs = async (organizationId: string) => {
  // This would aggregate various metrics for the client
  // For now, return basic structure
  return {
    totalJobs: 0,
    totalRevenue: "0",
    activeProjects: 0,
    completedProjects: 0,
  };
};

export const getClientSettings = async (organizationId: string) => {
  // Return default settings structure
  return {
    id: organizationId,
    notifications: {
      email: true,
      sms: false,
    },
    preferences: {
      currency: "USD",
      timezone: "UTC",
    },
  };
};

export const updateClientSettings = async (
  organizationId: string,
  settings: any
) => {
  // For now, just return the updated settings
  // In a real implementation, this would store in a settings table
  return {
    id: organizationId,
    ...settings,
    updatedAt: new Date(),
  };
};