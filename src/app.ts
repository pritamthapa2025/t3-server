import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import index from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
