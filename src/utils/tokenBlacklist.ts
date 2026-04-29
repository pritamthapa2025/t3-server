import redis from "../config/redis.js";
import { logger } from "./logger.js";

const PREFIX = "jwt:bl:";

/**
 * Add a token's jti to the Redis blacklist.
 * TTL is set to the token's remaining validity so the key self-expires
 * exactly when the token would have expired naturally — no manual cleanup needed.
 * Fails silently when Redis is unavailable.
 */
export const blacklistToken = async (jti: string, exp: number): Promise<void> => {
  const ttl = exp - Math.floor(Date.now() / 1000);
  if (ttl <= 0) return; // already expired — no need to store
  try {
    await redis.setex(`${PREFIX}${jti}`, ttl, "1");
  } catch {
    logger.warn("Redis unavailable — token blacklist entry not stored", { jti });
  }
};

/**
 * Returns true if the jti has been blacklisted (i.e. the token was revoked).
 * Returns false (fail-open) when Redis is unavailable so auth requests are
 * never blocked by a Redis outage.
 */
export const isTokenBlacklisted = async (jti: string): Promise<boolean> => {
  try {
    return (await redis.exists(`${PREFIX}${jti}`)) === 1;
  } catch {
    logger.warn("Redis unavailable — skipping token blacklist check", { jti });
    return false; // fail-open: let the request through
  }
};
