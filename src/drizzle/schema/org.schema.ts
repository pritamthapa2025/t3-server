import {
  pgSchema,
  pgTable,
  uuid,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  primaryKey,
  integer,
  jsonb,
  numeric,
  date,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth.schema.js";
import { pgEnum } from "drizzle-orm/pg-core";

export const accountTypeEnum = pgEnum("account_type_enum", [
  "savings",
  "current",
  "salary",
  "checking",
  "business",
]);

export const employeeStatusEnum = pgEnum("employee_status_enum", [
  "available",
  "on_leave",
  "in_field",
  "terminated",
  "suspended",
]);

export const timesheetStatusEnum = pgEnum("timesheet_status_enum", [
  "pending",
  "submitted",
  "approved",
  "rejected",
]);

// Enhanced Clients/Organizations Enums
export const clientTypeEnum = pgEnum("client_type_enum", [
  "direct",
  "subcontractor",
  "government",
  "property_management",
  "corporate",
  "individual",
]);

export const clientStatusEnum = pgEnum("client_status_enum", [
  "active",
  "inactive",
  "prospect",
  "suspended",
  "archived",
]);

export const contactTypeEnum = pgEnum("contact_type_enum", [
  "primary",
  "billing",
  "technical",
  "emergency",
  "project_manager",
]);

// Properties Enums
export const propertyTypeEnum = pgEnum("property_type_enum", [
  "commercial",
  "industrial",
  "residential",
  "healthcare",
  "education",
  "hospitality",
  "retail",
  "warehouse",
  "government",
  "mixed_use",
]);

export const propertyStatusEnum = pgEnum("property_status_enum", [
  "active",
  "inactive",
  "under_construction",
  "archived",
]);

// User Organization Type Enum - CRITICAL for membership
export const userOrganizationTypeEnum = pgEnum("user_organization_type_enum", [
  "t3_employee", // Works for T3 Mechanical
  "client_user", // Works for a client organization
  "contractor", // External contractor
]);

// Job Management Enums
export const jobStatusEnum = pgEnum("job_status_enum", [
  "planned",
  "scheduled",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
  "invoiced",
  "closed",
]);

export const jobPriorityEnum = pgEnum("job_priority_enum", [
  "low",
  "medium",
  "high",
  "emergency",
]);

export const org = pgSchema("org");

// Departments table - T3 internal departments (not tied to client organizations)
export const departments = org.table(
  "departments",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),

    // Department leadership
    leadId: uuid("lead_id").references(() => users.id, {
      onDelete: "set null",
    }),
    contactEmail: varchar("contact_email", { length: 255 }),

    // Operational details
    primaryLocation: varchar("primary_location", { length: 255 }),
    shiftCoverage: varchar("shift_coverage", { length: 100 }),
    openPositions: integer("open_positions").default(0).notNull(),
    utilization: numeric("utilization", { precision: 5, scale: 4 }), // 0.0000 to 1.0000 (0-100%)

    // Status & ordering
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order"),
    isDeleted: boolean("is_deleted").default(false),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: department names must be unique across T3
    unique("unique_dept_name").on(table.name),
    // Index for active departments
    index("idx_departments_active").on(table.isActive),
    // Index for lead lookup
    index("idx_departments_lead").on(table.leadId),
    // Index for soft delete filtering
    index("idx_departments_deleted").on(table.isDeleted),
  ]
);

// Positions table
export const positions = org.table(
  "positions",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    departmentId: integer("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    description: text("description"),

    // Position compensation
    payRate: numeric("pay_rate", { precision: 10, scale: 2 }).notNull(),
    payType: varchar("pay_type", { length: 20 }).notNull(), // "Hourly" | "Salary"
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    notes: text("notes"),

    // Status & ordering
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order"),
    isDeleted: boolean("is_deleted").default(false),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Index for department positions lookup
    index("idx_positions_department").on(table.departmentId),
    // Index for active positions
    index("idx_positions_active").on(table.isActive, table.departmentId),
    // Index for soft delete filtering
    index("idx_positions_deleted").on(table.isDeleted),
  ]
);

// Enhanced Employees table - T3 internal staff
export const employees = org.table(
  "employees",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    employeeId: varchar("employee_id", { length: 50 }).unique(), // T3-00001, T3-00002, etc.

    departmentId: integer("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    positionId: integer("position_id").references(() => positions.id, {
      onDelete: "set null",
    }),
    reportsTo: uuid("reports_to").references(() => users.id, {
      onDelete: "set null",
    }),

    // Enhanced Date Fields
    hireDate: date("hire_date"), // Better name than startDate
    terminationDate: date("termination_date"), // Better than endDate

    // Compensation
    hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
    salary: numeric("salary", { precision: 15, scale: 2 }),
    payType: varchar("pay_type", { length: 20 }), // "hourly", "salary"

    // Certifications & Skills
    certifications: jsonb("certifications"), // Array of certification objects
    skills: jsonb("skills"), // Array of skills
    licenses: jsonb("licenses"), // License numbers, expiration dates

    // Employment Type
    employmentType: varchar("employment_type", { length: 50 }), // full-time, part-time, contractor

    // Legacy fields (keep for compatibility)
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    performance: integer("performance").default(0), // percentage or score
    violations: integer("violations").default(0), // number of violations
    note: jsonb("note"),
    status: employeeStatusEnum("status").notNull().default("available"),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_employee_id").on(table.employeeId),
    // Enhanced indexes
    index("idx_employees_department").on(table.departmentId),
    index("idx_employees_position").on(table.positionId),
    index("idx_employees_status").on(table.status),
    index("idx_employees_reports_to").on(table.reportsTo),
    index("idx_employees_pay_type").on(table.payType),
    index("idx_employees_employment_type").on(table.employmentType),
    // Composite index for KPI queries (filters by isDeleted and status)
    index("idx_employees_deleted_status").on(table.isDeleted, table.status),
    // Composite index for active employee queries (isDeleted + user join optimization)
    index("idx_employees_deleted").on(table.isDeleted),
  ]
);

export const userBankAccounts = org.table("user_bank_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  accountHolderName: varchar("account_holder_name", { length: 150 }).notNull(),
  bankName: varchar("bank_name", { length: 150 }).notNull(),
  accountNumber: varchar("account_number", { length: 100 }).notNull(),
  routingNumber: varchar("routing_number", { length: 100 }),
  accountType: accountTypeEnum("account_type").notNull(),
  branchName: varchar("branch_name", { length: 150 }),
  isPrimary: boolean("is_primary").default(false),
  isVerified: boolean("is_verified").default(false),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const employeeReviews = org.table("employee_reviews", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id), // no cascade, no null
  reviewerId: uuid("reviewer_id").references(() => users.id), // keep reviewer reference
  title: varchar("title", { length: 150 }), // e.g. "Q4 2024 Review"
  reviewDate: timestamp("review_date").defaultNow(),
  ratings: jsonb("ratings").notNull(), // All rating categories
  averageScore: varchar("average_score", { length: 10 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const timesheets = org.table(
  "timesheets",
  {
    id: serial("id").primaryKey(),

    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),

    sheetDate: date("sheet_date").notNull(),

    clockIn: timestamp("clock_in").notNull(),
    clockOut: timestamp("clock_out").notNull(),

    breakMinutes: integer("break_minutes").default(0),

    totalHours: numeric("total_hours", { precision: 5, scale: 2 }).default("0"),
    overtimeHours: numeric("overtime_hours", {
      precision: 5,
      scale: 2,
    }).default("0"),

    notes: text("notes"),

    status: timesheetStatusEnum("status").notNull().default("pending"),

    submittedBy: uuid("submitted_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_employee_day").on(table.employeeId, table.sheetDate),
  ]
);

export const timesheetApprovals = org.table("timesheet_approvals", {
  id: serial("id").primaryKey(),

  timesheetId: integer("timesheet_id")
    .notNull()
    .references(() => timesheets.id),

  action: varchar("action", { length: 50 }).notNull(),

  performedBy: uuid("performed_by")
    .notNull()
    .references(() => users.id),

  remarks: text("remarks"),

  createdAt: timestamp("created_at").defaultNow(),
});

// Enhanced Organizations/Clients table
export const organizations: any = org.table(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Basic Info
    name: varchar("name", { length: 255 }).notNull(),
    legalName: varchar("legal_name", { length: 255 }),
    clientType: clientTypeEnum("client_type").notNull().default("direct"),
    status: clientStatusEnum("status").notNull().default("prospect"),

    // Business Info
    industryClassification: varchar("industry_classification", { length: 100 }),
    taxId: varchar("tax_id", { length: 50 }), // EIN/Tax ID
    website: varchar("website", { length: 255 }),

    // Parent/Super Client relationship
    parentOrganizationId: uuid("parent_organization_id").references(
      () => organizations.id,
      {
        onDelete: "set null",
      }
    ),

    // Financial
    creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }),
    paymentTerms: varchar("payment_terms", { length: 100 }), // Net 30, Net 60, etc.
    preferredPaymentMethod: varchar("preferred_payment_method", { length: 50 }),

    // Billing Address
    billingAddressLine1: varchar("billing_address_line1", { length: 255 }),
    billingAddressLine2: varchar("billing_address_line2", { length: 255 }),
    billingCity: varchar("billing_city", { length: 100 }),
    billingState: varchar("billing_state", { length: 50 }),
    billingZipCode: varchar("billing_zip_code", { length: 20 }),
    billingCountry: varchar("billing_country", { length: 100 }).default("USA"),

    // Additional Info
    description: text("description"),
    notes: text("notes"),
    tags: jsonb("tags"), // ["priority", "long-term", etc.]

    // Metadata
    accountManager: uuid("account_manager").references(() => users.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_orgs_status").on(table.status),
    index("idx_orgs_client_type").on(table.clientType),
    index("idx_orgs_parent").on(table.parentOrganizationId),
    index("idx_orgs_is_deleted").on(table.isDeleted),
    index("idx_orgs_account_manager").on(table.accountManager),
  ]
);

// CRITICAL: User-Organization Relationship (Many-to-Many)
export const userOrganizations = org.table(
  "user_organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    userType: userOrganizationTypeEnum("user_type")
      .notNull()
      .default("client_user"),

    // Role within this organization (different from system role)
    title: varchar("title", { length: 100 }), // "Account Admin", "Site Manager", etc.

    isActive: boolean("is_active").default(true),
    isPrimary: boolean("is_primary").default(false), // User's primary organization

    joinedAt: timestamp("joined_at").defaultNow(),
    leftAt: timestamp("left_at"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_user_org").on(table.userId, table.organizationId),
    index("idx_user_orgs_user").on(table.userId),
    index("idx_user_orgs_org").on(table.organizationId),
    index("idx_user_orgs_type").on(table.userType),
    index("idx_user_orgs_is_active").on(table.isActive),
  ]
);

// Client Contacts (Multiple contacts per organization)
export const clientContacts = org.table(
  "client_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Contact Info
    fullName: varchar("full_name", { length: 150 }).notNull(),
    title: varchar("title", { length: 100 }), // VP Operations, Site Manager, etc.
    email: varchar("email", { length: 150 }),
    phone: varchar("phone", { length: 20 }),
    mobilePhone: varchar("mobile_phone", { length: 20 }),

    contactType: contactTypeEnum("contact_type").notNull().default("primary"),
    isPrimary: boolean("is_primary").default(false),

    // Preferences
    preferredContactMethod: varchar("preferred_contact_method", { length: 50 }), // email, phone, text
    notes: text("notes"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_client_contacts_org").on(table.organizationId),
    index("idx_client_contacts_type").on(table.contactType),
    index("idx_client_contacts_is_primary").on(table.isPrimary),
  ]
);

// Client Notes/Activity Log
export const clientNotes = org.table(
  "client_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    noteType: varchar("note_type", { length: 50 }), // call, meeting, email, general
    subject: varchar("subject", { length: 255 }),
    content: text("content").notNull(),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_client_notes_org").on(table.organizationId),
    index("idx_client_notes_created_by").on(table.createdBy),
    index("idx_client_notes_created_at").on(table.createdAt),
  ]
);

// Client Documents
export const clientDocuments = org.table(
  "client_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileType: varchar("file_type", { length: 50 }),
    fileSize: integer("file_size"),

    documentType: varchar("document_type", { length: 50 }), // contract, insurance, w9, etc.
    description: text("description"),

    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_client_docs_org").on(table.organizationId),
    index("idx_client_docs_type").on(table.documentType),
  ]
);

// Main Properties table
export const properties = org.table(
  "properties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Basic Info
    propertyName: varchar("property_name", { length: 255 }).notNull(),
    propertyCode: varchar("property_code", { length: 50 }), // P-001, BLDG-A, etc.
    propertyType: propertyTypeEnum("property_type").notNull(),
    status: propertyStatusEnum("status").notNull().default("active"),

    // Address
    addressLine1: varchar("address_line1", { length: 255 }).notNull(),
    addressLine2: varchar("address_line2", { length: 255 }),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 50 }).notNull(),
    zipCode: varchar("zip_code", { length: 20 }).notNull(),
    country: varchar("country", { length: 100 }).default("USA"),

    // Property Details
    squareFootage: numeric("square_footage", { precision: 10, scale: 2 }),
    numberOfFloors: integer("number_of_floors"),
    yearBuilt: integer("year_built"),

    // Access Information
    accessInstructions: text("access_instructions"),
    gateCode: varchar("gate_code", { length: 50 }),
    parkingInstructions: text("parking_instructions"),

    // Operating Hours
    operatingHours: jsonb("operating_hours"), // {"monday": "9-5", "tuesday": "9-5", etc.}

    // Geo Location
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),

    // Additional Info
    description: text("description"),
    notes: text("notes"),
    tags: jsonb("tags"),

    // Metadata
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_properties_org").on(table.organizationId),
    index("idx_properties_type").on(table.propertyType),
    index("idx_properties_status").on(table.status),
    index("idx_properties_city_state").on(table.city, table.state),
    index("idx_properties_is_deleted").on(table.isDeleted),
    unique("unique_property_code_per_org").on(
      table.organizationId,
      table.propertyCode
    ),
  ]
);

// Property Contacts (Site managers, maintenance staff, etc.)
export const propertyContacts = org.table(
  "property_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),

    fullName: varchar("full_name", { length: 150 }).notNull(),
    title: varchar("title", { length: 100 }),
    email: varchar("email", { length: 150 }),
    phone: varchar("phone", { length: 20 }),
    mobilePhone: varchar("mobile_phone", { length: 20 }),

    contactType: varchar("contact_type", { length: 50 }), // site_manager, maintenance, security, etc.
    isPrimary: boolean("is_primary").default(false),

    availableHours: varchar("available_hours", { length: 255 }),
    notes: text("notes"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_property_contacts_property").on(table.propertyId),
    index("idx_property_contacts_is_primary").on(table.isPrimary),
  ]
);

// Equipment at Properties (HVAC units, chillers, etc.)
export const propertyEquipment = org.table(
  "property_equipment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),

    // Equipment Info
    equipmentTag: varchar("equipment_tag", { length: 100 }), // Unit tag/ID
    equipmentType: varchar("equipment_type", { length: 100 }).notNull(), // HVAC, Chiller, Boiler, etc.
    location: varchar("location", { length: 255 }), // Roof, Basement, Room 101, etc.

    // Manufacturer Info
    make: varchar("make", { length: 100 }),
    model: varchar("model", { length: 100 }),
    serialNumber: varchar("serial_number", { length: 100 }),

    // Installation Info
    installDate: date("install_date"),
    warrantyExpiration: date("warranty_expiration"),

    // Specifications
    capacity: varchar("capacity", { length: 100 }), // tonnage, BTU, etc.
    voltagePhase: varchar("voltage_phase", { length: 50 }),
    specifications: jsonb("specifications"), // Additional specs

    // Status
    status: varchar("status", { length: 50 }).default("active"), // active, inactive, retired
    condition: varchar("condition", { length: 50 }), // excellent, good, fair, poor

    notes: text("notes"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_property_equipment_property").on(table.propertyId),
    index("idx_property_equipment_type").on(table.equipmentType),
    index("idx_property_equipment_status").on(table.status),
  ]
);

// Property Documents
export const propertyDocuments = org.table(
  "property_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),

    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileType: varchar("file_type", { length: 50 }),
    fileSize: integer("file_size"),

    documentType: varchar("document_type", { length: 50 }), // floor_plan, photos, permits, etc.
    description: text("description"),

    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_property_docs_property").on(table.propertyId),
    index("idx_property_docs_type").on(table.documentType),
  ]
);

// Property Service History
export const propertyServiceHistory = org.table(
  "property_service_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),

    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    bidId: uuid("bid_id").references(() => bidsTable.id, {
      onDelete: "set null",
    }),

    serviceDate: date("service_date").notNull(),
    serviceType: varchar("service_type", { length: 100 }), // maintenance, repair, installation, inspection
    description: text("description"),

    performedBy: uuid("performed_by").references(() => users.id, {
      onDelete: "set null",
    }),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_property_service_property").on(table.propertyId),
    index("idx_property_service_date").on(table.serviceDate),
    index("idx_property_service_job").on(table.jobId),
  ]
);

// Comprehensive Job Management
export const jobs: any = org.table(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobNumber: varchar("job_number", { length: 100 }).notNull(),

    // Relationships
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "set null",
    }), // Link to property
    bidId: uuid("bid_id").references(() => bidsTable.id, {
      onDelete: "set null",
    }),

    // Basic Info
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: jobStatusEnum("status").notNull().default("planned"),
    priority: jobPriorityEnum("priority").notNull().default("medium"),

    // Job Type
    jobType: varchar("job_type", { length: 100 }), // Installation, Repair, Maintenance, etc.
    serviceType: varchar("service_type", { length: 100 }), // HVAC, Plumbing, etc.

    // Dates
    scheduledStartDate: date("scheduled_start_date"),
    scheduledEndDate: date("scheduled_end_date"),
    actualStartDate: date("actual_start_date"),
    actualEndDate: date("actual_end_date"),

    // Location
    siteAddress: text("site_address"),
    siteContactName: varchar("site_contact_name", { length: 150 }),
    siteContactPhone: varchar("site_contact_phone", { length: 20 }),
    accessInstructions: text("access_instructions"),

    // Financial
    contractValue: numeric("contract_value", { precision: 15, scale: 2 }),
    actualCost: numeric("actual_cost", { precision: 15, scale: 2 }),

    // Team Assignment
    projectManager: uuid("project_manager").references(() => users.id, {
      onDelete: "set null",
    }),
    leadTechnician: uuid("lead_technician").references(() => users.id, {
      onDelete: "set null",
    }),

    // Completion
    completionNotes: text("completion_notes"),
    completionPercentage: numeric("completion_percentage", {
      precision: 5,
      scale: 2,
    }).default("0"),

    // Metadata
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_job_number_per_org").on(
      table.organizationId,
      table.jobNumber
    ),
    index("idx_jobs_org").on(table.organizationId),
    index("idx_jobs_property").on(table.propertyId),
    index("idx_jobs_bid").on(table.bidId),
    index("idx_jobs_status").on(table.status),
    index("idx_jobs_priority").on(table.priority),
    index("idx_jobs_scheduled_start").on(table.scheduledStartDate),
    index("idx_jobs_is_deleted").on(table.isDeleted),
  ]
);

// Job Team Members (Many-to-Many)
export const jobTeamMembers = org.table(
  "job_team_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),

    role: varchar("role", { length: 100 }), // Lead, Assistant, Specialist
    assignedDate: date("assigned_date").defaultNow(),
    removedDate: date("removed_date"),

    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("unique_job_employee").on(table.jobId, table.employeeId),
    index("idx_job_team_job").on(table.jobId),
    index("idx_job_team_employee").on(table.employeeId),
  ]
);

// Financial summary tables
export const financialSummary = org.table("financial_summary", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  // Revenue metrics
  totalContractValue: numeric("total_contract_value", {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default("0"),
  totalInvoiced: numeric("total_invoiced", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  totalPaid: numeric("total_paid", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  // Expense metrics
  totalJobExpenses: numeric("total_job_expenses", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  totalOperatingExpenses: numeric("total_operating_expenses", {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default("0"),
  totalCost: numeric("total_cost", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  // Profit metrics
  projectedProfit: numeric("projected_profit", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  actualProfit: numeric("actual_profit", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobFinancialSummary = org.table(
  "job_financial_summary",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contractValue: numeric("contract_value", {
      precision: 15,
      scale: 2,
    }).notNull(),
    totalInvoiced: numeric("total_invoiced", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    totalPaid: numeric("total_paid", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    vendorsOwed: numeric("vendors_owed", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    laborPaidToDate: numeric("labor_paid_to_date", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    jobCompletionRate: numeric("job_completion_rate", {
      precision: 5,
      scale: 2,
    }),
    profitability: numeric("profitability", { precision: 5, scale: 2 }),
    profitMargin: numeric("profit_margin", { precision: 5, scale: 2 }),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [unique("unique_job_financial").on(table.jobId)]
);

export const financialCostCategories = org.table("financial_cost_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  categoryKey: varchar("category_key", { length: 50 }).notNull(),
  categoryLabel: varchar("category_label", { length: 255 }).notNull(),
  spent: numeric("spent", { precision: 15, scale: 2 }).notNull().default("0"),
  budget: numeric("budget", { precision: 15, scale: 2 }).notNull().default("0"),
  percentOfTotal: numeric("percent_of_total", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  status: varchar("status", { length: 20 }).notNull().default("on-track"),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const profitTrend = org.table("profit_trend", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  period: varchar("period", { length: 50 }).notNull(),
  periodDate: date("period_date").notNull(),
  revenue: numeric("revenue", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  expenses: numeric("expenses", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cashFlowProjection = org.table("cash_flow_projection", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  projectionDate: date("projection_date").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  projectedIncome: numeric("projected_income", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  projectedExpenses: numeric("projected_expenses", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  pipelineCoverageMonths: numeric("pipeline_coverage_months", {
    precision: 5,
    scale: 2,
  })
    .notNull()
    .default("0"),
  openInvoicesCount: integer("open_invoices_count").notNull().default(0),
  averageCollectionDays: integer("average_collection_days")
    .notNull()
    .default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cashFlowScenarios = org.table("cash_flow_scenarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  projectionId: uuid("projection_id")
    .notNull()
    .references(() => cashFlowProjection.id, { onDelete: "cascade" }),
  scenarioType: varchar("scenario_type", { length: 20 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  description: text("description"),
  projectedIncome: numeric("projected_income", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  projectedExpenses: numeric("projected_expenses", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  changeDescription: varchar("change_description", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const revenueForecast = org.table("revenue_forecast", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  month: varchar("month", { length: 10 }).notNull(),
  monthDate: date("month_date").notNull(),
  committed: numeric("committed", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  pipeline: numeric("pipeline", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  probability: numeric("probability", { precision: 5, scale: 4 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const financialReports = org.table(
  "financial_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reportKey: varchar("report_key", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 50 }).notNull(),
    reportConfig: jsonb("report_config"),
    updatedAt: timestamp("updated_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("unique_org_report").on(table.organizationId, table.reportKey),
  ]
);

// Bid Management System Enums

export const bidStatusEnum = pgEnum("bid_status_enum", [
  "draft",
  "in_progress",
  "pending",
  "submitted",
  "accepted",
  "won",
  "rejected",
  "lost",
  "expired",
  "cancelled",
]);

export const bidPriorityEnum = pgEnum("bid_priority_enum", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const bidJobTypeEnum = pgEnum("bid_job_type_enum", [
  "survey",
  "plan_spec",
  "design_build",
]);

export const timelineStatusEnum = pgEnum("timeline_status_enum", [
  "completed",
  "pending",
  "in_progress",
  "cancelled",
]);

// Main Bids table

export const bidsTable: any = org.table(
  "bids",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidNumber: varchar("bid_number", { length: 100 }).notNull(),
    // Basic Information
    title: varchar("title", { length: 255 }).notNull(),
    jobType: bidJobTypeEnum("job_type").notNull(),
    status: bidStatusEnum("status").notNull().default("draft"),
    priority: bidPriorityEnum("priority").notNull().default("medium"),
    // Client / Org
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientName: varchar("client_name", { length: 255 }),
    clientEmail: varchar("client_email", { length: 150 }),
    clientPhone: varchar("client_phone", { length: 20 }),
    city: varchar("city", { length: 100 }),
    superClient: varchar("super_client", { length: 255 }),
    superPrimaryContact: varchar("super_primary_contact", {
      length: 255,
    }),
    primaryContact: varchar("primary_contact", { length: 255 }),
    industryClassification: varchar("industry_classification", {
      length: 100,
    }),
    // Project Details
    projectName: varchar("project_name", { length: 255 }),
    siteAddress: text("site_address"),
    buildingSuiteNumber: varchar("building_suite_number", { length: 100 }),
    property: varchar("property", { length: 255 }),
    acrossValuations: varchar("across_valuations", { length: 255 }),
    scopeOfWork: text("scope_of_work"),
    specialRequirements: text("special_requirements"),
    description: text("description"),
    // Dates
    startDate: date("start_date"),
    endDate: date("end_date"),
    plannedStartDate: date("planned_start_date"),
    estimatedCompletion: date("estimated_completion"),
    createdDate: timestamp("created_date").defaultNow(),
    expiresDate: timestamp("expires_date"),
    removalDate: date("removal_date"),
    // Financial
    bidAmount: numeric("bid_amount", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    estimatedDuration: integer("estimated_duration"), // days
    profitMargin: numeric("profit_margin", { precision: 5, scale: 2 }), // %
    expiresIn: integer("expires_in"), // days
    // Terms & Conditions
    paymentTerms: text("payment_terms"),
    warrantyPeriod: varchar("warranty_period", { length: 50 }),
    warrantyPeriodLabor: varchar("warranty_period_labor", { length: 50 }),
    warrantyDetails: text("warranty_details"),
    specialTerms: text("special_terms"),
    exclusions: text("exclusions"),
    proposalBasis: text("proposal_basis"),
    referenceDate: varchar("reference_date", { length: 50 }),
    templateSelection: varchar("template_selection", { length: 100 }),
    // Team Assignment
    primaryTeammate: uuid("primary_teammate").references(() => users.id, {
      onDelete: "set null",
    }),
    supervisorManager: uuid("supervisor_manager").references(() => users.id, {
      onDelete: "set null",
    }),
    technicianId: uuid("technician_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Metadata
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    qtyNumber: varchar("qty_number", { length: 50 }),
    marked: varchar("marked", { length: 20 }), // "won" | "lost"
    convertToJob: boolean("convert_to_job").default(false),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: bidNumber unique per organization
    unique("unique_bid_number_per_org").on(
      table.organizationId,
      table.bidNumber
    ),
    // Indexes for performance
    index("idx_bids_org").on(table.organizationId),
    index("idx_bids_status").on(table.status),
    index("idx_bids_org_status").on(table.organizationId, table.status),
    index("idx_bids_created_by").on(table.createdBy),
    index("idx_bids_job_type").on(table.jobType),
    index("idx_bids_priority").on(table.priority),
    index("idx_bids_expires_date").on(table.expiresDate),
    index("idx_bids_is_deleted").on(table.isDeleted),
    index("idx_bids_created_at").on(table.createdAt),
  ]
);

// Financial Breakdown (1:1)

export const bidFinancialBreakdown = org.table(
  "bid_financial_breakdown",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" })
      .unique(),
    materialsEquipment: numeric("materials_equipment", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    labor: numeric("labor", { precision: 15, scale: 2 }).notNull().default("0"),
    travel: numeric("travel", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    operatingExpenses: numeric("operating_expenses", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    totalCost: numeric("total_cost", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_financial_org").on(table.organizationId),
    index("idx_bid_financial_bid_id").on(table.bidId),
  ]
);

// Materials (1:many)

export const bidMaterials = org.table(
  "bid_materials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull(),
    markup: numeric("markup", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    totalCost: numeric("total_cost", { precision: 15, scale: 2 }).notNull(),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_materials_org").on(table.organizationId),
    index("idx_bid_materials_bid_id").on(table.bidId),
  ]
);

// Labor (1:many)

export const bidLabor = org.table(
  "bid_labor",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 100 }).notNull(),
    quantity: integer("quantity").notNull(),
    days: integer("days").notNull(),
    hoursPerDay: numeric("hours_per_day", { precision: 5, scale: 2 }).notNull(),
    totalHours: numeric("total_hours", { precision: 8, scale: 2 }).notNull(),
    costRate: numeric("cost_rate", { precision: 10, scale: 2 }).notNull(),
    billableRate: numeric("billable_rate", {
      precision: 10,
      scale: 2,
    }).notNull(),
    totalCost: numeric("total_cost", { precision: 15, scale: 2 }).notNull(),
    totalPrice: numeric("total_price", { precision: 15, scale: 2 }).notNull(),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_labor_org").on(table.organizationId),
    index("idx_bid_labor_bid_id").on(table.bidId),
  ]
);

// Travel (1:many)

export const bidTravel = org.table(
  "bid_travel",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    employeeName: varchar("employee_name", { length: 255 }),
    vehicleName: varchar("vehicle_name", { length: 255 }),
    roundTripMiles: numeric("round_trip_miles", {
      precision: 10,
      scale: 2,
    }).notNull(),
    mileageRate: numeric("mileage_rate", { precision: 10, scale: 2 }).notNull(),
    vehicleDayRate: numeric("vehicle_day_rate", {
      precision: 10,
      scale: 2,
    }).notNull(),
    days: integer("days").notNull(),
    mileageCost: numeric("mileage_cost", { precision: 15, scale: 2 }).notNull(),
    vehicleCost: numeric("vehicle_cost", { precision: 15, scale: 2 }).notNull(),
    markup: numeric("markup", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    totalCost: numeric("total_cost", { precision: 15, scale: 2 }).notNull(),
    totalPrice: numeric("total_price", { precision: 15, scale: 2 }).notNull(),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_travel_org").on(table.organizationId),
    index("idx_bid_travel_bid_id").on(table.bidId),
  ]
);

// Operating Expenses (1:1)

export const bidOperatingExpenses = org.table(
  "bid_operating_expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" })
      .unique(),
    enabled: boolean("enabled").default(false),
    grossRevenuePreviousYear: numeric("gross_revenue_previous_year", {
      precision: 15,
      scale: 2,
    }).default("0"),
    currentBidAmount: numeric("current_bid_amount", {
      precision: 15,
      scale: 2,
    }).default("0"),
    operatingCostPreviousYear: numeric("operating_cost_previous_year", {
      precision: 15,
      scale: 2,
    }).default("0"),
    inflationAdjustedOperatingCost: numeric(
      "inflation_adjusted_operating_cost",
      { precision: 15, scale: 2 }
    ).default("0"),
    inflationRate: numeric("inflation_rate", {
      precision: 5,
      scale: 2,
    }).default("0"),
    utilizationPercentage: numeric("utilization_percentage", {
      precision: 5,
      scale: 2,
    }).default("0"),
    calculatedOperatingCost: numeric("calculated_operating_cost", {
      precision: 15,
      scale: 2,
    }).default("0"),
    applyMarkup: boolean("apply_markup").default(false),
    markupPercentage: numeric("markup_percentage", {
      precision: 5,
      scale: 2,
    }).default("0"),
    operatingPrice: numeric("operating_price", {
      precision: 15,
      scale: 2,
    }).default("0"),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_operating_org").on(table.organizationId),
    index("idx_bid_operating_bid_id").on(table.bidId),
  ]
);

// Survey Bid Data (1:1)

export const bidSurveyData = org.table(
  "bid_survey_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" })
      .unique(),
    buildingNumber: varchar("building_number", { length: 100 }),
    siteLocation: text("site_location"),
    workType: varchar("work_type", { length: 50 }), // new-installation, existing-unit-assessment, site-condition-check
    hasExistingUnit: boolean("has_existing_unit").default(false),
    unitTag: varchar("unit_tag", { length: 100 }),
    unitLocation: varchar("unit_location", { length: 255 }),
    make: varchar("make", { length: 100 }),
    model: varchar("model", { length: 100 }),
    serial: varchar("serial", { length: 100 }),
    systemType: varchar("system_type", { length: 100 }),
    powerStatus: varchar("power_status", { length: 50 }),
    voltagePhase: varchar("voltage_phase", { length: 50 }),
    overallCondition: varchar("overall_condition", { length: 100 }),
    siteAccessNotes: text("site_access_notes"),
    siteConditions: text("site_conditions"),
    clientRequirements: text("client_requirements"),
    technicianId: uuid("technician_id").references(() => users.id, {
      onDelete: "set null",
    }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_survey_org").on(table.organizationId),
    index("idx_bid_survey_bid_id").on(table.bidId),
  ]
);

// Plan Spec Data (1:1)

export const bidPlanSpecData = org.table(
  "bid_plan_spec_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" })
      .unique(),
    specifications: text("specifications"),
    designRequirements: text("design_requirements"),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_plan_spec_org").on(table.organizationId),
    index("idx_bid_plan_spec_bid_id").on(table.bidId),
  ]
);

// Design Build Data (1:1)

export const bidDesignBuildData = org.table(
  "bid_design_build_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" })
      .unique(),
    designRequirements: text("design_requirements"),
    buildSpecifications: text("build_specifications"),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_design_build_org").on(table.organizationId),
    index("idx_bid_design_build_bid_id").on(table.bidId),
  ]
);

// Bid Timeline / Milestones

export const bidTimeline = org.table(
  "bid_timeline",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 255 }).notNull(),
    eventDate: timestamp("event_date").notNull(),
    status: timelineStatusEnum("status").notNull().default("pending"),
    description: text("description"),
    sortOrder: integer("sort_order").default(0),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_timeline_org").on(table.organizationId),
    index("idx_bid_timeline_bid_id").on(table.bidId),
    index("idx_bid_timeline_status").on(table.status),
  ]
);

// Bid Documents

export const bidDocuments = org.table(
  "bid_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileType: varchar("file_type", { length: 50 }),
    fileSize: integer("file_size"),
    documentType: varchar("document_type", { length: 50 }), // proposal, contract, spec, plan, etc.
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_documents_org").on(table.organizationId),
    index("idx_bid_documents_bid_id").on(table.bidId),
    index("idx_bid_documents_type").on(table.documentType),
  ]
);

// Plan Spec Files

export const bidPlanSpecFiles = org.table(
  "bid_plan_spec_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    fileType: varchar("file_type", { length: 20 }).notNull(), // "plan" | "spec"
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileSize: integer("file_size"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_plan_spec_files_org").on(table.organizationId),
    index("idx_bid_plan_spec_files_bid_id").on(table.bidId),
    index("idx_bid_plan_spec_files_type").on(table.fileType),
  ]
);

// Design Build Files

export const bidDesignBuildFiles = org.table(
  "bid_design_build_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileSize: integer("file_size"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_design_build_files_org").on(table.organizationId),
    index("idx_bid_design_build_files_bid_id").on(table.bidId),
  ]
);

// Bid Notes / Comments

export const bidNotes = org.table(
  "bid_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    isInternal: boolean("is_internal").default(true),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_notes_org").on(table.organizationId),
    index("idx_bid_notes_bid_id").on(table.bidId),
    index("idx_bid_notes_created_by").on(table.createdBy),
  ]
);

// Bid History / Audit

export const bidHistory = org.table(
  "bid_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 100 }).notNull(), // status_changed, amount_updated, assigned, etc.
    oldValue: text("old_value"),
    newValue: text("new_value"),
    description: text("description"),
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_history_org").on(table.organizationId),
    index("idx_bid_history_bid_id").on(table.bidId),
    index("idx_bid_history_performed_by").on(table.performedBy),
    index("idx_bid_history_created_at").on(table.createdAt),
  ]
);
