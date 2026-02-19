import { format, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { parseISO } from 'date-fns';

// US Pacific Time Zone
export const US_EASTERN_TZ = 'America/Los_Angeles';

/**
 * Convert UTC timestamp to US Pacific Time
 * @param utcDate - UTC date (from database)
 * @returns Date object in Pacific Time
 * @throws Error if the date is invalid
 */
export function toEasternTime(utcDate: Date | string): Date {
  if (!utcDate) {
    throw new Error('Date value is null or undefined');
  }
  
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${utcDate}`);
  }
  
  return toZonedTime(date, US_EASTERN_TZ);
}

/**
 * Convert Pacific Time to UTC for database storage
 * @param easternDate - Date in Pacific Time
 * @returns Date object in UTC
 */
export function fromEasternTime(easternDate: Date): Date {
  return fromZonedTime(easternDate, US_EASTERN_TZ);
}

/**
 * Format date to MM/DD/YYYY in Pacific Time
 * @param utcDate - UTC date from database
 * @returns Formatted date string
 * @throws Error if the date is invalid
 */
export function formatToEasternMMDDYYYY(utcDate: Date | string): string {
  if (!utcDate) {
    throw new Error('Date value is required for formatting');
  }
  
  const pacificDate = toEasternTime(utcDate);
  return format(pacificDate, 'MM/dd/yyyy', { timeZone: US_EASTERN_TZ });
}

/**
 * Format date to MM/DD/YYYY HH:mm in Pacific Time
 * @param utcDate - UTC date from database
 * @returns Formatted datetime string
 * @throws Error if the date is invalid
 */
export function formatToEasternDateTime(utcDate: Date | string): string {
  if (!utcDate) {
    throw new Error('Date value is required for formatting');
  }
  
  const pacificDate = toEasternTime(utcDate);
  return format(pacificDate, 'MM/dd/yyyy HH:mm', { timeZone: US_EASTERN_TZ });
}

/**
 * Format date to full Pacific Time display
 * @param utcDate - UTC date from database
 * @returns Formatted datetime with timezone
 * @throws Error if the date is invalid
 */
export function formatToEasternFull(utcDate: Date | string): string {
  if (!utcDate) {
    throw new Error('Date value is required for formatting');
  }
  
  const pacificDate = toEasternTime(utcDate);
  return format(pacificDate, 'MM/dd/yyyy hh:mm:ss a zzz', { timeZone: US_EASTERN_TZ });
}

/**
 * Get current Pacific Time as Date object
 * @returns Current date/time in Pacific timezone
 */
export function getCurrentEasternTime(): Date {
  return toZonedTime(new Date(), US_EASTERN_TZ);
}

/**
 * Create a date from Pacific Time input (for forms)
 * @param easternDateString - Date string assumed to be in Pacific Time
 * @returns UTC Date for database storage
 */
export function parseEasternTimeForDB(easternDateString: string): Date {
  // Parse as if it's in Pacific Time, then convert to UTC
  const pacificDate = new Date(easternDateString);
  return fromEasternTime(pacificDate);
}








