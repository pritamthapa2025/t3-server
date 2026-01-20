import type { Request, Response } from "express";

// Helper function to validate organization access
const validateUserAccess = (req: Request, res: Response): string | null => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(403).json({
      success: false,
      message: "Access denied. Authentication required.",
    });
    return null;
  }

  return userId;
};

// Legacy function for backward compatibility
const validateOrganizationAccess = validateUserAccess;

// Helper function to validate required params
const validateParams = (
  req: Request,
  res: Response,
  paramNames: string[]
): boolean => {
  for (const paramName of paramNames) {
    if (!req.params[paramName]) {
      res.status(400).json({
        success: false,
        message: `${paramName} is required`,
      });
      return false;
    }
  }
  return true;
};

import { logger } from "../utils/logger.js";
import {
  checkJobNumberExists,
  validateUniqueFields,
  buildConflictResponse,
} from "../utils/validation-helpers.js";
import {
  parseDatabaseError,
  isDatabaseError,
} from "../utils/database-error-parser.js";
import {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  getJobTeamMembers,
  addJobTeamMember,
  removeJobTeamMember,
  getJobFinancialSummary,
  updateJobFinancialSummary,
  getJobPlannedFinancialBreakdown,
  getJobMaterials,
  createJobMaterial,
  updateJobMaterial,
  deleteJobMaterial,
  getJobLabor,
  createJobLabor,
  updateJobLabor,
  deleteJobLabor,
  getJobTravel,
  createJobTravel,
  updateJobTravel,
  deleteJobTravel,
  getJobPlannedOperatingExpenses,
  getJobTimeline,
  createJobTimelineEvent,
  updateJobTimelineEvent,
  deleteJobTimelineEvent,
  getJobNotes,
  createJobNote,
  updateJobNote,
  deleteJobNote,
  getJobHistory,
  createJobHistoryEntry,
  getJobTasks,
  createJobTask,
  updateJobTask,
  deleteJobTask,
  getJobExpenses,
  createJobExpense,
  updateJobExpense,
  deleteJobExpense,
  getJobDocuments,
  createJobDocument,
  deleteJobDocument,
  getJobWithAllData,
} from "../services/job.service.js";

// ============================
// Main Job Operations
// ============================

export const getJobsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const offset = (page - 1) * limit;

    const filters: {
      status?: string;
      jobType?: string;
      priority?: string;
      search?: string;
    } = {};

    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.jobType) filters.jobType = req.query.jobType as string;
    if (req.query.priority) filters.priority = req.query.priority as string;
    if (req.query.search) filters.search = req.query.search as string;

    const jobs = await getJobs(
      organizationId,
      offset,
      limit,
      Object.keys(filters).length > 0 ? filters : undefined
    );

    logger.info("Jobs fetched successfully");
    return res.status(200).json({
      success: true,
      data: jobs.data,
      total: jobs.total,
      pagination: jobs.pagination,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getJobByIdHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["id"])) return;
    const { id } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const job = await getJobById(id!, organizationId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    logger.info("Job fetched successfully");
    return res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createJobHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const createdBy = req.user!.id;
    const { jobNumber, bidId } = req.body;

    // Validate bidId is provided
    if (!bidId) {
      return res.status(400).json({
        success: false,
        message: "bidId is required",
      });
    }

    // Verify bid belongs to the organization
    const { getBidById } = await import("../services/bid.service.js");
    const bid = await getBidById(bidId, organizationId);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found or does not belong to this organization",
      });
    }

    // Pre-validate unique fields before attempting to create
    const uniqueFieldChecks = [];

    // Check job number uniqueness within the organization
    if (jobNumber) {
      uniqueFieldChecks.push({
        field: "jobNumber",
        value: jobNumber,
        checkFunction: () => checkJobNumberExists(jobNumber, organizationId),
        message: `A job with number '${jobNumber}' already exists in this organization`,
      });
    }

    // Validate all unique fields
    const validationErrors = await validateUniqueFields(uniqueFieldChecks);
    if (validationErrors.length > 0) {
      return res.status(409).json(buildConflictResponse(validationErrors));
    }

    const { assignedTeamMembers, ...jobFields } = req.body;
    
    const jobData = {
      ...jobFields,
      bidId, // Ensure bidId is included
      createdBy,
      assignedTeamMembers, // Include assignedTeamMembers to be processed by service
    };

    // Remove organizationId and propertyId from jobData as they're no longer needed
    delete jobData.organizationId;
    delete jobData.propertyId;

    const job = await createJob(jobData);

    if (!job) {
      return res.status(500).json({
        success: false,
        message: "Failed to create job",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: job.id,
      organizationId: organizationId,
      action: "job_created",
      description: `Job "${job.name}" was created`,
      createdBy: createdBy,
    });

    logger.info("Job created successfully");
    return res.status(201).json({
      success: true,
      data: job,
      message: "Job created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating job", error, req);

    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);

      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
        technicalDetails:
          process.env.NODE_ENV === "development"
            ? parsedError.technicalMessage
            : undefined,
      });
    }

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while creating the job",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const updateJobHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["id"])) return;
    const { id } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;
    const { jobNumber } = req.body;

    // Get original job for history tracking
    const originalJob = await getJobById(id!, organizationId);
    if (!originalJob) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Pre-validate unique fields before attempting to update
    const uniqueFieldChecks = [];

    // Check job number uniqueness (if provided and different from current)
    if (jobNumber && jobNumber !== originalJob.jobNumber) {
      uniqueFieldChecks.push({
        field: "jobNumber",
        value: jobNumber,
        checkFunction: () => checkJobNumberExists(jobNumber, organizationId, id),
        message: `A job with number '${jobNumber}' already exists in this organization`,
      });
    }

    // Validate all unique fields
    const validationErrors = await validateUniqueFields(uniqueFieldChecks);
    if (validationErrors.length > 0) {
      return res.status(409).json(buildConflictResponse(validationErrors));
    }

    const updatedJob = await updateJob(id!, organizationId, req.body);

    if (!updatedJob) {
      return res.status(404).json({
        success: false,
        message: "Job not found or failed to update",
      });
    }

    // Create history entries for changed fields
    for (const [key, value] of Object.entries(req.body)) {
      const oldValue = (originalJob as any)[key];
      if (oldValue !== value) {
        await createJobHistoryEntry({
          jobId: id!,
          organizationId: organizationId,
          action: `field_updated_${key}`,
          description: `Field "${key}" was updated`,
          createdBy: performedBy,
        });
      }
    }

    logger.info("Job updated successfully");
    return res.status(200).json({
      success: true,
      data: updatedJob,
      message: "Job updated successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error updating job", error, req);

    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);

      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
        technicalDetails:
          process.env.NODE_ENV === "development"
            ? parsedError.technicalMessage
            : undefined,
      });
    }

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while updating the job",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deleteJobHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["id"])) return;
    const { id } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const deletedJob = await deleteJob(id!, organizationId);

    if (!deletedJob) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: id!,
      organizationId: organizationId,
      action: "job_deleted",
      description: `Job "${deletedJob.name}" was deleted`,
      createdBy: performedBy,
    });

    logger.info("Job deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Team Members Operations
// ============================

export const getJobTeamMembersHandler = async (
  req: Request,
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const teamMembers = await getJobTeamMembers(jobId!, organizationId);

    logger.info("Job team members fetched successfully");
    return res.status(200).json({
      success: true,
      data: teamMembers,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const addJobTeamMemberHandler = async (
  req: Request,
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const memberData = {
      ...req.body,
      jobId: jobId!,
    };

    const member = await addJobTeamMember(memberData);

    if (!member) {
      return res.status(500).json({
        success: false,
        message: "Failed to add team member",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "team_member_added",
      description: "Team member was added",
      createdBy: performedBy,
    });

    logger.info("Job team member added successfully");
    return res.status(201).json({
      success: true,
      data: member,
      message: "Team member added successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const removeJobTeamMemberHandler = async (
  req: Request,
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["jobId", "employeeId"])) return;
    const { jobId, employeeId } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const member = await removeJobTeamMember(jobId!, parseInt(employeeId!), organizationId);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Team member not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "team_member_removed",
      description: "Team member was removed",
      createdBy: performedBy,
    });

    logger.info("Job team member removed successfully");
    return res.status(200).json({
      success: true,
      message: "Team member removed successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Financial Summary Operations
// ============================

export const getJobFinancialSummaryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const summary = await getJobFinancialSummary(jobId!, organizationId);

    logger.info("Job financial summary fetched successfully");
    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateJobFinancialSummaryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const summary = await updateJobFinancialSummary(
      jobId!,
      organizationId,
      req.body
    );

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: "Financial summary not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "financial_summary_updated",
      description: "Financial summary was updated",
      createdBy: performedBy,
    });

    logger.info("Job financial summary updated successfully");
    return res.status(200).json({
      success: true,
      data: summary,
      message: "Financial summary updated successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Financial Breakdown Operations
// ============================

export const getJobFinancialBreakdownHandler = async (
  req: Request,
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    // Get planned financial breakdown from the associated bid
    const breakdown = await getJobPlannedFinancialBreakdown(jobId!, organizationId);

    logger.info("Job planned financial breakdown fetched successfully");
    return res.status(200).json({
      success: true,
      data: breakdown,
      message: "Planned financial breakdown retrieved from bid",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateJobFinancialBreakdownHandler = async (
  req: Request,
  res: Response
) => {
  try {
    // Financial breakdown updates should be done on the associated bid
    // This endpoint is deprecated - use bid financial breakdown endpoints instead
    return res.status(400).json({
      success: false,
      message: "Financial breakdown updates should be done on the associated bid. Use PUT /bids/:bidId/financial-breakdown instead.",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Materials Operations
// ============================

export const getJobMaterialsHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const materials = await getJobMaterials(jobId!, organizationId);

    logger.info("Job materials fetched successfully");
    return res.status(200).json({
      success: true,
      data: materials,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createJobMaterialHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const materialData = {
      ...req.body,
      jobId: jobId!,
      organizationId,
    };

    const material = await createJobMaterial(materialData);

    if (!material) {
      return res.status(500).json({
        success: false,
        message: "Failed to create material",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "material_added",
      description: `Material "${material.materialName}" was added`,
      createdBy: performedBy,
    });

    logger.info("Job material created successfully");
    return res.status(201).json({
      success: true,
      data: material,
      message: "Material added successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateJobMaterialHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["materialId", "jobId"])) return;
    const { materialId, jobId } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const material = await updateJobMaterial(
      materialId!,
      jobId!,
      organizationId,
      req.body
    );

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "material_updated",
      description: `Material "${material.materialName || "Unknown"}" was updated`,
      createdBy: performedBy,
    });

    logger.info("Job material updated successfully");
    return res.status(200).json({
      success: true,
      data: material,
      message: "Material updated successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteJobMaterialHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["materialId", "jobId"])) return;
    const { materialId, jobId } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const material = await deleteJobMaterial(materialId!, jobId!, organizationId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "material_deleted",
      description: `Material deleted`,
      createdBy: performedBy,
    });

    logger.info("Job material deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Material deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Labor Operations
// ============================

export const getJobLaborHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const labor = await getJobLabor(jobId!, organizationId);

    logger.info("Job labor fetched successfully");
    return res.status(200).json({
      success: true,
      data: labor,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createJobLaborHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const laborData = {
      ...req.body,
      jobId: jobId!,
      organizationId,
    };

    const labor = await createJobLabor(laborData);

    if (!labor) {
      return res.status(500).json({
        success: false,
        message: "Failed to create labor entry",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "labor_added",
      description: `Labor entry was added`,
      createdBy: performedBy,
    });

    logger.info("Job labor created successfully");
    return res.status(201).json({
      success: true,
      data: labor,
      message: "Labor added successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateJobLaborHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["laborId", "jobId"])) return;
    const { laborId } = req.params;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const labor = await updateJobLabor(laborId!, jobId!, organizationId, req.body);

    if (!labor) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "labor_updated",
      description: `Labor entry was updated`,
      createdBy: performedBy,
    });

    logger.info("Job labor updated successfully");
    return res.status(200).json({
      success: true,
      data: labor,
      message: "Labor updated successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteJobLaborHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["laborId", "jobId"])) return;
    const { laborId } = req.params;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const labor = await deleteJobLabor(laborId!, jobId!, organizationId);

    if (!labor) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "labor_deleted",
      description: `Labor entry was deleted`,
      createdBy: performedBy,
    });

    logger.info("Job labor deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Labor deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Travel Operations
// ============================

export const getJobTravelHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const travel = await getJobTravel(jobId!, organizationId);

    logger.info("Job travel fetched successfully");
    return res.status(200).json({
      success: true,
      data: travel,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createJobTravelHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const travelData = {
      ...req.body,
      jobId: jobId!,
      organizationId,
    };

    const travel = await createJobTravel(travelData);

    if (!travel) {
      return res.status(500).json({
        success: false,
        message: "Failed to create travel entry",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "travel_added",
      description: "Travel entry was added",
      createdBy: performedBy,
    });

    logger.info("Job travel created successfully");
    return res.status(201).json({
      success: true,
      data: travel,
      message: "Travel added successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateJobTravelHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["travelId", "jobId"])) return;
    const { travelId } = req.params;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const travel = await updateJobTravel(travelId!, jobId!, organizationId, req.body);

    if (!travel) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "travel_updated",
      description: "Travel entry was updated",
      createdBy: performedBy,
    });

    logger.info("Job travel updated successfully");
    return res.status(200).json({
      success: true,
      data: travel,
      message: "Travel updated successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteJobTravelHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["travelId", "jobId"])) return;
    const { travelId } = req.params;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const travel = await deleteJobTravel(travelId!, jobId!, organizationId);

    if (!travel) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "travel_deleted",
      description: "Travel entry was deleted",
      createdBy: performedBy,
    });

    logger.info("Job travel deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Travel deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Operating Expenses Operations
// ============================

export const getJobOperatingExpensesHandler = async (
  req: Request,
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    // Get planned operating expenses from the associated bid
    const expenses = await getJobPlannedOperatingExpenses(jobId!, organizationId);

    logger.info("Job planned operating expenses fetched successfully");
    return res.status(200).json({
      success: true,
      data: expenses,
      message: "Planned operating expenses retrieved from bid",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateJobOperatingExpensesHandler = async (
  req: Request,
  res: Response
) => {
  try {
    // Operating expenses updates should be done on the associated bid
    // This endpoint is deprecated - use bid operating expenses endpoints instead
    return res.status(400).json({
      success: false,
      message: "Operating expenses updates should be done on the associated bid. Use PUT /bids/:bidId/operating-expenses instead.",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Timeline Operations
// ============================

export const getJobTimelineHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const timeline = await getJobTimeline(jobId!, organizationId);

    logger.info("Job timeline fetched successfully");
    return res.status(200).json({
      success: true,
      data: timeline,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createJobTimelineEventHandler = async (
  req: Request,
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const eventData = {
      ...req.body,
      jobId: jobId!,
      organizationId,
      createdBy: performedBy,
    };

    const event = await createJobTimelineEvent(eventData);

    if (!event) {
      return res.status(500).json({
        success: false,
        message: "Failed to create timeline event",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "timeline_event_added",
      description: `Timeline event "${event.eventName}" was added`,
      createdBy: performedBy,
    });

    logger.info("Job timeline event created successfully");
    return res.status(201).json({
      success: true,
      data: event,
      message: "Timeline event added successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateJobTimelineEventHandler = async (
  req: Request,
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["eventId", "jobId"])) return;
    const { eventId } = req.params;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const event = await updateJobTimelineEvent(
      eventId!,
      jobId!,
      organizationId,
      req.body
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Timeline event not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "timeline_event_updated",
      description: `Timeline event "${event?.eventName || "Unknown"}" was updated`,
      createdBy: performedBy,
    });

    logger.info("Job timeline event updated successfully");
    return res.status(200).json({
      success: true,
      data: event,
      message: "Timeline event updated successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteJobTimelineEventHandler = async (
  req: Request,
  res: Response
) => {
  try {
    if (!validateParams(req, res, ["eventId", "jobId"])) return;
    const { eventId } = req.params;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const event = await deleteJobTimelineEvent(eventId!, jobId!, organizationId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Timeline event not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "timeline_event_deleted",
      description: `Timeline event was deleted`,
      createdBy: performedBy,
    });

    logger.info("Job timeline event deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Timeline event deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Notes Operations
// ============================

export const getJobNotesHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const notes = await getJobNotes(jobId!, organizationId);

    logger.info("Job notes fetched successfully");
    return res.status(200).json({
      success: true,
      data: notes,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createJobNoteHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const noteData = {
      ...req.body,
      jobId: jobId!,
      organizationId,
      createdBy: performedBy,
    };

    const note = await createJobNote(noteData);

    if (!note) {
      return res.status(500).json({
        success: false,
        message: "Failed to create note",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "note_added",
      description: "Note was added to job",
      createdBy: performedBy,
    });

    logger.info("Job note created successfully");
    return res.status(201).json({
      success: true,
      data: note,
      message: "Note added successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateJobNoteHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["noteId", "jobId"])) return;
    const { noteId } = req.params;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const note = await updateJobNote(noteId!, jobId!, organizationId, req.body);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "note_updated",
      description: "Note was updated",
      createdBy: performedBy,
    });

    logger.info("Job note updated successfully");
    return res.status(200).json({
      success: true,
      data: note,
      message: "Note updated successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteJobNoteHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["noteId", "jobId"])) return;
    const { noteId } = req.params;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const note = await deleteJobNote(noteId!, jobId!, organizationId);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "note_deleted",
      description: "Note was deleted",
      createdBy: performedBy,
    });

    logger.info("Job note deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Note deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// History Operations
// ============================

export const getJobHistoryHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const history = await getJobHistory(jobId!, organizationId);

    logger.info("Job history fetched successfully");
    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Tasks Operations
// ============================

export const getJobTasksHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const tasks = await getJobTasks(jobId!, organizationId);

    logger.info("Job tasks fetched successfully");
    return res.status(200).json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createJobTaskHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const taskData = {
      ...req.body,
      jobId: jobId!,
      organizationId,
      createdBy: performedBy,
    };

    const task = await createJobTask(taskData);

    if (!task) {
      return res.status(500).json({
        success: false,
        message: "Failed to create task",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "task_added",
      description: `Task "${task.taskName}" was added`,
      createdBy: performedBy,
    });

    logger.info("Job task created successfully");
    return res.status(201).json({
      success: true,
      data: task,
      message: "Task added successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateJobTaskHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["taskId", "jobId"])) return;
    const { taskId } = req.params;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const task = await updateJobTask(taskId!, jobId!, organizationId, req.body);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "task_updated",
      description: `Task updated`,
      createdBy: performedBy,
    });

    logger.info("Job task updated successfully");
    return res.status(200).json({
      success: true,
      data: task,
      message: "Task updated successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteJobTaskHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["taskId", "jobId"])) return;
    const { taskId } = req.params;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const task = await deleteJobTask(taskId!, jobId!, organizationId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "task_deleted",
      description: `Task deleted`,
      createdBy: performedBy,
    });

    logger.info("Job task deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Expenses Operations
// ============================

export const getJobExpensesHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const expenses = await getJobExpenses(jobId!, organizationId);

    logger.info("Job expenses fetched successfully");
    return res.status(200).json({
      success: true,
      data: expenses,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createJobExpenseHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const expenseData = {
      ...req.body,
      jobId: jobId!,
      organizationId,
      createdBy: performedBy,
    };

    const expense = await createJobExpense(expenseData);

    if (!expense) {
      return res.status(500).json({
        success: false,
        message: "Failed to create expense",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "expense_added",
      description: `Expense was added`,
      createdBy: performedBy,
    });

    logger.info("Job expense created successfully");
    return res.status(201).json({
      success: true,
      data: expense,
      message: "Expense added successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateJobExpenseHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["expenseId", "jobId"])) return;
    const { expenseId } = req.params;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const expense = await updateJobExpense(expenseId!, jobId!, organizationId, req.body);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "expense_updated",
      description: `Expense was updated`,
      createdBy: performedBy,
    });

    logger.info("Job expense updated successfully");
    return res.status(200).json({
      success: true,
      data: expense,
      message: "Expense updated successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteJobExpenseHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["expenseId", "jobId"])) return;
    const { expenseId } = req.params;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const expense = await deleteJobExpense(expenseId!, jobId!, organizationId);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "expense_deleted",
      description: `Expense deleted`,
      createdBy: performedBy,
    });

    logger.info("Job expense deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Documents Operations
// ============================

export const getJobDocumentsHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const documents = await getJobDocuments(jobId!, organizationId);

    logger.info("Job documents fetched successfully");
    return res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createJobDocumentHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const documentData = {
      ...req.body,
      jobId: jobId!,
      organizationId,
      uploadedBy: performedBy,
    };

    const document = await createJobDocument(documentData);

    if (!document) {
      return res.status(500).json({
        success: false,
        message: "Failed to create document",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "document_added",
      description: `Document was added`,
      createdBy: performedBy,
    });

    logger.info("Job document created successfully");
    return res.status(201).json({
      success: true,
      data: document,
      message: "Document added successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteJobDocumentHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["documentId", "jobId"])) return;
    const { documentId } = req.params;
    const { jobId } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const performedBy = req.user!.id;

    const document = await deleteJobDocument(documentId!, jobId!, organizationId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "document_deleted",
      description: `Document deleted`,
      createdBy: performedBy,
    });

    logger.info("Job document deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// Complete Job Data
// ============================

export const getJobWithAllDataHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["id"])) return;
    const { id } = req.params;
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const jobData = await getJobWithAllData(id!, organizationId);

    if (!jobData) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    logger.info("Job with all data fetched successfully");
    return res.status(200).json({
      success: true,
      data: jobData,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};




