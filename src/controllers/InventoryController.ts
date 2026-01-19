import type { Request, Response } from "express";
import { logger } from "../utils/logger.js";
import * as inventoryService from "../services/inventory/index.js";
import { uploadToSpaces } from "../services/storage.service.js";

// ============================
// Helper Functions
// ============================

const validateUserAccess = (req: Request, res: Response): string | null => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(403).json({
      success: false,
      message: "Access denied. Authentication required.",
    });
    return null;
  }

  return userId;
};

const validateParam = (
  param: string | undefined,
  paramName: string,
  res: Response
): string | null => {
  if (!param) {
    res.status(400).json({
      success: false,
      message: `${paramName} is required`,
    });
    return null;
  }
  return param;
};

// ============================
// Inventory Items Controllers
// ============================

export const getInventoryItemsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const offset = (page - 1) * limit;

    const filters = {
      category: req.query.category as string,
      status: req.query.status as string,
      supplier: req.query.supplier as string,
      location: req.query.location as string,
      allocationStatus: req.query.allocationStatus as string,
      search: req.query.search as string,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as string,
    };

    const result = await inventoryService.getInventoryItems(
      offset,
      limit,
      filters
    );

    logger.info("Inventory items fetched successfully");
    res.status(200).json({
      success: true,
      message: "Inventory items retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching inventory items", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve inventory items",
      error: error.message,
    });
  }
};

export const getInventoryItemByIdHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const validId = validateParam(id, "Item ID", res);
    if (!validId) return;

    const item = await inventoryService.getInventoryItemById(validId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    logger.info(`Inventory item ${validId} fetched successfully`);
    res.status(200).json({
      success: true,
      message: "Inventory item retrieved successfully",
      data: item,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching inventory item by ID", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve inventory item",
      error: error.message,
    });
  }
};

export const createInventoryItemHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    // Parse item data - either from JSON body or from form-data field
    let itemData: any;
    if (req.headers["content-type"]?.includes("application/json")) {
      // JSON request - data is in req.body
      itemData = req.body;
    } else {
      // Multipart form-data - parse JSON from 'data' field
      if (req.body.data) {
        try {
          itemData =
            typeof req.body.data === "string"
              ? JSON.parse(req.body.data)
              : req.body.data;
        } catch {
          return res.status(400).json({
            success: false,
            message: "Invalid JSON in 'data' field",
          });
        }
      } else {
        // Fallback: use req.body directly
        itemData = req.body;
      }
    }

    // Handle file upload if provided
    const file = req.file;
    if (file) {
      try {
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "inventory-items"
        );
        // Add image URL to images array
        if (!itemData.images) {
          itemData.images = [];
        }
        if (Array.isArray(itemData.images)) {
          itemData.images.push(uploadResult.url);
        } else {
          itemData.images = [uploadResult.url];
        }
      } catch (uploadError: any) {
        logger.logApiError("File upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image. Please try again.",
        });
      }
    }

    const newItem = await inventoryService.createInventoryItem(
      itemData,
      userId
    );

    logger.info(`Inventory item ${newItem.id} created successfully`);
    res.status(201).json({
      success: true,
      message: "Inventory item created successfully",
      data: newItem,
    });
  } catch (error: any) {
    logger.logApiError("Error creating inventory item", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to create inventory item",
      error: error.message,
    });
  }
};

export const updateInventoryItemHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const validId = validateParam(id, "Item ID", res);
    if (!validId) return;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const updatedItem = await inventoryService.updateInventoryItem(
      validId,
      req.body,
      userId
    );

    logger.info(`Inventory item ${validId} updated successfully`);
    res.status(200).json({
      success: true,
      message: "Inventory item updated successfully",
      data: updatedItem,
    });
  } catch (error: any) {
    logger.logApiError("Error updating inventory item", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to update inventory item",
      error: error.message,
    });
  }
};

export const deleteInventoryItemHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const deletedItem = await inventoryService.deleteInventoryItem(id!, userId);

    logger.info(`Inventory item ${id} deleted successfully`);
    res.status(200).json({
      success: true,
      message: "Inventory item deleted successfully",
      data: deletedItem,
    });
  } catch (error: any) {
    logger.logApiError("Error deleting inventory item", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to delete inventory item",
      error: error.message,
    });
  }
};

export const getItemHistoryHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const history = await inventoryService.getItemHistory(id!);

    logger.info(`Item history for item ${id} fetched successfully`);
    res.status(200).json({
      success: true,
      message: "Item history retrieved successfully",
      data: history,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching item history", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve item history",
      error: error.message,
    });
  }
};

// ============================
// Dashboard & Summary Controllers
// ============================

export const getDashboardHandler = async (req: Request, res: Response) => {
  try {
    const summary = await inventoryService.getDashboardSummary();

    logger.info("Inventory dashboard summary fetched successfully");
    res.status(200).json({
      success: true,
      message: "Dashboard summary retrieved successfully",
      data: summary,
    });
  } catch (error: any) {
    logger.logApiError(
      "Error fetching inventory dashboard summary",
      error,
      req
    );
    res.status(500).json({
      success: false,
      message: "Failed to retrieve dashboard summary",
      error: error.message,
    });
  }
};

export const getStatsByCategoryHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const stats = await inventoryService.getStatsByCategory();

    logger.info("Inventory statistics by category fetched successfully");
    res.status(200).json({
      success: true,
      message: "Category statistics retrieved successfully",
      data: stats,
    });
  } catch (error: any) {
    logger.logApiError(
      "Error fetching inventory statistics by category",
      error,
      req
    );
    res.status(500).json({
      success: false,
      message: "Failed to retrieve category statistics",
      error: error.message,
    });
  }
};

export const getStatsByLocationHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const stats = await inventoryService.getStatsByLocation();

    logger.info("Inventory statistics by location fetched successfully");
    res.status(200).json({
      success: true,
      message: "Location statistics retrieved successfully",
      data: stats,
    });
  } catch (error: any) {
    logger.logApiError(
      "Error fetching inventory statistics by location",
      error,
      req
    );
    res.status(500).json({
      success: false,
      message: "Failed to retrieve location statistics",
      error: error.message,
    });
  }
};

export const getStatsByStatusHandler = async (req: Request, res: Response) => {
  try {
    const stats = await inventoryService.getStatsByStatus();

    logger.info("Inventory statistics by status fetched successfully");
    res.status(200).json({
      success: true,
      message: "Status statistics retrieved successfully",
      data: stats,
    });
  } catch (error: any) {
    logger.logApiError(
      "Error fetching inventory statistics by status",
      error,
      req
    );
    res.status(500).json({
      success: false,
      message: "Failed to retrieve status statistics",
      error: error.message,
    });
  }
};

// ============================
// Transaction Controllers
// ============================

export const getTransactionsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const offset = (page - 1) * limit;

    const filters = {
      itemId: req.query.itemId as string,
      transactionType: req.query.transactionType as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      jobId: req.query.jobId as string,
      bidId: req.query.bidId as string,
    };

    const result = await inventoryService.getTransactions(
      offset,
      limit,
      filters
    );

    logger.info("Inventory transactions fetched successfully");
    res.status(200).json({
      success: true,
      message: "Transactions retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching inventory transactions", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve transactions",
      error: error.message,
    });
  }
};

export const createTransactionHandler = async (req: Request, res: Response) => {
  try {
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const newTransaction = await inventoryService.createTransaction(
      req.body,
      userId
    );

    logger.info(
      `Inventory transaction ${newTransaction.id} created successfully`
    );
    res.status(201).json({
      success: true,
      message: "Transaction created successfully",
      data: newTransaction,
    });
  } catch (error: any) {
    logger.logApiError("Error creating inventory transaction", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to create transaction",
      error: error.message,
    });
  }
};

export const getItemTransactionsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    const transactions = await inventoryService.getItemTransactions(id!);

    logger.info(`Transactions for item ${id} fetched successfully`);
    res.status(200).json({
      success: true,
      message: "Item transactions retrieved successfully",
      data: transactions,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching item transactions", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve item transactions",
      error: error.message,
    });
  }
};

// ============================
// Allocation Controllers
// ============================

export const getAllocationsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const offset = (page - 1) * limit;

    const filters = {
      itemId: req.query.itemId as string,
      jobId: req.query.jobId as string,
      bidId: req.query.bidId as string,
      status: req.query.status as string,
    };

    const result = await inventoryService.getAllocations(
      offset,
      limit,
      filters
    );

    logger.info("Inventory allocations fetched successfully");
    res.status(200).json({
      success: true,
      message: "Allocations retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching inventory allocations", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve allocations",
      error: error.message,
    });
  }
};

export const getAllocationByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const allocation = await inventoryService.getAllocationById(id!);

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: "Allocation not found",
      });
    }

    logger.info(`Inventory allocation ${id} fetched successfully`);
    res.status(200).json({
      success: true,
      message: "Allocation retrieved successfully",
      data: allocation,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching inventory allocation by ID", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve allocation",
      error: error.message,
    });
  }
};

export const createAllocationHandler = async (req: Request, res: Response) => {
  try {
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const newAllocation = await inventoryService.createAllocation(
      req.body,
      userId
    );

    logger.info(
      `Inventory allocation ${newAllocation.id} created successfully`
    );
    res.status(201).json({
      success: true,
      message: "Allocation created successfully",
      data: newAllocation,
    });
  } catch (error: any) {
    logger.logApiError("Error creating inventory allocation", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to create allocation",
      error: error.message,
    });
  }
};

export const updateAllocationHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const updatedAllocation = await inventoryService.updateAllocation(
      id!,
      req.body
    );

    logger.info(`Inventory allocation ${id} updated successfully`);
    res.status(200).json({
      success: true,
      message: "Allocation updated successfully",
      data: updatedAllocation,
    });
  } catch (error: any) {
    logger.logApiError("Error updating inventory allocation", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to update allocation",
      error: error.message,
    });
  }
};

export const issueAllocationHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const updatedAllocation = await inventoryService.issueAllocation(
      id!,
      userId
    );

    logger.info(`Inventory allocation ${id} issued successfully`);
    res.status(200).json({
      success: true,
      message: "Allocation issued successfully",
      data: updatedAllocation,
    });
  } catch (error: any) {
    logger.logApiError("Error issuing inventory allocation", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to issue allocation",
      error: error.message,
    });
  }
};

export const returnAllocationHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const updatedAllocation = await inventoryService.returnAllocation(
      id!,
      req.body,
      userId
    );

    logger.info(`Inventory allocation ${id} returned successfully`);
    res.status(200).json({
      success: true,
      message: "Allocation returned successfully",
      data: updatedAllocation,
    });
  } catch (error: any) {
    logger.logApiError("Error returning inventory allocation", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to return allocation",
      error: error.message,
    });
  }
};

export const cancelAllocationHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cancelledAllocation = await inventoryService.cancelAllocation(id!);

    logger.info(`Inventory allocation ${id} cancelled successfully`);
    res.status(200).json({
      success: true,
      message: "Allocation cancelled successfully",
      data: cancelledAllocation,
    });
  } catch (error: any) {
    logger.logApiError("Error cancelling inventory allocation", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to cancel allocation",
      error: error.message,
    });
  }
};

export const getAllocationsByJobHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { jobId } = req.params;

    const allocations = await inventoryService.getAllocationsByJob(jobId!);

    logger.info(`Inventory allocations for job ${jobId} fetched successfully`);
    res.status(200).json({
      success: true,
      message: "Job allocations retrieved successfully",
      data: allocations.data,
      total: allocations.total,
    });
  } catch (error: any) {
    logger.logApiError(
      "Error fetching inventory allocations by job",
      error,
      req
    );
    res.status(500).json({
      success: false,
      message: "Failed to retrieve job allocations",
      error: error.message,
    });
  }
};

export const getAllocationsByBidHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { bidId } = req.params;

    const allocations = await inventoryService.getAllocationsByBid(bidId!);

    logger.info(`Inventory allocations for bid ${bidId} fetched successfully`);
    res.status(200).json({
      success: true,
      message: "Bid allocations retrieved successfully",
      data: allocations.data,
      total: allocations.total,
    });
  } catch (error: any) {
    logger.logApiError(
      "Error fetching inventory allocations by bid",
      error,
      req
    );
    res.status(500).json({
      success: false,
      message: "Failed to retrieve bid allocations",
      error: error.message,
    });
  }
};

// ============================
// Purchase Order Controllers
// ============================

export const getPurchaseOrdersHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const offset = (page - 1) * limit;

    const filters = {
      status: req.query.status as string,
      supplierId: req.query.supplierId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    const result = await inventoryService.getPurchaseOrders(
      offset,
      limit,
      filters
    );

    logger.info("Purchase orders fetched successfully");
    res.status(200).json({
      success: true,
      message: "Purchase orders retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching purchase orders", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve purchase orders",
      error: error.message,
    });
  }
};

export const getPurchaseOrderByIdHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    const po = await inventoryService.getPurchaseOrderById(id!);

    if (!po) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    logger.info(`Purchase order ${id} fetched successfully`);
    res.status(200).json({
      success: true,
      message: "Purchase order retrieved successfully",
      data: po,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching purchase order by ID", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve purchase order",
      error: error.message,
    });
  }
};

export const createPurchaseOrderHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const newPO = await inventoryService.createPurchaseOrder(req.body, userId);

    logger.info(`Purchase order ${newPO.id} created successfully`);
    res.status(201).json({
      success: true,
      message: "Purchase order created successfully",
      data: newPO,
    });
  } catch (error: any) {
    logger.logApiError("Error creating purchase order", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to create purchase order",
      error: error.message,
    });
  }
};

export const updatePurchaseOrderHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    const updatedPO = await inventoryService.updatePurchaseOrder(id!, req.body);

    logger.info(`Purchase order ${id} updated successfully`);
    res.status(200).json({
      success: true,
      message: "Purchase order updated successfully",
      data: updatedPO,
    });
  } catch (error: any) {
    logger.logApiError("Error updating purchase order", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to update purchase order",
      error: error.message,
    });
  }
};

export const approvePurchaseOrderHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const approvedPO = await inventoryService.approvePurchaseOrder(id!, userId);

    logger.info(`Purchase order ${id} approved successfully`);
    res.status(200).json({
      success: true,
      message: "Purchase order approved successfully",
      data: approvedPO,
    });
  } catch (error: any) {
    logger.logApiError("Error approving purchase order", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to approve purchase order",
      error: error.message,
    });
  }
};

export const sendPurchaseOrderHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const sentPO = await inventoryService.sendPurchaseOrder(id!);

    logger.info(`Purchase order ${id} sent successfully`);
    res.status(200).json({
      success: true,
      message: "Purchase order sent successfully",
      data: sentPO,
    });
  } catch (error: any) {
    logger.logApiError("Error sending purchase order", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to send purchase order",
      error: error.message,
    });
  }
};

export const cancelPurchaseOrderHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const cancelledPO = await inventoryService.cancelPurchaseOrder(id!, reason);

    logger.info(`Purchase order ${id} cancelled successfully`);
    res.status(200).json({
      success: true,
      message: "Purchase order cancelled successfully",
      data: cancelledPO,
    });
  } catch (error: any) {
    logger.logApiError("Error cancelling purchase order", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to cancel purchase order",
      error: error.message,
    });
  }
};

export const closePurchaseOrderHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const closedPO = await inventoryService.closePurchaseOrder(id!, userId);

    logger.info(`Purchase order ${id} closed successfully`);
    res.status(200).json({
      success: true,
      message: "Purchase order closed successfully",
      data: closedPO,
    });
  } catch (error: any) {
    logger.logApiError("Error closing purchase order", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to close purchase order",
      error: error.message,
    });
  }
};

export const receivePartialPurchaseOrderHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const result = await inventoryService.receivePartialPurchaseOrder(
      id!,
      req.body,
      userId
    );

    logger.info(`Purchase order ${id} partially received successfully`);
    res.status(200).json({
      success: true,
      message: "Items received successfully",
      data: result,
    });
  } catch (error: any) {
    logger.logApiError("Error receiving purchase order items", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to receive items",
      error: error.message,
    });
  }
};

export const receivePurchaseOrderHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const result = await inventoryService.receivePurchaseOrder(
      id!,
      req.body,
      userId
    );

    logger.info(`Purchase order ${id} received successfully`);
    res.status(200).json({
      success: true,
      message: "Items received successfully",
      data: result,
    });
  } catch (error: any) {
    logger.logApiError("Error receiving purchase order", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to receive items",
      error: error.message,
    });
  }
};

// ============================
// PO Line Item Handlers
// ============================

export const addPurchaseOrderItemHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // PO ID

    const newItem = await inventoryService.addPurchaseOrderItem(id!, req.body);

    logger.info(`Item added to purchase order ${id} successfully`);
    res.status(201).json({
      success: true,
      message: "Item added to purchase order successfully",
      data: newItem,
    });
  } catch (error: any) {
    logger.logApiError("Error adding item to purchase order", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to add item to purchase order",
      error: error.message,
    });
  }
};

export const updatePurchaseOrderItemHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // PO Item ID

    const updatedItem = await inventoryService.updatePurchaseOrderItem(id!, req.body);

    logger.info(`Purchase order item ${id} updated successfully`);
    res.status(200).json({
      success: true,
      message: "Purchase order item updated successfully",
      data: updatedItem,
    });
  } catch (error: any) {
    logger.logApiError("Error updating purchase order item", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to update purchase order item",
      error: error.message,
    });
  }
};

export const deletePurchaseOrderItemHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // PO Item ID

    const deletedItem = await inventoryService.deletePurchaseOrderItem(id!);

    logger.info(`Purchase order item ${id} deleted successfully`);
    res.status(200).json({
      success: true,
      message: "Purchase order item deleted successfully",
      data: deletedItem,
    });
  } catch (error: any) {
    logger.logApiError("Error deleting purchase order item", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to delete purchase order item",
      error: error.message,
    });
  }
};

export const getPurchaseOrderItemsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    const items = await inventoryService.getPurchaseOrderItems(id!);

    logger.info(
      `Purchase order items for purchase order ${id} fetched successfully`
    );
    res.status(200).json({
      success: true,
      message: "Purchase order items retrieved successfully",
      data: items.data,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching purchase order items", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve purchase order items",
      error: error.message,
    });
  }
};

// ============================
// Supplier Controllers
// ============================

export const getSuppliersHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const offset = (page - 1) * limit;

    const filters: { search?: string; isActive?: boolean } = {};

    if (req.query.search) {
      filters.search = req.query.search as string;
    }

    if (req.query.isActive === "true") {
      filters.isActive = true;
    } else if (req.query.isActive === "false") {
      filters.isActive = false;
    }

    const result = await inventoryService.getSuppliers(offset, limit, filters);

    logger.info("Suppliers fetched successfully");
    res.status(200).json({
      success: true,
      message: "Suppliers retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching suppliers", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve suppliers",
      error: error.message,
    });
  }
};

export const getSupplierByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const supplier = await inventoryService.getSupplierById(id!);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    logger.info(`Supplier ${id} fetched successfully`);
    res.status(200).json({
      success: true,
      message: "Supplier retrieved successfully",
      data: supplier,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching supplier by ID", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve supplier",
      error: error.message,
    });
  }
};

export const createSupplierHandler = async (req: Request, res: Response) => {
  try {
    const newSupplier = await inventoryService.createSupplier(req.body);

    logger.info(`Supplier ${newSupplier.id} created successfully`);
    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: newSupplier,
    });
  } catch (error: any) {
    logger.logApiError("Error creating supplier", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to create supplier",
      error: error.message,
    });
  }
};

export const updateSupplierHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const updatedSupplier = await inventoryService.updateSupplier(
      id!,
      req.body
    );

    logger.info(`Supplier ${id} updated successfully`);
    res.status(200).json({
      success: true,
      message: "Supplier updated successfully",
      data: updatedSupplier,
    });
  } catch (error: any) {
    logger.logApiError("Error updating supplier", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to update supplier",
      error: error.message,
    });
  }
};

export const deleteSupplierHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deletedSupplier = await inventoryService.deleteSupplier(id!);

    logger.info(`Supplier ${id} deleted successfully`);
    res.status(200).json({
      success: true,
      message: "Supplier deleted successfully",
      data: deletedSupplier,
    });
  } catch (error: any) {
    logger.logApiError("Error deleting supplier", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to delete supplier",
      error: error.message,
    });
  }
};

// ============================
// Location Controllers
// ============================

export const getLocationsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const offset = (page - 1) * limit;

    const filters = {
      search: req.query.search as string,
      locationType: req.query.locationType as string,
    };

    const result = await inventoryService.getLocations(offset, limit, filters);

    logger.info("Inventory locations fetched successfully");
    res.status(200).json({
      success: true,
      message: "Locations retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching inventory locations", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve locations",
      error: error.message,
    });
  }
};

export const getLocationByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const location = await inventoryService.getLocationById(id!);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Location not found",
      });
    }

    logger.info(`Inventory location ${id} fetched successfully`);
    res.status(200).json({
      success: true,
      message: "Location retrieved successfully",
      data: location,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching inventory location by ID", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve location",
      error: error.message,
    });
  }
};

export const createLocationHandler = async (req: Request, res: Response) => {
  try {
    const newLocation = await inventoryService.createLocation(req.body);

    logger.info(`Inventory location ${newLocation.id} created successfully`);
    res.status(201).json({
      success: true,
      message: "Location created successfully",
      data: newLocation,
    });
  } catch (error: any) {
    logger.logApiError("Error creating inventory location", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to create location",
      error: error.message,
    });
  }
};

export const updateLocationHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const updatedLocation = await inventoryService.updateLocation(
      id!,
      req.body
    );

    logger.info(`Inventory location ${id} updated successfully`);
    res.status(200).json({
      success: true,
      message: "Location updated successfully",
      data: updatedLocation,
    });
  } catch (error: any) {
    logger.logApiError("Error updating inventory location", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to update location",
      error: error.message,
    });
  }
};

export const deleteLocationHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deletedLocation = await inventoryService.deleteLocation(id!);

    logger.info(`Inventory location ${id} deleted successfully`);
    res.status(200).json({
      success: true,
      message: "Location deleted successfully",
      data: deletedLocation,
    });
  } catch (error: any) {
    logger.logApiError("Error deleting inventory location", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to delete location",
      error: error.message,
    });
  }
};

// ============================
// Category Controllers
// ============================

export const getCategoriesHandler = async (req: Request, res: Response) => {
  try {
    const categories = await inventoryService.getCategories();

    logger.info("Inventory categories fetched successfully");
    res.status(200).json({
      success: true,
      message: "Categories retrieved successfully",
      data: categories,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching inventory categories", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve categories",
      error: error.message,
    });
  }
};

export const createCategoryHandler = async (req: Request, res: Response) => {
  try {
    const newCategory = await inventoryService.createCategory(req.body);

    logger.info(`Inventory category ${newCategory.id} created successfully`);
    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: newCategory,
    });
  } catch (error: any) {
    logger.logApiError("Error creating inventory category", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: error.message,
    });
  }
};

export const updateCategoryHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const updatedCategory = await inventoryService.updateCategory(
      parseInt(id!),
      req.body
    );

    logger.info(`Inventory category ${id} updated successfully`);
    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error: any) {
    logger.logApiError("Error updating inventory category", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message,
    });
  }
};

export const deleteCategoryHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deletedCategory = await inventoryService.deleteCategory(
      parseInt(id!)
    );

    logger.info(`Inventory category ${id} deleted successfully`);
    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
      data: deletedCategory,
    });
  } catch (error: any) {
    logger.logApiError("Error deleting inventory category", error, req);
    if (error.message === "Category not found") {
      res.status(404).json({
        success: false,
        message: "Category not found",
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to delete category",
        error: error.message,
      });
    }
  }
};

// ============================
// Units of Measure Controllers
// ============================

export const getUnitsHandler = async (req: Request, res: Response) => {
  try {
    const units = await inventoryService.getUnits();

    logger.info("Inventory units fetched successfully");
    res.status(200).json({
      success: true,
      message: "Units retrieved successfully",
      data: units,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching inventory units", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve units",
      error: error.message,
    });
  }
};

export const createUnitHandler = async (req: Request, res: Response) => {
  try {
    const newUnit = await inventoryService.createUnit(req.body);

    logger.info(
      `Inventory unit ${newUnit?.id || "unknown"} created successfully`
    );
    res.status(201).json({
      success: true,
      message: "Unit created successfully",
      data: newUnit,
    });
  } catch (error: any) {
    logger.logApiError("Error creating inventory unit", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to create unit",
      error: error.message,
    });
  }
};

export const updateUnitHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const updatedUnit = await inventoryService.updateUnit(
      parseInt(id!),
      req.body
    );

    logger.info(`Inventory unit ${id} updated successfully`);
    res.status(200).json({
      success: true,
      message: "Unit updated successfully",
      data: updatedUnit,
    });
  } catch (error: any) {
    logger.logApiError("Error updating inventory unit", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to update unit",
      error: error.message,
    });
  }
};

export const deleteUnitHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deletedUnit = await inventoryService.deleteUnit(parseInt(id!));

    logger.info(`Inventory unit ${id} deleted successfully`);
    res.status(200).json({
      success: true,
      message: "Unit deleted successfully",
      data: deletedUnit,
    });
  } catch (error: any) {
    logger.logApiError("Error deleting inventory unit", error, req);
    if (error.message === "Unit not found") {
      res.status(404).json({
        success: false,
        message: "Unit not found",
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to delete unit",
        error: error.message,
      });
    }
  }
};

// ============================
// Stock Alert Controllers
// ============================

export const getAlertsHandler = async (req: Request, res: Response) => {
  try {
    const alerts = await inventoryService.getAlerts();

    logger.info("Inventory alerts fetched successfully");
    res.status(200).json({
      success: true,
      message: "Alerts retrieved successfully",
      data: alerts,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching inventory alerts", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve alerts",
      error: error.message,
    });
  }
};

export const getUnresolvedAlertsHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const alerts = await inventoryService.getUnresolvedAlerts();

    logger.info("Unresolved inventory alerts fetched successfully");
    res.status(200).json({
      success: true,
      message: "Unresolved alerts retrieved successfully",
      data: alerts,
    });
  } catch (error: any) {
    logger.logApiError(
      "Error fetching unresolved inventory alerts",
      error,
      req
    );
    res.status(500).json({
      success: false,
      message: "Failed to retrieve unresolved alerts",
      error: error.message,
    });
  }
};

export const acknowledgeAlertHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const acknowledgedAlert = await inventoryService.acknowledgeAlert(
      id!,
      userId
    );

    logger.info(`Inventory alert ${id} acknowledged successfully`);
    res.status(200).json({
      success: true,
      message: "Alert acknowledged successfully",
      data: acknowledgedAlert,
    });
  } catch (error: any) {
    logger.logApiError("Error acknowledging inventory alert", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to acknowledge alert",
      error: error.message,
    });
  }
};

export const resolveAlertHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const resolvedAlert = await inventoryService.resolveAlert(
      id!,
      req.body.resolutionNotes,
      userId
    );

    logger.info(`Inventory alert ${id} resolved successfully`);
    res.status(200).json({
      success: true,
      message: "Alert resolved successfully",
      data: resolvedAlert,
    });
  } catch (error: any) {
    logger.logApiError("Error resolving inventory alert", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to resolve alert",
      error: error.message,
    });
  }
};

export const triggerAlertCheckHandler = async (req: Request, res: Response) => {
  try {
    const result = await inventoryService.triggerAlertCheck();

    logger.info("Inventory alert check triggered successfully");
    res.status(200).json({
      success: true,
      message: "Alert check completed successfully",
      data: result,
    });
  } catch (error: any) {
    logger.logApiError("Error triggering inventory alert check", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to trigger alert check",
      error: error.message,
    });
  }
};

// ============================
// Physical Count Controllers
// ============================

export const getCountsHandler = async (req: Request, res: Response) => {
  try {
    const counts = await inventoryService.getCounts();

    logger.info("Inventory counts fetched successfully");
    res.status(200).json({
      success: true,
      message: "Counts retrieved successfully",
      data: counts,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching inventory counts", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve counts",
      error: error.message,
    });
  }
};

export const getCountByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const count = await inventoryService.getCountById(id!);

    if (!count) {
      return res.status(404).json({
        success: false,
        message: "Count not found",
      });
    }

    logger.info(`Inventory count ${id} fetched successfully`);
    res.status(200).json({
      success: true,
      message: "Count retrieved successfully",
      data: count,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching inventory count by ID", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve count",
      error: error.message,
    });
  }
};

export const createCountHandler = async (req: Request, res: Response) => {
  try {
    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const newCount = await inventoryService.createCount(req.body, userId);

    logger.info(`Inventory count ${newCount.id} created successfully`);
    res.status(201).json({
      success: true,
      message: "Count created successfully",
      data: newCount,
    });
  } catch (error: any) {
    logger.logApiError("Error creating inventory count", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to create count",
      error: error.message,
    });
  }
};

export const startCountHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const startedCount = await inventoryService.startCount(id!);

    logger.info(`Inventory count ${id} started successfully`);
    res.status(200).json({
      success: true,
      message: "Count started successfully",
      data: startedCount,
    });
  } catch (error: any) {
    logger.logApiError("Error starting inventory count", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to start count",
      error: error.message,
    });
  }
};

export const completeCountHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const completedCount = await inventoryService.completeCount(id!, userId);

    logger.info(`Inventory count ${id} completed successfully`);
    res.status(200).json({
      success: true,
      message: "Count completed successfully",
      data: completedCount,
    });
  } catch (error: any) {
    logger.logApiError("Error completing inventory count", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to complete count",
      error: error.message,
    });
  }
};

export const getCountItemsHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const items = await inventoryService.getCountItems(id!);

    logger.info(`Count items for count ${id} fetched successfully`);
    res.status(200).json({
      success: true,
      message: "Count items retrieved successfully",
      data: items.data,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching count items", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve count items",
      error: error.message,
    });
  }
};

export const recordCountItemHandler = async (req: Request, res: Response) => {
  try {
    const { countId, itemId } = req.params;
    const { countedQuantity, notes } = req.body;

    const recordedItem = await inventoryService.recordCountItem(
      countId!,
      itemId!,
      { actualQuantity: countedQuantity, notes }
    );

    logger.info(
      `Count item ${itemId} recorded successfully for count ${countId}`
    );
    res.status(200).json({
      success: true,
      message: "Count item recorded successfully",
      data: recordedItem,
    });
  } catch (error: any) {
    logger.logApiError("Error recording count item", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to record count item",
      error: error.message,
    });
  }
};

