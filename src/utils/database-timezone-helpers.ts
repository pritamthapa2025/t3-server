import { sql } from "drizzle-orm";

/**
 * Database timezone helpers to ensure consistent UTC storage
 * Use these to avoid timezone confusion when inserting records
 */

/**
 * Force UTC timestamp for database insertion
 * Use this instead of new Date() to ensure UTC storage
 */
export function utcNow() {
  return sql`(now() AT TIME ZONE 'UTC')`;
}

/**
 * Convert any timezone-aware date to UTC for database storage
 * @param date - Date object (can be from any timezone)
 * @returns UTC date for database storage
 */
export function toUtcForDb(date: Date): Date {
  // Create new date in UTC
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
}

/**
 * Create UTC date from IST input
 * @param istDateString - Date string in IST format
 * @returns UTC Date for database storage
 */
export function istToUtcForDb(istDateString: string): Date {
  // Parse IST time and convert to UTC
  const istDate = new Date(istDateString + '+05:30');
  return istDate;
}

/**
 * Ensure consistent timestamp creation regardless of server timezone
 * Use this in your services when creating records
 */
export function createTimestamps() {
  const utcNow = new Date();
  return {
    createdAt: utcNow,
    updatedAt: utcNow
  };
}

/**
 * Safe user creation with guaranteed UTC timestamps
 * @param userData - User data without timestamps
 * @returns User data with UTC timestamps
 */
export function withUtcTimestamps<T extends Record<string, any>>(userData: T): T & {
  createdAt: Date;
  updatedAt: Date;
} {
  const timestamps = createTimestamps();
  return {
    ...userData,
    ...timestamps
  };
}

/**
 * Database queries that force UTC regardless of server timezone
 */
export const dbTimezone = {
  // Get current UTC time from database
  getCurrentUtc: () => sql`(now() AT TIME ZONE 'UTC')`,
  
  // Get current IST time from database  
  getCurrentIst: () => sql`(now() AT TIME ZONE 'Asia/Kolkata')`,
  
  // Get current Eastern time from database
  getCurrentEt: () => sql`(now() AT TIME ZONE 'America/New_York')`,
  
  // Convert any timestamp to UTC in query
  toUtc: (timestamp: any) => sql`(${timestamp} AT TIME ZONE 'UTC')`,
  
  // Convert UTC to specific timezone in query
  fromUtc: (timestamp: any, timezone: string) => sql`(${timestamp} AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})`
};

export default {
  utcNow,
  toUtcForDb,
  istToUtcForDb,
  createTimestamps,
  withUtcTimestamps,
  dbTimezone
};






