import { Router, type Request, type Response, type NextFunction, type IRouter } from "express";
import { expireExpiredBids } from "../../services/bid.service.js";
import { purgeExpiredDeletedFiles } from "../../services/files-v2.service.js";
import { purgeDeletedMainRecords } from "../../services/purge-deleted-records.service.js";
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

export default router;
