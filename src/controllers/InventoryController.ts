import type { Request, Response } from "express";
import { logger } from "../utils/logger.js";
import * as inventoryService from "../services/inventory/index.js";

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

const validateOrganizationAccess = (req: Request, res: Response): string | null => {
  // For now, using user ID as organization context
  // In multi-tenant setup, you'd get organizationId from req.user.organizationId
  const userId = req.user?.id;

  if (!userId) {
    res.status(403).json({
      success: false,
      message: "Access denied. Organization context required.",
    });
    return null;
  }

  // TODO: Get actual organizationId from user context
  // For now, return userId as placeholder
  return userId;
};

const validateParam = (param: string | undefined, paramName: string, res: Response): string | null => {
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

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
      organizationId,
      offset,
      limit,
      filters
    );

    res.status(200).json({
      success: true,
      message: "Inventory items retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.error("Get inventory items error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve inventory items",
      error: error.message,
    });
  }
};

export const getInventoryItemByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validId = validateParam(id, "Item ID", res);
    if (!validId) return;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const item = await inventoryService.getInventoryItemById(validId, organizationId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Inventory item retrieved successfully",
      data: item,
    });
  } catch (error: any) {
    logger.error("Get inventory item by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve inventory item",
      error: error.message,
    });
  }
};

export const createInventoryItemHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const newItem = await inventoryService.createInventoryItem(
      req.body,
      organizationId,
      userId
    );

    res.status(201).json({
      success: true,
      message: "Inventory item created successfully",
      data: newItem,
    });
  } catch (error: any) {
    logger.error("Create inventory item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create inventory item",
      error: error.message,
    });
  }
};

export const updateInventoryItemHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validId = validateParam(id, "Item ID", res);
    if (!validId) return;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const updatedItem = await inventoryService.updateInventoryItem(
      validId,
      req.body,
      organizationId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Inventory item updated successfully",
      data: updatedItem,
    });
  } catch (error: any) {
    logger.error("Update inventory item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update inventory item",
      error: error.message,
    });
  }
};

export const deleteInventoryItemHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const deletedItem = await inventoryService.deleteInventoryItem(
      id!,
      organizationId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Inventory item deleted successfully",
      data: deletedItem,
    });
  } catch (error: any) {
    logger.error("Delete inventory item error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const history = await inventoryService.getItemHistory(id!, organizationId);

    res.status(200).json({
      success: true,
      message: "Item history retrieved successfully",
      data: history,
    });
  } catch (error: any) {
    logger.error("Get item history error:", error);
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
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const summary = await inventoryService.getDashboardSummary(organizationId);

    res.status(200).json({
      success: true,
      message: "Dashboard summary retrieved successfully",
      data: summary,
    });
  } catch (error: any) {
    logger.error("Get dashboard summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve dashboard summary",
      error: error.message,
    });
  }
};

export const getStatsByCategoryHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const stats = await inventoryService.getStatsByCategory(organizationId);

    res.status(200).json({
      success: true,
      message: "Category statistics retrieved successfully",
      data: stats,
    });
  } catch (error: any) {
    logger.error("Get stats by category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve category statistics",
      error: error.message,
    });
  }
};

export const getStatsByLocationHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const stats = await inventoryService.getStatsByLocation(organizationId);

    res.status(200).json({
      success: true,
      message: "Location statistics retrieved successfully",
      data: stats,
    });
  } catch (error: any) {
    logger.error("Get stats by location error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve location statistics",
      error: error.message,
    });
  }
};

export const getStatsByStatusHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const stats = await inventoryService.getStatsByStatus(organizationId);

    res.status(200).json({
      success: true,
      message: "Status statistics retrieved successfully",
      data: stats,
    });
  } catch (error: any) {
    logger.error("Get stats by status error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

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
      organizationId,
      offset,
      limit,
      filters
    );

    res.status(200).json({
      success: true,
      message: "Transactions retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.error("Get transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve transactions",
      error: error.message,
    });
  }
};

export const createTransactionHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const newTransaction = await inventoryService.createTransaction(
      req.body,
      organizationId,
      userId
    );

    res.status(201).json({
      success: true,
      message: "Transaction created successfully",
      data: newTransaction,
    });
  } catch (error: any) {
    logger.error("Create transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create transaction",
      error: error.message,
    });
  }
};

export const getItemTransactionsHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const transactions = await inventoryService.getItemTransactions(id!, organizationId);

    res.status(200).json({
      success: true,
      message: "Item transactions retrieved successfully",
      data: transactions,
    });
  } catch (error: any) {
    logger.error("Get item transactions error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const offset = (page - 1) * limit;

    const filters = {
      itemId: req.query.itemId as string,
      jobId: req.query.jobId as string,
      bidId: req.query.bidId as string,
      status: req.query.status as string,
    };

    const result = await inventoryService.getAllocations(
      organizationId,
      offset,
      limit,
      filters
    );

    res.status(200).json({
      success: true,
      message: "Allocations retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.error("Get allocations error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const allocation = await inventoryService.getAllocationById(id!, organizationId);

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: "Allocation not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Allocation retrieved successfully",
      data: allocation,
    });
  } catch (error: any) {
    logger.error("Get allocation by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve allocation",
      error: error.message,
    });
  }
};

export const createAllocationHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const newAllocation = await inventoryService.createAllocation(
      req.body,
      organizationId,
      userId
    );

    res.status(201).json({
      success: true,
      message: "Allocation created successfully",
      data: newAllocation,
    });
  } catch (error: any) {
    logger.error("Create allocation error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const updatedAllocation = await inventoryService.updateAllocation(
      id!,
      req.body,
      organizationId
    );

    res.status(200).json({
      success: true,
      message: "Allocation updated successfully",
      data: updatedAllocation,
    });
  } catch (error: any) {
    logger.error("Update allocation error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const updatedAllocation = await inventoryService.issueAllocation(
      id!,
      organizationId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Allocation issued successfully",
      data: updatedAllocation,
    });
  } catch (error: any) {
    logger.error("Issue allocation error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const updatedAllocation = await inventoryService.returnAllocation(
      id!,
      req.body,
      organizationId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Allocation returned successfully",
      data: updatedAllocation,
    });
  } catch (error: any) {
    logger.error("Return allocation error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const cancelledAllocation = await inventoryService.cancelAllocation(
      id!,
      organizationId
    );

    res.status(200).json({
      success: true,
      message: "Allocation cancelled successfully",
      data: cancelledAllocation,
    });
  } catch (error: any) {
    logger.error("Cancel allocation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel allocation",
      error: error.message,
    });
  }
};

export const getAllocationsByJobHandler = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const allocations = await inventoryService.getAllocationsByJob(jobId!, organizationId);

    res.status(200).json({
      success: true,
      message: "Job allocations retrieved successfully",
      data: allocations.data,
      total: allocations.total,
    });
  } catch (error: any) {
    logger.error("Get job allocations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve job allocations",
      error: error.message,
    });
  }
};

export const getAllocationsByBidHandler = async (req: Request, res: Response) => {
  try {
    const { bidId } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const allocations = await inventoryService.getAllocationsByBid(bidId!, organizationId);

    res.status(200).json({
      success: true,
      message: "Bid allocations retrieved successfully",
      data: allocations.data,
      total: allocations.total,
    });
  } catch (error: any) {
    logger.error("Get bid allocations error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const offset = (page - 1) * limit;

    const filters = {
      status: req.query.status as string,
      supplierId: req.query.supplierId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    const result = await inventoryService.getPurchaseOrders(
      organizationId,
      offset,
      limit,
      filters
    );

    res.status(200).json({
      success: true,
      message: "Purchase orders retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.error("Get purchase orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve purchase orders",
      error: error.message,
    });
  }
};

export const getPurchaseOrderByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const po = await inventoryService.getPurchaseOrderById(id!, organizationId);

    if (!po) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Purchase order retrieved successfully",
      data: po,
    });
  } catch (error: any) {
    logger.error("Get purchase order by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve purchase order",
      error: error.message,
    });
  }
};

export const createPurchaseOrderHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const newPO = await inventoryService.createPurchaseOrder(
      req.body,
      organizationId,
      userId
    );

    res.status(201).json({
      success: true,
      message: "Purchase order created successfully",
      data: newPO,
    });
  } catch (error: any) {
    logger.error("Create purchase order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create purchase order",
      error: error.message,
    });
  }
};

export const updatePurchaseOrderHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const updatedPO = await inventoryService.updatePurchaseOrder(
      id!,
      req.body,
      organizationId
    );

    res.status(200).json({
      success: true,
      message: "Purchase order updated successfully",
      data: updatedPO,
    });
  } catch (error: any) {
    logger.error("Update purchase order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update purchase order",
      error: error.message,
    });
  }
};

export const approvePurchaseOrderHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const approvedPO = await inventoryService.approvePurchaseOrder(
      id!,
      organizationId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Purchase order approved successfully",
      data: approvedPO,
    });
  } catch (error: any) {
    logger.error("Approve purchase order error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const sentPO = await inventoryService.sendPurchaseOrder(id!, organizationId);

    res.status(200).json({
      success: true,
      message: "Purchase order sent successfully",
      data: sentPO,
    });
  } catch (error: any) {
    logger.error("Send purchase order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send purchase order",
      error: error.message,
    });
  }
};

export const receivePurchaseOrderHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const result = await inventoryService.receivePurchaseOrder(
      id!,
      req.body,
      organizationId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Items received successfully",
      data: result,
    });
  } catch (error: any) {
    logger.error("Receive purchase order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to receive items",
      error: error.message,
    });
  }
};

export const getPurchaseOrderItemsHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const items = await inventoryService.getPurchaseOrderItems(id!, organizationId);

    res.status(200).json({
      success: true,
      message: "Purchase order items retrieved successfully",
      data: items.data,
    });
  } catch (error: any) {
    logger.error("Get purchase order items error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

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

    const result = await inventoryService.getSuppliers(
      organizationId,
      offset,
      limit,
      filters
    );

    res.status(200).json({
      success: true,
      message: "Suppliers retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.error("Get suppliers error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const supplier = await inventoryService.getSupplierById(id!, organizationId);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Supplier retrieved successfully",
      data: supplier,
    });
  } catch (error: any) {
    logger.error("Get supplier by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve supplier",
      error: error.message,
    });
  }
};

export const createSupplierHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const newSupplier = await inventoryService.createSupplier(req.body, organizationId);

    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: newSupplier,
    });
  } catch (error: any) {
    logger.error("Create supplier error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const updatedSupplier = await inventoryService.updateSupplier(
      id!,
      req.body,
      organizationId
    );

    res.status(200).json({
      success: true,
      message: "Supplier updated successfully",
      data: updatedSupplier,
    });
  } catch (error: any) {
    logger.error("Update supplier error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const deletedSupplier = await inventoryService.deleteSupplier(id!, organizationId);

    res.status(200).json({
      success: true,
      message: "Supplier deleted successfully",
      data: deletedSupplier,
    });
  } catch (error: any) {
    logger.error("Delete supplier error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const offset = (page - 1) * limit;

    const filters = {
      locationType: req.query.locationType as string,
      isActive: req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined,
    };

    const result = await inventoryService.getLocations(
      organizationId,
      offset,
      limit,
      filters
    );

    res.status(200).json({
      success: true,
      message: "Locations retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.error("Get locations error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const location = await inventoryService.getLocationById(id!, organizationId);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Location not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Location retrieved successfully",
      data: location,
    });
  } catch (error: any) {
    logger.error("Get location by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve location",
      error: error.message,
    });
  }
};

export const createLocationHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const newLocation = await inventoryService.createLocation(req.body, organizationId);

    res.status(201).json({
      success: true,
      message: "Location created successfully",
      data: newLocation,
    });
  } catch (error: any) {
    logger.error("Create location error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const updatedLocation = await inventoryService.updateLocation(
      id!,
      req.body,
      organizationId
    );

    res.status(200).json({
      success: true,
      message: "Location updated successfully",
      data: updatedLocation,
    });
  } catch (error: any) {
    logger.error("Update location error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const deletedLocation = await inventoryService.deleteLocation(id!, organizationId);

    res.status(200).json({
      success: true,
      message: "Location deleted successfully",
      data: deletedLocation,
    });
  } catch (error: any) {
    logger.error("Delete location error:", error);
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

    res.status(200).json({
      success: true,
      message: "Categories retrieved successfully",
      data: categories,
    });
  } catch (error: any) {
    logger.error("Get categories error:", error);
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

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: newCategory,
    });
  } catch (error: any) {
    logger.error("Create category error:", error);
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

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error: any) {
    logger.error("Update category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message,
    });
  }
};

// ============================
// Units of Measure Controllers
// ============================

export const getUnitsHandler = async (req: Request, res: Response) => {
  try {
    const units = await inventoryService.getUnits();

    res.status(200).json({
      success: true,
      message: "Units retrieved successfully",
      data: units,
    });
  } catch (error: any) {
    logger.error("Get units error:", error);
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

    res.status(201).json({
      success: true,
      message: "Unit created successfully",
      data: newUnit,
    });
  } catch (error: any) {
    logger.error("Create unit error:", error);
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

    const updatedUnit = await inventoryService.updateUnit(parseInt(id!), req.body);

    res.status(200).json({
      success: true,
      message: "Unit updated successfully",
      data: updatedUnit,
    });
  } catch (error: any) {
    logger.error("Update unit error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update unit",
      error: error.message,
    });
  }
};

// ============================
// Stock Alert Controllers
// ============================

export const getAlertsHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const alerts = await inventoryService.getAlerts(organizationId);

    res.status(200).json({
      success: true,
      message: "Alerts retrieved successfully",
      data: alerts,
    });
  } catch (error: any) {
    logger.error("Get alerts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve alerts",
      error: error.message,
    });
  }
};

export const getUnresolvedAlertsHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const alerts = await inventoryService.getUnresolvedAlerts(organizationId);

    res.status(200).json({
      success: true,
      message: "Unresolved alerts retrieved successfully",
      data: alerts,
    });
  } catch (error: any) {
    logger.error("Get unresolved alerts error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const acknowledgedAlert = await inventoryService.acknowledgeAlert(
      id!,
      organizationId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Alert acknowledged successfully",
      data: acknowledgedAlert,
    });
  } catch (error: any) {
    logger.error("Acknowledge alert error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const resolvedAlert = await inventoryService.resolveAlert(
      id!,
      req.body.resolutionNotes,
      organizationId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Alert resolved successfully",
      data: resolvedAlert,
    });
  } catch (error: any) {
    logger.error("Resolve alert error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resolve alert",
      error: error.message,
    });
  }
};

export const triggerAlertCheckHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const result = await inventoryService.triggerAlertCheck(organizationId);

    res.status(200).json({
      success: true,
      message: "Alert check completed successfully",
      data: result,
    });
  } catch (error: any) {
    logger.error("Trigger alert check error:", error);
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
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const counts = await inventoryService.getCounts(organizationId);

    res.status(200).json({
      success: true,
      message: "Counts retrieved successfully",
      data: counts,
    });
  } catch (error: any) {
    logger.error("Get counts error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const count = await inventoryService.getCountById(id!, organizationId);

    if (!count) {
      return res.status(404).json({
        success: false,
        message: "Count not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Count retrieved successfully",
      data: count,
    });
  } catch (error: any) {
    logger.error("Get count by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve count",
      error: error.message,
    });
  }
};

export const createCountHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const newCount = await inventoryService.createCount(
      req.body,
      organizationId,
      userId
    );

    res.status(201).json({
      success: true,
      message: "Count created successfully",
      data: newCount,
    });
  } catch (error: any) {
    logger.error("Create count error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const startedCount = await inventoryService.startCount(id!, organizationId);

    res.status(200).json({
      success: true,
      message: "Count started successfully",
      data: startedCount,
    });
  } catch (error: any) {
    logger.error("Start count error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const userId = validateUserAccess(req, res);
    if (!userId) return;

    const completedCount = await inventoryService.completeCount(
      id!,
      organizationId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Count completed successfully",
      data: completedCount,
    });
  } catch (error: any) {
    logger.error("Complete count error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const items = await inventoryService.getCountItems(id!, organizationId);

    res.status(200).json({
      success: true,
      message: "Count items retrieved successfully",
      data: items.data,
    });
  } catch (error: any) {
    logger.error("Get count items error:", error);
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

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    const recordedItem = await inventoryService.recordCountItem(
      countId!,
      itemId!,
      { actualQuantity: countedQuantity, notes },
      organizationId
    );

    res.status(200).json({
      success: true,
      message: "Count item recorded successfully",
      data: recordedItem,
    });
  } catch (error: any) {
    logger.error("Record count item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record count item",
      error: error.message,
    });
  }
};

