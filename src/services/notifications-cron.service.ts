/**
 * Scheduled / Cron Notification Service
 *
 * All time-based notification checks that are triggered by cron endpoints.
 * Each exported function returns a summary { processed, errors } (logged when
 * cron jobs run in the background from cron routes).
 *
 * Rules:
 * - Max BATCH_SIZE records processed per cron run (oldest/most-urgent first) for
 *   most jobs. Remaining records are picked up on the next scheduled run.
 * - Clock in/out reminders: no row cap; deliveries run in concurrency windows
 *   (see CLOCK_REMINDER_CONCURRENCY) to limit SMTP/SMS load.
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
  gt,
  isNull,
  sql,
  lt,
  asc,
  or,
} from "drizzle-orm";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";
import { organizations } from "../drizzle/schema/client.schema.js";
import { invoices } from "../drizzle/schema/invoicing.schema.js";
import { timesheets } from "../drizzle/schema/timesheet.schema.js";
import { vehicles } from "../drizzle/schema/fleet.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";
import { inventoryPurchaseOrders } from "../drizzle/schema/inventory.schema.js";
import { notificationCooldowns } from "../drizzle/schema/notifications.schema.js";
import { users, userRoles, roles } from "../drizzle/schema/auth.schema.js";
import { NotificationService } from "./notification.service.js";
import { NotificationEmailService } from "./notification-email.service.js";
import { logger } from "../utils/logger.js";

const svc = new NotificationService();
const digestEmailSvc = new NotificationEmailService();

/** Maximum records to process per cron run (for per-record functions). */
const BATCH_SIZE = 5;
/** Parallel clock_reminder triggerNotification calls per window (SMTP / provider safety). */
const CLOCK_REMINDER_CONCURRENCY = 5;
/** Maximum rows rendered in a single digest email. */
const DIGEST_LIMIT = 50;

type CronResult = { processed: number; errors: number };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run async work for each item in fixed-size concurrent windows (sequential windows,
 * parallel within a window). Aggregates processed/errors; logs per-item failures.
 */
async function runInConcurrencyWindows<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<unknown>,
  logFailure: (item: T, err: unknown) => void,
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  for (let i = 0; i < items.length; i += concurrency) {
    const window = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(window.map((item) => worker(item)));
    for (let j = 0; j < settled.length; j++) {
      const r = settled[j]!;
      if (r.status === "fulfilled") processed++;
      else {
        errors++;
        logFailure(window[j]!, r.reason);
      }
    }
  }
  return { processed, errors };
}

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
// Cooldown helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if a notification for this (eventType, entityType, entityId)
 * was already sent and the cooldown window has not expired yet.
 */
async function isCoolingDown(
  eventType: string,
  entityType: string,
  entityId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ nextAllowedAt: notificationCooldowns.nextAllowedAt })
    .from(notificationCooldowns)
    .where(
      and(
        eq(notificationCooldowns.eventType, eventType),
        eq(notificationCooldowns.entityType, entityType),
        eq(notificationCooldowns.entityId, entityId),
      ),
    )
    .limit(1);

  if (!row) return false;
  return row.nextAllowedAt > new Date();
}

/** Entity IDs still in cooldown (one query instead of N per-row checks). */
async function getCoolingDownEntityIdSet(
  eventType: string,
  entityType: string,
  entityIds: string[],
  at: Date = new Date(),
): Promise<Set<string>> {
  if (entityIds.length === 0) return new Set();
  const rows = await db
    .select({ entityId: notificationCooldowns.entityId })
    .from(notificationCooldowns)
    .where(
      and(
        eq(notificationCooldowns.eventType, eventType),
        eq(notificationCooldowns.entityType, entityType),
        inArray(notificationCooldowns.entityId, entityIds),
        gt(notificationCooldowns.nextAllowedAt, at),
      ),
    );
  return new Set(rows.map((r) => r.entityId));
}

/**
 * Records that a notification was just sent and sets the next allowed time.
 * Uses upsert so repeated calls simply extend the cooldown window.
 */
async function setCooldown(
  eventType: string,
  entityType: string,
  entityId: string,
  cooldownDays: number,
): Promise<void> {
  const now = new Date();
  const nextAllowedAt = new Date(now.getTime() + cooldownDays * 86_400_000);

  await db
    .insert(notificationCooldowns)
    .values({
      eventType,
      entityType,
      entityId,
      lastSentAt: now,
      nextAllowedAt,
      cooldownDays,
    })
    .onConflictDoUpdate({
      target: [
        notificationCooldowns.eventType,
        notificationCooldowns.entityType,
        notificationCooldowns.entityId,
      ],
      set: {
        lastSentAt: now,
        nextAllowedAt,
        cooldownDays,
        updatedAt: now,
      },
    });
}

// ---------------------------------------------------------------------------
// Digest helpers
// ---------------------------------------------------------------------------

/** Maps notification role names to DB PascalCase role names. */
const ROLE_DB_MAP: Record<string, string> = {
  manager: "Manager",
  project_manager: "Manager",
  executive: "Executive",
  technician: "Technician",
};

/**
 * Returns deduplicated { email, name } pairs for all active users
 * that hold any of the specified role names.
 */
async function getRecipientsByRoles(
  roleNames: string[],
): Promise<Array<{ email: string; name: string }>> {
  const dbRoleNames = [...new Set(roleNames.map((r) => ROLE_DB_MAP[r] ?? r))];

  const result = await db
    .select({ id: users.id, email: users.email, fullName: users.fullName })
    .from(users)
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(
      and(
        or(eq(users.isActive, true), isNull(users.isActive)),
        or(eq(users.isDeleted, false), isNull(users.isDeleted)),
        inArray(roles.name, dbRoleNames),
      ),
    );

  const seen = new Set<string>();
  return result
    .filter((u) => {
      if (!u.email || seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    })
    .map((u) => ({ email: u.email!, name: u.fullName ?? "" }));
}

interface DigestParams {
  /** Unique key for the cooldown table, e.g. "job_overdue_digest". */
  digestKey: string;
  /** Role names whose holders receive the digest email. */
  recipientRoles: string[];
  /** Email subject / heading. */
  title: string;
  /** Paragraph shown above the table. */
  intro: string;
  /** Column header labels — order must match each row array. */
  columns: string[];
  /** One string[] per record, values aligned with columns. */
  rows: string[][];
  /** True when results were capped at DIGEST_LIMIT. */
  hasMore?: boolean;
  /** Cooldown in days before the same digest fires again. */
  cooldownDays: number;
  /** Optional dashboard path appended to CLIENT_URL. Must start with /dashboard/. */
  actionUrl?: string;
  /** Button label in the email. Defaults to "View Dashboard". */
  actionLabel?: string;
}

/**
 * Core digest sender used by all cron notification functions that have been
 * converted to the digest pattern.
 *
 * Flow:
 *  1. Skip if rows is empty.
 *  2. Skip if digest is still cooling down.
 *  3. Resolve recipients by role.
 *  4. Send one HTML-table email per recipient.
 *  5. Record cooldown.
 */
async function sendCronDigest(params: DigestParams): Promise<CronResult> {
  const {
    digestKey,
    recipientRoles,
    title,
    intro,
    columns,
    rows,
    hasMore,
    cooldownDays,
    actionUrl,
    actionLabel,
  } = params;

  if (rows.length === 0) return { processed: 0, errors: 0 };

  if (await isCoolingDown(digestKey, "Global", "all")) {
    logger.info(`[CronDigest] ${digestKey} is cooling down — skipping`);
    return { processed: 0, errors: 0 };
  }

  const recipients = await getRecipientsByRoles(recipientRoles);
  if (recipients.length === 0) {
    logger.warn(`[CronDigest] No recipients found for ${digestKey}`);
    return { processed: 0, errors: 0 };
  }

  const result = await digestEmailSvc.sendDigestEmail({
    recipients,
    title,
    intro,
    columns,
    rows,
    ...(hasMore ? { hasMore } : {}),
    ...(actionUrl ? { actionUrl } : {}),
    ...(actionLabel ? { actionLabel } : {}),
  });

  if (result.sent > 0) {
    await setCooldown(digestKey, "Global", "all", cooldownDays);
  }

  logger.info(
    `[CronDigest] ${digestKey}: sent=${result.sent}, errors=${result.errors}`,
  );
  return { processed: result.sent, errors: result.errors };
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
    const now = new Date();

    const raw = await db
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
          not(inArray(jobs.status, ["completed", "cancelled", "invoiced", "closed"])),
          lt(jobs.scheduledEndDate, today),
        ),
      )
      .orderBy(asc(jobs.scheduledEndDate))
      .limit(BATCH_SIZE);

    const cooling = await getCoolingDownEntityIdSet(
      "job_overdue",
      "Job",
      raw.map((j) => j.id),
      now,
    );

    for (const job of raw) {
      try {
        if (cooling.has(job.id)) continue;
        const dueDate = job.scheduledEndDate ? new Date(job.scheduledEndDate) : null;
        const daysOverdue = dueDate
          ? Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000)
          : 0;
        await svc.triggerNotification({
          type: "job_overdue",
          category: "job",
          priority: "high",
          data: {
            entityType: "Job",
            entityId: job.id,
            entityName: job.projectName || job.jobNumber || job.id,
            daysOverdue,
            dueDate: job.scheduledEndDate ?? undefined,
            clientName: job.clientName ?? undefined,
          },
        });
        await setCooldown("job_overdue", "Job", job.id, 3);
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
 * (clockOut is null), or (morning) active employees with NO timesheet for today
 * (clockType = "in"). There is no per-run row cap — all matches are processed.
 * Deliveries use CLOCK_REMINDER_CONCURRENCY parallel calls per batch to limit
 * SMTP/SMS load.
 * Recommended schedule: twice daily — morning (09:30) for missing clock-in,
 * evening (18:30) for missing clock-out.
 */
export async function notifyClockReminder(clockType: "in" | "out" = "out"): Promise<CronResult> {
  let processed = 0;
  let errors = 0;

  try {
    const today = todayStr();

    if (clockType === "out") {
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
        );

      const rows = openShifts.filter((ts) => ts.employeeId != null);
      const batch = await runInConcurrencyWindows(
        rows,
        CLOCK_REMINDER_CONCURRENCY,
        (ts) =>
          svc.triggerNotification({
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
          }),
        (ts, err) =>
          logger.error(
            `[CronNotif] clock_reminder(out) failed for employee ${ts.employeeId}:`,
            err,
          ),
      );
      processed += batch.processed;
      errors += batch.errors;
    } else {
      const [allActiveEmployees, todaySheets] = await Promise.all([
        db
          .select({ id: employees.id })
          .from(employees)
          .where(
            and(
              isNull(employees.terminationDate),
              not(inArray(employees.status as any, ["terminated", "suspended"])),
            ),
          ),
        db
          .select({ employeeId: timesheets.employeeId })
          .from(timesheets)
          .where(
            and(eq(timesheets.sheetDate, today), eq(timesheets.isDeleted, false)),
          ),
      ]);

      const clockedInIds = new Set(todaySheets.map((r) => r.employeeId).filter(Boolean));

      const unclockedIn = allActiveEmployees.filter((emp) => !clockedInIds.has(emp.id));

      const batch = await runInConcurrencyWindows(
        unclockedIn,
        CLOCK_REMINDER_CONCURRENCY,
        (emp) =>
          svc.triggerNotification({
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
          }),
        (emp, err) =>
          logger.error(`[CronNotif] clock_reminder(in) failed for employee ${emp.id}:`, err),
      );
      processed += batch.processed;
      errors += batch.errors;
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
    const now = new Date();

    const raw = await db
      .select({
        id: vehicles.id,
        vehicleId: vehicles.vehicleId,
        make: vehicles.make,
        model: vehicles.model,
        licensePlate: vehicles.licensePlate,
        nextServiceDue: vehicles.nextServiceDue,
        assignedToEmployeeId: vehicles.assignedToEmployeeId,
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

    const cooling = await getCoolingDownEntityIdSet(
      "maintenance_overdue",
      "Vehicle",
      raw.map((v) => v.id),
      now,
    );

    for (const v of raw) {
      try {
        if (cooling.has(v.id)) continue;
        const dueDate = v.nextServiceDue ? new Date(v.nextServiceDue) : null;
        const daysOverdue = dueDate
          ? Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000)
          : 0;
        const entityName = `${v.make} ${v.model}`.trim() || v.vehicleId || v.id;
        await svc.triggerNotification({
          type: "maintenance_overdue",
          category: "fleet",
          priority: "high",
          data: {
            entityType: "Vehicle",
            entityId: v.id,
            entityName,
            licensePlate: v.licensePlate ?? undefined,
            dueDate: v.nextServiceDue ?? undefined,
            daysOverdue,
            ...(v.assignedToEmployeeId != null ? { driverId: String(v.assignedToEmployeeId) } : {}),
          },
        });
        await setCooldown("maintenance_overdue", "Vehicle", v.id, 3);
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
    const now = new Date();

    const raw = await db
      .select({
        id: vehicles.id,
        vehicleId: vehicles.vehicleId,
        make: vehicles.make,
        model: vehicles.model,
        licensePlate: vehicles.licensePlate,
        nextInspectionDue: vehicles.nextInspectionDue,
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

    const cooling = await getCoolingDownEntityIdSet(
      "safety_inspection_expired",
      "Vehicle",
      raw.map((v) => v.id),
      now,
    );

    for (const v of raw) {
      try {
        if (cooling.has(v.id)) continue;
        const expiredDate = v.nextInspectionDue ? new Date(v.nextInspectionDue) : null;
        const daysExpired = expiredDate
          ? Math.floor((now.getTime() - expiredDate.getTime()) / 86_400_000)
          : 0;
        const entityName = `${v.make} ${v.model}`.trim() || v.vehicleId || v.id;
        await svc.triggerNotification({
          type: "safety_inspection_expired",
          category: "fleet",
          priority: "high",
          data: {
            entityType: "Vehicle",
            entityId: v.id,
            entityName,
            licensePlate: v.licensePlate ?? undefined,
            dueDate: v.nextInspectionDue ?? undefined,
            daysOverdue: daysExpired,
          },
        });
        await setCooldown("safety_inspection_expired", "Vehicle", v.id, 3);
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

    const raw = await db
      .select({
        id: vehicles.id,
        vehicleId: vehicles.vehicleId,
        make: vehicles.make,
        model: vehicles.model,
        licensePlate: vehicles.licensePlate,
        registrationExpiration: vehicles.registrationExpiration,
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

    const cooling = await getCoolingDownEntityIdSet(
      "vehicle_registration_expiring",
      "Vehicle",
      raw.map((v) => v.id),
    );

    for (const v of raw) {
      try {
        if (cooling.has(v.id)) continue;
        const entityName = `${v.make} ${v.model}`.trim() || v.vehicleId || v.id;
        await svc.triggerNotification({
          type: "vehicle_registration_expiring",
          category: "fleet",
          priority: "high",
          data: {
            entityType: "Vehicle",
            entityId: v.id,
            entityName,
            licensePlate: v.licensePlate ?? undefined,
            dueDate: v.registrationExpiration ?? undefined,
          },
        });
        await setCooldown("vehicle_registration_expiring", "Vehicle", v.id, 7);
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

    const raw = await db
      .select({
        id: vehicles.id,
        vehicleId: vehicles.vehicleId,
        make: vehicles.make,
        model: vehicles.model,
        licensePlate: vehicles.licensePlate,
        insuranceExpiration: vehicles.insuranceExpiration,
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

    const cooling = await getCoolingDownEntityIdSet(
      "vehicle_insurance_expiring",
      "Vehicle",
      raw.map((v) => v.id),
    );

    for (const v of raw) {
      try {
        if (cooling.has(v.id)) continue;
        const entityName = `${v.make} ${v.model}`.trim() || v.vehicleId || v.id;
        await svc.triggerNotification({
          type: "vehicle_insurance_expiring",
          category: "fleet",
          priority: "high",
          data: {
            entityType: "Vehicle",
            entityId: v.id,
            entityName,
            licensePlate: v.licensePlate ?? undefined,
            dueDate: v.insuranceExpiration ?? undefined,
          },
        });
        await setCooldown("vehicle_insurance_expiring", "Vehicle", v.id, 7);
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

    const raw = await db
      .select({
        id: employees.id,
        employeeId: employees.employeeId,
        nextReviewDate: sql<string>`COALESCE((employees.next_review_date)::text, '')`,
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

    const cooling = await getCoolingDownEntityIdSet(
      "performance_review_due",
      "Employee",
      raw.map((e) => String(e.id)),
    );

    for (const emp of raw) {
      try {
        if (cooling.has(String(emp.id))) continue;
        const entityName = emp.employeeId ?? `Employee #${emp.id}`;
        await svc.triggerNotification({
          type: "performance_review_due",
          category: "system",
          priority: "medium",
          data: {
            entityType: "Employee",
            entityId: String(emp.id),
            entityName,
            employeeId: String(emp.id),
            dueDate: emp.nextReviewDate || undefined,
          },
        });
        await setCooldown("performance_review_due", "Employee", String(emp.id), 3);
        processed++;
      } catch (err) {
        logger.error(`[CronNotif] performance_review_due failed for employee ${emp.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    logger.warn("[CronNotif] notifyPerformanceReviewDue skipped:", (err as any)?.message);
    errors++;
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
  try {
    const today = todayStr();
    const in30 = daysFromNow(30);
    const now = new Date();

    const raw = await db
      .select({
        id: vehicles.id,
        vehicleId: vehicles.vehicleId,
        make: vehicles.make,
        model: vehicles.model,
        licensePlate: vehicles.licensePlate,
        nextInspectionDue: vehicles.nextInspectionDue,
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
      .limit(DIGEST_LIMIT + 1);

    const hasMore = raw.length > DIGEST_LIMIT;
    const upcomingVehicles = hasMore ? raw.slice(0, DIGEST_LIMIT) : raw;

    const rows = upcomingVehicles.map((v) => {
      const dueDate = v.nextInspectionDue ? new Date(v.nextInspectionDue) : null;
      const daysLeft = dueDate
        ? Math.ceil((dueDate.getTime() - now.getTime()) / 86_400_000)
        : 0;
      return [
        `${v.make} ${v.model}`,
        v.vehicleId ?? "—",
        v.licensePlate ?? "—",
        v.nextInspectionDue ?? "—",
        `${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
      ];
    });

    return sendCronDigest({
      digestKey: "safety_inspection_upcoming_digest",
      recipientRoles: ["manager", "executive"],
      title: "🔍 Upcoming Safety Inspections",
      intro: `${upcomingVehicles.length} vehicle safety inspection${upcomingVehicles.length !== 1 ? "s are" : " is"} due within the next 30 days.`,
      columns: ["Vehicle", "Vehicle ID", "License Plate", "Due Date", "Days Left"],
      rows,
      hasMore,
      cooldownDays: 7,
      actionUrl: "/dashboard/fleet",
      actionLabel: "View Fleet",
    });
  } catch (err) {
    logger.error("[CronNotif] notifySafetyInspectionUpcoming failed:", err);
    return { processed: 0, errors: 1 };
  }
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
    const now = new Date();

    const raw = await db
      .select({
        id: inventoryPurchaseOrders.id,
        poNumber: inventoryPurchaseOrders.poNumber,
        title: inventoryPurchaseOrders.title,
        expectedDeliveryDate: inventoryPurchaseOrders.expectedDeliveryDate,
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

    const cooling = await getCoolingDownEntityIdSet(
      "purchase_order_delayed",
      "PurchaseOrder",
      raw.map((po) => po.id),
      now,
    );

    for (const po of raw) {
      try {
        if (cooling.has(po.id)) continue;
        const expectedDate = po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate) : null;
        const daysDelayed = expectedDate
          ? Math.floor((now.getTime() - expectedDate.getTime()) / 86_400_000)
          : 0;
        const entityName = po.poNumber || po.title || po.id;
        await svc.triggerNotification({
          type: "purchase_order_delayed",
          category: "inventory",
          priority: "medium",
          data: {
            entityType: "PurchaseOrder",
            entityId: po.id,
            entityName,
            dueDate: po.expectedDeliveryDate ?? undefined,
            daysOverdue: daysDelayed,
            ...(po.totalAmount ? { amount: Number(po.totalAmount) } : {}),
          },
        });
        await setCooldown("purchase_order_delayed", "PurchaseOrder", po.id, 3);
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
