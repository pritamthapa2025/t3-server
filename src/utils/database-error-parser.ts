/**
 * Database Error Parser
 * Converts PostgreSQL error codes and messages into human-readable messages
 */

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
 */
export function parseDatabaseError(error: DatabaseError): ParsedError {
  const errorCode = error.code;
  const detail = error.detail || "";
  const constraint = error.constraint || "";
  const table = error.table || "";
  const column = error.column || "";
  const message = error.message || "";

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
        technicalMessage: `Unique constraint violation: ${constraint}. ${detail}`,
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
        .replace(/\b\w/g, (l) => l.toUpperCase());

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

    // ========== GENERIC FALLBACK ==========
    default:
      // Try to extract meaningful info from the message
      let userMessage = "A database error occurred while processing your request.";
      
      if (message.toLowerCase().includes("duplicate")) {
        userMessage = "A record with this information already exists.";
      } else if (message.toLowerCase().includes("not found")) {
        userMessage = "The requested record was not found.";
      } else if (message.toLowerCase().includes("timeout")) {
        userMessage = "The operation took too long to complete. Please try again.";
      }

      return {
        userMessage,
        technicalMessage: message || "Unknown database error",
        statusCode: 500,
        errorCode: errorCode || "DATABASE_ERROR",
        suggestions: [
          `Try the operation again`,
          `Contact support if the issue persists`,
        ],
      };
  }
}

/**
 * Format error for logging with human-readable context
 */
export function formatErrorForLogging(error: DatabaseError): string {
  const parsed = parseDatabaseError(error);
  
  const lines = [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "🚨 DATABASE ERROR DETAILS",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    "👤 USER-FRIENDLY MESSAGE:",
    `   ${parsed.userMessage}`,
    "",
    "🔧 TECHNICAL DETAILS:",
    `   ${parsed.technicalMessage}`,
    "",
    "📋 ERROR CODE: " + (parsed.errorCode || "N/A"),
    "📊 HTTP STATUS: " + parsed.statusCode,
  ];

  if (error.code) {
    lines.push(`🔢 POSTGRES CODE: ${error.code}`);
  }

  if (error.constraint) {
    lines.push(`🔗 CONSTRAINT: ${error.constraint}`);
  }

  if (error.table) {
    lines.push(`📁 TABLE: ${error.table}`);
  }

  if (error.column) {
    lines.push(`📝 COLUMN: ${error.column}`);
  }

  if (error.detail) {
    lines.push(`📄 DETAIL: ${error.detail}`);
  }

  if (parsed.suggestions && parsed.suggestions.length > 0) {
    lines.push("");
    lines.push("💡 SUGGESTIONS:");
    parsed.suggestions.forEach((suggestion, index) => {
      lines.push(`   ${index + 1}. ${suggestion}`);
    });
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return lines.join("\n");
}

/**
 * Check if error is a database error
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return (
    error instanceof Error &&
    ("code" in error || "detail" in error || "constraint" in error)
  );
}




