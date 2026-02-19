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
  getTaskCommentsHandler,
  getTaskCommentByIdHandler,
  createTaskCommentHandler,
  updateTaskCommentHandler,
  deleteTaskCommentHandler,
  getJobSurveysHandler,
  getJobSurveyByIdHandler,
  createJobSurveyHandler,
  updateJobSurveyHandler,
  deleteJobSurveyHandler,
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
  getJobInvoiceKPIsHandler,
  getJobLaborCostTrackingHandler,
  getJobsKPIsHandler,
  bulkDeleteJobsHandler,
} from "../../controllers/JobController.js";
import { authenticate } from "../../middleware/auth.js";
import {
  authorizeFeature,
  authorizeAnyFeature,
} from "../../middleware/featureAuthorize.js";
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
  getTaskCommentsSchema,
  getTaskCommentByIdSchema,
  createTaskCommentSchema,
  updateTaskCommentSchema,
  deleteTaskCommentSchema,
  getJobSurveysSchema,
  getJobSurveyByIdSchema,
  createJobSurveySchema,
  updateJobSurveySchema,
  deleteJobSurveySchema,
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
  getJobInvoiceKPIsSchema,
  getJobLaborCostTrackingSchema,
} from "../../validations/job.validations.js";
import { bulkDeleteUuidSchema } from "../../validations/bulk-delete.validations.js";

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


// Shorthand: view feature covers Technician (view_assigned) + Manager/Executive (view)
const viewJobs = authorizeAnyFeature("jobs", ["view_jobs", "view"]);
const createJob = authorizeFeature("jobs", "create_job");
const editJob = authorizeAnyFeature("jobs", ["edit_job", "edit"]);
const deleteJob = authorizeFeature("jobs", "delete_job");
const viewBudget = authorizeFeature("jobs", "view_budget");
const viewExpenses = authorizeAnyFeature("jobs", ["view_expenses", "add_expense"]);
const addExpense = authorizeFeature("jobs", "add_expense");
const approveExpenses = authorizeFeature("jobs", "approve_expenses");
const uploadPhotos = authorizeFeature("jobs", "upload_photos");

// Main Job Routes

// KPIs Route (must be before /jobs/:id to avoid parameter conflicts)
router.get("/jobs/kpis", viewJobs, getJobsKPIsHandler);

router
  .route("/jobs")
  .get(viewJobs, validate(getJobsQuerySchema), getJobsHandler)
  .post(createJob, validate(createJobSchema), createJobHandler);

// PUT updates job data AND all associated bid data
router
  .route("/jobs/:id")
  .get(viewJobs, validate(getJobByIdSchema), getJobByIdHandler)
  .put(
    editJob,
    uploadJobDocuments,
    handleMulterError,
    parseFormData,
    validate(updateJobSchema),
    updateJobHandler,
  )
  .delete(deleteJob, validate(deleteJobSchema), deleteJobHandler);

// Get job with all related data
router
  .route("/jobs/:id/complete")
  .get(viewJobs, validate(getJobWithAllDataSchema), getJobWithAllDataHandler);

// Get job invoice KPIs (Manager/Executive only — financial data)
router
  .route("/jobs/:jobId/invoices/kpis")
  .get(viewBudget, validate(getJobInvoiceKPIsSchema), getJobInvoiceKPIsHandler);

// Get job labor cost tracking (Manager/Executive only — financial data)
router
  .route("/jobs/:jobId/labor/cost-tracking")
  .get(viewBudget, validate(getJobLaborCostTrackingSchema), getJobLaborCostTrackingHandler);

// Team Members Routes (Manager/Executive only — job management)

router
  .route("/jobs/:jobId/team-members")
  .get(editJob, validate(getJobTeamMembersSchema), getJobTeamMembersHandler)
  .post(editJob, validate(addJobTeamMemberSchema), addJobTeamMemberHandler);

router
  .route("/jobs/:jobId/team-members/:employeeId")
  .delete(editJob, validate(removeJobTeamMemberSchema), removeJobTeamMemberHandler);

// Financial Summary Routes (Manager/Executive only)

router
  .route("/jobs/:jobId/financial-summary")
  .get(viewBudget, validate(getJobFinancialSummarySchema), getJobFinancialSummaryHandler)
  .put(
    editJob,
    validate(updateJobFinancialSummarySchema),
    updateJobFinancialSummaryHandler,
  );

// Financial Breakdown Routes (Manager/Executive only)

router
  .route("/jobs/:jobId/financial-breakdown")
  .get(viewBudget, getJobFinancialBreakdownHandler)
  .put(
    editJob,
    validate(updateJobFinancialBreakdownSchema),
    updateJobFinancialBreakdownHandler,
  );

// Materials Routes (Manager/Executive only — bid cost data)

router
  .route("/jobs/:jobId/materials")
  .get(editJob, validate(getJobMaterialsSchema), getJobMaterialsHandler)
  .post(editJob, validate(createJobMaterialSchema), createJobMaterialHandler);

router
  .route("/jobs/:jobId/materials/:materialId")
  .get(editJob, validate(getJobMaterialByIdSchema), getJobMaterialByIdHandler)
  .put(editJob, validate(updateJobMaterialSchema), updateJobMaterialHandler)
  .delete(editJob, validate(deleteJobMaterialSchema), deleteJobMaterialHandler);

// Labor Routes (Manager/Executive only)

router
  .route("/jobs/:jobId/labor")
  .get(editJob, validate(getJobLaborSchema), getJobLaborHandler)
  .post(editJob, validate(createJobLaborSchema), createJobLaborHandler);

router
  .route("/jobs/:jobId/labor/:laborId")
  .get(editJob, validate(getJobLaborByIdSchema), getJobLaborByIdHandler)
  .put(editJob, validate(updateJobLaborSchema), updateJobLaborHandler)
  .delete(editJob, validate(deleteJobLaborSchema), deleteJobLaborHandler);

// Travel Routes (Manager/Executive only)

router
  .route("/jobs/:jobId/travel")
  .get(editJob, validate(getJobTravelSchema), getJobTravelHandler)
  .post(editJob, validate(createJobTravelSchema), createJobTravelHandler);

router
  .route("/jobs/:jobId/travel/:travelId")
  .get(editJob, validate(getJobTravelByIdSchema), getJobTravelByIdHandler)
  .put(editJob, validate(updateJobTravelSchema), updateJobTravelHandler)
  .delete(editJob, validate(deleteJobTravelSchema), deleteJobTravelHandler);

// Operating Expenses Routes (Manager/Executive only)

router
  .route("/jobs/:jobId/operating-expenses")
  .get(editJob, validate(getJobOperatingExpensesSchema), getJobOperatingExpensesHandler)
  .put(
    editJob,
    validate(updateJobOperatingExpensesSchema),
    updateJobOperatingExpensesHandler,
  );

// Timeline Routes (all job viewers can read; Manager/Executive can write)

router
  .route("/jobs/:jobId/timeline")
  .get(viewJobs, validate(getJobTimelineSchema), getJobTimelineHandler)
  .post(editJob, validate(createJobTimelineEventSchema), createJobTimelineEventHandler);

router
  .route("/jobs/:jobId/timeline/:eventId")
  .get(viewJobs, validate(getJobTimelineEventByIdSchema), getJobTimelineEventByIdHandler)
  .put(editJob, validate(updateJobTimelineEventSchema), updateJobTimelineEventHandler)
  .delete(
    editJob,
    validate(deleteJobTimelineEventSchema),
    deleteJobTimelineEventHandler,
  );

// Notes Routes (all job viewers can read and write notes)

router
  .route("/jobs/:jobId/notes")
  .get(viewJobs, validate(getJobNotesSchema), getJobNotesHandler)
  .post(viewJobs, validate(createJobNoteSchema), createJobNoteHandler);

router
  .route("/jobs/:jobId/notes/:noteId")
  .get(viewJobs, validate(getJobNoteByIdSchema), getJobNoteByIdHandler)
  .put(editJob, validate(updateJobNoteSchema), updateJobNoteHandler)
  .delete(editJob, validate(deleteJobNoteSchema), deleteJobNoteHandler);

// History Routes (Read-only — all job viewers)

router
  .route("/jobs/:jobId/history")
  .get(viewJobs, validate(getJobHistorySchema), getJobHistoryHandler);

// Tasks Routes (Manager/Executive create; all viewers can read)

router
  .route("/jobs/:jobId/tasks")
  .get(viewJobs, validate(getJobTasksSchema), getJobTasksHandler)
  .post(editJob, validate(createJobTaskSchema), createJobTaskHandler);

router
  .route("/jobs/:jobId/tasks/:taskId")
  .get(viewJobs, validate(getJobTaskByIdSchema), getJobTaskByIdHandler)
  .put(editJob, validate(updateJobTaskSchema), updateJobTaskHandler)
  .delete(editJob, validate(deleteJobTaskSchema), deleteJobTaskHandler);

// Task Comments Routes (all viewers can comment)
router
  .route("/jobs/:jobId/tasks/:taskId/comments")
  .get(viewJobs, validate(getTaskCommentsSchema), getTaskCommentsHandler)
  .post(viewJobs, validate(createTaskCommentSchema), createTaskCommentHandler);

router
  .route("/jobs/:jobId/tasks/:taskId/comments/:id")
  .get(viewJobs, validate(getTaskCommentByIdSchema), getTaskCommentByIdHandler)
  .put(editJob, validate(updateTaskCommentSchema), updateTaskCommentHandler)
  .delete(editJob, validate(deleteTaskCommentSchema), deleteTaskCommentHandler);

// Survey Routes (all assigned viewers can access)
router
  .route("/jobs/:jobId/survey")
  .get(viewJobs, validate(getJobSurveysSchema), getJobSurveysHandler)
  .post(viewJobs, validate(createJobSurveySchema), createJobSurveyHandler);

router
  .route("/jobs/:jobId/survey/:id")
  .get(viewJobs, validate(getJobSurveyByIdSchema), getJobSurveyByIdHandler)
  .put(editJob, validate(updateJobSurveySchema), updateJobSurveyHandler)
  .delete(editJob, validate(deleteJobSurveySchema), deleteJobSurveyHandler);

// Expenses Routes — Technicians can add expenses; Managers/Executives can approve/view all
router
  .route("/jobs/:jobId/expenses")
  .get(viewExpenses, validate(getJobExpensesSchema), getJobExpensesHandler)
  .post(
    addExpense,
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
  .get(viewExpenses, validate(getJobExpenseByIdSchema), getJobExpenseByIdHandler)
  .put(
    addExpense,
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
  .delete(approveExpenses, validate(deleteJobExpenseSchema), deleteJobExpenseHandler);

// Documents Routes — all assigned users can upload; Manager/Executive manage

router
  .route("/jobs/:jobId/documents")
  .get(viewJobs, validate(getJobDocumentsSchema), getJobDocumentsHandler)
  .post(
    uploadPhotos,
    uploadJobDocuments,
    handleMulterError,
    validate(createJobDocumentsSchema),
    createJobDocumentsHandler,
  );

router
  .route("/jobs/:jobId/documents/:documentId")
  .get(viewJobs, validate(getJobDocumentByIdSchema), getJobDocumentByIdHandler)
  .put(
    editJob,
    uploadJobDocuments,
    handleMulterError,
    validate(updateJobDocumentSchema),
    updateJobDocumentHandler,
  )
  .delete(editJob, validate(deleteJobDocumentSchema), deleteJobDocumentHandler);

// Bulk delete jobs (Executive only)
router.post(
  "/jobs/bulk-delete",
  authorizeFeature("jobs", "bulk_delete"),
  validate(bulkDeleteUuidSchema),
  bulkDeleteJobsHandler,
);

export default router;
