import {
  pgSchema,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { positions } from "./org.schema.js";
import { users } from "./auth.schema.js";

// Settings use auth schema (system-wide, not per-organization)
const auth = pgSchema("auth");

/**
 * ============================================================================
 * GENERAL SETTINGS (General Tab)
 * ============================================================================
 * Combines company information and announcement settings
 */
export const generalSettings = auth.table("general_settings", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Company Information
  companyName: varchar("company_name", { length: 255 }).default(
    "T3 Mechanical",
  ),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),

  // Business Address
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zipCode: varchar("zip_code", { length: 20 }),

  // Business Licenses & IDs
  taxId: varchar("tax_id", { length: 50 }), // EIN
  licenseNumber: varchar("license_number", { length: 100 }), // HVAC License

  // Announcement Banner Settings
  announcementEnabled: boolean("announcement_enabled").default(false),
  announcementTitle: varchar("announcement_title", { length: 255 }),
  announcementDescription: text("announcement_description"),

  // Metadata
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * ============================================================================
 * LABOR RATE TEMPLATES (Labor Roles Tab)
 * ============================================================================
 * Default billing rates for each position (used when creating bids)
 */
export const laborRateTemplates = auth.table(
  "labor_rate_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    positionId: integer("position_id")
      .references(() => positions.id)
      .notNull()
      .unique(), // One template per position

    // Billing Defaults
    defaultDays: integer("default_days").default(3),
    defaultHoursPerDay: numeric("default_hours_per_day", {
      precision: 5,
      scale: 2,
    }).default("8.00"),

    // Cost & Billing Rates
    defaultCostRate: numeric("default_cost_rate", {
      precision: 10,
      scale: 2,
    }).default("35.00"), // Cost per hour

    defaultBillableRate: numeric("default_billable_rate", {
      precision: 10,
      scale: 2,
    }).default("85.00"), // Bill to client per hour

    // Metadata
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_labor_rate_templates_position").on(table.positionId)],
);

/**
 * ============================================================================
 * VEHICLE & TRAVEL DEFAULT SETTINGS (Vehicle & Travel Tab)
 * ============================================================================
 * System-wide default rates for vehicle/travel billing
 */
export const vehicleTravelDefaults = auth.table("vehicle_travel_defaults", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Default Billing Rates
  defaultMileageRate: numeric("default_mileage_rate", {
    precision: 10,
    scale: 4,
  }).default("0.6700"), // IRS standard rate

  defaultVehicleDayRate: numeric("default_vehicle_day_rate", {
    precision: 10,
    scale: 2,
  }).default("95.00"),

  defaultMarkup: numeric("default_markup", {
    precision: 5,
    scale: 2,
  }).default("20.00"), // Percentage

  // Flat Rate Option
  enableFlatRate: boolean("enable_flat_rate").default(false),
  flatRateAmount: numeric("flat_rate_amount", {
    precision: 10,
    scale: 2,
  }).default("150.00"),

  // Cost Per Mile (CPM) Calculation Settings
  gasPricePerGallon: numeric("gas_price_per_gallon", {
    precision: 10,
    scale: 4,
  }).default("3.5000"), // Current gas price

  // Metadata
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * ============================================================================
 * TRAVEL ORIGIN ADDRESSES (Vehicle & Travel Tab)
 * ============================================================================
 * Starting locations for travel distance calculations (offices, warehouses)
 */
export const travelOrigins = auth.table(
  "travel_origins",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Address Details
    name: varchar("name", { length: 255 }).notNull(), // "Main Office", "Warehouse #1"
    addressLine1: varchar("address_line1", { length: 255 }).notNull(),
    addressLine2: varchar("address_line2", { length: 255 }),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 50 }).notNull(),
    zipCode: varchar("zip_code", { length: 20 }).notNull(),
    country: varchar("country", { length: 100 }).default("USA"),

    // Full Address (computed/concatenated for display)
    fullAddress: text("full_address"),

    // Geolocation (for distance calculations)
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),

    // Flags
    isDefault: boolean("is_default").default(false), // Default origin for new bids
    isActive: boolean("is_active").default(true),

    // Notes
    notes: text("notes"),

    // Metadata
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_travel_origins_active").on(table.isActive),
    index("idx_travel_origins_default").on(table.isDefault),
    index("idx_travel_origins_deleted").on(table.isDeleted),
  ],
);

/**
 * ============================================================================
 * OPERATING EXPENSE DEFAULT SETTINGS (Operating Expenses Tab)
 * ============================================================================
 * Parameters for calculating operating expenses in bids
 */
export const operatingExpenseDefaults = auth.table(
  "operating_expense_defaults",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Financial Base Data
    grossRevenuePreviousYear: numeric("gross_revenue_previous_year", {
      precision: 15,
      scale: 2,
    }).default("5000000.00"),

    operatingCostPreviousYear: numeric("operating_cost_previous_year", {
      precision: 15,
      scale: 2,
    }).default("520000.00"),

    // Calculation Parameters
    inflationRate: numeric("inflation_rate", {
      precision: 5,
      scale: 2,
    }).default("4.00"), // Percentage

    defaultMarkupPercentage: numeric("default_markup_percentage", {
      precision: 5,
      scale: 2,
    }).default("20.00"), // Percentage

    // Behavior Settings
    enableByDefault: boolean("enable_by_default").default(false), // Auto-include in new bids

    // Metadata
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
);

/**
 * ============================================================================
 * PROPOSAL BASIS TEMPLATES (Proposal Templates Tab - Proposal Basis)
 * ============================================================================
 * Templates for proposal basis field (e.g., "Based on RFP and Plans")
 */
export const proposalBasisTemplates = auth.table(
  "proposal_basis_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Template Details
    label: varchar("label", { length: 255 }).notNull(), // "RFP and Plans"
    template: text("template").notNull(), // "This proposal was based on Client's RFP and plans dated [DATE]"

    // Ordering
    sortOrder: integer("sort_order").default(0),

    // Status
    isActive: boolean("is_active").default(true),

    // Metadata
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_proposal_basis_active").on(table.isActive),
    index("idx_proposal_basis_deleted").on(table.isDeleted),
    index("idx_proposal_basis_sort").on(table.sortOrder),
  ],
);

/**
 * ============================================================================
 * TERMS & CONDITIONS TEMPLATES (Proposal Templates Tab - Terms & Conditions)
 * ============================================================================
 * Templates for terms, exclusions, warranty sections
 */
export const termsConditionsTemplates = auth.table(
  "terms_conditions_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Template Details
    label: varchar("label", { length: 255 }).notNull(), // "Standard T&C"
    exclusions: text("exclusions"), // List of exclusions
    warrantyDetails: text("warranty_details"), // Warranty information
    specialTerms: text("special_terms"), // Special terms and conditions

    // Ordering
    sortOrder: integer("sort_order").default(0),

    // Status
    isActive: boolean("is_active").default(true),
    isDefault: boolean("is_default").default(false), // Default template to use

    // Metadata
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_terms_templates_active").on(table.isActive),
    index("idx_terms_templates_deleted").on(table.isDeleted),
    index("idx_terms_templates_default").on(table.isDefault),
    index("idx_terms_templates_sort").on(table.sortOrder),
  ],
);
