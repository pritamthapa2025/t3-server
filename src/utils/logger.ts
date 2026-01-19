import type { Request } from "express";
import { isDatabaseError, formatErrorForLogging } from "./database-error-parser.js";

/**
 * Format general (non-database) errors with helpful context
 */
function formatGeneralError(error: Error): string {
  const lines = [
    `   Error Type: ${error.name}`,
    `   Message: ${error.message}`,
  ];

  // Extract stack trace and show relevant parts
  if (error.stack) {
    const stackLines = error.stack.split('\n').slice(0, 10); // First 10 lines of stack
    if (stackLines.length > 1) {
      lines.push("");
      lines.push("📍 STACK TRACE:");
      stackLines.slice(1).forEach((line, index) => {
        // Clean up the stack trace for readability
        const cleaned = line.trim().replace(/file:\/\/\/app\//g, '').replace(/C:\\Users\\[^\\]+\\Desktop\\t3-server\\/g, '');
        lines.push(`   ${index + 1}. ${cleaned}`);
      });
    }
  }

  // Try to extract useful information from common error patterns
  if (error.message.includes("Cannot convert undefined or null to object")) {
    lines.push("");
    lines.push("💡 LIKELY CAUSE:");
    lines.push("   A null or undefined value was passed where an object was expected.");
    lines.push("   Common causes:");
    lines.push("   - Accessing properties on null/undefined");
    lines.push("   - Passing null to functions expecting objects");
    lines.push("   - Drizzle ORM trying to process undefined table/column references");
  } else if (error.message.includes("Cannot read property")) {
    lines.push("");
    lines.push("💡 LIKELY CAUSE:");
    lines.push("   Attempted to access a property on null/undefined.");
  } else if (error.message.includes("is not a function")) {
    lines.push("");
    lines.push("💡 LIKELY CAUSE:");
    lines.push("   Called a method that doesn't exist or is undefined.");
  }

  return lines.join("\n");
}

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
    } else if (error instanceof Error) {
      // For non-database errors, also show formatted details
      console.error("\n" + formatGeneralError(error) + "\n");
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
