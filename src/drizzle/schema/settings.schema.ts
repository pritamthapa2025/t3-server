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
 * COMPANY SETTINGS (General Tab)
 * ============================================================================
 * System-wide company information and preferences
 */
export const companySettings = auth.table("company_settings", {
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
  country: varchar("country", { length: 100 }).default("USA"),

  // Business Licenses & IDs
  taxId: varchar("tax_id", { length: 50 }), // EIN
  licenseNumber: varchar("license_number", { length: 100 }), // HVAC License

  // Branding
  logoUrl: varchar("logo_url", { length: 500 }),

  // System Settings
  timeZone: varchar("time_zone", { length: 100 }).default(
    "America/Los_Angeles",
  ), // Pacific Time (PT)

  // Business Hours & Holidays
  workWeekStart: varchar("work_week_start", { length: 20 }).default("Monday"), // Monday, Tuesday, etc.
  workStartTime: varchar("work_start_time", { length: 10 }).default("08:00"), // HH:MM format
  workEndTime: varchar("work_end_time", { length: 10 }).default("17:00"), // HH:MM format

  // Date & Time Format
  dateFormat: varchar("date_format", { length: 50 }).default("MM/DD/YYYY"), // MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
  timeFormat: varchar("time_format", { length: 20 }).default("12-hour"), // "12-hour" or "24-hour"

  // Metadata
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * ============================================================================
 * ANNOUNCEMENT SETTINGS
 * ============================================================================
 * Dashboard-wide announcement banner settings
 */
export const announcementSettings = auth.table("announcement_settings", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Announcement Configuration
  enabled: boolean("enabled").default(false),
  title: varchar("title", { length: 255 }),
  description: text("description"),

  // Visual Settings
  backgroundColor: varchar("background_color", { length: 50 }),
  textColor: varchar("text_color", { length: 50 }),

  // Metadata
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * ============================================================================
 * LABOR RATE TEMPLATES
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
    defaultQuantity: integer("default_quantity").default(1),
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
 * VEHICLE & TRAVEL DEFAULT SETTINGS
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
 * TRAVEL ORIGIN ADDRESSES
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
 * OPERATING EXPENSE DEFAULT SETTINGS (Financial Tab)
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
 * JOB SETTINGS
 * ============================================================================
 * Default settings for job management
 */
export const jobSettings = auth.table("job_settings", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Job Numbering
  jobNumberPrefix: varchar("job_number_prefix", { length: 20 }).default("JOB"), // JOB-2025-000001
  jobNumberStartingNumber: integer("job_number_starting_number").default(1),

  // Default Values
  defaultJobPriority: varchar("default_job_priority", { length: 50 }).default(
    "medium",
  ), // low, medium, high, critical
  defaultJobStatus: varchar("default_job_status", { length: 50 }).default(
    "scheduled",
  ),

  // Automation Settings
  autoAssignFromBid: boolean("auto_assign_from_bid").default(true), // Auto-assign team from bid
  requireApprovalBeforeStart: boolean("require_approval_before_start").default(
    false,
  ),

  // Notification Settings
  notifyOnStatusChange: boolean("notify_on_status_change").default(true),
  notifyOnCompletion: boolean("notify_on_completion").default(true),

  // Metadata
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * ============================================================================
 * INVOICE SETTINGS
 * ============================================================================
 * Default settings for invoicing
 */
export const invoiceSettings = auth.table("invoice_settings", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Invoice Numbering
  invoiceNumberPrefix: varchar("invoice_number_prefix", { length: 20 }).default(
    "INV",
  ), // INV-2025-000001
  invoiceNumberStartingNumber: integer(
    "invoice_number_starting_number",
  ).default(1),

  // Payment Terms
  defaultPaymentTerms: varchar("default_payment_terms", { length: 50 }).default(
    "Net 30",
  ), // Net 30, Net 60, Due on Receipt
  defaultPaymentTermsDays: integer("default_payment_terms_days").default(30),

  // Late Fees
  enableLateFees: boolean("enable_late_fees").default(false),
  lateFeePercentage: numeric("late_fee_percentage", {
    precision: 5,
    scale: 2,
  }).default("0.00"),
  lateFeeGracePeriodDays: integer("late_fee_grace_period_days").default(0),

  // Invoice Display
  showLineItemDetails: boolean("show_line_item_details").default(true),
  showLaborBreakdown: boolean("show_labor_breakdown").default(true),
  showMaterialsBreakdown: boolean("show_materials_breakdown").default(true),

  // Invoice Notes
  defaultInvoiceNotes: text("default_invoice_notes"),
  defaultTermsAndConditions: text("default_terms_and_conditions"),

  // Automation
  autoSendOnCompletion: boolean("auto_send_on_completion").default(false),
  autoRemindBeforeDue: boolean("auto_remind_before_due").default(false),
  reminderDaysBeforeDue: integer("reminder_days_before_due").default(7),

  // Metadata
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * ============================================================================
 * TAX SETTINGS
 * ============================================================================
 * Company tax configuration
 */
export const taxSettings = auth.table("tax_settings", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Default Tax Rates
  defaultSalesTaxRate: numeric("default_sales_tax_rate", {
    precision: 5,
    scale: 4,
  }).default("0.0000"), // Percentage (e.g., 0.0825 = 8.25%)

  salesTaxLabel: varchar("sales_tax_label", { length: 100 }).default(
    "Sales Tax",
  ),

  // Tax Behavior
  taxIncludedInPrice: boolean("tax_included_in_price").default(false), // Tax shown separately or included
  applyTaxToLabor: boolean("apply_tax_to_labor").default(true),
  applyTaxToMaterials: boolean("apply_tax_to_materials").default(true),
  applyTaxToTravel: boolean("apply_tax_to_travel").default(false),

  // Tax Exemptions
  allowTaxExempt: boolean("allow_tax_exempt").default(true),
  requireTaxExemptCertificate: boolean(
    "require_tax_exempt_certificate",
  ).default(true),

  // Tax Jurisdiction
  taxJurisdiction: varchar("tax_jurisdiction", { length: 255 }), // "California", "San Francisco, CA"
  taxIdNumber: varchar("tax_id_number", { length: 100 }), // State tax ID

  // Metadata
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * ============================================================================
 * INVENTORY SETTINGS
 * ============================================================================
 * Inventory management preferences
 */
export const inventorySettings = auth.table("inventory_settings", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Low Stock Alerts
  enableLowStockAlerts: boolean("enable_low_stock_alerts").default(true),
  defaultLowStockThreshold: integer("default_low_stock_threshold").default(10), // Units

  // Reorder Settings
  enableAutoReorder: boolean("enable_auto_reorder").default(false),
  defaultReorderQuantity: integer("default_reorder_quantity").default(50),
  defaultReorderPoint: integer("default_reorder_point").default(20),

  // Inventory Tracking
  trackSerialNumbers: boolean("track_serial_numbers").default(false),
  trackLotNumbers: boolean("track_lot_numbers").default(false),
  trackExpirationDates: boolean("track_expiration_dates").default(false),

  // Inventory Valuation
  valuationMethod: varchar("valuation_method", { length: 50 }).default("FIFO"), // FIFO, LIFO, Average Cost

  // Notifications
  notifyOnLowStock: boolean("notify_on_low_stock").default(true),
  notifyOnOutOfStock: boolean("notify_on_out_of_stock").default(true),
  notifyOnReorderPoint: boolean("notify_on_reorder_point").default(true),

  // Default Units
  defaultWeightUnit: varchar("default_weight_unit", { length: 20 }).default(
    "lbs",
  ), // lbs, kg
  defaultVolumeUnit: varchar("default_volume_unit", { length: 20 }).default(
    "gal",
  ), // gal, L

  // Metadata
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * ============================================================================
 * NOTIFICATION SETTINGS
 * ============================================================================
 * System-wide notification preferences (for future WebSocket implementation)
 */
export const notificationSettings = auth.table("notification_settings", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Global Notification Controls
  enableEmailNotifications: boolean("enable_email_notifications").default(true),
  enablePushNotifications: boolean("enable_push_notifications").default(true),
  enableSmsNotifications: boolean("enable_sms_notifications").default(false),
  enableInAppNotifications: boolean("enable_in_app_notifications").default(
    true,
  ),

  // Notification Categories (system-wide defaults)
  notifyOnNewBid: boolean("notify_on_new_bid").default(true),
  notifyOnBidApproval: boolean("notify_on_bid_approval").default(true),
  notifyOnJobAssignment: boolean("notify_on_job_assignment").default(true),
  notifyOnJobCompletion: boolean("notify_on_job_completion").default(true),
  notifyOnInvoiceCreated: boolean("notify_on_invoice_created").default(true),
  notifyOnPaymentReceived: boolean("notify_on_payment_received").default(true),
  notifyOnInventoryLow: boolean("notify_on_inventory_low").default(true),
  notifyOnVehicleMaintenance: boolean("notify_on_vehicle_maintenance").default(
    true,
  ),
  notifyOnTimesheetSubmission: boolean(
    "notify_on_timesheet_submission",
  ).default(true),
  notifyOnTimesheetApproval: boolean("notify_on_timesheet_approval").default(
    true,
  ),

  // Digest Settings
  enableDailyDigest: boolean("enable_daily_digest").default(false),
  dailyDigestTime: varchar("daily_digest_time", { length: 10 }).default(
    "08:00",
  ), // HH:MM

  enableWeeklyDigest: boolean("enable_weekly_digest").default(false),
  weeklyDigestDay: varchar("weekly_digest_day", { length: 20 }).default(
    "Monday",
  ),

  // Notification Preferences
  quietHoursEnabled: boolean("quiet_hours_enabled").default(false),
  quietHoursStart: varchar("quiet_hours_start", { length: 10 }).default(
    "22:00",
  ), // HH:MM
  quietHoursEnd: varchar("quiet_hours_end", { length: 10 }).default("08:00"), // HH:MM

  // Metadata
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * ============================================================================
 * USER NOTIFICATION PREFERENCES
 * ============================================================================
 * Per-user notification overrides (overrides system defaults)
 */
export const userNotificationPreferences = auth.table(
  "user_notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull()
      .unique(),

    // User-level Channel Controls
    enableEmailNotifications: boolean("enable_email_notifications"),
    enablePushNotifications: boolean("enable_push_notifications"),
    enableSmsNotifications: boolean("enable_sms_notifications"),
    enableInAppNotifications: boolean("enable_in_app_notifications"),

    // User-level Category Overrides (null = use system default)
    notifyOnNewBid: boolean("notify_on_new_bid"),
    notifyOnBidApproval: boolean("notify_on_bid_approval"),
    notifyOnJobAssignment: boolean("notify_on_job_assignment"),
    notifyOnJobCompletion: boolean("notify_on_job_completion"),
    notifyOnInvoiceCreated: boolean("notify_on_invoice_created"),
    notifyOnPaymentReceived: boolean("notify_on_payment_received"),
    notifyOnInventoryLow: boolean("notify_on_inventory_low"),
    notifyOnVehicleMaintenance: boolean("notify_on_vehicle_maintenance"),
    notifyOnTimesheetSubmission: boolean("notify_on_timesheet_submission"),
    notifyOnTimesheetApproval: boolean("notify_on_timesheet_approval"),

    // User Digest Preferences
    enableDailyDigest: boolean("enable_daily_digest"),
    dailyDigestTime: varchar("daily_digest_time", { length: 10 }),

    enableWeeklyDigest: boolean("enable_weekly_digest"),
    weeklyDigestDay: varchar("weekly_digest_day", { length: 20 }),

    // User Quiet Hours
    quietHoursEnabled: boolean("quiet_hours_enabled"),
    quietHoursStart: varchar("quiet_hours_start", { length: 10 }),
    quietHoursEnd: varchar("quiet_hours_end", { length: 10 }),

    // Metadata
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_user_notification_prefs_user").on(table.userId)],
);
