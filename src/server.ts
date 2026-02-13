import http from "http";
import app from "./app.js";
import { initDB, pool } from "./config/db.js";
import redis from "./config/redis.js";
import { setupSocketIO } from "./config/socket.js";
import { closeQueue } from "./queues/notification.queue.js";
import dotenv from "dotenv";

dotenv.config();

// Validate critical environment variables before starting
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set!");
  process.exit(1);
}

if (!process.env.REDIS_URL) {
  console.error("❌ REDIS_URL environment variable is not set!");
  console.error(
    "Redis is required for 2FA, password reset, email change features, and Socket.IO notifications.",
  );
  process.exit(1);
}

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    console.log("HTTP server closed");

    try {
      // Close notification queue
      await closeQueue();
      console.log("Notification queue closed");
    } catch (error) {
      console.error("Error closing notification queue:", error);
    }

    try {
      // Close database connection pool
      await pool.end();
      console.log("Database connection pool closed");
    } catch (error) {
      console.error("Error closing database pool:", error);
    }

    try {
      // Close Redis connection (only if connected)
      if (redis.status !== "end") {
        await redis.quit();
        console.log("Redis connection closed");
      }
    } catch (error) {
      console.error("Error closing Redis connection:", error);
    }

    console.log("Graceful shutdown completed");
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: Error | unknown) => {
  const errorMessage =
    reason instanceof Error ? reason.message : String(reason);
  console.error("❌ Unhandled Rejection:", errorMessage);
  if (reason instanceof Error && reason.stack) {
    console.error(reason.stack);
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown("SIGTERM");
});

// Handle termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Initialize database connection before starting server
initDB()
  .then(async () => {
    // Initialize Socket.IO for real-time notifications
    await setupSocketIO(server);
    console.log("✅ Socket.IO initialized successfully");

    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`✅ REST API: http://localhost:${PORT}/api/v1`);
      console.log(`✅ Socket.IO: ws://localhost:${PORT}`);
    });

    // Handle server errors
    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.syscall !== "listen") {
        throw error;
      }

      const bind = typeof PORT === "string" ? `Pipe ${PORT}` : `Port ${PORT}`;

      switch (error.code) {
        case "EACCES":
          console.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case "EADDRINUSE":
          console.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
