import type { Request, Response } from "express";
import * as invoicingService from "../services/invoicing.service.js";

/**
 * Get payments with pagination and filtering
 * GET /payments
 */
export const getPayments = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const result = await invoicingService.getPayments(organizationId, req.query as any);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error fetching payments:", error);
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
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }
    const payment = await invoicingService.getPaymentById(id, organizationId, req.query as any);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.json({
      success: true,
      data: { payment },
    });
  } catch (error: any) {
    console.error("Error fetching payment:", error);
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
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const paymentId = await invoicingService.createPayment(organizationId, req.body, userId);

    const payment = await invoicingService.getPaymentById(paymentId, organizationId, {
      includeAllocations: true,
    });

    // Get updated invoice to return in response
    const invoice = await invoicingService.getInvoiceById(req.body.invoiceId, organizationId);

    res.status(201).json({
      success: true,
      data: {
        payment,
        invoice: invoice ? {
          amountPaid: invoice.amountPaid,
          balanceDue: invoice.balanceDue,
          status: invoice.status,
        } : null,
      },
      message: "Payment recorded successfully",
    });
  } catch (error: any) {
    console.error("Error creating payment:", error);
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
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }
    const payment = await invoicingService.updatePayment(id, organizationId, req.body, userId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.json({
      success: true,
      data: { payment },
      message: "Payment updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating payment:", error);
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
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }
    await invoicingService.deletePayment(id, organizationId, userId);

    res.json({
      success: true,
      message: "Payment deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting payment:", error);
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
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }
    const { processedDate = new Date().toISOString(), notes } = req.body;

    const payment = await invoicingService.updatePayment(id, organizationId, {
      status: "processing",
      processedDate,
    }, userId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.json({
      success: true,
      data: { payment },
      message: "Payment processed successfully",
    });
  } catch (error: any) {
    console.error("Error processing payment:", error);
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
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }
    const { clearedDate = new Date().toISOString(), notes } = req.body;

    const payment = await invoicingService.updatePayment(id, organizationId, {
      status: "completed",
      clearedDate,
    }, userId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.json({
      success: true,
      data: { payment },
      message: "Payment marked as cleared",
    });
  } catch (error: any) {
    console.error("Error marking payment as cleared:", error);
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
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { paymentId } = req.params;
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }
    const payment = await invoicingService.getPaymentById(paymentId, organizationId, {
      includeAllocations: true,
      includeDocuments: false,
      includeHistory: false,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.json({
      success: true,
      data: {
        allocations: payment.allocations || [],
      },
    });
  } catch (error: any) {
    console.error("Error fetching payment allocations:", error);
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
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { paymentId } = req.params;

    // This is a simplified implementation
    // In production, you'd have dedicated allocation CRUD operations
    res.status(501).json({
      success: false,
      message: "Payment allocation creation not yet fully implemented",
    });
  } catch (error: any) {
    console.error("Error creating payment allocation:", error);
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
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { paymentId, allocationId } = req.params;

    // This is a simplified implementation
    // In production, you'd have dedicated allocation CRUD operations
    res.status(501).json({
      success: false,
      message: "Payment allocation update not yet fully implemented",
    });
  } catch (error: any) {
    console.error("Error updating payment allocation:", error);
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
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { paymentId, allocationId } = req.params;

    // This is a simplified implementation
    // In production, you'd have dedicated allocation CRUD operations
    res.status(501).json({
      success: false,
      message: "Payment allocation deletion not yet fully implemented",
    });
  } catch (error: any) {
    console.error("Error deleting payment allocation:", error);
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
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const summary = await invoicingService.getPaymentSummary(organizationId, req.query as any);

    res.json({
      success: true,
      data: { summary },
    });
  } catch (error: any) {
    console.error("Error fetching payment summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment summary",
      error: error.message,
    });
  }
};
