import { z } from "zod";

/**
 * Shared bulk-delete schema for UUID-based entity IDs (bids, jobs, dispatch, expenses, invoices,
 * clients, payroll runs, compliance cases, vehicles, inventory items).
 */
export const bulkDeleteUuidSchema = z.object({
  body: z.object({
    ids: z
      .array(z.string().uuid("Each ID must be a valid UUID"))
      .min(1, "At least one ID is required")
      .max(200, "Cannot bulk-delete more than 200 records at once"),
  }),
});

/**
 * Shared bulk-delete schema for integer-based entity IDs (employees, departments, timesheets).
 */
export const bulkDeleteIntSchema = z.object({
  body: z.object({
    ids: z
      .array(z.number().int().positive("Each ID must be a positive integer"))
      .min(1, "At least one ID is required")
      .max(200, "Cannot bulk-delete more than 200 records at once"),
  }),
});

export type BulkDeleteUuidInput = z.infer<typeof bulkDeleteUuidSchema>["body"];
export type BulkDeleteIntInput = z.infer<typeof bulkDeleteIntSchema>["body"];
