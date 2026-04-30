import puppeteer, { Browser, Page } from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { uploadToSpaces } from "./storage.service.js";
import { parseProposalBasisTextToItems } from "../utils/proposal-basis-storage.js";

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

function isTruthyTemplateCondition(value: unknown): boolean {
  if (value === false || value === null || value === undefined) return false;
  if (value === "") return false;
  return true;
}

/**
 * Expand {{#if name}}...{{/if}} with correct nesting. A non-greedy regex pairs the
 * outer {{#if}} with the *first* {{/if}}, which breaks on nested blocks and leaks
 * raw labels/HTML into PDF output (e.g. quote-template survey + service sections).
 */
function expandIfBlocks(template: string, data: Record<string, any>): string {
  let s = template;

  while (true) {
    const openMatch = /\{\{#if\s+([^}]+)\}\}/.exec(s);
    if (!openMatch) break;

    const start = openMatch.index;
    const condRaw = openMatch[1];
    if (condRaw === undefined) break;
    const condition = condRaw.trim();
    const openTagLen = openMatch[0]?.length ?? 0;
    const contentStart = start + openTagLen;
    let depth = 1;
    let pos = contentStart;

    while (pos < s.length && depth > 0) {
      const slice = s.slice(pos);
      const nextClose = slice.indexOf("{{/if}}");
      const nextOpen = slice.indexOf("{{#if");

      if (nextClose === -1) {
        s = s.slice(0, start) + s.slice(contentStart);
        break;
      }

      const openBeforeClose =
        nextOpen !== -1 && nextOpen < nextClose ? nextOpen : -1;

      if (openBeforeClose !== -1) {
        const afterOpen = slice.slice(openBeforeClose);
        const tag = afterOpen.match(/^\{\{#if\s+[^}]+\}\}/);
        if (!tag) {
          pos += nextOpen + "{{#if".length;
          continue;
        }
        depth += 1;
        pos += openBeforeClose + tag[0].length;
      } else {
        depth -= 1;
        if (depth === 0) {
          const innerRaw = s.slice(contentStart, pos + nextClose);
          const blockEnd = pos + nextClose + "{{/if}}".length;
          const keep = isTruthyTemplateCondition(data[condition])
            ? expandIfBlocks(innerRaw, data)
            : "";
          s = s.slice(0, start) + keep + s.slice(blockEnd);
          break;
        }
        pos += nextClose + "{{/if}}".length;
      }
    }
  }

  return s;
}

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

  // {{#if}} with proper nesting (quote templates nest e.g. isSurvey + hasSurveyDate)
  rendered = expandIfBlocks(rendered, data);

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
 * US Letter (8.5″ × 11″) — Chromium maps `format: "Letter"` to 612×792 pt (72 DPI units).
 * Margins default to 1″ on all sides (common professional / report standard). Callers may
 * override via `options.margin`. Text and vector graphics stay resolution-independent; raster
 * images keep source resolution (use ≥300 DPI assets for critical print detail).
 */
const DEFAULT_LETTER_MARGINS = {
  top: "1in",
  right: "1in",
  bottom: "1in",
  left: "1in",
} as const;

/**
 * Generate PDF from HTML template
 */
export interface PDFGenerationOptions {
  /** Defaults to US Letter (8.5″ × 11″) when omitted. */
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
  /** City, state, ZIP on one line (issuer / general settings). */
  companyLocationLine: string;
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

  // Job (for docs template)
  jobType: string;
  poNumber: string;
  /** Displayed next to SERVICE — job description or bid project name */
  jobName: string;

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
  /** Plan-spec only: “based on Plans…” narrative (shown in type section, not work table). */
  planSpecProposalSummary: string;
  hasPlanSpecProposalSummary: boolean;
  /** Single footer line from Settings → General (name • address • phone • email). */
  quoteFooterLine: string;
  workItems: Array<{ index: number; description: string }>;
  hasWorkDescriptionRows: boolean;
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
  /** Single guard for “services included” block (avoid nested {{#if}} in template). */
  renderServiceIncludedBlock: boolean;

  /** PM — primary scope text for 4-column service-details grid */
  pmReportedIssueGrid: string;

  // PM specific
  pmTypeLabel: string;
  frequencyLabel: string;
  coverageLabel: string;
  pmServicesHtml: string;
  emergencyRateNote: string;
  hasEmergencyRate: boolean;
  paymentScheduleLabel: string;
  pmServiceScope: string;
  hasPMServiceScope: boolean;
  pmPricingModelLabel: string;

  /** Matches dashboard QuotePreview copy (single blocks, not job-type boilerplate). */
  termsParagraph: string;
  exclusionsBody: string;
  warrantyBody: string;

  // Rep / signature (optional — only rendered when present)
  pmRepEmail: string;
  pmRepPhone: string;
  signatureImageUrl: string;
  hasPmRepDetails: boolean;

  // Footer lines
  /** Line 1: client company | contact name | client address | bid # */
  clientFooterLine: string;
  /** Line 2: issuer company | CA License # | phone | email */
  companyFooterLine: string;
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

    await page.setViewport({
      width: 816,
      height: 1056,
      deviceScaleFactor: 1,
    });

    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Match quote PDF: fonts + remote logo must be ready before print.
    try {
      await page.evaluate(
        () =>
          (
            globalThis as unknown as {
              document: { fonts: { ready: Promise<unknown> } };
            }
          ).document.fonts.ready,
      );
      await page.waitForFunction(
        `(() => {
          const img = document.querySelector("img.company-logo");
          return Boolean(img && img.complete && img.naturalWidth > 0);
        })()`,
        { timeout: 20000 },
      );
    } catch {
      // Continue; PDF still generates if CDN blocked or no logo node
    }

    const pdfOptions = {
      format: (options.format ?? "Letter") as "A4" | "Letter",
      printBackground: true,
      margin: {
        ...DEFAULT_LETTER_MARGINS,
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
  job?: {
    jobType?: string | null;
    description?: string | null;
    /** Bid `project_name` when job description is empty */
    projectName?: string | null;
  } | null;
  /** Comma-separated P.O. numbers from linked inventory purchase orders */
  poNumbersDisplay?: string | null;
}

/** Shape of `auth.general_settings` rows used for invoice header (issuer). */
export type GeneralSettingsForInvoicePdf = {
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  licenseNumber?: string | null;
};

/**
 * Map Settings → General to the `organization`-shaped object expected by
 * {@link prepareInvoiceDataForPDF} for the issuer (PDF header), not the client.
 */
export const issuerCompanyFromGeneralSettings = (
  general: GeneralSettingsForInvoicePdf | null | undefined,
): {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  licenseNumber: string;
} => {
  const g = general;
  return {
    name: g?.companyName?.trim() || "Company Name",
    address: (g?.address ?? "").trim(),
    city: (g?.city ?? "").trim(),
    state: (g?.state ?? "").trim(),
    zipCode: (g?.zipCode ?? "").trim(),
    phone: (g?.phone ?? "").trim(),
    email: (g?.email ?? "").trim(),
    licenseNumber: (g?.licenseNumber ?? "").trim(),
  };
};

export type QuotePdfIssuerSettings = ReturnType<
  typeof issuerCompanyFromGeneralSettings
>;

/** Strip HTML to plain text; preserves line breaks from block-level tags. */
function stripHtmlToPlainText(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "";
  let s = String(raw)
    .replace(/<\/(?:p|div|h[1-6]|li|tr)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#0*39;/g, "'")
    .replace(/&quot;/gi, '"');
  return s
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function formatQuoteIssuerAddressLine(issuer: QuotePdfIssuerSettings): string {
  const line2 = [issuer.city, issuer.state, issuer.zipCode]
    .filter(Boolean)
    .join(", ");
  return [issuer.address, line2].filter(Boolean).join(", ");
}

/** Job label on invoice PDF: plain-text job description, else bid project name. */
function invoicePdfJobDisplayName(
  jobDescription: string | null | undefined,
  projectName: string | null | undefined,
): string {
  const stripped = jobDescription
    ? stripHtmlToPlainText(String(jobDescription))
    : "";
  if (stripped) return stripped;
  const p = projectName?.trim();
  return p || "—";
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

  const issuerAddress =
    (organization?.address ?? organization?.streetAddress ?? "").trim() || "";
  const issuerCity = (organization?.city ?? "").trim();
  const issuerState = (organization?.state ?? "").trim();
  const issuerZip = (organization?.zipCode ?? "").trim();
  const companyLocationLine = [issuerCity, issuerState, issuerZip]
    .filter(Boolean)
    .join(", ");

  return {
    // Company Info
    companyName: organization?.name || "Company Name",
    companyAddress: issuerAddress,
    companyCity: issuerCity,
    companyState: issuerState,
    companyZip: issuerZip,
    companyLocationLine,
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
    poNumber: (options?.poNumbersDisplay ?? "").trim() || "—",
    jobName: invoicePdfJobDisplayName(
      options?.job?.description ?? invoice.job?.description,
      options?.job?.projectName ?? null,
    ),

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

/** Work-items table: proposal basis only (items array, else legacy proposalBasis text). No scope. */
function buildQuoteProposalTableItems(bid: {
  proposalBasis?: string | null;
  proposalBasisItems?: unknown;
}): Array<{ index: number; description: string }> {
  const fromItems = Array.isArray(bid.proposalBasisItems)
    ? bid.proposalBasisItems
        .map((x) => String(x).trim())
        .filter((s) => s.length > 0)
    : [];
  const lines: string[] =
    fromItems.length > 0
      ? fromItems
      : parseProposalBasisTextToItems(bid.proposalBasis?.trim() ?? "");

  if (lines.length === 0) {
    return [];
  }

  return lines.map((description, i) => ({
    index: i + 1,
    description: escHtml(description).replace(/\r?\n/g, "<br/>"),
  }));
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

/** Build a simple checklist HTML for included services */
function buildChecklistHtml(items: string[]): string {
  if (items.length === 0) return "";
  return (
    `<ul class="services-checklist">` +
    items.map((item) => `<li>${escHtml(item)}</li>`).join("") +
    `</ul>`
  );
}

/**
 * Exclusions as a two-column &lt;ul&gt; (compact PDF) with optional intro line.
 * Inserts raw HTML — list items are escaped.
 */
function buildExclusionsHtmlForQuote(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return `<p class="exclusions-fallback">${escHtml("None specified.")}</p>`;
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return `<p class="exclusions-fallback">${escHtml("None specified.")}</p>`;
  }

  if (lines.length === 1) {
    return `<div class="exclusions-plain">${escHtml(lines[0]!)}</div>`;
  }

  const items: string[] = [];
  let intro: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const isBulletLine = /^[-*•]\s+/.test(line);
    const content = line.replace(/^[-*•]\s+/, "").trim();

    if (i === 0 && !isBulletLine) {
      intro = line;
      continue;
    }

    items.push(content || line);
  }

  if (items.length === 0) {
    return `<div class="exclusions-plain">${escHtml(trimmed).replace(/\n/g, "<br/>")}</div>`;
  }

  let html = "";
  if (intro) {
    html += `<p class="exclusions-intro">${escHtml(intro)}</p>`;
  }
  html += `<ul class="exclusions-list">`;
  for (const it of items) {
    html += `<li>${escHtml(it)}</li>`;
  }
  html += `</ul>`;
  return html;
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
    proposalBasisItems?: unknown;
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
    warrantyDetails?: string | null;
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
  options?: {
    officeAddress?: string;
    officePhone?: string;
    /** Settings → General — drives company name, company email, office line, footer. */
    issuer?: QuotePdfIssuerSettings;
    /** PM rep contact details for signature block (all optional). */
    pmRepEmail?: string;
    pmRepPhone?: string;
    signatureImageUrl?: string;
  },
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

  // Client address = client org billing / office (not the job site property).
  const clientOrgLine2 = [
    organization?.city,
    organization?.state,
    organization?.zipCode,
  ]
    .filter(Boolean)
    .join(", ");
  const clientAddressParts = [
    organization?.streetAddress,
    clientOrgLine2,
  ].filter(Boolean);
  const clientAddress =
    clientAddressParts.length > 0 ? clientAddressParts.join(", ") : "";

  const issuer = options?.issuer;
  const issuerOfficeLine = issuer ? formatQuoteIssuerAddressLine(issuer) : "";
  const officeAddressResolved =
    options?.officeAddress?.trim() ||
    issuerOfficeLine ||
    "4749 Bennett Drive, Suite H, Livermore, CA 94551";
  const officePhoneResolved =
    options?.officePhone?.trim() ||
    issuer?.phone?.trim() ||
    "(888) 488-2312";
  const companyNameResolved =
    issuer?.name?.trim() || organization?.name?.trim() || "—";
  const companyEmailResolved = issuer?.email?.trim() || "—";

  const footerParts = [
    companyNameResolved !== "—" ? companyNameResolved : "",
    officeAddressResolved,
    officePhoneResolved,
    companyEmailResolved !== "—" ? companyEmailResolved : "",
  ].filter(Boolean);
  const quoteFooterLine = footerParts.join(" • ") || "—";

  // Site = selected client property when present; else plain text from bid.siteAddress
  const siteFromPropertyParts = [
    property?.addressLine1,
    [property?.city, property?.state, property?.zipCode]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);
  const siteFromProperty =
    siteFromPropertyParts.length > 0
      ? siteFromPropertyParts.join(", ")
      : "";
  const siteFromBid = stripHtmlToPlainText(bid.siteAddress?.trim() || "");
  const siteAddressPlain = siteFromProperty || siteFromBid;
  const siteAddress = siteAddressPlain ? escHtml(siteAddressPlain) : "—";

  // Scope — strip HTML (rich-text from UI) for PDF; escape for safe injection
  const scopeRaw =
    bid.scopeOfWork?.trim() || bid.description?.trim() || "";
  const scopePlain = scopeRaw ? stripHtmlToPlainText(scopeRaw) : "";
  const scopeText = scopePlain ? escHtml(scopePlain) : "—";

  // Plan Spec only — narrative for type section (not duplicated in work table / gray card)
  let planSpecProposalSummary = "";
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
    planSpecProposalSummary = `This proposal is based on Plans ${[planRev, planDate].filter(Boolean).join(" received ")} and Specifications ${[specRev].filter(Boolean).join(", ")}${addendaNote}.`;
  }
  const hasPlanSpecProposalSummary = planSpecProposalSummary.trim().length > 0;
  const planSpecProposalSummarySafe = escHtml(planSpecProposalSummary);

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

  // ── Service fields ────────────────────────────────────────────────────────
  const serviceTypeMap: Record<string, string> = {
    emergency_repair: "Emergency Repair",
    scheduled_repair: "Scheduled Repair",
    diagnostic: "Diagnostic",
    installation: "Installation",
    other: "Other",
  };
  const serviceTypeLabel =
    serviceTypeMap[svcDisplayData?.serviceType as string] ||
    svcDisplayData?.serviceType ||
    "—";

  const equipmentTypeMap: Record<string, string> = {
    rooftop_unit: "Rooftop Unit (RTU)",
    split_system: "Split System",
    boiler: "Boiler",
    chiller: "Chiller",
    air_handler: "Air Handler (AHU)",
    other: "Other",
  };
  const equipmentTypeLabel =
    equipmentTypeMap[svcDisplayData?.equipmentType as string] ||
    svcDisplayData?.equipmentType ||
    "—";

  const issueCategoryMap: Record<string, string> = {
    cooling: "Cooling",
    heating: "Heating",
    ventilation: "Ventilation",
    controls: "Controls",
    electrical: "Electrical",
    plumbing: "Plumbing",
    other: "Other",
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

  // ── PM fields ─────────────────────────────────────────────────────────────
  const pmTypeLabel =
    pmDisplayData?.pmType === "existing_pm_renewal"
      ? "PM Contract Renewal"
      : "New PM Contract";

  const freqLabelMap: Record<string, string> = {
    quarterly: "Quarterly",
    semi_annual: "Semi-Annual",
    annual: "Annual",
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
    stripHtmlToPlainText(
      (
        svcDisplayData?.estimatedWorkScope ||
        svcDisplayData?.workScope ||
        ""
      )?.trim() || "",
    ) || "";
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

  const recordHasKeys = (v: unknown): boolean =>
    v != null && typeof v === "object" && !Array.isArray(v)
      ? Object.keys(v as object).length > 0
      : false;

  let showPdfServiceDetail =
    jobType === "service" ||
    (jobType !== "preventative_maintenance" && recordHasKeys(svcDisplayData));
  let showPdfPmDetail =
    jobType === "preventative_maintenance" ||
    (jobType !== "service" && recordHasKeys(pmDisplayData));

  // Primary job type wins — never show PM scope on a service bid (or vice versa).
  if (jobType === "service") showPdfPmDetail = false;
  if (jobType === "preventative_maintenance") showPdfServiceDetail = false;

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
  const renderServiceIncludedBlock =
    showPdfServiceDetail && Boolean(serviceIncludedHtml.trim());

  const pmGridRaw =
    pmDisplayData?.serviceScope?.trim() ||
    pmDisplayData?.specialRequirements?.trim() ||
    bid.description?.trim() ||
    "";
  const pmReportedIssueGrid = pmGridRaw
    ? stripHtmlToPlainText(pmGridRaw) || "—"
    : "—";

  // ── PM extra fields ────────────────────────────────────────────────────────
  const pmServiceScope =
    stripHtmlToPlainText(
      (pmDisplayData?.serviceScope || pmDisplayData?.scope || "")?.trim() ||
        "",
    ) || "";
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

  const paymentTermsRaw = bid.paymentTerms?.trim() || "";
  const expirationStr = endDate
    ? ` and will expire on ${fmtDate(endDate)}`
    : "";
  const termsParagraph = escHtml(
    paymentTermsRaw
      ? `Payment terms: ${paymentTermsRaw}. This quotation is valid for 30 days from the date of issue${expirationStr}.`
      : `This quotation is valid for 30 days from the date of issue${expirationStr}.`,
  );

  const exclusionsRaw = bid.exclusions?.trim() || "";
  const exclusionsBody = exclusionsRaw
    ? buildExclusionsHtmlForQuote(exclusionsRaw)
    : buildExclusionsHtmlForQuote("");

  const warrantyRaw = bid.warrantyDetails?.trim() || "";
  const DEFAULT_WARRANTY =
    `T3 Mechanical, Inc. warrants all material and equipment furnished and work performed for a period of one (1) year from the date of substantial completion.\n\n` +
    `These warranties do not cover:\n` +
    `• Damage caused by misuse, neglect, or failure to maintain the system per manufacturer recommendations\n` +
    `• Normal wear and tear\n` +
    `• Work performed or modifications made by others not authorized by T3 Mechanical, Inc.\n` +
    `• Damage from acts of God, accidents, or power disturbances beyond T3 Mechanical's control\n` +
    `• Equipment or materials not supplied by T3 Mechanical, Inc.\n\n` +
    `THESE WARRANTIES ARE IN LIEU OF ALL OTHER WARRANTIES, EXPRESSED OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. IN NO EVENT SHALL T3 MECHANICAL BE LIABLE FOR INCIDENTAL OR CONSEQUENTIAL DAMAGES.`;
  const warrantyBody = escHtml(warrantyRaw || DEFAULT_WARRANTY);

  const quoteWorkItems = buildQuoteProposalTableItems(bid);
  const hasWorkDescriptionRows = quoteWorkItems.length > 0;

  // Rep contact / signature
  const pmRepEmail = options?.pmRepEmail?.trim() || "";
  const pmRepPhone = options?.pmRepPhone?.trim() || "";
  const signatureImageUrl = options?.signatureImageUrl?.trim() || "";
  const hasPmRepDetails = Boolean(pmRepEmail || pmRepPhone || signatureImageUrl);

  // Footer line 1: client info
  const clientFooterLine =
    [
      companyNameResolved !== "—" ? companyNameResolved : null,
      primaryContact?.fullName?.trim() || null,
      clientAddress || null,
      bid.bidNumber ? `Bid #${bid.bidNumber}` : null,
    ]
      .filter(Boolean)
      .join(" | ") || "—";

  // Footer line 2: issuer / company info
  const licenseNumber = issuer?.licenseNumber?.trim() || "";
  const companyFooterLine =
    [
      companyNameResolved !== "—" ? companyNameResolved : null,
      licenseNumber ? `CA License #${licenseNumber}` : null,
      officePhoneResolved || null,
      companyEmailResolved !== "—" ? companyEmailResolved : null,
    ]
      .filter(Boolean)
      .join(" | ") || "—";

  return {
    date: fmtDate(createdDate),
    quoteNumber: bid.bidNumber,
    pmRepName: bid.assignedToName ?? bid.createdByName ?? "—",
    officeAddress: officeAddressResolved,
    officePhone: officePhoneResolved,
    companyName: companyNameResolved,
    siteAddress,
    contactName: primaryContact?.fullName ?? "—",
    scope: scopeText,
    email: companyEmailResolved,
    clientAddress: clientAddress || "—",
    planSpecProposalSummary: planSpecProposalSummarySafe,
    hasPlanSpecProposalSummary,
    quoteFooterLine,
    workItems: quoteWorkItems,
    hasWorkDescriptionRows,
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
    renderServiceIncludedBlock,
    pmReportedIssueGrid,

    // PM
    pmTypeLabel,
    frequencyLabel,
    coverageLabel,
    pmServicesHtml,
    emergencyRateNote,
    hasEmergencyRate,
    paymentScheduleLabel,
    pmServiceScope,
    hasPMServiceScope,
    pmPricingModelLabel,

    termsParagraph,
    exclusionsBody,
    warrantyBody,

    pmRepEmail,
    pmRepPhone,
    signatureImageUrl,
    hasPmRepDetails,
    clientFooterLine,
    companyFooterLine,
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

    // Letter at 96 CSS px/in. No Puppeteer side margins — the quote-container
    // CSS controls left/right gutters via padding so margins don't double up.
    await page.setViewport({
      width: 816,
      height: 1056,
      deviceScaleFactor: 1,
    });

    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Fonts + logo must be ready before print (domcontentloaded alone can omit remote images).
    try {
      await page.evaluate(
        () =>
          (
            globalThis as unknown as {
              document: { fonts: { ready: Promise<unknown> } };
            }
          ).document.fonts.ready,
      );
      await page.waitForFunction(
        `(() => {
          const img = document.querySelector("img.company-logo");
          return Boolean(img && img.complete && img.naturalWidth > 0);
        })()`,
        { timeout: 20000 },
      );
    } catch {
      // Continue; PDF still generates without logo if CDN blocked
    }

    const pdfOptions = {
      format: (options.format ?? "Letter") as "A4" | "Letter",
      printBackground: true,
      margin: {
        top: "0",
        bottom: "0",
        left: "0",
        right: "0",
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

    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: (options.format ?? "Letter") as "A4" | "Letter",
      printBackground: true,
      margin: {
        ...DEFAULT_LETTER_MARGINS,
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
