/**
 * Purge Deleted Records Service
 *
 * Permanently hard-deletes records soft-deleted for more than GRACE_PERIOD_DAYS
 * across all entity tables. Runs in sequential stages to respect FK dependencies.
 *
 * Execution order (children before parents):
 *   Stage 1 — Dispatch tasks (before jobs, DB cascade removes assignments)
 *   Stage 2 — Jobs (DB cascade removes dispatch_tasks; SET NULL on vehicles, check-in/out, assignment_history)
 *   Stage 3 — Bids (DB cascade removes all bid sub-tables; must run after jobs)
 *   Stage 4 — Vehicles (DB cascade removes maintenance, repairs, inspections, fuel, check-in/out, media, docs, assignment_history)
 *   Stage 5 — Employees (DB SET NULL on timesheets, payroll, dispatch_assignments, compliance, expense_reports)
 *   Stage 6 — Expenses (DB cascade removes receipts)
 *   Stage 7 — Invoices (DB SET NULL on payments.invoiceId, credit_note_applications.invoiceId)
 *   Stage 8 — Inventory items (DB SET NULL on transactions.itemId; cascade on allocations, item_locations)
 *   Stage 9 — Clients/Orgs (last, after all dependents are removed)
 *   Stage 10 — Other leaf/independent tables (timesheets, departments, payroll_runs, compliance_cases, properties)
 *
 * Schedule recommendation: daily at 02:00 AM UTC.
 */

import { eq, and, lte, inArray } from "drizzle-orm";
import { db } from "../config/db.js";
import {
  bidsTable,
  bidDocuments,
  bidMedia,
  bidPlanSpecFiles,
  bidDesignBuildFiles,
} from "../drizzle/schema/bids.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { dispatchTasks } from "../drizzle/schema/dispatch.schema.js";
import { timesheets } from "../drizzle/schema/timesheet.schema.js";
import { expenses, expenseReceipts } from "../drizzle/schema/expenses.schema.js";
import { invoices } from "../drizzle/schema/invoicing.schema.js";
import { organizations, properties } from "../drizzle/schema/client.schema.js";
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

function getCutoffDate(): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - GRACE_PERIOD_DAYS);
  return cutoff;
}

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

    const deleted = await db.delete(table).where(inArray(table.id, ids)).returning({ id: table.id });
    result.hardDeleted = deleted.length;
    logger.info(`[purge] Hard-deleted ${deleted.length} ${moduleName} records`);
  } catch (err: any) {
    const msg = `Failed to purge ${moduleName}: ${err?.message ?? String(err)}`;
    result.errors.push(msg);
    logger.error(`[purge] ${msg}`);
  }
  return result;
}

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

    const deleted = await db.delete(table).where(inArray(table.id, ids)).returning({ id: table.id });
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
 * Stage 1: Purge dispatch tasks.
 * DB cascade (onDelete: "cascade") automatically removes dispatch_assignments.
 */
async function purgeDispatchTasks(cutoff: Date): Promise<ModuleResult> {
  return hardDeleteUuidRows(dispatchTasks, cutoff, "dispatch_tasks");
}

/**
 * Stage 2: Purge jobs.
 * - DB cascade removes dispatch_tasks (and their assignments via cascade chain).
 * - DB SET NULL clears vehicles.currentJobId, checkInOutRecords.jobId, assignmentHistory.jobId.
 * Must run AFTER dispatch_tasks purge to avoid double-processing.
 */
async function purgeJobs(cutoff: Date): Promise<ModuleResult> {
  return hardDeleteUuidRows(jobs, cutoff, "jobs");
}

/**
 * Stage 3: Purge bids.
 * - DB cascade removes ALL bid child tables (bidFinancialBreakdown, bidMaterials,
 *   bidLabor, bidTravel, bidOperatingExpenses, bidPlanSpecData, bidSurveyData,
 *   bidDesignBuildData, bidTimeline, bidNotes, bidDocuments, bidMedia,
 *   bidPlanSpecFiles, bidDesignBuildFiles, bidDocumentTags, bidDocumentTagLinks,
 *   bidHistory, bidTravel).
 * - We collect file paths first for DO Spaces cleanup, then delete bids.
 * Must run AFTER jobs purge (jobs.bidId references bids).
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

    // Collect all file paths from child file tables before cascade removes them
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
    result.filesDeleted = await purgeFilesFromSpaces(allPaths);

    // Hard-delete bids — DB cascade handles all child tables automatically
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
 * Stage 4: Purge vehicles.
 * - Collect vehicle document file paths for DO Spaces cleanup.
 * - DB cascade (onDelete: "cascade") removes maintenance, repairs, inspections,
 *   inspection_items, fuel_records, check_in_out_records, vehicle_media,
 *   vehicle_documents, assignment_history automatically.
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

    // Collect file paths before cascade removes them
    const docs = await db
      .select({ filePath: vehicleDocuments.filePath })
      .from(vehicleDocuments)
      .where(inArray(vehicleDocuments.vehicleId, vehicleIds));

    result.filesDeleted = await purgeFilesFromSpaces(docs.map((r) => r.filePath));

    // Hard-delete vehicles — DB cascade handles all child tables
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
 * Stage 5: Purge employees.
 * - Collect employee document file paths for DO Spaces cleanup.
 * - DB SET NULL clears timesheets.employeeId, payroll_entries.employeeId,
 *   dispatch_assignments.technicianId, expense_reports.employeeId,
 *   compliance records, and fleet assignment/maintenance FKs.
 * - DB cascade removes employee_documents.
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

    // Collect file paths before cascade removes them
    const docs = await db
      .select({ filePath: employeeDocuments.filePath })
      .from(employeeDocuments)
      .where(inArray(employeeDocuments.employeeId, employeeIds));

    result.filesDeleted = await purgeFilesFromSpaces(docs.map((r) => r.filePath));

    // Hard-delete employees — DB SET NULL and CASCADE handle dependents
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
 * Stage 6: Purge expenses.
 * - Collect receipt file paths for DO Spaces cleanup.
 * - DB cascade removes expense_receipts automatically.
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

    const receipts = await db
      .select({ filePath: expenseReceipts.filePath })
      .from(expenseReceipts)
      .where(inArray(expenseReceipts.expenseId, expenseIds));

    result.filesDeleted = await purgeFilesFromSpaces(receipts.map((r) => r.filePath));

    // Hard-delete expenses — DB cascade removes receipts
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

/**
 * Stage 7: Purge invoices.
 * - DB cascade removes invoice_line_items and invoice_documents.
 * - DB SET NULL clears payments.invoiceId and credit_note_applications.invoiceId
 *   (preserves financial records but clears the invoice link).
 */
async function purgeInvoices(cutoff: Date): Promise<ModuleResult> {
  const result: ModuleResult = { module: "invoices", hardDeleted: 0, filesDeleted: 0, errors: [] };
  try {
    const eligibleInvoices = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.isDeleted, true), lte(invoices.deletedAt, cutoff)));

    if (eligibleInvoices.length === 0) return result;
    const invoiceIds = eligibleInvoices.map((r) => r.id);

    // Hard-delete invoices — DB cascade removes line_items and documents;
    // DB SET NULL clears payments.invoiceId and credit_note_applications.invoiceId
    const deleted = await db.delete(invoices).where(inArray(invoices.id, invoiceIds)).returning({ id: invoices.id });
    result.hardDeleted = deleted.length;
    logger.info(`[purge] Invoices: hard-deleted ${deleted.length} records`);
  } catch (err: any) {
    const msg = `Failed to purge invoices: ${err?.message ?? String(err)}`;
    result.errors.push(msg);
    logger.error(`[purge] ${msg}`);
  }
  return result;
}

/**
 * Stage 8: Purge inventory items.
 * - DB cascade removes inventory_allocations and inventory_item_locations.
 * - DB SET NULL clears inventory_transactions.itemId (preserves audit trail).
 */
async function purgeInventoryItems(cutoff: Date): Promise<ModuleResult> {
  return hardDeleteUuidRows(inventoryItems, cutoff, "inventory_items");
}

/**
 * Stage 9: Purge clients (organizations).
 * Must run AFTER bids (bids.organizationId → organizations.id).
 * DB SET NULL or CASCADE handles remaining child references.
 */
async function purgeClients(cutoff: Date): Promise<ModuleResult> {
  return hardDeleteUuidRows(organizations, cutoff, "clients");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main purge function — runs stages sequentially to respect FK dependencies.
 * Call this from the cron route.
 */
export const purgeDeletedMainRecords = async (): Promise<PurgeResult> => {
  const cutoff = getCutoffDate();
  logger.info(`[purge] Starting purge of records deleted before ${cutoff.toISOString()}`);

  const moduleResults: ModuleResult[] = [];

  // Stage 1: Leaf dispatch tasks (assignments cascade automatically)
  moduleResults.push(await purgeDispatchTasks(cutoff));

  // Stage 2: Jobs (dispatch_tasks cascade, FK pointers set null on vehicles)
  moduleResults.push(await purgeJobs(cutoff));

  // Stage 3: Bids (all sub-tables cascade; must be after jobs)
  moduleResults.push(await purgeBids(cutoff));

  // Stage 4: Vehicles (all child tables cascade)
  moduleResults.push(await purgeVehicles(cutoff));

  // Stage 5: Employees (financial history preserved via set null; documents cascade)
  moduleResults.push(await purgeEmployees(cutoff));

  // Stage 6: Expenses (receipts cascade)
  moduleResults.push(await purgeExpenses(cutoff));

  // Stage 7: Invoices (line items + docs cascade; payments/credit notes set null)
  moduleResults.push(await purgeInvoices(cutoff));

  // Stage 8: Inventory items (allocations + item_locations cascade; transactions set null)
  moduleResults.push(await purgeInventoryItems(cutoff));

  // Stage 9: Clients/Orgs (last parent; all dependents already gone)
  moduleResults.push(await purgeClients(cutoff));

  // Stage 10: Independent tables (run in parallel — no cross-dependencies)
  const independentResults = await Promise.all([
    hardDeleteIntRows(timesheets, cutoff, "timesheets"),
    hardDeleteIntRows(departments, cutoff, "departments"),
    hardDeleteUuidRows(payrollRuns, cutoff, "payroll_runs"),
    hardDeleteUuidRows(employeeComplianceCases, cutoff, "compliance_cases"),
    hardDeleteUuidRows(properties, cutoff, "properties"),
  ]);
  moduleResults.push(...independentResults);

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
