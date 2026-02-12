import type { Request, Response } from "express";
import { asSingleString } from "../utils/request-helpers.js";
import * as invoicingService from "../services/invoicing.service.js";
import { logger } from "../utils/logger.js";
import {
  generateAndSaveInvoicePDF,
  prepareInvoiceDataForPDF,
  generateInvoicePDF,
} from "../services/pdf.service.js";
import { getOrganizationById } from "../services/client.service.js";
import { getBidFinancialBreakdown } from "../services/bid.service.js";
import { sendInvoiceEmail as sendInvoiceEmailService } from "../services/email.service.js";
import { db } from "../config/db.js";
import { eq, and } from "drizzle-orm";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";
import { clientContacts } from "../drizzle/schema/client.schema.js";
import { organizations } from "../drizzle/schema/client.schema.js";

/**
 * Get invoices with pagination and filtering
 * GET /invoices
 */
export const getInvoices = async (req: Request, res: Response) => {
  try {
    // Simple pagination options - only include if defined
    const options: { page?: number; limit?: number } = {};
    if (req.query.page) {
      options.page = parseInt(req.query.page as string, 10);
    }
    if (req.query.limit) {
      options.limit = parseInt(req.query.limit as string, 10);
    }

    const organizationId = req.query.organizationId as string | undefined;
    const result = await invoicingService.getInvoices(organizationId, options);

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
    // organizationId is optional - can be provided in query params for filtering, or derived from invoice
    const organizationId = req.query.organizationId as string | undefined;

    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }
    const invoice = await invoicingService.getInvoiceById(
      id,
      organizationId, // Optional - if not provided, service will derive it from invoice
      req.query as any,
    );

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
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User authentication required",
      });
    }

    if (!req.body.jobId) {
      return res.status(400).json({
        success: false,
        message: "jobId is required in request body",
      });
    }

    const result = await invoicingService.createInvoice({
      ...req.body,
      createdBy: userId,
    });

    const invoice = await invoicingService.getInvoiceById(
      result.invoiceId,
      result.organizationId,
      {
        includeLineItems: true,
        includePayments: false,
        includeDocuments: false,
        includeHistory: false,
      },
    );

    logger.info(`Invoice ${result.invoiceId} created successfully`);
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
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    // Get invoice first to derive organizationId
    const existingInvoice = await invoicingService.getInvoiceById(id);
    if (!existingInvoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const organizationId =
      existingInvoice.organizationId || (req.query.organizationId as string);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Could not determine organization context for invoice",
      });
    }

    const invoice = await invoicingService.updateInvoice(
      id,
      organizationId,
      req.body,
      userId,
    );

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
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    // Get invoice first to derive organizationId
    const existingInvoice = await invoicingService.getInvoiceById(id);
    if (!existingInvoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const organizationId =
      existingInvoice.organizationId || (req.query.organizationId as string);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Could not determine organization context for invoice",
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
 * Generate invoice HTML from template
 */
const generateInvoiceHTML = (
  invoiceData: any,
  organizationData: any,
  jobData: any,
  bidData?: any,
): string => {
  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (
    amount: string | number | null | undefined,
  ): string => {
    if (!amount) return "0.00";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return num.toFixed(2);
  };

  // Get data for template (old invoice format)
  const contactName =
    organizationData?.primaryContact?.fullName || "[Contact Name]";
  const companyName = organizationData?.name || "[Company Name]";
  const addressLine1 = invoiceData.billingAddressLine1 || "";
  const cityStateZip = [
    invoiceData.billingCity,
    invoiceData.billingState,
    invoiceData.billingZipCode,
  ]
    .filter(Boolean)
    .join(", ");

  const invoiceDate = formatDate(invoiceData.invoiceDate);
  const dueDate = formatDate(invoiceData.dueDate);
  const jobType = jobData?.jobType || "Service";
  const invoiceNumber = invoiceData.invoiceNumber || "";
  const paymentTerms = invoiceData.paymentTerms || "NET 30";
  const poNumber = bidData?.bidNumber || "N/A";
  const scope = jobData?.description || invoiceData.notes || "Service";

  // Build line items HTML
  const lineItemsHTML = (invoiceData.lineItems || [])
    .map((item: any) => {
      const itemDate = formatDate(item.createdAt || invoiceData.invoiceDate);
      const description = item.description || item.title || "";
      const amount = formatCurrency(item.lineTotal);
      return `
                <tr>
                    <td>${itemDate}</td>
                    <td>${description}</td>
                    <td>$${amount}</td>
                </tr>
      `;
    })
    .join("");

  const totalAmount = formatCurrency(
    invoiceData.balanceDue || invoiceData.totalAmount,
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>T3 Mechanical - Invoice</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        @page {
            size: A4;
            margin: 0;
        }

      body {
        font-family:
          "Inter",
          -apple-system,
          BlinkMacSystemFont,
          sans-serif;
        color: #1a1a1a;
        background: #ffffff;
        line-height: 1.6;
        font-size: 13px;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      .invoice-container {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        background: #ffffff;
        padding: 20mm;
      }

      /* Header Section */
      .header {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 50px;
        margin-bottom: 35px;
        padding-bottom: 25px;
        border-bottom: 2px solid #e5e7eb;
      }

      .company-info h1 {
        font-size: 20px;
        font-weight: 800;
        margin-bottom: 14px;
        color: #1a1a1a;
        letter-spacing: -0.3px;
      }

      .company-info p {
        font-size: 13px;
        color: #374151;
        line-height: 1.6;
        margin-bottom: 4px;
        font-weight: 400;
      }

      .company-logo {
        max-width: 180px;
        height: auto;
      }

      /* Invoice Title */
      .invoice-title {
        font-size: 36px;
        font-weight: 800;
        margin-bottom: 35px;
        color: #1a1a1a;
        letter-spacing: -0.5px;
      }

      /* Bill To Section */
      .bill-to-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 80px;
        margin-bottom: 30px;
      }

      .bill-to h2 {
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 14px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #1a1a1a;
      }

      .bill-to p {
        font-size: 13px;
        line-height: 1.7;
        color: #374151;
        margin-bottom: 3px;
        font-weight: 400;
      }

      .invoice-meta {
        text-align: right;
      }

      .meta-row {
        display: flex;
        justify-content: flex-end;
        gap: 25px;
        margin-bottom: 10px;
        font-size: 13px;
        align-items: baseline;
      }

      .meta-label {
        font-weight: 700;
        text-align: right;
        min-width: 110px;
        color: #1a1a1a;
        text-transform: uppercase;
        font-size: 12px;
        letter-spacing: 0.5px;
      }

      .meta-value {
        text-align: left;
        min-width: 130px;
        color: #374151;
        font-weight: 600;
      }

      /* PO Section */
      .po-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 80px;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 1px solid #d1d5db;
      }

      .po-item {
        display: flex;
        gap: 12px;
        font-size: 13px;
        align-items: baseline;
      }

      .po-item strong {
        font-weight: 700;
        color: #1a1a1a;
        text-transform: uppercase;
        font-size: 12px;
        letter-spacing: 0.5px;
      }

      .po-item span {
        color: #374151;
        font-weight: 500;
      }

      /* Items Table */
      .items-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 35px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        overflow: hidden;
      }

      .items-table thead {
        background: #6b7280;
      }

      .items-table th {
        padding: 14px 16px;
        text-align: left;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        color: white;
        letter-spacing: 0.8px;
      }

      .items-table th:first-child {
        width: 110px;
      }

      .items-table th:last-child {
        text-align: right;
      }

      .items-table td {
        padding: 14px 16px;
        font-size: 13px;
        border-bottom: 1px solid #e5e7eb;
        color: #374151;
      }

      .items-table tbody tr:last-child td {
        border-bottom: none;
      }

      .items-table tbody tr:hover {
        background: #f9fafb;
      }

      .items-table td:first-child {
        color: #6b7280;
        font-weight: 500;
      }

      .items-table td:nth-child(2) {
        color: #1a1a1a;
        font-weight: 400;
        line-height: 1.6;
      }

      .items-table td:last-child {
        text-align: right;
        font-weight: 700;
        color: #1a1a1a;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }

      /* Balance Due */
      .balance-section {
        text-align: right;
        margin-bottom: 60px;
        padding-top: 20px;
      }

      .balance-row {
        display: flex;
        justify-content: flex-end;
        align-items: baseline;
        gap: 20px;
        font-size: 28px;
        font-weight: 800;
        color: #1a1a1a;
        letter-spacing: -0.5px;
      }

      .balance-label {
        font-size: 18px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #374151;
      }

      .balance-row .dollar {
        font-size: 32px;
        font-weight: 800;
        color: #1a1a1a;
      }

      .balance-amount {
        font-size: 36px;
        font-weight: 800;
        color: #1a1a1a;
        font-variant-numeric: tabular-nums;
      }

      /* Remit Payment */
      .remit-payment {
        text-align: center;
        font-size: 11px;
        margin-top: 50px;
        padding-top: 20px;
        border-top: 1px solid #d1d5db;
        color: #6b7280;
        font-weight: 500;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }

      /* Print Styles */
      @media print {
        body {
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .invoice-container {
          padding: 15mm 20mm;
          margin: 0;
        }

        @page {
          margin: 0;
          size: A4;
        }

        .items-table tbody tr:hover {
          background: transparent;
        }
      }
    </style>
    <!-- Redesigned theme overrides (no gradients / no shadows) -->
    <style>
      :root {
        --ink: #0f172a;
        --muted: #475569;
        --muted-2: #64748b;
        --line: #e5e7eb;
        --wash: #f8fafc;
        --wash-2: #f1f5f9;
        --accent: #dc2626;
        --radius: 10px;
      }

      body {
        color: var(--ink);
        line-height: 1.55;
      }

      .invoice-container {
        padding: 18mm 20mm;
      }

      /* Header */
      .header {
        gap: 28px;
        margin-bottom: 18px;
        padding-bottom: 14px;
        border-bottom: 1px solid var(--line);
      }

      .company-logo {
        max-width: 200px;
      }

      .company-info h1 {
        display: none !important;
      }

      .company-info p {
        color: var(--muted);
      }

      /* Title */
      .invoice-title {
        font-size: 34px;
        font-weight: 900;
        letter-spacing: -0.6px;
        margin-bottom: 18px;
      }

      /* Bill To + Meta */
      .bill-to-section {
        gap: 34px;
        margin-bottom: 16px;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--wash);
      }

      .bill-to h2 {
        color: var(--ink);
        margin-bottom: 10px;
      }

      .bill-to p {
        color: var(--muted);
      }

      .invoice-meta {
        text-align: left;
      }

      .meta-row {
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }

      .meta-label {
        color: var(--muted-2);
        min-width: 110px;
      }

      .meta-value {
        color: var(--ink);
        font-weight: 800;
        min-width: 0;
        font-variant-numeric: tabular-nums;
      }

      /* PO */
      .po-section {
        gap: 16px;
        margin-bottom: 16px;
        padding: 12px 14px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: #ffffff;
      }

      .po-section {
        border-bottom: 1px solid var(--line);
        padding-bottom: 12px;
      }

      .po-item strong {
        color: var(--muted-2);
      }

      .po-item span {
        color: var(--ink);
        font-weight: 650;
      }

      /* Items table */
      .items-table {
        border-color: var(--line);
        border-radius: var(--radius);
        margin-bottom: 16px;
      }

      .items-table thead {
        background: var(--accent);
      }

      .items-table th {
        font-weight: 900;
        letter-spacing: 1px;
      }

      .items-table td {
        border-bottom-color: var(--line);
        color: var(--muted);
      }

      .items-table tbody tr:hover {
        background: transparent;
      }

      .items-table tbody tr:nth-child(odd) {
        background: #ffffff;
      }
      .items-table tbody tr:nth-child(even) {
        background: var(--wash);
      }

      .items-table td:nth-child(2) {
        color: var(--ink);
      }

      .items-table td:last-child {
        color: var(--ink);
      }

      /* Balance */
      .balance-section {
        margin-bottom: 24px;
        padding-top: 0;
        display: flex;
        justify-content: flex-end;
      }

      .balance-row {
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--wash);
        padding: 14px 16px;
        gap: 12px;
      }

      .balance-label {
        color: var(--muted-2);
      }

      .balance-row .dollar,
      .balance-amount {
        color: var(--ink);
      }

      /* Remit */
      .remit-payment {
        border-top-color: var(--line);
        color: var(--muted-2);
        margin-top: 18px;
        padding-top: 14px;
      }

      /* Print tweaks */
      @media print {
        .invoice-container {
          padding: 15mm 20mm;
        }
        .items-table tbody tr:nth-child(even) {
          background: #ffffff;
        }
        .bill-to-section {
          background: #ffffff;
        }
        .balance-row {
          background: #ffffff;
        }
      }
    </style>
  </head>
  <body>
    <div class="invoice-container">
      <!-- Header -->
      <div class="header">
        <div class="company-info">
          <p>4749 Bennett Drive, Suite H, Livermore, CA 94551</p>
          <p>(888) 488-2312</p>
          <p>info@t3mechanicalinc.com</p>
        </div>
        <div>
          <img
            src="https://t3-mechanical.sfo3.cdn.digitaloceanspaces.com/t3_logo-black.png"
            alt="T3 Mechanical Logo"
            class="company-logo"
          />
        </div>
      </div>

      <!-- Invoice Title -->
      <div class="invoice-title">INVOICE</div>

      <!-- Bill To Section -->
      <div class="bill-to-section">
        <div class="bill-to">
          <h2>Bill To</h2>
          <p>${contactName || "[Contact Name]"}</p>
          <p>${companyName || "[Company Name]"}</p>
          <p>${addressLine1 || "[Address Line 1]"}</p>
          <p>${cityStateZip || "[City, State ZIP]"}</p>
        </div>
        <div class="invoice-meta">
          <div class="meta-row">
            <span class="meta-label">JOB TYPE</span>
            <span class="meta-value">${jobType}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">INVOICE #</span>
            <span class="meta-value">${invoiceNumber}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">DATE</span>
            <span class="meta-value">${invoiceDate}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">TERMS</span>
            <span class="meta-value">${paymentTerms}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">DUE DATE</span>
            <span class="meta-value">${dueDate}</span>
          </div>
        </div>
      </div>

      <!-- PO Section -->
      <div class="po-section">
        <div class="po-item">
          <strong>P.O. NO.</strong>
          <span>${poNumber}</span>
        </div>
        <div class="po-item">
          <strong>SCOPE</strong>
          <span>${scope}</span>
        </div>
      </div>

      <!-- Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th>DATE</th>
            <th>DESCRIPTION</th>
            <th>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHTML || "<tr><td>[Date]</td><td>[Work description and details of services performed]</td><td>$ [Amount]</td></tr>"}
        </tbody>
      </table>

      <!-- Balance Due -->
      <div class="balance-section">
        <div class="balance-row">
          <span class="balance-label">BALANCE DUE</span>
          <span class="dollar">$</span>
          <span class="balance-amount">${totalAmount}</span>
        </div>
      </div>

      <!-- Remit Payment -->
      <div class="remit-payment">
        REMIT PAYMENT TO 4749 BENNETT DRIVE, SUITE H, LIVERMORE, CA 94551
      </div>
    </div>
  </body>
</html>`;
};

/**
 * Send invoice via email
 * POST /invoices/:id/send
 */
export const sendInvoiceEmail = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    // Get invoice with line items
    const invoice = await invoicingService.getInvoiceById(id, undefined, {
      includeLineItems: true,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    if (!invoice.jobId) {
      return res.status(400).json({
        success: false,
        message: "Invoice must be associated with a job",
      });
    }

    // Get job to get bidId
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, invoice.jobId), eq(jobs.isDeleted, false)))
      .limit(1);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job associated with invoice not found",
      });
    }

    if (!job.bidId) {
      return res.status(400).json({
        success: false,
        message: "Job must be associated with a bid",
      });
    }

    // Get bid to get organizationId
    const [bid] = await db
      .select()
      .from(bidsTable)
      .where(eq(bidsTable.id, job.bidId))
      .limit(1);

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid associated with job not found",
      });
    }

    if (!bid.organizationId) {
      return res.status(400).json({
        success: false,
        message: "Bid must be associated with an organization",
      });
    }

    // Get primary contact from organization
    const [primaryContact] = await db
      .select()
      .from(clientContacts)
      .where(
        and(
          eq(clientContacts.organizationId, bid.organizationId),
          eq(clientContacts.isPrimary, true),
          eq(clientContacts.isDeleted, false),
        ),
      )
      .limit(1);

    if (!primaryContact) {
      return res.status(400).json({
        success: false,
        message:
          "No primary contact found for this organization. Please add a primary contact before sending invoices.",
      });
    }

    if (!primaryContact.email) {
      return res.status(400).json({
        success: false,
        message:
          "Primary contact does not have an email address. Please update the contact information.",
      });
    }

    // Get organization details
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, bid.organizationId))
      .limit(1);

    // Prepare organization data with primary contact
    const organizationWithContact = organization
      ? {
          ...organization,
          primaryContact: primaryContact,
        }
      : null;

    // Generate invoice HTML - pass job data for jobType, description, and bid for bidNumber
    const invoiceHTML = generateInvoiceHTML(
      invoice,
      organizationWithContact,
      job,
      bid,
    );

    // Get email options from request body (body may be undefined if Content-Type not set or empty body)
    const body = req.body ?? {};
    const { subject, message, attachPdf, cc, bcc } = body;

    // Get financial breakdown from bid
    const financialBreakdown = await getBidFinancialBreakdown(
      job.bidId,
      bid.organizationId,
    );

    // Generate PDF if requested
    let pdfAttachment = undefined;
    if (attachPdf !== false) {
      try {
        const pdfOptions =
          primaryContact || job
            ? {
                ...(primaryContact && {
                  primaryContact: {
                    fullName: primaryContact.fullName ?? null,
                  },
                }),
                ...(job && {
                  job: {
                    jobType: (job as any).jobType ?? null,
                    description: (job as any).description ?? null,
                  },
                }),
              }
            : undefined;
        const invoiceData = prepareInvoiceDataForPDF(
          invoice,
          organization, // T3 Mechanical company info (stays as is from direct db query)
          organization, // client is same as organization
          invoice.lineItems || [],
          financialBreakdown,
          pdfOptions,
        );
        const pdfBuffer = await generateInvoicePDF(invoiceData);
        pdfAttachment = {
          content: pdfBuffer,
          filename: `Invoice-${invoice.invoiceNumber}.pdf`,
        };
      } catch (pdfError: any) {
        logger.warn(`Failed to generate PDF attachment: ${pdfError.message}`);
        // Continue without PDF attachment
      }
    }

    // Send email to primary contact email
    const recipientEmail = primaryContact.email;

    await sendInvoiceEmailService(
      recipientEmail,
      invoiceHTML,
      subject || `Invoice ${invoice.invoiceNumber} from T3 Mechanical`,
      message,
      pdfAttachment,
      cc,
      bcc,
    );

    // Update invoice status
    const updatedInvoice = await invoicingService.updateInvoice(
      id,
      bid.organizationId,
      {
        status: "sent",
        emailSent: true,
        emailSentTo: recipientEmail,
        sentDate: new Date(),
      },
      userId,
    );

    if (!updatedInvoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    logger.info(`Invoice ${id} sent successfully to ${recipientEmail}`);
    res.json({
      success: true,
      data: {
        sentAt: new Date().toISOString(),
        sentTo: recipientEmail,
        contactName: primaryContact.fullName,
        note: "Invoice email sent to primary contact",
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

const TEST_INVOICE_EMAIL = "pritam.thapa@quixta.in";

/**
 * Send invoice via email to test address (pritam.thapa@quixta.in). Does not update invoice status.
 * POST /invoices/:id/send-test
 */
export const sendInvoiceEmailTest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    const invoice = await invoicingService.getInvoiceById(id, undefined, {
      includeLineItems: true,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    if (!invoice.jobId) {
      return res.status(400).json({
        success: false,
        message: "Invoice must be associated with a job",
      });
    }

    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, invoice.jobId), eq(jobs.isDeleted, false)))
      .limit(1);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job associated with invoice not found",
      });
    }

    if (!job.bidId) {
      return res.status(400).json({
        success: false,
        message: "Job must be associated with a bid",
      });
    }

    const [bid] = await db
      .select()
      .from(bidsTable)
      .where(eq(bidsTable.id, job.bidId))
      .limit(1);

    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid associated with job not found",
      });
    }

    if (!bid.organizationId) {
      return res.status(400).json({
        success: false,
        message: "Bid must be associated with an organization",
      });
    }

    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, bid.organizationId))
      .limit(1);

    const [primaryContact] = await db
      .select()
      .from(clientContacts)
      .where(
        and(
          eq(clientContacts.organizationId, bid.organizationId),
          eq(clientContacts.isPrimary, true),
          eq(clientContacts.isDeleted, false),
        ),
      )
      .limit(1);

    const organizationWithContact = organization
      ? {
          ...organization,
          primaryContact: primaryContact ?? undefined,
        }
      : null;

    const invoiceHTML = generateInvoiceHTML(
      invoice,
      organizationWithContact,
      job,
      bid,
    );

    // Get financial breakdown from bid
    const financialBreakdown = await getBidFinancialBreakdown(
      job.bidId,
      bid.organizationId,
    );

    const body = req.body ?? {};
    const { subject, message, attachPdf, cc, bcc } = body;

    let pdfAttachment: { content: Buffer; filename: string } | undefined;
    let pdfError: string | undefined;
    if (attachPdf !== false) {
      try {
        const pdfOptions =
          primaryContact || job
            ? {
                ...(primaryContact && {
                  primaryContact: {
                    fullName: primaryContact.fullName ?? null,
                  },
                }),
                ...(job && {
                  job: {
                    jobType: (job as any).jobType ?? null,
                    description: (job as any).description ?? null,
                  },
                }),
              }
            : undefined;

        // T3 Mechanical company info
        const t3MechanicalInfo = {
          name: "T3 Mechanical Inc.",
          address: "4749 Bennett Drive, Suite H",
          city: "Livermore",
          state: "CA",
          zipCode: "94551",
          phone: "(888) 488-2312",
          email: "info@t3mechanicalinc.com",
        };

        const invoiceData = prepareInvoiceDataForPDF(
          invoice,
          t3MechanicalInfo, // T3 Mechanical info for header
          organization ?? {}, // Client organization for Bill To
          invoice.lineItems || [],
          financialBreakdown,
          pdfOptions,
        );
        const pdfBuffer = await generateInvoicePDF(invoiceData);
        pdfAttachment = {
          content: pdfBuffer,
          filename: `Invoice-${invoice.invoiceNumber}.pdf`,
        };
      } catch (err: any) {
        pdfError = err?.message ?? String(err);
        logger.warn(
          `Send-test: Failed to generate PDF attachment: ${pdfError}`,
          { stack: err?.stack },
        );
      }
    }

    await sendInvoiceEmailService(
      TEST_INVOICE_EMAIL,
      invoiceHTML,
      subject || `[TEST] Invoice ${invoice.invoiceNumber} from T3 Mechanical`,
      message,
      pdfAttachment,
      cc,
      bcc,
    );

    logger.info(`Invoice ${id} test sent to ${TEST_INVOICE_EMAIL}`);
    res.json({
      success: true,
      data: {
        sentAt: new Date().toISOString(),
        sentTo: TEST_INVOICE_EMAIL,
        pdfAttached: !!pdfAttachment,
        ...(pdfError && { pdfError }),
        note: "Test email sent. Invoice status was not updated.",
      },
      message: "Test invoice email sent successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error sending test invoice", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to send test invoice",
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
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    // Get invoice first to derive organizationId
    const existingInvoice = await invoicingService.getInvoiceById(id);
    if (!existingInvoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const organizationId =
      existingInvoice.organizationId || (req.query.organizationId as string);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Could not determine organization context for invoice",
      });
    }

    const invoice = await invoicingService.markInvoiceAsPaid(
      id,
      organizationId,
      req.body,
      userId,
    );

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
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    // Get invoice first to derive organizationId
    const existingInvoice = await invoicingService.getInvoiceById(id);
    if (!existingInvoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const organizationId =
      existingInvoice.organizationId || (req.query.organizationId as string);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Could not determine organization context for invoice",
      });
    }

    const invoice = await invoicingService.voidInvoice(
      id,
      organizationId,
      req.body,
      userId,
    );

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
    // organizationId is optional - can be provided in query params or derived from invoice
    const organizationId = req.query.organizationId as string | undefined;

    const invoiceId = asSingleString(req.params.invoiceId);
    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }
    const invoice = await invoicingService.getInvoiceById(
      invoiceId,
      organizationId, // Optional - if not provided, service will derive it from invoice
      {
        includeLineItems: true,
        includePayments: false,
        includeDocuments: false,
        includeHistory: false,
      },
    );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    logger.info(
      `Invoice line items for invoice ${invoiceId} fetched successfully`,
    );
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
 * Get single invoice line item
 * GET /invoices/:invoiceId/line-items/:lineItemId
 */
export const getInvoiceLineItem = async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organizationId as string | undefined;
    const invoiceId = asSingleString(req.params.invoiceId);
    const lineItemId = asSingleString(req.params.lineItemId);
    if (!invoiceId || !lineItemId) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID and line item ID are required",
      });
    }
    const invoice = await invoicingService.getInvoiceById(
      invoiceId,
      organizationId,
      { includeLineItems: true },
    );
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }
    const lineItem = invoice.lineItems?.find(
      (li: { id: string }) => li.id === lineItemId,
    );
    if (!lineItem) {
      return res.status(404).json({
        success: false,
        message: "Line item not found",
      });
    }
    res.json({
      success: true,
      data: { lineItem },
    });
  } catch (error: any) {
    logger.logApiError("Error fetching invoice line item", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to fetch line item",
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
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const invoiceId = asSingleString(req.params.invoiceId);
    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    const invoice = await invoicingService.getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const organizationId = invoice.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Could not determine organization for invoice",
      });
    }

    const body = req.body as {
      description: string;
      itemType?: string;
      quantity?: string;
      quotedPrice: string;
      discountAmount?: string;
      taxRate?: string;
      notes?: string;
      sortOrder?: number;
    };

    const lineItem = await invoicingService.createInvoiceLineItem(
      invoiceId,
      organizationId,
      body,
    );

    if (!lineItem) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    logger.info(
      `Invoice line item created: ${lineItem.id} for invoice ${invoiceId}`,
    );
    return res.status(201).json({
      success: true,
      message: "Line item created successfully",
      data: { lineItem },
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
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const invoiceId = asSingleString(req.params.invoiceId);
    const lineItemId = asSingleString(req.params.lineItemId);
    if (!invoiceId || !lineItemId) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID and line item ID are required",
      });
    }

    const invoice = await invoicingService.getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const organizationId = invoice.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Could not determine organization for invoice",
      });
    }

    const body = req.body as Partial<{
      description: string;
      itemType: string;
      quantity: string;
      quotedPrice: string;
      discountAmount: string;
      taxRate: string;
      notes: string;
      sortOrder: number;
    }>;

    const lineItem = await invoicingService.updateInvoiceLineItem(
      invoiceId,
      lineItemId,
      organizationId,
      body,
    );

    if (!lineItem) {
      return res.status(404).json({
        success: false,
        message: "Line item not found",
      });
    }

    logger.info(`Invoice line item updated: ${lineItemId}`);
    return res.status(200).json({
      success: true,
      message: "Line item updated successfully",
      data: { lineItem },
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
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const invoiceId = asSingleString(req.params.invoiceId);
    const lineItemId = asSingleString(req.params.lineItemId);
    if (!invoiceId || !lineItemId) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID and line item ID are required",
      });
    }

    const invoice = await invoicingService.getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const organizationId = invoice.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Could not determine organization for invoice",
      });
    }

    const deleted = await invoicingService.deleteInvoiceLineItem(
      invoiceId,
      lineItemId,
      organizationId,
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Line item not found",
      });
    }

    logger.info(`Invoice line item deleted: ${lineItemId}`);
    return res.status(200).json({
      success: true,
      message: "Line item deleted successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error deleting invoice line item", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to delete line item",
      error: error.message,
    });
  }
};

/**
 * Get invoice KPIs
 * GET /invoices/kpis
 */
export const getInvoiceKPIs = async (req: Request, res: Response) => {
  try {
    // organizationId is optional - if not provided, returns KPIs for all invoices
    const organizationId = req.query.organizationId as string | undefined;

    const kpis = await invoicingService.getInvoiceKPIs(
      organizationId,
      req.query as any,
    );

    logger.info("Invoice KPIs fetched successfully");
    res.json({
      success: true,
      data: { kpis },
    });
  } catch (error: any) {
    logger.logApiError("Error fetching invoice KPIs", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to fetch invoice KPIs",
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
    const id = asSingleString(req.params.id);
    const { save } = req.query; // Optional: save to storage

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    // Get invoice with all related data - organizationId will be derived from invoice
    const invoice = await invoicingService.getInvoiceById(id, undefined, {
      includeLineItems: true,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // Get organizationId from invoice (derived from job → bid relationship)
    const organizationId = invoice.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Could not determine organization context for invoice",
      });
    }

    // Get client organization data for Bill To section
    const clientOrg = await getOrganizationById(organizationId);
    if (!clientOrg) {
      return res.status(500).json({
        success: false,
        message: "Organization data not found",
      });
    }

    // Get job and financial breakdown
    let financialBreakdown = null;
    let job = null;
    if (invoice.jobId) {
      const [jobRecord] = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, invoice.jobId), eq(jobs.isDeleted, false)))
        .limit(1);
      
      job = jobRecord;
      if (job?.bidId) {
        financialBreakdown = await getBidFinancialBreakdown(
          job.bidId,
          organizationId,
        );
      }
    }

    // Prepare PDF options with job type
    const pdfOptions = job
      ? {
          job: {
            jobType: job.jobType ?? null,
            description: job.description ?? null,
          },
        }
      : undefined;

    // T3 Mechanical company info (hardcoded for now, can be moved to config)
    const t3MechanicalInfo = {
      name: "T3 Mechanical Inc.",
      address: "4749 Bennett Drive, Suite H",
      city: "Livermore",
      state: "CA",
      zipCode: "94551",
      phone: "(888) 488-2312",
      email: "info@t3mechanicalinc.com",
    };

    // Prepare data for PDF generation
    const pdfData = prepareInvoiceDataForPDF(
      invoice,
      t3MechanicalInfo, // T3 Mechanical info for header
      clientOrg.organization, // Client organization for Bill To
      invoice.lineItems || [],
      financialBreakdown,
      pdfOptions,
    );

    // Generate PDF
    if (save === "true") {
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
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      );
      res.setHeader("Content-Length", pdfBuffer.length);

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
    const id = asSingleString(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    // Get invoice with all related data - organizationId will be derived from invoice
    const invoice = await invoicingService.getInvoiceById(id, undefined, {
      includeLineItems: true,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // Get organizationId from invoice (derived from job → bid relationship)
    const organizationId = invoice.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Could not determine organization context for invoice",
      });
    }

    // Get client organization data for Bill To section
    const clientOrg = await getOrganizationById(organizationId);
    if (!clientOrg) {
      return res.status(500).json({
        success: false,
        message: "Organization data not found",
      });
    }

    // Get job and financial breakdown
    let financialBreakdown = null;
    let job = null;
    if (invoice.jobId) {
      const [jobRecord] = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, invoice.jobId), eq(jobs.isDeleted, false)))
        .limit(1);
      
      job = jobRecord;
      if (job?.bidId) {
        financialBreakdown = await getBidFinancialBreakdown(
          job.bidId,
          organizationId,
        );
      }
    }

    // Prepare PDF options with job type
    const pdfOptions = job
      ? {
          job: {
            jobType: job.jobType ?? null,
            description: job.description ?? null,
          },
        }
      : undefined;

    // T3 Mechanical company info (hardcoded for now, can be moved to config)
    const t3MechanicalInfo = {
      name: "T3 Mechanical Inc.",
      address: "4749 Bennett Drive, Suite H",
      city: "Livermore",
      state: "CA",
      zipCode: "94551",
      phone: "(888) 488-2312",
      email: "info@t3mechanicalinc.com",
    };

    // Prepare data for PDF generation
    const pdfData = prepareInvoiceDataForPDF(
      invoice,
      t3MechanicalInfo, // T3 Mechanical info for header
      clientOrg.organization, // Client organization for Bill To
      invoice.lineItems || [],
      financialBreakdown,
      pdfOptions,
    );

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(pdfData);

    // Set headers for inline PDF display
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    );
    res.setHeader("Content-Length", pdfBuffer.length);

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

// ============================
// PAYMENT CONTROLLERS
// ============================

/**
 * Get all payments for an invoice
 * GET /org/invoices/:invoiceId/payments
 */
export const getInvoicePayments = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const invoiceId = req.params.invoiceId as string;
    const organizationId = req.user?.organizationId;

    const payments = await invoicingService.getPaymentsByInvoice(
      invoiceId,
      organizationId,
    );

    if (payments === null) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    logger.info(`Payments retrieved for invoice: ${invoiceId}`);
    return res.status(200).json({
      success: true,
      payments,
    });
  } catch (error: any) {
    logger.logApiError("Error getting invoice payments", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve payments",
      error: error.message,
    });
  }
};

/**
 * Create payment for an invoice
 * POST /org/invoices/:invoiceId/payments
 */
export const createInvoicePayment = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const invoiceId = req.params.invoiceId as string;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const payment = await invoicingService.createPaymentForInvoice(
      invoiceId,
      organizationId,
      req.body,
      userId,
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    logger.info(`Payment created for invoice: ${invoiceId}`);
    return res.status(201).json({
      success: true,
      message: "Payment created successfully",
      payment,
    });
  } catch (error: any) {
    logger.logApiError("Error creating invoice payment", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to create payment",
      error: error.message,
    });
  }
};

/**
 * Get single payment by ID
 * GET /org/invoices/:invoiceId/payments/:paymentId
 */
export const getInvoicePayment = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const invoiceId = req.params.invoiceId as string;
    const paymentId = req.params.paymentId as string;
    const organizationId = req.user?.organizationId;

    const payment = await invoicingService.getPaymentByIdForInvoice(
      paymentId,
      invoiceId,
      organizationId,
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    logger.info(`Payment retrieved: ${paymentId}`);
    return res.status(200).json({
      success: true,
      payment,
    });
  } catch (error: any) {
    logger.logApiError("Error getting payment", error, req);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve payment",
      error: error.message,
    });
  }
};

/**
 * Update payment
 * PUT /org/invoices/:invoiceId/payments/:paymentId
 */
export const updateInvoicePayment = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const invoiceId = req.params.invoiceId as string;
    const paymentId = req.params.paymentId as string;
    const organizationId = req.user?.organizationId;

    const payment = await invoicingService.updatePaymentForInvoice(
      paymentId,
      invoiceId,
      organizationId,
      req.body,
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    logger.info(`Payment updated: ${paymentId}`);
    return res.status(200).json({
      success: true,
      message: "Payment updated successfully",
      payment,
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
 * DELETE /org/invoices/:invoiceId/payments/:paymentId
 */
export const deleteInvoicePayment = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const invoiceId = req.params.invoiceId as string;
    const paymentId = req.params.paymentId as string;
    const organizationId = req.user?.organizationId;

    const result = await invoicingService.deletePaymentForInvoice(
      paymentId,
      invoiceId,
      organizationId,
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    logger.info(`Payment deleted: ${paymentId}`);
    return res.status(200).json({
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
