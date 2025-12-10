import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";
import { getUserByIdForAuth, getUserOrganizationId } from "../services/auth.service.js";

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

    // Fetch user from database
    const dbStart = Date.now();
    const user = await getUserByIdForAuth(userId);
    const dbTime = Date.now() - dbStart;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authorization denied. User not found.",
      });
    }

    console.log(`✅ Auth: from db (${dbTime}ms)`);

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

    // Get user's organization ID
    const organizationId = await getUserOrganizationId(user.id);

    // Attach user info to request object
    req.user = {
      id: user.id,
      ...(user.email && { email: user.email }),
      ...(organizationId && { organizationId }),
    };

    // Proceed to next middleware/route handler
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};
