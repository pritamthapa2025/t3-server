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
