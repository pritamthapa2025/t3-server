import redis from "../config/redis.js";

const PREFIX = "jwt:bl:";

/**
 * Add a token's jti to the Redis blacklist.
 * TTL is set to the token's remaining validity so the key self-expires
 * exactly when the token would have expired naturally — no manual cleanup needed.
 */
export const blacklistToken = async (jti: string, exp: number): Promise<void> => {
  const ttl = exp - Math.floor(Date.now() / 1000);
  if (ttl <= 0) return; // already expired — no need to store
  await redis.setex(`${PREFIX}${jti}`, ttl, "1");
};

/**
 * Returns true if the jti has been blacklisted (i.e. the token was revoked).
 */
export const isTokenBlacklisted = async (jti: string): Promise<boolean> => {
  return (await redis.exists(`${PREFIX}${jti}`)) === 1;
};
