import jwt, { type SignOptions } from "jsonwebtoken";

// JWT secret key (should be stored in .env)
const JWT_SECRET =
  process.env.JWT_SECRET ||
  "e8f6c1bcf9bc4eae8c2eaa9c14401d44d8f76847b82d6f75bb1e50fd0388a580fd73c05411cf64c9e194dfd7178b87fae8018e528440f6fbd0e524a11883f77b";

// Generate JWT token for a user
export const generateToken = (userId: string, expiresIn: string = "7d") => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn } as SignOptions);
};

// Verify JWT token
export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null; // Invalid token
  }
};
