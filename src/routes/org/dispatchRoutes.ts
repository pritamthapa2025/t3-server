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
} from "../../controllers/DispatchController.js";
import { authenticate } from "../../middleware/auth.js";
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

// ============================
// Dispatch Tasks Routes
// ============================

router
  .route("/tasks")
  .get(validate(getDispatchTasksQuerySchema), getDispatchTasksHandler)
  .post(
    uploadDispatchAttachments,
    handleMulterError,
    parseFormData,
    validate(createDispatchTaskSchema),
    createDispatchTaskHandler,
  );

router
  .route("/tasks/:id")
  .get(validate(getDispatchTaskByIdSchema), getDispatchTaskByIdHandler)
  .put(
    uploadDispatchAttachments,
    handleMulterError,
    parseFormData,
    validate(updateDispatchTaskSchema),
    updateDispatchTaskHandler,
  )
  .delete(validate(deleteDispatchTaskSchema), deleteDispatchTaskHandler);

router.get(
  "/tasks/:taskId/assignments",
  validate(getAssignmentsByTaskIdSchema),
  getAssignmentsByTaskIdHandler,
);

// ============================
// Dispatch Assignments Routes
// ============================

router
  .route("/assignments")
  .get(
    validate(getDispatchAssignmentsQuerySchema),
    getDispatchAssignmentsHandler,
  )
  .post(
    validate(createDispatchAssignmentSchema),
    createDispatchAssignmentHandler,
  );

router
  .route("/assignments/:id")
  .get(
    validate(getDispatchAssignmentByIdSchema),
    getDispatchAssignmentByIdHandler,
  )
  .put(
    validate(updateDispatchAssignmentSchema),
    updateDispatchAssignmentHandler,
  )
  .delete(
    validate(deleteDispatchAssignmentSchema),
    deleteDispatchAssignmentHandler,
  );

router.get(
  "/technicians/:technicianId/assignments",
  validate(getAssignmentsByTechnicianIdSchema),
  getAssignmentsByTechnicianIdHandler,
);

// Available employees for dispatch (status = 'available' from employees table)
router.get(
  "/available-employees",
  validate(getAvailableEmployeesQuerySchema),
  getAvailableEmployeesHandler,
);

// Employees with assigned dispatch tasks (each employee has tasks array; empty if none)
router.get(
  "/employees-with-tasks",
  validate(getEmployeesWithAssignedTasksQuerySchema),
  getEmployeesWithAssignedTasksHandler,
);

export default router;
