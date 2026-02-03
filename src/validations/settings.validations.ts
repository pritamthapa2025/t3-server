import { z } from "zod";

/**
 * ============================================================================
 * COMPANY / GENERAL SETTINGS VALIDATIONS
 * ============================================================================
 */

export const updateCompanySettingsSchema = z.object({
  body: z.object({
    companyName: z.string().max(255).optional(),
    email: z.string().email().max(255).optional(),
    phone: z.string().max(50).optional(),
    address: z.string().optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(50).optional(),
    zipCode: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
    taxId: z.string().max(50).optional(),
    licenseNumber: z.string().max(100).optional(),
    logoUrl: z.string().max(500).optional(),
    timeZone: z.string().max(100).optional(),
    workWeekStart: z.string().max(20).optional(),
    workStartTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    workEndTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    dateFormat: z.string().max(50).optional(),
    timeFormat: z.enum(["12-hour", "24-hour"]).optional(),
  }),
});

/**
 * ============================================================================
 * ANNOUNCEMENT SETTINGS VALIDATIONS
 * ============================================================================
 */

export const updateAnnouncementSettingsSchema = z.object({
  body: z.object({
    enabled: z.boolean().optional(),
    title: z.string().max(255).optional(),
    description: z.string().optional(),
    backgroundColor: z.string().max(50).optional(),
    textColor: z.string().max(50).optional(),
  }),
});

/**
 * ============================================================================
 * LABOR RATE TEMPLATE VALIDATIONS
 * ============================================================================
 */

export const updateLaborRateTemplateSchema = z.object({
  body: z.object({
    defaultQuantity: z.number().int().min(1).optional(),
    defaultDays: z.number().int().min(1).optional(),
    defaultHoursPerDay: z.number().min(0).optional(),
    defaultCostRate: z.number().min(0).optional(),
    defaultBillableRate: z.number().min(0).optional(),
  }),
});

export const bulkUpdateLaborRatesSchema = z.object({
  body: z.object({
    defaultQuantity: z.number().int().min(1).optional(),
    defaultDays: z.number().int().min(1).optional(),
    defaultHoursPerDay: z.number().min(0).optional(),
    defaultCostRate: z.number().min(0).optional(),
    defaultBillableRate: z.number().min(0).optional(),
  }),
});

/**
 * ============================================================================
 * VEHICLE & TRAVEL DEFAULTS VALIDATIONS
 * ============================================================================
 */

export const updateVehicleTravelDefaultsSchema = z.object({
  body: z.object({
    defaultMileageRate: z.number().min(0).optional(),
    defaultVehicleDayRate: z.number().min(0).optional(),
    defaultMarkup: z.number().min(0).max(100).optional(),
    enableFlatRate: z.boolean().optional(),
    flatRateAmount: z.number().min(0).optional(),
    gasPricePerGallon: z.number().min(0).optional(),
  }),
});

/**
 * ============================================================================
 * TRAVEL ORIGIN VALIDATIONS
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
 * OPERATING EXPENSE DEFAULTS VALIDATIONS
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
 * JOB SETTINGS VALIDATIONS
 * ============================================================================
 */

export const updateJobSettingsSchema = z.object({
  body: z.object({
    jobNumberPrefix: z.string().max(20).optional(),
    jobNumberStartingNumber: z.number().int().min(1).optional(),
    defaultJobPriority: z
      .enum(["low", "medium", "high", "critical"])
      .optional(),
    defaultJobStatus: z.string().max(50).optional(),
    autoAssignFromBid: z.boolean().optional(),
    requireApprovalBeforeStart: z.boolean().optional(),
    notifyOnStatusChange: z.boolean().optional(),
    notifyOnCompletion: z.boolean().optional(),
  }),
});

/**
 * ============================================================================
 * INVOICE SETTINGS VALIDATIONS
 * ============================================================================
 */

export const updateInvoiceSettingsSchema = z.object({
  body: z.object({
    invoiceNumberPrefix: z.string().max(20).optional(),
    invoiceNumberStartingNumber: z.number().int().min(1).optional(),
    defaultPaymentTerms: z.string().max(50).optional(),
    defaultPaymentTermsDays: z.number().int().min(0).optional(),
    enableLateFees: z.boolean().optional(),
    lateFeePercentage: z.number().min(0).max(100).optional(),
    lateFeeGracePeriodDays: z.number().int().min(0).optional(),
    showLineItemDetails: z.boolean().optional(),
    showLaborBreakdown: z.boolean().optional(),
    showMaterialsBreakdown: z.boolean().optional(),
    defaultInvoiceNotes: z.string().optional(),
    defaultTermsAndConditions: z.string().optional(),
    autoSendOnCompletion: z.boolean().optional(),
    autoRemindBeforeDue: z.boolean().optional(),
    reminderDaysBeforeDue: z.number().int().min(0).optional(),
  }),
});

/**
 * ============================================================================
 * TAX SETTINGS VALIDATIONS
 * ============================================================================
 */

export const updateTaxSettingsSchema = z.object({
  body: z.object({
    defaultSalesTaxRate: z.number().min(0).max(1).optional(),
    salesTaxLabel: z.string().max(100).optional(),
    taxIncludedInPrice: z.boolean().optional(),
    applyTaxToLabor: z.boolean().optional(),
    applyTaxToMaterials: z.boolean().optional(),
    applyTaxToTravel: z.boolean().optional(),
    allowTaxExempt: z.boolean().optional(),
    requireTaxExemptCertificate: z.boolean().optional(),
    taxJurisdiction: z.string().max(255).optional(),
    taxIdNumber: z.string().max(100).optional(),
  }),
});

/**
 * ============================================================================
 * INVENTORY SETTINGS VALIDATIONS
 * ============================================================================
 */

export const updateInventorySettingsSchema = z.object({
  body: z.object({
    enableLowStockAlerts: z.boolean().optional(),
    defaultLowStockThreshold: z.number().int().min(0).optional(),
    enableAutoReorder: z.boolean().optional(),
    defaultReorderQuantity: z.number().int().min(0).optional(),
    defaultReorderPoint: z.number().int().min(0).optional(),
    trackSerialNumbers: z.boolean().optional(),
    trackLotNumbers: z.boolean().optional(),
    trackExpirationDates: z.boolean().optional(),
    valuationMethod: z.enum(["FIFO", "LIFO", "Average Cost"]).optional(),
    notifyOnLowStock: z.boolean().optional(),
    notifyOnOutOfStock: z.boolean().optional(),
    notifyOnReorderPoint: z.boolean().optional(),
    defaultWeightUnit: z.string().max(20).optional(),
    defaultVolumeUnit: z.string().max(20).optional(),
  }),
});

/**
 * ============================================================================
 * NOTIFICATION SETTINGS VALIDATIONS
 * ============================================================================
 */

export const updateNotificationSettingsSchema = z.object({
  body: z.object({
    enableEmailNotifications: z.boolean().optional(),
    enablePushNotifications: z.boolean().optional(),
    enableSmsNotifications: z.boolean().optional(),
    enableInAppNotifications: z.boolean().optional(),
    notifyOnNewBid: z.boolean().optional(),
    notifyOnBidApproval: z.boolean().optional(),
    notifyOnJobAssignment: z.boolean().optional(),
    notifyOnJobCompletion: z.boolean().optional(),
    notifyOnInvoiceCreated: z.boolean().optional(),
    notifyOnPaymentReceived: z.boolean().optional(),
    notifyOnInventoryLow: z.boolean().optional(),
    notifyOnVehicleMaintenance: z.boolean().optional(),
    notifyOnTimesheetSubmission: z.boolean().optional(),
    notifyOnTimesheetApproval: z.boolean().optional(),
    enableDailyDigest: z.boolean().optional(),
    dailyDigestTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    enableWeeklyDigest: z.boolean().optional(),
    weeklyDigestDay: z.string().max(20).optional(),
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    quietHoursEnd: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
  }),
});

/**
 * ============================================================================
 * USER NOTIFICATION PREFERENCES VALIDATIONS
 * ============================================================================
 */

export const updateUserNotificationPreferencesSchema = z.object({
  body: z.object({
    enableEmailNotifications: z.boolean().optional(),
    enablePushNotifications: z.boolean().optional(),
    enableSmsNotifications: z.boolean().optional(),
    enableInAppNotifications: z.boolean().optional(),
    notifyOnNewBid: z.boolean().optional(),
    notifyOnBidApproval: z.boolean().optional(),
    notifyOnJobAssignment: z.boolean().optional(),
    notifyOnJobCompletion: z.boolean().optional(),
    notifyOnInvoiceCreated: z.boolean().optional(),
    notifyOnPaymentReceived: z.boolean().optional(),
    notifyOnInventoryLow: z.boolean().optional(),
    notifyOnVehicleMaintenance: z.boolean().optional(),
    notifyOnTimesheetSubmission: z.boolean().optional(),
    notifyOnTimesheetApproval: z.boolean().optional(),
    enableDailyDigest: z.boolean().optional(),
    dailyDigestTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    enableWeeklyDigest: z.boolean().optional(),
    weeklyDigestDay: z.string().max(20).optional(),
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    quietHoursEnd: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
  }),
});
