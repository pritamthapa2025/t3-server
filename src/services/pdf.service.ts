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

/**
 * Resolve Chrome/Chromium path for PDF generation.
 * 1. PUPPETEER_EXECUTABLE_PATH env (e.g. on server: /usr/bin/chromium)
 * 2. On Windows: common Chrome/Edge install paths
 * 3. On Linux: common Chromium/Chrome paths (so server can use system-installed browser)
 * If none found, Puppeteer uses its cache (requires: npx puppeteer browsers install chrome).
 */
function getChromeExecutablePath(): string | undefined {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;
  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    return candidates.find((p) => fs.existsSync(p));
  }
  // Linux: fixed paths first, then resolve from PATH (e.g. Nixpacks/Nix installs to profile bin)
  const linuxCandidates = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",
  ];
  const fromList = linuxCandidates.find((p) => fs.existsSync(p));
  if (fromList) return fromList;
  const pathEnv = process.env.PATH ?? "";
  const pathDirs = pathEnv.split(path.delimiter);
  for (const dir of pathDirs) {
    for (const name of ["chromium", "chromium-browser"]) {
      const full = path.join(dir, name);
      if (fs.existsSync(full)) return full;
    }
  }
  return undefined;
}

/**
 * Get or create browser instance (singleton pattern for performance).
 * Uses PUPPETEER_EXECUTABLE_PATH, or system Chrome/Edge (Windows) / Chromium (Linux) when available.
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

  // Process {{#each array}} blocks FIRST (before {{#if}} so nested each/if work)
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

  // Process {{#if condition}} blocks SECOND (before simple variable replacement
  // so that the {{#if ...}} tokens are not consumed by the variable regex)
  let prevRendered: string;
  do {
    prevRendered = rendered;
    rendered = rendered.replace(
      /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (match, condition, content) => {
        const value = data[condition.trim()];
        return value && value !== "" && value !== null ? content : "";
      },
    );
  } while (rendered !== prevRendered); // repeat for nested {{#if}} blocks

  // Replace simple variables {{variable}} LAST
  rendered = rendered.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    const trimmed = variable.trim();
    // Skip any remaining control tokens (should be none at this point)
    if (trimmed.startsWith("#") || trimmed.startsWith("/")) return "";
    const keys = trimmed.split(".");
    let value: any = data;
    for (const key of keys) {
      value = value?.[key];
    }
    return value !== undefined && value !== null ? String(value) : "";
  });

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

  // Line Items (kept for compatibility, but financial breakdown is preferred)
  lineItems: Array<{
    date: string;
    description: string;
    details?: string;
    quantity: number;
    quotedPrice: string;
    totalPrice: string;
  }>;

  // Financial breakdown (from bid)
  materialsCost: string;
  laborCost: string;
  travelCost: string;
  operatingExpensesCost: string;
  hasOperatingExpenses: boolean;

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
  // Financial breakdown (standard)
  materialsCost: string;
  laborCost: string;
  travelCost: string;
  operatingExpensesCost: string;
  hasOperatingExpenses: boolean;
  totalAmount: string;
  expirationDate: string;

  // Job type discriminators for template {{#if}} blocks
  isGeneral: boolean;
  isPlanSpec: boolean;
  isDesignBuild: boolean;
  isSurvey: boolean;
  isService: boolean;
  isPM: boolean;
  /** Service-call detail block (primary job type or secondary row) */
  showPdfServiceDetail: boolean;
  /** PM detail block (primary job type or secondary row) */
  showPdfPmDetail: boolean;

  // Shared enrichment fields (all types)
  projectTimeline: string;
  hasProjectTimeline: boolean;
  estimatedDurationLabel: string;
  hasDuration: boolean;
  siteContact: string;
  hasSiteContact: boolean;

  // Plan Spec specific
  planRevision: string;
  plansReceivedDate: string;
  specRevision: string;
  specsReceivedDate: string;
  addendaAcknowledged: string;
  complianceRequirements: string;
  hasAddenda: boolean;
  hasComplianceRequirements: boolean;
  codeComplianceStatus: string;
  hasCodeComplianceStatus: boolean;
  addendaNotes: string;
  hasAddendaNotes: boolean;

  // Design Build specific
  designPhaseLabel: string;
  designSchedule: string;
  conceptDescription: string;
  designDeliverables: string;
  designRevisionNote: string;
  designFeeLabel: string;
  designFeeAmount: string;
  hasDesignFee: boolean;
  hasConceptDescription: boolean;
  hasDesignDeliverables: boolean;
  clientApprovalNote: string;
  hasClientApproval: boolean;
  approvalMilestones: string;
  hasApprovalMilestones: boolean;

  // Survey specific
  surveyTypeLabel: string;
  surveyScope: string;
  unitTypesList: string;
  surveyServicesHtml: string;
  surveySchedulingNotes: string;
  hasSurveySchedulingNotes: boolean;
  surveyPricingRowsHtml: string;
  surveyDateLabel: string;
  hasSurveyDate: boolean;
  surveyPricingModelLabel: string;
  surveyNotes: string;
  hasSurveyNotes: boolean;

  // Service specific
  serviceTypeLabel: string;
  equipmentTypeLabel: string;
  issueCategoryLabel: string;
  reportedIssue: string;
  preliminaryAssessment: string;
  hasReportedIssue: boolean;
  hasPreliminaryAssessment: boolean;
  servicePricingRowsHtml: string;
  estimatedWorkScope: string;
  hasEstimatedWorkScope: boolean;
  servicePricingNotes: string;
  hasServicePricingNotes: boolean;
  crewSummary: string;
  hasCrewSummary: boolean;
  scheduledDateLabel: string;
  hasScheduledDate: boolean;

  /** Service call grid — row 2 (aligned with web quote preview) */
  serviceFrequencyDisplay: string;
  serviceCoverageDisplay: string;
  servicePaymentDisplay: string;
  serviceIncludedHtml: string;
  hasServiceIncludedHtml: boolean;

  /** PM — primary scope text for 4-column service-details grid */
  pmReportedIssueGrid: string;

  proposalValidityNote: string;

  // PM specific
  pmTypeLabel: string;
  frequencyLabel: string;
  coverageLabel: string;
  pmServicesHtml: string;
  emergencyRateNote: string;
  hasEmergencyRate: boolean;
  paymentScheduleLabel: string;
  pmPricingRowsHtml: string;
  pmServiceScope: string;
  hasPMServiceScope: boolean;
  pmPricingModelLabel: string;

  // Conditional section visibility
  showExclusions: boolean;
  showStandardWarranty: boolean;
  showShortWarranty: boolean;
  showServiceGuarantee: boolean;
  customPaymentTerms: string;
  hasCustomPaymentTerms: boolean;
  customExclusions: string;
  hasCustomExclusions: boolean;
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
  financialBreakdown?: {
    materialsEquipment?: string | number | null;
    labor?: string | number | null;
    travel?: string | number | null;
    operatingExpenses?: string | number | null;
  } | null,
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

  const invoiceDateStr = fmtDate(invoice.invoiceDate);
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
    dueDate: fmtDate(invoice.dueDate),
    status: invoice.status?.toUpperCase() || "DRAFT",
    statusClass: statusClassMap[invoice.status] || "draft",

    // Client Info
    clientName: client?.name || "",
    contactName:
      options?.primaryContact?.fullName?.trim() ||
      client?.primaryContactName ||
      "",
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
    lineItems: lineItems.map((item) => {
      const quantity = Number(item.quantity) || 0;
      const quotedPrice = Number(item.quotedPrice || 0);
      const billedTotal =
        item.billedTotal !== undefined && item.billedTotal !== null
          ? Number(item.billedTotal)
          : quantity * quotedPrice;
      return {
      date: invoiceDateStr,
      description: item.title || item.description || "",
      details: item.details || "",
      quantity,
      quotedPrice: quotedPrice.toFixed(2),
      totalPrice: billedTotal.toFixed(2),
    };
    }),

    // Financial breakdown (from bid)
    materialsCost: financialBreakdown?.materialsEquipment
      ? Number(financialBreakdown.materialsEquipment).toFixed(2)
      : "0.00",
    laborCost: financialBreakdown?.labor
      ? Number(financialBreakdown.labor).toFixed(2)
      : "0.00",
    travelCost: financialBreakdown?.travel
      ? Number(financialBreakdown.travel).toFixed(2)
      : "0.00",
    operatingExpensesCost: financialBreakdown?.operatingExpenses
      ? Number(financialBreakdown.operatingExpenses).toFixed(2)
      : "0.00",
    hasOperatingExpenses: Boolean(
      financialBreakdown?.operatingExpenses &&
      Number(financialBreakdown.operatingExpenses) > 0,
    ),

    // Totals - always use invoice values so PDF matches invoice detail.
    subtotal: Number(invoice.lineItemSubTotal || invoice.jobSubtotal || 0).toFixed(
      2,
    ),
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
    balanceDue: Number(invoice.balanceDue || invoice.totalAmount || 0).toFixed(2),

    // Notes
    notes: invoice.notes,
    termsAndConditions: invoice.termsAndConditions,

    // Meta
    generatedDate: fmtDate(new Date()),
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

/** Resolve the correct total amount based on job type and type-specific pricing data */
function resolveTotal(
  jobType: string,
  breakdown: Record<string, any> | null,
  typeData: Record<string, any> | null,
): string {
  if (jobType === "survey") {
    return Number(typeData?.totalSurveyFee || 0).toFixed(2);
  }
  if (jobType === "service") {
    const model = typeData?.pricingModel;
    if (model === "flat_rate")
      return Number(typeData?.flatRatePrice || 0).toFixed(2);
    if (model === "diagnostic_repair")
      return (
        Number(typeData?.diagnosticFee || 0) +
        Number(typeData?.estimatedRepairCost || 0)
      ).toFixed(2);
    // time_materials
    const laborTotal =
      (Number(typeData?.numberOfTechs) || 1) *
      (Number(typeData?.laborHours) || 0) *
      (Number(typeData?.laborRate) || 0);
    const mat = Number(typeData?.materialsCost || 0);
    const travel = Number(typeData?.travelCost || 0);
    const markup = 1 + Number(typeData?.serviceMarkup || 0) / 100;
    return ((laborTotal + mat + travel) * markup).toFixed(2);
  }
  if (jobType === "preventative_maintenance") {
    const freqMap: Record<string, number> = {
      quarterly: 4,
      semi_annual: 2,
      annual: 1,
    };
    const visits = freqMap[typeData?.maintenanceFrequency as string] ?? 0;
    const model = typeData?.pricingModel;
    let base = 0;
    if (model === "per_unit")
      base =
        Number(typeData?.pricePerUnit || 0) *
        Number(typeData?.numberOfUnits || 0) *
        visits;
    else if (model === "flat_rate")
      base = Number(typeData?.flatRatePerVisit || 0) * visits;
    else if (model === "annual_contract")
      base = Number(typeData?.annualContractValue || 0);
    const addons =
      (typeData?.includeFilterReplacement
        ? Number(typeData?.filterReplacementCost || 0) *
          Number(typeData?.numberOfUnits || 0) *
          visits
        : 0) +
      (typeData?.includeCoilCleaning
        ? Number(typeData?.coilCleaningCost || 0) * visits
        : 0);
    return (base + addons).toFixed(2);
  }
  if (jobType === "design_build") {
    const construction = Number(breakdown?.totalPrice || 0);
    const design = Number(typeData?.designPrice || 0);
    return (construction + design).toFixed(2);
  }
  // general / plan_spec
  return Number(breakdown?.totalPrice || 0).toFixed(2);
}

/** Build HTML rows for the pricing table from an array of {label, amount} pairs */
function buildPricingRowsHtml(
  rows: Array<{ label: string; amount: string }>,
): string {
  return rows
    .map(
      (row, i) =>
        `<tr><td>${i + 1}</td><td>${escHtml(row.label)}</td><td style="text-align:right;font-weight:700;">${escHtml(row.amount)}</td></tr>`,
    )
    .join("");
}

/** Build a simple checklist HTML for included services */
function buildChecklistHtml(items: string[]): string {
  if (items.length === 0) return "";
  return (
    `<ul class="services-checklist">` +
    items.map((item) => `<li>${escHtml(item)}</li>`).join("") +
    `</ul>`
  );
}

/** Format a date string/Date to a readable string, returning fallback if empty.
 *  Parses YYYY-MM-DD directly to avoid any timezone conversion. */
const PDF_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
function fmtDate(d: string | Date | null | undefined, fallback = "—"): string {
  if (!d) return fallback;
  try {
    const str = d instanceof Date ? d.toISOString() : String(d);
    const datePart = str.split("T")[0] ?? str;
    const [year, month, day] = datePart.split("-").map(Number);
    if (!year || !month || !day) return fallback;
    return `${PDF_MONTHS[month - 1]} ${day}, ${year}`;
  } catch {
    return fallback;
  }
}

/**
 * Prepare quote (bid) data for PDF generation — job-type-aware version
 */
export const prepareQuoteDataForPDF = (
  bid: {
    bidNumber: string;
    jobType?: string | null;
    createdDate?: string | Date | null;
    endDate?: string | Date | null;
    siteAddress?: string | null;
    scopeOfWork?: string | null;
    description?: string | null;
    referenceDate?: string | null;
    proposalBasis?: string | null;
    assignedToName?: string | null;
    createdByName?: string | null;
    createdAt?: string | Date | null;
    plannedStartDate?: string | null;
    estimatedCompletion?: string | null;
    completionDate?: string | null;
    estimatedDuration?: string | number | null;
    siteContactName?: string | null;
    siteContactPhone?: string | null;
    scheduledDateTime?: string | null;
    paymentTerms?: string | null;
    exclusions?: string | null;
  },
  organization: {
    name?: string | null;
    streetAddress?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  },
  financialBreakdown: {
    materialsEquipment?: string | number | null;
    labor?: string | number | null;
    travel?: string | number | null;
    operatingExpenses?: string | number | null;
    totalPrice?: string | number | null;
  } | null,
  primaryContact: { fullName?: string | null; email?: string | null } | null,
  property: {
    addressLine1?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  } | null,
  options?: { officeAddress?: string; officePhone?: string },
  typeSpecificData?: Record<string, any> | null,
  typeSpecificSecondary?: {
    serviceData?: Record<string, any> | null;
    pmData?: Record<string, any> | null;
  } | null,
): QuotePDFData => {
  const jobType = bid.jobType ?? "general";
  const typeData = typeSpecificData ?? null;
  const svcDisplayData =
    jobType === "service"
      ? typeData
      : typeSpecificSecondary?.serviceData ?? null;
  const pmDisplayData =
    jobType === "preventative_maintenance"
      ? typeData
      : typeSpecificSecondary?.pmData ?? null;

  const createdRaw = bid.createdDate ?? bid.createdAt;
  const createdDate = createdRaw ? new Date(createdRaw) : new Date();
  const endDate = bid.endDate ? new Date(bid.endDate) : null;

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

  // Resolve the scope text — use scopeOfWork, fallback to description
  const scopeText = bid.scopeOfWork?.trim() || bid.description?.trim() || "—";

  // Proposal note — customise for Plan Spec
  let proposalNote: string;
  if (jobType === "plan_spec" && typeData) {
    const planRev = typeData.planRevision
      ? `Rev. ${typeData.planRevision}`
      : "";
    const planDate = fmtDate(typeData.plansReceivedDate, "");
    const specRev = typeData.specificationRevision
      ? `Rev. ${typeData.specificationRevision}`
      : "";
    const addendaNote =
      typeData.addendaReceived && typeData.addendaCount
        ? `, Addendum #${typeData.addendaCount} acknowledged`
        : "";
    proposalNote = `This proposal is based on Plans ${[planRev, planDate].filter(Boolean).join(" received ")} and Specifications ${[specRev].filter(Boolean).join(", ")}${addendaNote}.`;
  } else {
    const basis = bid.proposalBasis?.trim();
    proposalNote = basis
      ? basis
      : "This proposal was based on the client RFP and job walk information.";
  }

  const proposalValidityNote =
    "This quote is valid for 30 days from the date of issue.";

  // Standard financial breakdown fields
  const materialsCost = financialBreakdown?.materialsEquipment
    ? Number(financialBreakdown.materialsEquipment).toFixed(2)
    : "0.00";
  const laborCost = financialBreakdown?.labor
    ? Number(financialBreakdown.labor).toFixed(2)
    : "0.00";
  const travelCost = financialBreakdown?.travel
    ? Number(financialBreakdown.travel).toFixed(2)
    : "0.00";
  const operatingExpensesCost = financialBreakdown?.operatingExpenses
    ? Number(financialBreakdown.operatingExpenses).toFixed(2)
    : "0.00";
  const hasOperatingExpenses = Boolean(
    financialBreakdown?.operatingExpenses &&
    Number(financialBreakdown.operatingExpenses) > 0,
  );

  const totalAmount = resolveTotal(
    jobType,
    financialBreakdown as any,
    typeData,
  );

  // ── Plan Spec fields ──────────────────────────────────────────────────────
  const planRevision = typeData?.planRevision
    ? `Rev. ${typeData.planRevision}`
    : "—";
  const plansReceivedDate = fmtDate(typeData?.plansReceivedDate);
  const specRevision = typeData?.specificationRevision
    ? `Rev. ${typeData.specificationRevision}`
    : "—";
  const specsReceivedDate = fmtDate(typeData?.specificationsReceivedDate);
  const hasAddenda = Boolean(
    typeData?.addendaReceived && typeData?.addendaCount,
  );
  const addendaAcknowledged = hasAddenda
    ? `Addendum #${typeData!.addendaCount} acknowledged`
    : "";
  const complianceRequirements = typeData?.complianceRequirements?.trim() || "";
  const hasComplianceRequirements = Boolean(complianceRequirements);

  // ── Design Build fields ───────────────────────────────────────────────────
  const designPhaseMap: Record<string, string> = {
    conceptual: "Conceptual Design",
    schematic: "Schematic Design",
    design_development: "Design Development",
    construction_documents: "Construction Documents",
    bidding: "Bidding",
    construction_admin: "Construction Administration",
  };
  const designPhaseLabel =
    designPhaseMap[typeData?.designPhase as string] ||
    typeData?.designPhase ||
    "—";
  const dsStart = fmtDate(typeData?.designStartDate, "");
  const dsEnd = fmtDate(typeData?.designCompletionDate, "");
  const designSchedule =
    dsStart && dsEnd ? `${dsStart} – ${dsEnd}` : dsStart || dsEnd || "—";
  const conceptDescription = typeData?.conceptDescription?.trim() || "";
  const designDeliverables = typeData?.designDeliverables?.trim() || "";
  const designRevisionNote = typeData?.designRevisionLimit
    ? `Up to ${typeData.designRevisionLimit} design revision${typeData.designRevisionLimit > 1 ? "s" : ""} included`
    : "";
  const designFeeBasisMap: Record<string, string> = {
    fixed: "Fixed Fee",
    hourly: "Hourly",
    percentage: "Percentage",
    lump_sum: "Lump Sum",
  };
  const designFeeLabel =
    designFeeBasisMap[typeData?.designFeeBasis as string] ||
    typeData?.designFeeBasis ||
    "Design Fee";
  const designFeeAmount = Number(typeData?.designPrice || 0).toFixed(2);
  const hasDesignFee = Number(typeData?.designPrice || 0) > 0;
  const hasConceptDescription = Boolean(conceptDescription);
  const hasDesignDeliverables = Boolean(designDeliverables);

  // ── Survey fields ─────────────────────────────────────────────────────────
  const surveyTypeMap: Record<string, string> = {
    "new-installation": "New Installation Survey",
    "existing-assessment": "Existing System Assessment",
    "energy-audit": "Energy Audit",
    "feasibility-study": "Feasibility Study",
  };
  const surveyTypeLabel =
    surveyTypeMap[typeData?.surveyType as string] ||
    typeData?.surveyType ||
    "Site Survey";
  const numBuildings = typeData?.numberOfBuildings || 0;
  const numUnits = typeData?.expectedUnitsToSurvey || 0;
  const surveyScope =
    [
      numBuildings > 0
        ? `${numBuildings} building${numBuildings > 1 ? "s" : ""}`
        : "",
      numUnits > 0
        ? `${numUnits} unit${numUnits > 1 ? "s" : ""} to survey`
        : "",
    ]
      .filter(Boolean)
      .join(" · ") || "—";

  let unitTypesList = "—";
  try {
    const rawUt = typeData?.unitTypes;
    if (Array.isArray(rawUt) && rawUt.length > 0) {
      unitTypesList = rawUt.join(", ");
    } else if (rawUt != null && String(rawUt).trim() !== "") {
      const parsed = JSON.parse(String(rawUt));
      if (Array.isArray(parsed) && parsed.length > 0)
        unitTypesList = parsed.join(", ");
    }
  } catch {
    /* ignore */
  }

  const surveyServiceItems: string[] = [];
  if (typeData?.includePhotoDocumentation)
    surveyServiceItems.push("Photo Documentation");
  if (typeData?.includePerformanceTesting)
    surveyServiceItems.push("Performance Testing");
  if (typeData?.includeEnergyAnalysis)
    surveyServiceItems.push("Energy Analysis");
  if (typeData?.includeRecommendations)
    surveyServiceItems.push("Written Recommendations Report");
  const surveyServicesHtml = buildChecklistHtml(surveyServiceItems);

  const surveySchedulingNotes =
    typeData?.schedulingConstraints?.trim() ||
    typeData?.accessRequirements?.trim() ||
    "";
  const hasSurveySchedulingNotes = Boolean(surveySchedulingNotes);

  const surveyPricingRows: Array<{ label: string; amount: string }> = [];
  if (jobType === "survey" && typeData) {
    const model = typeData.pricingModel;
    if (model === "flat_fee") {
      surveyPricingRows.push({
        label: "Survey Fee (Flat Rate)",
        amount: `$${Number(typeData.flatSurveyFee || 0).toFixed(2)}`,
      });
    } else if (model === "per_unit") {
      const perUnit = Number(typeData.pricePerUnit || 0);
      const units = Number(typeData.expectedUnitsToSurvey || 0);
      surveyPricingRows.push({
        label: `Per-Unit Rate ($${perUnit.toFixed(2)} × ${units} units)`,
        amount: `$${(perUnit * units).toFixed(2)}`,
      });
    } else {
      // time_materials
      const hrs = Number(typeData.estimatedHours || 0);
      const rate = Number(typeData.hourlyRate || 0);
      const expenses = Number(typeData.estimatedExpenses || 0);
      surveyPricingRows.push(
        {
          label: `Labour (${hrs} hrs × $${rate.toFixed(2)}/hr)`,
          amount: `$${(hrs * rate).toFixed(2)}`,
        },
        { label: "Site Expenses", amount: `$${expenses.toFixed(2)}` },
      );
    }
    if (travelCost !== "0.00")
      surveyPricingRows.push({ label: "Travel", amount: `$${travelCost}` });
  }
  const surveyPricingRowsHtml = buildPricingRowsHtml(surveyPricingRows);

  // ── Service fields ────────────────────────────────────────────────────────
  const serviceTypeMap: Record<string, string> = {
    emergency_repair: "Emergency Repair",
    scheduled_repair: "Scheduled Repair",
    diagnostic: "Diagnostic",
    installation: "Installation",
    other: "General Service",
  };
  const serviceTypeLabel =
    serviceTypeMap[svcDisplayData?.serviceType as string] ||
    svcDisplayData?.serviceType ||
    "Service Call";

  const equipmentTypeMap: Record<string, string> = {
    rooftop_unit: "Rooftop Unit (RTU)",
    split_system: "Split System",
    boiler: "Boiler",
    chiller: "Chiller",
    air_handler: "Air Handler (AHU)",
    other: "HVAC Equipment",
  };
  const equipmentTypeLabel =
    equipmentTypeMap[svcDisplayData?.equipmentType as string] ||
    svcDisplayData?.equipmentType ||
    "—";

  const issueCategoryMap: Record<string, string> = {
    cooling: "Cooling System",
    heating: "Heating System",
    ventilation: "Ventilation",
    controls: "Controls/BMS",
    electrical: "Electrical",
    plumbing: "Plumbing",
    other: "General",
  };
  const issueCategoryLabel =
    issueCategoryMap[svcDisplayData?.issueCategory as string] ||
    svcDisplayData?.issueCategory ||
    "—";

  const reportedIssueRaw = svcDisplayData?.reportedIssue?.trim() || "";
  const reportedIssue = reportedIssueRaw || "—";
  const preliminaryAssessment =
    svcDisplayData?.preliminaryAssessment?.trim() || "";
  const hasReportedIssue = Boolean(reportedIssueRaw);
  const hasPreliminaryAssessment = Boolean(preliminaryAssessment);

  const servicePricingRows: Array<{ label: string; amount: string }> = [];
  if (jobType === "service" && typeData) {
    const model = typeData.pricingModel;
    if (model === "flat_rate") {
      servicePricingRows.push({
        label: `Flat Rate Service — ${serviceTypeLabel}`,
        amount: `$${Number(typeData.flatRatePrice || 0).toFixed(2)}`,
      });
    } else if (model === "diagnostic_repair") {
      servicePricingRows.push(
        {
          label: "Diagnostic Fee",
          amount: `$${Number(typeData.diagnosticFee || 0).toFixed(2)}`,
        },
        {
          label: "Estimated Repair Cost",
          amount: `$${Number(typeData.estimatedRepairCost || 0).toFixed(2)}`,
        },
      );
    } else {
      // time_materials
      const techs = Number(typeData.numberOfTechs || 1);
      const hrs = Number(typeData.laborHours || 0);
      const rate = Number(typeData.laborRate || 0);
      const mat = Number(typeData.materialsCost || 0);
      const trav = Number(typeData.travelCost || 0);
      const markup = Number(typeData.serviceMarkup || 0);
      servicePricingRows.push(
        {
          label: `Labour (${techs} tech${techs > 1 ? "s" : ""} × ${hrs} hrs × $${rate.toFixed(2)}/hr)`,
          amount: `$${(techs * hrs * rate).toFixed(2)}`,
        },
        { label: "Materials & Parts", amount: `$${mat.toFixed(2)}` },
        { label: "Travel", amount: `$${trav.toFixed(2)}` },
      );
      if (markup > 0)
        servicePricingRows.push({ label: `Markup (${markup}%)`, amount: "" });
    }
  }
  const servicePricingRowsHtml = buildPricingRowsHtml(servicePricingRows);

  // ── PM fields ─────────────────────────────────────────────────────────────
  const pmTypeLabel =
    pmDisplayData?.pmType === "existing_pm_renewal"
      ? "PM Contract Renewal"
      : "New PM Contract";

  const freqLabelMap: Record<string, string> = {
    quarterly: "Quarterly (4 visits/year)",
    semi_annual: "Semi-Annual (2 visits/year)",
    annual: "Annual (1 visit/year)",
  };
  const frequencyLabel =
    freqLabelMap[pmDisplayData?.maintenanceFrequency as string] ||
    pmDisplayData?.maintenanceFrequency ||
    "—";

  const pmBuildings = pmDisplayData?.numberOfBuildings || 0;
  const pmUnits = pmDisplayData?.numberOfUnits || 0;
  const coverageLabel =
    [
      pmBuildings > 0
        ? `${pmBuildings} building${pmBuildings > 1 ? "s" : ""}`
        : "",
      pmUnits > 0 ? `${pmUnits} unit${pmUnits > 1 ? "s" : ""}` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "—";

  const pmServiceItems: string[] = [];
  if (
    pmDisplayData?.filterReplacementIncluded ||
    pmDisplayData?.includeFilterReplacement
  )
    pmServiceItems.push("Filter Replacement");
  if (
    pmDisplayData?.coilCleaningIncluded ||
    pmDisplayData?.includeCoilCleaning
  )
    pmServiceItems.push("Coil Cleaning");
  if (pmDisplayData?.temperatureReadingsIncluded)
    pmServiceItems.push("Temperature Readings");
  if (pmDisplayData?.visualInspectionIncluded)
    pmServiceItems.push("Visual Inspection");
  const pmServicesHtml = buildChecklistHtml(
    pmServiceItems.length > 0
      ? pmServiceItems
      : ["Standard preventative maintenance inspection"],
  );

  const emergencyRate = Number(pmDisplayData?.emergencyServiceRate || 0);
  const hasEmergencyRate = emergencyRate > 0;
  const emergencyRateNote = hasEmergencyRate
    ? `Emergency service rate: $${emergencyRate.toFixed(2)}/hr (charged when used)`
    : "";

  const paymentScheduleMap: Record<string, string> = {
    annual: "Annual (billed once per year)",
    per_visit: "Per Visit (billed after each visit)",
    quarterly: "Quarterly",
  };
  const paymentScheduleLabel =
    bid.paymentTerms?.trim() ||
    paymentScheduleMap[pmDisplayData?.paymentSchedule as string] ||
    pmDisplayData?.paymentSchedule ||
    "Net 30 days from date of invoice";

  const freqMap2: Record<string, number> = {
    quarterly: 4,
    semi_annual: 2,
    annual: 1,
  };
  const pmVisits = freqMap2[typeData?.maintenanceFrequency as string] ?? 0;
  const pmPricingRows: Array<{ label: string; amount: string }> = [];
  if (jobType === "preventative_maintenance" && typeData) {
    const pmModel = typeData.pricingModel;
    if (pmModel === "per_unit") {
      const rate = Number(typeData.pricePerUnit || 0);
      const units = Number(typeData.numberOfUnits || 0);
      const perVisit = rate * units;
      pmPricingRows.push({
        label: `Per-Unit Rate ($${rate.toFixed(2)}/unit × ${units} units × ${pmVisits} visits)`,
        amount: `$${(perVisit * pmVisits).toFixed(2)}`,
      });
    } else if (pmModel === "flat_rate") {
      const perVisit = Number(typeData.flatRatePerVisit || 0);
      pmPricingRows.push({
        label: `Flat Rate Per Visit × ${pmVisits} visits`,
        amount: `$${(perVisit * pmVisits).toFixed(2)}`,
      });
    } else if (pmModel === "annual_contract") {
      pmPricingRows.push({
        label: "Annual Contract Value",
        amount: `$${Number(typeData.annualContractValue || 0).toFixed(2)}`,
      });
    }
    if (typeData.includeFilterReplacement && typeData.filterReplacementCost) {
      const frc =
        Number(typeData.filterReplacementCost) *
        Number(typeData.numberOfUnits || 1) *
        pmVisits;
      pmPricingRows.push({
        label: `Filter Replacement (${pmUnits} units × ${pmVisits} visits)`,
        amount: `$${frc.toFixed(2)}`,
      });
    }
    if (typeData.includeCoilCleaning && typeData.coilCleaningCost) {
      const cc = Number(typeData.coilCleaningCost) * pmVisits;
      pmPricingRows.push({
        label: `Coil Cleaning × ${pmVisits} visits`,
        amount: `$${cc.toFixed(2)}`,
      });
    }
  }
  const pmPricingRowsHtml = buildPricingRowsHtml(pmPricingRows);

  // ── Shared enrichment fields ──────────────────────────────────────────────
  const startDate = bid.plannedStartDate
    ? fmtDate(bid.plannedStartDate, "")
    : "";
  const completionDate = bid.completionDate
    ? fmtDate(bid.completionDate, "")
    : bid.estimatedCompletion
      ? fmtDate(bid.estimatedCompletion, "")
      : "";
  const projectTimeline =
    startDate && completionDate
      ? `${startDate} – ${completionDate}`
      : startDate
        ? `Start: ${startDate}`
        : completionDate
          ? `Target: ${completionDate}`
          : "";
  const hasProjectTimeline = Boolean(projectTimeline);
  const estDays = bid.estimatedDuration ? Number(bid.estimatedDuration) : 0;
  const estimatedDurationLabel =
    estDays > 0 ? `${estDays} day${estDays !== 1 ? "s" : ""}` : "";
  const hasDuration = Boolean(estimatedDurationLabel);
  const siteContactName = bid.siteContactName?.trim() || "";
  const siteContactPhone = bid.siteContactPhone?.trim() || "";
  const siteContact = siteContactName
    ? [siteContactName, siteContactPhone].filter(Boolean).join(" · ")
    : "";
  const hasSiteContact = Boolean(siteContact);

  // ── Plan Spec extra fields ─────────────────────────────────────────────────
  const codeComplianceStatus = typeData?.codeComplianceStatus?.trim() || "";
  const hasCodeComplianceStatus = Boolean(codeComplianceStatus);
  const addendaNotes = typeData?.addendaNotes?.trim() || "";
  const hasAddendaNotes = Boolean(addendaNotes);

  // ── Design Build extra fields ──────────────────────────────────────────────
  const clientApprovalRequired = Boolean(
    typeData?.clientApprovalRequired || typeData?.approvalRequired,
  );
  const clientApprovalNote = clientApprovalRequired
    ? "Client approval required at each design milestone before work may proceed."
    : "";
  const hasClientApproval = clientApprovalRequired;
  const approvalMilestones =
    (typeData?.approvalMilestones || typeData?.keyMilestones || "")?.trim() ||
    "";
  const hasApprovalMilestones = Boolean(approvalMilestones);

  // ── Survey extra fields ────────────────────────────────────────────────────
  const rawSurveyDate = typeData?.surveyDate || typeData?.scheduledDate || "";
  const surveyDateLabel = fmtDate(rawSurveyDate, "");
  const hasSurveyDate = Boolean(surveyDateLabel);
  const surveyPricingModelMap: Record<string, string> = {
    flat_fee: "Flat Fee",
    per_unit: "Per Unit",
    time_materials: "Time & Materials",
  };
  const surveyPricingModelLabel =
    surveyPricingModelMap[typeData?.pricingModel as string] ||
    typeData?.pricingModel ||
    "";
  const surveyNotes =
    (typeData?.surveyNotes || typeData?.additionalNotes || "")?.trim() || "";
  const hasSurveyNotes = Boolean(surveyNotes);

  // ── Service extra fields ───────────────────────────────────────────────────
  const estimatedWorkScope =
    (
      svcDisplayData?.estimatedWorkScope ||
      svcDisplayData?.workScope ||
      ""
    )?.trim() || "";
  const hasEstimatedWorkScope = Boolean(estimatedWorkScope);
  const servicePricingNotes =
    (svcDisplayData?.pricingNotes || svcDisplayData?.notes || "")?.trim() ||
    "";
  const hasServicePricingNotes = Boolean(servicePricingNotes);
  const svcTechs = Number(svcDisplayData?.numberOfTechs || 0);
  const svcHours = Number(svcDisplayData?.laborHours || 0);
  const crewSummary =
    svcTechs > 0 && svcHours > 0
      ? `${svcTechs} technician${svcTechs > 1 ? "s" : ""} · ${svcHours} hour${svcHours !== 1 ? "s" : ""} estimated`
      : svcTechs > 0
        ? `${svcTechs} technician${svcTechs > 1 ? "s" : ""}`
        : "";
  const hasCrewSummary = Boolean(crewSummary);
  const rawScheduledDate =
    bid.scheduledDateTime || svcDisplayData?.scheduledDate || "";
  const scheduledDateLabel = rawScheduledDate
    ? fmtDate(rawScheduledDate, "")
    : "";
  const hasScheduledDate = Boolean(scheduledDateLabel);

  const serviceFrequencyDisplay = "—";
  const serviceCoverageDisplay = "—";
  const servicePaymentDisplay = bid.paymentTerms?.trim() || "—";

  const showPdfServiceDetail =
    jobType === "service" || Boolean(svcDisplayData);
  const showPdfPmDetail =
    jobType === "preventative_maintenance" || Boolean(pmDisplayData);

  const serviceIncludedItems: string[] = [];
  if (showPdfServiceDetail) {
    if (estimatedWorkScope)
      serviceIncludedItems.push(estimatedWorkScope);
    else
      serviceIncludedItems.push(
        "Labor, materials, and travel per proposal scope",
      );
  }
  const serviceIncludedHtml = buildChecklistHtml(serviceIncludedItems);
  const hasServiceIncludedHtml = showPdfServiceDetail;

  const pmReportedIssueGrid =
    pmDisplayData?.serviceScope?.trim() ||
    pmDisplayData?.specialRequirements?.trim() ||
    bid.description?.trim() ||
    "—";

  // ── PM extra fields ────────────────────────────────────────────────────────
  const pmServiceScope =
    (pmDisplayData?.serviceScope || pmDisplayData?.scope || "")?.trim() || "";
  const hasPMServiceScope = Boolean(pmServiceScope);
  const pmPricingModelMap: Record<string, string> = {
    per_unit: "Per Unit",
    flat_rate: "Flat Rate per Visit",
    annual_contract: "Annual Contract",
  };
  const pmPricingModelLabel =
    pmPricingModelMap[pmDisplayData?.pricingModel as string] ||
    pmDisplayData?.pricingModel ||
    "";

  // ── Conditional section visibility ────────────────────────────────────────
  const showExclusions =
    jobType !== "survey" && jobType !== "preventative_maintenance";
  const showStandardWarranty =
    jobType === "general" ||
    jobType === "plan_spec" ||
    jobType === "design_build";
  const showShortWarranty = jobType === "service";
  const showServiceGuarantee = jobType === "preventative_maintenance";

  const customPaymentTerms = bid.paymentTerms?.trim() || "";
  const hasCustomPaymentTerms = Boolean(customPaymentTerms);
  const customExclusions = bid.exclusions?.trim() || "";
  const hasCustomExclusions = Boolean(customExclusions);

  return {
    date: fmtDate(createdDate),
    quoteNumber: bid.bidNumber,
    pmRepName: bid.assignedToName ?? bid.createdByName ?? "—",
    officeAddress:
      options?.officeAddress ??
      "4749 Bennett Drive, Suite H, Livermore, CA 94551",
    officePhone: options?.officePhone ?? "(888) 488-2312",
    companyName: organization?.name ?? "—",
    siteAddress: bid.siteAddress ?? "—",
    contactName: primaryContact?.fullName ?? "—",
    scope: scopeText,
    email: primaryContact?.email ?? "—",
    clientAddress: clientAddress || "—",
    proposalNote,
    proposalValidityNote,
    workItems: buildQuoteWorkItems(scopeText === "—" ? null : scopeText),
    materialsCost,
    laborCost,
    travelCost,
    operatingExpensesCost,
    hasOperatingExpenses,
    totalAmount,
    expirationDate: endDate ? fmtDate(endDate) : "—",

    // Type discriminators
    isGeneral: jobType === "general",
    isPlanSpec: jobType === "plan_spec",
    isDesignBuild: jobType === "design_build",
    isSurvey: jobType === "survey",
    isService: jobType === "service",
    isPM: jobType === "preventative_maintenance",
    showPdfServiceDetail,
    showPdfPmDetail,

    // Shared enrichment
    projectTimeline,
    hasProjectTimeline,
    estimatedDurationLabel,
    hasDuration,
    siteContact,
    hasSiteContact,

    // Plan Spec
    planRevision,
    plansReceivedDate,
    specRevision,
    specsReceivedDate,
    addendaAcknowledged,
    complianceRequirements,
    hasAddenda,
    hasComplianceRequirements,
    codeComplianceStatus,
    hasCodeComplianceStatus,
    addendaNotes,
    hasAddendaNotes,

    // Design Build
    designPhaseLabel,
    designSchedule,
    conceptDescription,
    designDeliverables,
    designRevisionNote,
    designFeeLabel,
    designFeeAmount,
    hasDesignFee,
    hasConceptDescription,
    hasDesignDeliverables,
    clientApprovalNote,
    hasClientApproval,
    approvalMilestones,
    hasApprovalMilestones,

    // Survey
    surveyTypeLabel,
    surveyScope,
    unitTypesList,
    surveyServicesHtml,
    surveySchedulingNotes,
    hasSurveySchedulingNotes,
    surveyPricingRowsHtml,
    surveyDateLabel,
    hasSurveyDate,
    surveyPricingModelLabel,
    surveyNotes,
    hasSurveyNotes,

    // Service
    serviceTypeLabel,
    equipmentTypeLabel,
    issueCategoryLabel,
    reportedIssue,
    preliminaryAssessment,
    hasReportedIssue,
    hasPreliminaryAssessment,
    servicePricingRowsHtml,
    estimatedWorkScope,
    hasEstimatedWorkScope,
    servicePricingNotes,
    hasServicePricingNotes,
    crewSummary,
    hasCrewSummary,
    scheduledDateLabel,
    hasScheduledDate,

    serviceFrequencyDisplay,
    serviceCoverageDisplay,
    servicePaymentDisplay,
    serviceIncludedHtml,
    hasServiceIncludedHtml,
    pmReportedIssueGrid,

    // PM
    pmTypeLabel,
    frequencyLabel,
    coverageLabel,
    pmServicesHtml,
    emergencyRateNote,
    hasEmergencyRate,
    paymentScheduleLabel,
    pmPricingRowsHtml,
    pmServiceScope,
    hasPMServiceScope,
    pmPricingModelLabel,

    // Visibility flags
    showExclusions,
    showStandardWarranty,
    showShortWarranty,
    showServiceGuarantee,
    customPaymentTerms,
    hasCustomPaymentTerms,
    customExclusions,
    hasCustomExclusions,
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

// ============================================================
// Financial Report PDF
// ============================================================

export interface FinancialReportPDFData {
  reportTitle: string;
  reportSubtitle: string;
  reportId: string;
  dateRange: string;
  organizationName: string;
  generatedDate: string;
  /** Pre-rendered HTML for summary KPI cards block (or empty string). */
  summaryCardsHtml: string;
  /** Pre-rendered HTML for the main table / content block. */
  mainContentHtml: string;
}

/** Build a grid of KPI summary cards (matches financial-report-template card styles) */
export function buildSummaryCardsHtml(
  cards: Array<{
    label: string;
    value: string;
    sub?: string;
    variant?: "positive" | "negative" | "neutral";
  }>,
): string {
  if (!cards.length) return "";
  const cardHtml = cards
    .map(
      (c) =>
        `<div class="summary-card">
          <div class="summary-card-label">${escHtml(c.label)}</div>
          <div class="summary-card-body">
          <div class="summary-card-value ${c.variant === "positive" ? "positive" : c.variant === "negative" ? "negative" : ""}">${escHtml(c.value)}</div>
          ${c.sub ? `<div class="summary-card-sub">${escHtml(c.sub)}</div>` : ""}
          </div>
        </div>`,
    )
    .join("");
  return `<div class="summary-cards">${cardHtml}</div>`;
}

/** Build a standard data table with thead/tbody/tfoot */
export function buildDataTableHtml(opts: {
  sectionTitle?: string;
  columns: Array<{ label: string; align?: "left" | "right" | "center" }>;
  rows: Array<
    Array<string | { text: string; badge?: string; badgeVariant?: string }>
  >;
  totalsRow?: string[];
}): string {
  const { sectionTitle, columns, rows, totalsRow } = opts;

  const thHtml = columns
    .map(
      (c) =>
        `<th class="${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}">${escHtml(c.label)}</th>`,
    )
    .join("");

  const tbodyHtml = rows
    .map((row) => {
      const tdsHtml = row
        .map((cell, i) => {
          const align = columns[i]?.align;
          const alignClass =
            align === "right"
              ? "text-right"
              : align === "center"
                ? "text-center"
                : "";
          if (typeof cell === "string") {
            return `<td class="${alignClass}">${escHtml(cell)}</td>`;
          }
          const badge = cell.badge
            ? `<span class="badge badge-${cell.badgeVariant ?? "gray"}">${escHtml(cell.badge)}</span>`
            : "";
          return `<td class="${alignClass}">${escHtml(cell.text)}${badge ? " " + badge : ""}</td>`;
        })
        .join("");
      return `<tr>${tdsHtml}</tr>`;
    })
    .join("");

  const tfootHtml = totalsRow
    ? `<tfoot><tr>${totalsRow.map((t, i) => `<td class="${columns[i]?.align === "right" ? "text-right" : ""}">${escHtml(t)}</td>`).join("")}</tr></tfoot>`
    : "";

  const title = sectionTitle
    ? `<div class="section-label">${escHtml(sectionTitle)}</div>`
    : "";

  return `${title}
<div class="data-table-wrapper">
  <table class="data-table">
    <thead><tr>${thHtml}</tr></thead>
    <tbody>${tbodyHtml}</tbody>
    ${tfootHtml}
  </table>
</div>`;
}

/** Build a P&L-style section (label + value rows grouped under headers) */
export function buildPLHtml(
  sections: Array<{
    header: string;
    rows: Array<{ label: string; value: string; indent?: boolean }>;
    subtotal?: {
      label: string;
      value: string;
      valueClass?: "positive" | "negative";
    };
  }>,
  netTotal?: {
    label: string;
    value: string;
    valueClass?: "positive" | "negative";
  },
): string {
  const sectionsHtml = sections
    .map((s) => {
      const rowsHtml = s.rows
        .map(
          (r) =>
            `<div class="pl-row" style="${r.indent ? "padding-left:28px" : ""}">
              <span class="pl-label">${escHtml(r.label)}</span>
              <span class="pl-value">${escHtml(r.value)}</span>
            </div>`,
        )
        .join("");
      const subtotalHtml = s.subtotal
        ? `<div class="pl-row subtotal">
            <span class="pl-label">${escHtml(s.subtotal.label)}</span>
            <span class="pl-value ${s.subtotal.valueClass ?? ""}">${escHtml(s.subtotal.value)}</span>
          </div>`
        : "";
      return `<div class="pl-section">
          <div class="pl-section-header">${escHtml(s.header)}</div>
          ${rowsHtml}
          ${subtotalHtml}
        </div>`;
    })
    .join("");

  const netHtml = netTotal
    ? `<div class="pl-row net-total">
        <span class="pl-label">${escHtml(netTotal.label)}</span>
        <span class="pl-value ${netTotal.valueClass ?? ""}">${escHtml(netTotal.value)}</span>
      </div>`
    : "";

  return `<div class="section-label">Statement</div>
<div class="pl-wrapper">
  ${sectionsHtml}
  ${netHtml}
</div>`;
}

function escHtml(s: string | undefined | null): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generate a PDF buffer for a financial report using the financial-report-template.
 */
export const generateFinancialReportPDF = async (
  reportData: FinancialReportPDFData,
  options: PDFGenerationOptions = {},
): Promise<Buffer> => {
  let page: Page | null = null;
  try {
    const templatePath = resolveTemplatePath("financial-report-template.html");
    const template = fs.readFileSync(templatePath, "utf-8");
    const html = renderTemplate(template, reportData);

    const browser = await getBrowser();
    page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: (options.format || "A4") as "A4" | "Letter",
      printBackground: true,
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in",
        ...options.margin,
      },
      displayHeaderFooter: false,
    });

    return Buffer.from(pdfBuffer);
  } catch (err) {
    console.error("Financial report PDF error:", err);
    throw new Error(
      `Failed to generate report PDF: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  } finally {
    if (page) await page.close();
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
