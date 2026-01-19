import type { Request } from "express";
import { isDatabaseError, formatErrorForLogging } from "./database-error-parser.js";

type LogLevel = "error" | "warn" | "info" | "debug";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString();
    
    if (!context) {
      return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }

    // Stringify the context first
    let contextStr = JSON.stringify(context, null, 2);
    
    // Replace escaped newlines (\n) with actual newlines in the JSON string
    // This handles error messages and stack traces that contain newlines
    contextStr = contextStr.replace(/\\n/g, '\n');
    
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${contextStr}`;
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext: LogContext = { ...context };

    if (error instanceof Error) {
      errorContext.errorName = error.name;
      
      // Capture PostgreSQL/Database specific error details (but not verbose messages/stacks)
      const dbError = error as any;
      if (dbError.code) {
        errorContext.errorCode = dbError.code;
      }
      if (dbError.detail) {
        errorContext.errorDetail = dbError.detail;
      }
      if (dbError.constraint) {
        errorContext.constraint = dbError.constraint;
      }
      if (dbError.table) {
        errorContext.table = dbError.table;
      }
      if (dbError.column) {
        errorContext.column = dbError.column;
      }
      if (dbError.severity) {
        errorContext.severity = dbError.severity;
      }
      if (dbError.hint) {
        errorContext.hint = dbError.hint;
      }
      if (dbError.position) {
        errorContext.position = dbError.position;
      }
      if (dbError.internalPosition) {
        errorContext.internalPosition = dbError.internalPosition;
      }
      if (dbError.internalQuery) {
        errorContext.internalQuery = dbError.internalQuery;
      }
      if (dbError.where) {
        errorContext.where = dbError.where;
      }
      if (dbError.schema) {
        errorContext.schema = dbError.schema;
      }
      if (dbError.dataType) {
        errorContext.dataType = dbError.dataType;
      }
      
      // Check if error has a cause (nested error) - drizzle often wraps errors
      // Only capture essential error details, not verbose messages
      if (dbError.cause) {
        const cause = dbError.cause;
        if (cause?.code) {
          errorContext.causeErrorCode = cause.code;
        }
        if (cause?.detail) {
          errorContext.causeErrorDetail = cause.detail;
        }
        if (cause?.constraint) {
          errorContext.causeConstraint = cause.constraint;
        }
        if (cause?.table) {
          errorContext.causeTable = cause.table;
        }
        if (cause?.column) {
          errorContext.causeColumn = cause.column;
        }
      }
    } else if (error) {
      errorContext.error = error;
    }

    console.error(this.formatMessage("error", message, errorContext));
    
    // If it's a database error, also log the human-readable version
    if (isDatabaseError(error)) {
      console.error("\n" + formatErrorForLogging(error) + "\n");
    }
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage("warn", message, context));
  }

  info(message: string, context?: LogContext): void {
    console.info(this.formatMessage("info", message, context));
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  /**
   * Log error with request context - useful in controllers
   */
  logApiError(message: string, error: Error | unknown, req: Request): void {
    const context: LogContext = {
      method: req.method,
      url: req.originalUrl || req.url,
      path: req.path,
      query: req.query,
      body: this.sanitizeBody(req.body),
      params: req.params,
    };

    this.error(message, error, context);
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== "object") {
      return body;
    }

    const sanitized = { ...body } as Record<string, unknown>;
    const sensitiveFields = [
      "password",
      "passwordHash",
      "token",
      "secret",
      "apiKey",
      "authorization",
    ];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = "[REDACTED]";
      }
    }

    return sanitized;
  }
}

export const logger = new Logger();
export default logger;
