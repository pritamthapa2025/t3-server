/**
 * Files Module V2 Controller - Hierarchical Structure
 * Handles all file-related requests for the new structure
 */

import type { Request, Response, NextFunction } from "express";
import * as FilesV2Service from "../services/files-v2.service.js";
import type { PaginationParams, FileSourceTable } from "../types/files-v2.types.js";

/**
 * Get recent files (last 14 days) with pagination
 * GET /api/v1/org/files-v2/quick-access/recent?page=1&limit=20
 */
export async function getRecentFilesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const pagination: PaginationParams = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await FilesV2Service.getRecentFiles(pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get starred files with pagination
 * GET /api/v1/org/files-v2/quick-access/starred?page=1&limit=20
 */
export async function getStarredFilesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const pagination: PaginationParams = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await FilesV2Service.getStarredFiles(pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Toggle file star status
 * PUT /api/v1/org/files-v2/star
 */
export async function toggleFileStarHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { fileId, source, isStarred } = req.body;
    const success = await FilesV2Service.toggleFileStar(
      fileId,
      source as FileSourceTable,
      isStarred
    );

    if (success) {
      res.json({ success: true, message: "File star status updated" });
    } else {
      res.status(400).json({ success: false, message: "Failed to update star status" });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Get active bid files grouped by organization
 * GET /api/v1/org/files-v2/bids/active
 */
export async function getBidsActiveFilesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await FilesV2Service.getBidsActiveFiles();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get won bid files grouped by organization
 * GET /api/v1/org/files-v2/bids/won
 */
export async function getBidsWonFilesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await FilesV2Service.getBidsWonFiles();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get active job files grouped by organization
 * GET /api/v1/org/files-v2/jobs/active
 */
export async function getJobsActiveFilesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await FilesV2Service.getJobsActiveFiles();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get completed job files grouped by organization
 * GET /api/v1/org/files-v2/jobs/completed
 */
export async function getJobsCompletedFilesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await FilesV2Service.getJobsCompletedFiles();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get client invoice files (flat list with pagination)
 * GET /api/v1/org/files-v2/clients/invoices?page=1&limit=20
 */
export async function getClientInvoiceFilesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const pagination: PaginationParams = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await FilesV2Service.getClientInvoiceFiles(pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get client document files (flat list with pagination)
 * GET /api/v1/org/files-v2/clients/documents?page=1&limit=20
 */
export async function getClientDocumentFilesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const pagination: PaginationParams = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await FilesV2Service.getClientDocumentFiles(pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get client invoice files grouped by organization
 * GET /api/v1/org/files/clients/invoices/grouped
 */
export async function getClientInvoiceFilesGroupedHandler(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await FilesV2Service.getClientInvoiceFilesGroupedByOrg();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get client document files grouped by organization
 * GET /api/v1/org/files/clients/documents/grouped
 */
export async function getClientDocumentFilesGroupedHandler(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await FilesV2Service.getClientDocumentFilesGroupedByOrg();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get fleet document files (flat list with pagination)
 * GET /api/v1/org/files-v2/fleet/documents?page=1&limit=20
 */
export async function getFleetDocumentFilesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const pagination: PaginationParams = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await FilesV2Service.getFleetDocumentFiles(pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get fleet media files (flat list with pagination)
 * GET /api/v1/org/files-v2/fleet/media?page=1&limit=20
 */
export async function getFleetMediaFilesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const pagination: PaginationParams = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await FilesV2Service.getFleetMediaFiles(pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get employee document files (flat list with employee info, pagination)
 * GET /api/v1/org/files/employees/documents?page=1&limit=20
 */
export async function getEmployeeDocumentFilesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const pagination: PaginationParams = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await FilesV2Service.getEmployeeDocumentFiles(pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
