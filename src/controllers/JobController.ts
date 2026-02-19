import type { Request, Response } from "express";
import { asSingleString } from "../utils/request-helpers.js";

// Access control: use USER data (req.user.id), not organization.
// Organization = CLIENT data (see .cursorrules). For job handlers, get client org from the job (job.organizationId from bid).
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

// Helper function to validate required params
const validateParams = (
  req: Request,
  res: Response,
  paramNames: string[],
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
  getJobMaterialById,
  createJobMaterial,
  updateJobMaterial,
  deleteJobMaterial,
  getJobLabor,
  getJobLaborById,
  createJobLabor,
  updateJobLabor,
  deleteJobLabor,
  getJobTravel,
  getJobTravelById,
  createJobTravel,
  updateJobTravel,
  deleteJobTravel,
  getJobPlannedOperatingExpenses,
  getJobTimeline,
  getJobTimelineEventById,
  createJobTimelineEvent,
  updateJobTimelineEvent,
  deleteJobTimelineEvent,
  getJobNotes,
  getJobNoteById,
  createJobNote,
  updateJobNote,
  deleteJobNote,
  getJobHistory,
  createJobHistoryEntry,
  getJobTasks,
  getJobTaskById,
  createJobTask,
  updateJobTask,
  deleteJobTask,
  getTaskComments,
  getTaskCommentById,
  createTaskComment,
  updateTaskComment,
  deleteTaskComment,
  getJobSurveys,
  getJobSurveyById,
  createJobSurvey,
  updateJobSurvey,
  deleteJobSurvey,
  getJobExpenses,
  getJobExpenseById,
  createJobExpense,
  updateJobExpense,
  deleteJobExpense,
  getJobWithAllData,
  getJobInvoiceKPIs,
  getJobLaborCostTracking,
  getJobsKPIs,
  bulkDeleteJobs,
} from "../services/job.service.js";
import { getOrganizationById } from "../services/client.service.js";
import { uploadToSpaces } from "../services/storage.service.js";
import { getDataFilterConditions } from "../services/featurePermission.service.js";

/**
 * Checks whether the requesting user (if subject to assigned_only filter) is
 * a team member on the given job.
 * Returns true if access is allowed, false after sending a 404 response
 * (consistent with how getJobByIdHandler handles this case).
 */
const checkJobAssignedAccess = async (
  req: Request,
  res: Response,
  jobId: string,
): Promise<boolean> => {
  const userId = req.user?.id;
  if (!userId) return true;

  const dataFilter = await getDataFilterConditions(userId, "jobs");
  if (!dataFilter.assignedOnly) return true;

  const job = await getJobById(jobId, { userId, applyAssignedOrTeamFilter: true });
  if (!job) {
    res.status(404).json({ success: false, message: "Job not found" });
    return false;
  }
  return true;
};

// ============================
// Main Job Operations
// ============================

export const getJobsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const offset = (page - 1) * limit;

    const filters: {
      status?: string;
      priority?: string;
      search?: string;
    } = {};

    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.priority) filters.priority = req.query.priority as string;
    if (req.query.search) filters.search = req.query.search as string;

    const dataFilter = await getDataFilterConditions(userId, "jobs");
    const options = dataFilter.assignedOnly
      ? { userId, applyAssignedOrTeamFilter: true }
      : undefined;

    const jobs = await getJobs(
      offset,
      limit,
      Object.keys(filters).length > 0 ? filters : undefined,
      options,
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
    const id = asSingleString(req.params.id);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const dataFilter = await getDataFilterConditions(userId, "jobs");
    const options = dataFilter.assignedOnly
      ? { userId, applyAssignedOrTeamFilter: true }
      : undefined;

    const job = await getJobById(id!, options);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Get client (organization) info from job's organizationId (from bid)
    const clientInfo = await getOrganizationById(job.organizationId);

    logger.info("Job fetched successfully");
    return res.status(200).json({
      success: true,
      data: {
        ...job,
        clientInfo: clientInfo?.organization ?? null,
      },
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
    // Remove organization validation - trust bid ID access
    const createdBy = req.user!.id;
    const { bidId } = req.body;

    // Validate bidId is provided
    if (!bidId) {
      return res.status(400).json({
        success: false,
        message: "bidId is required",
      });
    }

    // Get bid directly by ID - trust user has legitimate access
    const { getBidByIdSimple } = await import("../services/bid.service.js");
    const bid = await getBidByIdSimple(bidId);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const { assignedTeamMembers, ...jobFields } = req.body;

    // Strip auto-generated field - jobNumber is always system-generated
    delete jobFields.jobNumber;

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

    // Create history entry using bid's organization
    await createJobHistoryEntry({
      jobId: job.id,
      organizationId: bid.organizationId,
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
    const id = asSingleString(req.params.id);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    // Get original job for history tracking
    const originalJob = await getJobById(id!);
    if (!originalJob) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const clientOrgId = originalJob.organizationId;
    const bidId = originalJob.bidId;

    // Extract nested bid objects from request body
    const {
      bidData,
      financialBreakdown,
      operatingExpenses,
      materials,
      laborAndTravel,
      surveyData,
      planSpecData,
      designBuildData,
      timeline,
      notes,
      documentIdsToUpdate,
      documentUpdates,
      documentIdsToDelete,
      mediaIdsToUpdate,
      mediaUpdates,
      mediaIdsToDelete,
      ...jobFields
    } = req.body;

    // Strip auto-generated field - jobNumber is always system-generated
    delete jobFields.jobNumber;

    // Update job with only job fields
    const updatedJob = await updateJob(id!, jobFields);

    if (!updatedJob) {
      return res.status(404).json({
        success: false,
        message: "Job not found or failed to update",
      });
    }

    // Update related bid records if provided
    const updatedRecords: any = {};

    // Import bid service functions
    const {
      updateBid,
      updateBidFinancialBreakdown,
      updateBidOperatingExpenses,
      getBidMaterials,
      deleteBidMaterial,
      createBidMaterial,
      getBidLabor,
      deleteBidLabor,
      createBulkLaborAndTravel,
      updateBidSurveyData,
      updateBidPlanSpecData,
      updateBidDesignBuildData,
      createBidTimelineEvent,
      updateBidTimelineEvent,
      deleteBidTimelineEvent,
      createBidNote,
      updateBidNote,
      deleteBidNote,
      getBidDocumentById,
      updateBidDocument,
      deleteBidDocument,
      getBidMediaById,
      updateBidMedia,
      deleteBidMedia,
      getBidById,
    } = await import("../services/bid.service.js");

    // Get the bid to determine jobType
    const bid = await getBidById(bidId);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Associated bid not found",
      });
    }

    // Update bid data if provided
    if (bidData) {
      updatedRecords.bid = await updateBid(bidId, clientOrgId, bidData);
    }

    // Update financial breakdown if provided
    if (financialBreakdown) {
      updatedRecords.financialBreakdown = await updateBidFinancialBreakdown(
        bidId,
        clientOrgId,
        financialBreakdown,
      );
    }

    // Update operating expenses if provided
    if (operatingExpenses) {
      updatedRecords.operatingExpenses = await updateBidOperatingExpenses(
        bidId,
        clientOrgId,
        operatingExpenses,
      );
    }

    // Update materials if provided (delete existing and create new)
    if (materials && Array.isArray(materials)) {
      const existingMaterials = await getBidMaterials(bidId, clientOrgId);

      // Delete all existing materials
      for (const material of existingMaterials) {
        await deleteBidMaterial(material.id, clientOrgId);
      }

      // Create new materials
      if (materials.length > 0) {
        updatedRecords.materials = [];
        for (const material of materials) {
          const createdMaterial = await createBidMaterial({
            ...material,
            bidId,
          });
          updatedRecords.materials.push(createdMaterial);
        }
      } else {
        updatedRecords.materials = [];
      }
    }

    // Update labor and travel if provided (delete existing and create new in bulk)
    if (laborAndTravel) {
      const { labor, travel } = laborAndTravel;
      if (labor && travel && Array.isArray(labor) && Array.isArray(travel)) {
        // Get existing labor entries
        const existingLabor = await getBidLabor(bidId);

        // Delete all existing labor (this will cascade delete travel)
        for (const laborEntry of existingLabor) {
          await deleteBidLabor(laborEntry.id);
        }

        // Create new labor and travel in bulk
        if (labor.length === travel.length && labor.length > 0) {
          const bulkResult = await createBulkLaborAndTravel(
            bidId,
            labor,
            travel,
          );
          updatedRecords.labor = bulkResult.labor;
          updatedRecords.travel = bulkResult.travel;
        } else {
          updatedRecords.labor = [];
          updatedRecords.travel = [];
        }
      }
    }

    // Update type-specific data if provided
    const jobType = bid.jobType;
    if (surveyData && jobType === "survey") {
      updatedRecords.surveyData = await updateBidSurveyData(
        bidId,
        clientOrgId,
        surveyData,
      );
    } else if (planSpecData && jobType === "plan_spec") {
      updatedRecords.planSpecData = await updateBidPlanSpecData(
        bidId,
        clientOrgId,
        planSpecData,
      );
    } else if (designBuildData && jobType === "design_build") {
      updatedRecords.designBuildData = await updateBidDesignBuildData(
        bidId,
        clientOrgId,
        designBuildData,
      );
    }

    // Handle timeline operations
    if (timeline && Array.isArray(timeline)) {
      updatedRecords.timeline = {
        created: [],
        updated: [],
        deleted: [],
      };

      for (const timelineEvent of timeline) {
        const { id: eventId, _delete, ...eventData } = timelineEvent;

        if (_delete && eventId) {
          // Delete existing event
          const deleted = await deleteBidTimelineEvent(eventId);
          if (deleted) updatedRecords.timeline.deleted.push(deleted);
        } else if (eventId) {
          // Update existing event
          const updated = await updateBidTimelineEvent(eventId, eventData);
          if (updated) updatedRecords.timeline.updated.push(updated);
        } else {
          // Create new event
          const created = await createBidTimelineEvent({
            ...eventData,
            bidId,
          });
          updatedRecords.timeline.created.push(created);
        }
      }
    }

    // Handle notes operations
    if (notes && Array.isArray(notes)) {
      updatedRecords.notes = {
        created: [],
        updated: [],
        deleted: [],
      };

      for (const noteItem of notes) {
        const { id: noteId, _delete, ...noteData } = noteItem;

        if (_delete && noteId) {
          // Delete existing note
          const deleted = await deleteBidNote(noteId);
          if (deleted) updatedRecords.notes.deleted.push(deleted);
        } else if (noteId) {
          // Update existing note
          const updated = await updateBidNote(noteId, noteData);
          if (updated) updatedRecords.notes.updated.push(updated);
        } else {
          // Create new note
          const created = await createBidNote({
            ...noteData,
            bidId,
            createdBy: performedBy,
          });
          updatedRecords.notes.created.push(created);
        }
      }
    }

    // Handle document and media operations
    const documentUpdatesResult: any = {};

    // Handle new document uploads (document_0, document_1, etc.)
    const files = (req.files as Express.Multer.File[]) || [];
    const documentFiles = files.filter((file) =>
      file.fieldname.startsWith("document_"),
    );

    if (documentFiles.length > 0) {
      const { createBidDocument } = await import("../services/bid.service.js");
      const uploadedDocuments = [];

      for (let i = 0; i < documentFiles.length; i++) {
        const file = documentFiles[i];
        if (!file) continue;

        try {
          const uploadResult = await uploadToSpaces(
            file.buffer,
            file.originalname,
            "bid-documents",
          );

          const document = await createBidDocument({
            bidId,
            fileName: file.originalname,
            filePath: uploadResult.url,
            fileType: file.mimetype,
            fileSize: file.size,
            uploadedBy: performedBy,
          });

          uploadedDocuments.push(document);
        } catch (uploadError: any) {
          logger.error(
            `Error uploading document ${file.originalname}:`,
            uploadError,
          );
        }
      }

      if (uploadedDocuments.length > 0) {
        documentUpdatesResult.added = uploadedDocuments;
      }
    }

    // Handle new media uploads (media_0, media_1, etc.)
    const mediaFiles = files.filter((file) =>
      file.fieldname.startsWith("media_"),
    );

    const mediaUpdatesResult: any = {};

    if (mediaFiles.length > 0) {
      const { createBidMedia } = await import("../services/bid.service.js");
      const uploadedMedia = [];

      for (let i = 0; i < mediaFiles.length; i++) {
        const file = mediaFiles[i];
        if (!file) continue;

        try {
          const uploadResult = await uploadToSpaces(
            file.buffer,
            file.originalname,
            "bid-media",
          );

          const media = await createBidMedia({
            bidId,
            fileName: file.originalname,
            filePath: uploadResult.url,
            fileType: file.mimetype,
            fileSize: file.size,
            uploadedBy: performedBy,
          });

          uploadedMedia.push(media);
        } catch (uploadError: any) {
          logger.error(
            `Error uploading media ${file.originalname}:`,
            uploadError,
          );
        }
      }

      if (uploadedMedia.length > 0) {
        mediaUpdatesResult.added = uploadedMedia;
      }
    }

    // Handle document updates
    if (documentIdsToUpdate && Array.isArray(documentIdsToUpdate)) {
      const documentUpdatesList = documentUpdates || [];
      const updatedDocuments = [];

      for (let i = 0; i < documentIdsToUpdate.length; i++) {
        const documentId = documentIdsToUpdate[i];
        const updateData = documentUpdatesList[i] || {};

        try {
          const existingDoc = await getBidDocumentById(documentId);
          if (existingDoc && existingDoc.bidId === bidId) {
            const updated = await updateBidDocument(documentId, {
              fileName: updateData.fileName,
              documentType: updateData.documentType,
            });
            if (updated) updatedDocuments.push(updated);
          }
        } catch (error: any) {
          logger.error(`Error updating document ${documentId}:`, error);
        }
      }

      if (updatedDocuments.length > 0) {
        documentUpdatesResult.updated = updatedDocuments;
      }
    }

    // Handle document deletions
    if (documentIdsToDelete && Array.isArray(documentIdsToDelete)) {
      const deletedDocuments = [];

      for (const documentId of documentIdsToDelete) {
        try {
          const existingDoc = await getBidDocumentById(documentId);
          if (existingDoc && existingDoc.bidId === bidId) {
            const deleted = await deleteBidDocument(documentId);
            if (deleted) deletedDocuments.push(deleted);
          }
        } catch (error: any) {
          logger.error(`Error deleting document ${documentId}:`, error);
        }
      }

      if (deletedDocuments.length > 0) {
        documentUpdatesResult.deleted = deletedDocuments;
      }
    }

    if (Object.keys(documentUpdatesResult).length > 0) {
      updatedRecords.documents = documentUpdatesResult;
    }

    // Handle media updates (mediaUpdatesResult already initialized above)
    if (mediaIdsToUpdate && Array.isArray(mediaIdsToUpdate)) {
      const mediaUpdatesList = mediaUpdates || [];
      const updatedMediaList = [];

      for (let i = 0; i < mediaIdsToUpdate.length; i++) {
        const mediaId = mediaIdsToUpdate[i];
        const updateData = mediaUpdatesList[i] || {};

        try {
          const existingMedia = await getBidMediaById(mediaId);
          if (existingMedia && existingMedia.bidId === bidId) {
            const updated = await updateBidMedia(mediaId, {
              fileName: updateData.fileName,
              mediaType: updateData.mediaType,
            });
            if (updated) updatedMediaList.push(updated);
          }
        } catch (error: any) {
          logger.error(`Error updating media ${mediaId}:`, error);
        }
      }

      if (updatedMediaList.length > 0) {
        mediaUpdatesResult.updated = updatedMediaList;
      }
    }

    // Handle media deletions
    if (mediaIdsToDelete && Array.isArray(mediaIdsToDelete)) {
      const deletedMediaList = [];

      for (const mediaId of mediaIdsToDelete) {
        try {
          const existingMedia = await getBidMediaById(mediaId);
          if (existingMedia && existingMedia.bidId === bidId) {
            const deleted = await deleteBidMedia(mediaId);
            if (deleted) deletedMediaList.push(deleted);
          }
        } catch (error: any) {
          logger.error(`Error deleting media ${mediaId}:`, error);
        }
      }

      if (deletedMediaList.length > 0) {
        mediaUpdatesResult.deleted = deletedMediaList;
      }
    }

    if (Object.keys(mediaUpdatesResult).length > 0) {
      updatedRecords.media = mediaUpdatesResult;
    }

    // Create history entries for changed job fields
    for (const [key, value] of Object.entries(jobFields)) {
      const oldValue = (originalJob as any)[key];
      if (oldValue !== value) {
        await createJobHistoryEntry({
          jobId: id!,
          organizationId: originalJob.organizationId,
          action: `field_updated_${key}`,
          description: `Field "${key}" was updated`,
          createdBy: performedBy,
        });
      }
    }

    // Create history entry for bid data updates if any were made
    if (Object.keys(updatedRecords).length > 0) {
      await createJobHistoryEntry({
        jobId: id!,
        organizationId: originalJob.organizationId,
        action: "bid_data_updated",
        description: "Associated bid data was updated",
        createdBy: performedBy,
      });
    }

    logger.info("Job and associated bid data updated successfully");
    return res.status(200).json({
      success: true,
      data: {
        job: updatedJob,
        ...updatedRecords,
      },
      message: "Job and associated bid data updated successfully",
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
    const id = asSingleString(req.params.id);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const deletedJob = await deleteJob(id!, performedBy);

    if (!deletedJob) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Create history entry - get organizationId from the job's bid
    // TODO: We may need to fetch the organizationId from the job before deletion
    // For now, we'll skip the history entry or handle it differently
    // await createJobHistoryEntry({
    //   jobId: id!,
    //   organizationId: deletedJob.organizationId,
    //   action: "job_deleted",
    //   description: `Job "${deletedJob.name}" was deleted`,
    //   createdBy: performedBy,
    // });

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

export const getJobTeamMembersHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const jobId = asSingleString(req.params.jobId);
    const roleName = req.query.roleName as string | undefined;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const teamMembers = await getJobTeamMembers(jobId!, {
      ...(roleName && { roleName }),
    });

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

export const addJobTeamMemberHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const jobId = asSingleString(req.params.jobId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

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
      organizationId: clientOrgId,
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
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["jobId", "employeeId"])) return;
    const jobId = asSingleString(req.params.jobId);
    const employeeId = asSingleString(req.params.employeeId);

    const _userId = validateUserAccess(req, res);
    if (!_userId) return;

    const _performedBy = req.user!.id;

    const member = await removeJobTeamMember(jobId!, parseInt(employeeId!));

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Team member not found",
      });
    }

    // Create history entry - temporarily disabled until we implement proper organizationId fetching
    // TODO: Get organizationId from job data for history entry
    // await createJobHistoryEntry({
    //   jobId: jobId!,
    //   organizationId: jobOrganizationId,
    //   action: "team_member_removed",
    //   description: "Team member was removed",
    //   createdBy: performedBy,
    // });

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
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const jobId = asSingleString(req.params.jobId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const summary = await getJobFinancialSummary(jobId!);

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

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
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const jobId = asSingleString(req.params.jobId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const summary = await updateJobFinancialSummary(
      jobId!,
      clientOrgId,
      req.body,
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
      organizationId: clientOrgId,
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
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const jobId = asSingleString(req.params.jobId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    // Get planned financial breakdown from the associated bid
    const breakdown = await getJobPlannedFinancialBreakdown(
      jobId!,
      clientOrgId,
    );

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
  res: Response,
) => {
  try {
    // Financial breakdown updates should be done on the associated bid
    // This endpoint is deprecated - use bid financial breakdown endpoints instead
    return res.status(400).json({
      success: false,
      message:
        "Financial breakdown updates should be done on the associated bid. Use PUT /bids/:bidId/financial-breakdown instead.",
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
    const jobId = asSingleString(req.params.jobId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const materials = await getJobMaterials(jobId!);

    if (materials === null) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

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

export const getJobMaterialByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["jobId", "materialId"])) return;
    const jobId = asSingleString(req.params.jobId);
    const materialId = asSingleString(req.params.materialId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const material = await getJobMaterialById(jobId!, materialId!);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    logger.info("Job material fetched successfully");
    return res.status(200).json({
      success: true,
      data: material,
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
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Get job to retrieve organizationId
    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const materialData = {
      ...req.body,
      jobId: jobId!,
    };

    const material = await createJobMaterial(materialData);

    if (!material) {
      return res.status(500).json({
        success: false,
        message: "Failed to create material",
      });
    }

    // Create history entry using job's organizationId
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: job.organizationId,
      action: "material_added",
      description: `Material "${material.description}" was added`,
      createdBy: userId,
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
    const materialId = asSingleString(req.params.materialId);
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Get job to retrieve organizationId
    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const material = await updateJobMaterial(materialId!, jobId!, req.body);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    // Create history entry using job's organizationId
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: job.organizationId,
      action: "material_updated",
      description: `Material "${material.description}" was updated`,
      createdBy: userId,
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
    const materialId = asSingleString(req.params.materialId);
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Get job to retrieve organizationId and verify material exists
    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Get the material before deleting to use in history
    const { getBidMaterialById } = await import("../services/bid.service.js");
    const existingMaterial = await getBidMaterialById(
      materialId!,
      job.organizationId,
    );

    const material = await deleteJobMaterial(materialId!, jobId!);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    // Create history entry using job's organizationId
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: job.organizationId,
      action: "material_deleted",
      description: `Material "${existingMaterial?.description || "Unknown"}" was deleted`,
      createdBy: userId,
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
    const jobId = asSingleString(req.params.jobId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const labor = await getJobLabor(jobId!);

    if (labor === null) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

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

export const getJobLaborByIdHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId", "laborId"])) return;
    const jobId = asSingleString(req.params.jobId);
    const laborId = asSingleString(req.params.laborId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const labor = await getJobLaborById(jobId!, laborId!);

    if (!labor) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found",
      });
    }

    logger.info("Job labor entry fetched successfully");
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
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const laborData = {
      ...req.body,
      jobId: jobId!,
      organizationId: clientOrgId,
    };

    const labor = await createJobLabor(laborData);

    if (!labor) {
      return res.status(404).json({
        success: false,
        message:
          "Job not found or the labor entry could not be created. Please verify the job ID and position ID.",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: clientOrgId,
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
  } catch (error: any) {
    logger.logApiError("Job error", error, req);

    // Check for specific database errors
    if (error?.code === "23503") {
      // Foreign key constraint violation
      if (error?.constraint?.includes("position_id")) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid position ID. The specified position does not exist.",
        });
      }
      if (error?.constraint?.includes("bid_id")) {
        return res.status(400).json({
          success: false,
          message: "Invalid bid ID. The job's associated bid does not exist.",
        });
      }
    }

    return res.status(500).json({
      success: false,
      message: error?.message || "Internal server error",
    });
  }
};

export const updateJobLaborHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["laborId", "jobId"])) return;
    const laborId = asSingleString(req.params.laborId);
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const labor = await updateJobLabor(laborId!, jobId!, clientOrgId, req.body);

    if (!labor) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: clientOrgId,
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
    const laborId = asSingleString(req.params.laborId);
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const labor = await deleteJobLabor(laborId!, jobId!, clientOrgId);

    if (!labor) {
      return res.status(404).json({
        success: false,
        message: "Labor entry not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: clientOrgId,
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
    const jobId = asSingleString(req.params.jobId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const travel = await getJobTravel(jobId!);

    if (travel === null) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

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

export const getJobTravelByIdHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId", "travelId"])) return;
    const jobId = asSingleString(req.params.jobId);
    const travelId = asSingleString(req.params.travelId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const travel = await getJobTravelById(jobId!, travelId!);

    if (!travel) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found",
      });
    }

    logger.info("Job travel entry fetched successfully");
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
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const travelData = {
      ...req.body,
      jobId: jobId!,
      organizationId: clientOrgId,
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
      organizationId: clientOrgId,
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
    const travelId = asSingleString(req.params.travelId);
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const travel = await updateJobTravel(
      travelId!,
      jobId!,
      clientOrgId,
      req.body,
    );

    if (!travel) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: clientOrgId,
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
    const travelId = asSingleString(req.params.travelId);
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const travel = await deleteJobTravel(travelId!, jobId!, clientOrgId);

    if (!travel) {
      return res.status(404).json({
        success: false,
        message: "Travel entry not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: clientOrgId,
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
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const jobId = asSingleString(req.params.jobId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Get operating expenses from the associated bid
    const expenses = await getJobPlannedOperatingExpenses(jobId!);

    if (expenses === null) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    logger.info("Job operating expenses fetched successfully");
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

export const updateJobOperatingExpensesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    // Operating expenses updates should be done on the associated bid
    // This endpoint is deprecated - use bid operating expenses endpoints instead
    return res.status(400).json({
      success: false,
      message:
        "Operating expenses updates should be done on the associated bid. Use PUT /bids/:bidId/operating-expenses instead.",
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
    const jobId = asSingleString(req.params.jobId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const timeline = await getJobTimeline(jobId!);

    if (timeline === null) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

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
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const eventData = {
      ...req.body,
      jobId: jobId!,
      organizationId: clientOrgId,
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
      organizationId: clientOrgId,
      action: "timeline_event_added",
      description: `Timeline event "${event.event}" was added`,
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

export const getJobTimelineEventByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["jobId", "eventId"])) return;
    const jobId = asSingleString(req.params.jobId);
    const eventId = asSingleString(req.params.eventId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const timelineEvent = await getJobTimelineEventById(jobId!, eventId!);

    if (!timelineEvent) {
      return res.status(404).json({
        success: false,
        message: "Timeline event not found",
      });
    }

    logger.info("Job timeline event fetched successfully");
    return res.status(200).json({
      success: true,
      data: timelineEvent,
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
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["eventId", "jobId"])) return;
    const eventId = asSingleString(req.params.eventId);
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const event = await updateJobTimelineEvent(
      eventId!,
      jobId!,
      clientOrgId,
      req.body,
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
      organizationId: clientOrgId,
      action: "timeline_event_updated",
      description: `Timeline event "${event?.event || "Unknown"}" was updated`,
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
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["eventId", "jobId"])) return;
    const eventId = asSingleString(req.params.eventId);
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const event = await deleteJobTimelineEvent(eventId!, jobId!, clientOrgId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Timeline event not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: clientOrgId,
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
    const jobId = asSingleString(req.params.jobId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const notes = await getJobNotes(jobId!);

    if (notes === null) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

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
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const noteData = {
      ...req.body,
      jobId: jobId!,
      organizationId: clientOrgId,
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
      organizationId: clientOrgId,
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

export const getJobNoteByIdHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId", "noteId"])) return;
    const jobId = asSingleString(req.params.jobId);
    const noteId = asSingleString(req.params.noteId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const note = await getJobNoteById(jobId!, noteId!);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    logger.info("Job note fetched successfully");
    return res.status(200).json({
      success: true,
      data: note,
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
    const noteId = asSingleString(req.params.noteId);
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const note = await updateJobNote(noteId!, jobId!, clientOrgId, req.body);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: clientOrgId,
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
    const noteId = asSingleString(req.params.noteId);
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const note = await deleteJobNote(noteId!, jobId!, clientOrgId);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: clientOrgId,
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
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const history = await getJobHistory(jobId!, clientOrgId);

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
    const jobId = asSingleString(req.params.jobId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const tasks = await getJobTasks(jobId!);

    if (tasks === null) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

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
    const jobId = asSingleString(req.params.jobId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const taskData = {
      ...req.body,
      jobId: jobId!,
      createdBy: performedBy,
    };

    const result = await createJobTask(taskData);

    if (!result) {
      return res.status(500).json({
        success: false,
        message: "Failed to create task",
      });
    }

    const { task, organizationId } = result;

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

export const getJobTaskByIdHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId", "taskId"])) return;
    const jobId = asSingleString(req.params.jobId);
    const taskId = asSingleString(req.params.taskId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const task = await getJobTaskById(jobId!, taskId!);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    logger.info("Job task fetched successfully");
    return res.status(200).json({
      success: true,
      data: task,
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
    const taskId = asSingleString(req.params.taskId);
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const task = await updateJobTask(taskId!, jobId!, clientOrgId, req.body);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: clientOrgId,
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
    const taskId = asSingleString(req.params.taskId);
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const task = await deleteJobTask(taskId!, jobId!, clientOrgId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: clientOrgId,
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
// Task Comments Operations
// ============================

export const getTaskCommentsHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId", "taskId"])) return;
    const jobId = asSingleString(req.params.jobId);
    const taskId = asSingleString(req.params.taskId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const comments = await getTaskComments(jobId!, taskId!);

    if (comments === null) {
      return res.status(404).json({
        success: false,
        message: "Job or task not found",
      });
    }

    logger.info("Task comments fetched successfully");
    return res.status(200).json({
      success: true,
      data: comments,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getTaskCommentByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["jobId", "taskId", "id"])) return;
    const jobId = asSingleString(req.params.jobId);
    const taskId = asSingleString(req.params.taskId);
    const commentId = asSingleString(req.params.id);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const comment = await getTaskCommentById(jobId!, taskId!, commentId!);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    logger.info("Task comment fetched successfully");
    return res.status(200).json({
      success: true,
      data: comment,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createTaskCommentHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId", "taskId"])) return;
    const jobId = asSingleString(req.params.jobId);
    const taskId = asSingleString(req.params.taskId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const comment = await createTaskComment({
      jobId: jobId!,
      taskId: taskId!,
      comment: req.body.comment,
      createdBy: userId,
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Job or task not found",
      });
    }

    logger.info("Task comment created successfully");
    return res.status(201).json({
      success: true,
      data: comment,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateTaskCommentHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId", "taskId", "id"])) return;
    const jobId = asSingleString(req.params.jobId);
    const taskId = asSingleString(req.params.taskId);
    const commentId = asSingleString(req.params.id);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const comment = await updateTaskComment(
      commentId!,
      jobId!,
      taskId!,
      req.body,
    );

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    logger.info("Task comment updated successfully");
    return res.status(200).json({
      success: true,
      data: comment,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteTaskCommentHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId", "taskId", "id"])) return;
    const jobId = asSingleString(req.params.jobId);
    const taskId = asSingleString(req.params.taskId);
    const commentId = asSingleString(req.params.id);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const deleted = await deleteTaskComment(commentId!, jobId!, taskId!);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    logger.info("Task comment deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Task comment deleted successfully",
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
// Job Survey Operations
// ============================

export const getJobSurveysHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const surveys = await getJobSurveys(jobId!);
    if (surveys === null) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }
    logger.info("Job surveys fetched successfully");
    return res.status(200).json({ success: true, data: surveys });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getJobSurveyByIdHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId", "id"])) return;
    const jobId = asSingleString(req.params.jobId);
    const surveyId = asSingleString(req.params.id);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const survey = await getJobSurveyById(jobId!, surveyId!);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: "Survey not found",
      });
    }
    logger.info("Job survey fetched successfully");
    return res.status(200).json({ success: true, data: survey });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createJobSurveyHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const survey = await createJobSurvey({
      jobId: jobId!,
      createdBy: userId,
      ...(req.body && typeof req.body === "object" ? req.body : {}),
    });
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }
    logger.info("Job survey created successfully");
    return res.status(201).json({ success: true, data: survey });
  } catch (error: any) {
    logger.logApiError("Job error", error, req);
    if (error?.code === "INVALID_TECHNICIAN") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    if (isDatabaseError(error)) {
      const parsed = parseDatabaseError(error);
      return res.status(parsed.statusCode).json({
        success: false,
        message: parsed.userMessage,
      });
    }
    return res.status(500).json({
      success: false,
      message: error?.message || "Internal server error",
    });
  }
};

export const updateJobSurveyHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId", "id"])) return;
    const jobId = asSingleString(req.params.jobId);
    const surveyId = asSingleString(req.params.id);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const survey = await updateJobSurvey(surveyId!, jobId!, req.body || {});
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: "Survey not found",
      });
    }
    logger.info("Job survey updated successfully");
    return res.status(200).json({ success: true, data: survey });
  } catch (error: any) {
    logger.logApiError("Job error", error, req);
    if (error?.code === "INVALID_TECHNICIAN") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    if (isDatabaseError(error)) {
      const parsed = parseDatabaseError(error);
      return res.status(parsed.statusCode).json({
        success: false,
        message: parsed.userMessage,
      });
    }
    return res.status(500).json({
      success: false,
      message: error?.message || "Internal server error",
    });
  }
};

export const deleteJobSurveyHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId", "id"])) return;
    const jobId = asSingleString(req.params.jobId);
    const surveyId = asSingleString(req.params.id);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const deleted = await deleteJobSurvey(surveyId!, jobId!);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Survey not found",
      });
    }
    logger.info("Job survey deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Job survey deleted successfully",
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
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const expenses = await getJobExpenses(jobId!, clientOrgId);

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

export const getJobExpenseByIdHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId", "expenseId"])) return;
    const jobId = asSingleString(req.params.jobId);
    const expenseId = asSingleString(req.params.expenseId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    const expense = await getJobExpenseById(jobId!, expenseId!);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    logger.info("Job expense fetched successfully");
    return res.status(200).json({
      success: true,
      data: expense,
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
    const jobId = asSingleString(req.params.jobId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    // Upload receipt to Digital Ocean Spaces if file provided (form-data)
    if (req.file) {
      try {
        const { uploadToSpaces } =
          await import("../services/storage.service.js");
        const uploadResult = await uploadToSpaces(
          req.file.buffer,
          req.file.originalname,
          "job-expense-receipts",
        );
        req.body.receiptPath = uploadResult.url;
      } catch (uploadError: unknown) {
        logger.logApiError("Receipt upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload receipt. Please try again.",
        });
      }
    }

    const expenseData = {
      ...req.body,
      jobId: jobId!,
      createdBy: performedBy,
    };

    const result = await createJobExpense(expenseData);

    if (!result) {
      return res.status(500).json({
        success: false,
        message: "Failed to create expense",
      });
    }

    const { expense, organizationId } = result;

    // Create history entry (organizationId from job's bid, not on expense row)
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId,
      action: "expense_added",
      description: `Expense "${expense.expenseType}" was added`,
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
    const expenseId = asSingleString(req.params.expenseId);
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    // Upload receipt to Digital Ocean Spaces if file provided (form-data)
    if (req.file) {
      try {
        const { uploadToSpaces } =
          await import("../services/storage.service.js");
        const uploadResult = await uploadToSpaces(
          req.file.buffer,
          req.file.originalname,
          "job-expense-receipts",
        );
        req.body.receiptPath = uploadResult.url;
      } catch (uploadError: unknown) {
        logger.logApiError("Receipt upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload receipt. Please try again.",
        });
      }
    }

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const expense = await updateJobExpense(
      expenseId!,
      jobId!,
      clientOrgId,
      req.body,
    );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: clientOrgId,
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
    const expenseId = asSingleString(req.params.expenseId);
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const performedBy = req.user!.id;

    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    const clientOrgId = job.organizationId;

    const expense = await deleteJobExpense(expenseId!, jobId!, clientOrgId);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    // Create history entry
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: clientOrgId,
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
    const jobId = asSingleString(req.params.jobId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    // Get job to retrieve bidId
    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Get bid documents using the job's bidId
    const { getBidDocuments } = await import("../services/bid.service.js");
    const documents = await getBidDocuments(job.bidId);

    logger.info(`Job documents fetched successfully for job ${jobId}`);
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

export const createJobDocumentsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["jobId"])) return;
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Get job to retrieve bidId
    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const bidId = job.bidId;

    // Handle file uploads
    const files = (req.files as Express.Multer.File[]) || [];
    const documentFiles = files.filter((file) =>
      file.fieldname.startsWith("document_"),
    );

    if (documentFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files provided. Please upload at least one document.",
      });
    }

    const { uploadToSpaces } = await import("../services/storage.service.js");
    const { createBidDocument, getBidById } =
      await import("../services/bid.service.js");

    // Verify bid exists
    const bid = await getBidById(bidId);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    const uploadedDocuments = [];
    const errors: string[] = [];

    for (const file of documentFiles) {
      if (!file) continue;

      try {
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "bid-documents",
        );

        const document = await createBidDocument({
          bidId: bidId,
          fileName: file.originalname,
          filePath: uploadResult.url,
          fileType: file.mimetype,
          fileSize: file.size,
          uploadedBy: userId,
        });

        uploadedDocuments.push(document);
      } catch (uploadError: any) {
        logger.error(
          `Error uploading document ${file.originalname}:`,
          uploadError,
        );
        errors.push(
          `Failed to upload ${file.originalname}: ${uploadError.message || "Unknown error"}`,
        );
      }
    }

    if (uploadedDocuments.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload any documents",
        errors,
      });
    }

    // Create history entry using job's organizationId
    const { createJobHistoryEntry } =
      await import("../services/job.service.js");
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: job.organizationId,
      action: "document_added",
      description: `${uploadedDocuments.length} document(s) were added`,
      createdBy: userId,
    });

    logger.info(
      `Successfully uploaded ${uploadedDocuments.length} document(s) for job ${jobId}`,
    );

    return res.status(201).json({
      success: true,
      data: uploadedDocuments,
      message: `Successfully uploaded ${uploadedDocuments.length} document(s)`,
      ...(errors.length > 0 && {
        warnings: errors,
        partialSuccess: true,
      }),
    });
  } catch (error: any) {
    logger.logApiError("Error uploading job documents", error, req);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while uploading documents",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getJobDocumentByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!validateParams(req, res, ["jobId", "documentId"])) return;

    const jobId = asSingleString(req.params.jobId);
    const documentId = asSingleString(req.params.documentId);

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    if (!(await checkJobAssignedAccess(req, res, jobId!))) return;

    // Get job to retrieve bidId
    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Get bid document using the job's bidId
    const { getBidDocumentById } = await import("../services/bid.service.js");
    const document = await getBidDocumentById(documentId!);

    if (!document || document.bidId !== job.bidId) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    logger.info(`Job document fetched successfully for job ${jobId}`);
    return res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    logger.logApiError("Job error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateJobDocumentHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["jobId", "documentId"])) return;

    const jobId = asSingleString(req.params.jobId);
    const documentId = asSingleString(req.params.documentId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Get job to retrieve bidId
    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Verify document exists and belongs to the job's bid
    const { getBidDocumentById, updateBidDocument } =
      await import("../services/bid.service.js");
    const existingDocument = await getBidDocumentById(documentId!);
    if (!existingDocument || existingDocument.bidId !== job.bidId) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Handle file upload if provided
    let uploadedFileUrl: string | null = null;
    const file = req.file;
    if (file) {
      try {
        const { uploadToSpaces } =
          await import("../services/storage.service.js");
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "bid-documents",
        );
        uploadedFileUrl = uploadResult.url;
      } catch (uploadError: any) {
        logger.logApiError("File upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload new document file. Please try again.",
        });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (req.body.fileName) updateData.fileName = req.body.fileName;
    if (req.body.documentType) updateData.documentType = req.body.documentType;
    if (uploadedFileUrl) {
      updateData.filePath = uploadedFileUrl;
      if (file) {
        updateData.fileName = file.originalname;
        updateData.fileType = file.mimetype;
        updateData.fileSize = file.size;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    const updatedDocument = await updateBidDocument(documentId!, updateData);

    if (!updatedDocument) {
      return res.status(404).json({
        success: false,
        message: "Document not found or failed to update",
      });
    }

    logger.info(`Job document ${documentId} updated successfully`);
    return res.status(200).json({
      success: true,
      data: updatedDocument,
      message: "Document updated successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error updating job document", error, req);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while updating the document",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deleteJobDocumentHandler = async (req: Request, res: Response) => {
  try {
    if (!validateParams(req, res, ["documentId", "jobId"])) return;
    const documentId = asSingleString(req.params.documentId);
    const jobId = asSingleString(req.params.jobId);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Get job to retrieve bidId and organizationId
    const job = await getJobById(jobId!);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Verify document exists and belongs to the job's bid
    const { getBidDocumentById, deleteBidDocument } =
      await import("../services/bid.service.js");
    const existingDocument = await getBidDocumentById(documentId!);
    if (!existingDocument || existingDocument.bidId !== job.bidId) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const document = await deleteBidDocument(documentId!);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found or failed to delete",
      });
    }

    // Create history entry using job's organizationId
    const { createJobHistoryEntry } =
      await import("../services/job.service.js");
    await createJobHistoryEntry({
      jobId: jobId!,
      organizationId: job.organizationId,
      action: "document_deleted",
      description: `Document "${existingDocument.fileName}" was deleted`,
      createdBy: userId,
    });

    logger.info(`Job document ${documentId} deleted successfully`);
    return res.status(200).json({
      success: true,
      data: document,
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
    const id = asSingleString(req.params.id);
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const jobData = await getJobWithAllData(id!);

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

// ============================
// Job Invoice KPIs
// ============================

/**
 * Get invoice KPIs for a job
 * GET /jobs/:jobId/invoices/kpis
 */
export const getJobInvoiceKPIsHandler = async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId as string;

    const kpis = await getJobInvoiceKPIs(jobId);

    logger.info("Job invoice KPIs fetched successfully", { jobId });
    return res.status(200).json({
      success: true,
      data: kpis,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching job invoice KPIs", error, req);
    return res.status(error.message === "Job not found" ? 404 : 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Get labor cost tracking for a job (based on dispatch assignments)
 * GET /jobs/:jobId/labor/cost-tracking
 */
export const getJobLaborCostTrackingHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const jobId = req.params.jobId as string;

    const tracking = await getJobLaborCostTracking(jobId);

    logger.info("Job labor cost tracking fetched successfully", { jobId });
    return res.status(200).json({
      success: true,
      data: tracking,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching job labor cost tracking", error, req);
    return res.status(error.message === "Job not found" ? 404 : 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * Get jobs KPIs
 * GET /jobs/kpis
 * For technicians (assigned-only), returns KPIs scoped to their assigned/team jobs.
 */
export const getJobsKPIsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const dataFilter = await getDataFilterConditions(userId, "jobs");
    const options = dataFilter.assignedOnly
      ? { userId, applyAssignedOrTeamFilter: true }
      : undefined;
    const kpis = await getJobsKPIs(options);

    logger.info("Jobs KPIs fetched successfully");
    return res.status(200).json({
      success: true,
      data: kpis,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching jobs KPIs", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ===========================================================================
// Bulk Delete
// ===========================================================================

export const bulkDeleteJobsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(403).json({ success: false, message: "Authentication required" });

    const { ids } = req.body as { ids: string[] };
    const result = await bulkDeleteJobs(ids, userId);

    logger.info(`Bulk deleted ${result.deleted} jobs by ${userId}`);
    return res.status(200).json({
      success: true,
      message: `${result.deleted} job(s) deleted. ${result.skipped} skipped (already deleted or not found).`,
      data: result,
    });
  } catch (error) {
    logger.logApiError("Bulk delete jobs error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
