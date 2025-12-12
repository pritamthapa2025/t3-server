import { Router } from "express";
import multer from "multer";
import {
  getEmployeesHandler,
  createEmployeeHandler,
  getEmployeeByIdHandler,
  updateEmployeeHandler,
  deleteEmployeeHandler,
  getEmployeeKPIsHandler,
} from "../../controllers/EmployeeController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getEmployeesQuerySchema,
  getEmployeeByIdSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  deleteEmployeeSchema,
} from "../../validations/employee.validations.js";

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

router.get("/employees/kpis", getEmployeeKPIsHandler);
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
    createEmployeeHandler
  );
router
  .route("/employees/:id")
  .get(validate(getEmployeeByIdSchema), getEmployeeByIdHandler)
  .put(validate(updateEmployeeSchema), updateEmployeeHandler)
  .delete(validate(deleteEmployeeSchema), deleteEmployeeHandler);

export default router;
