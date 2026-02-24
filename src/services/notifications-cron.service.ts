/**
 * Scheduled / Cron Notification Service
 *
 * All time-based notification checks that are triggered by cron endpoints.
 * Each exported function returns a summary { processed, errors } that the
 * cron route handler forwards to the caller.
 *
 * Rules:
 * - Max BATCH_SIZE records processed per cron run (oldest/most-urgent first).
 *   Remaining records are picked up on the next scheduled run.
 * - Failures are logged and counted — never retried.
 */

import { db } from "../config/db.js";
import {
  eq,
  and,
  not,
  inArray,
  lte,
  gte,
  isNull,
  sql,
  lt,
  asc,
} from "drizzle-orm";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";
import { organizations } from "../drizzle/schema/client.schema.js";
import { invoices } from "../drizzle/schema/invoicing.schema.js";
import { timesheets } from "../drizzle/schema/timesheet.schema.js";
import { vehicles } from "../drizzle/schema/fleet.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";
import { inventoryPurchaseOrders } from "../drizzle/schema/inventory.schema.js";
import { NotificationService } from "./notification.service.js";
import { logger } from "../utils/logger.js";

const svc = new NotificationService();

/** Maximum records to process per cron run. Remaining are left for the next run. */
const BATCH_SIZE = 5;

type CronResult = { processed: number; errors: number };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0]!;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0]!;
}

// ---------------------------------------------------------------------------
// 1. JOB OVERDUE
// ---------------------------------------------------------------------------

/**
 * Notify manager, technician, executive when a job's scheduled end date has
 * passed and it is still not completed or cancelled.
 * Processes at most BATCH_SIZE jobs per run (most overdue first).
 * Recommended schedule: daily at 08:00.
 */
export async function notifyJobOverdue(): Promise<CronResult> {
  let processed = 0;
  let errors = 0;

  try {
    const today = todayStr();

    const overdueJobs = await db
      .select({
        id: jobs.id,
        jobNumber: jobs.jobNumber,
        scheduledEndDate: jobs.scheduledEndDate,
        projectName: bidsTable.projectName,
        clientName: organizations.name,
      })
      .from(jobs)
      .innerJoin(bidsTable, and(eq(jobs.bidId, bidsTable.id), eq(bidsTable.isDeleted, false)))
      .leftJoin(organizations, eq(bidsTable.organizationId, organizations.id))
      .where(
        and(
          eq(jobs.isDeleted, false),
          not(inArray(jobs.status, ["completed", "cancelled"])),
          lt(jobs.scheduledEndDate, today),
        ),
      )
      .orderBy(asc(jobs.scheduledEndDate))
      .limit(BATCH_SIZE);

    for (const job of overdueJobs) {
      try {
        const dueDate = job.scheduledEndDate ? new Date(job.scheduledEndDate) : null;
        const today2 = new Date();
        const daysOverdue = dueDate
          ? Math.floor((today2.getTime() - dueDate.getTime()) / 86400000)
          : undefined;

        await svc.triggerNotification({
          type: "job_overdue",
          category: "job",
          priority: "high",
          data: {
            entityType: "Job",
            entityId: job.id,
            entityName: job.projectName || job.jobNumber,
            ...(job.clientName ? { clientName: job.clientName } : {}),
            ...(job.scheduledEndDate ? { dueDate: job.scheduledEndDate } : {}),
            ...(daysOverdue !== undefined ? { daysOverdue } : {}),
          },
        });
        processed++;
      } catch (err) {
        logger.error(`[CronNotif] job_overdue failed for job ${job.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    logger.error("[CronNotif] notifyJobOverdue query failed:", err);
    errors++;
  }

  return { processed, errors };
}

// ---------------------------------------------------------------------------
// 2. INVOICE DUE TOMORROW
// ---------------------------------------------------------------------------

/**
 * Notify client (primary contact), project manager, and executive when an
 * invoice is due tomorrow.
 * Processes at most BATCH_SIZE invoices per run.
 * Recommended schedule: daily at 09:00.
 */
export async function notifyInvoiceDueTomorrow(): Promise<CronResult> {
  let processed = 0;
  let errors = 0;

  try {
    const tomorrow = daysFromNow(1);

    const dueInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        dueDate: invoices.dueDate,
        totalAmount: invoices.totalAmount,
        organizationId: invoices.organizationId,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.isDeleted, false),
          not(inArray(invoices.status, ["paid", "cancelled", "void", "draft"])),
          eq(invoices.dueDate, tomorrow),
        ),
      )
      .orderBy(asc(invoices.dueDate))
      .limit(BATCH_SIZE);

    for (const inv of dueInvoices) {
      try {
        await svc.triggerNotification({
          type: "invoice_due_tomorrow",
          category: "financial",
          priority: "high",
          data: {
            entityType: "Invoice",
            entityId: inv.id,
            entityName: inv.invoiceNumber,
            ...(inv.totalAmount ? { amount: Number(inv.totalAmount) } : {}),
            ...(inv.dueDate ? { dueDate: inv.dueDate } : {}),
            ...(inv.organizationId ? { clientId: inv.organizationId } : {}),
          },
        });
        processed++;
      } catch (err) {
        logger.error(`[CronNotif] invoice_due_tomorrow failed for invoice ${inv.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    logger.error("[CronNotif] notifyInvoiceDueTomorrow query failed:", err);
    errors++;
  }

  return { processed, errors };
}

// ---------------------------------------------------------------------------
// 3 – 5. INVOICE OVERDUE (1, 7, 30 DAYS)
// ---------------------------------------------------------------------------

async function notifyInvoiceOverdueDays(
  daysOverdue: 1 | 7 | 30,
): Promise<CronResult> {
  let processed = 0;
  let errors = 0;

  const eventTypeMap = {
    1: "invoice_overdue_1day",
    7: "invoice_overdue_7days",
    30: "invoice_overdue_30days",
  } as const;

  try {
    const exactDate = daysAgo(daysOverdue);

    const overdueInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        dueDate: invoices.dueDate,
        totalAmount: invoices.totalAmount,
        organizationId: invoices.organizationId,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.isDeleted, false),
          not(inArray(invoices.status, ["paid", "cancelled", "void", "draft"])),
          eq(invoices.dueDate, exactDate),
        ),
      )
      .orderBy(asc(invoices.dueDate))
      .limit(BATCH_SIZE);

    for (const inv of overdueInvoices) {
      try {
        await svc.triggerNotification({
          type: eventTypeMap[daysOverdue],
          category: "financial",
          priority: "high",
          data: {
            entityType: "Invoice",
            entityId: inv.id,
            entityName: inv.invoiceNumber,
            ...(inv.totalAmount ? { amount: Number(inv.totalAmount) } : {}),
            ...(inv.dueDate ? { dueDate: inv.dueDate } : {}),
            daysOverdue,
            ...(inv.organizationId ? { clientId: inv.organizationId } : {}),
          },
        });
        processed++;
      } catch (err) {
        logger.error(`[CronNotif] ${eventTypeMap[daysOverdue]} failed for ${inv.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    logger.error(`[CronNotif] notifyInvoiceOverdueDays(${daysOverdue}) query failed:`, err);
    errors++;
  }

  return { processed, errors };
}

export const notifyInvoiceOverdue1Day = () => notifyInvoiceOverdueDays(1);
export const notifyInvoiceOverdue7Days = () => notifyInvoiceOverdueDays(7);
export const notifyInvoiceOverdue30Days = () => notifyInvoiceOverdueDays(30);

// ---------------------------------------------------------------------------
// 6. CLOCK IN/OUT REMINDER
// ---------------------------------------------------------------------------

/**
 * Remind employees who have clocked in today but have not yet clocked out
 * (clockOut is null) after a configurable cutoff hour (default: 18:00).
 * Also runs a morning check for employees with NO timesheet for today at all
 * (clockType = "in").
 * Processes at most BATCH_SIZE employees per run.
 * Recommended schedule: twice daily — morning (09:30) for missing clock-in,
 * evening (18:30) for missing clock-out.
 */
export async function notifyClockReminder(clockType: "in" | "out" = "out"): Promise<CronResult> {
  let processed = 0;
  let errors = 0;

  try {
    const today = todayStr();

    if (clockType === "out") {
      // Find employees who clocked IN today but have no clockOut yet
      const openShifts = await db
        .select({
          employeeId: timesheets.employeeId,
          sheetDate: timesheets.sheetDate,
        })
        .from(timesheets)
        .where(
          and(
            eq(timesheets.isDeleted, false),
            eq(timesheets.sheetDate, today),
            isNull(timesheets.clockOut),
          ),
        )
        .limit(BATCH_SIZE);

      for (const ts of openShifts) {
        if (!ts.employeeId) continue;
        try {
          await svc.triggerNotification({
            type: "clock_reminder",
            category: "timesheet",
            priority: "medium",
            data: {
              employeeId: String(ts.employeeId),
              entityType: "Employee",
              entityId: String(ts.employeeId),
              entityName: String(ts.employeeId),
              clockType: "out",
            },
          });
          processed++;
        } catch (err) {
          logger.error(`[CronNotif] clock_reminder(out) failed for employee ${ts.employeeId}:`, err);
          errors++;
        }
      }
    } else {
      // Find active employees with NO timesheet for today — limit to BATCH_SIZE
      const allActiveEmployees = await db
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            isNull(employees.terminationDate),
            not(inArray(employees.status as any, ["terminated", "suspended"])),
          ),
        );

      const todaySheets = await db
        .select({ employeeId: timesheets.employeeId })
        .from(timesheets)
        .where(and(eq(timesheets.sheetDate, today), eq(timesheets.isDeleted, false)));

      const clockedInIds = new Set(todaySheets.map((r) => r.employeeId).filter(Boolean));

      const unclockedIn = allActiveEmployees
        .filter((emp) => !clockedInIds.has(emp.id))
        .slice(0, BATCH_SIZE);

      for (const emp of unclockedIn) {
        try {
          await svc.triggerNotification({
            type: "clock_reminder",
            category: "timesheet",
            priority: "medium",
            data: {
              employeeId: String(emp.id),
              entityType: "Employee",
              entityId: String(emp.id),
              entityName: String(emp.id),
              clockType: "in",
            },
          });
          processed++;
        } catch (err) {
          logger.error(`[CronNotif] clock_reminder(in) failed for employee ${emp.id}:`, err);
          errors++;
        }
      }
    }
  } catch (err) {
    logger.error("[CronNotif] notifyClockReminder query failed:", err);
    errors++;
  }

  return { processed, errors };
}

// ---------------------------------------------------------------------------
// 7 – 9. VEHICLE MAINTENANCE REMINDERS
// ---------------------------------------------------------------------------

/**
 * Notify driver + manager when vehicle maintenance is due in 7 days (Push only).
 */
export async function notifyMaintenanceDue7Days(): Promise<CronResult> {
  return _notifyMaintenanceDue("maintenance_due_7days", 7);
}

/**
 * Notify driver + manager when vehicle maintenance is due in 3 days (Email + SMS + Push).
 */
export async function notifyMaintenanceDue3Days(): Promise<CronResult> {
  return _notifyMaintenanceDue("maintenance_due_3days", 3);
}

async function _notifyMaintenanceDue(
  eventType: "maintenance_due_7days" | "maintenance_due_3days",
  days: number,
): Promise<CronResult> {
  let processed = 0;
  let errors = 0;

  try {
    const targetDate = daysFromNow(days);

    const dueVehicles = await db
      .select({
        id: vehicles.id,
        vehicleId: vehicles.vehicleId,
        make: vehicles.make,
        model: vehicles.model,
        licensePlate: vehicles.licensePlate,
        assignedToEmployeeId: vehicles.assignedToEmployeeId,
        nextServiceDue: vehicles.nextServiceDue,
      })
      .from(vehicles)
      .where(
        and(
          eq(vehicles.isDeleted, false),
          eq(vehicles.nextServiceDue, targetDate),
        ),
      )
      .orderBy(asc(vehicles.nextServiceDue))
      .limit(BATCH_SIZE);

    for (const v of dueVehicles) {
      try {
        await svc.triggerNotification({
          type: eventType,
          category: "fleet",
          priority: days === 3 ? "high" : "medium",
          data: {
            entityType: "Vehicle",
            entityId: v.id,
            entityName: `${v.make} ${v.model} (${v.vehicleId})`,
            licensePlate: v.licensePlate,
            ...(v.nextServiceDue ? { dueDate: v.nextServiceDue } : {}),
            ...(v.assignedToEmployeeId != null ? { driverId: String(v.assignedToEmployeeId) } : {}),
          },
        });
        processed++;
      } catch (err) {
        logger.error(`[CronNotif] ${eventType} failed for vehicle ${v.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    logger.error(`[CronNotif] _notifyMaintenanceDue(${days}) query failed:`, err);
    errors++;
  }

  return { processed, errors };
}

/**
 * Notify driver, manager, executive when vehicle maintenance is overdue.
 * Processes at most BATCH_SIZE vehicles per run (most overdue first).
 * Recommended schedule: daily.
 */
export async function notifyMaintenanceOverdue(): Promise<CronResult> {
  let processed = 0;
  let errors = 0;

  try {
    const today = todayStr();

    const overdueVehicles = await db
      .select({
        id: vehicles.id,
        vehicleId: vehicles.vehicleId,
        make: vehicles.make,
        model: vehicles.model,
        licensePlate: vehicles.licensePlate,
        assignedToEmployeeId: vehicles.assignedToEmployeeId,
        nextServiceDue: vehicles.nextServiceDue,
      })
      .from(vehicles)
      .where(
        and(
          eq(vehicles.isDeleted, false),
          lt(vehicles.nextServiceDue, today),
        ),
      )
      .orderBy(asc(vehicles.nextServiceDue))
      .limit(BATCH_SIZE);

    for (const v of overdueVehicles) {
      try {
        await svc.triggerNotification({
          type: "maintenance_overdue",
          category: "fleet",
          priority: "high",
          data: {
            entityType: "Vehicle",
            entityId: v.id,
            entityName: `${v.make} ${v.model} (${v.vehicleId})`,
            licensePlate: v.licensePlate,
            ...(v.nextServiceDue ? { dueDate: v.nextServiceDue } : {}),
            ...(v.assignedToEmployeeId != null ? { driverId: String(v.assignedToEmployeeId) } : {}),
          },
        });
        processed++;
      } catch (err) {
        logger.error(`[CronNotif] maintenance_overdue failed for vehicle ${v.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    logger.error("[CronNotif] notifyMaintenanceOverdue query failed:", err);
    errors++;
  }

  return { processed, errors };
}

// ---------------------------------------------------------------------------
// 10. SAFETY INSPECTION EXPIRED
// ---------------------------------------------------------------------------

/**
 * Notify manager + executive when a vehicle's nextInspectionDue date has passed.
 * Processes at most BATCH_SIZE vehicles per run (most overdue first).
 * Recommended schedule: daily.
 */
export async function notifySafetyInspectionExpired(): Promise<CronResult> {
  let processed = 0;
  let errors = 0;

  try {
    const today = todayStr();

    const expiredVehicles = await db
      .select({
        id: vehicles.id,
        vehicleId: vehicles.vehicleId,
        make: vehicles.make,
        model: vehicles.model,
        licensePlate: vehicles.licensePlate,
        nextInspectionDue: vehicles.nextInspectionDue,
        assignedToEmployeeId: vehicles.assignedToEmployeeId,
      })
      .from(vehicles)
      .where(
        and(
          eq(vehicles.isDeleted, false),
          lt(vehicles.nextInspectionDue, today),
        ),
      )
      .orderBy(asc(vehicles.nextInspectionDue))
      .limit(BATCH_SIZE);

    for (const v of expiredVehicles) {
      try {
        await svc.triggerNotification({
          type: "safety_inspection_expired",
          category: "fleet",
          priority: "high",
          data: {
            entityType: "Vehicle",
            entityId: v.id,
            entityName: `${v.make} ${v.model} (${v.vehicleId})`,
            licensePlate: v.licensePlate,
            ...(v.nextInspectionDue ? { dueDate: v.nextInspectionDue } : {}),
            ...(v.assignedToEmployeeId != null ? { driverId: String(v.assignedToEmployeeId) } : {}),
          },
        });
        processed++;
      } catch (err) {
        logger.error(`[CronNotif] safety_inspection_expired failed for vehicle ${v.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    logger.error("[CronNotif] notifySafetyInspectionExpired query failed:", err);
    errors++;
  }

  return { processed, errors };
}

// ---------------------------------------------------------------------------
// 11. VEHICLE REGISTRATION EXPIRING
// ---------------------------------------------------------------------------

/**
 * Notify manager + executive when vehicle registration expires within 30 days.
 * Processes at most BATCH_SIZE vehicles per run (soonest expiry first).
 * Recommended schedule: daily.
 */
export async function notifyVehicleRegistrationExpiring(): Promise<CronResult> {
  let processed = 0;
  let errors = 0;

  try {
    const today = todayStr();
    const in30 = daysFromNow(30);

    const expiringVehicles = await db
      .select({
        id: vehicles.id,
        vehicleId: vehicles.vehicleId,
        make: vehicles.make,
        model: vehicles.model,
        licensePlate: vehicles.licensePlate,
        registrationExpiration: vehicles.registrationExpiration,
        assignedToEmployeeId: vehicles.assignedToEmployeeId,
      })
      .from(vehicles)
      .where(
        and(
          eq(vehicles.isDeleted, false),
          gte(vehicles.registrationExpiration, today),
          lte(vehicles.registrationExpiration, in30),
        ),
      )
      .orderBy(asc(vehicles.registrationExpiration))
      .limit(BATCH_SIZE);

    for (const v of expiringVehicles) {
      try {
        await svc.triggerNotification({
          type: "vehicle_registration_expiring",
          category: "fleet",
          priority: "high",
          data: {
            entityType: "Vehicle",
            entityId: v.id,
            entityName: `${v.make} ${v.model} (${v.vehicleId})`,
            licensePlate: v.licensePlate,
            ...(v.registrationExpiration ? { dueDate: v.registrationExpiration } : {}),
            ...(v.assignedToEmployeeId != null ? { driverId: String(v.assignedToEmployeeId) } : {}),
          },
        });
        processed++;
      } catch (err) {
        logger.error(`[CronNotif] vehicle_registration_expiring failed for vehicle ${v.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    logger.error("[CronNotif] notifyVehicleRegistrationExpiring query failed:", err);
    errors++;
  }

  return { processed, errors };
}

// ---------------------------------------------------------------------------
// 12. VEHICLE INSURANCE EXPIRING
// ---------------------------------------------------------------------------

/**
 * Notify manager + executive when vehicle insurance expires within 30 days.
 * Processes at most BATCH_SIZE vehicles per run (soonest expiry first).
 * Recommended schedule: daily.
 */
export async function notifyVehicleInsuranceExpiring(): Promise<CronResult> {
  let processed = 0;
  let errors = 0;

  try {
    const today = todayStr();
    const in30 = daysFromNow(30);

    const expiringVehicles = await db
      .select({
        id: vehicles.id,
        vehicleId: vehicles.vehicleId,
        make: vehicles.make,
        model: vehicles.model,
        licensePlate: vehicles.licensePlate,
        insuranceExpiration: vehicles.insuranceExpiration,
        assignedToEmployeeId: vehicles.assignedToEmployeeId,
      })
      .from(vehicles)
      .where(
        and(
          eq(vehicles.isDeleted, false),
          gte(vehicles.insuranceExpiration, today),
          lte(vehicles.insuranceExpiration, in30),
        ),
      )
      .orderBy(asc(vehicles.insuranceExpiration))
      .limit(BATCH_SIZE);

    for (const v of expiringVehicles) {
      try {
        await svc.triggerNotification({
          type: "vehicle_insurance_expiring",
          category: "fleet",
          priority: "high",
          data: {
            entityType: "Vehicle",
            entityId: v.id,
            entityName: `${v.make} ${v.model} (${v.vehicleId})`,
            licensePlate: v.licensePlate,
            ...(v.insuranceExpiration ? { dueDate: v.insuranceExpiration } : {}),
            ...(v.assignedToEmployeeId != null ? { driverId: String(v.assignedToEmployeeId) } : {}),
          },
        });
        processed++;
      } catch (err) {
        logger.error(`[CronNotif] vehicle_insurance_expiring failed for vehicle ${v.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    logger.error("[CronNotif] notifyVehicleInsuranceExpiring query failed:", err);
    errors++;
  }

  return { processed, errors };
}

// ---------------------------------------------------------------------------
// 13. PERFORMANCE REVIEW DUE
// ---------------------------------------------------------------------------

/**
 * Notify manager when an employee's performance review is due within 7 days.
 * Processes at most BATCH_SIZE employees per run.
 * Recommended schedule: daily.
 */
export async function notifyPerformanceReviewDue(): Promise<CronResult> {
  let processed = 0;
  let errors = 0;

  try {
    const today = todayStr();
    const in7 = daysFromNow(7);

    const dueEmployees = await db
      .select({
        id: employees.id,
        userId: employees.userId,
        employeeId: employees.employeeId,
      })
      .from(employees)
      .where(
        and(
          isNull(employees.terminationDate),
          gte(sql`COALESCE((employees.next_review_date)::text, '9999-01-01')`, today),
          lte(sql`COALESCE((employees.next_review_date)::text, '9999-01-01')`, in7),
        ),
      )
      .limit(BATCH_SIZE);

    for (const emp of dueEmployees) {
      try {
        await svc.triggerNotification({
          type: "performance_review_due",
          category: "system",
          priority: "medium",
          data: {
            employeeId: String(emp.id),
            entityType: "Employee",
            entityId: String(emp.id),
            entityName: emp.employeeId || String(emp.id),
          },
        });
        processed++;
      } catch (err) {
        logger.error(`[CronNotif] performance_review_due failed for employee ${emp.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    // Silently handle if column doesn't exist
    logger.warn("[CronNotif] notifyPerformanceReviewDue skipped (column may not exist):", (err as any)?.message);
  }

  return { processed, errors };
}

// ---------------------------------------------------------------------------
// 14. SAFETY INSPECTION UPCOMING (within 30 days)
// ---------------------------------------------------------------------------

/**
 * Notify manager + executive when a vehicle's safety inspection is due within
 * the next 30 days (soonest due first).
 * Processes at most BATCH_SIZE vehicles per run.
 * Recommended schedule: daily (e.g. 07:06).
 */
export async function notifySafetyInspectionUpcoming(): Promise<CronResult> {
  let processed = 0;
  let errors = 0;

  try {
    const today = todayStr();
    const in30 = daysFromNow(30);

    const upcomingVehicles = await db
      .select({
        id: vehicles.id,
        vehicleId: vehicles.vehicleId,
        make: vehicles.make,
        model: vehicles.model,
        licensePlate: vehicles.licensePlate,
        nextInspectionDue: vehicles.nextInspectionDue,
        assignedToEmployeeId: vehicles.assignedToEmployeeId,
      })
      .from(vehicles)
      .where(
        and(
          eq(vehicles.isDeleted, false),
          gte(vehicles.nextInspectionDue, today),
          lte(vehicles.nextInspectionDue, in30),
        ),
      )
      .orderBy(asc(vehicles.nextInspectionDue))
      .limit(BATCH_SIZE);

    for (const v of upcomingVehicles) {
      try {
        await svc.triggerNotification({
          type: "safety_inspection_required",
          category: "fleet",
          priority: "high",
          data: {
            entityType: "Vehicle",
            entityId: v.id,
            entityName: `${v.make} ${v.model} (${v.vehicleId})`,
            licensePlate: v.licensePlate,
            ...(v.nextInspectionDue ? { dueDate: v.nextInspectionDue } : {}),
            ...(v.assignedToEmployeeId != null ? { driverId: String(v.assignedToEmployeeId) } : {}),
          },
        });
        processed++;
      } catch (err) {
        logger.error(`[CronNotif] safety_inspection_required failed for vehicle ${v.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    logger.error("[CronNotif] notifySafetyInspectionUpcoming query failed:", err);
    errors++;
  }

  return { processed, errors };
}

// ---------------------------------------------------------------------------
// 15. PURCHASE ORDER DELAYED
// ---------------------------------------------------------------------------

/**
 * Notify manager + executive when a purchase order's expected delivery date
 * has passed and it has not yet been fully received or cancelled.
 * Processes at most BATCH_SIZE orders per run (most delayed first).
 * Recommended schedule: daily (e.g. 07:30).
 */
export async function notifyPurchaseOrderDelayed(): Promise<CronResult> {
  let processed = 0;
  let errors = 0;

  try {
    const today = todayStr();

    const delayedOrders = await db
      .select({
        id: inventoryPurchaseOrders.id,
        poNumber: inventoryPurchaseOrders.poNumber,
        title: inventoryPurchaseOrders.title,
        expectedDeliveryDate: inventoryPurchaseOrders.expectedDeliveryDate,
        supplierId: inventoryPurchaseOrders.supplierId,
        totalAmount: inventoryPurchaseOrders.totalAmount,
      })
      .from(inventoryPurchaseOrders)
      .where(
        and(
          eq(inventoryPurchaseOrders.isDeleted, false),
          inArray(inventoryPurchaseOrders.status, ["sent", "partially_received"]),
          isNull(inventoryPurchaseOrders.actualDeliveryDate),
          lt(inventoryPurchaseOrders.expectedDeliveryDate, today),
        ),
      )
      .orderBy(asc(inventoryPurchaseOrders.expectedDeliveryDate))
      .limit(BATCH_SIZE);

    for (const po of delayedOrders) {
      try {
        const expectedDate = po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate) : null;
        const now = new Date();
        const daysDelayed = expectedDate
          ? Math.floor((now.getTime() - expectedDate.getTime()) / 86400000)
          : undefined;

        await svc.triggerNotification({
          type: "purchase_order_delayed",
          category: "inventory",
          priority: "medium",
          data: {
            entityType: "Purchase Order",
            entityId: po.id,
            entityName: po.title || po.poNumber,
            ...(po.expectedDeliveryDate ? { dueDate: po.expectedDeliveryDate } : {}),
            ...(daysDelayed !== undefined ? { daysOverdue: daysDelayed } : {}),
            ...(po.totalAmount ? { amount: Number(po.totalAmount) } : {}),
          },
        });
        processed++;
      } catch (err) {
        logger.error(`[CronNotif] purchase_order_delayed failed for PO ${po.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    logger.error("[CronNotif] notifyPurchaseOrderDelayed query failed:", err);
    errors++;
  }

  return { processed, errors };
}
