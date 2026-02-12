import {
  count,
  eq,
  and,
  desc,
  asc,
  max,
  sql,
  or,
  ilike,
  inArray,
  gte,
} from "drizzle-orm";
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
} from "../drizzle/schema/client.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";
import { invoices } from "../drizzle/schema/invoicing.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { alias } from "drizzle-orm/pg-core";

// Import types
import type {
  ClientFilters,
  ClientListResult,
  CreateClientRequest,
  UpdateClientRequest,
  CreateContactRequest,
  UpdateContactRequest,
  DocumentListResult,
  NoteListResult,
  ClientKPIs,
  ClientSettings,
  Client,
  ClientContact,
} from "../types/client.types.js";

// ============================
// Organization Operations
// ============================

export const getClients = async (
  offset: number,
  limit: number,
  filters?: ClientFilters,
): Promise<ClientListResult> => {
  try {
    let whereCondition = eq(organizations.isDeleted, false);

    // Add filters
    if (filters?.type) {
      const typeId = parseInt(filters.type);
      if (isNaN(typeId)) {
        throw new Error(
          `Invalid client type filter: '${filters.type}' is not a valid number`,
        );
      }
      whereCondition =
        and(whereCondition, eq(organizations.clientTypeId, typeId)) ??
        whereCondition;
    }

    if (filters?.status) {
      whereCondition =
        and(whereCondition, eq(organizations.status, filters.status as any)) ??
        whereCondition;
    }

    if (filters?.search) {
      whereCondition =
        and(
          whereCondition,
          or(
            ilike(organizations.name, `%${filters.search}%`),
            ilike(organizations.website, `%${filters.search}%`),
            ilike(organizations.streetAddress, `%${filters.search}%`),
          ),
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
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  } catch (error: any) {
    // Provide more detailed error message for database query errors
    if (
      error?.message?.includes("Failed query") ||
      error?.message?.includes("syntax")
    ) {
      const errorMessage = error.message || "Unknown database query error";
      throw new Error(
        `Database query error while fetching clients: ${errorMessage}. ` +
          `This may indicate a problem with the database query structure or invalid filter parameters. ` +
          `Please check your filter values and try again.`,
      );
    }
    // Re-throw the error if it's already a well-formed error
    throw error;
  }
};

// Keep original function for backward compatibility
export const getOrganizations = getClients;

// Alias for joining users table
const createdByUser = alias(users, "created_by_user");

export const getClientById = async (id: string) => {
  const [row] = await db
    .select({
      organization: organizations,
      clientType: clientTypes,
      createdByName: createdByUser.fullName,
    })
    .from(organizations)
    .leftJoin(clientTypes, eq(organizations.clientTypeId, clientTypes.id))
    .leftJoin(createdByUser, eq(organizations.createdBy, createdByUser.id))
    .where(and(eq(organizations.id, id), eq(organizations.isDeleted, false)));

  if (!row) return null;

  // Get primary contact
  const [primaryContact] = await db
    .select()
    .from(clientContacts)
    .where(
      and(
        eq(clientContacts.organizationId, id),
        eq(clientContacts.isPrimary, true),
        eq(clientContacts.isDeleted, false),
      ),
    )
    .limit(1);

  const { createdByName, organization, clientType } = row;

  return {
    organization: {
      ...organization,
      createdByName: createdByName ?? null,
      primaryContact: primaryContact?.fullName ?? null,
      email: primaryContact?.email ?? organization.website ?? null,
      phone: primaryContact?.phone ?? null,
    },
    clientType,
  };
};

// Keep original function for backward compatibility
export const getOrganizationById = getClientById;

export const getOrganizationDashboard = async (organizationId: string) => {
  // Validate organizationId
  if (
    !organizationId ||
    typeof organizationId !== "string" ||
    organizationId.trim() === ""
  ) {
    throw new Error("Invalid organization ID provided");
  }

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
          eq(jobs.isDeleted, false),
        ),
      );

    const summary = jobsSummary[0] || {
      totalJobs: 0,
      totalContractValue: "0",
    };

    // Get active jobs count - fixed to include "scheduled" status
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
            "scheduled",
            "in_progress",
            "on_hold",
          ]),
        ),
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
          eq(jobs.isDeleted, false),
        ),
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
          eq(properties.isDeleted, false),
        ),
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
      recentJobs: recentJobs.map((item) => ({
        ...item.job,
        bid: item.bid,
      })),
    };
  } catch (error: any) {
    console.error("Error fetching organization dashboard:", error);

    // Provide more detailed error message
    if (
      error?.message?.includes("Failed query") ||
      error?.message?.includes("syntax")
    ) {
      throw new Error(
        `Database query error while fetching organization dashboard: ${error.message}. ` +
          `This may indicate a problem with the database query structure. ` +
          `Please verify that the organization ID '${organizationId}' is valid and try again.`,
      );
    }

    if (error?.message) {
      throw error;
    }

    throw new Error(
      `Failed to fetch organization dashboard: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

// Generate Client ID using PostgreSQL sequence (thread-safe)
// Format: CL-2025-0001 (4 digits, auto-expands to 5, 6+ as needed)
export const generateClientId = async (): Promise<string> => {
  const year = new Date().getFullYear();

  try {
    // Try to use PostgreSQL sequence for atomic ID generation (thread-safe)
    const result = await db.execute<{ nextval: string }>(
      sql.raw(`SELECT nextval('org.client_id_seq')::text as nextval`),
    );

    const nextNumber = parseInt(result.rows[0]?.nextval || "1");

    // Use 4 digits minimum, auto-expand when exceeds 9999
    const padding = Math.max(4, nextNumber.toString().length);
    return `CL-${year}-${String(nextNumber).padStart(padding, "0")}`;
  } catch (error) {
    // Fallback to old method if sequence doesn't exist yet or has issues
    console.warn(
      "Client ID sequence not found or error occurred, using fallback method:",
      error,
    );

    // Find the maximum numeric value from existing client IDs for current year
    try {
      const maxNumResult = await db.execute<{ max_num: string | null }>(
        sql.raw(`
          WITH client_numbers AS (
            SELECT 
              CASE 
                WHEN client_id ~ '^CL-${year}-\\d+$' THEN
                  CAST(SUBSTRING(client_id FROM 'CL-${year}-(\\d+)') AS INTEGER)
                WHEN client_id ~ '^CL-\\d+$' THEN
                  CAST(SUBSTRING(client_id FROM 'CL-(\\d+)') AS INTEGER)
                WHEN client_id ~ '^CLT-\\d+$' THEN
                  CAST(SUBSTRING(client_id FROM 'CLT-(\\d+)') AS INTEGER)
                ELSE NULL
              END AS num_value
            FROM org.organizations
            WHERE is_deleted = false
              AND (client_id ~ '^CL-${year}-\\d+$' OR client_id ~ '^CL-\\d+$' OR client_id ~ '^CLT-\\d+$')
          )
          SELECT COALESCE(MAX(num_value), 0) as max_num
          FROM client_numbers
        `),
      );

      const maxNum = maxNumResult.rows[0]?.max_num;
      const nextIdNumber = maxNum ? parseInt(maxNum, 10) + 1 : 1;

      // Use 4 digits minimum, auto-expand when exceeds 9999
      const padding = Math.max(4, nextIdNumber.toString().length);
      return `CL-${year}-${nextIdNumber.toString().padStart(padding, "0")}`;
    } catch (sqlError) {
      // If SQL extraction fails, fall back to simple string comparison
      console.warn("SQL extraction failed, using simple fallback:", sqlError);

      const clientIdResult = await db
        .select({ maxId: max(organizations.clientId) })
        .from(organizations)
        .where(eq(organizations.isDeleted, false));

      const maxId = clientIdResult[0]?.maxId;
      let nextIdNumber = 1;

      // Handle CL-YEAR-, CL- and CLT- formats for backward compatibility
      if (maxId && typeof maxId === "string") {
        let numericPart: string | null = null;

        if (maxId.startsWith(`CL-${year}-`)) {
          numericPart = maxId.replace(`CL-${year}-`, "");
        } else if (maxId.startsWith("CL-")) {
          numericPart = maxId.replace("CL-", "");
        } else if (maxId.startsWith("CLT-")) {
          numericPart = maxId.replace("CLT-", "");
        }

        if (numericPart) {
          const parsedNumber = parseInt(numericPart, 10);
          if (!isNaN(parsedNumber)) {
            nextIdNumber = parsedNumber + 1;
          }
        }
      }

      // Use 4 digits minimum, auto-expand when exceeds 9999
      const padding = Math.max(4, nextIdNumber.toString().length);
      return `CL-${year}-${nextIdNumber.toString().padStart(padding, "0")}`;
    }
  }
};

export const createClient = async (
  data: CreateClientRequest & { createdBy: string },
): Promise<Client | null> => {
  // Generate unique client ID using thread-safe method
  const clientId = await generateClientId();

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
      createdBy: data.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!Array.isArray(result) || result.length === 0) return null;

  const client = result[0] as any;

  // Get createdBy user name
  let createdByName: string | null = null;
  if (client.createdBy) {
    const [creator] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, client.createdBy))
      .limit(1);
    createdByName = creator?.fullName || null;
  }

  return {
    ...client,
    createdByName,
  };
};

// Keep original function for backward compatibility
export const createOrganization = createClient;

export const updateClient = async (
  id: string,
  data: UpdateClientRequest,
): Promise<Client | null> => {
  const result = await db
    .update(organizations)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(organizations.id, id), eq(organizations.isDeleted, false)))
    .returning();
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
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
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
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

export const getClientTypeById = async (id: number) => {
  const result = await db
    .select()
    .from(clientTypes)
    .where(eq(clientTypes.id, id))
    .limit(1);
  return result[0] || null;
};

export const getIndustryClassifications = async () => {
  return await db
    .select()
    .from(industryClassifications)
    .where(eq(industryClassifications.isActive, true))
    .orderBy(asc(industryClassifications.name));
};

export const getIndustryClassificationById = async (id: number) => {
  const result = await db
    .select()
    .from(industryClassifications)
    .where(eq(industryClassifications.id, id))
    .limit(1);
  return result[0] || null;
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
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
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
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
};

export const updateClientType = async (
  id: number,
  data: Partial<{
    name: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
  }>,
) => {
  const result = await db
    .update(clientTypes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(clientTypes.id, id))
    .returning();
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
};

export const updateIndustryClassification = async (
  id: number,
  data: Partial<{
    name: string;
    code: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
  }>,
) => {
  const result = await db
    .update(industryClassifications)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(industryClassifications.id, id))
    .returning();
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
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
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
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
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
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
  },
) => {
  let whereCondition = and(
    eq(properties.organizationId, organizationId),
    eq(properties.isDeleted, false),
  );

  if (filters?.type) {
    whereCondition =
      and(whereCondition, eq(properties.propertyType, filters.type)) ??
      whereCondition;
  }

  if (filters?.status) {
    whereCondition =
      and(whereCondition, eq(properties.status, filters.status as any)) ??
      whereCondition;
  }

  if (filters?.search) {
    whereCondition =
      and(
        whereCondition,
        or(
          ilike(properties.propertyName, `%${filters.search}%`),
          ilike(properties.addressLine1, `%${filters.search}%`),
        ),
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
  },
) => {
  let whereCondition = and(
    eq(clientContacts.organizationId, organizationId),
    eq(clientContacts.isDeleted, false),
  );

  if (filters?.search) {
    whereCondition = and(
      whereCondition,
      or(
        ilike(clientContacts.fullName, `%${filters.search}%`),
        ilike(clientContacts.email, `%${filters.search}%`),
      ),
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
    contacts: contactsData as ClientContact[],
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

export const createClientContact = async (
  data: CreateContactRequest & { organizationId: string },
): Promise<ClientContact | null> => {
  const result = await db
    .insert(clientContacts)
    .values({
      ...data,
    })
    .returning();
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
};

export const updateClientContact = async (
  id: string,
  data: UpdateContactRequest,
): Promise<ClientContact | null> => {
  const result = await db
    .update(clientContacts)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(clientContacts.id, id), eq(clientContacts.isDeleted, false)))
    .returning();
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
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
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
};

// Keep original function for backward compatibility
export const getOrganizationContacts = getClientContacts;

// ============================
// Client Notes Operations
// ============================

export const getClientNotes = async (
  organizationId: string,
  offset: number = 0,
  limit: number = 50,
): Promise<NoteListResult> => {
  const notesData = await db
    .select()
    .from(clientNotes)
    .where(
      and(
        eq(clientNotes.organizationId, organizationId),
        eq(clientNotes.isDeleted, false),
      ),
    )
    .orderBy(desc(clientNotes.createdAt))
    .limit(limit)
    .offset(offset);

  const totalCountResult = await db
    .select({ count: count() })
    .from(clientNotes)
    .where(
      and(
        eq(clientNotes.organizationId, organizationId),
        eq(clientNotes.isDeleted, false),
      ),
    );

  return {
    notes: notesData as any[],
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
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
};

export const updateClientNote = async (
  id: string,
  data: Partial<{
    title: string;
    content: string;
    type: string;
  }>,
) => {
  const result = await db
    .update(clientNotes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(clientNotes.id, id), eq(clientNotes.isDeleted, false)))
    .returning();
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
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
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
};

// ============================
// Client Documents Operations
// ============================

export const getClientDocuments = async (
  organizationId: string,
  offset: number = 0,
  limit: number = 50,
): Promise<DocumentListResult> => {
  const whereCondition = and(
    eq(clientDocuments.organizationId, organizationId),
    eq(clientDocuments.isDeleted, false),
  );

  const documentsData = await db
    .select({
      document: clientDocuments,
      uploadedByName: users.fullName,
    })
    .from(clientDocuments)
    .leftJoin(users, eq(clientDocuments.uploadedBy, users.id))
    .where(whereCondition)
    .orderBy(desc(clientDocuments.createdAt))
    .limit(limit)
    .offset(offset);

  const totalCountResult = await db
    .select({ count: count() })
    .from(clientDocuments)
    .where(whereCondition);

  return {
    documents: documentsData.map((doc) => ({
      ...doc.document,
      uploadedByName: doc.uploadedByName || null,
    })) as any,
    totalCount: Number(totalCountResult[0]?.count || 0),
  };
};

export const getClientDocumentById = async (id: string) => {
  const [result] = await db
    .select({
      document: clientDocuments,
      uploadedByName: users.fullName,
    })
    .from(clientDocuments)
    .leftJoin(users, eq(clientDocuments.uploadedBy, users.id))
    .where(
      and(eq(clientDocuments.id, id), eq(clientDocuments.isDeleted, false)),
    );

  if (!result) return null;

  return {
    ...result.document,
    uploadedByName: result.uploadedByName || null,
  };
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
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
};

export const updateClientDocument = async (
  id: string,
  data: Partial<{
    name: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
  }>,
) => {
  const result = await db
    .update(clientDocuments)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(eq(clientDocuments.id, id), eq(clientDocuments.isDeleted, false)),
    )
    .returning();
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
};

export const deleteClientDocument = async (id: string) => {
  const result = await db
    .update(clientDocuments)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(
      and(eq(clientDocuments.id, id), eq(clientDocuments.isDeleted, false)),
    )
    .returning();
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
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

export const getDocumentCategoryById = async (id: number) => {
  const result = await db
    .select()
    .from(documentCategories)
    .where(eq(documentCategories.id, id))
    .limit(1);
  return result[0] || null;
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
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
};

export const updateDocumentCategory = async (
  id: number,
  data: Partial<{
    name: string;
    description: string;
    color: string;
    sortOrder: number;
    isActive: boolean;
  }>,
) => {
  const result = await db
    .update(documentCategories)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(documentCategories.id, id))
    .returning();
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
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
  return Array.isArray(result) && result.length > 0 ? (result[0] as any) : null;
};

export const assignDocumentCategories = async (
  documentId: string,
  categoryIds: number[],
) => {
  // First remove existing assignments
  await db
    .delete(clientDocumentCategories)
    .where(eq(clientDocumentCategories.documentId, documentId));

  // Then add new assignments
  const assignments = categoryIds.map((categoryId) => ({
    documentId,
    categoryId,
    createdAt: new Date(),
  }));

  if (assignments.length > 0) {
    await db.insert(clientDocumentCategories).values(assignments);
  }

  return { success: true };
};

export const createCategoryAndAssignToDocument = async (
  documentId: string,
  categoryData: {
    name: string;
    description?: string;
    color?: string;
  },
) => {
  const category = await createDocumentCategory(categoryData);
  await assignDocumentCategories(documentId, [category?.id as number]);
  return category;
};

export const removeDocumentCategoryLink = async (
  documentId: string,
  categoryId: number,
) => {
  await db
    .delete(clientDocumentCategories)
    .where(
      and(
        eq(clientDocumentCategories.documentId, documentId),
        eq(clientDocumentCategories.categoryId, categoryId),
      ),
    );
  return { success: true };
};

// ============================
// Client KPIs and Settings
// ============================

/**
 * Get client KPIs: metrics about client organizations (from organizations table).
 * Returns client counts, revenue, and activity metrics.
 */
export const getClientKPIs = async (
  _organizationId: string | undefined,
): Promise<ClientKPIs> => {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    totalClientsResult,
    activeClientsResult,
    pendingOrdersResult,
    revenueResult,
    newThisMonthResult,
  ] = await Promise.all([
    // Total clients: count of all non-deleted client organizations
    db
      .select({ count: count() })
      .from(organizations)
      .where(eq(organizations.isDeleted, false)),
    
    // Active clients: orgs with jobs in active statuses
    db
      .selectDistinct({ clientOrgId: bidsTable.organizationId })
      .from(bidsTable)
      .innerJoin(jobs, eq(bidsTable.id, jobs.bidId))
      .where(
        and(
          eq(bidsTable.isDeleted, false),
          eq(jobs.isDeleted, false),
          inArray(jobs.status, ["planned", "scheduled", "in_progress", "on_hold"]),
        ),
      ),
    
    // Pending orders: jobs in "planned" status (not yet started)
    db
      .select({ count: count() })
      .from(jobs)
      .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(
        and(
          eq(jobs.isDeleted, false),
          eq(bidsTable.isDeleted, false),
          eq(jobs.status, "planned"),
        ),
      ),
    
    // Total revenue: sum of all invoices
    db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS NUMERIC)), 0)`,
      })
      .from(invoices)
      .where(eq(invoices.isDeleted, false)),
    
    // New clients this month: organizations created this month
    db
      .select({ count: count() })
      .from(organizations)
      .where(
        and(
          eq(organizations.isDeleted, false),
          gte(organizations.createdAt, firstDayOfMonth),
        ),
      ),
  ]);

  const totalClients = Number(totalClientsResult[0]?.count ?? 0);
  const activeClients = activeClientsResult.length;
  const pendingOrders = Number(pendingOrdersResult[0]?.count ?? 0);
  const totalRevenue = revenueResult[0]?.total ?? "0";
  const newThisMonth = Number(newThisMonthResult[0]?.count ?? 0);

  return {
    totalClients,
    activeClients,
    pendingOrders,
    totalRevenue: String(parseFloat(totalRevenue).toFixed(2)),
    newThisMonth,
  };
};

export const getClientSettings = async (
  organizationId: string,
): Promise<ClientSettings | null> => {
  try {
    const result = await db
      .select({
        id: organizations.id,
        creditLimit: organizations.creditLimit,
        paymentTerms: organizations.paymentTerms,
        preferredPaymentMethod: organizations.preferredPaymentMethod,
        billingContactId: organizations.billingContactId,
        billingDay: organizations.billingDay,
        taxExempt: organizations.taxExempt,
      })
      .from(organizations)
      .where(
        and(
          eq(organizations.id, organizationId),
          eq(organizations.isDeleted, false),
        ),
      )
      .limit(1);

    if (!result || result.length === 0) {
      return null;
    }

    const client = result[0];
    if (!client) {
      return null;
    }

    return {
      id: client.id,
      creditLimit: client.creditLimit?.toString() || null,
      paymentTerms: client.paymentTerms || null,
      preferredPaymentMethod: client.preferredPaymentMethod || null,
      billingContactId: client.billingContactId || null,
      billingDay: client.billingDay || null,
      taxExempt: client.taxExempt || false,
    };
  } catch (error) {
    console.error("Error fetching client settings:", error);
    throw error;
  }
};

export const updateClientSettings = async (
  organizationId: string,
  settings: Partial<ClientSettings>,
): Promise<ClientSettings | null> => {
  try {
    // Prepare update data, filtering out undefined values
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (settings.creditLimit !== undefined) {
      updateData.creditLimit = settings.creditLimit
        ? settings.creditLimit
        : null;
    }
    if (settings.paymentTerms !== undefined) {
      updateData.paymentTerms = settings.paymentTerms;
    }
    if (settings.preferredPaymentMethod !== undefined) {
      updateData.preferredPaymentMethod = settings.preferredPaymentMethod;
    }
    if (settings.billingContactId !== undefined) {
      updateData.billingContactId = settings.billingContactId;
    }
    if (settings.billingDay !== undefined) {
      updateData.billingDay = settings.billingDay;
    }
    if (settings.taxExempt !== undefined) {
      updateData.taxExempt = settings.taxExempt;
    }

    const result = await db
      .update(organizations)
      .set(updateData)
      .where(
        and(
          eq(organizations.id, organizationId),
          eq(organizations.isDeleted, false),
        ),
      )
      .returning({
        id: organizations.id,
        creditLimit: organizations.creditLimit,
        paymentTerms: organizations.paymentTerms,
        preferredPaymentMethod: organizations.preferredPaymentMethod,
        billingContactId: organizations.billingContactId,
        billingDay: organizations.billingDay,
        taxExempt: organizations.taxExempt,
      });

    if (!result || result.length === 0) {
      return null;
    }

    const client = result[0];
    if (!client) {
      return null;
    }

    return {
      id: client.id,
      creditLimit: client.creditLimit?.toString() || null,
      paymentTerms: client.paymentTerms || null,
      preferredPaymentMethod: client.preferredPaymentMethod || null,
      billingContactId: client.billingContactId || null,
      billingDay: client.billingDay || null,
      taxExempt: client.taxExempt || false,
    };
  } catch (error) {
    console.error("Error updating client settings:", error);
    throw error;
  }
};
