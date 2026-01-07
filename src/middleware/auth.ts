import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";
import { getUserByIdForAuth } from "../services/auth.service.js";
import { logger } from "../utils/logger.js";

// Simple in-memory cache for user auth data
// Configurable via environment variables
interface CachedUser {
  user: Awaited<ReturnType<typeof getUserByIdForAuth>>;
  expiresAt: number;
}

const authCache = new Map<string, CachedUser>();
const CACHE_TTL = parseInt(process.env.AUTH_CACHE_TTL || '300000', 10); // Default 5 minutes (300000ms)
// Max cache size: ~10,000 users ≈ 5 MB (assuming ~500 bytes per user entry)
const MAX_CACHE_SIZE = parseInt(process.env.AUTH_CACHE_MAX_SIZE || '10000', 10); // ~5 MB limit
const CACHE_ENABLED = process.env.AUTH_CACHE_ENABLED !== 'false'; // Default enabled

// Clean up expired cache entries periodically
setInterval(() => {
  if (!CACHE_ENABLED) return;
  
  const now = Date.now();
  let cleaned = 0;
  for (const [key, cached] of authCache.entries()) {
    if (cached.expiresAt < now) {
      authCache.delete(key);
      cleaned++;
    }
  }
  
  // If cache is too large, remove oldest entries (LRU-like cleanup)
  if (authCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(authCache.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toRemove = authCache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < toRemove; i++) {
      authCache.delete(entries[i]![0]!);
    }
  }
}, 60 * 1000); // Clean up every minute

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message:
          "Authorization denied. Please provide a valid authentication token.",
      });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
      return res.status(401).json({
        success: false,
        message: "Authorization denied. Invalid token format.",
      });
    }

    const token = parts[1].trim();

    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded || typeof decoded === "string") {
      return res.status(401).json({
        success: false,
        message: "Authorization denied. Invalid or expired token.",
      });
    }

    // Extract userId from decoded token
    const userId = (decoded as { userId: string }).userId;
    if (!userId || typeof userId !== "string") {
      return res.status(401).json({
        success: false,
        message: "Authorization denied. Invalid token.",
      });
    }

    // Check cache first (if enabled)
    let user: Awaited<ReturnType<typeof getUserByIdForAuth>> | null;
    let dbTime = 0;

    if (CACHE_ENABLED) {
      const cached = authCache.get(userId);
      if (cached && cached.expiresAt > Date.now()) {
        // Use cached user
        user = cached.user;
        console.log(`✅ Auth: from cache`);
      } else {
        // Fetch user from database
        const dbStart = Date.now();
        user = await getUserByIdForAuth(userId);
        dbTime = Date.now() - dbStart;

        if (user) {
          // Cache the user data (only if under max size)
          if (authCache.size < MAX_CACHE_SIZE) {
            authCache.set(userId, {
              user,
              expiresAt: Date.now() + CACHE_TTL,
            });
          }
          console.log(`✅ Auth: from db (${dbTime}ms)`);
        }
      }
    } else {
      // Cache disabled - always fetch from DB
      const dbStart = Date.now();
      user = await getUserByIdForAuth(userId);
      dbTime = Date.now() - dbStart;
      console.log(`✅ Auth: from db (${dbTime}ms)`);
    }

    if (!user) {
      // Remove from cache if user not found
      if (CACHE_ENABLED) {
        authCache.delete(userId);
      }
      return res.status(401).json({
        success: false,
        message: "Authorization denied. User not found.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Your account is inactive.",
      });
    }

    // Check if user is deleted (handle null as not deleted)
    if (user.isDeleted === true) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Your account has been deleted.",
      });
    }

    // Attach user info to request object
    req.user = {
      id: user.id,
      ...(user.email && { email: user.email }),
      // For T3 internal operations - use a default org ID or the user's employee context
      organizationId: process.env.T3_ORGANIZATION_ID || "t3-org-default",
      ...(user.employeeId && { employeeId: user.employeeId }),
    };

    // Proceed to next middleware/route handler
    next();
  } catch (error) {
    logger.logApiError("Authentication error", error, req);
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};
