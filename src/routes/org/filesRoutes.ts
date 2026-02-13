/**
 * Files Module V2 Routes - Hierarchical Structure
 * Organized file access for executives
 */

import { Router } from "express";
import type { IRouter } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  paginationSchema,
  toggleStarSchema,
} from "../../validations/files-v2.validations.js";
import * as FilesV2Controller from "../../controllers/FilesV2Controller.js";

const queryPaginationSchema = z.object({ query: paginationSchema });
const bodyToggleStarSchema = z.object({ body: toggleStarSchema });

const router: IRouter = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * ============================================================================
 * QUICK ACCESS ROUTES
 * ============================================================================
 */

// GET /api/v1/org/files-v2/quick-access/recent?page=1&limit=20
router.get(
  "/quick-access/recent",
  validate(queryPaginationSchema),
  FilesV2Controller.getRecentFilesHandler
);

// GET /api/v1/org/files-v2/quick-access/starred?page=1&limit=20
router.get(
  "/quick-access/starred",
  validate(queryPaginationSchema),
  FilesV2Controller.getStarredFilesHandler
);

// PUT /api/v1/org/files-v2/star
router.put(
  "/star",
  validate(bodyToggleStarSchema),
  FilesV2Controller.toggleFileStarHandler
);

/**
 * ============================================================================
 * BIDS ROUTES (Grouped by Organization)
 * ============================================================================
 */

// GET /api/v1/org/files-v2/bids/active
router.get("/bids/active", FilesV2Controller.getBidsActiveFilesHandler);

// GET /api/v1/org/files-v2/bids/won
router.get("/bids/won", FilesV2Controller.getBidsWonFilesHandler);

/**
 * ============================================================================
 * JOBS ROUTES (Grouped by Organization)
 * ============================================================================
 */

// GET /api/v1/org/files-v2/jobs/active
router.get("/jobs/active", FilesV2Controller.getJobsActiveFilesHandler);

// GET /api/v1/org/files-v2/jobs/completed
router.get("/jobs/completed", FilesV2Controller.getJobsCompletedFilesHandler);

/**
 * ============================================================================
 * CLIENTS ROUTES (Flat Lists with Pagination)
 * ============================================================================
 */

// GET /api/v1/org/files-v2/clients/invoices?page=1&limit=20
router.get(
  "/clients/invoices",
  validate(queryPaginationSchema),
  FilesV2Controller.getClientInvoiceFilesHandler
);

// GET /api/v1/org/files-v2/clients/documents?page=1&limit=20
router.get(
  "/clients/documents",
  validate(queryPaginationSchema),
  FilesV2Controller.getClientDocumentFilesHandler
);

/**
 * ============================================================================
 * EMPLOYEE ROUTES (Flat Lists with Pagination)
 * ============================================================================
 */

// GET /api/v1/org/files/employees/documents?page=1&limit=20
router.get(
  "/employees/documents",
  validate(queryPaginationSchema),
  FilesV2Controller.getEmployeeDocumentFilesHandler
);

/**
 * ============================================================================
 * FLEET ROUTES (Flat Lists with Pagination)
 * ============================================================================
 */

// GET /api/v1/org/files-v2/fleet/documents?page=1&limit=20
router.get(
  "/fleet/documents",
  validate(queryPaginationSchema),
  FilesV2Controller.getFleetDocumentFilesHandler
);

// GET /api/v1/org/files-v2/fleet/media?page=1&limit=20
router.get(
  "/fleet/media",
  validate(queryPaginationSchema),
  FilesV2Controller.getFleetMediaFilesHandler
);

export default router;
