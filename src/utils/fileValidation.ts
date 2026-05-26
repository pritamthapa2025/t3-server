import type { Request } from "express";
import type { FileFilterCallback } from "multer";

/**
 * Allowlist of MIME types accepted for general document uploads.
 * Matches the whitelist already used in clientRoutes.ts for image/document uploads.
 * Intentionally excludes SVG (can contain embedded scripts) and executable formats.
 */
export const ALLOWED_DOCUMENT_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  // Text
  "text/plain",
  "text/csv",
]);

/**
 * Returns a multer-compatible fileFilter callback that only accepts files
 * whose MIME type is in the provided allowlist.
 */
export function createFileFilter(allowed: Set<string>) {
  return (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ): void => {
    if (allowed.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `File type not allowed: ${file.mimetype}. Accepted types: ${[...allowed].join(", ")}`,
        ),
      );
    }
  };
}
