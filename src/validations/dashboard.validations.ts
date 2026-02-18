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

// ─── Revenue Target Validations ───────────────────────────────────────────────

export const createRevenueTargetSchema = z.object({
  body: z.object({
    month: z
      .number()
      .int()
      .min(1, "month must be 1–12")
      .max(12, "month must be 1–12"),
    year: z
      .number()
      .int()
      .min(2000, "year must be 2000 or later")
      .max(2100, "year must be 2100 or earlier"),
    targetAmount: z
      .number()
      .positive("targetAmount must be a positive number"),
    label: z.string().max(150).optional(),
    notes: z.string().optional(),
  }),
});

export const updateRevenueTargetSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid revenue target id"),
  }),
  body: z.object({
    month: z.number().int().min(1).max(12).optional(),
    year: z.number().int().min(2000).max(2100).optional(),
    targetAmount: z.number().positive().optional(),
    label: z.string().max(150).optional(),
    notes: z.string().optional(),
  }),
});

export const revenueTargetIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid revenue target id"),
  }),
});

export const revenueTargetListQuerySchema = z.object({
  query: z.object({
    year: z
      .string()
      .regex(/^\d{4}$/, "year must be a 4-digit number")
      .optional(),
  }),
});
