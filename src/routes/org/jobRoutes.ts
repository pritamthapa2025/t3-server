import { Router } from "express";
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
  createJobMaterialHandler,
  updateJobMaterialHandler,
  deleteJobMaterialHandler,
  getJobLaborHandler,
  createJobLaborHandler,
  updateJobLaborHandler,
  deleteJobLaborHandler,
  getJobTravelHandler,
  createJobTravelHandler,
  updateJobTravelHandler,
  deleteJobTravelHandler,
  getJobOperatingExpensesHandler,
  updateJobOperatingExpensesHandler,
  getJobTimelineHandler,
  createJobTimelineEventHandler,
  updateJobTimelineEventHandler,
  deleteJobTimelineEventHandler,
  getJobNotesHandler,
  createJobNoteHandler,
  updateJobNoteHandler,
  deleteJobNoteHandler,
  getJobHistoryHandler,
  getJobTasksHandler,
  createJobTaskHandler,
  updateJobTaskHandler,
  deleteJobTaskHandler,
  getJobExpensesHandler,
  createJobExpenseHandler,
  updateJobExpenseHandler,
  deleteJobExpenseHandler,
  getJobDocumentsHandler,
  createJobDocumentHandler,
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
  getJobFinancialBreakdownSchema,
  updateJobFinancialBreakdownSchema,
  getJobMaterialsSchema,
  createJobMaterialSchema,
  updateJobMaterialSchema,
  deleteJobMaterialSchema,
  getJobLaborSchema,
  createJobLaborSchema,
  updateJobLaborSchema,
  deleteJobLaborSchema,
  getJobTravelSchema,
  createJobTravelSchema,
  updateJobTravelSchema,
  deleteJobTravelSchema,
  getJobOperatingExpensesSchema,
  updateJobOperatingExpensesSchema,
  getJobTimelineSchema,
  createJobTimelineEventSchema,
  updateJobTimelineEventSchema,
  deleteJobTimelineEventSchema,
  getJobNotesSchema,
  createJobNoteSchema,
  updateJobNoteSchema,
  deleteJobNoteSchema,
  getJobHistorySchema,
  getJobTasksSchema,
  createJobTaskSchema,
  updateJobTaskSchema,
  deleteJobTaskSchema,
  getJobExpensesSchema,
  createJobExpenseSchema,
  updateJobExpenseSchema,
  deleteJobExpenseSchema,
  getJobDocumentsSchema,
  createJobDocumentSchema,
  deleteJobDocumentSchema,
  getJobWithAllDataSchema,
} from "../../validations/job.validations.js";
import { generalTransformer } from "../../middleware/response-transformer.js";

const router = Router();

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
    updateJobFinancialSummaryHandler
  );

// Financial Breakdown Routes

router
  .route("/jobs/:jobId/financial-breakdown")
  .get(getJobFinancialBreakdownHandler)
  .put(
    validate(updateJobFinancialBreakdownSchema),
    updateJobFinancialBreakdownHandler
  );

// Materials Routes

router
  .route("/jobs/:jobId/materials")
  .get(validate(getJobMaterialsSchema), getJobMaterialsHandler)
  .post(validate(createJobMaterialSchema), createJobMaterialHandler);

router
  .route("/jobs/:jobId/materials/:materialId")
  .put(validate(updateJobMaterialSchema), updateJobMaterialHandler)
  .delete(validate(deleteJobMaterialSchema), deleteJobMaterialHandler);

// Labor Routes

router
  .route("/jobs/:jobId/labor")
  .get(validate(getJobLaborSchema), getJobLaborHandler)
  .post(validate(createJobLaborSchema), createJobLaborHandler);

router
  .route("/jobs/:jobId/labor/:laborId")
  .put(validate(updateJobLaborSchema), updateJobLaborHandler)
  .delete(validate(deleteJobLaborSchema), deleteJobLaborHandler);

// Travel Routes

router
  .route("/jobs/:jobId/travel")
  .get(validate(getJobTravelSchema), getJobTravelHandler)
  .post(validate(createJobTravelSchema), createJobTravelHandler);

router
  .route("/jobs/:jobId/travel/:travelId")
  .put(validate(updateJobTravelSchema), updateJobTravelHandler)
  .delete(validate(deleteJobTravelSchema), deleteJobTravelHandler);

// Operating Expenses Routes

router
  .route("/jobs/:jobId/operating-expenses")
  .get(validate(getJobOperatingExpensesSchema), getJobOperatingExpensesHandler)
  .put(
    validate(updateJobOperatingExpensesSchema),
    updateJobOperatingExpensesHandler
  );

// Timeline Routes

router
  .route("/jobs/:jobId/timeline")
  .get(validate(getJobTimelineSchema), getJobTimelineHandler)
  .post(validate(createJobTimelineEventSchema), createJobTimelineEventHandler);

router
  .route("/jobs/:jobId/timeline/:eventId")
  .put(validate(updateJobTimelineEventSchema), updateJobTimelineEventHandler)
  .delete(
    validate(deleteJobTimelineEventSchema),
    deleteJobTimelineEventHandler
  );

// Notes Routes

router
  .route("/jobs/:jobId/notes")
  .get(validate(getJobNotesSchema), getJobNotesHandler)
  .post(validate(createJobNoteSchema), createJobNoteHandler);

router
  .route("/jobs/:jobId/notes/:noteId")
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
  .put(validate(updateJobTaskSchema), updateJobTaskHandler)
  .delete(validate(deleteJobTaskSchema), deleteJobTaskHandler);

// Expenses Routes

router
  .route("/jobs/:jobId/expenses")
  .get(validate(getJobExpensesSchema), getJobExpensesHandler)
  .post(validate(createJobExpenseSchema), createJobExpenseHandler);

router
  .route("/jobs/:jobId/expenses/:expenseId")
  .put(validate(updateJobExpenseSchema), updateJobExpenseHandler)
  .delete(validate(deleteJobExpenseSchema), deleteJobExpenseHandler);

// Documents Routes

router
  .route("/jobs/:jobId/documents")
  .get(validate(getJobDocumentsSchema), getJobDocumentsHandler)
  .post(validate(createJobDocumentSchema), createJobDocumentHandler);

router
  .route("/jobs/:jobId/documents/:documentId")
  .delete(validate(deleteJobDocumentSchema), deleteJobDocumentHandler);

export default router;


