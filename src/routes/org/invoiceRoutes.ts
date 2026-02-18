import { Router, type IRouter } from "express";
import * as invoiceController from "../../controllers/InvoiceController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getInvoicesSchema,
  getInvoiceByIdSchema,
  createInvoiceSchema,
  updateInvoiceByIdSchema,
  sendInvoiceByIdSchema,
  sendInvoiceTestByIdSchema,
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
  createInvoicePaymentSchema,
  updateInvoicePaymentSchema,
  getInvoicePaymentsSchema,
  getInvoicePaymentSchema,
  deleteInvoicePaymentSchema,
} from "../../validations/invoicing.validations.js";
import { bulkDeleteUuidSchema } from "../../validations/bulk-delete.validations.js";
import { authorizeFeature } from "../../middleware/featureAuthorize.js";

const router: IRouter = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Invoicing is Manager/Executive only — Technicians have no access
const viewInvoices = authorizeFeature("financial", "view_invoices");
const createInvoice = authorizeFeature("financial", "create_invoice");
const editInvoice = authorizeFeature("financial", "edit_invoice");
const deleteInvoice = authorizeFeature("financial", "delete_invoice");
const sendInvoice = authorizeFeature("financial", "send_invoice");
const recordPayment = authorizeFeature("financial", "record_payment");

// ==================== INVOICE ROUTES ====================

// Get invoices (list) and create: Manager/Executive only
router
  .route("/invoices")
  .get(viewInvoices, validate(getInvoicesSchema), invoiceController.getInvoices)
  .post(
    createInvoice,
    validate(createInvoiceSchema),
    invoiceController.createInvoice,
  );

// Get invoice KPIs — Manager/Executive only
router.get(
  "/invoices/kpis",
  viewInvoices,
  validate(getInvoiceKPIsSchema),
  invoiceController.getInvoiceKPIs,
);

// Get invoice by ID, Update invoice, Delete invoice
router
  .route("/invoices/:id")
  .get(
    viewInvoices,
    validate(getInvoiceByIdSchema),
    invoiceController.getInvoiceById,
  )
  .put(
    editInvoice,
    validate(updateInvoiceByIdSchema),
    invoiceController.updateInvoice,
  )
  .delete(
    deleteInvoice,
    validate(deleteInvoiceByIdSchema),
    invoiceController.deleteInvoice,
  );

// Send invoice via email — Manager/Executive only
router.post(
  "/invoices/:id/send",
  sendInvoice,
  validate(sendInvoiceByIdSchema),
  invoiceController.sendInvoiceEmail,
);

// Send test email — Manager/Executive only
router.post(
  "/invoices/:id/send-test",
  sendInvoice,
  validate(sendInvoiceTestByIdSchema),
  invoiceController.sendInvoiceEmailTest,
);

// Mark invoice as paid — Manager/Executive only
router.post(
  "/invoices/:id/mark-paid",
  recordPayment,
  validate(markInvoicePaidByIdSchema),
  invoiceController.markInvoiceAsPaid,
);

// Void invoice — Manager/Executive only
router.post(
  "/invoices/:id/void",
  editInvoice,
  validate(voidInvoiceByIdSchema),
  invoiceController.voidInvoice,
);

// ==================== INVOICE LINE ITEMS ROUTES ====================

// Get invoice line items, Create invoice line item
router
  .route("/invoices/:invoiceId/line-items")
  .get(
    viewInvoices,
    validate(getInvoiceLineItemsSchema),
    invoiceController.getInvoiceLineItems,
  )
  .post(
    editInvoice,
    validate(createInvoiceLineItemForInvoiceSchema),
    invoiceController.createInvoiceLineItem,
  );

// Get single invoice line item, Update invoice line item, Delete invoice line item
router
  .route("/invoices/:invoiceId/line-items/:lineItemId")
  .get(
    viewInvoices,
    validate(getInvoiceLineItemByIdSchema),
    invoiceController.getInvoiceLineItem,
  )
  .put(
    editInvoice,
    validate(updateInvoiceLineItemByIdSchema),
    invoiceController.updateInvoiceLineItem,
  )
  .delete(
    editInvoice,
    validate(deleteInvoiceLineItemByIdSchema),
    invoiceController.deleteInvoiceLineItem,
  );

// ==================== INVOICE PDF ROUTES ====================

// Download/preview invoice PDF — Manager/Executive only
router.get(
  "/invoices/:id/pdf",
  viewInvoices,
  validate(downloadInvoicePDFSchema),
  invoiceController.downloadInvoicePDF,
);

router.get(
  "/invoices/:id/pdf/preview",
  viewInvoices,
  validate(previewInvoicePDFSchema),
  invoiceController.previewInvoicePDF,
);

// ==================== INVOICE PAYMENT ROUTES ====================

// Get/Create payments — Manager/Executive only
router
  .route("/invoices/:invoiceId/payments")
  .get(
    viewInvoices,
    validate(getInvoicePaymentsSchema),
    invoiceController.getInvoicePayments,
  )
  .post(
    recordPayment,
    validate(createInvoicePaymentSchema),
    invoiceController.createInvoicePayment,
  );

// Get/Update/Delete payment by ID
router
  .route("/invoices/:invoiceId/payments/:paymentId")
  .get(
    viewInvoices,
    validate(getInvoicePaymentSchema),
    invoiceController.getInvoicePayment,
  )
  .put(
    recordPayment,
    validate(updateInvoicePaymentSchema),
    invoiceController.updateInvoicePayment,
  )
  .delete(
    deleteInvoice,
    validate(deleteInvoicePaymentSchema),
    invoiceController.deleteInvoicePayment,
  );

// Bulk delete invoices (Executive only)
router.post(
  "/invoices/bulk-delete",
  authorizeFeature("invoicing", "bulk_delete"),
  validate(bulkDeleteUuidSchema),
  invoiceController.bulkDeleteInvoicesHandler,
);

export default router;
