import { Router, type IRouter } from "express";
import multer from "multer";
import {
  getEmployeesHandler,
  getEmployeesSimpleHandler,
  createEmployeeHandler,
  getEmployeeByIdHandler,
  getEmployeeJobsAndDispatchHandler,
  updateEmployeeHandler,
  deleteEmployeeHandler,
  getEmployeeKPIsHandler,
  getInspectorsHandler,
  getTechniciansHandler,
  getManagersAndTechniciansByRoleHandler,
  getUnassignedDriversHandler,
  bulkDeleteEmployeesHandler,
} from "../../controllers/EmployeeController.js";
import {
  getEmployeeReviews,
  createEmployeeReview,
  updateEmployeeReview,
  getEmployeeReviewSummary,
} from "../../controllers/ReviewController.js";
import { authenticate } from "../../middleware/auth.js";
import { authorizeFeature, requireAnyRole } from "../../middleware/featureAuthorize.js";
import { validate } from "../../middleware/validate.js";
import { bulkDeleteIntSchema } from "../../validations/bulk-delete.validations.js";
import {
  getEmployeesQuerySchema,
  getEmployeesSimpleQuerySchema,
  getEmployeeByIdSchema,
  getEmployeeJobsAndDispatchSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  deleteEmployeeSchema,
} from "../../validations/employee.validations.js";
import {
  getReviewsByEmployeeIdSchema,
  createEmployeeReviewSchema,
  updateEmployeeReviewSchema,
  getEmployeeReviewSummarySchema,
} from "../../validations/review.validations.js";

const router: IRouter = Router();

// Configure multer for memory storage (for profile picture upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/") && file.mimetype !== "image/svg+xml") {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
}).single("profilePicture"); // Handle the profilePicture field

// Multer error handler middleware
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB.",
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

router.use(authenticate);

const managerOrAbove = requireAnyRole("Executive", "Manager");

// ─── Utility / Lookup ────────────────────────────────────────────────────────

router.route("/inspector").get(getInspectorsHandler);

router.route("/unassigned-drivers").get(getUnassignedDriversHandler);

// ─── Employees ───────────────────────────────────────────────────────────────

router.route("/employees/technicians").get(getTechniciansHandler);

router
  .route("/employees/managers-and-technicians")
  .get(getManagersAndTechniciansByRoleHandler);

router.route("/employees/kpis").get(getEmployeeKPIsHandler);

router
  .route("/employees/simple")
  .get(validate(getEmployeesSimpleQuerySchema), getEmployeesSimpleHandler);

router.route("/employees/bulk-delete").post(
  authorizeFeature("team", "bulk_delete"),
  validate(bulkDeleteIntSchema),
  bulkDeleteEmployeesHandler,
);

router
  .route("/employees")
  .get(validate(getEmployeesQuerySchema), getEmployeesHandler)
  .post(
    managerOrAbove,
    (req, res, next) => {
      if (req.headers["content-type"]?.includes("multipart/form-data")) {
        upload(req, res, (err) => {
          if (err) return handleMulterError(err, req, res, next);
          next();
        });
      } else {
        next();
      }
    },
    validate(createEmployeeSchema),
    createEmployeeHandler,
  );

router
  .route("/employees/:id/jobs-and-dispatch")
  .get(validate(getEmployeeJobsAndDispatchSchema), getEmployeeJobsAndDispatchHandler);

router
  .route("/employees/:id")
  .get(validate(getEmployeeByIdSchema), getEmployeeByIdHandler)
  .put(validate(updateEmployeeSchema), updateEmployeeHandler)
  .delete(managerOrAbove, validate(deleteEmployeeSchema), deleteEmployeeHandler);

// ─── Employee Reviews ─────────────────────────────────────────────────────────

router
  .route("/employees/:employeeId/reviews/summary")
  .get(validate(getEmployeeReviewSummarySchema), getEmployeeReviewSummary);

router
  .route("/employees/:employeeId/reviews")
  .get(validate(getReviewsByEmployeeIdSchema), getEmployeeReviews)
  .post(managerOrAbove, validate(createEmployeeReviewSchema), createEmployeeReview);

router
  .route("/employees/:employeeId/reviews/:reviewId")
  .put(managerOrAbove, validate(updateEmployeeReviewSchema), updateEmployeeReview);

export default router;
