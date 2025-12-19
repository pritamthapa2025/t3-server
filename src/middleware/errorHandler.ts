import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { isDatabaseError, parseDatabaseError } from "../utils/database-error-parser.js";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log detailed error information with request context
  logger.logApiError("API Error occurred", err, req);

  // Handle database errors with human-readable messages
  if (isDatabaseError(err)) {
    const parsedError = parseDatabaseError(err);
    
    return res.status(parsedError.statusCode).json({
      success: false,
      message: parsedError.userMessage,
      errorCode: parsedError.errorCode,
      suggestions: parsedError.suggestions,
      technicalDetails: process.env.NODE_ENV === "development" 
        ? parsedError.technicalMessage 
        : undefined,
    });
  }

  // Default error
  let statusCode = 500;
  let message = "Internal server error";

  // Handle specific error types
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = err.message;
  } else if (err.name === "UnauthorizedError") {
    statusCode = 401;
    message = "Unauthorized";
  } else if (err.message) {
    message = err.message;
  }

  // Don't leak error details in production unless it's a known error
  const errorResponse: { 
    success: boolean; 
    message: string; 
    stack?: string;
    technicalDetails?: string;
  } = {
    success: false,
    message,
  };

  // Include stack trace and technical details in development
  if (process.env.NODE_ENV === "development") {
    if (err.stack) {
      errorResponse.stack = err.stack;
    }
    if (err.message) {
      errorResponse.technicalDetails = err.message;
    }
  }

  res.status(statusCode).json(errorResponse);
};
