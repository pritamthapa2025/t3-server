import { Router } from "express";
import * as invoiceController from "../../controllers/InvoiceController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getInvoicesSchema,
  getInvoiceByIdSchema,
  createInvoiceSchema,
  updateInvoiceByIdSchema,
  sendInvoiceByIdSchema,
  markInvoicePaidByIdSchema,
  voidInvoiceByIdSchema,
  deleteInvoiceByIdSchema,
  createInvoiceLineItemForInvoiceSchema,
  updateInvoiceLineItemByIdSchema,
  getInvoiceKPIsSchema,
  getInvoiceLineItemsSchema,
  getInvoiceLineItemByIdSchema,
  deleteInvoiceLineItemByIdSchema,
  downloadInvoicePDFSchema,
  previewInvoicePDFSchema,
} from "../../validations/invoicing.validations.js";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// ==================== INVOICE ROUTES ====================

// Get invoices (list) with pagination and filters, Create new invoice
router
  .route("/invoices")
  .get(validate(getInvoicesSchema), invoiceController.getInvoices)
  .post(validate(createInvoiceSchema), invoiceController.createInvoice);

// Get invoice KPIs
router.get(
  "/invoices/kpis",
  validate(getInvoiceKPIsSchema),
  invoiceController.getInvoiceKPIs,
);

// Get invoice by ID, Update invoice, Delete invoice (soft delete)
router
  .route("/invoices/:id")
  .get(validate(getInvoiceByIdSchema), invoiceController.getInvoiceById)
  .put(validate(updateInvoiceByIdSchema), invoiceController.updateInvoice)
  .delete(validate(deleteInvoiceByIdSchema), invoiceController.deleteInvoice);

// Send invoice via email
router.post(
  "/invoices/:id/send",
  validate(sendInvoiceByIdSchema),
  invoiceController.sendInvoiceEmail,
);

// Mark invoice as paid
router.post(
  "/invoices/:id/mark-paid",
  validate(markInvoicePaidByIdSchema),
  invoiceController.markInvoiceAsPaid,
);

// Void invoice
router.post(
  "/invoices/:id/void",
  validate(voidInvoiceByIdSchema),
  invoiceController.voidInvoice,
);

// ==================== INVOICE LINE ITEMS ROUTES ====================

// Get invoice line items, Create invoice line item
router
  .route("/invoices/:invoiceId/line-items")
  .get(
    validate(getInvoiceLineItemsSchema),
    invoiceController.getInvoiceLineItems,
  )
  .post(
    validate(createInvoiceLineItemForInvoiceSchema),
    invoiceController.createInvoiceLineItem,
  );

// Get single invoice line item, Update invoice line item, Delete invoice line item
router
  .route("/invoices/:invoiceId/line-items/:lineItemId")
  .get(
    validate(getInvoiceLineItemByIdSchema),
    invoiceController.getInvoiceLineItem,
  )
  .put(
    validate(updateInvoiceLineItemByIdSchema),
    invoiceController.updateInvoiceLineItem,
  )
  .delete(
    validate(deleteInvoiceLineItemByIdSchema),
    invoiceController.deleteInvoiceLineItem,
  );

// ==================== INVOICE PDF ROUTES ====================

// Download invoice as PDF
router.get(
  "/invoices/:id/pdf",
  validate(downloadInvoicePDFSchema),
  invoiceController.downloadInvoicePDF,
);

// Preview invoice PDF (inline display)
router.get(
  "/invoices/:id/pdf/preview",
  validate(previewInvoicePDFSchema),
  invoiceController.previewInvoicePDF,
);

export default router;
