import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadToSpaces } from './storage.service.js';

// Get current directory for template path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Browser instance management
let browserInstance: Browser | null = null;

/**
 * Get or create browser instance (singleton pattern for performance)
 */
const getBrowser = async (): Promise<Browser> => {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
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
const renderTemplate = (template: string, data: Record<string, any>): string => {
  let rendered = template;

  // Replace simple variables {{variable}}
  rendered = rendered.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    const keys = variable.trim().split('.');
    let value = data;
    
    for (const key of keys) {
      value = value?.[key];
    }
    
    return value !== undefined && value !== null ? String(value) : '';
  });

  // Handle simple {{#if condition}} blocks
  rendered = rendered.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
    const value = data[condition.trim()];
    return value && value !== '' && value !== null ? content : '';
  });

  // Handle {{#each array}} blocks
  rendered = rendered.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, itemTemplate) => {
    const array = data[arrayName.trim()];
    if (!Array.isArray(array)) return '';
    
    return array.map(item => renderTemplate(itemTemplate, { ...data, this: item })).join('');
  });

  return rendered;
};

/**
 * Generate PDF from HTML template
 */
export interface PDFGenerationOptions {
  format?: 'A4' | 'Letter';
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
  billingAddressLine1: string;
  billingAddressLine2?: string;
  billingCity: string;
  billingState: string;
  billingZipCode: string;
  billingCountry: string;

  // Job Info (optional)
  jobId?: string;
  jobNumber?: string;

  // Payment Info
  paymentTerms?: string;

  // Line Items
  lineItems: Array<{
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

/**
 * Generate PDF from invoice data
 */
export const generateInvoicePDF = async (
  invoiceData: InvoicePDFData,
  options: PDFGenerationOptions = {}
): Promise<Buffer> => {
  let page: Page | null = null;
  
  try {
    // Load template
    const templatePath = path.join(__dirname, '..', 'templates', 'invoice-template.html');
    const template = fs.readFileSync(templatePath, 'utf-8');

    // Render template with data
    const html = renderTemplate(template, invoiceData);

    // Get browser and create page
    const browser = await getBrowser();
    page = await browser.newPage();

    // Set content and generate PDF
    await page.setContent(html, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    const pdfOptions = {
      format: options.format || 'A4' as const,
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
        ...options.margin
      },
      displayHeaderFooter: options.displayHeaderFooter || false,
      headerTemplate: options.headerTemplate || '',
      footerTemplate: options.footerTemplate || '',
    };

    const pdfBuffer = await page.pdf(pdfOptions);
    
    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  options: PDFGenerationOptions = {}
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
      console.warn('Failed to upload PDF to storage:', uploadError);
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
    console.error('Error generating and saving PDF:', error);
    throw error;
  }
};

/**
 * Prepare invoice data for PDF generation from database invoice
 */
export const prepareInvoiceDataForPDF = (invoice: any, organization: any, client: any, lineItems: any[]): InvoicePDFData => {
  // Map status to CSS class
  const statusClassMap: Record<string, string> = {
    draft: 'draft',
    sent: 'sent', 
    paid: 'paid',
    overdue: 'overdue',
    void: 'void'
  };

  return {
    // Company Info
    companyName: organization.name || 'Company Name',
    companyAddress: organization.address || '',
    companyCity: organization.city || '',
    companyState: organization.state || '',
    companyZip: organization.zipCode || '',
    companyPhone: organization.phone || '',
    companyEmail: organization.email || '',

    // Invoice Details
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: new Date(invoice.invoiceDate).toLocaleDateString(),
    dueDate: new Date(invoice.dueDate).toLocaleDateString(),
    status: invoice.status.toUpperCase(),
    statusClass: statusClassMap[invoice.status] || 'draft',

    // Client Info
    clientName: client.name || '',
    billingAddressLine1: invoice.billingAddressLine1 || client.address || '',
    billingAddressLine2: invoice.billingAddressLine2 || '',
    billingCity: invoice.billingCity || client.city || '',
    billingState: invoice.billingState || client.state || '',
    billingZipCode: invoice.billingZipCode || client.zipCode || '',
    billingCountry: invoice.billingCountry || client.country || 'USA',

    // Job Info
    jobId: invoice.jobId,
    jobNumber: invoice.job?.jobNumber,

    // Payment Info
    paymentTerms: invoice.paymentTerms,

    // Line Items
    lineItems: lineItems.map(item => ({
      description: item.description || '',
      details: item.details || '',
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice || 0).toFixed(2),
      totalPrice: Number(item.totalPrice || 0).toFixed(2)
    })),

    // Totals
    subtotal: Number(invoice.subtotal || 0).toFixed(2),
    discountAmount: invoice.discountAmount ? Number(invoice.discountAmount).toFixed(2) : "0.00",
    discountType: invoice.discountType,
    ...(invoice.taxAmount && { taxAmount: Number(invoice.taxAmount).toFixed(2) }),
    ...(invoice.taxRate && { taxRate: (Number(invoice.taxRate) * 100).toFixed(2) }),
    totalAmount: Number(invoice.totalAmount || 0).toFixed(2),
    amountPaid: invoice.amountPaid ? Number(invoice.amountPaid).toFixed(2) : undefined,
    balanceDue: Number(invoice.balanceDue || invoice.totalAmount || 0).toFixed(2),

    // Notes
    notes: invoice.notes,
    termsAndConditions: invoice.termsAndConditions,

    // Meta
    generatedDate: new Date().toLocaleDateString()
  };
};

// Cleanup on process exit
process.on('exit', () => {
  if (browserInstance) {
    browserInstance.close().catch(console.error);
  }
});

process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});
