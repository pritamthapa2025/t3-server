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
/** Maximum rows rendered in a single digest email. */
const DIGEST_LIMIT = 50;

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
          not(inArray(jobs.status, ["completed", "cancelled"])),
          lt(jobs.scheduledEndDate, today),
        ),
      )
      .orderBy(asc(jobs.scheduledEndDate))
      .limit(DIGEST_LIMIT + 1);

    const hasMore = raw.length > DIGEST_LIMIT;
    const overdueJobs = hasMore ? raw.slice(0, DIGEST_LIMIT) : raw;

    const rows = overdueJobs.map((job) => {
      const dueDate = job.scheduledEndDate ? new Date(job.scheduledEndDate) : null;
      const daysOverdue = dueDate
        ? Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000)
        : 0;
      return [
        job.jobNumber ?? "—",
        job.projectName ?? "—",
        job.clientName ?? "—",
        job.scheduledEndDate ?? "—",
        `${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}`,
      ];
    });

    return sendCronDigest({
      digestKey: "job_overdue_digest",
      recipientRoles: ["manager", "executive"],
      title: "⚠️ Overdue Jobs Summary",
      intro: `${overdueJobs.length} job${overdueJobs.length !== 1 ? "s are" : " is"} overdue and require your attention.`,
      columns: ["Job #", "Project Name", "Client", "Due Date", "Days Overdue"],
      rows,
      hasMore,
      cooldownDays: 3,
      actionUrl: "/dashboard/jobs",
      actionLabel: "View All Jobs",
    });
  } catch (err) {
    logger.error("[CronNotif] notifyJobOverdue failed:", err);
    return { processed: 0, errors: 1 };
  }
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
      })
      .from(vehicles)
      .where(
        and(
          eq(vehicles.isDeleted, false),
          lt(vehicles.nextServiceDue, today),
        ),
      )
      .orderBy(asc(vehicles.nextServiceDue))
      .limit(DIGEST_LIMIT + 1);

    const hasMore = raw.length > DIGEST_LIMIT;
    const overdueVehicles = hasMore ? raw.slice(0, DIGEST_LIMIT) : raw;

    const rows = overdueVehicles.map((v) => {
      const dueDate = v.nextServiceDue ? new Date(v.nextServiceDue) : null;
      const daysOverdue = dueDate
        ? Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000)
        : 0;
      return [
        `${v.make} ${v.model}`,
        v.vehicleId ?? "—",
        v.licensePlate ?? "—",
        v.nextServiceDue ?? "—",
        `${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}`,
      ];
    });

    return sendCronDigest({
      digestKey: "maintenance_overdue_digest",
      recipientRoles: ["manager", "executive"],
      title: "🔧 Overdue Vehicle Maintenance Summary",
      intro: `${overdueVehicles.length} vehicle${overdueVehicles.length !== 1 ? "s have" : " has"} overdue maintenance that requires immediate attention.`,
      columns: ["Vehicle", "Vehicle ID", "License Plate", "Service Due", "Days Overdue"],
      rows,
      hasMore,
      cooldownDays: 3,
      actionUrl: "/dashboard/fleet",
      actionLabel: "View Fleet",
    });
  } catch (err) {
    logger.error("[CronNotif] notifyMaintenanceOverdue failed:", err);
    return { processed: 0, errors: 1 };
  }
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
      .limit(DIGEST_LIMIT + 1);

    const hasMore = raw.length > DIGEST_LIMIT;
    const expiredVehicles = hasMore ? raw.slice(0, DIGEST_LIMIT) : raw;

    const rows = expiredVehicles.map((v) => {
      const expiredDate = v.nextInspectionDue ? new Date(v.nextInspectionDue) : null;
      const daysExpired = expiredDate
        ? Math.floor((now.getTime() - expiredDate.getTime()) / 86_400_000)
        : 0;
      return [
        `${v.make} ${v.model}`,
        v.vehicleId ?? "—",
        v.licensePlate ?? "—",
        v.nextInspectionDue ?? "—",
        `${daysExpired} day${daysExpired !== 1 ? "s" : ""}`,
      ];
    });

    return sendCronDigest({
      digestKey: "safety_inspection_expired_digest",
      recipientRoles: ["manager", "executive"],
      title: "🚨 Expired Safety Inspections Summary",
      intro: `${expiredVehicles.length} vehicle${expiredVehicles.length !== 1 ? "s have" : " has"} expired safety inspections. Immediate action required.`,
      columns: ["Vehicle", "Vehicle ID", "License Plate", "Inspection Expired", "Days Expired"],
      rows,
      hasMore,
      cooldownDays: 3,
      actionUrl: "/dashboard/fleet",
      actionLabel: "View Fleet",
    });
  } catch (err) {
    logger.error("[CronNotif] notifySafetyInspectionExpired failed:", err);
    return { processed: 0, errors: 1 };
  }
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
      .limit(DIGEST_LIMIT + 1);

    const hasMore = raw.length > DIGEST_LIMIT;
    const expiringVehicles = hasMore ? raw.slice(0, DIGEST_LIMIT) : raw;

    const rows = expiringVehicles.map((v) => {
      const expDate = v.registrationExpiration ? new Date(v.registrationExpiration) : null;
      const daysLeft = expDate
        ? Math.ceil((expDate.getTime() - now.getTime()) / 86_400_000)
        : 0;
      return [
        `${v.make} ${v.model}`,
        v.vehicleId ?? "—",
        v.licensePlate ?? "—",
        v.registrationExpiration ?? "—",
        `${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
      ];
    });

    return sendCronDigest({
      digestKey: "vehicle_registration_expiring_digest",
      recipientRoles: ["manager", "executive"],
      title: "📋 Vehicle Registration Expiry Summary",
      intro: `${expiringVehicles.length} vehicle registration${expiringVehicles.length !== 1 ? "s are" : " is"} expiring within the next 30 days.`,
      columns: ["Vehicle", "Vehicle ID", "License Plate", "Expires On", "Days Left"],
      rows,
      hasMore,
      cooldownDays: 7,
      actionUrl: "/dashboard/fleet",
      actionLabel: "View Fleet",
    });
  } catch (err) {
    logger.error("[CronNotif] notifyVehicleRegistrationExpiring failed:", err);
    return { processed: 0, errors: 1 };
  }
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
      .limit(DIGEST_LIMIT + 1);

    const hasMore = raw.length > DIGEST_LIMIT;
    const expiringVehicles = hasMore ? raw.slice(0, DIGEST_LIMIT) : raw;

    const rows = expiringVehicles.map((v) => {
      const expDate = v.insuranceExpiration ? new Date(v.insuranceExpiration) : null;
      const daysLeft = expDate
        ? Math.ceil((expDate.getTime() - now.getTime()) / 86_400_000)
        : 0;
      return [
        `${v.make} ${v.model}`,
        v.vehicleId ?? "—",
        v.licensePlate ?? "—",
        v.insuranceExpiration ?? "—",
        `${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
      ];
    });

    return sendCronDigest({
      digestKey: "vehicle_insurance_expiring_digest",
      recipientRoles: ["manager", "executive"],
      title: "🛡️ Vehicle Insurance Expiry Summary",
      intro: `${expiringVehicles.length} vehicle insurance polic${expiringVehicles.length !== 1 ? "ies are" : "y is"} expiring within the next 30 days.`,
      columns: ["Vehicle", "Vehicle ID", "License Plate", "Expires On", "Days Left"],
      rows,
      hasMore,
      cooldownDays: 7,
      actionUrl: "/dashboard/fleet",
      actionLabel: "View Fleet",
    });
  } catch (err) {
    logger.error("[CronNotif] notifyVehicleInsuranceExpiring failed:", err);
    return { processed: 0, errors: 1 };
  }
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
  try {
    const today = todayStr();
    const in7 = daysFromNow(7);
    const now = new Date();

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
      .limit(DIGEST_LIMIT + 1);

    const hasMore = raw.length > DIGEST_LIMIT;
    const dueEmployees = hasMore ? raw.slice(0, DIGEST_LIMIT) : raw;

    const rows = dueEmployees.map((emp) => {
      const reviewDate = emp.nextReviewDate ? new Date(emp.nextReviewDate) : null;
      const daysUntil = reviewDate
        ? Math.ceil((reviewDate.getTime() - now.getTime()) / 86_400_000)
        : 0;
      const status =
        daysUntil < 0
          ? `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? "s" : ""} overdue`
          : daysUntil === 0
            ? "Due today"
            : `Due in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`;
      return [
        emp.employeeId ?? `EMP-${emp.id}`,
        emp.nextReviewDate || "—",
        status,
      ];
    });

    return sendCronDigest({
      digestKey: "performance_review_due_digest",
      recipientRoles: ["manager"],
      title: "📊 Performance Reviews Due",
      intro: `${dueEmployees.length} employee performance review${dueEmployees.length !== 1 ? "s are" : " is"} due within the next 7 days and require scheduling.`,
      columns: ["Employee ID", "Review Due Date", "Status"],
      rows,
      hasMore,
      cooldownDays: 3,
      actionUrl: "/dashboard/team/employees",
      actionLabel: "View Employees",
    });
  } catch (err) {
    logger.warn("[CronNotif] notifyPerformanceReviewDue skipped:", (err as any)?.message);
    return { processed: 0, errors: 0 };
  }
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
      .limit(DIGEST_LIMIT + 1);

    const hasMore = raw.length > DIGEST_LIMIT;
    const delayedOrders = hasMore ? raw.slice(0, DIGEST_LIMIT) : raw;

    const rows = delayedOrders.map((po) => {
      const expectedDate = po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate) : null;
      const daysDelayed = expectedDate
        ? Math.floor((now.getTime() - expectedDate.getTime()) / 86_400_000)
        : 0;
      const amount = po.totalAmount ? `$${Number(po.totalAmount).toLocaleString()}` : "—";
      return [
        po.poNumber ?? "—",
        po.title ?? "—",
        po.expectedDeliveryDate ?? "—",
        `${daysDelayed} day${daysDelayed !== 1 ? "s" : ""}`,
        amount,
      ];
    });

    return sendCronDigest({
      digestKey: "purchase_order_delayed_digest",
      recipientRoles: ["manager", "executive"],
      title: "📦 Delayed Purchase Orders Summary",
      intro: `${delayedOrders.length} purchase order${delayedOrders.length !== 1 ? "s have" : " has"} passed the expected delivery date and require follow-up.`,
      columns: ["PO #", "Title", "Expected Delivery", "Days Delayed", "Amount"],
      rows,
      hasMore,
      cooldownDays: 3,
      actionUrl: "/dashboard/inventory/purchase-orders",
      actionLabel: "View Purchase Orders",
    });
  } catch (err) {
    logger.error("[CronNotif] notifyPurchaseOrderDelayed failed:", err);
    return { processed: 0, errors: 1 };
  }
}
