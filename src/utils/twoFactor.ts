import crypto, { timingSafeEqual } from "crypto";
import redisClient from "../config/redis.js";
import dotenv from "dotenv";

dotenv.config();

// Encryption key for 2FA codes (32 bytes for AES-256)
const ENCRYPTION_KEY =
  process.env.TWO_FA_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits

// Ensure encryption key is 32 bytes
const getEncryptionKey = (): Buffer => {
  const key =
    ENCRYPTION_KEY.length === 64
      ? Buffer.from(ENCRYPTION_KEY, "hex")
      : crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
  return key;
};

// Encrypt the 2FA code before storing
const encryptCode = (code: string): string => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(code, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Return IV + AuthTag + Encrypted data (all hex encoded)
  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
};

// Decrypt the 2FA code from Redis
const decryptCode = (encryptedData: string): string | null => {
  try {
    const parts = encryptedData.split(":");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;

    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    const final = decipher.final("utf8");
    decrypted += final;

    return decrypted;
  } catch {
    return null;
  }
};

// Generate a cryptographically secure random 6-digit 2FA code
export const generate2FACode = (): string => {
  // Map to 6-digit range (100000-999999)
  const min = 100000;
  const max = 999999;
  const range = max - min + 1; // 900000
  const maxValid = Math.floor(0xffffff / range) * range; // 16200000

  // Rejection sampling to avoid bias
  // Generate 3 random bytes (24 bits) until we get a value in valid range
  let code: number;
  do {
    const bytes = crypto.randomBytes(3);
    code = bytes.readUIntBE(0, 3);
  } while (code >= maxValid);

  return ((code % range) + min).toString();
};

const OTP_TTL = 300; // 5 minutes in seconds
const MAX_OTP_ATTEMPTS = 5;

const attemptsKey = (key: string) => `otp_attempts:${key}`;

// Store the generated 2FA code in Redis with encryption and 5-minute expiry.
// Clears any existing attempt counter so the user gets a fresh start.
export const store2FACode = async (key: string, code: string) => {
  const encryptedCode = encryptCode(code);
  await Promise.all([
    redisClient.setex(key, OTP_TTL, encryptedCode),
    redisClient.del(attemptsKey(key)),
  ]);
};

// Delete the 2FA code and its attempt counter from Redis (used when resending).
export const delete2FACode = async (key: string): Promise<void> => {
  await Promise.all([
    redisClient.del(key),
    redisClient.del(attemptsKey(key)),
  ]);
};

export type OTPVerifyResult = "valid" | "invalid" | "locked";

/**
 * Verify the provided OTP against the encrypted value stored in Redis.
 *
 * Returns:
 *   "valid"   — code matched; OTP and attempt counter deleted (one-time use).
 *   "invalid" — code did not match; attempt counter incremented.
 *   "locked"  — MAX_OTP_ATTEMPTS exceeded; OTP deleted, user must request a new one.
 */
export const verify2FACode = async (
  key: string,
  code: string
): Promise<OTPVerifyResult> => {
  const normalizedCode = String(code).trim();

  const encryptedCode = await redisClient.get(key);
  if (!encryptedCode) {
    return "invalid"; // expired or never existed
  }

  const storedCode = decryptCode(encryptedCode);
  if (!storedCode) {
    return "invalid"; // corrupted data
  }

  const storedBuf = Buffer.from(storedCode);
  const inputBuf = Buffer.from(normalizedCode);
  const match =
    storedBuf.length === inputBuf.length &&
    timingSafeEqual(storedBuf, inputBuf);

  if (match) {
    // Correct — delete OTP and attempt counter
    await Promise.all([
      redisClient.del(key),
      redisClient.del(attemptsKey(key)),
    ]);
    return "valid";
  }

  // Wrong code — increment attempt counter
  const attempts = await redisClient.incr(attemptsKey(key));
  // Keep the counter alive for the same window as the OTP
  await redisClient.expire(attemptsKey(key), OTP_TTL);

  if (attempts >= MAX_OTP_ATTEMPTS) {
    // Burn the OTP so the attacker can't keep trying with a fresh counter
    await Promise.all([
      redisClient.del(key),
      redisClient.del(attemptsKey(key)),
    ]);
    return "locked";
  }

  return "invalid";
};
