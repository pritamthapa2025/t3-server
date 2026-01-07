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
  maxRetriesPerRequest: null, // Allow unlimited retries per request
  retryStrategy: (times) => {
    // Retry with exponential backoff, max 3 retries
    if (times > 3) {
      return null; // Stop retrying after 3 attempts
    }
    return Math.min(times * 200, 2000); // 200ms, 400ms, 600ms, max 2000ms
  },
  enableReadyCheck: true,
  lazyConnect: true, // Don't connect immediately - connect on first use
  connectTimeout: 10000, // 10 seconds
  commandTimeout: 5000, // 5 seconds
  keepAlive: 30000,
  enableOfflineQueue: true, // Queue commands when offline
  showFriendlyErrorStack: true,
  enableAutoPipelining: false, // Disable to avoid pipelining issues
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
