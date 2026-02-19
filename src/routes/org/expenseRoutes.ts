import { Router, type IRouter } from "express";
import multer from "multer";
import {
  getExpenseCategoriesHandler,
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
  getExpenseReceiptsHandler,
  getExpenseReceiptByIdHandler,
  createExpenseReceiptHandler,
  updateExpenseReceiptHandler,
  deleteExpenseReceiptHandler,
  getExpensesKPIsHandler,
  bulkDeleteExpensesHandler,
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
import { authorizeFeature, authorizeAnyFeature } from "../../middleware/featureAuthorize.js";
import { validate } from "../../middleware/validate.js";
import { bulkDeleteUuidSchema } from "../../validations/bulk-delete.validations.js";
import {
  // Expense Categories (enum list for dropdown)
  getExpenseCategoriesQuerySchema,
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
  // Expense Receipts
  getExpenseReceiptsSchema,
  getExpenseReceiptByIdSchema,
  createExpenseReceiptSchema,
  updateExpenseReceiptSchema,
  deleteExpenseReceiptSchema,
} from "../../validations/expenses.validations.js";

const router: IRouter = Router();

// Configure multer for receipt uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for receipts
  },
  fileFilter: (req, file, cb) => {
    // Accept image files and PDFs
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
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

// Feature shorthand constants — mirrors CSV section 3.3 Expense & Resource Tracking
// Technician: view_own/create/edit_own; Manager: view_all(team)+approve; Executive: admin
const viewOwnExpenses  = authorizeFeature("expenses", "view_own");
const viewAllExpenses  = authorizeAnyFeature("expenses", ["view_own", "view_all"]);
const createExpense    = authorizeFeature("expenses", "create");
const editOwnExpense   = authorizeAnyFeature("expenses", ["edit_own", "approve"]);
// Delete: Technician=none, Manager=pending only, Executive=all → require approve-level
const deleteExpense    = authorizeFeature("expenses", "approve");
const approveExpense   = authorizeFeature("expenses", "approve");

// ============================
// EXPENSE CATEGORIES ROUTES
// ============================

// All authenticated roles need the category list when filling in expense forms
router.get(
  "/expense/category",
  viewOwnExpenses,
  validate(getExpenseCategoriesQuerySchema),
  getExpenseCategoriesHandler,
);

// ============================
// EXPENSES ROUTES
// ============================

// KPIs — Manager/Executive only (financial overview)
router.get("/expenses/kpis", approveExpense, getExpensesKPIsHandler);

router
  .route("/expenses")
  .get(viewAllExpenses, validate(getExpensesQuerySchema), getExpensesHandler)
  .post(createExpense, validate(createExpenseSchema), createExpenseHandler);

router
  .route("/expenses/:id")
  .get(viewAllExpenses, validate(getExpenseByIdSchema), getExpenseByIdHandler)
  .put(editOwnExpense, validate(updateExpenseSchema), updateExpenseHandler)
  .delete(deleteExpense, validate(deleteExpenseSchema), deleteExpenseHandler);

// Expense workflow routes
router.post(
  "/expenses/:id/submit",
  createExpense,
  validate(submitExpenseSchema),
  submitExpenseHandler,
);

// Approve/Reject — Manager/Executive only
router.post(
  "/expenses/:id/approve",
  approveExpense,
  validate(approveExpenseSchema),
  approveExpenseHandler,
);

router.post(
  "/expenses/:id/reject",
  approveExpense,
  validate(rejectExpenseSchema),
  rejectExpenseHandler,
);

// ============================
// EXPENSE REPORTS ROUTES
// ============================

// Expense reports are Manager/Executive level (aggregate reporting)
router
  .route("/expense-reports")
  .get(approveExpense, validate(getExpenseReportsQuerySchema), getExpenseReportsHandler)
  .post(approveExpense, validate(createExpenseReportSchema), createExpenseReportHandler);

router
  .route("/expense-reports/:id")
  .get(approveExpense, validate(getExpenseReportByIdSchema), getExpenseReportByIdHandler)
  .put(approveExpense, validate(updateExpenseReportSchema), updateExpenseReportHandler)
  .delete(approveExpense, validate(deleteExpenseReportSchema), deleteExpenseReportHandler);

// Expense report workflow routes
router.post(
  "/expense-reports/:id/submit",
  approveExpense,
  validate(submitExpenseReportSchema),
  submitExpenseReportHandler,
);

// ============================
// MILEAGE LOGS ROUTES
// ============================

// All roles can log/view mileage (Technicians log for assigned jobs)
router
  .route("/mileage-logs")
  .get(viewAllExpenses, validate(getMileageLogsQuerySchema), getMileageLogsHandler)
  .post(createExpense, validate(createMileageLogSchema), createMileageLogHandler);

router
  .route("/mileage-logs/:id")
  .get(viewAllExpenses, validate(getMileageLogByIdSchema), getMileageLogByIdHandler)
  .put(editOwnExpense, validate(updateMileageLogSchema), updateMileageLogHandler)
  .delete(deleteExpense, validate(deleteMileageLogSchema), deleteMileageLogHandler);

// Mileage verification — Manager/Executive only
router.post("/mileage-logs/:id/verify", approveExpense, verifyMileageLogHandler);

// ============================
// ANALYTICS & REPORTS ROUTES
// ============================

// Expense summary — Manager/Executive only (financial totals)
router.get(
  "/expenses/summary",
  approveExpense,
  validate(getExpenseSummarySchema),
  getExpenseSummaryHandler,
);

// Mileage summary — Manager/Executive only
router.get("/mileage-logs/summary", approveExpense, getMileageSummaryHandler);

// Employee expense summary — Manager/Executive only
router.get(
  "/employees/:employeeId/expense-summary",
  approveExpense,
  validate(getEmployeeExpenseSummarySchema),
  getEmployeeExpenseSummaryHandler,
);

// ============================
// EXPENSE RECEIPT ROUTES (CRUD)
// ============================

// All roles that can view expenses can also view receipts
router.get(
  "/expenses/:expenseId/receipts",
  viewAllExpenses,
  validate(getExpenseReceiptsSchema),
  getExpenseReceiptsHandler,
);

router.get(
  "/expenses/:expenseId/receipts/:receiptId",
  viewAllExpenses,
  validate(getExpenseReceiptByIdSchema),
  getExpenseReceiptByIdHandler,
);

// All roles that can create expenses can upload receipts
router.post(
  "/expenses/:expenseId/receipts",
  createExpense,
  (req, res, next) => {
    upload(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  validate(createExpenseReceiptSchema),
  createExpenseReceiptHandler,
);

router.put(
  "/expenses/:expenseId/receipts/:receiptId",
  editOwnExpense,
  (req, res, next) => {
    upload(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  validate(updateExpenseReceiptSchema),
  updateExpenseReceiptHandler,
);

router.delete(
  "/expenses/:expenseId/receipts/:receiptId",
  deleteExpense,
  validate(deleteExpenseReceiptSchema),
  deleteExpenseReceiptHandler,
);

// Bulk delete expenses (Executive only)
router.post(
  "/expenses/bulk-delete",
  authorizeFeature("expenses", "bulk_delete"),
  validate(bulkDeleteUuidSchema),
  bulkDeleteExpensesHandler,
);

export default router;
