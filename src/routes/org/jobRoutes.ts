import { Router, type IRouter } from "express";
import multer from "multer";
import {
  getJobsHandler,
  getJobByIdHandler,
  createJobHandler,
  updateJobHandler,
  deleteJobHandler,
  getJobTeamMembersHandler,
  addJobTeamMemberHandler,
  removeJobTeamMemberHandler,
  getJobFinancialSummaryHandler,
  updateJobFinancialSummaryHandler,
  getJobFinancialBreakdownHandler,
  updateJobFinancialBreakdownHandler,
  getJobMaterialsHandler,
  getJobMaterialByIdHandler,
  createJobMaterialHandler,
  updateJobMaterialHandler,
  deleteJobMaterialHandler,
  getJobLaborHandler,
  getJobLaborByIdHandler,
  createJobLaborHandler,
  updateJobLaborHandler,
  deleteJobLaborHandler,
  getJobTravelHandler,
  getJobTravelByIdHandler,
  createJobTravelHandler,
  updateJobTravelHandler,
  deleteJobTravelHandler,
  getJobOperatingExpensesHandler,
  updateJobOperatingExpensesHandler,
  getJobTimelineHandler,
  getJobTimelineEventByIdHandler,
  createJobTimelineEventHandler,
  updateJobTimelineEventHandler,
  deleteJobTimelineEventHandler,
  getJobNotesHandler,
  getJobNoteByIdHandler,
  createJobNoteHandler,
  updateJobNoteHandler,
  deleteJobNoteHandler,
  getJobHistoryHandler,
  getJobTasksHandler,
  getJobTaskByIdHandler,
  createJobTaskHandler,
  updateJobTaskHandler,
  deleteJobTaskHandler,
  getJobExpensesHandler,
  getJobExpenseByIdHandler,
  createJobExpenseHandler,
  updateJobExpenseHandler,
  deleteJobExpenseHandler,
  getJobDocumentsHandler,
  createJobDocumentsHandler,
  getJobDocumentByIdHandler,
  updateJobDocumentHandler,
  deleteJobDocumentHandler,
  getJobWithAllDataHandler,
} from "../../controllers/JobController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getJobsQuerySchema,
  getJobByIdSchema,
  createJobSchema,
  updateJobSchema,
  deleteJobSchema,
  getJobTeamMembersSchema,
  addJobTeamMemberSchema,
  removeJobTeamMemberSchema,
  getJobFinancialSummarySchema,
  updateJobFinancialSummarySchema,
  updateJobFinancialBreakdownSchema,
  getJobMaterialsSchema,
  getJobMaterialByIdSchema,
  createJobMaterialSchema,
  updateJobMaterialSchema,
  deleteJobMaterialSchema,
  getJobLaborSchema,
  getJobLaborByIdSchema,
  createJobLaborSchema,
  updateJobLaborSchema,
  deleteJobLaborSchema,
  getJobTravelSchema,
  getJobTravelByIdSchema,
  createJobTravelSchema,
  updateJobTravelSchema,
  deleteJobTravelSchema,
  getJobOperatingExpensesSchema,
  updateJobOperatingExpensesSchema,
  getJobTimelineSchema,
  getJobTimelineEventByIdSchema,
  createJobTimelineEventSchema,
  updateJobTimelineEventSchema,
  deleteJobTimelineEventSchema,
  getJobNotesSchema,
  getJobNoteByIdSchema,
  createJobNoteSchema,
  updateJobNoteSchema,
  deleteJobNoteSchema,
  getJobHistorySchema,
  getJobTasksSchema,
  getJobTaskByIdSchema,
  createJobTaskSchema,
  updateJobTaskSchema,
  deleteJobTaskSchema,
  getJobExpensesSchema,
  getJobExpenseByIdSchema,
  createJobExpenseSchema,
  updateJobExpenseSchema,
  deleteJobExpenseSchema,
  getJobDocumentsSchema,
  createJobDocumentsSchema,
  getJobDocumentByIdSchema,
  updateJobDocumentSchema,
  deleteJobDocumentSchema,
  getJobWithAllDataSchema,
} from "../../validations/job.validations.js";
import { generalTransformer } from "../../middleware/response-transformer.js";

const router: IRouter = Router();

// Configure multer for job document uploads (multiple files with dynamic field names)
// Note: Job documents are stored in bid_documents table via job.bidId
const uploadJobDocuments = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types for documents
    cb(null, true);
  },
}).any(); // Accept any files - controller will handle document_0, document_1, etc. pattern

// Multer for single receipt upload (job expenses)
const uploadReceipt = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for receipts
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image files and PDFs are allowed for receipts"));
    }
  },
}).single("receipt");

// Middleware to parse JSON "data" field from multipart/form-data
const parseFormData = (req: any, res: any, next: any) => {
  if (
    req.headers["content-type"]?.includes("multipart/form-data") &&
    req.body?.data
  ) {
    try {
      const parsedData =
        typeof req.body.data === "string"
          ? JSON.parse(req.body.data)
          : req.body.data;
      req.body = { ...parsedData, ...req.body };
      delete req.body.data;
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON in 'data' field",
      });
    }
  }
  next();
};

// Multer error handler middleware
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large.",
      });
    }
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
    });
  }
  if (err instanceof Error) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  if (err) {
    return res.status(500).json({
      success: false,
      message: "File upload error",
    });
  }
  next();
};

router.use(authenticate);

// Apply timezone transformation to all GET responses
router.use(generalTransformer);

// Main Job Routes

router
  .route("/jobs")
  .get(validate(getJobsQuerySchema), getJobsHandler)
  .post(validate(createJobSchema), createJobHandler);

router
  .route("/jobs/:id")
  .get(validate(getJobByIdSchema), getJobByIdHandler)
  .put(validate(updateJobSchema), updateJobHandler)
  .delete(validate(deleteJobSchema), deleteJobHandler);

// Get job with all related data
router
  .route("/jobs/:id/complete")
  .get(validate(getJobWithAllDataSchema), getJobWithAllDataHandler);

// Team Members Routes

router
  .route("/jobs/:jobId/team-members")
  .get(validate(getJobTeamMembersSchema), getJobTeamMembersHandler)
  .post(validate(addJobTeamMemberSchema), addJobTeamMemberHandler);

router
  .route("/jobs/:jobId/team-members/:employeeId")
  .delete(validate(removeJobTeamMemberSchema), removeJobTeamMemberHandler);

// Financial Summary Routes

router
  .route("/jobs/:jobId/financial-summary")
  .get(validate(getJobFinancialSummarySchema), getJobFinancialSummaryHandler)
  .put(
    validate(updateJobFinancialSummarySchema),
    updateJobFinancialSummaryHandler,
  );

// Financial Breakdown Routes

router
  .route("/jobs/:jobId/financial-breakdown")
  .get(getJobFinancialBreakdownHandler)
  .put(
    validate(updateJobFinancialBreakdownSchema),
    updateJobFinancialBreakdownHandler,
  );

// Materials Routes

router
  .route("/jobs/:jobId/materials")
  .get(validate(getJobMaterialsSchema), getJobMaterialsHandler)
  .post(validate(createJobMaterialSchema), createJobMaterialHandler);

router
  .route("/jobs/:jobId/materials/:materialId")
  .get(validate(getJobMaterialByIdSchema), getJobMaterialByIdHandler)
  .put(validate(updateJobMaterialSchema), updateJobMaterialHandler)
  .delete(validate(deleteJobMaterialSchema), deleteJobMaterialHandler);

// Labor Routes

router
  .route("/jobs/:jobId/labor")
  .get(validate(getJobLaborSchema), getJobLaborHandler)
  .post(validate(createJobLaborSchema), createJobLaborHandler);

router
  .route("/jobs/:jobId/labor/:laborId")
  .get(validate(getJobLaborByIdSchema), getJobLaborByIdHandler)
  .put(validate(updateJobLaborSchema), updateJobLaborHandler)
  .delete(validate(deleteJobLaborSchema), deleteJobLaborHandler);

// Travel Routes

router
  .route("/jobs/:jobId/travel")
  .get(validate(getJobTravelSchema), getJobTravelHandler)
  .post(validate(createJobTravelSchema), createJobTravelHandler);

router
  .route("/jobs/:jobId/travel/:travelId")
  .get(validate(getJobTravelByIdSchema), getJobTravelByIdHandler)
  .put(validate(updateJobTravelSchema), updateJobTravelHandler)
  .delete(validate(deleteJobTravelSchema), deleteJobTravelHandler);

// Operating Expenses Routes

router
  .route("/jobs/:jobId/operating-expenses")
  .get(validate(getJobOperatingExpensesSchema), getJobOperatingExpensesHandler)
  .put(
    validate(updateJobOperatingExpensesSchema),
    updateJobOperatingExpensesHandler,
  );

// Timeline Routes

router
  .route("/jobs/:jobId/timeline")
  .get(validate(getJobTimelineSchema), getJobTimelineHandler)
  .post(validate(createJobTimelineEventSchema), createJobTimelineEventHandler);

router
  .route("/jobs/:jobId/timeline/:eventId")
  .get(validate(getJobTimelineEventByIdSchema), getJobTimelineEventByIdHandler)
  .put(validate(updateJobTimelineEventSchema), updateJobTimelineEventHandler)
  .delete(
    validate(deleteJobTimelineEventSchema),
    deleteJobTimelineEventHandler,
  );

// Notes Routes

router
  .route("/jobs/:jobId/notes")
  .get(validate(getJobNotesSchema), getJobNotesHandler)
  .post(validate(createJobNoteSchema), createJobNoteHandler);

router
  .route("/jobs/:jobId/notes/:noteId")
  .get(validate(getJobNoteByIdSchema), getJobNoteByIdHandler)
  .put(validate(updateJobNoteSchema), updateJobNoteHandler)
  .delete(validate(deleteJobNoteSchema), deleteJobNoteHandler);

// History Routes (Read-only)

router
  .route("/jobs/:jobId/history")
  .get(validate(getJobHistorySchema), getJobHistoryHandler);

// Tasks Routes

router
  .route("/jobs/:jobId/tasks")
  .get(validate(getJobTasksSchema), getJobTasksHandler)
  .post(validate(createJobTaskSchema), createJobTaskHandler);

router
  .route("/jobs/:jobId/tasks/:taskId")
  .get(validate(getJobTaskByIdSchema), getJobTaskByIdHandler)
  .put(validate(updateJobTaskSchema), updateJobTaskHandler)
  .delete(validate(deleteJobTaskSchema), deleteJobTaskHandler);

// Expenses Routes (POST/PUT support form-data: receipt file + data JSON)
router
  .route("/jobs/:jobId/expenses")
  .get(validate(getJobExpensesSchema), getJobExpensesHandler)
  .post(
    (req, res, next) => {
      if (req.headers["content-type"]?.includes("multipart/form-data")) {
        uploadReceipt(req, res, (err) => {
          if (err) return handleMulterError(err, req, res, next);
          next();
        });
      } else {
        next();
      }
    },
    parseFormData,
    validate(createJobExpenseSchema),
    createJobExpenseHandler,
  );

router
  .route("/jobs/:jobId/expenses/:expenseId")
  .get(validate(getJobExpenseByIdSchema), getJobExpenseByIdHandler)
  .put(
    (req, res, next) => {
      if (req.headers["content-type"]?.includes("multipart/form-data")) {
        uploadReceipt(req, res, (err) => {
          if (err) return handleMulterError(err, req, res, next);
          next();
        });
      } else {
        next();
      }
    },
    parseFormData,
    validate(updateJobExpenseSchema),
    updateJobExpenseHandler,
  )
  .delete(validate(deleteJobExpenseSchema), deleteJobExpenseHandler);

// Documents Routes

router
  .route("/jobs/:jobId/documents")
  .get(validate(getJobDocumentsSchema), getJobDocumentsHandler)
  .post(
    uploadJobDocuments,
    handleMulterError,
    validate(createJobDocumentsSchema),
    createJobDocumentsHandler,
  );

router
  .route("/jobs/:jobId/documents/:documentId")
  .get(validate(getJobDocumentByIdSchema), getJobDocumentByIdHandler)
  .put(
    uploadJobDocuments,
    handleMulterError,
    validate(updateJobDocumentSchema),
    updateJobDocumentHandler,
  )
  .delete(validate(deleteJobDocumentSchema), deleteJobDocumentHandler);

export default router;
