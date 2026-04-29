import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// Redis is required for 2FA, password reset, and email change features
if (!process.env.REDIS_URL) {
  console.error("❌ REDIS_URL environment variable is not set!");
  console.error(
    "Redis is required for 2FA, password reset, and email change features."
  );
  console.error(
    "Please set REDIS_URL in your .env file or environment variables."
  );
  console.error("Example: REDIS_URL=redis://localhost:6379");
  process.exit(1);
}

// Create Redis instance
const redis = new Redis(process.env.REDIS_URL, {
  // Fail fast: if Redis is down, reject the command immediately rather than
  // queueing indefinitely. Auth middleware catches the error and falls back
  // gracefully (treat token as not blacklisted).
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => {
    if (times > 3) {
      return null; // Stop retrying after 3 attempts
    }
    return Math.min(times * 200, 2000); // 200ms, 400ms, 600ms, max 2000ms
  },
  enableReadyCheck: true,
  lazyConnect: true,
  connectTimeout: 5000,
  commandTimeout: 3000, // Fail commands quickly so auth doesn't hang
  keepAlive: 30000,
  enableOfflineQueue: false, // Reject commands immediately when offline
  showFriendlyErrorStack: true,
  enableAutoPipelining: false,
});

redis.on("error", (err: Error) => {
  console.error("❌ Redis Error:", err.message);
});

redis.on("connect", () => {
  console.log("✅ Redis connected");
});

redis.on("ready", () => {
  console.log("✅ Redis ready");
});

redis.on("close", () => {
  console.warn("⚠️ Redis connection closed");
});

redis.on("reconnecting", () => {
  console.log("🔄 Redis reconnecting...");
});

// Attempt to connect in the background (non-blocking)
redis.connect().catch((err: Error) => {
  console.warn(
    "⚠️ Redis initial connection failed (will retry on first use):",
    err.message
  );
});

export default redis;
