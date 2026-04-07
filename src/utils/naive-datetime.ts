/**
 * Timezone-naive wall-clock datetimes (business scheduling, invoice dates, etc.)
 *
 * Wire format (JSON): prefer `YYYY-MM-DDTHH:mm:ss` or `YYYY-MM-DD HH:mm:ss` — no offset.
 * DB: PostgreSQL `TIMESTAMP WITHOUT TIME ZONE` (or `date` for date-only).
 *
 * Write path: `naiveDT` appends `Z` so JS Date + Drizzle round-trip preserves literal digits into PG
 * (see dispatch.service historical comment).
 *
 * Read path: stringify for JSON with `formatNaiveDateTimeForJson` / `formatNaiveDateForJson`.
 * For `Date` values produced by that write path, use UTC getters so wall-clock matches stored naive instant.
 *
 * Do not use these for true audit instants — use `formatInstantIsoForJson` instead.
 *
 * Frontend mirror: t3-frontend `lib/date-utils.ts` (`formatLocalDateString`, `formatLocalDateTimeString`, `formatRaw*`).
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Wrap naive datetime string for Drizzle `timestamp` columns (without time zone).
 */
export function naiveDT(s: string): Date {
  return new Date(s.endsWith("Z") ? s : `${s}Z`);
}

/** Calendar `YYYY-MM-DD` in the Node process local timezone (not UTC). */
export function formatLocalDateStringFromDate(d: Date): string {
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Today's calendar date in the Node process local timezone (not UTC). */
export function businessTodayLocalDateString(): string {
  return formatLocalDateStringFromDate(new Date());
}

/**
 * `YYYY-MM-DD` from UTC calendar components only.
 * Use when the `Date` was built/adjusted with `setUTCDate` / `Date.UTC` (e.g. ISO week helpers).
 */
export function formatUtcCalendarDateStringFromDate(d: Date): string {
  if (isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Date-only JSON string: `YYYY-MM-DD`. */
export function formatNaiveDateForJson(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    return value.split(/[T ]/)[0] ?? value;
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    // Date-only columns: use local calendar components (typical PG `date` → JS Date).
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  return String(value);
}

/** Naive datetime JSON string: `YYYY-MM-DD HH:mm:ss`. */
export function formatNaiveDateTimeForJson(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const cleaned = value.replace("T", " ").replace(/Z$/i, "");
    const [datePart, timePart = "00:00:00"] = cleaned.split(" ");
    return `${datePart} ${timePart.slice(0, 8)}`;
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = pad2(value.getUTCMonth() + 1);
    const d = pad2(value.getUTCDate());
    const h = pad2(value.getUTCHours());
    const min = pad2(value.getUTCMinutes());
    const s = pad2(value.getUTCSeconds());
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }
  return String(value);
}

/** Audit / system timestamps as RFC3339 UTC for JSON. */
export function formatInstantIsoForJson(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
    return value;
  }
  return String(value);
}
