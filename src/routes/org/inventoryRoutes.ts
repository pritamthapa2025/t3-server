import { Router } from "express";
import multer from "multer";
import {
  getInventoryItemsHandler,
  getInventoryItemByIdHandler,
  createInventoryItemHandler,
  updateInventoryItemHandler,
  deleteInventoryItemHandler,
  getItemHistoryHandler,
  getDashboardHandler,
  getStatsByCategoryHandler,
  getStatsByLocationHandler,
  getStatsByStatusHandler,
  getTransactionsHandler,
  createTransactionHandler,
  getItemTransactionsHandler,
  getAllocationsHandler,
  getAllocationByIdHandler,
  createAllocationHandler,
  updateAllocationHandler,
  issueAllocationHandler,
  returnAllocationHandler,
  cancelAllocationHandler,
  getAllocationsByJobHandler,
  getAllocationsByBidHandler,
  getPurchaseOrdersHandler,
  getPurchaseOrderByIdHandler,
  createPurchaseOrderHandler,
  updatePurchaseOrderHandler,
  approvePurchaseOrderHandler,
  sendPurchaseOrderHandler,
  cancelPurchaseOrderHandler,
  closePurchaseOrderHandler,
  receivePartialPurchaseOrderHandler,
  addPurchaseOrderItemHandler,
  updatePurchaseOrderItemHandler,
  deletePurchaseOrderItemHandler,
  receivePurchaseOrderHandler,
  getPurchaseOrderItemsHandler,
  getSuppliersHandler,
  getSupplierByIdHandler,
  createSupplierHandler,
  updateSupplierHandler,
  deleteSupplierHandler,
  getLocationsHandler,
  getLocationByIdHandler,
  createLocationHandler,
  updateLocationHandler,
  deleteLocationHandler,
  getCategoriesHandler,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
  getUnitsHandler,
  createUnitHandler,
  updateUnitHandler,
  deleteUnitHandler,
  getAlertsHandler,
  getUnresolvedAlertsHandler,
  acknowledgeAlertHandler,
  resolveAlertHandler,
  triggerAlertCheckHandler,
  getCountsHandler,
  getCountByIdHandler,
  createCountHandler,
  startCountHandler,
  completeCountHandler,
  getCountItemsHandler,
  recordCountItemHandler,
} from "../../controllers/InventoryController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getInventoryItemsQuerySchema,
  getInventoryItemByIdSchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  deleteInventoryItemSchema,
  getInventoryTransactionsQuerySchema,
  createTransactionSchema,
  getAllocationsQuerySchema,
  createAllocationSchema,
  updateAllocationSchema,
  issueAllocationSchema,
  returnAllocationSchema,
  getPurchaseOrdersQuerySchema,
  getPurchaseOrderByIdSchema,
  createPurchaseOrderSchema,
  sendPurchaseOrderSchema,
  cancelPurchaseOrderSchema,
  closePurchaseOrderSchema,
  receivePartialPurchaseOrderSchema,
  addPurchaseOrderItemSchema,
  updatePurchaseOrderItemSchema,
  deletePurchaseOrderItemSchema,
  updatePurchaseOrderSchema,
  approvePurchaseOrderSchema,
  receivePurchaseOrderSchema,
  getSuppliersQuerySchema,
  createSupplierSchema,
  updateSupplierSchema,
  getLocationsQuerySchema,
  createLocationSchema,
  updateLocationSchema,
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
  deleteUnitSchema,
  acknowledgeAlertSchema,
  resolveAlertSchema,
  createCountSchema,
  updateCountSchema,
  recordCountItemSchema,
  uuidParamSchema,
  deleteSchema,
} from "../../validations/inventory.validations.js";
import { generalTransformer } from "../../middleware/response-transformer.js";

const router = Router();

// Configure multer for memory storage (for item image upload)
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
}).single("image"); // Handle the image field

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

// Apply authentication to all routes
router.use(authenticate);

// Apply timezone transformation to all GET responses
router.use(generalTransformer);

// ============================
// Inventory Items Routes
// ============================

router.get(
  "/items",
  validate(getInventoryItemsQuerySchema),
  getInventoryItemsHandler
);

router.get(
  "/items/:id",
  validate(getInventoryItemByIdSchema),
  getInventoryItemByIdHandler
);

router.post(
  "/items",
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
  validate(createInventoryItemSchema),
  createInventoryItemHandler
);

router.put(
  "/items/:id",
  validate(updateInventoryItemSchema),
  updateInventoryItemHandler
);

router.delete(
  "/items/:id",
  validate(deleteInventoryItemSchema),
  deleteInventoryItemHandler
);

router.get(
  "/items/:id/history",
  validate(uuidParamSchema),
  getItemHistoryHandler
);

router.get(
  "/items/:id/transactions",
  validate(uuidParamSchema),
  getItemTransactionsHandler
);

// ============================
// Dashboard & Summary Routes
// ============================

router.get("/dashboard", getDashboardHandler);
router.get("/stats/by-category", getStatsByCategoryHandler);
router.get("/stats/by-location", getStatsByLocationHandler);
router.get("/stats/by-status", getStatsByStatusHandler);

// ============================
// Transaction Routes
// ============================

router.get(
  "/transactions",
  validate(getInventoryTransactionsQuerySchema),
  getTransactionsHandler
);

router.post(
  "/transactions",
  validate(createTransactionSchema),
  createTransactionHandler
);

// Convenient transaction endpoints by type
router.post(
  "/transactions/receipt",
  validate(createTransactionSchema),
  createTransactionHandler
);

router.post(
  "/transactions/issue",
  validate(createTransactionSchema),
  createTransactionHandler
);

router.post(
  "/transactions/adjustment",
  validate(createTransactionSchema),
  createTransactionHandler
);

router.post(
  "/transactions/transfer",
  validate(createTransactionSchema),
  createTransactionHandler
);

router.post(
  "/transactions/return",
  validate(createTransactionSchema),
  createTransactionHandler
);

router.post(
  "/transactions/write-off",
  validate(createTransactionSchema),
  createTransactionHandler
);

// ============================
// Allocation Routes
// ============================

router.get(
  "/allocations",
  validate(getAllocationsQuerySchema),
  getAllocationsHandler
);

router.get(
  "/allocations/:id",
  validate(uuidParamSchema),
  getAllocationByIdHandler
);

router.post(
  "/allocations",
  validate(createAllocationSchema),
  createAllocationHandler
);

router.put(
  "/allocations/:id",
  validate(updateAllocationSchema),
  updateAllocationHandler
);

router.delete(
  "/allocations/:id",
  validate(deleteSchema),
  cancelAllocationHandler
);

router.post(
  "/allocations/:id/issue",
  validate(issueAllocationSchema),
  issueAllocationHandler
);

router.post(
  "/allocations/:id/return",
  validate(returnAllocationSchema),
  returnAllocationHandler
);

router.get(
  "/allocations/job/:jobId",
  validate(uuidParamSchema),
  getAllocationsByJobHandler
);

router.get(
  "/allocations/bid/:bidId",
  validate(uuidParamSchema),
  getAllocationsByBidHandler
);

// ============================
// Purchase Order Routes
// ============================

router.get(
  "/purchase-orders",
  validate(getPurchaseOrdersQuerySchema),
  getPurchaseOrdersHandler
);

router.get(
  "/purchase-orders/:id",
  validate(getPurchaseOrderByIdSchema),
  getPurchaseOrderByIdHandler
);

router.post(
  "/purchase-orders",
  validate(createPurchaseOrderSchema),
  createPurchaseOrderHandler
);

router.put(
  "/purchase-orders/:id",
  validate(updatePurchaseOrderSchema),
  updatePurchaseOrderHandler
);

router.put(
  "/purchase-orders/:id/approve",
  validate(approvePurchaseOrderSchema),
  approvePurchaseOrderHandler
);

router.put(
  "/purchase-orders/:id/send",
  validate(sendPurchaseOrderSchema),
  sendPurchaseOrderHandler
);

router.put(
  "/purchase-orders/:id/cancel",
  validate(cancelPurchaseOrderSchema),
  cancelPurchaseOrderHandler
);

router.put(
  "/purchase-orders/:id/close",
  validate(closePurchaseOrderSchema),
  closePurchaseOrderHandler
);

router.post(
  "/purchase-orders/:id/receive",
  validate(receivePurchaseOrderSchema),
  receivePurchaseOrderHandler
);

router.post(
  "/purchase-orders/:id/receive-partial",
  validate(receivePartialPurchaseOrderSchema),
  receivePartialPurchaseOrderHandler
);

// PO Line Item Routes
router.post(
  "/purchase-orders/:id/items",
  validate(addPurchaseOrderItemSchema),
  addPurchaseOrderItemHandler
);

router.put(
  "/purchase-order-items/:id",
  validate(updatePurchaseOrderItemSchema),
  updatePurchaseOrderItemHandler
);

router.delete(
  "/purchase-order-items/:id",
  validate(deletePurchaseOrderItemSchema),
  deletePurchaseOrderItemHandler
);

router.get(
  "/purchase-orders/:id/items",
  validate(uuidParamSchema),
  getPurchaseOrderItemsHandler
);

// ============================
// Supplier Routes
// ============================

router.get(
  "/suppliers",
  validate(getSuppliersQuerySchema),
  getSuppliersHandler
);

router.get("/suppliers/:id", validate(uuidParamSchema), getSupplierByIdHandler);

router.post(
  "/suppliers",
  validate(createSupplierSchema),
  createSupplierHandler
);

router.put(
  "/suppliers/:id",
  validate(updateSupplierSchema),
  updateSupplierHandler
);

router.delete("/suppliers/:id", validate(deleteSchema), deleteSupplierHandler);

// ============================
// Location Routes
// ============================

router.get(
  "/locations",
  validate(getLocationsQuerySchema),
  getLocationsHandler
);

router.get("/locations/:id", validate(uuidParamSchema), getLocationByIdHandler);

router.post(
  "/locations",
  validate(createLocationSchema),
  createLocationHandler
);

router.put(
  "/locations/:id",
  validate(updateLocationSchema),
  updateLocationHandler
);

router.delete("/locations/:id", validate(deleteSchema), deleteLocationHandler);

// ============================
// Category Routes
// ============================

router.get("/categories", getCategoriesHandler);

router.post(
  "/categories",
  validate(createCategorySchema),
  createCategoryHandler
);

router.put(
  "/categories/:id",
  validate(updateCategorySchema),
  updateCategoryHandler
);

router.delete(
  "/categories/:id",
  validate(deleteCategorySchema),
  deleteCategoryHandler
);

// ============================
// Units of Measure Routes
// ============================

router.get("/units", getUnitsHandler);
router.post("/units", createUnitHandler);
router.put("/units/:id", updateUnitHandler);

router.delete("/units/:id", validate(deleteUnitSchema), deleteUnitHandler);

// ============================
// Stock Alert Routes
// ============================

router.get("/alerts", getAlertsHandler);
router.get("/alerts/unresolved", getUnresolvedAlertsHandler);

router.put(
  "/alerts/:id/acknowledge",
  validate(acknowledgeAlertSchema),
  acknowledgeAlertHandler
);

router.put(
  "/alerts/:id/resolve",
  validate(resolveAlertSchema),
  resolveAlertHandler
);

router.post("/alerts/trigger-check", triggerAlertCheckHandler);

// ============================
// Physical Count Routes
// ============================

router.get("/counts", getCountsHandler);

router.get("/counts/:id", validate(uuidParamSchema), getCountByIdHandler);

router.post("/counts", validate(createCountSchema), createCountHandler);

// Note: updateCountHandler not implemented yet
// router.put("/counts/:id", validate(updateCountSchema), updateCountHandler);

router.post("/counts/:id/start", validate(uuidParamSchema), startCountHandler);

router.post(
  "/counts/:id/complete",
  validate(uuidParamSchema),
  completeCountHandler
);

router.get(
  "/counts/:id/items",
  validate(uuidParamSchema),
  getCountItemsHandler
);

router.put(
  "/counts/:countId/items/:itemId",
  validate(recordCountItemSchema),
  recordCountItemHandler
);

export default router;
