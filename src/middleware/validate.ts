import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import { ZodError } from "zod";
import { logger } from "../utils/logger.js";

export const validate = (schema: ZodType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Update request with validated and transformed values
      // Note: req.query and req.params are read-only in Express, so we only update req.body
      // Type assertion is safe here because Zod has already validated the structure
      const result = validated as {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };

      if (result.body !== undefined) {
        req.body = result.body;
      }
      // req.query and req.params are read-only, so we validate but don't reassign
      // The validation ensures they're correct, but we can't modify them

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));

        // Log validation error
        logger.logApiError("Validation error", error, req);

        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors,
        });
      }

      // Log unexpected error in validation middleware
      logger.logApiError(
        "Unexpected error in validation middleware",
        error,
        req
      );

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
};
