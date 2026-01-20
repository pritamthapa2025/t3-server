/**
 * Central Error Message Utility
 * Provides humanized, consistent error messages across all APIs
 */

export class ErrorMessages {
  // Generic messages
  static required(fieldName: string): string {
    return `${fieldName} is required and cannot be empty`;
  }

  static invalid(fieldName: string): string {
    return `${fieldName} is invalid or has an incorrect format`;
  }

  static notFound(resourceName: string): string {
    return `${resourceName} not found`;
  }

  static alreadyExists(resourceName: string, identifier?: string): string {
    return identifier
      ? `${resourceName} '${identifier}' already exists`
      : `${resourceName} already exists`;
  }

  static mustBePositive(fieldName: string): string {
    return `${fieldName} must be a positive number`;
  }

  static mustBeInteger(fieldName: string): string {
    return `${fieldName} must be a whole number`;
  }

  static tooLong(fieldName: string, maxLength: number): string {
    return `${fieldName} is too long (maximum ${maxLength} characters)`;
  }

  static tooShort(fieldName: string, minLength: number): string {
    return `${fieldName} is too short (minimum ${minLength} characters)`;
  }

  static invalidEmail(): string {
    return "Please provide a valid email address";
  }

  static invalidUrl(fieldName: string = "URL"): string {
    return `${fieldName} must be a valid URL (e.g., https://example.com)`;
  }

  static invalidDate(fieldName: string = "Date"): string {
    return `${fieldName} must be a valid date`;
  }

  static invalidEnum(fieldName: string, allowedValues: string[]): string {
    return `${fieldName} must be one of: ${allowedValues.join(", ")}`;
  }

  static mustBeUUID(fieldName: string): string {
    return `${fieldName} must be a valid ID`;
  }

  static rangeError(fieldName: string, min: number, max: number): string {
    return `${fieldName} must be between ${min} and ${max}`;
  }

  // Specific field messages
  static passwordTooShort(): string {
    return "Password must be at least 8 characters long";
  }

  static passwordTooWeak(): string {
    return "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character";
  }

  static invalidPhoneNumber(): string {
    return "Please provide a valid phone number";
  }

  static invalidZipCode(): string {
    return "Please provide a valid ZIP code";
  }

  static dateMustBeInFuture(fieldName: string): string {
    return `${fieldName} must be a date in the future`;
  }

  static dateMustBeInPast(fieldName: string): string {
    return `${fieldName} must be a date in the past`;
  }

  // Auth related
  static invalidCredentials(): string {
    return "Invalid email or password";
  }

  static unauthorized(): string {
    return "You are not authorized to perform this action";
  }

  static sessionExpired(): string {
    return "Your session has expired. Please login again";
  }

  // File upload related
  static fileTooLarge(maxSize: string): string {
    return `File is too large. Maximum size is ${maxSize}`;
  }

  static invalidFileType(allowedTypes: string[]): string {
    return `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`;
  }

  // Database related
  static foreignKeyError(resourceName: string): string {
    return `Invalid reference: ${resourceName} does not exist`;
  }

  static uniqueConstraintError(fieldName: string): string {
    return `This ${fieldName} is already in use`;
  }

  // Relationship errors
  static cannotDelete(resourceName: string, reason: string): string {
    return `Cannot delete ${resourceName}: ${reason}`;
  }

  static hasRelatedRecords(resourceName: string, relatedResource: string): string {
    return `Cannot delete ${resourceName} because it has related ${relatedResource}`;
  }

  // Validation summary
  static multipleErrors(errors: string[]): string {
    return `Please fix the following errors:\n${errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}`;
  }

  static missingRequiredFields(fields: string[]): string {
    if (fields.length === 1) {
      return `${fields[0]} is required`;
    }
    return `The following fields are required: ${fields.join(", ")}`;
  }

  // Custom message
  static custom(message: string): string {
    return message;
  }
}

/**
 * Format Zod validation errors into human-readable messages
 */
export function formatZodErrors(errors: any[]): {
  field: string;
  message: string;
}[] {
  return errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));
}

/**
 * Format multiple validation errors into a single response
 */
export function formatValidationResponse(errors: { field: string; message: string }[]) {
  return {
    success: false,
    message: "Validation failed",
    errors: errors,
    details: errors.map((e) => `${e.field}: ${e.message}`).join("; "),
  };
}

/**
 * Database error handler - converts DB errors to human messages
 */
export function handleDatabaseError(error: any): {
  statusCode: number;
  message: string;
} {
  // PostgreSQL error codes
  if (error.code === "23505") {
    // Unique constraint violation
    const match = error.detail?.match(/Key \((.*?)\)=/);
    const field = match ? match[1] : "field";
    return {
      statusCode: 409,
      message: ErrorMessages.uniqueConstraintError(field),
    };
  }

  if (error.code === "23503") {
    // Foreign key violation
    const match = error.detail?.match(/Key \((.*?)\)=/);
    const field = match ? match[1] : "referenced resource";
    return {
      statusCode: 400,
      message: ErrorMessages.foreignKeyError(field),
    };
  }

  if (error.code === "23502") {
    // Not null violation
    const match = error.message?.match(/column "(.*?)"/);
    const field = match ? match[1] : "field";
    return {
      statusCode: 400,
      message: ErrorMessages.required(field),
    };
  }

  if (error.code === "22P02") {
    // Invalid text representation (e.g., invalid UUID)
    return {
      statusCode: 400,
      message: "Invalid data format provided",
    };
  }

  // Default database error
  return {
    statusCode: 500,
    message: "A database error occurred. Please try again or contact support.",
  };
}

















