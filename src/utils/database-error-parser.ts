/**
 * Database Error Parser
 * Converts PostgreSQL error codes and messages into human-readable messages
 * Uses 'pg-error-codes' package for human-readable error code names
 */

import pgErrorCodes from 'pg-error-codes' with { type: 'json' };

interface DatabaseError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
  table?: string;
  column?: string;
  severity?: string;
}

interface ParsedError {
  userMessage: string;
  technicalMessage: string;
  statusCode: number;
  errorCode?: string;
  suggestions?: string[];
}

/**
 * Parse PostgreSQL error into a user-friendly message
 * Uses 'pg-error-codes' package for human-readable error code names
 */
export function parseDatabaseError(error: DatabaseError): ParsedError {
  // Check if error has a nested cause (drizzle wraps errors)
  const dbError = error as any;
  let actualError = error;
  
  if (dbError.cause && dbError.cause instanceof Error) {
    const cause = dbError.cause;
    // If cause has database error properties, use it instead
    if ("code" in cause || "detail" in cause || "constraint" in cause) {
      actualError = cause as DatabaseError;
    }
  }
  
  // Extract error properties, prioritizing nested error if it exists
  const errorCode = actualError.code || dbError.code;
  const detail = actualError.detail || dbError.detail || "";
  const constraint = actualError.constraint || dbError.constraint || "";
  const table = actualError.table || dbError.table || "";
  const column = actualError.column || dbError.column || "";
  // Use the actual error message, or fall back to wrapper message if it contains useful info
  let message = actualError.message || error.message || "";
  
  // If we have a nested error but the wrapper message has more context, include it
  if (actualError !== error && error.message && error.message.includes("Failed query")) {
    message = `${error.message}\n\nUnderlying error: ${actualError.message}`;
  }

  // Get human-readable error name from pg-error-codes
  let errorName = "Database Error";
  if (errorCode) {
    try {
      // pg-error-codes exports an object with error codes as keys
      const codeName = (pgErrorCodes as Record<string, string>)[errorCode];
      if (codeName) {
        // Convert snake_case to Title Case for better readability
        errorName = codeName
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      } else {
        errorName = `Error Code ${errorCode}`;
      }
    } catch {
      errorName = errorCode || "Unknown Error";
    }
  }

  // PostgreSQL Error Codes Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
  
  switch (errorCode) {
    // ========== UNIQUE CONSTRAINT VIOLATIONS (23505) ==========
    case "23505": {
      let field = "field";
      let value = "";

      // Try to extract field name from constraint name
      if (constraint.includes("email")) {
        field = "email address";
      } else if (constraint.includes("phone")) {
        field = "phone number";
      } else if (constraint.includes("employee_id")) {
        field = "employee ID";
      } else if (constraint.includes("account_number")) {
        field = "account number";
      }

      // Try to extract value from detail message
      const valueMatch = detail.match(/Key \(.*?\)=\((.*?)\)/);
      if (valueMatch && valueMatch[1]) {
        value = valueMatch[1];
      }

      return {
        userMessage: `The ${field}${value ? ` '${value}'` : ""} is already in use. Please use a different ${field}.`,
        technicalMessage: `Unique constraint violation (${errorName}): ${constraint}. ${detail}`,
        statusCode: 409,
        errorCode: "DUPLICATE_ENTRY",
        suggestions: [
          `Check if a record with this ${field} already exists`,
          `Use a different ${field}`,
          `Update the existing record instead of creating a new one`,
        ],
      };
    }

    // ========== FOREIGN KEY VIOLATIONS (23503) ==========
    case "23503": {
      let referencedEntity = "record";
      let field = "reference";

      // Parse constraint name to identify the relationship
      if (constraint.includes("department")) {
        referencedEntity = "department";
        field = "department";
      } else if (constraint.includes("position")) {
        referencedEntity = "position";
        field = "position";
      } else if (constraint.includes("user")) {
        referencedEntity = "user";
        field = "user";
      } else if (constraint.includes("role")) {
        referencedEntity = "role";
        field = "role";
      } else if (constraint.includes("employee")) {
        referencedEntity = "employee";
        field = "employee";
      } else if (constraint.includes("client") || constraint.includes("organization")) {
        referencedEntity = "client/organization";
        field = "client";
      } else if (constraint.includes("property")) {
        referencedEntity = "property";
        field = "property";
      }

      // Check if it's a deletion error or insertion error
      if (message.toLowerCase().includes("still referenced") || detail.toLowerCase().includes("still referenced")) {
        return {
          userMessage: `Cannot delete this ${referencedEntity} because it is still being used by other records.`,
          technicalMessage: `Foreign key constraint violation on delete: ${constraint}. ${detail}`,
          statusCode: 400,
          errorCode: "REFERENCED_RECORD",
          suggestions: [
            `Remove or update all records that reference this ${referencedEntity}`,
            `Consider soft-deleting instead of hard-deleting the record`,
          ],
        };
      } else {
        return {
          userMessage: `The ${field} you selected does not exist. Please choose a valid ${referencedEntity}.`,
          technicalMessage: `Foreign key constraint violation on insert/update: ${constraint}. ${detail}`,
          statusCode: 400,
          errorCode: "INVALID_REFERENCE",
          suggestions: [
            `Verify that the ${referencedEntity} ID exists`,
            `Check if the ${referencedEntity} has been deleted`,
            `Refresh your data and try again`,
          ],
        };
      }
    }

    // ========== NOT NULL VIOLATIONS (23502) ==========
    case "23502": {
      let fieldName = column || "field";
      
      // Make field name more readable
      fieldName = fieldName
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l: string) => l.toUpperCase());

      return {
        userMessage: `The field '${fieldName}' is required but was not provided. Please provide a value for ${fieldName}.`,
        technicalMessage: `NOT NULL constraint violation: column "${column}" in table "${table}". ${detail}`,
        statusCode: 400,
        errorCode: "MISSING_REQUIRED_FIELD",
        suggestions: [
          `Provide a value for the '${fieldName}' field`,
          `Check your request payload to ensure all required fields are included`,
        ],
      };
    }

    // ========== CHECK CONSTRAINT VIOLATIONS (23514) ==========
    case "23514": {
      let fieldHint = "";
      
      if (constraint.includes("email")) {
        fieldHint = "email format";
      } else if (constraint.includes("phone")) {
        fieldHint = "phone number format";
      } else if (constraint.includes("status")) {
        fieldHint = "status value";
      } else if (constraint.includes("date")) {
        fieldHint = "date value";
      }

      return {
        userMessage: `The value provided does not meet the validation requirements${fieldHint ? ` for ${fieldHint}` : ""}. Please check your input and try again.`,
        technicalMessage: `CHECK constraint violation: ${constraint}. ${detail}`,
        statusCode: 400,
        errorCode: "VALIDATION_FAILED",
        suggestions: [
          `Review the allowed values for this field`,
          `Check if the value is in the correct format`,
        ],
      };
    }

    // ========== DATA TYPE MISMATCHES (22P02, 22003, etc.) ==========
    case "22P02": // Invalid text representation
      return {
        userMessage: `Invalid data format provided. One or more fields contain data that doesn't match the expected format (e.g., text where a number is expected).`,
        technicalMessage: `Invalid input syntax: ${message}`,
        statusCode: 400,
        errorCode: "INVALID_DATA_TYPE",
        suggestions: [
          `Verify that numeric fields contain only numbers`,
          `Check date fields are in the correct format (YYYY-MM-DD)`,
          `Ensure UUIDs are properly formatted`,
        ],
      };

    case "22003": // Numeric value out of range
      return {
        userMessage: `A numeric value is out of the acceptable range. The number is either too large or too small.`,
        technicalMessage: `Numeric value out of range: ${message}`,
        statusCode: 400,
        errorCode: "VALUE_OUT_OF_RANGE",
        suggestions: [
          `Use a smaller or larger number`,
          `Check if the value exceeds the maximum allowed limit`,
        ],
      };

    // ========== STRING LENGTH VIOLATIONS (22001) ==========
    case "22001": // String data right truncation
      return {
        userMessage: `One or more text fields exceed the maximum allowed length. Please shorten your input.`,
        technicalMessage: `String too long: ${message}`,
        statusCode: 400,
        errorCode: "STRING_TOO_LONG",
        suggestions: [
          `Reduce the length of text fields`,
          `Check field character limits`,
        ],
      };

    // ========== SERIALIZATION FAILURES (40001) ==========
    case "40001": // Serialization failure
      return {
        userMessage: `The operation could not be completed due to concurrent modifications. Please try again.`,
        technicalMessage: `Serialization failure: ${message}`,
        statusCode: 409,
        errorCode: "CONCURRENT_MODIFICATION",
        suggestions: [
          `Retry the operation`,
          `Refresh your data before making changes`,
        ],
      };

    // ========== DEADLOCK DETECTED (40P01) ==========
    case "40P01": // Deadlock detected
      return {
        userMessage: `The operation was blocked by another process. Please try again in a moment.`,
        technicalMessage: `Deadlock detected: ${message}`,
        statusCode: 503,
        errorCode: "DEADLOCK",
        suggestions: [
          `Wait a moment and retry the operation`,
          `Try performing operations in a different order`,
        ],
      };

    // ========== CONNECTION ERRORS (08xxx) ==========
    case "08000": // Connection exception
    case "08003": // Connection does not exist
    case "08006": // Connection failure
      return {
        userMessage: `Unable to connect to the database. Please try again later or contact support if the issue persists.`,
        technicalMessage: `Database connection error: ${message}`,
        statusCode: 503,
        errorCode: "DATABASE_CONNECTION_ERROR",
        suggestions: [
          `Wait a moment and try again`,
          `Check your internet connection`,
          `Contact support if the issue persists`,
        ],
      };

    // ========== INSUFFICIENT RESOURCES (53xxx) ==========
    case "53000": // Insufficient resources
    case "53100": // Disk full
    case "53200": // Out of memory
    case "53300": // Too many connections
      return {
        userMessage: `The server is currently experiencing high load. Please try again in a few moments.`,
        technicalMessage: `Insufficient resources: ${message}`,
        statusCode: 503,
        errorCode: "SERVER_OVERLOADED",
        suggestions: [
          `Wait a few minutes and try again`,
          `Contact support if the issue persists`,
        ],
      };

    // ========== QUERY EXECUTION ERRORS (42xxx) ==========
    case "42P01": // Undefined table
      return {
        userMessage: `A system error occurred. The requested resource could not be found. Please contact support.`,
        technicalMessage: `Undefined table: ${message}`,
        statusCode: 500,
        errorCode: "SYSTEM_ERROR",
        suggestions: [
          `Contact technical support`,
          `Check if recent database migrations have been applied`,
        ],
      };

    case "42703": // Undefined column
      return {
        userMessage: `A system error occurred. A required field is missing from the database. Please contact support.`,
        technicalMessage: `Undefined column: ${message}`,
        statusCode: 500,
        errorCode: "SYSTEM_ERROR",
        suggestions: [
          `Contact technical support`,
          `Check if recent database migrations have been applied`,
        ],
      };

    case "42601": { // Syntax error
      // Try to extract more context from the error message
      let syntaxIssue = "SQL syntax error";
      if (message.includes("missing column") || message.includes("column") && message.includes("does not exist")) {
        syntaxIssue = "Missing or invalid column reference in query";
      } else if (message.includes("syntax error at or near")) {
        const nearMatch = message.match(/syntax error at or near "([^"]+)"/i);
        if (nearMatch) {
          syntaxIssue = `SQL syntax error near "${nearMatch[1]}"`;
        }
      } else if (message.includes("Failed query")) {
        // Drizzle ORM error format
        const queryMatch = message.match(/Failed query: (.+?)\n/i);
        if (queryMatch && queryMatch[1]) {
          syntaxIssue = `Invalid SQL query structure: ${queryMatch[1].substring(0, 100)}...`;
        }
      }
      
      return {
        userMessage: `A database query error occurred (${errorName}). This is likely a system issue. Please contact support if this persists.`,
        technicalMessage: `${syntaxIssue}: ${message}`,
        statusCode: 500,
        errorCode: "SQL_SYNTAX_ERROR",
        suggestions: [
          `Contact technical support with the error details`,
          `Check if recent database migrations have been applied`,
          `Verify that all required database columns exist`,
          `Try refreshing the page and attempting the operation again`,
        ],
      };
    }

    // ========== GENERIC FALLBACK ==========
    default: {
      // Try to extract meaningful info from the message
      let userMessage = "A database error occurred while processing your request.";
      let suggestions = [
        `Try the operation again`,
        `Contact support if the issue persists`,
      ];
      
      // Check for SQL syntax errors in the message
      if (message.toLowerCase().includes("failed query") || message.toLowerCase().includes("syntax error")) {
        // Try to extract the problematic query
        const queryMatch = message.match(/select.*?from.*?where.*?\(/i);
        if (queryMatch) {
          userMessage = "A database query error occurred. The system attempted to execute an invalid database query. This is a system issue that needs to be fixed.";
          suggestions = [
            `Contact technical support immediately with this error`,
            `Check if the requested data exists and is valid`,
            `Try refreshing the page and attempting the operation again`,
          ];
        } else {
          userMessage = "A database query error occurred. This is likely a system issue. Please contact support.";
        }
      } else if (message.toLowerCase().includes("duplicate")) {
        userMessage = "A record with this information already exists.";
      } else if (message.toLowerCase().includes("not found")) {
        userMessage = "The requested record was not found.";
      } else if (message.toLowerCase().includes("timeout")) {
        userMessage = "The operation took too long to complete. Please try again.";
      } else if (message.includes(" = $") && message.includes("where")) {
        // SQL query with missing column name
        userMessage = "A database query error occurred. The system attempted to execute a query with missing information. This is a system issue that needs to be fixed.";
        suggestions = [
          `Contact technical support immediately with this error`,
          `The error indicates a missing column reference in a database query`,
          `Check if all required parameters were provided`,
          `Try refreshing the page and attempting the operation again`,
        ];
      }

      return {
        userMessage,
        technicalMessage: message || "Unknown database error",
        statusCode: 500,
        errorCode: errorCode || "DATABASE_ERROR",
        suggestions,
      };
    }
  }
}

/**
 * Format error for logging with human-readable context
 */
export function formatErrorForLogging(error: DatabaseError): string {
  const parsed = parseDatabaseError(error);
  const dbError = error as any;
  
  // Extract actual error (check for nested cause)
  let actualError = error;
  if (dbError.cause && dbError.cause instanceof Error) {
    const cause = dbError.cause;
    if ("code" in cause || "detail" in cause || "constraint" in cause) {
      actualError = cause as DatabaseError;
    }
  }
  
  // Extract SQL query from error message if present
  let sqlQuery = "";
  let sqlParams = "";
  const errorMessage = error.message || "";
  if (errorMessage.includes("Failed query:")) {
    const queryMatch = errorMessage.match(/Failed query:\s*([\s\S]*?)(?:\nparams:|$)/);
    if (queryMatch && queryMatch[1]) {
      sqlQuery = queryMatch[1].trim();
    }
    const paramsMatch = errorMessage.match(/params:\s*([^\n]+)/);
    if (paramsMatch && paramsMatch[1]) {
      sqlParams = paramsMatch[1].trim();
    }
  }
  
  const lines = [
    `   ${parsed.userMessage}`,
    "",
    `   ${parsed.technicalMessage}`,
  ];
  
  // Show underlying error if it exists and is different from the main message
  if (actualError !== error && actualError.message) {
    lines.push("");
    lines.push(`Underlying error: ${actualError.message}`);
  }
  
  // Show SQL query if available (only if not already in technical message)
  if (sqlQuery && !parsed.technicalMessage.includes(sqlQuery.substring(0, 50))) {
    lines.push("");
    lines.push("🔍 SQL QUERY:");
    const formattedSql = sqlQuery
      .split('\n')
      .map(line => `   ${line}`)
      .join('\n');
    lines.push(formattedSql);
    
    if (sqlParams) {
      lines.push(`📋 PARAMS: ${sqlParams}`);
    }
  }
  
  lines.push("");
  lines.push(`📋 ERROR CODE: ${parsed.errorCode || "N/A"} | 📊 HTTP STATUS: ${parsed.statusCode}`);

  // Show nested error info if it exists (compact format)
  if (dbError.cause && actualError !== error) {
    lines.push(`🔍 NESTED: ${(actualError as any).name || "error"} - ${actualError.message || "N/A"}`);
  }

  const code = actualError.code || error.code;
  if (code) {
    lines.push(`🔢 POSTGRES CODE: ${code}`);
  }

  const constraint = actualError.constraint || error.constraint;
  if (constraint) {
    lines.push(`🔗 CONSTRAINT: ${constraint}`);
  }

  const table = actualError.table || error.table;
  if (table) {
    lines.push(`📁 TABLE: ${table}`);
  }

  const column = actualError.column || error.column;
  if (column) {
    lines.push(`📝 COLUMN: ${column}`);
  }

  const detail = actualError.detail || error.detail;
  if (detail) {
    lines.push(`📄 DETAIL: ${detail}`);
  }
  
  if ((actualError as any).hint) {
    lines.push(`💡 HINT: ${(actualError as any).hint}`);
  }
  
  if ((actualError as any).position) {
    lines.push(`📍 POSITION: ${(actualError as any).position}`);
  }

  return lines.join("\n");
}

/**
 * Check if error is a database error
 * Also checks for nested errors (drizzle wraps errors in cause property)
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  if (!(error instanceof Error)) {
    return false;
  }
  
  // Check if error itself has database error properties
  if ("code" in error || "detail" in error || "constraint" in error) {
    return true;
  }
  
  // Check if error has a cause that is a database error (drizzle wraps errors)
  const dbError = error as any;
  if (dbError.cause && dbError.cause instanceof Error) {
    const cause = dbError.cause;
    if ("code" in cause || "detail" in cause || "constraint" in cause) {
      return true;
    }
  }
  
  // Check if error message indicates a database error
  const message = error.message || "";
  if (message.includes("Failed query") || 
      message.includes("syntax error") ||
      message.includes("relation") ||
      message.includes("column") ||
      message.includes("constraint")) {
    return true;
  }
  
  return false;
}
















