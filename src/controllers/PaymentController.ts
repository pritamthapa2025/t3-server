import type { Request, Response } from "express";
import * as invoicingService from "../services/invoicing.service.js";
import { logger } from "../utils/logger.js";

/**
 * Get payments with pagination and filtering
 * GET /payments
 */
export const getPayments = async (req: Request, res: Response) => {
  try {
    // organizationId is optional - can be provided in query params for filtering
    const organizationId = req.query.organizationId as string | undefined;

    const result = await invoicingService.getPayments(
      organizationId,
      req.query as any,
    );

    logger.info("Payments fetched successfully");
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching payments", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
      error: error.message,
    });
  }
};

/**
 * Get payment by ID
 * GET /payments/:id
 */
export const getPaymentById = async (req: Request, res: Response) => {
  try {
    // organizationId is optional - can be provided in query params for filtering, or derived from payment
    const organizationId = req.query.organizationId as string | undefined;

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }
    const payment = await invoicingService.getPaymentById(
      id,
      organizationId,
      req.query as any,
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    logger.info(`Payment ${id} fetched successfully`);
    res.json({
      success: true,
      data: { payment },
    });
  } catch (error: any) {
    logger.logApiError("Error fetching payment", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment",
      error: error.message,
    });
  }
};

/**
 * Create new payment
 * POST /payments
 */
export const createPayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const paymentId = await invoicingService.createPayment(req.body, userId);

    // Get payment - organizationId will be derived from payment → invoice → job → bid
    const payment = await invoicingService.getPaymentById(
      paymentId,
      undefined,
      {
        includeAllocations: true,
      },
    );

    // Get updated invoice - organizationId will be derived from invoice
    const invoice = await invoicingService.getInvoiceById(req.body.invoiceId);

    logger.info(`Payment ${paymentId} created successfully`);
    res.status(201).json({
      success: true,
      data: {
        payment,
        invoice: invoice
          ? {
              amountPaid: invoice.amountPaid,
              balanceDue: invoice.balanceDue,
              status: invoice.status,
            }
          : null,
      },
      message: "Payment recorded successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating payment", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to create payment",
      error: error.message,
    });
  }
};

/**
 * Update payment
 * PUT /payments/:id
 */
export const updatePayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    // Get payment first to derive organizationId
    const existingPayment = await invoicingService.getPaymentById(id);
    if (!existingPayment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Get organizationId from payment's invoice → job → bid relationship
    // We need to get it from the invoice
    const invoice = await invoicingService.getInvoiceById(
      existingPayment.invoiceId,
    );
    const organizationId =
      invoice?.organizationId || (req.query.organizationId as string);

    const payment = await invoicingService.updatePayment(
      id,
      organizationId,
      req.body,
      userId,
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    logger.info(`Payment ${id} updated successfully`);
    res.json({
      success: true,
      data: { payment },
      message: "Payment updated successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error updating payment", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to update payment",
      error: error.message,
    });
  }
};

/**
 * Delete payment (soft delete)
 * DELETE /payments/:id
 */
export const deletePayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }
    await invoicingService.deletePayment(id, undefined, userId);

    logger.info(`Payment ${id} deleted successfully`);
    res.json({
      success: true,
      message: "Payment deleted successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error deleting payment", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to delete payment",
      error: error.message,
    });
  }
};

/**
 * Process payment
 * POST /payments/:id/process
 */
export const processPayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    // Get payment first to derive organizationId
    const existingPayment = await invoicingService.getPaymentById(id);
    if (!existingPayment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Get organizationId from payment's invoice
    const invoice = await invoicingService.getInvoiceById(
      existingPayment.invoiceId,
    );
    const organizationId =
      invoice?.organizationId || (req.query.organizationId as string);

    const { processedDate = new Date().toISOString() } = req.body;

    const payment = await invoicingService.updatePayment(
      id,
      organizationId,
      {
        status: "processing",
        processedDate,
      },
      userId,
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    logger.info(`Payment ${id} processed successfully`);
    res.json({
      success: true,
      data: { payment },
      message: "Payment processed successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error processing payment", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to process payment",
      error: error.message,
    });
  }
};

/**
 * Mark payment as cleared
 * POST /payments/:id/clear
 */
export const markPaymentAsCleared = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    // Get payment first to derive organizationId
    const existingPayment = await invoicingService.getPaymentById(id);
    if (!existingPayment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Get organizationId from payment's invoice
    const invoice = await invoicingService.getInvoiceById(
      existingPayment.invoiceId,
    );
    const organizationId =
      invoice?.organizationId || (req.query.organizationId as string);

    const { clearedDate = new Date().toISOString() } = req.body;

    const payment = await invoicingService.updatePayment(
      id,
      organizationId,
      {
        status: "completed",
        clearedDate,
      },
      userId,
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    logger.info(`Payment ${id} marked as cleared`);
    res.json({
      success: true,
      data: { payment },
      message: "Payment marked as cleared",
    });
  } catch (error: any) {
    logger.logApiError("Error marking payment as cleared", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to mark payment as cleared",
      error: error.message,
    });
  }
};

/**
 * Get payment allocations
 * GET /payments/:paymentId/allocations
 */
export const getPaymentAllocations = async (req: Request, res: Response) => {
  try {
    // organizationId is optional - can be provided in query params or derived from payment
    const organizationId = req.query.organizationId as string | undefined;

    const { paymentId } = req.params;
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }
    const payment = await invoicingService.getPaymentById(
      paymentId,
      organizationId,
      {
        includeAllocations: true,
        includeDocuments: false,
        includeHistory: false,
      },
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    logger.info(
      `Payment allocations for payment ${paymentId} fetched successfully`,
    );
    res.json({
      success: true,
      data: {
        allocations: payment.allocations || [],
      },
    });
  } catch (error: any) {
    logger.logApiError("Error fetching payment allocations", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment allocations",
      error: error.message,
    });
  }
};

/**
 * Create payment allocation
 * POST /payments/:paymentId/allocations
 */
export const createPaymentAllocation = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // This is a simplified implementation
    // In production, you'd have dedicated allocation CRUD operations
    res.status(501).json({
      success: false,
      message: "Payment allocation creation not yet fully implemented",
    });
  } catch (error: any) {
    logger.logApiError("Error creating payment allocation", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to create payment allocation",
      error: error.message,
    });
  }
};

/**
 * Update payment allocation
 * PUT /payments/:paymentId/allocations/:allocationId
 */
export const updatePaymentAllocation = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // This is a simplified implementation
    // In production, you'd have dedicated allocation CRUD operations
    res.status(501).json({
      success: false,
      message: "Payment allocation update not yet fully implemented",
    });
  } catch (error: any) {
    logger.logApiError("Error updating payment allocation", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to update payment allocation",
      error: error.message,
    });
  }
};

/**
 * Delete payment allocation
 * DELETE /payments/:paymentId/allocations/:allocationId
 */
export const deletePaymentAllocation = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // This is a simplified implementation
    // In production, you'd have dedicated allocation CRUD operations
    res.status(501).json({
      success: false,
      message: "Payment allocation deletion not yet fully implemented",
    });
  } catch (error: any) {
    logger.logApiError("Error deleting payment allocation", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to delete payment allocation",
      error: error.message,
    });
  }
};

/**
 * Get payment summary report
 * GET /payments/summary
 */
export const getPaymentSummary = async (req: Request, res: Response) => {
  try {
    // organizationId is optional - can be provided in query params for filtering
    const organizationId = req.query.organizationId as string | undefined;

    const summary = await invoicingService.getPaymentSummary(
      organizationId,
      req.query as any,
    );

    logger.info("Payment summary fetched successfully");
    res.json({
      success: true,
      data: { summary },
    });
  } catch (error: any) {
    logger.logApiError("Error fetching payment summary", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment summary",
      error: error.message,
    });
  }
};
