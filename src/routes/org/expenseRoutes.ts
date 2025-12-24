import { Router } from "express";
import multer from "multer";
import {
  getExpenseCategoriesHandler,
  getExpenseCategoryByIdHandler,
  createExpenseCategoryHandler,
  updateExpenseCategoryHandler,
  deleteExpenseCategoryHandler,
  getExpensesHandler,
  getExpenseByIdHandler,
  createExpenseHandler,
  updateExpenseHandler,
  deleteExpenseHandler,
  submitExpenseHandler,
  approveExpenseHandler,
  rejectExpenseHandler,
  getExpenseSummaryHandler,
  getEmployeeExpenseSummaryHandler,
} from "../../controllers/ExpenseController.js";
import {
  getExpenseReportsHandler,
  getExpenseReportByIdHandler,
  createExpenseReportHandler,
  updateExpenseReportHandler,
  deleteExpenseReportHandler,
  submitExpenseReportHandler,
} from "../../controllers/ExpenseReportController.js";
import {
  getMileageLogsHandler,
  getMileageLogByIdHandler,
  createMileageLogHandler,
  updateMileageLogHandler,
  deleteMileageLogHandler,
  verifyMileageLogHandler,
  getMileageSummaryHandler,
} from "../../controllers/MileageController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { generalTransformer } from "../../middleware/response-transformer.js";
import {
  // Expense Categories
  getExpenseCategoriesQuerySchema,
  getExpenseCategoryByIdSchema,
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
  deleteExpenseCategorySchema,
  // Expenses
  getExpensesQuerySchema,
  getExpenseByIdSchema,
  createExpenseSchema,
  updateExpenseSchema,
  deleteExpenseSchema,
  submitExpenseSchema,
  approveExpenseSchema,
  rejectExpenseSchema,
  // Expense Reports
  getExpenseReportsQuerySchema,
  createExpenseReportSchema,
  getExpenseReportByIdSchema,
  updateExpenseReportSchema,
  submitExpenseReportSchema,
  deleteExpenseReportSchema,
  // Mileage Logs
  getMileageLogsQuerySchema,
  createMileageLogSchema,
  getMileageLogByIdSchema,
  updateMileageLogSchema,
  deleteMileageLogSchema,
  // Analytics
  getExpenseSummarySchema,
  getEmployeeExpenseSummarySchema,
} from "../../validations/expenses.validations.js";

const router = Router();

// Configure multer for receipt uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for receipts
  },
  fileFilter: (req, file, cb) => {
    // Accept image files and PDFs
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only image files and PDFs are allowed"));
    }
  },
}).single("receipt"); // Handle the receipt field

// Multer error handler middleware
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 10MB.",
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

// Apply authentication middleware to all expense routes
router.use(authenticate);

// Apply timezone transformation to all GET responses
router.use(generalTransformer);

// ============================
// EXPENSE CATEGORIES ROUTES
// ============================

router
  .route("/expense-categories")
  .get(validate(getExpenseCategoriesQuerySchema), getExpenseCategoriesHandler)
  .post(validate(createExpenseCategorySchema), createExpenseCategoryHandler);

router
  .route("/expense-categories/:id")
  .get(validate(getExpenseCategoryByIdSchema), getExpenseCategoryByIdHandler)
  .put(validate(updateExpenseCategorySchema), updateExpenseCategoryHandler)
  .delete(validate(deleteExpenseCategorySchema), deleteExpenseCategoryHandler);

// ============================
// EXPENSES ROUTES
// ============================

router
  .route("/expenses")
  .get(validate(getExpensesQuerySchema), getExpensesHandler)
  .post(validate(createExpenseSchema), createExpenseHandler);

router
  .route("/expenses/:id")
  .get(validate(getExpenseByIdSchema), getExpenseByIdHandler)
  .put(validate(updateExpenseSchema), updateExpenseHandler)
  .delete(validate(deleteExpenseSchema), deleteExpenseHandler);

// Expense workflow routes
router.post(
  "/expenses/:id/submit",
  validate(submitExpenseSchema),
  submitExpenseHandler
);

router.post(
  "/expenses/:id/approve",
  validate(approveExpenseSchema),
  approveExpenseHandler
);

router.post(
  "/expenses/:id/reject",
  validate(rejectExpenseSchema),
  rejectExpenseHandler
);

// ============================
// EXPENSE REPORTS ROUTES
// ============================

router
  .route("/expense-reports")
  .get(validate(getExpenseReportsQuerySchema), getExpenseReportsHandler)
  .post(validate(createExpenseReportSchema), createExpenseReportHandler);

router
  .route("/expense-reports/:id")
  .get(validate(getExpenseReportByIdSchema), getExpenseReportByIdHandler)
  .put(validate(updateExpenseReportSchema), updateExpenseReportHandler)
  .delete(validate(deleteExpenseReportSchema), deleteExpenseReportHandler);

// Expense report workflow routes
router.post(
  "/expense-reports/:id/submit",
  validate(submitExpenseReportSchema),
  submitExpenseReportHandler
);

// ============================
// MILEAGE LOGS ROUTES
// ============================

router
  .route("/mileage-logs")
  .get(validate(getMileageLogsQuerySchema), getMileageLogsHandler)
  .post(validate(createMileageLogSchema), createMileageLogHandler);

router
  .route("/mileage-logs/:id")
  .get(validate(getMileageLogByIdSchema), getMileageLogByIdHandler)
  .put(validate(updateMileageLogSchema), updateMileageLogHandler)
  .delete(validate(deleteMileageLogSchema), deleteMileageLogHandler);

// Mileage verification route
router.post("/mileage-logs/:id/verify", verifyMileageLogHandler);

// ============================
// ANALYTICS & REPORTS ROUTES
// ============================

// General expense summary
router.get(
  "/expenses/summary",
  validate(getExpenseSummarySchema),
  getExpenseSummaryHandler
);

// Mileage summary
router.get("/mileage-logs/summary", getMileageSummaryHandler);

// Employee expense summary
router.get(
  "/employees/:employeeId/expense-summary",
  validate(getEmployeeExpenseSummarySchema),
  getEmployeeExpenseSummaryHandler
);

// ============================
// RECEIPT UPLOAD ROUTES
// ============================

// Upload receipt for expense (will be implemented when storage service is ready)
router.post("/expenses/:expenseId/receipts", (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    // TODO: Implement receipt upload handler
    res.status(501).json({
      success: false,
      message: "Receipt upload functionality not yet implemented",
    });
  });
});

// Get receipts for expense
router.get("/expenses/:expenseId/receipts", (req, res) => {
  // TODO: Implement get receipts handler
  res.status(501).json({
    success: false,
    message: "Receipt retrieval functionality not yet implemented",
  });
});

// Delete receipt
router.delete("/expenses/:expenseId/receipts/:receiptId", (req, res) => {
  // TODO: Implement delete receipt handler
  res.status(501).json({
    success: false,
    message: "Receipt deletion functionality not yet implemented",
  });
});

export default router;

