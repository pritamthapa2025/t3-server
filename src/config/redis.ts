import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not set in .env file");
}

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: () => null,
});

redis.on("error", (err: Error) => {
  console.error("❌ Redis Error:", err.message);
});

redis.on("connect", () => {
  console.log("✅ Redis connected successfully");
});

export default redis;
