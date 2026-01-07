import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import index from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      process.env.CLIENT_URL || "http://localhost:3000",
      process.env.CLIENT_URL_Old,
    ].filter((url): url is string => Boolean(url)),
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check endpoint (before routes)
app.get("/health", async (req, res) => {
  try {
    // Quick database health check
    const { pool } = await import("./config/db.js");
    let dbStatus = "unknown";
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      dbStatus = "connected";
    } catch (error) {
      dbStatus = "disconnected";
      console.error("Health check: Database connection failed:", error);
    }

    const health = {
      status: dbStatus === "connected" ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: dbStatus,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };

    const statusCode = health.status === "ok" ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error("Health check error:", error);
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.use("/api/v1", index);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
