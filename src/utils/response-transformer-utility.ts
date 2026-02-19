import { 
  formatToEasternMMDDYYYY, 
  formatToEasternDateTime 
} from './timezone.js';

/**
 * Simple utility functions for manual response transformation
 * Use these if you want more control than the middleware approach
 */

interface TransformOptions {
  dateFields?: string[];
  dateTimeFields?: string[];
  preserveOriginal?: boolean;
}

/**
 * Transform a single timesheet object
 */
export function transformTimesheet<T extends Record<string, any>>(timesheet: T): T {
  if (!timesheet || typeof timesheet !== 'object') {
    return timesheet;
  }

  const transformed = { ...timesheet } as any;

  // Transform common timesheet fields
  if (transformed.sheetDate) {
    transformed.sheetDate = formatToEasternMMDDYYYY(transformed.sheetDate);
  }
  
  if (transformed.clockIn) {
    transformed.clockIn = formatToEasternDateTime(transformed.clockIn);
  }
  
  if (transformed.clockOut) {
    transformed.clockOut = formatToEasternDateTime(transformed.clockOut);
  }
  
  if (transformed.createdAt) {
    transformed.createdAt = formatToEasternDateTime(transformed.createdAt);
  }
  
  if (transformed.updatedAt) {
    transformed.updatedAt = formatToEasternDateTime(transformed.updatedAt);
  }

  return transformed as T;
}

/**
 * Transform an array of timesheets
 */
export function transformTimesheets<T extends Record<string, any>>(timesheets: T[]): T[] {
  if (!Array.isArray(timesheets)) {
    return timesheets;
  }

  return timesheets.map(transformTimesheet);
}

/**
 * Transform any object with configurable field mapping
 */
export function transformObject<T extends Record<string, any>>(
  obj: T, 
  options: TransformOptions = {}
): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const { 
    dateFields = ['sheetDate', 'dateOfBirth', 'hireDate'], 
    dateTimeFields = ['createdAt', 'updatedAt', 'clockIn', 'clockOut'],
    preserveOriginal = false 
  } = options;

  const transformed = { ...obj } as any;

  // Store originals if requested
  if (preserveOriginal) {
    const originals: Record<string, any> = {};
    [...dateFields, ...dateTimeFields].forEach(field => {
      if (transformed[field]) {
        originals[field] = transformed[field];
      }
    });
    if (Object.keys(originals).length > 0) {
      transformed._originalUTC = originals;
    }
  }

  // Transform date fields
  dateFields.forEach(field => {
    if (transformed[field]) {
      try {
        transformed[field] = formatToEasternMMDDYYYY(transformed[field]);
      } catch (error) {
        console.warn(`Failed to transform date field ${field}:`, error);
      }
    }
  });

  // Transform datetime fields  
  dateTimeFields.forEach(field => {
    if (transformed[field]) {
      try {
        transformed[field] = formatToEasternDateTime(transformed[field]);
      } catch (error) {
        console.warn(`Failed to transform datetime field ${field}:`, error);
      }
    }
  });

  return transformed as T;
}

/**
 * Transform paginated response
 */
export function transformPaginatedResponse<T extends Record<string, any>>(
  response: { data: T[]; total: number; pagination: any },
  options?: TransformOptions
) {
  return {
    ...response,
    data: response.data.map(item => transformObject(item, options)),
    _timezone: {
      display: 'America/Los_Angeles (Pacific Time)',
      format: 'MM/DD/YYYY HH:mm',
      dst_aware: true
    }
  };
}

/**
 * Wrapper function for API responses
 */
export function createEasternTimeResponse<T>(data: T, options?: TransformOptions) {
  let transformedData: T;

  if (Array.isArray(data)) {
    transformedData = data.map(item => transformObject(item, options)) as T;
  } else if (data && typeof data === 'object' && (data as any).data && Array.isArray((data as any).data)) {
    // Paginated response
    transformedData = transformPaginatedResponse(data as any, options) as T;
  } else {
    transformedData = transformObject(data as any, options) as T;
  }

  return {
    ...transformedData,
    _timezone: {
      display: 'America/Los_Angeles (Pacific Time)',
      format: 'MM/DD/YYYY HH:mm', 
      dst_aware: true,
      note: 'All timestamps converted to Pacific Time'
    }
  };
}

/**
 * Quick transform functions for common use cases
 */
export const quickTransforms = {
  // For timesheet responses
  timesheet: (data: any) => createEasternTimeResponse(data, {
    dateFields: ['sheetDate'],
    dateTimeFields: ['clockIn', 'clockOut', 'createdAt', 'updatedAt']
  }),

  // For user responses  
  user: (data: any) => createEasternTimeResponse(data, {
    dateFields: ['dateOfBirth', 'hireDate', 'terminationDate'],
    dateTimeFields: ['createdAt', 'updatedAt', 'lastLogin', 'emailVerifiedAt']
  }),

  // For general entities
  general: (data: any) => createEasternTimeResponse(data),
};

export default {
  transformTimesheet,
  transformTimesheets,
  transformObject,
  transformPaginatedResponse,
  createEasternTimeResponse,
  quickTransforms
};
