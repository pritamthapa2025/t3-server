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
    const contextStr = context ? ` ${JSON.stringify(context, null, 2)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext: LogContext = { ...context };

    if (error instanceof Error) {
      errorContext.errorName = error.name;
      errorContext.errorMessage = error.message;
      errorContext.errorStack = error.stack;
      
      // Capture PostgreSQL/Database specific error details
      if ((error as any).code) {
        errorContext.errorCode = (error as any).code;
      }
      if ((error as any).detail) {
        errorContext.errorDetail = (error as any).detail;
      }
      if ((error as any).constraint) {
        errorContext.constraint = (error as any).constraint;
      }
      if ((error as any).table) {
        errorContext.table = (error as any).table;
      }
      if ((error as any).column) {
        errorContext.column = (error as any).column;
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
