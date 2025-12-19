import { format, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { parseISO } from 'date-fns';

// US Eastern Time Zone
export const US_EASTERN_TZ = 'America/New_York';

/**
 * Convert UTC timestamp to US Eastern Time
 * @param utcDate - UTC date (from database)
 * @returns Date object in Eastern Time
 */
export function toEasternTime(utcDate: Date | string): Date {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return toZonedTime(date, US_EASTERN_TZ);
}

/**
 * Convert Eastern Time to UTC for database storage
 * @param easternDate - Date in Eastern Time
 * @returns Date object in UTC
 */
export function fromEasternTime(easternDate: Date): Date {
  return fromZonedTime(easternDate, US_EASTERN_TZ);
}

/**
 * Format date to MM/DD/YYYY in Eastern Time
 * @param utcDate - UTC date from database
 * @returns Formatted date string
 */
export function formatToEasternMMDDYYYY(utcDate: Date | string): string {
  const easternDate = toEasternTime(utcDate);
  return format(easternDate, 'MM/dd/yyyy', { timeZone: US_EASTERN_TZ });
}

/**
 * Format date to MM/DD/YYYY HH:mm in Eastern Time
 * @param utcDate - UTC date from database
 * @returns Formatted datetime string
 */
export function formatToEasternDateTime(utcDate: Date | string): string {
  const easternDate = toEasternTime(utcDate);
  return format(easternDate, 'MM/dd/yyyy HH:mm', { timeZone: US_EASTERN_TZ });
}

/**
 * Format date to full Eastern Time display
 * @param utcDate - UTC date from database
 * @returns Formatted datetime with timezone
 */
export function formatToEasternFull(utcDate: Date | string): string {
  const easternDate = toEasternTime(utcDate);
  return format(easternDate, 'MM/dd/yyyy hh:mm:ss a zzz', { timeZone: US_EASTERN_TZ });
}

/**
 * Get current Eastern Time as Date object
 * @returns Current date/time in Eastern timezone
 */
export function getCurrentEasternTime(): Date {
  return toZonedTime(new Date(), US_EASTERN_TZ);
}

/**
 * Create a date from Eastern Time input (for forms)
 * @param easternDateString - Date string assumed to be in Eastern Time
 * @returns UTC Date for database storage
 */
export function parseEasternTimeForDB(easternDateString: string): Date {
  // Parse as if it's in Eastern Time, then convert to UTC
  const easternDate = new Date(easternDateString);
  return fromEasternTime(easternDate);
}





