import puppeteer, { Browser, Page } from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { uploadToSpaces } from "./storage.service.js";

// Get current directory for template path (works from dist/ or src/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Resolve template path: try project src/templates first (tsx dev), then next to this file (dist/templates or src/templates) */
function resolveTemplatePath(templateName: string): string {
  const candidates = [
    path.join(process.cwd(), "src", "templates", templateName),
    path.join(__dirname, "..", "templates", templateName),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    `Template not found: ${templateName}. Tried: ${candidates.join("; ")}`,
  );
}

// Browser instance management
let browserInstance: Browser | null = null;

/** Resolve Chrome/Edge path: env var, or common Windows locations so PDF works without running `npx puppeteer browsers install chrome` */
function getChromeExecutablePath(): string | undefined {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;
  if (process.platform !== "win32") return undefined;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  return candidates.find((p) => fs.existsSync(p));
}

/**
 * Get or create browser instance (singleton pattern for performance).
 * Uses PUPPETEER_EXECUTABLE_PATH or system Chrome/Edge on Windows if Puppeteer's bundled Chrome is not installed.
 */
const getBrowser = async (): Promise<Browser> => {
  if (!browserInstance || !browserInstance.isConnected()) {
    const executablePath = getChromeExecutablePath();
    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }
    browserInstance = await puppeteer.launch(launchOptions);
  }
  return browserInstance;
};

/**
 * Close browser instance (call this on app shutdown)
 */
export const closeBrowser = async (): Promise<void> => {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
};

/**
 * Replace template variables with actual data
 * Simple template engine - supports {{variable}} and {{#if condition}}{{/if}}
 */
const renderTemplate = (
  template: string,
  data: Record<string, any>,
): string => {
  let rendered = template;

  // Replace simple variables {{variable}}
  rendered = rendered.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    const keys = variable.trim().split(".");
    let value = data;

    for (const key of keys) {
      value = value?.[key];
    }

    return value !== undefined && value !== null ? String(value) : "";
  });

  // Handle simple {{#if condition}} blocks
  rendered = rendered.replace(
    /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (match, condition, content) => {
      const value = data[condition.trim()];
      return value && value !== "" && value !== null ? content : "";
    },
  );

  // Handle {{#each array}} blocks
  rendered = rendered.replace(
    /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (match, arrayName, itemTemplate) => {
      const array = data[arrayName.trim()];
      if (!Array.isArray(array)) return "";

      return array
        .map((item) => renderTemplate(itemTemplate, { ...data, this: item }))
        .join("");
    },
  );

  return rendered;
};

/**
 * Generate PDF from HTML template
 */
export interface PDFGenerationOptions {
  format?: "A4" | "Letter";
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
}

export interface InvoicePDFData {
  // Company Info
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyState: string;
  companyZip: string;
  companyPhone: string;
  companyEmail: string;

  // Invoice Details
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  statusClass: string; // for CSS class

  // Client Info
  clientName: string;
  contactName: string;
  billingAddressLine1: string;
  billingAddressLine2?: string;
  billingCity: string;
  billingState: string;
  billingZipCode: string;
  billingCityStateZip: string;
  billingCountry: string;

  // Job / scope (for docs template)
  jobType: string;
  poNumber: string;
  serviceDescription: string;

  // Job Info (optional)
  jobId?: string;
  jobNumber?: string;

  // Payment Info
  paymentTerms?: string;

  // Line Items
  lineItems: Array<{
    date: string;
    description: string;
    details?: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
  }>;

  // Totals
  subtotal: string;
  discountAmount?: string;
  discountType?: string;
  taxAmount?: string;
  taxRate?: string;
  totalAmount: string;
  amountPaid?: string;
  balanceDue?: string;

  // Notes
  notes?: string;
  termsAndConditions?: string;

  // Meta
  generatedDate: string;
}

export interface QuotePDFData {
  date: string;
  quoteNumber: string;
  pmRepName: string;
  officeAddress: string;
  officePhone: string;
  companyName: string;
  siteAddress: string;
  contactName: string;
  scope: string;
  email: string;
  clientAddress: string;
  proposalNote: string;
  workItems: Array<{ index: number; description: string }>;
  totalAmount: string;
  expirationDate: string;
}

/**
 * Generate PDF from invoice data
 */
export const generateInvoicePDF = async (
  invoiceData: InvoicePDFData,
  options: PDFGenerationOptions = {},
): Promise<Buffer> => {
  let page: Page | null = null;

  try {
    // Load template (from dist/templates or src/templates)
    const templatePath = resolveTemplatePath("invoice-template.html");
    const template = fs.readFileSync(templatePath, "utf-8");

    // Render template with data
    const html = renderTemplate(template, invoiceData);

    // Get browser and create page
    const browser = await getBrowser();
    page = await browser.newPage();

    // Set content and generate PDF (domcontentloaded avoids timeout on external images e.g. logo)
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const pdfOptions = {
      format: options.format || ("A4" as const),
      printBackground: true,
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in",
        ...options.margin,
      },
      displayHeaderFooter: options.displayHeaderFooter || false,
      headerTemplate: options.headerTemplate || "",
      footerTemplate: options.footerTemplate || "",
    };

    const pdfBuffer = await page.pdf(pdfOptions);

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    throw new Error(
      `Failed to generate PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  } finally {
    if (page) {
      await page.close();
    }
  }
};

/**
 * Generate and save invoice PDF to storage
 */
export const generateAndSaveInvoicePDF = async (
  invoiceData: InvoicePDFData,
  organizationId: string,
  options: PDFGenerationOptions = {},
): Promise<{ buffer: Buffer; fileUrl?: string; filePath?: string }> => {
  try {
    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoiceData, options);

    // Save to storage if configured
    let uploadResult;
    try {
      const fileName = `invoice-${invoiceData.invoiceNumber}-${Date.now()}.pdf`;
      const folder = `invoices/${organizationId}`;

      uploadResult = await uploadToSpaces(pdfBuffer, fileName, folder);
    } catch (uploadError) {
      console.warn("Failed to upload PDF to storage:", uploadError);
      // Continue without upload - return buffer for immediate download
    }

    const result: { buffer: Buffer; fileUrl?: string; filePath?: string } = {
      buffer: pdfBuffer,
    };

    if (uploadResult?.url) {
      result.fileUrl = uploadResult.url;
    }

    if (uploadResult?.filePath) {
      result.filePath = uploadResult.filePath;
    }

    return result;
  } catch (error) {
    console.error("Error generating and saving PDF:", error);
    throw error;
  }
};

/**
 * Options for preparing invoice PDF data (e.g. when sending email with job/contact context)
 */
export interface PrepareInvoicePDFOptions {
  primaryContact?: { fullName?: string | null } | null;
  job?: { jobType?: string | null; description?: string | null } | null;
}

/**
 * Prepare invoice data for PDF generation from database invoice
 */
export const prepareInvoiceDataForPDF = (
  invoice: any,
  organization: any,
  client: any,
  lineItems: any[],
  options?: PrepareInvoicePDFOptions,
): InvoicePDFData => {
  // Map status to CSS class
  const statusClassMap: Record<string, string> = {
    draft: "draft",
    sent: "sent",
    paid: "paid",
    overdue: "overdue",
    void: "void",
  };

  const invoiceDateStr = new Date(invoice.invoiceDate).toLocaleDateString();
  const billingCity = invoice.billingCity || client.city || "";
  const billingState = invoice.billingState || client.state || "";
  const billingZip = invoice.billingZipCode || client.zipCode || "";
  const billingCityStateZip = [billingCity, billingState, billingZip]
    .filter(Boolean)
    .join(", ");

  return {
    // Company Info
    companyName: organization?.name || "Company Name",
    companyAddress: organization?.address || "",
    companyCity: organization?.city || "",
    companyState: organization?.state || "",
    companyZip: organization?.zipCode || "",
    companyPhone: organization?.phone || "",
    companyEmail: organization?.email || "",

    // Invoice Details
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoiceDateStr,
    dueDate: new Date(invoice.dueDate).toLocaleDateString(),
    status: invoice.status?.toUpperCase() || "DRAFT",
    statusClass: statusClassMap[invoice.status] || "draft",

    // Client Info
    clientName: client?.name || "",
    contactName:
      options?.primaryContact?.fullName?.trim() || client?.primaryContactName || "",
    billingAddressLine1: invoice.billingAddressLine1 || client?.address || "",
    billingAddressLine2: invoice.billingAddressLine2 || "",
    billingCity,
    billingState,
    billingZipCode: billingZip,
    billingCityStateZip: billingCityStateZip || "—",
    billingCountry: invoice.billingCountry || client?.country || "USA",

    // Job / scope (for docs template)
    jobType:
      options?.job?.jobType?.trim() ||
      options?.job?.description?.trim() ||
      invoice.job?.jobType ||
      invoice.job?.description ||
      "—",
    poNumber: invoice.poNumber?.trim() || "—",
    serviceDescription:
      options?.job?.description?.trim() ||
      invoice.job?.description?.trim() ||
      "—",

    // Job Info
    jobId: invoice.jobId,
    jobNumber: invoice.job?.jobNumber,

    // Payment Info
    paymentTerms: invoice.paymentTerms,

    // Line Items (with date for docs template)
    lineItems: lineItems.map((item) => ({
      date: invoiceDateStr,
      description: item.description || "",
      details: item.details || "",
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice || 0).toFixed(2),
      totalPrice: Number(item.totalPrice || 0).toFixed(2),
    })),

    // Totals
    subtotal: Number(invoice.subtotal || 0).toFixed(2),
    discountAmount: invoice.discountAmount
      ? Number(invoice.discountAmount).toFixed(2)
      : "0.00",
    discountType: invoice.discountType,
    ...(invoice.taxAmount && {
      taxAmount: Number(invoice.taxAmount).toFixed(2),
    }),
    ...(invoice.taxRate && {
      taxRate: (Number(invoice.taxRate) * 100).toFixed(2),
    }),
    totalAmount: Number(invoice.totalAmount || 0).toFixed(2),
    amountPaid: invoice.amountPaid
      ? Number(invoice.amountPaid).toFixed(2)
      : undefined,
    balanceDue: Number(invoice.balanceDue || invoice.totalAmount || 0).toFixed(
      2,
    ),

    // Notes
    notes: invoice.notes,
    termsAndConditions: invoice.termsAndConditions,

    // Meta
    generatedDate: new Date().toLocaleDateString(),
  };
};

/**
 * Build work items for quote PDF from scope of work (one line per item) or fallback
 */
function buildQuoteWorkItems(
  scopeOfWork: string | null | undefined,
): Array<{ index: number; description: string }> {
  if (!scopeOfWork || String(scopeOfWork).trim() === "") {
    return [{ index: 1, description: "As per proposal scope." }];
  }
  const lines = String(scopeOfWork)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (lines.length === 0) {
    return [{ index: 1, description: scopeOfWork }];
  }
  return lines.map((description, i) => ({ index: i + 1, description }));
}

/**
 * Prepare quote (bid) data for PDF generation
 */
export const prepareQuoteDataForPDF = (
  bid: {
    bidNumber: string;
    createdDate?: string | Date | null;
    endDate?: string | Date | null;
    siteAddress?: string | null;
    scopeOfWork?: string | null;
    referenceDate?: string | null;
    proposalBasis?: string | null;
    assignedToName?: string | null;
    createdByName?: string | null;
  },
  organization: {
    name?: string | null;
    streetAddress?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  },
  financialBreakdown: { totalPrice?: string | number | null } | null,
  primaryContact: { fullName?: string | null; email?: string | null } | null,
  property: {
    addressLine1?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  } | null,
  options?: { officeAddress?: string; officePhone?: string },
): QuotePDFData => {
  const createdDate = bid.createdDate ? new Date(bid.createdDate) : new Date();
  const endDate = bid.endDate ? new Date(bid.endDate) : null;
  const totalPrice =
    financialBreakdown?.totalPrice != null
      ? Number(financialBreakdown.totalPrice)
      : NaN;
  const totalAmount = Number.isFinite(totalPrice)
    ? totalPrice.toFixed(2)
    : "0.00";
  const clientAddressParts = [
    property?.addressLine1,
    [property?.city, property?.state, property?.zipCode]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);
  const clientAddress =
    clientAddressParts.length > 0
      ? clientAddressParts.join(", ")
      : [
          organization?.streetAddress,
          [organization?.city, organization?.state, organization?.zipCode]
            .filter(Boolean)
            .join(", "),
        ]
          .filter(Boolean)
          .join(", ") || "";

  const proposalNote =
    bid.referenceDate || bid.proposalBasis
      ? `This proposal was based on Clients RFP, job walk information from ${bid.referenceDate ?? "—"}, and revised plans dated ${bid.referenceDate ?? "—"} by ${bid.proposalBasis ?? "—"}.`
      : "This proposal was based on the client RFP and job walk information.";

  return {
    date: createdDate.toLocaleDateString(),
    quoteNumber: bid.bidNumber,
    pmRepName: bid.assignedToName ?? bid.createdByName ?? "—",
    officeAddress:
      options?.officeAddress ??
      "4749 Bennett Drive, Suite H, Livermore, CA 94551",
    officePhone: options?.officePhone ?? "(888) 488-2312",
    companyName: organization?.name ?? "—",
    siteAddress: bid.siteAddress ?? "—",
    contactName: primaryContact?.fullName ?? "—",
    scope: bid.scopeOfWork ?? "—",
    email: primaryContact?.email ?? "—",
    clientAddress: clientAddress || "—",
    proposalNote,
    workItems: buildQuoteWorkItems(bid.scopeOfWork),
    totalAmount,
    expirationDate: endDate ? endDate.toLocaleDateString() : "—",
  };
};

/**
 * Generate PDF from quote (bid) data
 */
export const generateQuotePDF = async (
  quoteData: QuotePDFData,
  options: PDFGenerationOptions = {},
): Promise<Buffer> => {
  let page: Page | null = null;

  try {
    const templatePath = resolveTemplatePath("quote-template.html");
    const template = fs.readFileSync(templatePath, "utf-8");
    const html = renderTemplate(template, quoteData);

    const browser = await getBrowser();
    page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    const pdfOptions = {
      format: (options.format || "A4") as "A4" | "Letter",
      printBackground: true,
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in",
        ...options.margin,
      },
      displayHeaderFooter: options.displayHeaderFooter ?? false,
      headerTemplate: options.headerTemplate ?? "",
      footerTemplate: options.footerTemplate ?? "",
    };

    const pdfBuffer = await page.pdf(pdfOptions);
    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error("Quote PDF generation error:", error);
    throw new Error(
      `Failed to generate quote PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  } finally {
    if (page) {
      await page.close();
    }
  }
};

// Cleanup on process exit
process.on("exit", () => {
  if (browserInstance) {
    browserInstance.close().catch(console.error);
  }
});

process.on("SIGINT", async () => {
  await closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeBrowser();
  process.exit(0);
});
