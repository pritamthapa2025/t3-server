import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import { ZodError } from "zod";

export const validate = (schema: ZodType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Update request with validated and transformed values
      // Type assertion is safe here because Zod has already validated the structure
      const result = validated as {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };

      if (result.body !== undefined) {
        req.body = result.body;
      }
      if (result.query !== undefined) {
        req.query = result.query as typeof req.query;
      }
      if (result.params !== undefined) {
        req.params = result.params as typeof req.params;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors,
        });
      }
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
};
