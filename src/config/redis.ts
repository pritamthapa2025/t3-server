import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// Make Redis optional - don't crash if REDIS_URL is not set
if (!process.env.REDIS_URL) {
  // Silent - no warning needed if Redis is intentionally disabled
}

// Create a dummy Redis instance if REDIS_URL is not set
const redis = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL, {
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
})
  : ({
      // Dummy Redis instance with no-op methods when REDIS_URL is not set
      get: async () => null,
      set: async () => "OK",
      del: async () => 0,
      exists: async () => 0,
      expire: async () => 0,
      quit: async () => "OK",
      connect: async () => {},
      status: "end" as const,
    } as unknown as Redis);

if (process.env.REDIS_URL) {
  // Enhanced error logging with debug information
  redis.on("error", (err: Error) => {
    console.error("❌ Redis Error:", err.message);
    console.error("   Error Code:", (err as any).code);
    console.error("   Error Type:", err.constructor.name);
    if ((err as any).command) {
      console.error("   Failed Command:", (err as any).command.name, (err as any).command.args);
    }
    if (err.stack) {
      console.error("   Stack:", err.stack);
    }
  });

  redis.on("connect", () => {
    console.log("✅ Redis connected");
  });

  redis.on("ready", () => {
    console.log("✅ Redis ready");
  });

  redis.on("close", () => {
    console.warn("⚠️ Redis connection closed");
    console.warn("   Debug: Connection was closed. Redis will attempt to reconnect on next use.");
  });

  redis.on("reconnecting", (delay: number) => {
    console.log(`🔄 Redis reconnecting in ${delay}ms...`);
  });

  redis.on("end", () => {
    console.warn("⚠️ Redis connection ended");
    console.warn("   Debug: Connection ended. No automatic reconnection will occur.");
  });

  // Attempt to connect in the background (non-blocking)
  redis.connect().catch((err: Error) => {
    console.error("❌ Redis initial connection failed:");
    console.error("   Error:", err.message);
    console.error("   Error Code:", (err as any).code);
    console.error("   Redis URL:", process.env.REDIS_URL?.replace(/:[^:@]+@/, ":****@") || "not set");
    console.error("   Debug: Server will continue without Redis. Redis will retry on first use.");
  });
}

export default redis;
