import {
  count,
  eq,
  desc,
  and,
  like,
  ilike,
  or,
  inArray,
  sql,
} from "drizzle-orm";
import { db } from "../config/db.js";
import {
  organizations,
  clientContacts,
  clientNotes,
  clientDocuments,
  documentCategories,
  clientDocumentCategories,
  properties,
  propertyContacts,
  propertyEquipment,
  propertyDocuments,
  propertyServiceHistory,
  userOrganizations,
  clientTypes,
  industryClassifications,
} from "../drizzle/schema/org.schema.js";
import { jobs, jobFinancialSummary } from "../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";

// Generate next client ID in CLT-00001 format using PostgreSQL sequence
// This is THREAD-SAFE and prevents race conditions
export const generateClientId = async (): Promise<string> => {
  try {
    // Use PostgreSQL sequence for atomic ID generation
    const result = await db.execute<{ nextval: string }>(
      sql.raw(`SELECT nextval('org.client_id_seq')::text as nextval`)
    );

    const nextNumber = parseInt(result.rows[0]?.nextval || "1");
    return `CLT-${nextNumber.toString().padStart(5, "0")}`;
  } catch (error) {
    // Fallback to old method if sequence doesn't exist yet
    // (This handles cases where migration hasn't run yet)
    console.warn("Sequence not found, using fallback method:", error);

    const result = await db
      .select({ clientId: organizations.clientId })
      .from(organizations)
      .where(eq(organizations.isDeleted, false))
      .orderBy(desc(organizations.clientId))
      .limit(1);

    if (!result.length || !result[0]?.clientId) {
      return "CLT-00001";
    }

    const lastClientId = result[0].clientId;
    const match = lastClientId.match(/^CLT-(\d+)$/);

    if (!match) {
      return "CLT-00001";
    }

    const nextNumber = parseInt(match[1]!) + 1;
    return `CLT-${nextNumber.toString().padStart(5, "0")}`;
  }
};

// Get all client types
export const getClientTypes = async () => {
  return await db
    .select()
    .from(clientTypes)
    .where(eq(clientTypes.isActive, true))
    .orderBy(clientTypes.sortOrder, clientTypes.name);
};

// Get all industry classifications
export const getIndustryClassifications = async () => {
  return await db
    .select()
    .from(industryClassifications)
    .where(eq(industryClassifications.isActive, true))
    .orderBy(industryClassifications.sortOrder, industryClassifications.name);
};

// Get all clients with pagination and optional filtering
export const getClients = async (
  offset: number,
  limit: number,
  filters?: {
    status?: string | string[];
    clientTypeId?: number;
    priority?: string;
    search?: string;
  }
) => {
  let whereConditions = [eq(organizations.isDeleted, false)];

  // Add status filter - support both single string and array of statuses
  if (filters?.status) {
    if (Array.isArray(filters.status) && filters.status.length > 0) {
      // Map "pending" to "prospect" for UI compatibility
      const mappedStatuses = filters.status.map((s) =>
        s.toLowerCase() === "pending" ? "prospect" : s.toLowerCase()
      );
      whereConditions.push(
        inArray(organizations.status, mappedStatuses as any)
      );
    } else if (typeof filters.status === "string") {
      const status =
        filters.status.toLowerCase() === "pending"
          ? "prospect"
          : filters.status.toLowerCase();
      whereConditions.push(eq(organizations.status, status as any));
    }
  }

  if (filters?.clientTypeId) {
    whereConditions.push(eq(organizations.clientTypeId, filters.clientTypeId));
  }

  if (filters?.priority) {
    whereConditions.push(eq(organizations.priority, filters.priority as any));
  }

  // Enhanced search - includes contact info
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    // Get organization IDs that match contact search
    const matchingContactOrgs = await db
      .selectDistinct({ organizationId: clientContacts.organizationId })
      .from(clientContacts)
      .where(
        and(
          eq(clientContacts.isDeleted, false),
          or(
            ilike(clientContacts.fullName, searchTerm),
            ilike(clientContacts.email, searchTerm),
            ilike(clientContacts.phone, searchTerm),
            ilike(clientContacts.mobilePhone, searchTerm)
          )!
        )
      );

    const matchingOrgIds = matchingContactOrgs.map((c) => c.organizationId);

    whereConditions.push(
      or(
        ilike(organizations.name, searchTerm),
        ilike(organizations.legalName, searchTerm),
        ilike(organizations.website, searchTerm),
        matchingOrgIds.length > 0
          ? inArray(organizations.id, matchingOrgIds)
          : sql`1 = 0` // No match if no contact matches
      )!
    );
  }

  // Get clients with basic info
  const clientsResult = await db
    .select({
      // Basic client data - only what's needed
      id: organizations.id,
      name: organizations.name,
      status: organizations.status,
      logo: organizations.logo,
      // Address fields
      streetAddress: organizations.streetAddress,
      city: organizations.city,
      state: organizations.state,
      zipCode: organizations.zipCode,
    })
    .from(organizations)
    .where(and(...whereConditions))
    .orderBy(desc(organizations.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(organizations)
    .where(and(...whereConditions));

  const total = totalResult[0]?.count ?? 0;

  // Enrich each client with primary contact and active jobs count only
  const enrichedClients = await Promise.all(
    clientsResult.map(async (client) => {
      // Get primary contact (name and email only)
      const primaryContactResult = await db
        .select({
          fullName: clientContacts.fullName,
          email: clientContacts.email,
        })
        .from(clientContacts)
        .where(
          and(
            eq(clientContacts.organizationId, client.id),
            eq(clientContacts.isPrimary, true),
            eq(clientContacts.isDeleted, false)
          )
        )
        .limit(1);

      const primaryContact = primaryContactResult[0];

      // If no primary contact, get first contact
      const contact =
        primaryContact ||
        (await db
          .select({
            fullName: clientContacts.fullName,
            email: clientContacts.email,
          })
          .from(clientContacts)
          .where(
            and(
              eq(clientContacts.organizationId, client.id),
              eq(clientContacts.isDeleted, false)
            )
          )
          .limit(1)
          .then((contacts) => contacts[0] || null));

      // Get financial summary (total paid and outstanding)
      const financialData = await db
        .select({
          totalPaid: sql<number>`COALESCE(SUM(CAST(${jobFinancialSummary.totalPaid} AS NUMERIC)), 0)`,
          totalInvoiced: sql<number>`COALESCE(SUM(CAST(${jobFinancialSummary.totalInvoiced} AS NUMERIC)), 0)`,
        })
        .from(jobFinancialSummary)
        .where(eq(jobFinancialSummary.organizationId, client.id));

      const totalPaid = Number(financialData[0]?.totalPaid || 0);
      const totalInvoiced = Number(financialData[0]?.totalInvoiced || 0);
      const totalOutstanding = totalInvoiced - totalPaid;

      // Get active jobs count
      const activeJobsCount = await db
        .select({ count: count() })
        .from(jobs)
        .where(
          and(
            eq(jobs.organizationId, client.id),
            eq(jobs.isDeleted, false),
            inArray(jobs.status, [
              "planned",
              "scheduled",
              "in_progress",
              "on_hold",
            ] as any)
          )
        );

      const activeJobs = Number(activeJobsCount[0]?.count || 0);

      return {
        id: client.id,
        name: client.name,
        status: client.status,
        address: {
          streetAddress: client.streetAddress,
          city: client.city,
          state: client.state,
          zipCode: client.zipCode,
        },
        primaryContact: contact
          ? {
              name: contact.fullName,
              email: contact.email || null,
            }
          : null,
        activeJobs: activeJobs,
        financial: {
          totalPaid: totalPaid,
          totalOutstanding: totalOutstanding > 0 ? totalOutstanding : 0,
        },
      };
    })
  );

  return {
    data: enrichedClients,
    total: total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit: limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get client by ID with all related data organized by UI tabs
export const getClientById = async (id: string) => {
  // Get client with industry classification and client type info
  const clientQuery = await db
    .select({
      // All organization fields
      id: organizations.id,
      clientId: organizations.clientId,
      name: organizations.name,
      legalName: organizations.legalName,
      clientTypeId: organizations.clientTypeId,
      status: organizations.status,
      priority: organizations.priority,
      logo: organizations.logo,
      industryClassificationId: organizations.industryClassificationId,
      taxId: organizations.taxId,
      website: organizations.website,
      numberOfEmployees: organizations.numberOfEmployees,
      streetAddress: organizations.streetAddress,
      city: organizations.city,
      state: organizations.state,
      zipCode: organizations.zipCode,
      creditLimit: organizations.creditLimit,
      paymentTerms: organizations.paymentTerms,
      preferredPaymentMethod: organizations.preferredPaymentMethod,
      billingContactId: organizations.billingContactId,
      billingDay: organizations.billingDay,
      taxExempt: organizations.taxExempt,
      description: organizations.description,
      notes: organizations.notes,
      tags: organizations.tags,
      createdBy: organizations.createdBy,
      isDeleted: organizations.isDeleted,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
      // Join data for related info
      clientTypeName: clientTypes.name,
      industryName: industryClassifications.name,
    })
    .from(organizations)
    .leftJoin(clientTypes, eq(organizations.clientTypeId, clientTypes.id))
    .leftJoin(
      industryClassifications,
      eq(organizations.industryClassificationId, industryClassifications.id)
    )
    .where(and(eq(organizations.id, id), eq(organizations.isDeleted, false)))
    .limit(1);

  if (!clientQuery.length) {
    return null;
  }

  const client = clientQuery[0]!;

  // Run queries in parallel for performance
  const [primaryContact, propertiesList] = await Promise.all([
    // Get primary contact (including picture link)
    db
      .select({
        id: clientContacts.id,
        fullName: clientContacts.fullName,
        title: clientContacts.title,
        email: clientContacts.email,
        phone: clientContacts.phone,
        mobilePhone: clientContacts.mobilePhone,
        picture: clientContacts.picture,
        contactType: clientContacts.contactType,
        isPrimary: clientContacts.isPrimary,
        preferredContactMethod: clientContacts.preferredContactMethod,
        notes: clientContacts.notes,
      })
      .from(clientContacts)
      .where(
        and(
          eq(clientContacts.organizationId, id),
          eq(clientContacts.isPrimary, true),
          eq(clientContacts.isDeleted, false)
        )
      )
      .limit(1)
      .then((contacts) => contacts[0] || null),

    // Get all properties with complete info
    db
      .select({
        id: properties.id,
        propertyName: properties.propertyName,
        propertyCode: properties.propertyCode,
        propertyType: properties.propertyType,
        status: properties.status,
        addressLine1: properties.addressLine1,
        addressLine2: properties.addressLine2,
        city: properties.city,
        state: properties.state,
        zipCode: properties.zipCode,
        country: properties.country,
        squareFootage: properties.squareFootage,
        numberOfFloors: properties.numberOfFloors,
        yearBuilt: properties.yearBuilt,
        accessInstructions: properties.accessInstructions,
        gateCode: properties.gateCode,
        parkingInstructions: properties.parkingInstructions,
        operatingHours: properties.operatingHours,
        latitude: properties.latitude,
        longitude: properties.longitude,
        description: properties.description,
        notes: properties.notes,
        tags: properties.tags,
        createdBy: properties.createdBy,
        createdAt: properties.createdAt,
        updatedAt: properties.updatedAt,
      })
      .from(properties)
      .where(
        and(eq(properties.organizationId, id), eq(properties.isDeleted, false))
      )
      .orderBy(desc(properties.createdAt)),
  ]);

  // Return simplified client data structure
  return {
    // All organization data (fields from schema 251-302)
    id: client.id,
    clientId: client.clientId,
    name: client.name,
    legalName: client.legalName,
    clientTypeId: client.clientTypeId,
    clientTypeName: client.clientTypeName,
    status: client.status,
    priority: client.priority,
    industryClassificationId: client.industryClassificationId,
    industryName: client.industryName,
    taxId: client.taxId,
    website: client.website,
    numberOfEmployees: client.numberOfEmployees,
    streetAddress: client.streetAddress,
    city: client.city,
    state: client.state,
    zipCode: client.zipCode,
    creditLimit: client.creditLimit,
    paymentTerms: client.paymentTerms,
    preferredPaymentMethod: client.preferredPaymentMethod,
    billingContactId: client.billingContactId,
    billingDay: client.billingDay,
    taxExempt: client.taxExempt,
    description: client.description,
    notes: client.notes,
    tags: client.tags,
    createdBy: client.createdBy,
    isDeleted: client.isDeleted,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,

    // Primary contact info (including picture link)
    primaryContact: primaryContact
      ? {
          id: primaryContact.id,
          fullName: primaryContact.fullName,
          title: primaryContact.title,
          email: primaryContact.email,
          phone: primaryContact.phone || primaryContact.mobilePhone,
          picture: primaryContact.picture, // Picture link included as requested
          contactType: primaryContact.contactType,
          preferredContactMethod: primaryContact.preferredContactMethod,
          notes: primaryContact.notes,
        }
      : null,

    // All properties linked to this client
    properties: propertiesList.map((prop) => ({
      id: prop.id,
      propertyName: prop.propertyName,
      propertyCode: prop.propertyCode,
      propertyType: prop.propertyType,
      status: prop.status,
      addressLine1: prop.addressLine1,
      addressLine2: prop.addressLine2,
      city: prop.city,
      state: prop.state,
      zipCode: prop.zipCode,
      country: prop.country,
      squareFootage: prop.squareFootage,
      numberOfFloors: prop.numberOfFloors,
      yearBuilt: prop.yearBuilt,
      accessInstructions: prop.accessInstructions,
      gateCode: prop.gateCode,
      parkingInstructions: prop.parkingInstructions,
      operatingHours: prop.operatingHours,
      latitude: prop.latitude,
      longitude: prop.longitude,
      description: prop.description,
      notes: prop.notes,
      tags: prop.tags,
      createdBy: prop.createdBy,
      createdAt: prop.createdAt,
      updatedAt: prop.updatedAt,
    })),

    // Account summary (creation date, billing day, and last activity)
    accountSummary: {
      createdAt: client.createdAt,
      billingDay: client.billingDay,
      accountStatus: client.status,
      lastActivity: client.updatedAt,
    },
  };
};

// Create new client with contacts and properties
export const createClient = async (data: {
  name: string;
  legalName?: string;
  clientTypeId?: number;
  status?: string;
  priority?: string;
  industryClassificationId?: number;
  numberOfEmployees?: number;
  taxId?: string;
  website?: string;
  companyLogo?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  creditLimit?: string | number;
  paymentTerms?: string;
  preferredPaymentMethod?: string;
  billingContactId?: string;
  taxExempt?: boolean;
  description?: string;
  notes?: string;
  tags?: any;
  createdBy?: string;
  contacts?: Array<{
    fullName: string;
    title?: string;
    email?: string;
    phone?: string;
    mobilePhone?: string;
    picture?: string;
    contactType?:
      | "primary"
      | "billing"
      | "technical"
      | "emergency"
      | "project_manager";
    isPrimary?: boolean;
    preferredContactMethod?: string;
    notes?: string;
  }>;
  properties?: Array<{
    propertyName: string;
    propertyType?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    zipCode: string;
    numberOfUnits?: string;
  }>;
}) => {
  // Generate unique client ID
  const clientId = await generateClientId();

  // Create client
  const result = await db
    .insert(organizations)
    .values({
      clientId,
      name: data.name,
      legalName: data.legalName || null,
      clientTypeId: data.clientTypeId ? Number(data.clientTypeId) : null,
      status: (data.status as any) || "prospect",
      priority: (data.priority as any) || "medium",
      logo: data.companyLogo || null,
      industryClassificationId: data.industryClassificationId
        ? Number(data.industryClassificationId)
        : null,
      numberOfEmployees: data.numberOfEmployees
        ? Number(data.numberOfEmployees)
        : null,
      taxId: data.taxId || null,
      website: data.website || null,
      streetAddress: data.streetAddress || null,
      city: data.city || null,
      state: data.state || null,
      zipCode: data.zipCode || null,
      creditLimit: data.creditLimit
        ? typeof data.creditLimit === "string"
          ? data.creditLimit
          : data.creditLimit.toString()
        : null,
      paymentTerms: data.paymentTerms || null,
      preferredPaymentMethod: data.preferredPaymentMethod || null,
      billingContactId: data.billingContactId || null,
      taxExempt: data.taxExempt || false,
      description: data.description || null,
      notes: data.notes || null,
      tags: data.tags || null,
      createdBy: data.createdBy || null,
    })
    .returning();

  const client = Array.isArray(result) ? result[0] : (result as any);
  if (!client) {
    throw new Error("Failed to create client");
  }

  // Create contacts if provided
  const createdContacts = [];
  if (data.contacts && data.contacts.length > 0) {
    // Ensure only one primary contact
    let hasPrimary = false;
    const contactsToCreate = data.contacts.map((contact) => {
      if (contact.isPrimary && hasPrimary) {
        return { ...contact, isPrimary: false };
      }
      if (contact.isPrimary) {
        hasPrimary = true;
      }
      return contact;
    });

    // If no primary specified, make first one primary
    if (!hasPrimary && contactsToCreate.length > 0) {
      contactsToCreate[0]!.isPrimary = true;
    }

    for (const contactData of contactsToCreate) {
      const result = await db
        .insert(clientContacts)
        .values({
          organizationId: client.id,
          fullName: contactData.fullName,
          title: contactData.title || null,
          email: contactData.email || null,
          phone: contactData.phone || null,
          mobilePhone: contactData.mobilePhone || null,
          picture: contactData.picture || null,
          contactType: (contactData.contactType || "primary") as any,
          isPrimary: contactData.isPrimary || false,
          preferredContactMethod: contactData.preferredContactMethod || null,
          notes: contactData.notes || null,
        })
        .returning();
      createdContacts.push(result[0]);
    }
  }

  // Create properties if provided
  const createdProperties = [];
  if (data.properties && data.properties.length > 0) {
    for (const propertyData of data.properties) {
      const result = await db
        .insert(properties)
        .values({
          organizationId: client.id,
          propertyName: propertyData.propertyName,
          propertyType: (propertyData.propertyType || "commercial") as any,
          status: "active" as any,
          addressLine1: propertyData.addressLine1,
          addressLine2: propertyData.addressLine2 || null,
          city: propertyData.city,
          state: propertyData.state,
          zipCode: propertyData.zipCode,
          country: "USA",
          // Store numberOfUnits in tags or description
          tags: propertyData.numberOfUnits
            ? { numberOfUnits: propertyData.numberOfUnits }
            : null,
          createdBy: data.createdBy || null,
        })
        .returning();
      createdProperties.push(result[0]);
    }
  }

  return {
    ...client,
    contacts: createdContacts,
    properties: createdProperties,
  };
};

// Update client
export const updateClient = async (id: string, data: any) => {
  const updateData = {
    ...data,
    updatedAt: new Date(),
  };

  const result = await db
    .update(organizations)
    .set(updateData)
    .where(eq(organizations.id, id))
    .returning();

  return result[0] || null;
};

// Update client settings only
export const updateClientSettings = async (
  id: string,
  data: {
    creditLimit?: string | number;
    paymentTerms?: string;
    preferredPaymentMethod?: string;
    billingContactId?: string;
    billingDay?: number;
    taxExempt?: boolean;
  }
) => {
  // Prepare update data with only settings fields
  const updateData: any = {
    updatedAt: new Date(),
  };

  // Handle creditLimit conversion
  if (data.creditLimit !== undefined) {
    updateData.creditLimit = data.creditLimit
      ? typeof data.creditLimit === "string"
        ? data.creditLimit
        : data.creditLimit.toString()
      : null;
  }

  // Add other fields if provided
  if (data.paymentTerms !== undefined) {
    updateData.paymentTerms = data.paymentTerms || null;
  }
  if (data.preferredPaymentMethod !== undefined) {
    updateData.preferredPaymentMethod = data.preferredPaymentMethod || null;
  }
  if (data.billingContactId !== undefined) {
    updateData.billingContactId = data.billingContactId || null;
  }
  if (data.billingDay !== undefined) {
    updateData.billingDay = data.billingDay || null;
  }
  if (data.taxExempt !== undefined) {
    updateData.taxExempt = data.taxExempt;
  }

  const result = await db
    .update(organizations)
    .set(updateData)
    .where(eq(organizations.id, id))
    .returning();

  return result[0] || null;
};

// Soft delete client and all related entities (cascade soft delete)
export const deleteClient = async (id: string) => {
  // Use a transaction to ensure all deletions succeed or fail together
  const result = await db.transaction(async (tx) => {
    const now = new Date();

    // 1. Soft delete the client/organization
    const deletedClient = await tx
      .update(organizations)
      .set({
        isDeleted: true,
        updatedAt: now,
      })
      .where(eq(organizations.id, id))
      .returning();

    if (!deletedClient[0]) {
      return null;
    }

    // 2. Get all properties for this client (to soft delete property-related entities)
    const clientProperties = await tx
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.organizationId, id));

    const propertyIds = clientProperties.map((p) => p.id);

    // 3. Soft delete property-related entities if there are properties
    if (propertyIds.length > 0) {
      // 3a. Soft delete property contacts
      await tx
        .update(propertyContacts)
        .set({
          isDeleted: true,
          updatedAt: now,
        })
        .where(inArray(propertyContacts.propertyId, propertyIds));

      // 3b. Soft delete property equipment
      await tx
        .update(propertyEquipment)
        .set({
          isDeleted: true,
          updatedAt: now,
        })
        .where(inArray(propertyEquipment.propertyId, propertyIds));

      // 3c. Soft delete property documents
      await tx
        .update(propertyDocuments)
        .set({
          isDeleted: true,
          updatedAt: now,
        })
        .where(inArray(propertyDocuments.propertyId, propertyIds));

      // 3d. Soft delete property service history
      await tx
        .update(propertyServiceHistory)
        .set({
          isDeleted: true,
        })
        .where(inArray(propertyServiceHistory.propertyId, propertyIds));
    }

    // 4. Soft delete all client properties
    await tx
      .update(properties)
      .set({
        isDeleted: true,
        updatedAt: now,
      })
      .where(eq(properties.organizationId, id));

    // 5. Soft delete all client contacts
    await tx
      .update(clientContacts)
      .set({
        isDeleted: true,
        updatedAt: now,
      })
      .where(eq(clientContacts.organizationId, id));

    // 6. Soft delete all client documents
    await tx
      .update(clientDocuments)
      .set({
        isDeleted: true,
        updatedAt: now,
      })
      .where(eq(clientDocuments.organizationId, id));

    // 7. Soft delete all client notes
    await tx
      .update(clientNotes)
      .set({
        isDeleted: true,
        updatedAt: now,
      })
      .where(eq(clientNotes.organizationId, id));

    // 8. Soft delete all user-organization relationships
    await tx
      .update(userOrganizations)
      .set({
        isDeleted: true,
        updatedAt: now,
      })
      .where(eq(userOrganizations.organizationId, id));

    return deletedClient[0];
  });

  return result;
};

// Client Contacts Management
export const createClientContact = async (data: {
  organizationId: string;
  fullName: string;
  title?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  picture?: string;
  contactType:
    | "primary"
    | "billing"
    | "technical"
    | "emergency"
    | "project_manager";
  isPrimary?: boolean;
  preferredContactMethod?: string;
  notes?: string;
}) => {
  const result = await db.insert(clientContacts).values(data).returning();

  return result[0];
};

export const updateClientContact = async (id: string, data: any) => {
  const result = await db
    .update(clientContacts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(clientContacts.id, id))
    .returning();

  return result[0] || null;
};

// Client Notes Management
export const createClientNote = async (data: {
  organizationId: string;
  noteType?: string;
  subject?: string;
  content: string;
  createdBy: string;
}) => {
  const result = await db.insert(clientNotes).values(data).returning();

  return result[0];
};

export const getClientNotes = async (organizationId: string, limit = 20) => {
  return await db
    .select({
      note: clientNotes,
      createdBy: {
        id: users.id,
        fullName: users.fullName,
      },
    })
    .from(clientNotes)
    .leftJoin(users, eq(clientNotes.createdBy, users.id))
    .where(
      and(
        eq(clientNotes.organizationId, organizationId),
        eq(clientNotes.isDeleted, false)
      )
    )
    .orderBy(desc(clientNotes.createdAt))
    .limit(limit);
};

// Client Types Management
export const createClientType = async (data: {
  name: string;
  description?: string;
  sortOrder?: number;
}) => {
  const result = await db
    .insert(clientTypes)
    .values({
      name: data.name,
      description: data.description || null,
      sortOrder: data.sortOrder || 0,
    })
    .returning();

  return Array.isArray(result) ? result[0] : result;
};

// Update client type
export const updateClientType = async (
  id: number,
  data: {
    name?: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
  }
) => {
  const result = await db
    .update(clientTypes)
    .set({
      name: data.name,
      description: data.description,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(clientTypes.id, id))
    .returning();

  return Array.isArray(result) ? result[0] : null;
};

// Delete client type (soft delete)
export const deleteClientType = async (id: number) => {
  const result = await db
    .update(clientTypes)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(clientTypes.id, id))
    .returning();

  return Array.isArray(result) && result.length > 0;
};

// Industry Classifications Management
export const createIndustryClassification = async (data: {
  name: string;
  code?: string;
  description?: string;
  sortOrder?: number;
}) => {
  const result = await db
    .insert(industryClassifications)
    .values({
      name: data.name,
      code: data.code || null,
      description: data.description || null,
      sortOrder: data.sortOrder || 0,
    })
    .returning();

  return Array.isArray(result) ? result[0] : result;
};

export const updateIndustryClassification = async (id: number, data: any) => {
  const result = await db
    .update(industryClassifications)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(industryClassifications.id, id))
    .returning();

  return result[0] || null;
};

// Delete industry classification (soft delete)
export const deleteIndustryClassification = async (id: number) => {
  const result = await db
    .update(industryClassifications)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(industryClassifications.id, id))
    .returning();

  return Array.isArray(result) && result.length > 0;
};

// Document Categories Management
export const getDocumentCategories = async () => {
  return await db
    .select()
    .from(documentCategories)
    .where(eq(documentCategories.isActive, true))
    .orderBy(documentCategories.sortOrder, documentCategories.name);
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
      name: data.name,
      description: data.description || null,
      color: data.color || null,
      sortOrder: data.sortOrder || 0,
    })
    .returning();

  return Array.isArray(result) ? result[0] : result;
};

export const updateDocumentCategory = async (id: number, data: any) => {
  const result = await db
    .update(documentCategories)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(documentCategories.id, id))
    .returning();

  return result[0] || null;
};

// Document Category Assignments
export const assignDocumentCategories = async (
  documentId: string,
  categoryIds: number[]
) => {
  // Remove existing categories
  await db
    .delete(clientDocumentCategories)
    .where(eq(clientDocumentCategories.documentId, documentId));

  // Add new categories
  if (categoryIds.length > 0) {
    const assignments = categoryIds.map((categoryId) => ({
      documentId,
      categoryId,
    }));

    await db.insert(clientDocumentCategories).values(assignments);
  }

  return true;
};

export const getDocumentCategories2 = async (documentId: string) => {
  return await db
    .select({
      id: documentCategories.id,
      name: documentCategories.name,
      description: documentCategories.description,
      color: documentCategories.color,
    })
    .from(documentCategories)
    .innerJoin(
      clientDocumentCategories,
      eq(clientDocumentCategories.categoryId, documentCategories.id)
    )
    .where(eq(clientDocumentCategories.documentId, documentId))
    .orderBy(documentCategories.sortOrder, documentCategories.name);
};

// Get Client KPIs for dashboard
export const getClientKPIs = async () => {
  // Calculate date range for current month
  const currentDate = new Date();
  const startOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );
  const endOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  );

  // Format dates as YYYY-MM-DD strings for date column comparison
  const startOfMonthStr = startOfMonth.toISOString().split("T")[0];
  const endOfMonthStr = endOfMonth.toISOString().split("T")[0];

  // OPTIMIZATION: Run all queries in parallel for maximum performance
  const [
    totalClientsResult,
    activeClientsResult,
    pendingOrdersResult,
    totalRevenueResult,
    newThisMonthResult,
  ] = await Promise.all([
    // 1. Total Clients (all non-deleted clients)
    db
      .select({
        count: count(),
      })
      .from(organizations)
      .where(eq(organizations.isDeleted, false)),

    // 2. Active Clients (clients with status "active")
    db
      .select({
        count: count(),
      })
      .from(organizations)
      .where(
        and(
          eq(organizations.isDeleted, false),
          eq(organizations.status, "active" as any)
        )
      ),

    // 3. Pending Orders (bids with status "pending")
    db
      .select({
        count: count(),
      })
      .from(bidsTable)
      .where(
        and(
          eq(bidsTable.isDeleted, false),
          eq(bidsTable.status, "pending" as any)
        )
      ),

    // 4. Total Revenue (sum of totalPaid from jobFinancialSummary)
    db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${jobFinancialSummary.totalPaid} AS NUMERIC)), 0)`,
      })
      .from(jobFinancialSummary),

    // 5. New This Month (clients created this month)
    db.execute<{ count: string }>(
      sql.raw(`
        SELECT COUNT(*)::text as count
        FROM org.organizations
        WHERE is_deleted = false
          AND DATE(created_at) >= '${startOfMonthStr}'::date
          AND DATE(created_at) <= '${endOfMonthStr}'::date
      `)
    ),
  ]);

  // Extract values
  const totalClients = Number(totalClientsResult[0]?.count || 0);
  const activeClients = Number(activeClientsResult[0]?.count || 0);
  const pendingOrders = Number(pendingOrdersResult[0]?.count || 0);
  const totalRevenue = Number(totalRevenueResult[0]?.totalRevenue || 0);
  const newThisMonth = Number(newThisMonthResult.rows?.[0]?.count || 0);

  // Format revenue (convert to millions if >= 1M, otherwise show as thousands)
  let formattedRevenue: string;
  if (totalRevenue >= 1000000) {
    formattedRevenue = `$${(totalRevenue / 1000000).toFixed(1)}M`;
  } else if (totalRevenue >= 1000) {
    formattedRevenue = `$${(totalRevenue / 1000).toFixed(0)}K`;
  } else {
    formattedRevenue = `$${totalRevenue.toFixed(0)}`;
  }

  return {
    totalClients: {
      value: totalClients,
      label: "Total Clients",
    },
    activeClients: {
      value: activeClients,
      label: "Active Clients",
    },
    pendingOrders: {
      value: pendingOrders,
      label: "Pending Orders",
    },
    totalRevenue: {
      value: formattedRevenue,
      label: "Total Revenue",
      rawValue: totalRevenue,
    },
    newThisMonth: {
      value: newThisMonth,
      label: "New This Month",
    },
  };
};

// Client Documents Management
export const createClientDocument = async (data: {
  organizationId: string;
  fileName: string;
  filePath: string;
  fileType?: string;
  fileSize?: number;
  description?: string;
  categoryIds?: number[];
  uploadedBy: string;
}) => {
  // Create the document
  const result = await db
    .insert(clientDocuments)
    .values({
      organizationId: data.organizationId,
      fileName: data.fileName,
      filePath: data.filePath,
      fileType: data.fileType || null,
      fileSize: data.fileSize || null,
      description: data.description || null,
      uploadedBy: data.uploadedBy,
    })
    .returning();

  const document = Array.isArray(result) ? result[0] : result;

  if (!document) {
    throw new Error("Failed to create document");
  }

  // Assign categories if provided
  if (data.categoryIds && data.categoryIds.length > 0) {
    await assignDocumentCategories(document.id, data.categoryIds);
  }

  return document;
};

export const getClientDocumentById = async (documentId: string) => {
  // Get document with uploader info
  const documentQuery = await db
    .select({
      document: clientDocuments,
      uploadedBy: {
        id: users.id,
        fullName: users.fullName,
      },
    })
    .from(clientDocuments)
    .leftJoin(users, eq(clientDocuments.uploadedBy, users.id))
    .where(
      and(
        eq(clientDocuments.id, documentId),
        eq(clientDocuments.isDeleted, false)
      )
    )
    .limit(1);

  if (!documentQuery.length) {
    return null;
  }

  const doc = documentQuery[0];
  if (!doc) {
    return null;
  }

  // Get document categories
  const categories = await db
    .select({
      id: documentCategories.id,
      name: documentCategories.name,
      color: documentCategories.color,
    })
    .from(documentCategories)
    .innerJoin(
      clientDocumentCategories,
      eq(clientDocumentCategories.categoryId, documentCategories.id)
    )
    .where(eq(clientDocumentCategories.documentId, documentId));

  return {
    id: doc.document.id,
    organizationId: doc.document.organizationId,
    fileName: doc.document.fileName,
    filePath: doc.document.filePath,
    fileType: doc.document.fileType,
    fileSize: doc.document.fileSize,
    description: doc.document.description,
    categories: categories,
    uploadedBy: doc.uploadedBy?.fullName || "Unknown",
    uploadedAt: doc.document.createdAt,
    updatedAt: doc.document.updatedAt,
  };
};

export const deleteClientDocument = async (documentId: string) => {
  // Soft delete the document
  const result = await db
    .update(clientDocuments)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(eq(clientDocuments.id, documentId))
    .returning();

  const document = Array.isArray(result) ? result[0] : result;

  if (document) {
    // Remove category associations
    await db
      .delete(clientDocumentCategories)
      .where(eq(clientDocumentCategories.documentId, documentId));
  }

  return document || null;
};

export const updateClientDocument = async (documentId: string, data: any) => {
  const updateData = {
    ...data,
    updatedAt: new Date(),
  };

  const result = await db
    .update(clientDocuments)
    .set(updateData)
    .where(eq(clientDocuments.id, documentId))
    .returning();

  return result[0] || null;
};

export const createCategoryAndAssignToDocument = async (
  documentId: string,
  categoryData: {
    name: string;
    description?: string;
    color?: string;
    sortOrder?: number;
  }
) => {
  // First, check if the document exists and is not deleted
  const document = await db
    .select()
    .from(clientDocuments)
    .where(
      and(
        eq(clientDocuments.id, documentId),
        eq(clientDocuments.isDeleted, false)
      )
    )
    .limit(1);

  if (!document.length) {
    throw new Error("Document not found");
  }

  // Check if a category with the same name already exists
  const existingCategory = await db
    .select()
    .from(documentCategories)
    .where(eq(documentCategories.name, categoryData.name))
    .limit(1);

  let category;
  if (existingCategory.length) {
    // Use existing category
    category = existingCategory[0];
  } else {
    // Create new category
    const result = await db
      .insert(documentCategories)
      .values({
        name: categoryData.name,
        description: categoryData.description || null,
        color: categoryData.color || null,
        sortOrder: categoryData.sortOrder || null,
        isActive: true,
      })
      .returning();
    category = Array.isArray(result) ? result[0] : result;
  }

  // Check if the document is already assigned to this category
  const existingAssignment = await db
    .select()
    .from(clientDocumentCategories)
    .where(
      and(
        eq(clientDocumentCategories.documentId, documentId),
        eq(clientDocumentCategories.categoryId, category.id)
      )
    )
    .limit(1);

  // If not already assigned, create the assignment
  if (!existingAssignment.length) {
    await db.insert(clientDocumentCategories).values({
      documentId: documentId,
      categoryId: category.id,
    });
  }

  return {
    category,
    document: document[0],
    wasNewCategory: !existingCategory.length,
    wasAlreadyAssigned: existingAssignment.length > 0,
  };
};

export const removeDocumentCategoryLink = async (
  documentId: string,
  categoryId: number
) => {
  // First, check if the document exists and is not deleted
  const document = await db
    .select()
    .from(clientDocuments)
    .where(
      and(
        eq(clientDocuments.id, documentId),
        eq(clientDocuments.isDeleted, false)
      )
    )
    .limit(1);

  if (!document.length) {
    throw new Error("Document not found");
  }

  // Check if the category exists
  const category = await db
    .select()
    .from(documentCategories)
    .where(eq(documentCategories.id, categoryId))
    .limit(1);

  if (!category.length) {
    throw new Error("Category not found");
  }

  // Check if the link exists
  const existingLink = await db
    .select()
    .from(clientDocumentCategories)
    .where(
      and(
        eq(clientDocumentCategories.documentId, documentId),
        eq(clientDocumentCategories.categoryId, categoryId)
      )
    )
    .limit(1);

  if (!existingLink.length) {
    throw new Error("Document is not linked to this category");
  }

  // Count how many documents are linked to this category
  const linkedDocumentsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(clientDocumentCategories)
    .where(eq(clientDocumentCategories.categoryId, categoryId));

  const totalLinkedDocuments = linkedDocumentsCount[0]?.count || 0;

  // Remove the link
  await db
    .delete(clientDocumentCategories)
    .where(
      and(
        eq(clientDocumentCategories.documentId, documentId),
        eq(clientDocumentCategories.categoryId, categoryId)
      )
    );

  let categoryDeleted = false;

  // If this was the only document linked to the category, delete the category
  if (totalLinkedDocuments <= 1) {
    await db
      .delete(documentCategories)
      .where(eq(documentCategories.id, categoryId));
    categoryDeleted = true;
  }

  return {
    category: category[0],
    document: document[0],
    linkRemoved: true,
    categoryDeleted,
    remainingLinkedDocuments: totalLinkedDocuments - 1,
  };
};
