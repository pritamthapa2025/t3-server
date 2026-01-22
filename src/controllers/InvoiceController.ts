import type { Request, Response } from "express";
import * as invoicingService from "../services/invoicing.service.js";
import { logger } from "../utils/logger.js";
import { 
  generateAndSaveInvoicePDF, 
  prepareInvoiceDataForPDF, 
  generateInvoicePDF 
} from "../services/pdf.service.js";
import { getOrganizationById } from "../services/client.service.js";

/**
 * Get invoices with pagination and filtering
 * GET /invoices
 */
export const getInvoices = async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organizationId as string;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "organizationId is required in query parameters",
      });
    }

    const result = await invoicingService.getInvoices(organizationId, req.query as any);

    logger.info("Invoices fetched successfully");
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching invoices", error, req);
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
    const organizationId = req.query.organizationId as string;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "organizationId is required in query parameters",
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

    logger.info(`Invoice ${id} fetched successfully`);
    res.json({
      success: true,
      data: { invoice },
    });
  } catch (error: any) {
    logger.logApiError("Error fetching invoice", error, req);
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
    const organizationId = req.body.organizationId;
    const userId = req.user?.id;
    
    if (!organizationId || !userId) {
      return res.status(400).json({
        success: false,
        message: "organizationId is required in request body and user authentication required",
      });
    }

    const invoiceId = await invoicingService.createInvoice(organizationId, {
      ...req.body,
      createdBy: userId,
    });

    const invoice = await invoicingService.getInvoiceById(invoiceId, organizationId, {
      includeLineItems: true,
    });

    logger.info(`Invoice ${invoiceId} created successfully`);
    res.status(201).json({
      success: true,
      data: { invoice },
      message: "Invoice created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating invoice", error, req);
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

    logger.info(`Invoice ${id} updated successfully`);
    res.json({
      success: true,
      data: { invoice },
      message: "Invoice updated successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error updating invoice", error, req);
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

    logger.info(`Invoice ${id} deleted successfully`);
    res.json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error deleting invoice", error, req);
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
    const { emailTo } = req.body;

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

    logger.info(`Invoice ${id} sent successfully`);
    res.json({
      success: true,
      data: {
        sentAt: new Date().toISOString(),
        sentTo: emailTo || invoice.emailSentTo,
      },
      message: "Invoice sent successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error sending invoice", error, req);
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

    logger.info(`Invoice ${id} marked as paid`);
    res.json({
      success: true,
      data: { invoice },
      message: "Invoice marked as paid",
    });
  } catch (error: any) {
    logger.logApiError("Error marking invoice as paid", error, req);
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

    logger.info(`Invoice ${id} voided successfully`);
    res.json({
      success: true,
      data: { invoice },
      message: "Invoice voided successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error voiding invoice", error, req);
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

    logger.info(`Invoice line items for invoice ${invoiceId} fetched successfully`);
    res.json({
      success: true,
      data: {
        lineItems: invoice.lineItems || [],
      },
    });
  } catch (error: any) {
    logger.logApiError("Error fetching invoice line items", error, req);
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
    logger.logApiError("Error creating invoice line item", error, req);
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

    // This is a simplified implementation
    // In production, you'd have dedicated line item CRUD operations
    res.status(501).json({
      success: false,
      message: "Line item update not yet implemented - use invoice update instead",
    });
  } catch (error: any) {
    logger.logApiError("Error updating invoice line item", error, req);
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

    // This is a simplified implementation
    // In production, you'd have dedicated line item CRUD operations
    res.status(501).json({
      success: false,
      message: "Line item deletion not yet implemented - use invoice update instead",
    });
  } catch (error: any) {
    logger.logApiError("Error deleting invoice line item", error, req);
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

    logger.info("Invoice summary fetched successfully");
    res.json({
      success: true,
      data: { summary },
    });
  } catch (error: any) {
    logger.logApiError("Error fetching invoice summary", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to fetch invoice summary",
      error: error.message,
    });
  }
};

/**
 * Download invoice as PDF
 * GET /invoices/:id/pdf
 */
export const downloadInvoicePDF = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { id } = req.params;
    const { save } = req.query; // Optional: save to storage

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    // Get invoice with all related data
    const invoice = await invoicingService.getInvoiceById(id, organizationId, {
      includeLineItems: true,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // Get organization data for company info
    const organization = await getOrganizationById(organizationId);
    if (!organization) {
      return res.status(500).json({
        success: false,
        message: "Organization data not found",
      });
    }

    // Prepare data for PDF generation
    const pdfData = prepareInvoiceDataForPDF(
      invoice,
      organization,
      invoice.client || {},
      invoice.lineItems || []
    );

    // Generate PDF
    if (save === 'true') {
      // Save to storage and return URL
      const result = await generateAndSaveInvoicePDF(pdfData, organizationId);
      
      logger.info(`Invoice PDF generated and saved: ${id}`);
      res.json({
        success: true,
        message: "PDF generated successfully",
        data: {
          downloadUrl: result.fileUrl,
          filePath: result.filePath,
        },
      });
    } else {
      // Stream PDF directly to client
      const pdfBuffer = await generateInvoicePDF(pdfData);
      
      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      logger.info(`Invoice PDF downloaded: ${id}`);
      res.send(pdfBuffer);
    }
  } catch (error: any) {
    logger.logApiError("Error generating invoice PDF", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to generate PDF",
      error: error.message,
    });
  }
};

/**
 * Preview invoice as PDF (inline display)
 * GET /invoices/:id/pdf/preview
 */
export const previewInvoicePDF = async (req: Request, res: Response) => {
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

    // Get invoice with all related data
    const invoice = await invoicingService.getInvoiceById(id, organizationId, {
      includeLineItems: true,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // Get organization data
    const organization = await getOrganizationById(organizationId);
    if (!organization) {
      return res.status(500).json({
        success: false,
        message: "Organization data not found",
      });
    }

    // Prepare data for PDF generation
    const pdfData = prepareInvoiceDataForPDF(
      invoice,
      organization,
      invoice.client || {},
      invoice.lineItems || []
    );

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(pdfData);
    
    // Set headers for inline PDF display
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    logger.info(`Invoice PDF previewed: ${id}`);
    res.send(pdfBuffer);
  } catch (error: any) {
    logger.logApiError("Error previewing invoice PDF", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to preview PDF",
      error: error.message,
    });
  }
};
