/**
 * Files Module V2 Validations - Hierarchical Structure
 */

import { z } from "zod";

/**
 * Pagination parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/**
 * Toggle Star Request
 */
export const toggleStarSchema = z.object({
  fileId: z.string().uuid("Invalid file ID"),
  source: z.enum([
    "bid_documents",
    "bid_media",
    "bid_plan_spec",
    "bid_design_build",
    "vehicle_documents",
    "vehicle_media",
    "client_documents",
    "property_documents",
    "invoice_documents",
    "payment_documents",
  ]),
  isStarred: z.boolean(),
});

export type PaginationSchema = z.infer<typeof paginationSchema>;
export type ToggleStarSchema = z.infer<typeof toggleStarSchema>;
