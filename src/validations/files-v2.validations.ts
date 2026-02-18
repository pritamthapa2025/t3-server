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
    "employee_documents",
  ]),
  isStarred: z.boolean(),
});

/**
 * Bulk Soft Delete Request
 * Accepts an array of file references (id + source table).
 * On delete: sets isDeleted=true and deletedAt=now. Files stay in DO Spaces for 30 days.
 */
export const bulkDeleteFilesSchema = z.object({
  files: z
    .array(
      z.object({
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
          "employee_documents",
        ]),
      }),
    )
    .min(1, "At least one file must be provided")
    .max(200, "Cannot bulk delete more than 200 files at once"),
});

export type BulkDeleteFilesSchema = z.infer<typeof bulkDeleteFilesSchema>;
export type PaginationSchema = z.infer<typeof paginationSchema>;
export type ToggleStarSchema = z.infer<typeof toggleStarSchema>;
