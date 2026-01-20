import { Router } from "express";
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
  getTechnicianAvailabilityHandler,
  getTechnicianAvailabilityByIdHandler,
  createTechnicianAvailabilityHandler,
  updateTechnicianAvailabilityHandler,
  deleteTechnicianAvailabilityHandler,
  getAvailabilityByEmployeeIdHandler,
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
  getTechnicianAvailabilityQuerySchema,
  getTechnicianAvailabilityByIdSchema,
  createTechnicianAvailabilitySchema,
  updateTechnicianAvailabilitySchema,
  deleteTechnicianAvailabilitySchema,
  getAvailabilityByEmployeeIdSchema,
} from "../../validations/dispatch.validations.js";
import { generalTransformer } from "../../middleware/response-transformer.js";

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Apply timezone transformation to all GET responses
router.use(generalTransformer);

// ============================
// Dispatch Tasks Routes
// ============================

router.get(
  "/tasks",
  validate(getDispatchTasksQuerySchema),
  getDispatchTasksHandler
);

router.get(
  "/tasks/:id",
  validate(getDispatchTaskByIdSchema),
  getDispatchTaskByIdHandler
);

router.post(
  "/tasks",
  validate(createDispatchTaskSchema),
  createDispatchTaskHandler
);

router.put(
  "/tasks/:id",
  validate(updateDispatchTaskSchema),
  updateDispatchTaskHandler
);

router.delete(
  "/tasks/:id",
  validate(deleteDispatchTaskSchema),
  deleteDispatchTaskHandler
);

// ============================
// Dispatch Assignments Routes
// ============================

router.get(
  "/assignments",
  validate(getDispatchAssignmentsQuerySchema),
  getDispatchAssignmentsHandler
);

router.get(
  "/assignments/:id",
  validate(getDispatchAssignmentByIdSchema),
  getDispatchAssignmentByIdHandler
);

router.post(
  "/assignments",
  validate(createDispatchAssignmentSchema),
  createDispatchAssignmentHandler
);

router.put(
  "/assignments/:id",
  validate(updateDispatchAssignmentSchema),
  updateDispatchAssignmentHandler
);

router.delete(
  "/assignments/:id",
  validate(deleteDispatchAssignmentSchema),
  deleteDispatchAssignmentHandler
);

// Get assignments by task ID
router.get(
  "/tasks/:taskId/assignments",
  validate(getAssignmentsByTaskIdSchema),
  getAssignmentsByTaskIdHandler
);

// Get assignments by technician ID
router.get(
  "/technicians/:technicianId/assignments",
  validate(getAssignmentsByTechnicianIdSchema),
  getAssignmentsByTechnicianIdHandler
);

// ============================
// Technician Availability Routes
// ============================

router.get(
  "/availability",
  validate(getTechnicianAvailabilityQuerySchema),
  getTechnicianAvailabilityHandler
);

router.get(
  "/availability/:id",
  validate(getTechnicianAvailabilityByIdSchema),
  getTechnicianAvailabilityByIdHandler
);

router.post(
  "/availability",
  validate(createTechnicianAvailabilitySchema),
  createTechnicianAvailabilityHandler
);

router.put(
  "/availability/:id",
  validate(updateTechnicianAvailabilitySchema),
  updateTechnicianAvailabilityHandler
);

router.delete(
  "/availability/:id",
  validate(deleteTechnicianAvailabilitySchema),
  deleteTechnicianAvailabilityHandler
);

// Get availability by employee ID and date range
router.get(
  "/employees/:employeeId/availability",
  validate(getAvailabilityByEmployeeIdSchema),
  getAvailabilityByEmployeeIdHandler
);

export default router;



