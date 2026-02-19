import { Router, type IRouter } from "express";
import multer from "multer";
import {
  getDispatchTasksHandler,
  getDispatchTaskByIdHandler,
  createDispatchTaskHandler,
  updateDispatchTaskHandler,
  deleteDispatchTaskHandler,
  getDispatchAssignmentsHandler,
  getDispatchAssignmentByIdHandler,
  createDispatchAssignmentHandler,
  updateDispatchAssignmentHandler,
  deleteDispatchAssignmentHandler,
  getAssignmentsByTaskIdHandler,
  getAssignmentsByTechnicianIdHandler,
  getAvailableEmployeesHandler,
  getEmployeesWithAssignedTasksHandler,
  getDispatchKPIsHandler,
  bulkDeleteDispatchTasksHandler,
} from "../../controllers/DispatchController.js";
import { authenticate } from "../../middleware/auth.js";
import {
  authorizeFeature,
  authorizeAnyFeature,
} from "../../middleware/featureAuthorize.js";
import { validate } from "../../middleware/validate.js";
import {
  getDispatchTasksQuerySchema,
  getDispatchTaskByIdSchema,
  createDispatchTaskSchema,
  updateDispatchTaskSchema,
  deleteDispatchTaskSchema,
  getDispatchAssignmentsQuerySchema,
  getDispatchAssignmentByIdSchema,
  createDispatchAssignmentSchema,
  updateDispatchAssignmentSchema,
  deleteDispatchAssignmentSchema,
  getAssignmentsByTaskIdSchema,
  getAssignmentsByTechnicianIdSchema,
  getAvailableEmployeesQuerySchema,
  getEmployeesWithAssignedTasksQuerySchema,
} from "../../validations/dispatch.validations.js";
import { bulkDeleteUuidSchema } from "../../validations/bulk-delete.validations.js";
import { generalTransformer } from "../../middleware/response-transformer.js";

const router: IRouter = Router();

// Configure multer for dispatch task attachment uploads (attachments_0, attachments_1, ...)
const uploadDispatchAttachments = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
  fileFilter: (_req, _file, cb) => cb(null, true),
}).any();

const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB per file.",
      });
    }
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

// Parse JSON 'data' field from multipart/form-data into req.body
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

// Apply authentication to all routes
router.use(authenticate);

// Apply timezone transformation to all GET responses
router.use(generalTransformer);

// Feature shorthand constants
// Technicians: view own + confirm; Managers/Executives: create/edit/delete
const viewDispatch = authorizeAnyFeature("dispatch", [
  "view_daily_dispatch",
  "view_own",
  "view_all",
]);
const createDispatch = authorizeFeature("dispatch", "create_dispatch");
const editDispatch = authorizeFeature("dispatch", "edit_dispatch");

// ============================
// Dispatch Tasks Routes
// ============================

// KPIs Route — Manager/Executive only (overview of all dispatch)
router.get("/dispatch/kpis", createDispatch, getDispatchKPIsHandler);

// List dispatch tasks: all can view; Technicians see only their own (filtered in service)
// Create dispatch: Manager/Executive only
router
  .route("/tasks")
  .get(
    viewDispatch,
    validate(getDispatchTasksQuerySchema),
    getDispatchTasksHandler,
  )
  .post(
    createDispatch,
    uploadDispatchAttachments,
    handleMulterError,
    parseFormData,
    validate(createDispatchTaskSchema),
    createDispatchTaskHandler,
  );

router
  .route("/tasks/:id")
  .get(
    viewDispatch,
    validate(getDispatchTaskByIdSchema),
    getDispatchTaskByIdHandler,
  )
  .put(
    editDispatch,
    uploadDispatchAttachments,
    handleMulterError,
    parseFormData,
    validate(updateDispatchTaskSchema),
    updateDispatchTaskHandler,
  )
  .delete(
    editDispatch,
    validate(deleteDispatchTaskSchema),
    deleteDispatchTaskHandler,
  );

router.get(
  "/tasks/:taskId/assignments",
  viewDispatch,
  validate(getAssignmentsByTaskIdSchema),
  getAssignmentsByTaskIdHandler,
);

// ============================
// Dispatch Assignments Routes
// ============================

// All roles can view their assignments; Managers/Executives manage all
router
  .route("/assignments")
  .get(
    viewDispatch,
    validate(getDispatchAssignmentsQuerySchema),
    getDispatchAssignmentsHandler,
  )
  .post(
    createDispatch,
    validate(createDispatchAssignmentSchema),
    createDispatchAssignmentHandler,
  );

router
  .route("/assignments/:id")
  .get(
    viewDispatch,
    validate(getDispatchAssignmentByIdSchema),
    getDispatchAssignmentByIdHandler,
  )
  .put(
    // Technicians can confirm their own dispatch; Managers/Executives can edit all
    authorizeAnyFeature("dispatch", ["confirm_dispatch", "edit_dispatch"]),
    validate(updateDispatchAssignmentSchema),
    updateDispatchAssignmentHandler,
  )
  .delete(
    editDispatch,
    validate(deleteDispatchAssignmentSchema),
    deleteDispatchAssignmentHandler,
  );

// Technician's own assignments — all can view their own
router.get(
  "/technicians/:technicianId/assignments",
  viewDispatch,
  validate(getAssignmentsByTechnicianIdSchema),
  getAssignmentsByTechnicianIdHandler,
);

// Available employees for dispatch planning — Manager/Executive only
router.get(
  "/available-employees",
  createDispatch,
  validate(getAvailableEmployeesQuerySchema),
  getAvailableEmployeesHandler,
);

// Employees with assigned dispatch tasks — Technicians see only their own (filtered in handler); Managers/Executives see all
router.get(
  "/employees-with-tasks",
  viewDispatch,
  validate(getEmployeesWithAssignedTasksQuerySchema),
  getEmployeesWithAssignedTasksHandler,
);

// Bulk delete dispatch tasks (Executive only)
router.post(
  "/dispatch/bulk-delete",
  authorizeFeature("dispatch", "bulk_delete"),
  validate(bulkDeleteUuidSchema),
  bulkDeleteDispatchTasksHandler,
);

export default router;
