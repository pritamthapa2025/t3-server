import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import index from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { cacheHeaders } from "./middleware/cacheHeaders.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// Tell Express to trust the first proxy (EasyPanel/Traefik).
// This makes req.ip return the real client IP from X-Forwarded-For
// instead of the proxy's IP, while ignoring attacker-injected headers
// further down the chain.
app.set("trust proxy", 1);

// Gzip/deflate compression for all API responses — reduces payload size significantly
app.use(compression());

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  process.env.CLIENT_URL,
  process.env.CLIENT_URL_Old,
].filter((url): url is string => Boolean(url));

const CORS_OPTIONS = {
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cookie",
    "X-Requested-With",
  ],
  exposedHeaders: ["Set-Cookie"],
};

// Handle OPTIONS preflight BEFORE helmet so security headers don't interfere.
// This ensures the browser receives CORS headers on preflight even if a
// subsequent middleware would otherwise block the response.
app.options(/(.*)/, cors(CORS_OPTIONS));

// Security headers — must come before routes but after the preflight handler
app.use(
  helmet({
    // Allow same-origin framing only (EasyPanel dashboard, etc.)
    frameguard: { action: "sameorigin" },
    // CSP: API-only server, no browser rendering needed — restrict everything
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'none'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    // HSTS: enforce HTTPS for 1 year in production
    strictTransportSecurity:
      process.env.NODE_ENV === "production"
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
    // Allow cross-origin fetch (Axios) — CORP same-origin blocks API responses
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(cors(CORS_OPTIONS));

// Block dangerous HTTP methods that are not needed by this API
app.use((req, res, next) => {
  if (req.method === "TRACE" || req.method === "CONNECT") {
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }
  return next();
});

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

app.use(globalLimiter);

// Serve static assets (e.g. email logo images)
app.use("/assets", express.static(path.join(__dirname, "templates", "assets")));

// Health check endpoint (before routes) - must be fast and always return 200
// Docker/process managers use this to check if server is alive
app.get("/health", (req, res) => {
  // Always return 200 immediately - server is alive if it can respond
  // Don't check DB/Redis here as it can timeout and cause health checks to fail
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// Apply cache-control headers to all API routes
app.use("/api/v1", cacheHeaders);
app.use("/api/v1", index);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
