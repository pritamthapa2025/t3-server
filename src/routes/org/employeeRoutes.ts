import { Router } from "express";
import multer from "multer";
import {
  getEmployeesHandler,
  getEmployeesSimpleHandler,
  createEmployeeHandler,
  getEmployeeByIdHandler,
  updateEmployeeHandler,
  deleteEmployeeHandler,
  getEmployeeKPIsHandler,
  getInspectorsHandler,
} from "../../controllers/EmployeeController.js";
import {
  getEmployeeReviews,
  createEmployeeReview,
  updateEmployeeReview,
  getEmployeeReviewSummary,
} from "../../controllers/ReviewController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { userTransformer } from "../../middleware/response-transformer.js";
import {
  getEmployeesQuerySchema,
  getEmployeesSimpleQuerySchema,
  getEmployeeByIdSchema,
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

const router = Router();

// Configure multer for memory storage (for profile picture upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
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

// Apply authentication middleware to all employee routes
router.use(authenticate);

// Apply timezone transformation to all GET responses
router.use(userTransformer);

// Inspectors: employees whose role is Executive or Manager (full employee + user record)
router.get("/inspector", getInspectorsHandler);

router.get("/employees/kpis", getEmployeeKPIsHandler);
router.get(
  "/employees/simple",
  validate(getEmployeesSimpleQuerySchema),
  getEmployeesSimpleHandler,
);

router
  .route("/employees")
  .get(validate(getEmployeesQuerySchema), getEmployeesHandler)
  .post(
    (req, res, next) => {
      // Apply multer only if Content-Type is multipart/form-data
      if (req.headers["content-type"]?.includes("multipart/form-data")) {
        upload(req, res, (err) => {
          if (err) {
            return handleMulterError(err, req, res, next);
          }
          next();
        });
      } else {
        // Skip multer for JSON requests
        next();
      }
    },
    validate(createEmployeeSchema),
    createEmployeeHandler,
  );

router
  .route("/employees/:id")
  .get(validate(getEmployeeByIdSchema), getEmployeeByIdHandler)
  .put(validate(updateEmployeeSchema), updateEmployeeHandler)
  .delete(validate(deleteEmployeeSchema), deleteEmployeeHandler);

// ==================== EMPLOYEE REVIEW ROUTES ====================

// Get reviews for specific employee
router.get(
  "/employees/:employeeId/reviews",
  validate(getReviewsByEmployeeIdSchema),
  getEmployeeReviews,
);

// Create review for specific employee
router.post(
  "/employees/:employeeId/reviews",
  validate(createEmployeeReviewSchema),
  createEmployeeReview,
);

// Update review for specific employee
router.put(
  "/employees/:employeeId/reviews/:reviewId",
  validate(updateEmployeeReviewSchema),
  updateEmployeeReview,
);

// Get employee review summary
router.get(
  "/employees/:employeeId/reviews/summary",
  validate(getEmployeeReviewSummarySchema),
  getEmployeeReviewSummary,
);

export default router;
