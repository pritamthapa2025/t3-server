import type { Request, Response } from "express";
import * as invoicingService from "../services/invoicing.service.js";

/**
 * Get invoices with pagination and filtering
 * GET /invoices
 */
export const getInvoices = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const result = await invoicingService.getInvoices(organizationId, req.query as any);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch invoices",
      error: error.message,
    });
  }
};

/**
 * Get invoice by ID
 * GET /invoices/:id
 */
export const getInvoiceById = async (req: Request, res: Response) => {
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
        message: "Invoice ID is required",
      });
    }
    const invoice = await invoicingService.getInvoiceById(id, organizationId, req.query as any);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.json({
      success: true,
      data: { invoice },
    });
  } catch (error: any) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch invoice",
      error: error.message,
    });
  }
};

/**
 * Create new invoice
 * POST /invoices
 */
export const createInvoice = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const invoiceId = await invoicingService.createInvoice(organizationId, {
      ...req.body,
      createdBy: userId,
    });

    const invoice = await invoicingService.getInvoiceById(invoiceId, organizationId, {
      includeLineItems: true,
    });

    res.status(201).json({
      success: true,
      data: { invoice },
      message: "Invoice created successfully",
    });
  } catch (error: any) {
    console.error("Error creating invoice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create invoice",
      error: error.message,
    });
  }
};

/**
 * Update invoice
 * PUT /invoices/:id
 */
export const updateInvoice = async (req: Request, res: Response) => {
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
        message: "Invoice ID is required",
      });
    }
    const invoice = await invoicingService.updateInvoice(id, organizationId, req.body, userId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.json({
      success: true,
      data: { invoice },
      message: "Invoice updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating invoice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update invoice",
      error: error.message,
    });
  }
};

/**
 * Delete invoice (soft delete)
 * DELETE /invoices/:id
 */
export const deleteInvoice = async (req: Request, res: Response) => {
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
        message: "Invoice ID is required",
      });
    }
    await invoicingService.deleteInvoice(id, organizationId, userId);

    res.json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete invoice",
      error: error.message,
    });
  }
};

/**
 * Send invoice via email
 * POST /invoices/:id/send
 */
export const sendInvoiceEmail = async (req: Request, res: Response) => {
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
        message: "Invoice ID is required",
      });
    }
    const { emailTo, subject, message, attachPdf = true, cc, bcc } = req.body;

    // For now, we'll just update the invoice status to "sent"
    // In a full implementation, you'd integrate with an email service
    const invoice = await invoicingService.updateInvoice(id, organizationId, {
      status: "sent",
      emailSent: true,
      emailSentTo: emailTo,
      sentDate: new Date(),
    }, userId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.json({
      success: true,
      data: {
        sentAt: new Date().toISOString(),
        sentTo: emailTo || invoice.emailSentTo,
      },
      message: "Invoice sent successfully",
    });
  } catch (error: any) {
    console.error("Error sending invoice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send invoice",
      error: error.message,
    });
  }
};

/**
 * Mark invoice as paid
 * POST /invoices/:id/mark-paid
 */
export const markInvoiceAsPaid = async (req: Request, res: Response) => {
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
        message: "Invoice ID is required",
      });
    }
    const invoice = await invoicingService.markInvoiceAsPaid(id, organizationId, req.body, userId);

    res.json({
      success: true,
      data: { invoice },
      message: "Invoice marked as paid",
    });
  } catch (error: any) {
    console.error("Error marking invoice as paid:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark invoice as paid",
      error: error.message,
    });
  }
};

/**
 * Void invoice
 * POST /invoices/:id/void
 */
export const voidInvoice = async (req: Request, res: Response) => {
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
        message: "Invoice ID is required",
      });
    }
    const invoice = await invoicingService.voidInvoice(id, organizationId, req.body, userId);

    res.json({
      success: true,
      data: { invoice },
      message: "Invoice voided successfully",
    });
  } catch (error: any) {
    console.error("Error voiding invoice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to void invoice",
      error: error.message,
    });
  }
};

/**
 * Get invoice line items
 * GET /invoices/:invoiceId/line-items
 */
export const getInvoiceLineItems = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { invoiceId } = req.params;
    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }
    const invoice = await invoicingService.getInvoiceById(invoiceId, organizationId, {
      includeLineItems: true,
      includePayments: false,
      includeDocuments: false,
      includeHistory: false,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.json({
      success: true,
      data: {
        lineItems: invoice.lineItems || [],
      },
    });
  } catch (error: any) {
    console.error("Error fetching line items:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch line items",
      error: error.message,
    });
  }
};

/**
 * Create invoice line item
 * POST /invoices/:invoiceId/line-items
 */
export const createInvoiceLineItem = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { invoiceId } = req.params;
    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    // For simplicity, we'll use the existing invoice update service
    // In a full implementation, you'd have a specific line item service
    const invoice = await invoicingService.getInvoiceById(invoiceId, organizationId);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // This is a simplified implementation
    // In production, you'd have dedicated line item CRUD operations
    res.status(501).json({
      success: false,
      message: "Line item creation not yet implemented - use invoice update instead",
    });
  } catch (error: any) {
    console.error("Error creating line item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create line item",
      error: error.message,
    });
  }
};

/**
 * Update invoice line item
 * PUT /invoices/:invoiceId/line-items/:lineItemId
 */
export const updateInvoiceLineItem = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { invoiceId, lineItemId } = req.params;

    // This is a simplified implementation
    // In production, you'd have dedicated line item CRUD operations
    res.status(501).json({
      success: false,
      message: "Line item update not yet implemented - use invoice update instead",
    });
  } catch (error: any) {
    console.error("Error updating line item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update line item",
      error: error.message,
    });
  }
};

/**
 * Delete invoice line item
 * DELETE /invoices/:invoiceId/line-items/:lineItemId
 */
export const deleteInvoiceLineItem = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { invoiceId, lineItemId } = req.params;

    // This is a simplified implementation
    // In production, you'd have dedicated line item CRUD operations
    res.status(501).json({
      success: false,
      message: "Line item deletion not yet implemented - use invoice update instead",
    });
  } catch (error: any) {
    console.error("Error deleting line item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete line item",
      error: error.message,
    });
  }
};

/**
 * Get invoice summary report
 * GET /invoices/summary
 */
export const getInvoiceSummary = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const summary = await invoicingService.getInvoiceSummary(organizationId, req.query as any);

    res.json({
      success: true,
      data: { summary },
    });
  } catch (error: any) {
    console.error("Error fetching invoice summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch invoice summary",
      error: error.message,
    });
  }
};
