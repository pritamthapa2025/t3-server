import { Router, type Request, type Response, type NextFunction, type IRouter } from "express";
import { expireExpiredBids } from "../../services/bid.service.js";
import { purgeExpiredDeletedFiles } from "../../services/files-v2.service.js";
import { purgeDeletedMainRecords } from "../../services/purge-deleted-records.service.js";
import {
  notifyJobOverdue,
  notifyInvoiceDueTomorrow,
  notifyInvoiceOverdue1Day,
  notifyInvoiceOverdue7Days,
  notifyInvoiceOverdue30Days,
  notifyClockReminder,
  notifyMaintenanceDue7Days,
  notifyMaintenanceDue3Days,
  notifyMaintenanceOverdue,
  notifySafetyInspectionExpired,
  notifySafetyInspectionAssignedDriverReminders,
  notifySafetyInspectionUpcoming,
  notifyVehicleRegistrationExpiring,
  notifyVehicleInsuranceExpiring,
  notifyPerformanceReviewDue,
  notifyPurchaseOrderDelayed,
} from "../../services/notifications-cron.service.js";
import { logger } from "../../utils/logger.js";

const router: IRouter = Router();

/**
 * Respond immediately with 202 and run the job in the background.
 * Callers only receive acknowledgment; check server logs for processed/errors and failures.
 */
function scheduleCronJob(
  jobName: string,
  res: Response,
  runner: () => Promise<unknown>,
  extraBody?: Record<string, unknown>,
): void {
  res.status(202).json({
    success: true,
    accepted: true,
    job: jobName,
    ...extraBody,
  });
  void (async () => {
    try {
      const result = await runner();
      logger.info(`[Cron] ${jobName} completed`, { result });
    } catch (error) {
      logger.error(`[Cron] ${jobName} failed`, { error });
    }
  })();
}

/**
 * Middleware: allow request only when CRON_SECRET matches.
 * Pass the secret via X-Cron-Secret header or Authorization: Bearer <CRON_SECRET>.
 * Query-string delivery (?key=) is intentionally not supported to prevent secret leakage in logs.
 */
function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.warn("CRON_SECRET is not set - cron endpoints are disabled");
    return res.status(503).json({
      success: false,
      message: "Cron endpoints are not configured",
    });
  }

  const provided =
    req.get("X-Cron-Secret") ?? req.get("Authorization")?.replace(/^Bearer\s+/i, "");

  if (provided !== secret) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  next();
}

router.use(requireCronSecret);

/**
 * GET /api/v1/cron/expire-bids
 * Expire bids whose endDate has passed. Call this from Cronicles (or any cron) on a schedule (e.g. daily).
 * Requires CRON_SECRET via X-Cron-Secret or Authorization: Bearer <CRON_SECRET> header.
 *
 * Returns 202 immediately; work runs in the background. Use logs for outcomes; avoid overlapping tight retries.
 */
router.get("/expire-bids", (_req: Request, res: Response) => {
  scheduleCronJob("expire-bids", res, () => expireExpiredBids());
});

/**
 * GET /api/v1/cron/purge-deleted-files
 * Permanently deletes files from DO Spaces that have been soft-deleted for more than 30 days,
 * then hard-deletes the DB rows.
 *
 * Schedule recommendation: daily (e.g. 02:00 AM).
 * Auth: pass CRON_SECRET via X-Cron-Secret or Authorization: Bearer <CRON_SECRET> header.
 *
 * Returns 202 immediately; work runs in the background. Use logs for outcomes; avoid overlapping tight retries.
 */
router.get("/purge-deleted-files", (_req: Request, res: Response) => {
  scheduleCronJob("purge-deleted-files", res, () => purgeExpiredDeletedFiles());
});

/**
 * GET /api/v1/cron/purge-deleted-records
 *
 * Permanently hard-deletes records from all 13 main entity tables
 * (bids, jobs, dispatch tasks, timesheets, expenses, invoices, clients,
 *  employees, departments, payroll runs, compliance cases, vehicles, inventory items)
 * that have been soft-deleted for more than 30 days (deletedAt < now - 30d).
 *
 * Schedule recommendation: daily (e.g. 03:00 AM UTC, run AFTER purge-deleted-files).
 * Auth: pass CRON_SECRET via X-Cron-Secret or Authorization: Bearer <CRON_SECRET> header.
 *
 * Returns 202 immediately; work runs in the background. Use logs for outcomes; avoid overlapping tight retries.
 */
router.get("/purge-deleted-records", (_req: Request, res: Response) => {
  scheduleCronJob("purge-deleted-records", res, () => purgeDeletedMainRecords());
});

// ---------------------------------------------------------------------------
// Notification cron jobs
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/cron/notify-jobs-overdue
 * Find jobs past their scheduled end date and notify manager, technician, executive.
 * Schedule: daily (e.g. 08:00).
 *
 * Returns 202 immediately; notifications run in the background. Use logs for outcomes.
 */
router.get("/notify-jobs-overdue", (_req: Request, res: Response) => {
  scheduleCronJob("notify-jobs-overdue", res, () => notifyJobOverdue());
});

/**
 * GET /api/v1/cron/notify-invoice-due-tomorrow
 * Find invoices due tomorrow and notify client, project manager, executive.
 * Schedule: daily (e.g. 09:00).
 *
 * Returns 202 immediately; notifications run in the background. Use logs for outcomes.
 */
router.get("/notify-invoice-due-tomorrow", (_req: Request, res: Response) => {
  scheduleCronJob("notify-invoice-due-tomorrow", res, () => notifyInvoiceDueTomorrow());
});

/**
 * GET /api/v1/cron/notify-invoice-overdue
 * Find invoices overdue by exactly 1, 7, or 30 days and send escalating notifications.
 * Schedule: daily (e.g. 09:05).
 *
 * Returns 202 immediately; notifications run in the background. Use logs for outcomes.
 */
router.get("/notify-invoice-overdue", (_req: Request, res: Response) => {
  scheduleCronJob("notify-invoice-overdue", res, async () => {
    const [r1, r7, r30] = await Promise.all([
      notifyInvoiceOverdue1Day(),
      notifyInvoiceOverdue7Days(),
      notifyInvoiceOverdue30Days(),
    ]);
    return {
      "1day": r1,
      "7days": r7,
      "30days": r30,
    };
  });
});

/**
 * GET /api/v1/cron/notify-clock-reminder
 * Remind employees who haven't clocked in (morning) or out (evening).
 * Schedule: twice daily — 09:30 (in), 18:30 (out).
 * Pass ?type=in or ?type=out (default: out).
 *
 * Returns 202 immediately; notifications run in the background. Use logs for outcomes.
 */
router.get("/notify-clock-reminder", (req: Request, res: Response) => {
  const clockType = (req.query.type as string) === "in" ? "in" : "out";
  scheduleCronJob("notify-clock-reminder", res, () => notifyClockReminder(clockType), {
    clockType,
  });
});

/**
 * GET /api/v1/cron/notify-maintenance-due
 * Notify driver and manager for vehicles with upcoming or overdue maintenance.
 * Schedule: daily (e.g. 07:00).
 *
 * Returns 202 immediately; notifications run in the background. Use logs for outcomes.
 */
router.get("/notify-maintenance-due", (_req: Request, res: Response) => {
  scheduleCronJob("notify-maintenance-due", res, async () => {
    const [r7, r3, rOverdue] = await Promise.all([
      notifyMaintenanceDue7Days(),
      notifyMaintenanceDue3Days(),
      notifyMaintenanceOverdue(),
    ]);
    return { due7days: r7, due3days: r3, overdue: rOverdue };
  });
});

/**
 * GET /api/v1/cron/notify-inspection-expired
 * Notify manager and executive for vehicles with expired safety inspections (past due date),
 * and run assigned-driver daily reminders / timesheet block (after 3 reminders) for due/overdue
 * vehicles with an assigned driver.
 * Schedule: daily (e.g. 07:05).
 *
 * Returns 202 immediately; notifications run in the background. Use logs for outcomes.
 */
router.get("/notify-inspection-expired", (_req: Request, res: Response) => {
  scheduleCronJob("notify-inspection-expired", res, async () => {
    const [expired, assignedDriver] = await Promise.all([
      notifySafetyInspectionExpired(),
      notifySafetyInspectionAssignedDriverReminders(),
    ]);
    return { expired, assignedDriverReminders: assignedDriver };
  });
});

/**
 * GET /api/v1/cron/notify-vehicle-expiry
 * Notify manager and executive for vehicles with registration or insurance expiring within 30 days.
 * Schedule: daily (e.g. 07:10).
 *
 * Returns 202 immediately; notifications run in the background. Use logs for outcomes.
 */
router.get("/notify-vehicle-expiry", (_req: Request, res: Response) => {
  scheduleCronJob("notify-vehicle-expiry", res, async () => {
    const [rReg, rIns] = await Promise.all([
      notifyVehicleRegistrationExpiring(),
      notifyVehicleInsuranceExpiring(),
    ]);
    return { registration: rReg, insurance: rIns };
  });
});

/**
 * GET /api/v1/cron/notify-performance-reviews
 * Notify manager when employee performance reviews are due within 7 days.
 * Schedule: daily (e.g. 09:10).
 *
 * Returns 202 immediately; notifications run in the background. Use logs for outcomes.
 */
router.get("/notify-performance-reviews", (_req: Request, res: Response) => {
  scheduleCronJob("notify-performance-reviews", res, () => notifyPerformanceReviewDue());
});

/**
 * GET /api/v1/cron/notify-inspection-upcoming
 * Notify manager and executive for vehicles whose safety inspection is due within 30 days.
 * Schedule: daily (e.g. 07:06, right after notify-inspection-expired).
 *
 * Returns 202 immediately; notifications run in the background. Use logs for outcomes.
 */
router.get("/notify-inspection-upcoming", (_req: Request, res: Response) => {
  scheduleCronJob("notify-inspection-upcoming", res, () => notifySafetyInspectionUpcoming());
});

/**
 * GET /api/v1/cron/notify-po-delayed
 * Notify manager and executive for purchase orders past their expected delivery date
 * that have not yet been fully received or cancelled.
 * Schedule: daily (e.g. 07:30).
 *
 * Returns 202 immediately; notifications run in the background. Use logs for outcomes.
 */
router.get("/notify-po-delayed", (_req: Request, res: Response) => {
  scheduleCronJob("notify-po-delayed", res, () => notifyPurchaseOrderDelayed());
});

export default router;
