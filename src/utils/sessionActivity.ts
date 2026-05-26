import redis from "../config/redis.js";
import { logger } from "./logger.js";

const IDLE_TIMEOUT_S = 60 * 60; // 60 minutes
const SESSION_TTL_S = 12 * 60 * 60; // 12 hours — matches JWT absolute expiry
const PREFIX = "session:activity:";

/**
 * Record (or refresh) the last-activity timestamp for a session.
 * Called on every authenticated request so the idle window slides forward.
 * TTL is set to the JWT's absolute lifetime so keys self-expire.
 */
export async function touchSession(jti: string): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000);
    await redis.setex(`${PREFIX}${jti}`, SESSION_TTL_S, String(now));
  } catch {
    logger.warn("Redis unavailable — session activity not recorded", { jti });
  }
}

/**
 * Returns true if the session has been idle for longer than IDLE_TIMEOUT_S.
 * A missing key (never touched) is treated as not idle so the first request
 * after login initialises the key via touchSession.
 */
export async function isSessionIdle(jti: string): Promise<boolean> {
  try {
    const raw = await redis.get(`${PREFIX}${jti}`);
    if (raw === null) {
      // Key absent — first request after login; not yet idle.
      return false;
    }
    const lastActivity = parseInt(raw, 10);
    const now = Math.floor(Date.now() / 1000);
    return now - lastActivity > IDLE_TIMEOUT_S;
  } catch {
    logger.warn("Redis unavailable — skipping idle check (fail-open)", { jti });
    return false; // fail-open: never block requests due to Redis being down
  }
}

/**
 * Remove the activity key for a session (called on logout).
 */
export async function removeSessionActivity(jti: string): Promise<void> {
  try {
    await redis.del(`${PREFIX}${jti}`);
  } catch {
    logger.warn("Redis unavailable — session activity key not removed", { jti });
  }
}
