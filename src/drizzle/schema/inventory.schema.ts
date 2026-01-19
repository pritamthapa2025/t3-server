import {
  pgSchema,
  pgEnum,
  uuid,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  numeric,
  date,
  unique,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

// Import related tables
import { users } from "./auth.schema.js";
import { jobs } from "./jobs.schema.js";
import { bidsTable } from "./bids.schema.js";

const org = pgSchema("org");

// ===========================
// INVENTORY ENUMS
// ===========================

/**
 * Inventory Stock Status Enum
 */
export const inventoryStockStatusEnum = pgEnum("inventory_stock_status_enum", [
  "in_stock",
  "low_stock",
  "out_of_stock",
  "on_order",
  "discontinued",
]);

/**
 * Inventory Allocation Status Enum
 */
export const inventoryAllocationStatusEnum = pgEnum(
  "inventory_allocation_status_enum",
  [
    "allocated",
    "issued",
    "partially_used",
    "fully_used",
    "returned",
    "cancelled",
  ]
);

/**
 * Inventory Transaction Type Enum
 */
export const inventoryTransactionTypeEnum = pgEnum(
  "inventory_transaction_type_enum",
  [
    "receipt",
    "issue",
    "adjustment",
    "transfer",
    "return",
    "write_off",
    "initial_stock",
  ]
);

/**
 * Purchase Order Status Enum
 */
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status_enum", [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "partially_received",
  "received",
  "cancelled",
  "closed",
]);

// ===========================
// INVENTORY TABLES
// ===========================

/**
 * Inventory Categories Table
 * Reference table for inventory categories (Materials, Tools, Consumables, Equipment)
 */
export const inventoryCategories = org.table(
  "inventory_categories",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: text("description"),
    code: varchar("code", { length: 20 }).unique(), // MAT, TOOL, CONS, EQUIP
    color: varchar("color", { length: 7 }), // Hex color for UI display
    icon: varchar("icon", { length: 100 }), // Icon name/path

    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_inventory_categories_active").on(table.isActive),
    index("idx_inventory_categories_code").on(table.code),
  ]
);

/**
 * Inventory Suppliers Table
 * Supplier/vendor information for inventory items
 */
export const inventorySuppliers = org.table(
  "inventory_suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Basic Info
    supplierCode: varchar("supplier_code", { length: 50 }), // SUP-001
    name: varchar("name", { length: 255 }).notNull(),
    legalName: varchar("legal_name", { length: 255 }),

    // Contact Info
    contactName: varchar("contact_name", { length: 150 }),
    email: varchar("email", { length: 150 }),
    phone: varchar("phone", { length: 20 }),
    website: varchar("website", { length: 255 }),

    // Address
    streetAddress: varchar("street_address", { length: 255 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 50 }),
    zipCode: varchar("zip_code", { length: 20 }),
    country: varchar("country", { length: 100 }).default("USA"),

    // Business Info
    taxId: varchar("tax_id", { length: 50 }),
    accountNumber: varchar("account_number", { length: 100 }), // Our account # with them

    // Payment Terms
    paymentTerms: varchar("payment_terms", { length: 100 }), // Net 30, Net 60, etc.
    creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }),

    // Performance Tracking
    rating: numeric("rating", { precision: 3, scale: 2 }), // 0.00 to 5.00
    leadTimeDays: integer("lead_time_days"), // Average lead time

    // Status
    isActive: boolean("is_active").default(true),
    isPreferred: boolean("is_preferred").default(false),

    notes: text("notes"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_supplier_code").on(table.supplierCode),
    index("idx_inventory_suppliers_active").on(table.isActive),
    index("idx_inventory_suppliers_preferred").on(table.isPreferred),
    index("idx_inventory_suppliers_deleted").on(table.isDeleted),
  ]
);

/**
 * Inventory Locations Table
 * Storage locations for inventory (Warehouse A - Section 3, Tool Room - Shelf B2, etc.)
 */
export const inventoryLocations: any = org.table(
  "inventory_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    locationCode: varchar("location_code", { length: 50 }), // WH-A-S3, TR-B2
    name: varchar("name", { length: 255 }).notNull(),
    locationType: varchar("location_type", { length: 50 }), // warehouse, storage_room, vehicle, job_site

    // Hierarchical structure (optional parent location)
    parentLocationId: uuid("parent_location_id").references(
      () => inventoryLocations.id
    ),

    // Address (for warehouses/facilities)
    streetAddress: varchar("street_address", { length: 255 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 50 }),
    zipCode: varchar("zip_code", { length: 20 }),

    // Details
    capacity: numeric("capacity", { precision: 10, scale: 2 }), // Square footage or volume
    capacityUnit: varchar("capacity_unit", { length: 20 }), // sq_ft, cubic_ft, etc.

    // Manager
    managerId: uuid("manager_id").references(() => users.id, {}),

    // Access
    accessInstructions: text("access_instructions"),

    isActive: boolean("is_active").default(true),
    notes: text("notes"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_location_code").on(table.locationCode),
    index("idx_inventory_locations_type").on(table.locationType),
    index("idx_inventory_locations_parent").on(table.parentLocationId),
    index("idx_inventory_locations_active").on(table.isActive),
    index("idx_inventory_locations_deleted").on(table.isDeleted),
  ]
);

/**
 * Units of Measure Table
 * Reference table for measurement units
 */
export const inventoryUnitsOfMeasure = org.table(
  "inventory_units_of_measure",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 50 }).notNull().unique(), // Piece, Box, Roll, Set, etc.
    abbreviation: varchar("abbreviation", { length: 10 }).notNull().unique(), // pcs, box, roll, set
    unitType: varchar("unit_type", { length: 50 }), // count, length, weight, volume

    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_inventory_uom_active").on(table.isActive),
    index("idx_inventory_uom_type").on(table.unitType),
  ]
);

/**
 * Main Inventory Items Table
 * Core inventory management
 */
export const inventoryItems = org.table(
  "inventory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Basic Info
    itemCode: varchar("item_code", { length: 100 }).notNull(), // SKU: MAT-STC-2IN-001
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),

    // Categorization
    categoryId: integer("category_id")
      .notNull()
      .references(() => inventoryCategories.id),

    // Supplier
    primarySupplierId: uuid("primary_supplier_id").references(
      () => inventorySuppliers.id
    ),

    // Unit of Measure
    unitOfMeasureId: integer("unit_of_measure_id")
      .notNull()
      .references(() => inventoryUnitsOfMeasure.id),

    // Pricing
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    lastPurchasePrice: numeric("last_purchase_price", {
      precision: 15,
      scale: 2,
    }),
    averageCost: numeric("average_cost", { precision: 15, scale: 2 }), // Moving average
    sellingPrice: numeric("selling_price", { precision: 15, scale: 2 }), // For billing

    // Stock Levels
    quantityOnHand: numeric("quantity_on_hand", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    quantityAllocated: numeric("quantity_allocated", {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default("0"),
    quantityAvailable: numeric("quantity_available", {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default("0"), // quantityOnHand - quantityAllocated
    quantityOnOrder: numeric("quantity_on_order", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),

    // Reorder Management
    reorderLevel: numeric("reorder_level", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    reorderQuantity: numeric("reorder_quantity", { precision: 10, scale: 2 }),
    maxStockLevel: numeric("max_stock_level", { precision: 10, scale: 2 }),

    // Primary Location
    primaryLocationId: uuid("primary_location_id").references(
      () => inventoryLocations.id
    ),

    // Product Details
    manufacturer: varchar("manufacturer", { length: 150 }),
    modelNumber: varchar("model_number", { length: 100 }),
    partNumber: varchar("part_number", { length: 100 }),
    barcode: varchar("barcode", { length: 100 }),

    // Physical Characteristics
    weight: numeric("weight", { precision: 10, scale: 2 }),
    weightUnit: varchar("weight_unit", { length: 20 }), // lbs, kg
    dimensions: varchar("dimensions", { length: 100 }), // "24x12x8 inches"

    // Additional Info
    specifications: jsonb("specifications"), // Flexible specs storage
    tags: jsonb("tags"), // Array of tags
    images: jsonb("images"), // Array of image URLs

    // Tracking
    trackBySerialNumber: boolean("track_by_serial_number").default(false),
    trackByBatch: boolean("track_by_batch").default(false),

    // Status
    status: inventoryStockStatusEnum("status").notNull().default("in_stock"),
    isActive: boolean("is_active").default(true),

    // Metadata
    lastRestockedDate: date("last_restocked_date"),
    lastCountedDate: date("last_counted_date"),
    notes: text("notes"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_item_code").on(table.itemCode),
    index("idx_inventory_items_category").on(table.categoryId),
    index("idx_inventory_items_supplier").on(table.primarySupplierId),
    index("idx_inventory_items_location").on(table.primaryLocationId),
    index("idx_inventory_items_status").on(table.status),
    index("idx_inventory_items_barcode").on(table.barcode),
    index("idx_inventory_items_active").on(table.isActive),
    index("idx_inventory_items_deleted").on(table.isDeleted),
    // Composite index for low stock queries
    index("idx_inventory_items_stock_check").on(
      table.quantityOnHand,
      table.reorderLevel
    ),
  ]
);

/**
 * Inventory Item Locations Table
 * Track items across multiple locations (one item can be in multiple locations)
 */
export const inventoryItemLocations = org.table(
  "inventory_item_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => inventoryLocations.id),

    quantity: numeric("quantity", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),

    // Location-specific details
    binNumber: varchar("bin_number", { length: 50 }),
    aisle: varchar("aisle", { length: 50 }),
    shelf: varchar("shelf", { length: 50 }),

    lastCountedDate: date("last_counted_date"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_item_location").on(table.itemId, table.locationId),
    index("idx_inventory_item_locations_item").on(table.itemId),
    index("idx_inventory_item_locations_location").on(table.locationId),
  ]
);

/**
 * Inventory Transactions Table
 * All stock movements (receipt, issue, adjustment, transfer, return)
 */
export const inventoryTransactions = org.table(
  "inventory_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    transactionNumber: varchar("transaction_number", { length: 100 }).notNull(), // TXN-2025-0001

    // Item & Location
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),
    locationId: uuid("location_id").references(() => inventoryLocations.id, {}),

    // Transaction Details
    transactionType: inventoryTransactionTypeEnum("transaction_type").notNull(),
    transactionDate: timestamp("transaction_date").notNull().defaultNow(),

    // Quantity
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 }),
    totalCost: numeric("total_cost", { precision: 15, scale: 2 }),

    // Balance after transaction
    balanceAfter: numeric("balance_after", { precision: 10, scale: 2 }),

    // Related Records
    purchaseOrderId: uuid("purchase_order_id").references(
      () => inventoryPurchaseOrders.id
    ),
    jobId: uuid("job_id").references(() => jobs.id),
    bidId: uuid("bid_id").references(() => bidsTable.id, {}),

    // Transfer details (if transaction_type = 'transfer')
    fromLocationId: uuid("from_location_id").references(
      () => inventoryLocations.id
    ),
    toLocationId: uuid("to_location_id").references(
      () => inventoryLocations.id
    ),

    // Tracking
    batchNumber: varchar("batch_number", { length: 100 }),
    serialNumber: varchar("serial_number", { length: 100 }),
    expirationDate: date("expiration_date"),

    // Reference & Notes
    referenceNumber: varchar("reference_number", { length: 100 }), // PO#, Job#, etc.
    notes: text("notes"),

    // Metadata
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("unique_transaction_number").on(table.transactionNumber),
    index("idx_inventory_transactions_item").on(table.itemId),
    index("idx_inventory_transactions_location").on(table.locationId),
    index("idx_inventory_transactions_type").on(table.transactionType),
    index("idx_inventory_transactions_date").on(table.transactionDate),
    index("idx_inventory_transactions_po").on(table.purchaseOrderId),
    index("idx_inventory_transactions_job").on(table.jobId),
    index("idx_inventory_transactions_performed_by").on(table.performedBy),
    // Composite index for item history queries
    index("idx_inventory_transactions_item_date").on(
      table.itemId,
      table.transactionDate
    ),
  ]
);

/**
 * Inventory Purchase Orders Table
 * Track orders placed with suppliers
 */
export const inventoryPurchaseOrders = org.table(
  "inventory_purchase_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    poNumber: varchar("po_number", { length: 100 }).notNull(), // PO-2025-0001

    // Supplier
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => inventorySuppliers.id),

    // Dates
    orderDate: date("order_date").notNull(),
    expectedDeliveryDate: date("expected_delivery_date"),
    actualDeliveryDate: date("actual_delivery_date"),

    // Status
    status: purchaseOrderStatusEnum("status").notNull().default("draft"),

    // Financial
    subtotal: numeric("subtotal", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0"),
    shippingCost: numeric("shipping_cost", { precision: 15, scale: 2 }).default(
      "0"
    ),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),

    // Shipping
    shipToLocationId: uuid("ship_to_location_id").references(
      () => inventoryLocations.id
    ),
    shippingAddress: text("shipping_address"),
    trackingNumber: varchar("tracking_number", { length: 100 }),

    // Payment
    paymentTerms: varchar("payment_terms", { length: 100 }),
    paymentStatus: varchar("payment_status", { length: 50 }), // pending, partial, paid
    amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).default(
      "0"
    ),

    // Reference
    supplierInvoiceNumber: varchar("supplier_invoice_number", { length: 100 }),
    notes: text("notes"),

    // Metadata
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id, {}),
    approvedAt: timestamp("approved_at"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_po_number").on(table.poNumber),
    index("idx_inventory_po_supplier").on(table.supplierId),
    index("idx_inventory_po_status").on(table.status),
    index("idx_inventory_po_order_date").on(table.orderDate),
    index("idx_inventory_po_expected_delivery").on(table.expectedDeliveryDate),
    index("idx_inventory_po_created_by").on(table.createdBy),
    index("idx_inventory_po_deleted").on(table.isDeleted),
  ]
);

/**
 * Purchase Order Line Items Table
 * Individual items on a purchase order
 */
export const inventoryPurchaseOrderItems = org.table(
  "inventory_purchase_order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => inventoryPurchaseOrders.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),

    // Quantities
    quantityOrdered: numeric("quantity_ordered", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    quantityReceived: numeric("quantity_received", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),

    // Pricing
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 15, scale: 2 }).notNull(),

    // Delivery
    expectedDeliveryDate: date("expected_delivery_date"),
    actualDeliveryDate: date("actual_delivery_date"),

    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_po_item").on(table.purchaseOrderId, table.itemId),
    index("idx_inventory_po_items_po").on(table.purchaseOrderId),
    index("idx_inventory_po_items_item").on(table.itemId),
  ]
);

/**
 * Inventory Allocations Table
 * Track which items are allocated/reserved for specific jobs or bids
 */
export const inventoryAllocations = org.table(
  "inventory_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),

    // Allocated To
    jobId: uuid("job_id").references(() => jobs.id),
    bidId: uuid("bid_id").references(() => bidsTable.id, {}),

    // Quantity
    quantityAllocated: numeric("quantity_allocated", {
      precision: 10,
      scale: 2,
    }).notNull(),
    quantityUsed: numeric("quantity_used", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    quantityReturned: numeric("quantity_returned", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),

    // Dates
    allocationDate: date("allocation_date").notNull().defaultNow(),
    expectedUseDate: date("expected_use_date"),
    actualUseDate: date("actual_use_date"),

    // Status
    status: inventoryAllocationStatusEnum("status")
      .notNull()
      .default("allocated"),

    // Metadata
    allocatedBy: uuid("allocated_by")
      .notNull()
      .references(() => users.id),
    notes: text("notes"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_inventory_allocations_item").on(table.itemId),
    index("idx_inventory_allocations_job").on(table.jobId),
    index("idx_inventory_allocations_bid").on(table.bidId),
    index("idx_inventory_allocations_status").on(table.status),
    index("idx_inventory_allocations_date").on(table.allocationDate),
    index("idx_inventory_allocations_deleted").on(table.isDeleted),
    // Composite index for active allocations
    index("idx_inventory_allocations_active").on(
      table.itemId,
      table.status,
      table.isDeleted
    ),
  ]
);

/**
 * Inventory Stock Alerts Table
 * Track low stock notifications and alerts
 */
export const inventoryStockAlerts = org.table(
  "inventory_stock_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),

    alertType: varchar("alert_type", { length: 50 }).notNull(), // low_stock, out_of_stock, overstock, expiring
    severity: varchar("severity", { length: 20 }).notNull(), // info, warning, critical

    message: text("message").notNull(),

    // Thresholds
    currentQuantity: numeric("current_quantity", { precision: 10, scale: 2 }),
    thresholdQuantity: numeric("threshold_quantity", {
      precision: 10,
      scale: 2,
    }),

    // Status
    isAcknowledged: boolean("is_acknowledged").default(false),
    acknowledgedBy: uuid("acknowledged_by").references(() => users.id, {}),
    acknowledgedAt: timestamp("acknowledged_at"),

    isResolved: boolean("is_resolved").default(false),
    resolvedBy: uuid("resolved_by").references(() => users.id, {}),
    resolvedAt: timestamp("resolved_at"),
    resolutionNotes: text("resolution_notes"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_inventory_alerts_item").on(table.itemId),
    index("idx_inventory_alerts_type").on(table.alertType),
    index("idx_inventory_alerts_severity").on(table.severity),
    index("idx_inventory_alerts_acknowledged").on(table.isAcknowledged),
    index("idx_inventory_alerts_resolved").on(table.isResolved),
    index("idx_inventory_alerts_created").on(table.createdAt),
    // Composite index for unresolved alerts
    index("idx_inventory_alerts_active").on(table.isResolved, table.severity),
  ]
);

/**
 * Inventory Item History/Audit Table
 * Track all changes to inventory items for audit purposes
 */
export const inventoryItemHistory = org.table(
  "inventory_item_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),

    action: varchar("action", { length: 100 }).notNull(), // created, updated, deleted, price_changed, etc.
    fieldChanged: varchar("field_changed", { length: 100 }), // Field name that changed
    oldValue: text("old_value"),
    newValue: text("new_value"),
    description: text("description"),

    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_inventory_item_history_item").on(table.itemId),
    index("idx_inventory_item_history_action").on(table.action),
    index("idx_inventory_item_history_performed_by").on(table.performedBy),
    index("idx_inventory_item_history_created").on(table.createdAt),
    // Composite index for item audit trail
    index("idx_inventory_item_history_item_date").on(
      table.itemId,
      table.createdAt
    ),
  ]
);

/**
 * Inventory Price History Table
 * Track price changes over time for cost analysis
 */
export const inventoryPriceHistory = org.table(
  "inventory_price_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),

    // Price Information
    priceType: varchar("price_type", { length: 50 }).notNull(), // unit_cost, purchase_price, selling_price
    oldPrice: numeric("old_price", { precision: 15, scale: 2 }),
    newPrice: numeric("new_price", { precision: 15, scale: 2 }).notNull(),
    
    // Context
    supplierId: uuid("supplier_id").references(() => inventorySuppliers.id),
    purchaseOrderId: uuid("purchase_order_id").references(() => inventoryPurchaseOrders.id),
    reason: varchar("reason", { length: 100 }), // supplier_change, market_adjustment, purchase_order, etc.
    
    // Metadata
    effectiveDate: date("effective_date").notNull(),
    notes: text("notes"),
    
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_inventory_price_history_item").on(table.itemId),
    index("idx_inventory_price_history_type").on(table.priceType),
    index("idx_inventory_price_history_date").on(table.effectiveDate),
    index("idx_inventory_price_history_supplier").on(table.supplierId),
    // Composite index for item price timeline
    index("idx_inventory_price_history_item_date").on(
      table.itemId,
      table.effectiveDate
    ),
  ]
);

/**
 * Inventory Counts/Physical Inventory Table
 * Track physical inventory counts/cycle counts
 */
export const inventoryCounts = org.table(
  "inventory_counts",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    countNumber: varchar("count_number", { length: 100 }).notNull(), // CNT-2025-0001
    countType: varchar("count_type", { length: 50 }).notNull(), // full, cycle, spot

    locationId: uuid("location_id").references(() => inventoryLocations.id, {}),

    // Dates
    countDate: date("count_date").notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),

    // Status
    status: varchar("status", { length: 50 }).notNull(), // planned, in_progress, completed, cancelled

    // Performed By
    performedBy: uuid("performed_by").references(() => users.id, {}),

    notes: text("notes"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_count_number").on(table.countNumber),
    index("idx_inventory_counts_location").on(table.locationId),
    index("idx_inventory_counts_status").on(table.status),
    index("idx_inventory_counts_date").on(table.countDate),
    index("idx_inventory_counts_deleted").on(table.isDeleted),
  ]
);

/**
 * Inventory Count Items Table
 * Individual items counted during physical inventory
 */
export const inventoryCountItems = org.table(
  "inventory_count_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countId: uuid("count_id")
      .notNull()
      .references(() => inventoryCounts.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id),

    // Quantities
    systemQuantity: numeric("system_quantity", { precision: 10, scale: 2 })
      .notNull()
      .default("0"), // What system shows
    countedQuantity: numeric("counted_quantity", { precision: 10, scale: 2 }), // What was counted
    variance: numeric("variance", { precision: 10, scale: 2 }), // Difference
    variancePercentage: numeric("variance_percentage", {
      precision: 5,
      scale: 2,
    }),

    // Cost Impact
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 }),
    varianceCost: numeric("variance_cost", { precision: 15, scale: 2 }), // variance * unitCost

    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_count_item").on(table.countId, table.itemId),
    index("idx_inventory_count_items_count").on(table.countId),
    index("idx_inventory_count_items_item").on(table.itemId),
    // Index for variance analysis
    index("idx_inventory_count_items_variance").on(table.variance),
  ]
);
