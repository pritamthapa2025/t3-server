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
  notifyVehicleRegistrationExpiring,
  notifyVehicleInsuranceExpiring,
  notifyPerformanceReviewDue,
} from "../../services/notifications-cron.service.js";
import { logger } from "../../utils/logger.js";

const router: IRouter = Router();

/**
 * Middleware: allow request only when CRON_SECRET matches.
 * Use with external schedulers (e.g. Cronicles): set CRON_SECRET in env and pass it in the request.
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
    req.get("X-Cron-Secret") ?? req.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? (req.query.key as string);

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
 * Requires CRON_SECRET in header (X-Cron-Secret or Authorization: Bearer <CRON_SECRET>) or query (?key=<CRON_SECRET>).
 */
router.get("/expire-bids", async (req: Request, res: Response) => {
  try {
    const result = await expireExpiredBids();
    logger.info("Expire bids cron run", { expired: result.expired, errors: result.errors });
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("Expire bids cron failed", { error });
    res.status(500).json({
      success: false,
      message: "Failed to run expire-bids job",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/v1/cron/purge-deleted-files
 * Permanently deletes files from DO Spaces that have been soft-deleted for more than 30 days,
 * then hard-deletes the DB rows.
 *
 * Schedule recommendation: daily (e.g. 02:00 AM).
 * Auth: pass CRON_SECRET in header X-Cron-Secret or Authorization: Bearer <CRON_SECRET> or ?key=<CRON_SECRET>.
 */
router.get("/purge-deleted-files", async (req: Request, res: Response) => {
  try {
    const result = await purgeExpiredDeletedFiles();
    logger.info("Purge deleted files cron run", {
      purged: result.purged,
      errors: result.errors,
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("Purge deleted files cron failed", { error });
    res.status(500).json({
      success: false,
      message: "Failed to run purge-deleted-files job",
      error: error instanceof Error ? error.message : String(error),
    });
  }
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
 * Auth: pass CRON_SECRET in header X-Cron-Secret or Authorization: Bearer <CRON_SECRET> or ?key=<CRON_SECRET>.
 */
router.get("/purge-deleted-records", async (req: Request, res: Response) => {
  try {
    const result = await purgeDeletedMainRecords();
    logger.info("Purge deleted records cron run", {
      totalHardDeleted: result.totalHardDeleted,
      totalErrors: result.totalErrors,
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("Purge deleted records cron failed", { error });
    res.status(500).json({
      success: false,
      message: "Failed to run purge-deleted-records job",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ---------------------------------------------------------------------------
// Notification cron jobs
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/cron/notify-jobs-overdue
 * Find jobs past their scheduled end date and notify manager, technician, executive.
 * Schedule: daily (e.g. 08:00).
 */
router.get("/notify-jobs-overdue", async (_req: Request, res: Response) => {
  try {
    const result = await notifyJobOverdue();
    logger.info("notify-jobs-overdue cron run", result);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("notify-jobs-overdue cron failed", { error });
    res.status(500).json({ success: false, message: "Failed to run notify-jobs-overdue", error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/v1/cron/notify-invoice-due-tomorrow
 * Find invoices due tomorrow and notify client, project manager, executive.
 * Schedule: daily (e.g. 09:00).
 */
router.get("/notify-invoice-due-tomorrow", async (_req: Request, res: Response) => {
  try {
    const result = await notifyInvoiceDueTomorrow();
    logger.info("notify-invoice-due-tomorrow cron run", result);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("notify-invoice-due-tomorrow cron failed", { error });
    res.status(500).json({ success: false, message: "Failed to run notify-invoice-due-tomorrow", error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/v1/cron/notify-invoice-overdue
 * Find invoices overdue by exactly 1, 7, or 30 days and send escalating notifications.
 * Schedule: daily (e.g. 09:05).
 */
router.get("/notify-invoice-overdue", async (_req: Request, res: Response) => {
  try {
    const [r1, r7, r30] = await Promise.all([
      notifyInvoiceOverdue1Day(),
      notifyInvoiceOverdue7Days(),
      notifyInvoiceOverdue30Days(),
    ]);
    const result = {
      "1day": r1,
      "7days": r7,
      "30days": r30,
    };
    logger.info("notify-invoice-overdue cron run", result);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("notify-invoice-overdue cron failed", { error });
    res.status(500).json({ success: false, message: "Failed to run notify-invoice-overdue", error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/v1/cron/notify-clock-reminder
 * Remind employees who haven't clocked in (morning) or out (evening).
 * Schedule: twice daily — 09:30 (in), 18:30 (out).
 * Pass ?type=in or ?type=out (default: out).
 */
router.get("/notify-clock-reminder", async (req: Request, res: Response) => {
  try {
    const clockType = (req.query.type as string) === "in" ? "in" : "out";
    const result = await notifyClockReminder(clockType);
    logger.info(`notify-clock-reminder cron run (${clockType})`, result);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("notify-clock-reminder cron failed", { error });
    res.status(500).json({ success: false, message: "Failed to run notify-clock-reminder", error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/v1/cron/notify-maintenance-due
 * Notify driver and manager for vehicles with upcoming or overdue maintenance.
 * Schedule: daily (e.g. 07:00).
 */
router.get("/notify-maintenance-due", async (_req: Request, res: Response) => {
  try {
    const [r7, r3, rOverdue] = await Promise.all([
      notifyMaintenanceDue7Days(),
      notifyMaintenanceDue3Days(),
      notifyMaintenanceOverdue(),
    ]);
    const result = { due7days: r7, due3days: r3, overdue: rOverdue };
    logger.info("notify-maintenance-due cron run", result);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("notify-maintenance-due cron failed", { error });
    res.status(500).json({ success: false, message: "Failed to run notify-maintenance-due", error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/v1/cron/notify-inspection-expired
 * Notify manager and executive for vehicles with expired safety inspections.
 * Schedule: daily (e.g. 07:05).
 */
router.get("/notify-inspection-expired", async (_req: Request, res: Response) => {
  try {
    const result = await notifySafetyInspectionExpired();
    logger.info("notify-inspection-expired cron run", result);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("notify-inspection-expired cron failed", { error });
    res.status(500).json({ success: false, message: "Failed to run notify-inspection-expired", error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/v1/cron/notify-vehicle-expiry
 * Notify manager and executive for vehicles with registration or insurance expiring within 30 days.
 * Schedule: daily (e.g. 07:10).
 */
router.get("/notify-vehicle-expiry", async (_req: Request, res: Response) => {
  try {
    const [rReg, rIns] = await Promise.all([
      notifyVehicleRegistrationExpiring(),
      notifyVehicleInsuranceExpiring(),
    ]);
    const result = { registration: rReg, insurance: rIns };
    logger.info("notify-vehicle-expiry cron run", result);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("notify-vehicle-expiry cron failed", { error });
    res.status(500).json({ success: false, message: "Failed to run notify-vehicle-expiry", error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * GET /api/v1/cron/notify-performance-reviews
 * Notify manager when employee performance reviews are due within 7 days.
 * Schedule: daily (e.g. 09:10).
 */
router.get("/notify-performance-reviews", async (_req: Request, res: Response) => {
  try {
    const result = await notifyPerformanceReviewDue();
    logger.info("notify-performance-reviews cron run", result);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("notify-performance-reviews cron failed", { error });
    res.status(500).json({ success: false, message: "Failed to run notify-performance-reviews", error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
