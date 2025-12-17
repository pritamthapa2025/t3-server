import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not set in .env file");
}

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    // Retry with exponential backoff, max 3 retries
    if (times > 3) {
      return null; // Stop retrying after 3 attempts
    }
    return Math.min(times * 200, 2000); // 200ms, 400ms, 600ms, max 2000ms
  },
  enableReadyCheck: true,
  lazyConnect: true, // Don't connect immediately - connect on first use
  connectTimeout: 10000, // Increased to 10 seconds
  commandTimeout: 5000, // Increased to 5 seconds
  keepAlive: 30000,
  enableOfflineQueue: true, // Queue commands when offline
  showFriendlyErrorStack: true,
});

redis.on("error", (err: Error) => {
  // Only log errors, don't crash the application
  // Redis is used for 2FA codes, so the app can still function without it
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
// This allows the server to start even if Redis is unavailable
redis.connect().catch((err) => {
  console.warn("⚠️ Redis initial connection failed (will retry on first use):", err.message);
});

export default redis;
