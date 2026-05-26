import redis from "../config/redis.js";
import { blacklistToken } from "./tokenBlacklist.js";
import { removeSessionActivity } from "./sessionActivity.js";
import { logger } from "./logger.js";

const PREFIX = "user:sessions:";

/**
 * Register a new session for a user.
 * Stores jti → exp_unix_timestamp in a Redis Hash keyed by userId.
 * Called after every successful token issuance (login trusted-device path, verify-2FA).
 */
export async function registerSession(
  userId: string,
  jti: string,
  exp: number,
): Promise<void> {
  try {
    await redis.hset(`${PREFIX}${userId}`, jti, String(exp));
  } catch {
    logger.warn("Redis unavailable — session not registered in store", {
      userId,
      jti,
    });
  }
}

/**
 * Remove a single session from the registry (called on logout).
 */
export async function removeSession(
  userId: string,
  jti: string,
): Promise<void> {
  try {
    await redis.hdel(`${PREFIX}${userId}`, jti);
  } catch {
    logger.warn("Redis unavailable — session not removed from store", {
      userId,
      jti,
    });
  }
}

/**
 * Revoke all active sessions for a user.
 * Blacklists every registered JTI and clears the session registry.
 * Called on password change, password reset, account suspension, and role change.
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  try {
    const sessions = await redis.hgetall(`${PREFIX}${userId}`);
    if (!sessions || Object.keys(sessions).length === 0) return;

    await Promise.allSettled(
      Object.entries(sessions).map(([jti, expStr]) => {
        const exp = parseInt(expStr, 10);
        return Promise.allSettled([
          blacklistToken(jti, exp),
          removeSessionActivity(jti),
        ]);
      }),
    );

    await redis.del(`${PREFIX}${userId}`);
    logger.info("All sessions revoked for user", {
      userId,
      count: Object.keys(sessions).length,
    });
  } catch {
    logger.warn("Redis unavailable — sessions not revoked", { userId });
  }
}
