import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Inventory Stock Status Enum
 * Current stock status of inventory items
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
 * Status of inventory allocations to jobs/bids
 */
export const inventoryAllocationStatusEnum = pgEnum(
  "inventory_allocation_status_enum",
  [
    "allocated", // Reserved but not yet issued
    "issued", // Given to job/team
    "partially_used", // Some quantity used
    "fully_used", // All quantity used
    "returned", // Returned to inventory
    "cancelled", // Allocation cancelled
  ]
);

/**
 * Inventory Transaction Type Enum
 * Types of inventory transactions
 */
export const inventoryTransactionTypeEnum = pgEnum(
  "inventory_transaction_type_enum",
  [
    "receipt", // Receiving stock (purchase, return)
    "issue", // Issuing stock to job/team
    "adjustment", // Inventory count adjustment
    "transfer", // Transfer between locations
    "return", // Return from job/team
    "write_off", // Stock write-off (damaged, expired, stolen)
    "initial_stock", // Initial stock entry
  ]
);

/**
 * Purchase Order Status Enum
 * Status of purchase orders
 */
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status_enum", [
  "draft", // Being created
  "pending_approval", // Awaiting approval
  "approved", // Approved and sent to supplier
  "sent", // Sent to supplier
  "partially_received", // Some items received
  "received", // All items received
  "cancelled", // Cancelled
  "closed", // Closed/completed
]);





