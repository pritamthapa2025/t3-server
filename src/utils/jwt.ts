import jwt, { type SignOptions, type JwtPayload } from "jsonwebtoken";
import { randomUUID } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

export const generateToken = (userId: string, expiresIn: string = "7d") => {
  return jwt.sign({ userId, jti: randomUUID() }, JWT_SECRET, { expiresIn } as SignOptions);
};

export const verifyToken = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "string") return null;
    return decoded;
  } catch {
    return null;
  }
};

/** Sign an arbitrary payload with a custom expiry using the validated JWT_SECRET. */
export const signPayload = (
  payload: Record<string, unknown>,
  expiresIn: string,
): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as SignOptions);
};

/**
 * Verify a token and return its decoded payload.
 * Throws a JsonWebTokenError / TokenExpiredError on failure
 * (callers are expected to have a try/catch).
 */
export const verifyPayload = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (typeof decoded === "string") {
    throw new Error("Unexpected string payload in JWT");
  }
  return decoded;
};
