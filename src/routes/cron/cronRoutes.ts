import { Router, type Request, type Response, type NextFunction, type IRouter } from "express";
import { expireExpiredBids } from "../../services/bid.service.js";
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

export default router;
