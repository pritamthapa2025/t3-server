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
  properties,
} from "../drizzle/schema/org.schema.js";
import { jobs, jobFinancialSummary } from "../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";

// Get all clients with pagination and optional filtering
export const getClients = async (
  offset: number,
  limit: number,
  filters?: {
    status?: string | string[];
    clientType?: string;
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

  if (filters?.clientType) {
    whereConditions.push(
      eq(organizations.clientType, filters.clientType as any)
    );
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
        ilike(organizations.billingCity, searchTerm),
        ilike(organizations.billingState, searchTerm),
        matchingOrgIds.length > 0
          ? inArray(organizations.id, matchingOrgIds)
          : sql`1 = 0` // No match if no contact matches
      )!
    );
  }

  // Get clients with basic info
  const clientsResult = await db
    .select({
      // Client data
      id: organizations.id,
      name: organizations.name,
      legalName: organizations.legalName,
      clientType: organizations.clientType,
      status: organizations.status,
      industryClassification: organizations.industryClassification,
      website: organizations.website,
      creditLimit: organizations.creditLimit,
      paymentTerms: organizations.paymentTerms,
      billingAddressLine1: organizations.billingAddressLine1,
      billingAddressLine2: organizations.billingAddressLine2,
      billingCity: organizations.billingCity,
      billingState: organizations.billingState,
      billingZipCode: organizations.billingZipCode,
      tags: organizations.tags,
      createdAt: organizations.createdAt,

      // Account Manager
      accountManagerId: users.id,
      accountManagerName: users.fullName,
    })
    .from(organizations)
    .leftJoin(users, eq(organizations.accountManager, users.id))
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

  // Enrich each client with contact, financial, and activity data
  const enrichedClients = await Promise.all(
    clientsResult.map(async (client) => {
      // Get primary contact
      const [primaryContact] = await db
        .select()
        .from(clientContacts)
        .where(
          and(
            eq(clientContacts.organizationId, client.id),
            eq(clientContacts.isPrimary, true),
            eq(clientContacts.isDeleted, false)
          )
        )
        .limit(1);

      // If no primary contact, get first contact
      const contact =
        primaryContact ||
        (await db
          .select()
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
        ...client,
        contact: contact
          ? {
              name: contact.fullName,
              email: contact.email || null,
              phone: contact.phone || contact.mobilePhone || null,
            }
          : null,
        finance: {
          totalPaid: totalPaid,
          totalOutstanding: totalOutstanding > 0 ? totalOutstanding : 0,
        },
        activity: {
          activeJobs: activeJobs,
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
  // Get client basic info
  const clientQuery = await db
    .select({
      client: organizations,
      accountManager: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      },
    })
    .from(organizations)
    .leftJoin(users, eq(organizations.accountManager, users.id))
    .where(and(eq(organizations.id, id), eq(organizations.isDeleted, false)))
    .limit(1);

  if (!clientQuery.length) {
    return null;
  }

  const baseData = clientQuery[0]!;
  const client = baseData.client;

  // Run all queries in parallel for performance
  const [
    contactsList,
    propertiesList,
    jobsList,
    financialSummaries,
    documentsList,
    bidsList,
  ] = await Promise.all([
    // Get all contacts
    db
      .select()
      .from(clientContacts)
      .where(
        and(
          eq(clientContacts.organizationId, id),
          eq(clientContacts.isDeleted, false)
        )
      )
      .orderBy(desc(clientContacts.isPrimary), desc(clientContacts.createdAt)),

    // Get all properties
    db
      .select()
      .from(properties)
      .where(
        and(eq(properties.organizationId, id), eq(properties.isDeleted, false))
      )
      .orderBy(desc(properties.createdAt)),

    // Get all jobs
    db
      .select()
      .from(jobs)
      .where(and(eq(jobs.organizationId, id), eq(jobs.isDeleted, false)))
      .orderBy(desc(jobs.createdAt)),

    // Get financial summaries for invoicing
    db
      .select()
      .from(jobFinancialSummary)
      .where(eq(jobFinancialSummary.organizationId, id))
      .orderBy(desc(jobFinancialSummary.updatedAt)),

    // Get all documents
    db
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
          eq(clientDocuments.organizationId, id),
          eq(clientDocuments.isDeleted, false)
        )
      )
      .orderBy(desc(clientDocuments.createdAt)),

    // Get all bids for win rate calculation
    db
      .select()
      .from(bidsTable)
      .where(
        and(eq(bidsTable.organizationId, id), eq(bidsTable.isDeleted, false))
      ),
  ]);

  // Get primary contact
  const primaryContact =
    contactsList.find((c) => c.isPrimary) || contactsList[0] || null;

  // Calculate KPIs
  const totalRevenue = Number(
    financialSummaries.reduce((sum, fs) => sum + Number(fs.totalPaid || 0), 0)
  );

  const activeJobs = jobsList.filter((job) =>
    ["planned", "scheduled", "in_progress", "on_hold"].includes(job.status)
  ).length;

  const totalBids = bidsList.length;
  const wonBids = bidsList.filter(
    (bid) => bid.status === "won" || bid.status === "accepted"
  ).length;
  const winRate = totalBids > 0 ? Math.round((wonBids / totalBids) * 100) : 0;

  const totalInvoiced = Number(
    financialSummaries.reduce(
      (sum, fs) => sum + Number(fs.totalInvoiced || 0),
      0
    )
  );
  const totalPaid = Number(
    financialSummaries.reduce((sum, fs) => sum + Number(fs.totalPaid || 0), 0)
  );
  const outstanding = totalInvoiced - totalPaid;

  const totalProjects = jobsList.length;

  // Calculate risk level (simplified - can be enhanced)
  let riskLevel = "Low";
  if (outstanding > 50000) {
    riskLevel = "High";
  } else if (outstanding > 25000) {
    riskLevel = "Medium";
  }

  // Format properties with units
  const formattedProperties = propertiesList.map((prop) => {
    const tags = prop.tags as any;
    const numberOfUnits = tags?.numberOfUnits || tags?.number_of_units || null;
    return {
      id: prop.id,
      propertyName: prop.propertyName,
      propertyCode: prop.propertyCode,
      propertyType: prop.propertyType,
      addressLine1: prop.addressLine1,
      addressLine2: prop.addressLine2,
      city: prop.city,
      state: prop.state,
      zipCode: prop.zipCode,
      numberOfUnits: numberOfUnits,
    };
  });

  // Format contacts
  const formattedContacts = contactsList.map((contact) => ({
    id: contact.id,
    fullName: contact.fullName,
    title: contact.title,
    email: contact.email,
    phone: contact.phone || contact.mobilePhone,
    isPrimary: contact.isPrimary,
    contactType: contact.contactType,
    notes: contact.notes,
  }));

  // Format jobs
  const formattedJobs = jobsList.map((job) => ({
    id: job.id,
    jobNumber: job.jobNumber,
    name: job.name,
    description: job.description,
    status: job.status,
    priority: job.priority,
    jobType: job.jobType,
    serviceType: job.serviceType,
    scheduledStartDate: job.scheduledStartDate,
    scheduledEndDate: job.scheduledEndDate,
    siteAddress: job.siteAddress,
    contractValue: job.contractValue,
    completionPercentage: job.completionPercentage,
  }));

  // Format invoices from jobFinancialSummary
  const formattedInvoices = financialSummaries.map((fs, index) => {
    const invoiceAmount = Number(fs.totalInvoiced || 0);
    const paidAmount = Number(fs.totalPaid || 0);
    const outstandingAmount = invoiceAmount - paidAmount;

    let status = "Paid";
    if (outstandingAmount > 0 && paidAmount > 0) {
      status = "Partial";
    } else if (outstandingAmount > 0) {
      status = "Unpaid";
    }

    return {
      id: fs.id,
      invoiceId: `INV-${
        fs.jobId?.substring(0, 8).toUpperCase() ||
        `2025-${String(index + 1).padStart(3, "0")}`
      }`,
      date: fs.updatedAt || new Date(),
      amount: invoiceAmount,
      paid: paidAmount,
      outstanding: outstandingAmount,
      status: status,
      jobId: fs.jobId,
    };
  });

  // Format documents
  const formattedDocuments = documentsList.map((doc) => ({
    id: doc.document.id,
    fileName: doc.document.fileName,
    filePath: doc.document.filePath,
    fileType: doc.document.fileType,
    fileSize: doc.document.fileSize,
    documentType: doc.document.documentType,
    description: doc.document.description,
    uploadedBy: doc.uploadedBy?.fullName || "Unknown",
    uploadedAt: doc.document.createdAt,
    updatedAt: doc.document.updatedAt,
  }));

  // Extract logo from tags
  const tags = client.tags as any;
  const companyLogo =
    (Array.isArray(tags) ? tags.find((t: any) => t?.logo)?.logo : tags?.logo) ||
    null;

  // Get last activity (most recent update from jobs, bids, or client itself)
  const lastActivityDates = [
    client.updatedAt,
    ...jobsList.map((j) => j.updatedAt).filter(Boolean),
    ...bidsList.map((b) => b.updatedAt).filter(Boolean),
  ].filter(Boolean) as Date[];
  const lastActivity =
    lastActivityDates.length > 0
      ? new Date(Math.max(...lastActivityDates.map((d) => d.getTime())))
      : client.createdAt;

  // Structure response by tabs
  return {
    id: client.id,
    name: client.name,
    legalName: client.legalName,
    clientType: client.clientType,
    companyLogo: companyLogo,
    tags: client.tags,

    // Overview tab
    overview: {
      kpis: {
        totalRevenue: totalRevenue,
        activeJobs: activeJobs,
        winRate: winRate,
        outstanding: outstanding > 0 ? outstanding : 0,
        totalProjects: totalProjects,
        riskLevel: riskLevel,
      },
      businessInformation: {
        clientId: client.id.substring(0, 8).toUpperCase(), // Simplified ID
        businessType: client.clientType,
        website: client.website,
        industry: client.industryClassification,
        employees: null, // Not in schema, can be added to tags
        priorityLevel: client.status,
      },
      properties: formattedProperties,
      primaryContact: primaryContact
        ? {
            id: primaryContact.id,
            name: primaryContact.fullName,
            email: primaryContact.email,
            phone: primaryContact.phone || primaryContact.mobilePhone,
            title: primaryContact.title,
          }
        : null,
      accountSummary: {
        accountStatus: client.status,
        clientSince: client.createdAt,
        lastActivity: lastActivity,
      },
    },

    // Contacts tab
    contacts: formattedContacts,

    // Jobs tab
    jobs: formattedJobs,

    // Invoicing tab
    invoicing: formattedInvoices,

    // Documents tab
    documents: formattedDocuments,

    // Settings tab
    settings: {
      paymentTerms: client.paymentTerms,
      creditLimit: client.creditLimit,
      billingContact: primaryContact
        ? {
            id: primaryContact.id,
            name: primaryContact.fullName,
          }
        : null,
      paymentMethod: client.preferredPaymentMethod,
      taxExempt: false, // Can be stored in tags or added to schema
      preferredBillingDate: null, // Can be added to schema
    },
  };
};

// Create new client with contacts and properties
export const createClient = async (data: {
  name: string;
  legalName?: string;
  clientType: string;
  status?: string;
  industryClassification?: string;
  taxId?: string;
  website?: string;
  companyLogo?: string;
  creditLimit?: string | number;
  paymentTerms?: string;
  preferredPaymentMethod?: string;
  taxExemptStatus?: boolean;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingCity?: string;
  billingState?: string;
  billingZipCode?: string;
  billingCountry?: string;
  description?: string;
  notes?: string;
  tags?: any;
  accountManager?: string;
  createdBy?: string;
  contacts?: Array<{
    fullName: string;
    title?: string;
    email?: string;
    phone?: string;
    mobilePhone?: string;
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
  // Prepare tags - include logo if provided
  let tags = data.tags || [];
  if (data.companyLogo) {
    tags = Array.isArray(tags)
      ? [...tags, { logo: data.companyLogo }]
      : [{ logo: data.companyLogo }];
  }

  // Create client
  const result = await db
    .insert(organizations)
    .values({
      name: data.name,
      legalName: data.legalName || null,
      clientType: data.clientType as any,
      status: (data.status as any) || "prospect",
      industryClassification: data.industryClassification || null,
      taxId: data.taxId || null,
      website: data.website || null,
      creditLimit: data.creditLimit
        ? typeof data.creditLimit === "string"
          ? data.creditLimit
          : data.creditLimit.toString()
        : null,
      paymentTerms: data.paymentTerms || null,
      preferredPaymentMethod: data.preferredPaymentMethod || null,
      billingAddressLine1: data.billingAddressLine1 || null,
      billingAddressLine2: data.billingAddressLine2 || null,
      billingCity: data.billingCity || null,
      billingState: data.billingState || null,
      billingZipCode: data.billingZipCode || null,
      billingCountry: data.billingCountry || "USA",
      description: data.description || null,
      notes: data.notes || null,
      tags: tags,
      accountManager: data.accountManager || null,
      createdBy: data.createdBy || null,
    })
    .returning();

  const client = Array.isArray(result) ? result[0] : (result as any);
  if (!client) {
    throw new Error("Failed to create client");
  }

  const clientId = client.id;

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
      const [contact] = await db
        .insert(clientContacts)
        .values({
          organizationId: clientId,
          fullName: contactData.fullName,
          title: contactData.title || null,
          email: contactData.email || null,
          phone: contactData.phone || null,
          mobilePhone: contactData.mobilePhone || null,
          contactType: (contactData.contactType || "primary") as any,
          isPrimary: contactData.isPrimary || false,
          preferredContactMethod: contactData.preferredContactMethod || null,
          notes: contactData.notes || null,
        })
        .returning();
      createdContacts.push(contact);
    }
  }

  // Create properties if provided
  const createdProperties = [];
  if (data.properties && data.properties.length > 0) {
    for (const propertyData of data.properties) {
      const [property] = await db
        .insert(properties)
        .values({
          organizationId: clientId,
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
      createdProperties.push(property);
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

  const [client] = await db
    .update(organizations)
    .set(updateData)
    .where(eq(organizations.id, id))
    .returning();

  return client || null;
};

// Soft delete client
export const deleteClient = async (id: string) => {
  const [client] = await db
    .update(organizations)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, id))
    .returning();

  return client || null;
};

// Client Contacts Management
export const createClientContact = async (data: {
  organizationId: string;
  fullName: string;
  title?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
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
  const [contact] = await db.insert(clientContacts).values(data).returning();

  return contact;
};

export const updateClientContact = async (id: string, data: any) => {
  const [contact] = await db
    .update(clientContacts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(clientContacts.id, id))
    .returning();

  return contact || null;
};

// Client Notes Management
export const createClientNote = async (data: {
  organizationId: string;
  noteType?: string;
  subject?: string;
  content: string;
  createdBy: string;
}) => {
  const [note] = await db.insert(clientNotes).values(data).returning();

  return note;
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
