import { Router, type Request, type Response, type IRouter } from "express";

const router: IRouter = Router();

/**
 * GET /api/config/client
 * Returns client-side configuration (Socket.IO URL, etc.)
 * No authentication required - this is for initial client setup
 */
router.get("/client", (req: Request, res: Response) => {
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol =
    forwardedProto && ["http", "https"].includes(forwardedProto)
      ? forwardedProto
      : req.protocol;
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.get("host") || "localhost";

  const socketUrl = `${protocol}://${host}`;

  const configuredSocketUrl = process.env.SOCKET_IO_URL || socketUrl;

  res.json({
    success: true,
    config: {
      socketUrl: configuredSocketUrl,
    },
  });
});

export default router;
