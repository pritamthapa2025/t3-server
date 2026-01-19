import {
  count,
  eq,
  desc,
  and,
  ilike,
  or,
  sql,
  inArray,
} from "drizzle-orm";
import { db } from "../config/db.js";
import {
  properties,
  propertyContacts,
  propertyEquipment,
  propertyDocuments,
  propertyServiceHistory,
  organizations,
} from "../drizzle/schema/client.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";

// Get properties with pagination and filtering
export const getProperties = async (
  offset: number,
  limit: number,
  filters?: {
    organizationId?: string;
    propertyType?: string;
    status?: string;
    city?: string;
    state?: string;
    search?: string;
  }
) => {
  let whereConditions = [eq(properties.isDeleted, false)];

  // Add filters
  if (filters?.organizationId) {
    whereConditions.push(eq(properties.organizationId, filters.organizationId));
  }
  if (filters?.propertyType) {
    whereConditions.push(
      eq(properties.propertyType, filters.propertyType as any)
    );
  }

  // Handle status filter - support "under_service" which means properties with active jobs or status "under_construction"
  if (filters?.status) {
    if (
      filters.status === "under_service" ||
      filters.status === "Under Service"
    ) {
      // Get organization IDs that have active jobs (jobs are now linked through bid → organization)
      const organizationsWithActiveJobs = await db
        .selectDistinct({ organizationId: bidsTable.organizationId })
        .from(jobs)
        .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
        .where(
          and(
            eq(jobs.isDeleted, false),
            inArray(jobs.status, [
              "planned",
              "scheduled",
              "in_progress",
              "on_hold",
            ] as any)
          )
        );

      const organizationIdsWithActiveJobs = organizationsWithActiveJobs
        .map((j) => j.organizationId)
        .filter((id) => id !== null) as string[];
      
      // Get property IDs for these organizations
      const propertiesWithActiveJobs = organizationIdsWithActiveJobs.length > 0
        ? await db
            .select({ id: properties.id })
            .from(properties)
            .where(
              and(
                inArray(properties.organizationId, organizationIdsWithActiveJobs),
                eq(properties.isDeleted, false)
              )
            )
        : [];
      
      const propertyIdsWithActiveJobs = propertiesWithActiveJobs.map((p) => p.id);

      // Properties with status "under_construction" OR properties with active jobs
      if (propertyIdsWithActiveJobs.length > 0) {
        whereConditions.push(
          or(
            eq(properties.status, "under_construction" as any),
            inArray(properties.id, propertyIdsWithActiveJobs)
          )!
        );
      } else {
        // Only properties with status "under_construction" if no active jobs
        whereConditions.push(
          eq(properties.status, "under_construction" as any)
        );
      }
    } else {
      whereConditions.push(
        eq(properties.status, filters.status.toLowerCase() as any)
      );
    }
  }

  if (filters?.city) {
    whereConditions.push(ilike(properties.city, `%${filters.city}%`));
  }
  if (filters?.state) {
    whereConditions.push(eq(properties.state, filters.state));
  }

  // Enhanced search - includes organization name
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    whereConditions.push(
      or(
        ilike(properties.propertyName, searchTerm),
        ilike(properties.propertyCode, searchTerm),
        ilike(properties.addressLine1, searchTerm),
        ilike(properties.city, searchTerm),
        ilike(organizations.name, searchTerm)
      )!
    );
  }

  // Get properties with basic info
  const propertiesResult = await db
    .select({
      // Property data
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
      squareFootage: properties.squareFootage,
      numberOfFloors: properties.numberOfFloors,
      yearBuilt: properties.yearBuilt,
      tags: properties.tags,
      createdAt: properties.createdAt,

      // Client/Organization
      organizationId: organizations.id,
      organizationName: organizations.name,
    })
    .from(properties)
    .leftJoin(organizations, eq(properties.organizationId, organizations.id))
    .where(and(...whereConditions))
    .orderBy(desc(properties.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(properties)
    .leftJoin(organizations, eq(properties.organizationId, organizations.id))
    .where(and(...whereConditions));

  const total = totalResult[0]?.count ?? 0;

  // Optimize: Fetch all job counts and last service dates in bulk
  const propertyIds = propertiesResult.map((p) => p.id);

  // Get all job counts grouped by property
  const allJobsCounts = await db
    .select({
      propertyId: jobs.propertyId,
      totalJobs: sql<number>`COUNT(*)`,
    })
    .from(jobs)
    .where(
      and(inArray(jobs.propertyId, propertyIds), eq(jobs.isDeleted, false))
    )
    .groupBy(jobs.propertyId);

  // Get all active jobs counts grouped by property
  const activeJobsCounts = await db
    .select({
      propertyId: jobs.propertyId,
      activeJobs: sql<number>`COUNT(*)`,
    })
    .from(jobs)
    .where(
      and(
        inArray(jobs.propertyId, propertyIds),
        eq(jobs.isDeleted, false),
        inArray(jobs.status, [
          "planned",
          "scheduled",
          "in_progress",
          "on_hold",
        ] as any)
      )
    )
    .groupBy(jobs.propertyId);

  // Get last service dates for all properties using DISTINCT ON (PostgreSQL-specific)
  const lastServiceDatesResult =
    propertyIds.length > 0
      ? await db.execute<{ property_id: string; service_date: Date | null }>(
          sql.raw(`
          SELECT DISTINCT ON (property_id) 
            property_id, 
            service_date
          FROM org.property_service_history
          WHERE property_id = ANY(ARRAY[${propertyIds
            .map((id) => `'${id}'`)
            .join(",")}]::uuid[])
            AND is_deleted = false
          ORDER BY property_id, service_date DESC
        `)
        )
      : { rows: [] };

  const lastServiceDates = lastServiceDatesResult.rows || [];

  // Create lookup maps for O(1) access
  const totalJobsMap = new Map(
    allJobsCounts.map((j) => [j.propertyId, Number(j.totalJobs)])
  );
  const activeJobsMap = new Map(
    activeJobsCounts.map((j) => [j.propertyId, Number(j.activeJobs)])
  );
  const lastServiceMap = new Map(
    lastServiceDates.map((s) => [s.property_id, s.service_date])
  );

  // Enrich each property with job counts and last service date
  // Note: Jobs are now linked to organizations, so we use organizationId for mapping
  const enrichedProperties = propertiesResult.map((property) => {
    const totalJobs = property.organizationId ? totalJobsMap.get(property.organizationId) || 0 : 0;
    const activeJobs = property.organizationId ? activeJobsMap.get(property.organizationId) || 0 : 0;
    const lastService = lastServiceMap.get(property.id) || null;

    // Determine display status - if has active jobs, show "Under Service"
    let displayStatus: string = property.status;
    if (activeJobs > 0 && property.status !== "under_construction") {
      displayStatus = "under_service";
    }

    return {
      id: property.id,
      propertyName: property.propertyName,
      propertyCode: property.propertyCode,
      propertyType: property.propertyType,
      status: property.status,
      displayStatus: displayStatus, // For UI display
      addressLine1: property.addressLine1,
      addressLine2: property.addressLine2,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
      organizationId: property.organizationId,
      organizationName: property.organizationName,
      totalJobs: totalJobs,
      activeJobs: activeJobs,
      lastService: lastService,
      squareFootage: property.squareFootage,
      numberOfFloors: property.numberOfFloors,
      yearBuilt: property.yearBuilt,
      tags: property.tags,
      createdAt: property.createdAt,
    };
  });

  return {
    data: enrichedProperties,
    total: total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit: limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get property by ID with all related data
export const getPropertyById = async (id: string) => {
  // Get property basic info
  const propertyQuery = await db
    .select({
      property: properties,
      organization: {
        id: organizations.id,
        name: organizations.name,
        clientType: organizations.clientType,
      },
    })
    .from(properties)
    .leftJoin(organizations, eq(properties.organizationId, organizations.id))
    .where(and(eq(properties.id, id), eq(properties.isDeleted, false)))
    .limit(1);

  if (!propertyQuery.length) {
    return null;
  }

  const baseData = propertyQuery[0]!; // Safe because we checked length above
  const property = baseData.property;
  const organization = baseData.organization;

  // Get job counts - jobs are now linked through bid → organization
  // Since property belongs to organization, we count jobs for the organization
  const [totalJobsResult, activeJobsResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(jobs)
      .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(
        and(
          eq(bidsTable.organizationId, property.organizationId),
          eq(jobs.isDeleted, false)
        )
      ),
    db
      .select({ count: count() })
      .from(jobs)
      .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(
        and(
          eq(bidsTable.organizationId, property.organizationId),
          eq(jobs.isDeleted, false),
          inArray(jobs.status, [
            "planned",
            "scheduled",
            "in_progress",
            "on_hold",
          ] as any)
        )
      ),
  ]);

  const totalJobs = Number(totalJobsResult[0]?.count || 0);
  const activeJobs = Number(activeJobsResult[0]?.count || 0);

  // Get last service date
  const lastServiceResult = await db
    .select({
      serviceDate: propertyServiceHistory.serviceDate,
    })
    .from(propertyServiceHistory)
    .where(
      and(
        eq(propertyServiceHistory.propertyId, id),
        eq(propertyServiceHistory.isDeleted, false)
      )
    )
    .orderBy(desc(propertyServiceHistory.serviceDate))
    .limit(1);

  const lastService = lastServiceResult[0]?.serviceDate || null;

  // Get property contacts
  const contacts = await db
    .select()
    .from(propertyContacts)
    .where(
      and(
        eq(propertyContacts.propertyId, id),
        eq(propertyContacts.isDeleted, false)
      )
    )
    .orderBy(
      desc(propertyContacts.isPrimary),
      desc(propertyContacts.createdAt)
    );

  // Get equipment
  const equipment = await db
    .select()
    .from(propertyEquipment)
    .where(
      and(
        eq(propertyEquipment.propertyId, id),
        eq(propertyEquipment.isDeleted, false)
      )
    )
    .orderBy(propertyEquipment.equipmentType, propertyEquipment.location);

  // Get job history - combine jobs and service history
  // Jobs are now linked through bid → organization, so we get jobs for the property's organization
  const jobsList = await db
    .select({
      id: jobs.id,
      jobNumber: jobs.jobNumber,
      name: jobs.name,
      description: jobs.description,
      status: jobs.status,
      jobType: jobs.jobType,
      serviceType: jobs.serviceType,
      actualStartDate: jobs.actualStartDate,
      actualEndDate: jobs.actualEndDate,
      scheduledStartDate: jobs.scheduledStartDate,
      scheduledEndDate: jobs.scheduledEndDate,
      completionNotes: jobs.completionNotes,
      leadTechnician: jobs.leadTechnician,
      leadTechnicianName: users.fullName,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .leftJoin(users, eq(jobs.leadTechnician, users.id))
    .where(
      and(
        eq(bidsTable.organizationId, property.organizationId),
        eq(jobs.isDeleted, false)
      )
    )
    .orderBy(
      desc(jobs.actualEndDate),
      desc(jobs.scheduledStartDate),
      desc(jobs.createdAt)
    );

  // Get service history entries
  const serviceHistoryList = await db
    .select({
      id: propertyServiceHistory.id,
      jobId: propertyServiceHistory.jobId,
      serviceDate: propertyServiceHistory.serviceDate,
      serviceType: propertyServiceHistory.serviceType,
      description: propertyServiceHistory.description,
      performedBy: propertyServiceHistory.performedBy,
      performedByName: users.fullName,
    })
    .from(propertyServiceHistory)
    .leftJoin(users, eq(propertyServiceHistory.performedBy, users.id))
    .where(
      and(
        eq(propertyServiceHistory.propertyId, id),
        eq(propertyServiceHistory.isDeleted, false)
      )
    )
    .orderBy(desc(propertyServiceHistory.serviceDate));

  // Combine and format job history
  // Use jobs as primary source, supplement with service history
  const jobHistoryMap = new Map<string, any>();

  // Process jobs
  for (const job of jobsList) {
    const jobDate =
      job.actualEndDate || job.scheduledStartDate || job.actualStartDate;
    if (!jobDate) continue;

    // Calculate duration in hours
    let duration: number | null = null;
    if (job.actualStartDate && job.actualEndDate) {
      const start = new Date(job.actualStartDate);
      const end = new Date(job.actualEndDate);
      duration = Math.round(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      );
    }

    // Extract parts from completion notes or description (simple parsing)
    const partsUsed: string[] = [];
    const notesText = job.completionNotes || job.description || "";
    // Look for patterns like "Model XYZ-500", "x5", etc.
    const partsMatches = notesText.match(
      /([A-Z0-9-]+(?:\s+Model\s+[A-Z0-9-]+)?|[A-Za-z\s]+x\d+)/gi
    );
    if (partsMatches) {
      partsUsed.push(...partsMatches.slice(0, 5)); // Limit to 5 parts
    }

    jobHistoryMap.set(job.id, {
      id: job.id,
      jobNumber: job.jobNumber,
      name: job.name,
      date: jobDate,
      technician: job.leadTechnicianName || null,
      duration: duration ? `${duration} hours` : null,
      workPerformed:
        job.description ||
        job.serviceType ||
        job.jobType ||
        "Service performed",
      technicianNotes: job.completionNotes || null,
      partsUsed: partsUsed.length > 0 ? partsUsed : [],
      status: job.status,
      source: "job",
    });
  }

  // Process service history entries (add if not already in map or supplement)
  for (const service of serviceHistoryList) {
    if (service.jobId && jobHistoryMap.has(service.jobId)) {
      // Supplement existing job entry
      const existing = jobHistoryMap.get(service.jobId)!;
      if (!existing.technician && service.performedByName) {
        existing.technician = service.performedByName;
      }
      if (!existing.technicianNotes && service.description) {
        existing.technicianNotes = service.description;
      }
    } else {
      // Create new entry from service history
      jobHistoryMap.set(service.id, {
        id: service.id,
        jobNumber: null,
        name: service.serviceType || "Service",
        date: service.serviceDate,
        technician: service.performedByName || null,
        duration: null,
        workPerformed:
          service.description || service.serviceType || "Service performed",
        technicianNotes: service.description || null,
        partsUsed: [],
        status: "completed",
        source: "service_history",
      });
    }
  }

  // Convert map to array and sort by date
  const jobHistory = Array.from(jobHistoryMap.values()).sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA; // Most recent first
  });

  // Get documents count by type
  const documentsCount = await db
    .select({
      documentType: propertyDocuments.documentType,
      count: count(),
    })
    .from(propertyDocuments)
    .where(
      and(
        eq(propertyDocuments.propertyId, id),
        eq(propertyDocuments.isDeleted, false)
      )
    )
    .groupBy(propertyDocuments.documentType);

  // Format property type display
  const propertyTypeDisplay = property.propertyType
    ? property.propertyType
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : null;

  // Format square footage
  const squareFootageDisplay = property.squareFootage
    ? `${Number(property.squareFootage).toLocaleString()} sq ft`
    : null;

  // Determine display status
  let displayStatus: string = property.status;
  if (activeJobs > 0 && property.status !== "under_construction") {
    displayStatus = "under_service";
  }

  return {
    // Property header info
    id: property.id,
    propertyName: property.propertyName,
    status: property.status,
    displayStatus: displayStatus,
    address: {
      line1: property.addressLine1,
      line2: property.addressLine2,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
      full: `${property.addressLine1}, ${property.city}, ${property.state} ${property.zipCode}`,
    },

    // Information cards
    informationCards: {
      buildingType: {
        type: propertyTypeDisplay,
        squareFootage: squareFootageDisplay,
      },
      jobs: {
        total: totalJobs,
        active: activeJobs,
      },
      lastService: lastService,
      client: organization
        ? {
            id: organization.id,
            name: organization.name,
          }
        : null,
    },

    // Property notes (from description or notes field)
    notes: property.notes || property.description || null,

    // Job history
    jobHistory: jobHistory,

    // Additional data
    organization: organization,
    contacts: contacts,
    equipment: equipment,
    documentsCount: documentsCount,

    // Full property data
    property: property,
  };
};

// Create new property
export const createProperty = async (data: {
  organizationId: string;
  propertyName: string;
  propertyCode?: string;
  propertyType: string;
  status?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
  squareFootage?: number;
  numberOfFloors?: number;
  yearBuilt?: number;
  accessInstructions?: string;
  gateCode?: string;
  parkingInstructions?: string;
  operatingHours?: any;
  latitude?: number;
  longitude?: number;
  description?: string;
  notes?: string;
  tags?: any;
  createdBy?: string;
}) => {
  const [property] = await db
    .insert(properties)
    .values({
      organizationId: data.organizationId,
      propertyName: data.propertyName,
      propertyCode: data.propertyCode || null,
      propertyType: data.propertyType as any,
      status: (data.status as any) || "active",
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 || null,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      country: data.country || "USA",
      squareFootage: data.squareFootage ? data.squareFootage.toString() : null,
      numberOfFloors: data.numberOfFloors || null,
      yearBuilt: data.yearBuilt || null,
      accessInstructions: data.accessInstructions || null,
      gateCode: data.gateCode || null,
      parkingInstructions: data.parkingInstructions || null,
      operatingHours: data.operatingHours || null,
      latitude: data.latitude ? data.latitude.toString() : null,
      longitude: data.longitude ? data.longitude.toString() : null,
      description: data.description || null,
      notes: data.notes || null,
      tags: data.tags || null,
      createdBy: data.createdBy || null,
    })
    .returning();

  return property;
};

// Update property
export const updateProperty = async (id: string, data: any) => {
  const updateData = {
    ...data,
    updatedAt: new Date(),
  };

  const [property] = await db
    .update(properties)
    .set(updateData)
    .where(eq(properties.id, id))
    .returning();

  return property || null;
};

// Soft delete property
export const deleteProperty = async (id: string) => {
  const [property] = await db
    .update(properties)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(eq(properties.id, id))
    .returning();

  return property || null;
};

// Property Equipment Management
export const createPropertyEquipment = async (data: {
  propertyId: string;
  equipmentTag?: string;
  equipmentType: string;
  location?: string;
  make?: string;
  model?: string;
  serialNumber?: string;
  installDate?: string; // Changed to string for SQL date format
  warrantyExpiration?: string; // Changed to string for SQL date format
  capacity?: string;
  voltagePhase?: string;
  specifications?: any;
  status?: string;
  condition?: string;
  notes?: string;
}) => {
  const [equipment] = await db
    .insert(propertyEquipment)
    .values(data)
    .returning();

  return equipment;
};

export const getPropertyEquipment = async (propertyId: string) => {
  return await db
    .select()
    .from(propertyEquipment)
    .where(
      and(
        eq(propertyEquipment.propertyId, propertyId),
        eq(propertyEquipment.isDeleted, false)
      )
    )
    .orderBy(propertyEquipment.equipmentType, propertyEquipment.location);
};

// Property Service History Management
export const createServiceHistoryEntry = async (data: {
  propertyId: string;
  jobId?: string;
  bidId?: string;
  serviceDate: string; // Changed to string for SQL date format
  serviceType?: string;
  description?: string;
  performedBy?: string;
}) => {
  const [service] = await db
    .insert(propertyServiceHistory)
    .values(data)
    .returning();

  return service;
};

export const getPropertyServiceHistory = async (
  propertyId: string,
  limit = 50
) => {
  return await db
    .select({
      service: propertyServiceHistory,
      performedBy: {
        id: users.id,
        fullName: users.fullName,
      },
    })
    .from(propertyServiceHistory)
    .leftJoin(users, eq(propertyServiceHistory.performedBy, users.id))
    .where(
      and(
        eq(propertyServiceHistory.propertyId, propertyId),
        eq(propertyServiceHistory.isDeleted, false)
      )
    )
    .orderBy(desc(propertyServiceHistory.serviceDate))
    .limit(limit);
};

// Get Property KPIs for dashboard
export const getPropertyKPIs = async () => {
  // OPTIMIZATION: Run all queries in parallel for maximum performance
  const [
    totalPropertiesResult,
    activePropertiesResult,
    underServiceResult,
    totalJobsResult,
  ] = await Promise.all([
    // 1. Total Properties (all non-deleted properties)
    db
      .select({
        count: count(),
      })
      .from(properties)
      .where(eq(properties.isDeleted, false)),

    // 2. Active Properties (properties with status "active")
    db
      .select({
        count: count(),
      })
      .from(properties)
      .where(
        and(
          eq(properties.isDeleted, false),
          eq(properties.status, "active" as any)
        )
      ),

    // 3. Under Service (properties with status "under_construction" OR properties with active jobs)
    // Note: Jobs are linked to properties through bids → organization
    db.execute<{ count: string }>(
      sql.raw(`
        SELECT COUNT(DISTINCT p.id)::text as count
        FROM org.properties p
        WHERE p.is_deleted = false
          AND (
            p.status = 'under_construction'
            OR EXISTS (
              SELECT 1
              FROM org.jobs j
              INNER JOIN org.bids b ON j.bid_id = b.id
              WHERE b.organization_id = p.organization_id
                AND j.is_deleted = false
                AND b.is_deleted = false
                AND j.status IN ('planned', 'scheduled', 'in_progress', 'on_hold')
            )
          )
      `)
    ),

    // 4. Total Jobs (all non-deleted jobs)
    db
      .select({
        count: count(),
      })
      .from(jobs)
      .where(eq(jobs.isDeleted, false)),
  ]);

  // Extract values
  const totalProperties = Number(totalPropertiesResult[0]?.count || 0);
  const activeProperties = Number(activePropertiesResult[0]?.count || 0);
  const underService = Number(underServiceResult.rows?.[0]?.count || 0);
  const totalJobs = Number(totalJobsResult[0]?.count || 0);

  return {
    totalProperties: {
      value: totalProperties,
      label: "Total Properties",
    },
    active: {
      value: activeProperties,
      label: "Active",
    },
    underService: {
      value: underService,
      label: "Under Service",
    },
    totalJobs: {
      value: totalJobs,
      label: "Total Jobs",
    },
  };
};
