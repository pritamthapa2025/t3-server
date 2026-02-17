import { z } from "zod";

const dateSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Invalid date format. Use YYYY-MM-DD (e.g. 2024-01-15)",
  )
  .optional();

/**
 * Optional date range filter for dashboard endpoints (same pattern as reports API).
 * When provided, data is scoped to the range; when omitted, default ranges apply.
 */
export const dashboardDateRangeQuerySchema = z.object({
  query: z.object({
    startDate: dateSchema,
    endDate: dateSchema,
  }),
});
