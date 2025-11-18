import crypto from "crypto";
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
  } catch (error) {
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

// Store the generated 2FA code in Redis with encryption and 5-minute expiry
export const store2FACode = async (email: string, code: string) => {
  // Encrypt the code before storing
  const encryptedCode = encryptCode(code);
  await redisClient.setex(email, 300, encryptedCode); // Expiry in 5 minutes (300 seconds)
};

// Delete the 2FA code from Redis (used when resending)
export const delete2FACode = async (email: string): Promise<void> => {
  await redisClient.del(email);
};

// Verify the provided 2FA code against the encrypted one stored in Redis
export const verify2FACode = async (
  email: string,
  code: string
): Promise<boolean> => {
  // Retrieve the encrypted code from Redis
  const encryptedCode = await redisClient.get(email);

  if (!encryptedCode) {
    // Code not found (expired or invalid email)
    return false;
  }

  // Decrypt the stored code
  const storedCode = decryptCode(encryptedCode);

  if (!storedCode) {
    // Decryption failed (corrupted data)
    return false;
  }

  // Compare codes
  if (storedCode === code) {
    // Remove the code from Redis once it's verified (one-time use)
    await redisClient.del(email);
    return true;
  }

  return false;
};
