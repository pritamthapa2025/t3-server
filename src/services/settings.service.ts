import { db } from "../config/db.js";
import {
  generalSettings,
  laborRateTemplates,
  vehicleTravelDefaults,
  travelOrigins,
  operatingExpenseDefaults,
  proposalBasisTemplates,
  termsConditionsTemplates,
} from "../drizzle/schema/settings.schema.js";
import { invoiceSettings } from "../drizzle/schema/settings.schema.js";
import { positions } from "../drizzle/schema/org.schema.js";
import { eq, and, desc, asc } from "drizzle-orm";

/**
 * ============================================================================
 * GENERAL TAB - GENERAL SETTINGS (Company Info + Announcements)
 * ============================================================================
 */

export const getGeneralSettings = async () => {
  const [settings] = await db.select().from(generalSettings).limit(1);

  // If no settings exist, create default
  if (!settings) {
    const [newSettings] = await db
      .insert(generalSettings)
      .values({})
      .returning();
    return newSettings;
  }

  return settings;
};

export const updateGeneralSettings = async (data: any, userId?: string) => {
  const existing = await getGeneralSettings();
  if (!existing) throw new Error("General settings not found");

  const [updated] = await db
    .update(generalSettings)
    .set({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(generalSettings.id, existing.id))
    .returning();

  return updated;
};

/**
 * ============================================================================
 * LABOR ROLES TAB - LABOR RATE TEMPLATES
 * ============================================================================
 */

export const getLaborRates = async () => {
  // Join with positions to get position details
  const rates = await db
    .select({
      id: laborRateTemplates.id,
      positionId: laborRateTemplates.positionId,
      position: positions.name, // Position name as string (matches frontend)
      defaultDays: laborRateTemplates.defaultDays,
      defaultHoursPerDay: laborRateTemplates.defaultHoursPerDay,
      defaultCostRate: laborRateTemplates.defaultCostRate,
      defaultBillableRate: laborRateTemplates.defaultBillableRate,
      createdAt: laborRateTemplates.createdAt,
      updatedAt: laborRateTemplates.updatedAt,
    })
    .from(laborRateTemplates)
    .leftJoin(positions, eq(laborRateTemplates.positionId, positions.id))
    .orderBy(positions.name);

  return rates;
};

export const getLaborRateByPosition = async (positionId: number) => {
  const [rate] = await db
    .select()
    .from(laborRateTemplates)
    .where(eq(laborRateTemplates.positionId, positionId))
    .limit(1);

  return rate || null;
};

/** Get a labor rate template by its primary key (uuid). */
export const getLaborRateById = async (id: string) => {
  const [rate] = await db
    .select({
      id: laborRateTemplates.id,
      positionId: laborRateTemplates.positionId,
      position: positions.name,
      defaultDays: laborRateTemplates.defaultDays,
      defaultHoursPerDay: laborRateTemplates.defaultHoursPerDay,
      defaultCostRate: laborRateTemplates.defaultCostRate,
      defaultBillableRate: laborRateTemplates.defaultBillableRate,
      updatedBy: laborRateTemplates.updatedBy,
      createdAt: laborRateTemplates.createdAt,
      updatedAt: laborRateTemplates.updatedAt,
    })
    .from(laborRateTemplates)
    .leftJoin(positions, eq(laborRateTemplates.positionId, positions.id))
    .where(eq(laborRateTemplates.id, id))
    .limit(1);

  return rate || null;
};

/** Update a labor_rate_templates record by id. Only updates existing record. */
export const updateLaborRate = async (
  id: string,
  data: {
    defaultDays?: number;
    defaultHoursPerDay?: string | number;
    defaultCostRate?: string | number;
    defaultBillableRate?: string | number;
  },
  userId?: string,
) => {
  const setPayload: Record<string, unknown> = {
    updatedBy: userId,
    updatedAt: new Date(),
  };
  if (data.defaultDays !== undefined) setPayload.defaultDays = data.defaultDays;
  if (data.defaultHoursPerDay !== undefined)
    setPayload.defaultHoursPerDay = String(data.defaultHoursPerDay);
  if (data.defaultCostRate !== undefined)
    setPayload.defaultCostRate = String(data.defaultCostRate);
  if (data.defaultBillableRate !== undefined)
    setPayload.defaultBillableRate = String(data.defaultBillableRate);

  const [updated] = await db
    .update(laborRateTemplates)
    .set(setPayload as typeof laborRateTemplates.$inferInsert)
    .where(eq(laborRateTemplates.id, id))
    .returning();

  if (!updated) return null;
  return await getLaborRateById(id);
};

/** Delete a labor_rate_templates record by id. Returns true if deleted, false if not found. */
export const deleteLaborRate = async (id: string) => {
  const [deleted] = await db
    .delete(laborRateTemplates)
    .where(eq(laborRateTemplates.id, id))
    .returning({ id: laborRateTemplates.id });
  return deleted != null;
};

/**
 * Create a labor rate template for a newly created position.
 * Called automatically when a position is created (position API or department API).
 * Uses schema defaults for defaultDays, defaultHoursPerDay, defaultCostRate, defaultBillableRate.
 */
export const createLaborRateTemplateForPosition = async (
  positionId: number,
  userId?: string,
  client: typeof db = db,
) => {
  const [created] = await client
    .insert(laborRateTemplates)
    .values({
      positionId,
      updatedBy: userId,
    })
    .returning();
  return created;
};

export const upsertLaborRate = async (
  positionId: number,
  data: any,
  userId?: string,
) => {
  const existing = await getLaborRateByPosition(positionId);

  if (existing) {
    // Update existing
    const [updated] = await db
      .update(laborRateTemplates)
      .set({
        ...data,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(laborRateTemplates.positionId, positionId))
      .returning();
    return updated;
  } else {
    // Insert new
    const [created] = await db
      .insert(laborRateTemplates)
      .values({
        positionId,
        ...data,
        updatedBy: userId,
      })
      .returning();
    return created;
  }
};

export const bulkApplyLaborRates = async (data: any, userId?: string) => {
  // Get all active positions
  const allPositions = await db
    .select()
    .from(positions)
    .where(eq(positions.isActive, true));

  const results = [];
  for (const position of allPositions) {
    const result = await upsertLaborRate(position.id, data, userId);
    results.push(result);
  }

  return {
    message: `Labor rate defaults applied to ${results.length} positions`,
    count: results.length,
  };
};

/**
 * ============================================================================
 * VEHICLE & TRAVEL TAB - VEHICLE/TRAVEL DEFAULTS
 * ============================================================================
 */

export const getVehicleTravelDefaults = async () => {
  const [settings] = await db.select().from(vehicleTravelDefaults).limit(1);

  // If no settings exist, create default
  if (!settings) {
    const [newSettings] = await db
      .insert(vehicleTravelDefaults)
      .values({})
      .returning();
    return newSettings;
  }

  return settings;
};

export const updateVehicleTravelDefaults = async (
  data: any,
  userId?: string,
) => {
  const existing = await getVehicleTravelDefaults();
  if (!existing) throw new Error("Vehicle/travel defaults not found");

  const [updated] = await db
    .update(vehicleTravelDefaults)
    .set({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(vehicleTravelDefaults.id, existing.id))
    .returning();

  return updated;
};

/**
 * ============================================================================
 * VEHICLE & TRAVEL TAB - TRAVEL ORIGINS
 * ============================================================================
 */

export const getTravelOrigins = async (params?: {
  page?: number;
  limit?: number;
  isActive?: boolean;
}) => {
  const conditions = [eq(travelOrigins.isDeleted, false)];
  if (params?.isActive !== undefined) {
    conditions.push(eq(travelOrigins.isActive, params.isActive));
  }

  const origins = await db
    .select()
    .from(travelOrigins)
    .where(and(...conditions))
    .orderBy(desc(travelOrigins.isDefault), travelOrigins.name);

  return {
    data: origins,
    total: origins.length,
    page: params?.page ?? 1,
    limit: params?.limit ?? origins.length,
  };
};

export const getTravelOriginById = async (id: string) => {
  const [origin] = await db
    .select()
    .from(travelOrigins)
    .where(and(eq(travelOrigins.id, id), eq(travelOrigins.isDeleted, false)))
    .limit(1);

  return origin || null;
};

export const createTravelOrigin = async (data: any, userId?: string) => {
  // Build full address
  const fullAddress = [
    data.addressLine1,
    data.addressLine2,
    `${data.city}, ${data.state} ${data.zipCode}`,
    data.country || "USA",
  ]
    .filter(Boolean)
    .join(", ");

  const [created] = await db
    .insert(travelOrigins)
    .values({
      ...data,
      fullAddress,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  return created;
};

export const updateTravelOrigin = async (
  id: string,
  data: any,
  userId?: string,
) => {
  // Build full address if address fields provided
  let fullAddress;
  if (data.addressLine1 || data.city || data.state || data.zipCode) {
    const existing = await getTravelOriginById(id);
    if (!existing) throw new Error("Travel origin not found");
    fullAddress = [
      data.addressLine1 || existing.addressLine1,
      data.addressLine2 || existing.addressLine2,
      `${data.city || existing.city}, ${data.state || existing.state} ${data.zipCode || existing.zipCode}`,
      data.country || existing.country || "USA",
    ]
      .filter(Boolean)
      .join(", ");
  }

  const [updated] = await db
    .update(travelOrigins)
    .set({
      ...data,
      ...(fullAddress && { fullAddress }),
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(travelOrigins.id, id))
    .returning();

  return updated;
};

export const deleteTravelOrigin = async (id: string) => {
  await db
    .update(travelOrigins)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(eq(travelOrigins.id, id));

  return { success: true };
};

export const setDefaultTravelOrigin = async (id: string) => {
  // First, unset all defaults
  await db
    .update(travelOrigins)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(travelOrigins.isDefault, true));

  // Then set the new default
  const [updated] = await db
    .update(travelOrigins)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(travelOrigins.id, id))
    .returning();

  return updated;
};

/**
 * ============================================================================
 * OPERATING EXPENSES TAB
 * ============================================================================
 */

export const getOperatingExpenseDefaults = async () => {
  const [settings] = await db.select().from(operatingExpenseDefaults).limit(1);

  // If no settings exist, create default
  if (!settings) {
    const [newSettings] = await db
      .insert(operatingExpenseDefaults)
      .values({})
      .returning();
    return newSettings;
  }

  return settings;
};

export const updateOperatingExpenseDefaults = async (
  data: any,
  userId?: string,
) => {
  const existing = await getOperatingExpenseDefaults();
  if (!existing) throw new Error("Operating expense defaults not found");

  const [updated] = await db
    .update(operatingExpenseDefaults)
    .set({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(operatingExpenseDefaults.id, existing.id))
    .returning();

  return updated;
};

/**
 * ============================================================================
 * PROPOSAL TEMPLATES TAB - PROPOSAL BASIS TEMPLATES
 * ============================================================================
 */

export const getProposalBasisTemplates = async () => {
  const templates = await db
    .select()
    .from(proposalBasisTemplates)
    .where(eq(proposalBasisTemplates.isDeleted, false))
    .orderBy(
      asc(proposalBasisTemplates.sortOrder),
      asc(proposalBasisTemplates.label),
    );

  return templates;
};

export const getProposalBasisTemplateById = async (id: string) => {
  const [template] = await db
    .select()
    .from(proposalBasisTemplates)
    .where(
      and(
        eq(proposalBasisTemplates.id, id),
        eq(proposalBasisTemplates.isDeleted, false),
      ),
    )
    .limit(1);

  return template || null;
};

export const createProposalBasisTemplate = async (
  data: any,
  userId?: string,
) => {
  const [created] = await db
    .insert(proposalBasisTemplates)
    .values({
      ...data,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  return created;
};

export const updateProposalBasisTemplate = async (
  id: string,
  data: any,
  userId?: string,
) => {
  const [updated] = await db
    .update(proposalBasisTemplates)
    .set({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(proposalBasisTemplates.id, id))
    .returning();

  return updated;
};

export const deleteProposalBasisTemplate = async (id: string) => {
  await db
    .update(proposalBasisTemplates)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(eq(proposalBasisTemplates.id, id));

  return { success: true };
};

/**
 * ============================================================================
 * PROPOSAL TEMPLATES TAB - TERMS & CONDITIONS TEMPLATES
 * ============================================================================
 */

export const getTermsConditionsTemplates = async () => {
  const templates = await db
    .select()
    .from(termsConditionsTemplates)
    .where(eq(termsConditionsTemplates.isDeleted, false))
    .orderBy(
      desc(termsConditionsTemplates.isDefault),
      asc(termsConditionsTemplates.sortOrder),
      asc(termsConditionsTemplates.label),
    );

  return templates;
};

export const getTermsConditionsTemplateById = async (id: string) => {
  const [template] = await db
    .select()
    .from(termsConditionsTemplates)
    .where(
      and(
        eq(termsConditionsTemplates.id, id),
        eq(termsConditionsTemplates.isDeleted, false),
      ),
    )
    .limit(1);

  return template || null;
};

export const createTermsConditionsTemplate = async (
  data: any,
  userId?: string,
) => {
  const [created] = await db
    .insert(termsConditionsTemplates)
    .values({
      ...data,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  return created;
};

export const updateTermsConditionsTemplate = async (
  id: string,
  data: any,
  userId?: string,
) => {
  const [updated] = await db
    .update(termsConditionsTemplates)
    .set({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(termsConditionsTemplates.id, id))
    .returning();

  return updated;
};

export const deleteTermsConditionsTemplate = async (id: string) => {
  await db
    .update(termsConditionsTemplates)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(eq(termsConditionsTemplates.id, id));

  return { success: true };
};

export const setDefaultTermsConditionsTemplate = async (id: string) => {
  // First, unset all defaults
  await db
    .update(termsConditionsTemplates)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(termsConditionsTemplates.isDefault, true));

  // Then set the new default
  const [updated] = await db
    .update(termsConditionsTemplates)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(termsConditionsTemplates.id, id))
    .returning();

  return updated;
};

/**
 * ============================================================================
 * INVOICE SETTINGS (system-wide) - Default content, terms, display, automation, email
 * ============================================================================
 */

export const getInvoiceSettings = async () => {
  const [row] = await db
    .select()
    .from(invoiceSettings)
    .limit(1);

  if (row) return row;

  const [inserted] = await db.insert(invoiceSettings).values({}).returning();

  return inserted ?? null;
};

export const updateInvoiceSettings = async (
  data: Partial<{
    defaultPaymentTerms: string;
    defaultPaymentTermsDays: number;
    defaultTaxRate: string;
    enableLateFees: boolean;
    lateFeePercentage: string;
    lateFeeGracePeriodDays: number;
    showLineItemDetails: boolean;
    showLaborBreakdown: boolean;
    showMaterialsBreakdown: boolean;
    defaultInvoiceNotes: string | null;
    defaultTermsAndConditions: string | null;
    autoSendOnCompletion: boolean;
    autoRemindBeforeDue: boolean;
    reminderDaysBeforeDue: number;
    defaultEmailSubject: string | null;
    defaultEmailMessage: string | null;
    alwaysAttachPdf: boolean;
  }>,
  updatedBy?: string,
) => {
  const existing = await getInvoiceSettings();
  if (!existing) return null;

  const [updated] = await db
    .update(invoiceSettings)
    .set({
      ...data,
      updatedBy: updatedBy ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(invoiceSettings.id, existing.id))
    .returning();

  return updated ?? null;
};
