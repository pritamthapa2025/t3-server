import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not set in .env file");
}

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: () => null,
  enableReadyCheck: true,
  lazyConnect: false,
  connectTimeout: 3000,
  commandTimeout: 300,
  keepAlive: 30000,
  enableOfflineQueue: false,
});

redis.on("error", (err: Error) => {
  console.error("❌ Redis Error:", err.message);
});

redis.on("connect", () => {
  // Connection successful - log removed
});

redis.on("ready", () => {
  // Redis ready - log removed
});

// Test Redis connection on startup (wait for ready state to avoid errors)
redis.once("ready", () => {
  redis.ping().catch((err) => {
    console.warn("⚠️ Redis ping failed:", err.message);
  });
});

export default redis;
