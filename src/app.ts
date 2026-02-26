import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import index from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { globalLimiter } from "./middleware/rateLimiter.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// Tell Express to trust the first proxy (EasyPanel/Traefik).
// This makes req.ip return the real client IP from X-Forwarded-For
// instead of the proxy's IP, while ignoring attacker-injected headers
// further down the chain.
app.set("trust proxy", 1);

// Security headers — must come before CORS and routes
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
    strictTransportSecurity: process.env.NODE_ENV === "production"
      ? { maxAge: 31536000, includeSubDomains: true }
      : false,
  }),
);

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      process.env.CLIENT_URL || "http://localhost:3000",
      process.env.CLIENT_URL_Old,
    ].filter((url): url is string => Boolean(url)),
    credentials: true,
  }),
);

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


app.use("/api/v1", index);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
