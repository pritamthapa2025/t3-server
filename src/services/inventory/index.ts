/**
 * Inventory Services - Modular Organization
 * Split from monolithic 2,500-line file into focused modules
 * All exports maintain backward compatibility
 */

// Items
export * from "./inventory-items.service.js";

// Transactions
export * from "./inventory-transactions.service.js";

// Allocations
export * from "./inventory-allocations.service.js";

// Purchase Orders
export * from "./inventory-purchase-orders.service.js";

// Master Data (Suppliers, Locations, Categories, Units)
export * from "./inventory-master-data.service.js";

// Reports, Dashboard, Alerts, Counts
export * from "./inventory-reports.service.js";











