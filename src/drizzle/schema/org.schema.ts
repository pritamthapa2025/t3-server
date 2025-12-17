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

// Import enums from centralized location
import {
  accountTypeEnum,
  employeeStatusEnum,
  clientTypeEnum,
  clientStatusEnum,
  contactTypeEnum,
  propertyTypeEnum,
  propertyStatusEnum,
  userOrganizationTypeEnum,
} from "../enums/org.enums.js";

// Import tables from other schema files for references
import { jobs } from "./jobs.schema.js";
import { bidsTable } from "./bids.schema.js";

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
