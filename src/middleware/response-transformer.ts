import type { Request, Response, NextFunction } from "express";
import {
  formatToEasternMMDDYYYY,
  formatToEasternDateTime,
  formatToEasternFull,
} from "../utils/timezone.js";

/**
 * Configuration for field transformation
 */
interface TransformConfig {
  dateFields?: string[]; // Transform to MM/DD/YYYY
  dateTimeFields?: string[]; // Transform to MM/DD/YYYY HH:mm
  fullDateFields?: string[]; // Transform to full format with timezone
  preserveOriginal?: boolean; // Keep original UTC in _original field
}

/**
 * Default transformation configuration for common timestamp fields
 */
const DEFAULT_CONFIG: TransformConfig = {
  dateFields: ["sheetDate", "dateOfBirth", "hireDate", "terminationDate"],
  dateTimeFields: [
    "createdAt",
    "updatedAt",
    "clockIn",
    "clockOut",
    "lastLogin",
  ],
  fullDateFields: [],
  preserveOriginal: false,
};

/**
 * Check if a string is already in MM/DD/YYYY HH:mm format
 */
function isAlreadyFormattedDateTime(value: any): boolean {
  if (typeof value !== 'string') return false;
  // Check for MM/DD/YYYY HH:mm pattern (e.g., "01/02/2026 08:50")
  return /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(value);
}

/**
 * Transform a single object's timestamp fields in-place
 */
function transformObject(obj: any, config: TransformConfig): any {
  if (!obj || typeof obj !== "object" || obj instanceof Date) {
    return obj;
  }

  const {
    dateFields = [],
    dateTimeFields = [],
    fullDateFields = [],
    preserveOriginal = false,
  } = config;

  // Store originals if requested
  if (preserveOriginal) {
    const originals: Record<string, any> = {};

    [...dateFields, ...dateTimeFields, ...fullDateFields].forEach((field) => {
      if (obj[field]) {
        originals[field] = obj[field];
      }
    });

    if (Object.keys(originals).length > 0) {
      obj._originalUTC = originals;
    }
  }

  // Transform date fields (MM/DD/YYYY)
  dateFields.forEach((field) => {
    if (obj[field] !== null && obj[field] !== undefined) {
      // Skip if already formatted
      if (isAlreadyFormattedDateTime(obj[field])) {
        return;
      }
      try {
        obj[field] = formatToEasternMMDDYYYY(obj[field]);
      } catch (error) {
        console.warn(`Failed to transform date field ${field}:`, {
          fieldValue: obj[field],
          error: error instanceof Error ? error.message : String(error),
        });
        // Set field to null instead of leaving invalid value
        obj[field] = null;
      }
    }
  });

  // Transform datetime fields (MM/DD/YYYY HH:mm)
  dateTimeFields.forEach((field) => {
    if (obj[field] !== null && obj[field] !== undefined) {
      // Skip if already formatted (MM/DD/YYYY HH:mm pattern like "01/02/2026 08:50")
      if (isAlreadyFormattedDateTime(obj[field])) {
        // Already formatted, skip transformation
        return;
      }
      
      // Transform Date objects
      if (obj[field] instanceof Date) {
        try {
          obj[field] = formatToEasternDateTime(obj[field]);
        } catch (error) {
          console.warn(`Failed to transform datetime field ${field}:`, {
            fieldValue: obj[field],
            fieldType: typeof obj[field],
            error: error instanceof Error ? error.message : String(error),
          });
          // Keep original value if transformation fails
        }
      } else if (typeof obj[field] === 'string') {
        // Try to parse as ISO string or other date format
        // Skip if it looks like it's already formatted (starts with MM/DD/YYYY)
        if (!/^\d{2}\/\d{2}\/\d{4}/.test(obj[field])) {
          try {
            const dateValue = new Date(obj[field]);
            if (!isNaN(dateValue.getTime())) {
              obj[field] = formatToEasternDateTime(dateValue);
            }
            // If parsing fails, keep original value
          } catch (error) {
            console.warn(`Failed to transform datetime field ${field}:`, {
              fieldValue: obj[field],
              fieldType: typeof obj[field],
              error: error instanceof Error ? error.message : String(error),
            });
            // Keep original value if transformation fails
          }
        }
        // If it matches the pattern, it's already formatted, so keep it as is
      }
    }
  });

  // Transform full date fields (MM/DD/YYYY HH:mm:ss AM/PM EST/EDT)
  fullDateFields.forEach((field) => {
    if (obj[field] !== null && obj[field] !== undefined) {
      try {
        obj[field] = formatToEasternFull(obj[field]);
      } catch (error) {
        console.warn(`Failed to transform full date field ${field}:`, {
          fieldValue: obj[field],
          fieldType: typeof obj[field],
          error: error instanceof Error ? error.message : String(error),
        });
        // Set field to null instead of leaving invalid value
        obj[field] = null;
      }
    }
  });

  return obj;
}

/**
 * Recursively transform nested objects and arrays
 */
function deepTransform(data: any, config: TransformConfig): any {
  if (Array.isArray(data)) {
    return data.map((item) => deepTransform(item, config));
  }

  if (data && typeof data === "object" && !(data instanceof Date)) {
    // Transform the current object
    const transformed = transformObject({ ...data }, config);

    // Recursively transform nested objects, but skip if they're already transformed
    Object.keys(transformed).forEach((key) => {
      if (typeof transformed[key] === "object" && transformed[key] !== null && !(transformed[key] instanceof Date)) {
        // Check if this is a nested object that might have date fields
        // Skip transformation if it looks like it's already been processed
        const nested = transformed[key];
        if (Array.isArray(nested)) {
          transformed[key] = nested.map((item) => deepTransform(item, config));
        } else if (nested && typeof nested === "object") {
          transformed[key] = deepTransform(nested, config);
        }
      }
    });

    return transformed;
  }

  return data;
}

/**
 * Express middleware to transform response timestamps to Eastern Time
 * Only applies to GET requests for better performance
 */
export function easternTimeTransformer(customConfig?: TransformConfig) {
  const config = { ...DEFAULT_CONFIG, ...customConfig };

  return (req: Request, res: Response, next: NextFunction) => {
    // Only transform GET requests (read operations)
    if (req.method !== "GET") {
      return next();
    }

    const originalJson = res.json;

    res.json = function (data: any) {
      try {
        // Transform the data
        const transformedData = deepTransform(data, config);

        // Add timezone metadata
        if (
          transformedData &&
          typeof transformedData === "object" &&
          !Array.isArray(transformedData)
        ) {
          transformedData._timezone = {
            display: "America/New_York (Eastern Time)",
            format: "MM/DD/YYYY HH:mm",
            dst_aware: true,
            note: "All timestamps converted to Eastern Time",
          };
        }

        return originalJson.call(this, transformedData);
      } catch (error) {
        console.error("Error transforming response timestamps:", error);
        // Fallback to original data if transformation fails
        return originalJson.call(this, data);
      }
    };

    next();
  };
}

/**
 * Optimized transformer for large datasets
 * Uses streaming approach for better memory efficiency
 */
export function largeDataTransformer(config?: TransformConfig) {
  const transformConfig = { ...DEFAULT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") {
      return next();
    }

    const originalJson = res.json;

    res.json = function (data: any) {
      try {
        // For large arrays, process in chunks
        if (Array.isArray(data) && data.length > 1000) {
          console.log(
            `⚡ Processing large dataset (${data.length} items) in chunks`
          );

          const chunkSize = 500;
          const transformedChunks = [];

          for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            const transformedChunk = chunk.map((item) =>
              transformObject(item, transformConfig)
            );
            transformedChunks.push(...transformedChunk);
          }

          return originalJson.call(this, {
            data: transformedChunks,
            _performance: {
              originalSize: data.length,
              chunksProcessed: Math.ceil(data.length / chunkSize),
              chunkSize,
            },
            _timezone: {
              display: "America/New_York (Eastern Time)",
              format: "MM/DD/YYYY HH:mm",
              dst_aware: true,
            },
          });
        }

        // For normal sized data, use regular transformation
        const transformedData = deepTransform(data, transformConfig);

        if (
          transformedData &&
          typeof transformedData === "object" &&
          !Array.isArray(transformedData)
        ) {
          transformedData._timezone = {
            display: "America/New_York (Eastern Time)",
            format: "MM/DD/YYYY HH:mm",
            dst_aware: true,
          };
        }

        return originalJson.call(this, transformedData);
      } catch (error) {
        console.error("Error in large data transformation:", error);
        return originalJson.call(this, data);
      }
    };

    next();
  };
}

/**
 * Timesheet-specific transformer
 */
export const timesheetTransformer = easternTimeTransformer({
  dateFields: ["sheetDate"],
  dateTimeFields: ["clockIn", "clockOut", "createdAt", "updatedAt"],
  preserveOriginal: false,
});

/**
 * User/Employee transformer
 */
export const userTransformer = easternTimeTransformer({
  dateFields: ["dateOfBirth", "hireDate", "terminationDate"],
  dateTimeFields: ["createdAt", "updatedAt", "lastLogin", "emailVerifiedAt"],
  preserveOriginal: false,
});

/**
 * General entity transformer (for most APIs)
 */
export const generalTransformer = easternTimeTransformer();

export default {
  easternTimeTransformer,
  largeDataTransformer,
  timesheetTransformer,
  userTransformer,
  generalTransformer,
};
