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
import { eq, and, desc, asc, count } from "drizzle-orm";

/** Short TTL read cache for settings GETs (cleared on any settings write). */
const SETTINGS_READ_CACHE_TTL_MS = parseInt(
  process.env.SETTINGS_READ_CACHE_TTL_MS || "30000",
  10,
);

const settingsReadCache = new Map<
  string,
  { expiresAt: number; data: unknown }
>();

export function bumpSettingsReadCache(): void {
  settingsReadCache.clear();
}

async function cachedSettingsRead<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  if (SETTINGS_READ_CACHE_TTL_MS <= 0) {
    return loader();
  }
  const now = Date.now();
  const hit = settingsReadCache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.data as T;
  }
  const data = await loader();
  settingsReadCache.set(key, {
    expiresAt: now + SETTINGS_READ_CACHE_TTL_MS,
    data,
  });
  return data;
}

/**
 * ============================================================================
 * GENERAL TAB - GENERAL SETTINGS (Company Info + Announcements)
 * ============================================================================
 */

export const getGeneralSettings = async () => {
  return cachedSettingsRead("general", async () => {
    const [settings] = await db.select().from(generalSettings).limit(1);

    if (!settings) {
      const [newSettings] = await db
        .insert(generalSettings)
        .values({})
        .returning();
      return newSettings;
    }

    return settings;
  });
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

  bumpSettingsReadCache();
  return updated;
};

/**
 * ============================================================================
 * LABOR ROLES TAB - LABOR RATE TEMPLATES
 * ============================================================================
 */

export const getLaborRates = async () => {
  return cachedSettingsRead("laborRates", async () => {
    const rates = await db
      .select({
        id: laborRateTemplates.id,
        positionId: laborRateTemplates.positionId,
        position: positions.name,
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
  });
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
  bumpSettingsReadCache();
  return await getLaborRateById(id);
};

/** Delete a labor_rate_templates record by id. Returns true if deleted, false if not found. */
export const deleteLaborRate = async (id: string) => {
  const [deleted] = await db
    .delete(laborRateTemplates)
    .where(eq(laborRateTemplates.id, id))
    .returning({ id: laborRateTemplates.id });
  if (deleted != null) bumpSettingsReadCache();
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
  if (client === db) bumpSettingsReadCache();
  return created;
};

export const upsertLaborRate = async (
  positionId: number,
  data: any,
  userId?: string,
) => {
  const existing = await getLaborRateByPosition(positionId);

  if (existing) {
    const [updated] = await db
      .update(laborRateTemplates)
      .set({
        ...data,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(laborRateTemplates.positionId, positionId))
      .returning();
    bumpSettingsReadCache();
    return updated;
  }
  const [created] = await db
    .insert(laborRateTemplates)
    .values({
      positionId,
      ...data,
      updatedBy: userId,
    })
    .returning();
  bumpSettingsReadCache();
  return created;
};

export const bulkApplyLaborRates = async (data: any, userId?: string) => {
  const allPositions = await db
    .select()
    .from(positions)
    .where(eq(positions.isActive, true));

  const results = await Promise.all(
    allPositions.map((position) => upsertLaborRate(position.id, data, userId)),
  );

  bumpSettingsReadCache();
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
  return cachedSettingsRead("vehicleTravelDefaults", async () => {
    const [settings] = await db.select().from(vehicleTravelDefaults).limit(1);

    if (!settings) {
      const [newSettings] = await db
        .insert(vehicleTravelDefaults)
        .values({})
        .returning();
      return newSettings;
    }

    return settings;
  });
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

  bumpSettingsReadCache();
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
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 50;
  const cacheKey = `travelOrigins:${page}:${limit}:${params?.isActive ?? "all"}`;

  return cachedSettingsRead(cacheKey, async () => {
    const offset = (page - 1) * limit;

    const conditions = [eq(travelOrigins.isDeleted, false)];
    if (params?.isActive !== undefined) {
      conditions.push(eq(travelOrigins.isActive, params.isActive));
    }

    const [totalResult, origins] = await Promise.all([
      db
        .select({ count: count() })
        .from(travelOrigins)
        .where(and(...conditions)),
      db
        .select()
        .from(travelOrigins)
        .where(and(...conditions))
        .orderBy(desc(travelOrigins.isDefault), travelOrigins.name)
        .limit(limit)
        .offset(offset),
    ]);

    return {
      data: origins,
      total: totalResult[0]?.count ?? 0,
      page,
      limit,
    };
  });
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
  // When creating with isDefault: true, unset all other defaults first (only one default allowed).
  if (data.isDefault === true) {
    await db
      .update(travelOrigins)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(travelOrigins.isDefault, true));
  }

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

  bumpSettingsReadCache();
  return created;
};

export const updateTravelOrigin = async (
  id: string,
  data: any,
  userId?: string,
) => {
  // When setting this origin as default, unset all other defaults first (only one default allowed).
  if (data.isDefault === true) {
    await db
      .update(travelOrigins)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(travelOrigins.isDefault, true));
  }

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

  bumpSettingsReadCache();
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

  bumpSettingsReadCache();
  return { success: true };
};

export const setDefaultTravelOrigin = async (id: string) => {
  await db
    .update(travelOrigins)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(travelOrigins.isDefault, true));

  const [updated] = await db
    .update(travelOrigins)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(travelOrigins.id, id))
    .returning();

  bumpSettingsReadCache();
  return updated;
};

/**
 * ============================================================================
 * OPERATING EXPENSES TAB
 * ============================================================================
 */

export const getOperatingExpenseDefaults = async () => {
  return cachedSettingsRead("operatingExpenseDefaults", async () => {
    const [settings] = await db.select().from(operatingExpenseDefaults).limit(1);

    if (!settings) {
      const [newSettings] = await db
        .insert(operatingExpenseDefaults)
        .values({})
        .returning();
      return newSettings;
    }

    return settings;
  });
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

  bumpSettingsReadCache();
  return updated;
};

/**
 * ============================================================================
 * PROPOSAL TEMPLATES TAB - PROPOSAL BASIS TEMPLATES
 * ============================================================================
 */

export const getProposalBasisTemplates = async () => {
  return cachedSettingsRead("proposalBasisTemplates", async () => {
    const templates = await db
      .select()
      .from(proposalBasisTemplates)
      .where(eq(proposalBasisTemplates.isDeleted, false))
      .orderBy(
        asc(proposalBasisTemplates.sortOrder),
        asc(proposalBasisTemplates.label),
      );

    return templates;
  });
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

  bumpSettingsReadCache();
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

  bumpSettingsReadCache();
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

  bumpSettingsReadCache();
  return { success: true };
};

/**
 * ============================================================================
 * PROPOSAL TEMPLATES TAB - TERMS & CONDITIONS TEMPLATES
 * ============================================================================
 */

export const getTermsConditionsTemplates = async () => {
  return cachedSettingsRead("termsConditionsTemplates", async () => {
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
  });
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

  bumpSettingsReadCache();
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

  bumpSettingsReadCache();
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

  bumpSettingsReadCache();
  return { success: true };
};

export const setDefaultTermsConditionsTemplate = async (id: string) => {
  await db
    .update(termsConditionsTemplates)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(termsConditionsTemplates.isDefault, true));

  const [updated] = await db
    .update(termsConditionsTemplates)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(termsConditionsTemplates.id, id))
    .returning();

  bumpSettingsReadCache();
  return updated;
};

/**
 * ============================================================================
 * INVOICE SETTINGS (system-wide) - Default content, terms, display, automation, email
 * ============================================================================
 */

export const getInvoiceSettings = async () => {
  return cachedSettingsRead("invoiceSettings", async () => {
    const [row] = await db.select().from(invoiceSettings).limit(1);

    if (row) return row;

    const [inserted] = await db.insert(invoiceSettings).values({}).returning();

    return inserted ?? null;
  });
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

  bumpSettingsReadCache();
  return updated ?? null;
};
