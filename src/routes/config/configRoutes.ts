import { Router, type Request, type Response, type IRouter } from "express";

const router: IRouter = Router();

/**
 * GET /api/config/client
 * Returns client-side configuration (Socket.IO URL, etc.)
 * No authentication required - this is for initial client setup
 */
router.get("/client", (req: Request, res: Response) => {
  const protocol = req.protocol; // http or https
  const host = req.get("host"); // e.g., "api.example.com:4000" or "localhost:4000"
  
  // Construct the Socket.IO server URL based on the request
  // This ensures the client connects to the correct backend server
  const socketUrl = `${protocol}://${host}`;
  
  // Allow override via environment variable (useful for proxy/load balancer setups)
  const configuredSocketUrl = process.env.SOCKET_IO_URL || socketUrl;

  res.json({
    success: true,
    config: {
      socketUrl: configuredSocketUrl,
    },
  });
});

export default router;
