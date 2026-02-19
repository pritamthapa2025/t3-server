import { Router, type IRouter } from "express";
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
  updateCountHandler,
  startCountHandler,
  completeCountHandler,
  getCountItemsHandler,
  recordCountItemHandler,
  bulkDeleteInventoryItemsHandler,
} from "../../controllers/InventoryController.js";
import { authenticate } from "../../middleware/auth.js";
import { authorizeFeature } from "../../middleware/featureAuthorize.js";
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
  updateUnitSchema,
  deleteUnitSchema,
  acknowledgeAlertSchema,
  resolveAlertSchema,
  createCountSchema,
  updateCountSchema,
  recordCountItemSchema,
  uuidParamSchema,
  deleteSchema,
} from "../../validations/inventory.validations.js";
import { bulkDeleteUuidSchema } from "../../validations/bulk-delete.validations.js";

const router: IRouter = Router();

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


// Feature shorthand constants
// Technicians: view only; Managers: add/edit; Executives: delete + all
const viewInventory = authorizeFeature("inventory", "view_inventory");
const addItem = authorizeFeature("inventory", "add_item");
const editItem = authorizeFeature("inventory", "edit_item");
const deleteItem = authorizeFeature("inventory", "delete_item");
const adjustQuantity = authorizeFeature("inventory", "adjust_quantity");
// Purchase orders and suppliers — Manager/Executive only (reuses add_item gate)
const managePOs = authorizeFeature("inventory", "add_item");

// ============================
// Inventory Items Routes
// ============================

router.get(
  "/items",
  viewInventory,
  validate(getInventoryItemsQuerySchema),
  getInventoryItemsHandler,
);

router.get(
  "/items/:id",
  viewInventory,
  validate(getInventoryItemByIdSchema),
  getInventoryItemByIdHandler,
);

// Create item — Manager/Executive only
router.post(
  "/items",
  addItem,
  (req, res, next) => {
    if (req.headers["content-type"]?.includes("multipart/form-data")) {
      upload(req, res, (err) => {
        if (err) {
          return handleMulterError(err, req, res, next);
        }
        next();
      });
    } else {
      next();
    }
  },
  validate(createInventoryItemSchema),
  createInventoryItemHandler,
);

// Edit item — Manager/Executive only
router.put(
  "/items/:id",
  editItem,
  validate(updateInventoryItemSchema),
  updateInventoryItemHandler,
);

// Delete item — Executive only
router.delete(
  "/items/:id",
  deleteItem,
  validate(deleteInventoryItemSchema),
  deleteInventoryItemHandler,
);

router.get(
  "/items/:id/history",
  viewInventory,
  validate(uuidParamSchema),
  getItemHistoryHandler,
);

router.get(
  "/items/:id/transactions",
  viewInventory,
  validate(uuidParamSchema),
  getItemTransactionsHandler,
);

// ============================
// Dashboard & Summary Routes
// ============================

router.get("/dashboard", viewInventory, getDashboardHandler);
router.get("/stats/by-category", viewInventory, getStatsByCategoryHandler);
router.get("/stats/by-location", viewInventory, getStatsByLocationHandler);
router.get("/stats/by-status", viewInventory, getStatsByStatusHandler);

// ============================
// Transaction Routes — Technicians can confirm receipts
// ============================

router.get(
  "/transactions",
  viewInventory,
  validate(getInventoryTransactionsQuerySchema),
  getTransactionsHandler,
);

router.post(
  "/transactions",
  viewInventory,
  validate(createTransactionSchema),
  createTransactionHandler,
);

// Confirm receipt (mark as received) — Technicians can do this
router.post(
  "/transactions/receipt",
  viewInventory,
  validate(createTransactionSchema),
  createTransactionHandler,
);

// These transactions modify inventory quantities — Manager/Executive only
router.post(
  "/transactions/issue",
  adjustQuantity,
  validate(createTransactionSchema),
  createTransactionHandler,
);

router.post(
  "/transactions/adjustment",
  adjustQuantity,
  validate(createTransactionSchema),
  createTransactionHandler,
);

router.post(
  "/transactions/transfer",
  adjustQuantity,
  validate(createTransactionSchema),
  createTransactionHandler,
);

router.post(
  "/transactions/return",
  viewInventory,
  validate(createTransactionSchema),
  createTransactionHandler,
);

router.post(
  "/transactions/write-off",
  adjustQuantity,
  validate(createTransactionSchema),
  createTransactionHandler,
);

// ============================
// Allocation Routes — Manager/Executive only
// ============================

router.get(
  "/allocations",
  viewInventory,
  validate(getAllocationsQuerySchema),
  getAllocationsHandler,
);

router.get(
  "/allocations/:id",
  viewInventory,
  validate(uuidParamSchema),
  getAllocationByIdHandler,
);

router.post(
  "/allocations",
  addItem,
  validate(createAllocationSchema),
  createAllocationHandler,
);

router.put(
  "/allocations/:id",
  editItem,
  validate(updateAllocationSchema),
  updateAllocationHandler,
);

router.delete(
  "/allocations/:id",
  editItem,
  validate(deleteSchema),
  cancelAllocationHandler,
);

router.post(
  "/allocations/:id/issue",
  editItem,
  validate(issueAllocationSchema),
  issueAllocationHandler,
);

router.post(
  "/allocations/:id/return",
  viewInventory,
  validate(returnAllocationSchema),
  returnAllocationHandler,
);

router.get(
  "/allocations/job/:jobId",
  viewInventory,
  validate(uuidParamSchema),
  getAllocationsByJobHandler,
);

router.get(
  "/allocations/bid/:bidId",
  viewInventory,
  validate(uuidParamSchema),
  getAllocationsByBidHandler,
);

// ============================
// Purchase Order Routes — Manager/Executive only
// ============================

router.get(
  "/purchase-orders",
  managePOs,
  validate(getPurchaseOrdersQuerySchema),
  getPurchaseOrdersHandler,
);

router.get(
  "/purchase-orders/:id",
  managePOs,
  validate(getPurchaseOrderByIdSchema),
  getPurchaseOrderByIdHandler,
);

router.post(
  "/purchase-orders",
  managePOs,
  validate(createPurchaseOrderSchema),
  createPurchaseOrderHandler,
);

router.put(
  "/purchase-orders/:id",
  managePOs,
  validate(updatePurchaseOrderSchema),
  updatePurchaseOrderHandler,
);

router.put(
  "/purchase-orders/:id/approve",
  managePOs,
  validate(approvePurchaseOrderSchema),
  approvePurchaseOrderHandler,
);

router.put(
  "/purchase-orders/:id/send",
  managePOs,
  validate(sendPurchaseOrderSchema),
  sendPurchaseOrderHandler,
);

router.put(
  "/purchase-orders/:id/cancel",
  managePOs,
  validate(cancelPurchaseOrderSchema),
  cancelPurchaseOrderHandler,
);

router.put(
  "/purchase-orders/:id/close",
  managePOs,
  validate(closePurchaseOrderSchema),
  closePurchaseOrderHandler,
);

router.post(
  "/purchase-orders/:id/receive",
  viewInventory,
  validate(receivePurchaseOrderSchema),
  receivePurchaseOrderHandler,
);

router.post(
  "/purchase-orders/:id/receive-partial",
  viewInventory,
  validate(receivePartialPurchaseOrderSchema),
  receivePartialPurchaseOrderHandler,
);

// PO Line Item Routes — Manager/Executive only
router.post(
  "/purchase-orders/:id/items",
  managePOs,
  validate(addPurchaseOrderItemSchema),
  addPurchaseOrderItemHandler,
);

router.put(
  "/purchase-order-items/:id",
  managePOs,
  validate(updatePurchaseOrderItemSchema),
  updatePurchaseOrderItemHandler,
);

router.delete(
  "/purchase-order-items/:id",
  managePOs,
  validate(deletePurchaseOrderItemSchema),
  deletePurchaseOrderItemHandler,
);

router.get(
  "/purchase-orders/:id/items",
  managePOs,
  validate(uuidParamSchema),
  getPurchaseOrderItemsHandler,
);

// ============================
// Supplier Routes — all can view; Manager/Executive can manage
// ============================

router.get(
  "/suppliers",
  viewInventory,
  validate(getSuppliersQuerySchema),
  getSuppliersHandler,
);

router.get(
  "/suppliers/:id",
  viewInventory,
  validate(uuidParamSchema),
  getSupplierByIdHandler,
);

router.post(
  "/suppliers",
  addItem,
  validate(createSupplierSchema),
  createSupplierHandler,
);

router.put(
  "/suppliers/:id",
  editItem,
  validate(updateSupplierSchema),
  updateSupplierHandler,
);

router.delete(
  "/suppliers/:id",
  deleteItem,
  validate(deleteSchema),
  deleteSupplierHandler,
);

// ============================
// Location Routes — all can view; Manager/Executive can manage
// ============================

router.get(
  "/locations",
  viewInventory,
  validate(getLocationsQuerySchema),
  getLocationsHandler,
);

router.get(
  "/locations/:id",
  viewInventory,
  validate(uuidParamSchema),
  getLocationByIdHandler,
);

router.post(
  "/locations",
  addItem,
  validate(createLocationSchema),
  createLocationHandler,
);

router.put(
  "/locations/:id",
  editItem,
  validate(updateLocationSchema),
  updateLocationHandler,
);

router.delete(
  "/locations/:id",
  editItem,
  validate(deleteSchema),
  deleteLocationHandler,
);

// ============================
// Category Routes — all can view; Manager/Executive can manage
// ============================

router.get("/categories", viewInventory, getCategoriesHandler);

router.post(
  "/categories",
  addItem,
  validate(createCategorySchema),
  createCategoryHandler,
);

router.put(
  "/categories/:id",
  editItem,
  validate(updateCategorySchema),
  updateCategoryHandler,
);

router.delete(
  "/categories/:id",
  editItem,
  validate(deleteCategorySchema),
  deleteCategoryHandler,
);

// ============================
// Units of Measure Routes — all can view; Manager/Executive can manage
// ============================

router.get("/units", viewInventory, getUnitsHandler);
router.post("/units", addItem, createUnitHandler);
router.put(
  "/units/:id",
  editItem,
  validate(updateUnitSchema),
  updateUnitHandler,
);

router.delete(
  "/units/:id",
  editItem,
  validate(deleteUnitSchema),
  deleteUnitHandler,
);

// ============================
// Stock Alert Routes — Manager/Executive only
// ============================

router.get("/alerts", managePOs, getAlertsHandler);
router.get("/alerts/unresolved", managePOs, getUnresolvedAlertsHandler);

router.put(
  "/alerts/:id/acknowledge",
  managePOs,
  validate(acknowledgeAlertSchema),
  acknowledgeAlertHandler,
);

router.put(
  "/alerts/:id/resolve",
  managePOs,
  validate(resolveAlertSchema),
  resolveAlertHandler,
);

router.post("/alerts/trigger-check", managePOs, triggerAlertCheckHandler);

// ============================
// Physical Count Routes — Manager/Executive only
// ============================

router.get("/counts", managePOs, getCountsHandler);

router.get(
  "/counts/:id",
  managePOs,
  validate(uuidParamSchema),
  getCountByIdHandler,
);

router.post(
  "/counts",
  managePOs,
  validate(createCountSchema),
  createCountHandler,
);

router.put(
  "/counts/:id",
  managePOs,
  validate(updateCountSchema),
  updateCountHandler,
);

router.post(
  "/counts/:id/start",
  managePOs,
  validate(uuidParamSchema),
  startCountHandler,
);

router.post(
  "/counts/:id/complete",
  managePOs,
  validate(uuidParamSchema),
  completeCountHandler,
);

router.get(
  "/counts/:id/items",
  managePOs,
  validate(uuidParamSchema),
  getCountItemsHandler,
);

router.put(
  "/counts/:countId/items/:itemId",
  managePOs,
  validate(recordCountItemSchema),
  recordCountItemHandler,
);

// Bulk delete inventory items (Executive only)
router.post(
  "/inventory/bulk-delete",
  authorizeFeature("inventory", "bulk_delete"),
  validate(bulkDeleteUuidSchema),
  bulkDeleteInventoryItemsHandler,
);

export default router;
