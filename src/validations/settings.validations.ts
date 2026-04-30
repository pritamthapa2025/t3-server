import { z } from "zod";

/**
 * ============================================================================
 * GENERAL TAB - GENERAL SETTINGS VALIDATIONS
 * ============================================================================
 * Combines company information and announcement settings
 */

export const updateGeneralSettingsSchema = z.object({
  body: z.object({
    // Company Information
    companyName: z.string().max(255).optional(),
    email: z.string().email().max(255).optional(),
    phone: z.string().max(50).optional(),

    // Business Address
    address: z.string().optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(50).optional(),
    zipCode: z.string().max(20).optional(),

    // Business Licenses & IDs
    taxId: z.string().max(50).optional(),
    licenseNumber: z.string().max(100).optional(),

    // Announcement Settings
    announcementEnabled: z.boolean().optional(),
    announcementTitle: z.string().max(255).optional(),
    announcementDescription: z.string().optional(),
  }),
});

/**
 * ============================================================================
 * LABOR ROLES TAB - LABOR RATE TEMPLATE VALIDATIONS
 * ============================================================================
 */

export const updateLaborRateTemplateSchema = z.object({
  body: z.object({
    defaultDays: z.number().int().min(1).optional(),
    defaultHoursPerDay: z.number().min(0).optional(),
    defaultCostRate: z.number().min(0).optional(),
    defaultBillableRate: z.number().min(0).optional(),
  }),
});

export const bulkUpdateLaborRatesSchema = z.object({
  body: z.object({
    defaultDays: z.number().int().min(1).optional(),
    defaultHoursPerDay: z.number().min(0).optional(),
    defaultCostRate: z.number().min(0).optional(),
    defaultBillableRate: z.number().min(0).optional(),
  }),
});

/**
 * ============================================================================
 * VEHICLE & TRAVEL TAB - VEHICLE/TRAVEL DEFAULTS VALIDATIONS
 * ============================================================================
 */

/** JSON numbers or numeric strings (Postgres numeric serialization, masked inputs). */
function vehicleTravelOptionalNumber(opts: { min: number; max?: number }) {
  const schema =
    opts.max !== undefined
      ? z.number().min(opts.min).max(opts.max).optional()
      : z.number().min(opts.min).optional();

  return z.preprocess((val: unknown) => {
    if (val === undefined || val === null || val === "") return undefined;
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (typeof val === "string") {
      const t = val.trim().replace(/,/g, "");
      if (t === "") return undefined;
      const n = Number(t);
      return Number.isFinite(n) ? n : val;
    }
    return val;
  }, schema);
}

export const updateVehicleTravelDefaultsSchema = z.object({
  body: z.object({
    defaultMileageRate: vehicleTravelOptionalNumber({ min: 0 }),
    defaultVehicleDayRate: vehicleTravelOptionalNumber({ min: 0 }),
    defaultMarkup: vehicleTravelOptionalNumber({ min: 0, max: 100 }),
    enableFlatRate: z.boolean().optional(),
    flatRateAmount: vehicleTravelOptionalNumber({ min: 0 }),
    gasPricePerGallon: vehicleTravelOptionalNumber({ min: 0 }),
  }),
});

/**
 * ============================================================================
 * VEHICLE & TRAVEL TAB - TRAVEL ORIGIN VALIDATIONS
 * ============================================================================
 */

export const createTravelOriginSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    addressLine1: z.string().min(1).max(255),
    addressLine2: z.string().max(255).optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(50),
    zipCode: z.string().min(1).max(20),
    country: z.string().max(100).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    notes: z.string().optional(),
  }),
});

export const updateTravelOriginSchema = z.object({
  body: z.object({
    name: z.string().max(255).optional(),
    addressLine1: z.string().max(255).optional(),
    addressLine2: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(50).optional(),
    zipCode: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    notes: z.string().optional(),
  }),
});

/**
 * ============================================================================
 * OPERATING EXPENSES TAB - VALIDATIONS
 * ============================================================================
 */

export const updateOperatingExpenseDefaultsSchema = z.object({
  body: z.object({
    grossRevenuePreviousYear: z.number().min(0).optional(),
    operatingCostPreviousYear: z.number().min(0).optional(),
    inflationRate: z.number().min(0).max(100).optional(),
    defaultMarkupPercentage: z.number().min(0).max(100).optional(),
    enableByDefault: z.boolean().optional(),
  }),
});

/**
 * ============================================================================
 * PROPOSAL TEMPLATES TAB - PROPOSAL BASIS TEMPLATE VALIDATIONS
 * ============================================================================
 */

const JOB_TYPE_VALUES = [
  "general",
  "plan_spec",
  "design_build",
  "service",
  "preventative_maintenance",
  "survey",
] as const;

export const createProposalBasisTemplateSchema = z.object({
  body: z.object({
    label: z.string().min(1).max(255),
    jobType: z.enum(JOB_TYPE_VALUES).optional().nullable(),
    items: z.array(z.string().max(2000)).max(200).optional(),
    template: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateProposalBasisTemplateSchema = z.object({
  body: z.object({
    label: z.string().max(255).optional(),
    jobType: z.enum(JOB_TYPE_VALUES).optional().nullable(),
    items: z.array(z.string().max(2000)).max(200).optional(),
    template: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

/**
 * ============================================================================
 * PROPOSAL TEMPLATES TAB - TERMS & CONDITIONS TEMPLATE VALIDATIONS
 * ============================================================================
 */

export const createTermsConditionsTemplateSchema = z.object({
  body: z.object({
    label: z.string().min(1).max(255),
    exclusions: z.string().optional(),
    warrantyDetails: z.string().optional(),
    specialTerms: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  }),
});

export const updateTermsConditionsTemplateSchema = z.object({
  body: z.object({
    label: z.string().max(255).optional(),
    exclusions: z.string().optional(),
    warrantyDetails: z.string().optional(),
    specialTerms: z.string().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  }),
});

/**
 * ============================================================================
 * INVOICE SETTINGS TAB (system-wide)
 * ============================================================================
 */

export const getInvoiceSettingsSchema = z.object({
  query: z.object({}).optional(),
});

export const updateInvoiceSettingsSchema = z.object({
  body: z.object({
    defaultPaymentTerms: z.string().max(50).optional(),
    defaultPaymentTermsDays: z.number().int().min(0).optional(),
    defaultTaxRate: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/, "Invalid tax rate")
      .optional(),
    enableLateFees: z.boolean().optional(),
    lateFeePercentage: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Invalid percentage")
      .optional(),
    lateFeeGracePeriodDays: z.number().int().min(0).optional(),
    showLineItemDetails: z.boolean().optional(),
    showLaborBreakdown: z.boolean().optional(),
    showMaterialsBreakdown: z.boolean().optional(),
    defaultInvoiceNotes: z.string().nullable().optional(),
    defaultTermsAndConditions: z.string().nullable().optional(),
    autoSendOnCompletion: z.boolean().optional(),
    autoRemindBeforeDue: z.boolean().optional(),
    reminderDaysBeforeDue: z.number().int().min(0).optional(),
    defaultEmailSubject: z.string().max(500).nullable().optional(),
    defaultEmailMessage: z.string().nullable().optional(),
    alwaysAttachPdf: z.boolean().optional(),
  }),
});
