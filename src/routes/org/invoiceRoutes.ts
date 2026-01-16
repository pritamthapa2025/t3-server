import { Router } from "express";
import { z } from "zod";
import * as invoiceController from "../../controllers/InvoiceController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getInvoicesQuerySchema,
  getInvoiceByIdQuerySchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  sendInvoiceEmailSchema,
  markInvoicePaidSchema,
  voidInvoiceSchema,
  createInvoiceLineItemSchema,
  updateInvoiceLineItemSchema,
  getInvoiceSummaryQuerySchema,
} from "../../validations/invoicing.validations.js";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// ==================== INVOICE ROUTES ====================

// Get invoices (list) with pagination and filters
router.get(
  "/",
  validate(z.object({ query: getInvoicesQuerySchema })),
  invoiceController.getInvoices
);

// Get invoice summary report
router.get(
  "/summary",
  validate(z.object({ query: getInvoiceSummaryQuerySchema })),
  invoiceController.getInvoiceSummary
);

// Get invoice by ID
router.get(
  "/:id",
  validate(z.object({ 
    query: getInvoiceByIdQuerySchema,
    params: z.object({ id: z.string().uuid() })
  })),
  invoiceController.getInvoiceById
);

// Create new invoice
router.post(
  "/",
  validate(createInvoiceSchema),
  invoiceController.createInvoice
);

// Update invoice
router.put(
  "/:id",
  validate(z.object({
    ...updateInvoiceSchema.shape,
    params: z.object({ id: z.string().uuid() })
  })),
  invoiceController.updateInvoice
);

// Delete invoice (soft delete)
router.delete(
  "/:id",
  validate(z.object({
    params: z.object({ id: z.string().uuid() })
  })),
  invoiceController.deleteInvoice
);

// Send invoice via email
router.post(
  "/:id/send",
  validate(z.object({
    ...sendInvoiceEmailSchema.shape,
    params: z.object({ id: z.string().uuid() })
  })),
  invoiceController.sendInvoiceEmail
);

// Mark invoice as paid
router.post(
  "/:id/mark-paid",
  validate(z.object({
    ...markInvoicePaidSchema.shape,
    params: z.object({ id: z.string().uuid() })
  })),
  invoiceController.markInvoiceAsPaid
);

// Void invoice
router.post(
  "/:id/void",
  validate(z.object({
    ...voidInvoiceSchema.shape,
    params: z.object({ id: z.string().uuid() })
  })),
  invoiceController.voidInvoice
);

// ==================== INVOICE LINE ITEMS ROUTES ====================

// Get invoice line items
router.get(
  "/:invoiceId/line-items",
  validate(z.object({
    params: z.object({ invoiceId: z.string().uuid() })
  })),
  invoiceController.getInvoiceLineItems
);

// Create invoice line item
router.post(
  "/:invoiceId/line-items",
  validate(z.object({
    ...createInvoiceLineItemSchema.shape,
    params: z.object({ invoiceId: z.string().uuid() })
  })),
  invoiceController.createInvoiceLineItem
);

// Update invoice line item
router.put(
  "/:invoiceId/line-items/:lineItemId",
  validate(z.object({
    ...updateInvoiceLineItemSchema.shape,
    params: z.object({ 
      invoiceId: z.string().uuid(),
      lineItemId: z.string().uuid()
    })
  })),
  invoiceController.updateInvoiceLineItem
);

// Delete invoice line item
router.delete(
  "/:invoiceId/line-items/:lineItemId",
  validate(z.object({
    params: z.object({ 
      invoiceId: z.string().uuid(),
      lineItemId: z.string().uuid()
    })
  })),
  invoiceController.deleteInvoiceLineItem
);

// ==================== INVOICE PDF ROUTES ====================

// Download invoice as PDF
router.get(
  "/:id/pdf",
  validate(z.object({
    params: z.object({ id: z.string().uuid() }),
    query: z.object({
      save: z.string().optional() // "true" to save to storage
    }).optional()
  })),
  invoiceController.downloadInvoicePDF
);

// Preview invoice PDF (inline display)
router.get(
  "/:id/pdf/preview", 
  validate(z.object({
    params: z.object({ id: z.string().uuid() })
  })),
  invoiceController.previewInvoicePDF
);

export default router;











