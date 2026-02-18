/**
 * Purge Deleted Records Service
 *
 * Centralized cron job logic that permanently hard-deletes records that have been
 * soft-deleted (isDeleted = true) for more than GRACE_PERIOD_DAYS days across all
 * 13 main entity tables.
 *
 * Before hard-deleting, associated files are purged from DigitalOcean Spaces
 * (bid documents/media, vehicle documents, employee documents, expense receipts).
 *
 * Schedule recommendation: daily (e.g. 02:00 AM UTC).
 */

import { eq, and, lte, inArray } from "drizzle-orm";
import { db } from "../config/db.js";
import { bidsTable, bidDocuments, bidMedia, bidPlanSpecFiles, bidDesignBuildFiles } from "../drizzle/schema/bids.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { dispatchTasks } from "../drizzle/schema/dispatch.schema.js";
import { timesheets } from "../drizzle/schema/timesheet.schema.js";
import { expenses, expenseReceipts } from "../drizzle/schema/expenses.schema.js";
import { invoices } from "../drizzle/schema/invoicing.schema.js";
import { organizations } from "../drizzle/schema/client.schema.js";
import { employees, departments, employeeDocuments } from "../drizzle/schema/org.schema.js";
import { payrollRuns } from "../drizzle/schema/payroll.schema.js";
import { employeeComplianceCases } from "../drizzle/schema/compliance.schema.js";
import { vehicles, vehicleDocuments } from "../drizzle/schema/fleet.schema.js";
import { inventoryItems } from "../drizzle/schema/inventory.schema.js";
import { deleteFromSpaces } from "./storage.service.js";
import { logger } from "../utils/logger.js";

const GRACE_PERIOD_DAYS = 30;

interface ModuleResult {
  module: string;
  hardDeleted: number;
  filesDeleted: number;
  errors: string[];
}

interface PurgeResult {
  gracePeriodDays: number;
  cutoffDate: string;
  modules: ModuleResult[];
  totalHardDeleted: number;
  totalFilesDeleted: number;
  totalErrors: number;
}

/**
 * Returns the cutoff date (now - GRACE_PERIOD_DAYS).
 * Records deleted before this date are eligible for permanent removal.
 */
function getCutoffDate(): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - GRACE_PERIOD_DAYS);
  return cutoff;
}

/**
 * Deletes a list of file paths from DO Spaces, ignoring individual failures.
 * Returns the count of successfully deleted files.
 */
async function purgeFilesFromSpaces(filePaths: (string | null | undefined)[]): Promise<number> {
  const paths = filePaths.filter((p): p is string => !!p);
  let deleted = 0;
  await Promise.all(
    paths.map(async (path) => {
      try {
        await deleteFromSpaces(path);
        deleted++;
      } catch (err: any) {
        logger.warn(`[purge] Failed to delete file from Spaces: ${path} — ${err?.message}`);
      }
    }),
  );
  return deleted;
}

/**
 * Generic hard-delete helper for UUID-pk tables (no associated file tables).
 */
async function hardDeleteUuidRows(
  table: any,
  cutoff: Date,
  moduleName: string,
): Promise<ModuleResult> {
  const result: ModuleResult = { module: moduleName, hardDeleted: 0, filesDeleted: 0, errors: [] };
  try {
    const eligible = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.isDeleted, true), lte(table.deletedAt, cutoff)));

    if (eligible.length === 0) return result;

    const ids = eligible.map((r: { id: string }) => r.id);
    const deleted = await db
      .delete(table)
      .where(inArray(table.id, ids))
      .returning({ id: table.id });

    result.hardDeleted = deleted.length;
    logger.info(`[purge] Hard-deleted ${deleted.length} ${moduleName} records`);
  } catch (err: any) {
    const msg = `Failed to purge ${moduleName}: ${err?.message ?? String(err)}`;
    result.errors.push(msg);
    logger.error(`[purge] ${msg}`);
  }
  return result;
}

/**
 * Generic hard-delete helper for integer-pk tables (employees, departments, timesheets).
 */
async function hardDeleteIntRows(
  table: any,
  cutoff: Date,
  moduleName: string,
): Promise<ModuleResult> {
  const result: ModuleResult = { module: moduleName, hardDeleted: 0, filesDeleted: 0, errors: [] };
  try {
    const eligible = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.isDeleted, true), lte(table.deletedAt, cutoff)));

    if (eligible.length === 0) return result;

    const ids = eligible.map((r: { id: number }) => r.id);
    const deleted = await db
      .delete(table)
      .where(inArray(table.id, ids))
      .returning({ id: table.id });

    result.hardDeleted = deleted.length;
    logger.info(`[purge] Hard-deleted ${deleted.length} ${moduleName} records`);
  } catch (err: any) {
    const msg = `Failed to purge ${moduleName}: ${err?.message ?? String(err)}`;
    result.errors.push(msg);
    logger.error(`[purge] ${msg}`);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-specific purge functions (with file cleanup)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Purge soft-deleted bids: delete bid documents, media, plan/spec files,
 * design-build files from DO Spaces, then hard-delete the bid rows.
 */
async function purgeBids(cutoff: Date): Promise<ModuleResult> {
  const result: ModuleResult = { module: "bids", hardDeleted: 0, filesDeleted: 0, errors: [] };
  try {
    const eligibleBids = await db
      .select({ id: bidsTable.id })
      .from(bidsTable)
      .where(and(eq(bidsTable.isDeleted, true), lte(bidsTable.deletedAt, cutoff)));

    if (eligibleBids.length === 0) return result;
    const bidIds = eligibleBids.map((r) => r.id);

    // Collect all file paths from child tables
    const [docs, media, planFiles, designFiles] = await Promise.all([
      db.select({ filePath: bidDocuments.filePath }).from(bidDocuments).where(inArray(bidDocuments.bidId, bidIds)),
      db.select({ filePath: bidMedia.filePath }).from(bidMedia).where(inArray(bidMedia.bidId, bidIds)),
      db.select({ filePath: bidPlanSpecFiles.filePath }).from(bidPlanSpecFiles).where(inArray(bidPlanSpecFiles.bidId, bidIds)),
      db.select({ filePath: bidDesignBuildFiles.filePath }).from(bidDesignBuildFiles).where(inArray(bidDesignBuildFiles.bidId, bidIds)),
    ]);

    const allPaths = [
      ...docs.map((r) => r.filePath),
      ...media.map((r) => r.filePath),
      ...planFiles.map((r) => r.filePath),
      ...designFiles.map((r) => r.filePath),
    ];

    // Delete files from DO Spaces
    result.filesDeleted = await purgeFilesFromSpaces(allPaths);

    // Hard-delete child rows (cascade not relied on)
    await Promise.all([
      db.delete(bidDocuments).where(inArray(bidDocuments.bidId, bidIds)),
      db.delete(bidMedia).where(inArray(bidMedia.bidId, bidIds)),
      db.delete(bidPlanSpecFiles).where(inArray(bidPlanSpecFiles.bidId, bidIds)),
      db.delete(bidDesignBuildFiles).where(inArray(bidDesignBuildFiles.bidId, bidIds)),
    ]);

    // Hard-delete main bid rows
    const deleted = await db.delete(bidsTable).where(inArray(bidsTable.id, bidIds)).returning({ id: bidsTable.id });
    result.hardDeleted = deleted.length;
    logger.info(`[purge] Bids: hard-deleted ${deleted.length} records, ${result.filesDeleted} files`);
  } catch (err: any) {
    const msg = `Failed to purge bids: ${err?.message ?? String(err)}`;
    result.errors.push(msg);
    logger.error(`[purge] ${msg}`);
  }
  return result;
}

/**
 * Purge soft-deleted vehicles: delete vehicle documents from DO Spaces,
 * then hard-delete vehicle rows.
 */
async function purgeVehicles(cutoff: Date): Promise<ModuleResult> {
  const result: ModuleResult = { module: "vehicles", hardDeleted: 0, filesDeleted: 0, errors: [] };
  try {
    const eligibleVehicles = await db
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.isDeleted, true), lte(vehicles.deletedAt, cutoff)));

    if (eligibleVehicles.length === 0) return result;
    const vehicleIds = eligibleVehicles.map((r) => r.id);

    // Collect file paths from vehicle_documents
    const docs = await db
      .select({ filePath: vehicleDocuments.filePath })
      .from(vehicleDocuments)
      .where(inArray(vehicleDocuments.vehicleId, vehicleIds));

    result.filesDeleted = await purgeFilesFromSpaces(docs.map((r) => r.filePath));

    // Hard-delete child document rows
    await db.delete(vehicleDocuments).where(inArray(vehicleDocuments.vehicleId, vehicleIds));

    // Hard-delete main vehicle rows
    const deleted = await db.delete(vehicles).where(inArray(vehicles.id, vehicleIds)).returning({ id: vehicles.id });
    result.hardDeleted = deleted.length;
    logger.info(`[purge] Vehicles: hard-deleted ${deleted.length} records, ${result.filesDeleted} files`);
  } catch (err: any) {
    const msg = `Failed to purge vehicles: ${err?.message ?? String(err)}`;
    result.errors.push(msg);
    logger.error(`[purge] ${msg}`);
  }
  return result;
}

/**
 * Purge soft-deleted employees: delete employee documents from DO Spaces,
 * then hard-delete employee rows.
 */
async function purgeEmployees(cutoff: Date): Promise<ModuleResult> {
  const result: ModuleResult = { module: "employees", hardDeleted: 0, filesDeleted: 0, errors: [] };
  try {
    const eligibleEmployees = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.isDeleted, true), lte(employees.deletedAt, cutoff)));

    if (eligibleEmployees.length === 0) return result;
    const employeeIds = eligibleEmployees.map((r) => r.id);

    // Collect file paths from employee_documents
    const docs = await db
      .select({ filePath: employeeDocuments.filePath })
      .from(employeeDocuments)
      .where(inArray(employeeDocuments.employeeId, employeeIds));

    result.filesDeleted = await purgeFilesFromSpaces(docs.map((r) => r.filePath));

    // Hard-delete child document rows
    await db.delete(employeeDocuments).where(inArray(employeeDocuments.employeeId, employeeIds));

    // Hard-delete main employee rows
    const deleted = await db.delete(employees).where(inArray(employees.id, employeeIds)).returning({ id: employees.id });
    result.hardDeleted = deleted.length;
    logger.info(`[purge] Employees: hard-deleted ${deleted.length} records, ${result.filesDeleted} files`);
  } catch (err: any) {
    const msg = `Failed to purge employees: ${err?.message ?? String(err)}`;
    result.errors.push(msg);
    logger.error(`[purge] ${msg}`);
  }
  return result;
}

/**
 * Purge soft-deleted expenses: delete expense receipt files from DO Spaces,
 * then hard-delete expense rows.
 */
async function purgeExpenses(cutoff: Date): Promise<ModuleResult> {
  const result: ModuleResult = { module: "expenses", hardDeleted: 0, filesDeleted: 0, errors: [] };
  try {
    const eligibleExpenses = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(eq(expenses.isDeleted, true), lte(expenses.deletedAt, cutoff)));

    if (eligibleExpenses.length === 0) return result;
    const expenseIds = eligibleExpenses.map((r) => r.id);

    // Collect file paths from expense_receipts
    const receipts = await db
      .select({ filePath: expenseReceipts.filePath })
      .from(expenseReceipts)
      .where(inArray(expenseReceipts.expenseId, expenseIds));

    result.filesDeleted = await purgeFilesFromSpaces(receipts.map((r) => r.filePath));

    // Hard-delete child receipt rows
    await db.delete(expenseReceipts).where(inArray(expenseReceipts.expenseId, expenseIds));

    // Hard-delete main expense rows
    const deleted = await db.delete(expenses).where(inArray(expenses.id, expenseIds)).returning({ id: expenses.id });
    result.hardDeleted = deleted.length;
    logger.info(`[purge] Expenses: hard-deleted ${deleted.length} records, ${result.filesDeleted} files`);
  } catch (err: any) {
    const msg = `Failed to purge expenses: ${err?.message ?? String(err)}`;
    result.errors.push(msg);
    logger.error(`[purge] ${msg}`);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main purge function — runs all module purges in parallel.
 * Call this from the cron route.
 *
 * Modules with associated file tables (bids, vehicles, employees, expenses)
 * have dedicated purge functions that clean up DO Spaces first.
 * All other modules use the generic hard-delete helpers.
 */
export const purgeDeletedMainRecords = async (): Promise<PurgeResult> => {
  const cutoff = getCutoffDate();
  logger.info(`[purge] Starting purge of records deleted before ${cutoff.toISOString()}`);

  const moduleResults: ModuleResult[] = await Promise.all([
    // Modules with file cleanup
    purgeBids(cutoff),
    purgeVehicles(cutoff),
    purgeEmployees(cutoff),
    purgeExpenses(cutoff),
    // Modules without direct file storage
    hardDeleteUuidRows(jobs, cutoff, "jobs"),
    hardDeleteUuidRows(dispatchTasks, cutoff, "dispatch_tasks"),
    hardDeleteIntRows(timesheets, cutoff, "timesheets"),
    hardDeleteUuidRows(invoices, cutoff, "invoices"),
    hardDeleteUuidRows(organizations, cutoff, "clients"),
    hardDeleteIntRows(departments, cutoff, "departments"),
    hardDeleteUuidRows(payrollRuns, cutoff, "payroll_runs"),
    hardDeleteUuidRows(employeeComplianceCases, cutoff, "compliance_cases"),
    hardDeleteUuidRows(inventoryItems, cutoff, "inventory_items"),
  ]);

  const totalHardDeleted = moduleResults.reduce((sum, m) => sum + m.hardDeleted, 0);
  const totalFilesDeleted = moduleResults.reduce((sum, m) => sum + m.filesDeleted, 0);
  const totalErrors = moduleResults.reduce((sum, m) => sum + m.errors.length, 0);

  logger.info(
    `[purge] Completed. Total hard-deleted: ${totalHardDeleted}, Files purged: ${totalFilesDeleted}, Errors: ${totalErrors}`,
  );

  return {
    gracePeriodDays: GRACE_PERIOD_DAYS,
    cutoffDate: cutoff.toISOString(),
    modules: moduleResults,
    totalHardDeleted,
    totalFilesDeleted,
    totalErrors,
  };
};
