import { db } from "../config/db.js";
import {
  companySettings,
  announcementSettings,
  laborRateTemplates,
  vehicleTravelDefaults,
  travelOrigins,
  operatingExpenseDefaults,
  jobSettings,
  invoiceSettings,
  taxSettings,
  inventorySettings,
  notificationSettings,
  userNotificationPreferences,
} from "../drizzle/schema/settings.schema.js";
import { positions } from "../drizzle/schema/org.schema.js";
import { eq, and, desc } from "drizzle-orm";

/**
 * ============================================================================
 * COMPANY / GENERAL SETTINGS
 * ============================================================================
 */

export const getCompanySettings = async () => {
  const [settings] = await db.select().from(companySettings).limit(1);

  // If no settings exist, create default
  if (!settings) {
    const [newSettings] = await db
      .insert(companySettings)
      .values({})
      .returning();
    return newSettings;
  }

  return settings;
};

export const updateCompanySettings = async (data: any, userId?: string) => {
  const existing = await getCompanySettings();
  if (!existing) throw new Error("Company settings not found");

  const [updated] = await db
    .update(companySettings)
    .set({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(companySettings.id, existing.id))
    .returning();

  return updated;
};

/**
 * ============================================================================
 * ANNOUNCEMENT SETTINGS
 * ============================================================================
 */

export const getAnnouncementSettings = async () => {
  const [settings] = await db.select().from(announcementSettings).limit(1);

  // If no settings exist, create default
  if (!settings) {
    const [newSettings] = await db
      .insert(announcementSettings)
      .values({})
      .returning();
    return newSettings;
  }

  return settings;
};

export const updateAnnouncementSettings = async (
  data: any,
  userId?: string,
) => {
  const existing = await getAnnouncementSettings();
  if (!existing) throw new Error("Announcement settings not found");

  const [updated] = await db
    .update(announcementSettings)
    .set({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(announcementSettings.id, existing.id))
    .returning();

  return updated;
};

/**
 * ============================================================================
 * LABOR RATE TEMPLATES
 * ============================================================================
 */

export const getLaborRates = async () => {
  // Join with positions to get position details
  const rates = await db
    .select({
      id: laborRateTemplates.id,
      positionId: laborRateTemplates.positionId,
      positionName: positions.name,
      defaultQuantity: laborRateTemplates.defaultQuantity,
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
  // Get all positions
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
 * VEHICLE & TRAVEL DEFAULTS
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
  if (!existing) throw new Error("Vehicle travel defaults not found");

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
 * TRAVEL ORIGINS
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
    page: params?.page || 1,
    limit: params?.limit || origins.length,
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
    fullAddress = [
      data.addressLine1 || existing?.addressLine1,
      data.addressLine2 || existing?.addressLine2,
      `${data.city || existing?.city}, ${data.state || existing?.state} ${data.zipCode || existing?.zipCode}`,
      data.country || existing?.country || "USA",
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
 * OPERATING EXPENSE DEFAULTS (Financial)
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
 * JOB SETTINGS
 * ============================================================================
 */

export const getJobSettings = async () => {
  const [settings] = await db.select().from(jobSettings).limit(1);

  // If no settings exist, create default
  if (!settings) {
    const [newSettings] = await db.insert(jobSettings).values({}).returning();
    return newSettings;
  }

  return settings;
};

export const updateJobSettings = async (data: any, userId?: string) => {
  const existing = await getJobSettings();
  if (!existing) throw new Error("Job settings not found");

  const [updated] = await db
    .update(jobSettings)
    .set({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(jobSettings.id, existing.id))
    .returning();

  return updated;
};

/**
 * ============================================================================
 * INVOICE SETTINGS
 * ============================================================================
 */

export const getInvoiceSettings = async () => {
  const [settings] = await db.select().from(invoiceSettings).limit(1);

  // If no settings exist, create default
  if (!settings) {
    const [newSettings] = await db
      .insert(invoiceSettings)
      .values({})
      .returning();
    return newSettings;
  }

  return settings;
};

export const updateInvoiceSettings = async (data: any, userId?: string) => {
  const existing = await getInvoiceSettings();
  if (!existing) throw new Error("Invoice settings not found");

  const [updated] = await db
    .update(invoiceSettings)
    .set({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(invoiceSettings.id, existing.id))
    .returning();

  return updated;
};

/**
 * ============================================================================
 * TAX SETTINGS
 * ============================================================================
 */

export const getTaxSettings = async () => {
  const [settings] = await db.select().from(taxSettings).limit(1);

  // If no settings exist, create default
  if (!settings) {
    const [newSettings] = await db.insert(taxSettings).values({}).returning();
    return newSettings;
  }

  return settings;
};

export const updateTaxSettings = async (data: any, userId?: string) => {
  const existing = await getTaxSettings();
  if (!existing) throw new Error("Tax settings not found");

  const [updated] = await db
    .update(taxSettings)
    .set({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(taxSettings.id, existing.id))
    .returning();

  return updated;
};

/**
 * ============================================================================
 * INVENTORY SETTINGS
 * ============================================================================
 */

export const getInventorySettings = async () => {
  const [settings] = await db.select().from(inventorySettings).limit(1);

  // If no settings exist, create default
  if (!settings) {
    const [newSettings] = await db
      .insert(inventorySettings)
      .values({})
      .returning();
    return newSettings;
  }

  return settings;
};

export const updateInventorySettings = async (data: any, userId?: string) => {
  const existing = await getInventorySettings();
  if (!existing) throw new Error("Inventory settings not found");

  const [updated] = await db
    .update(inventorySettings)
    .set({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(inventorySettings.id, existing.id))
    .returning();

  return updated;
};

/**
 * ============================================================================
 * NOTIFICATION SETTINGS (System-wide)
 * ============================================================================
 */

export const getNotificationSettings = async () => {
  const [settings] = await db.select().from(notificationSettings).limit(1);

  // If no settings exist, create default
  if (!settings) {
    const [newSettings] = await db
      .insert(notificationSettings)
      .values({})
      .returning();
    return newSettings;
  }

  return settings;
};

export const updateNotificationSettings = async (
  data: any,
  userId?: string,
) => {
  const existing = await getNotificationSettings();
  if (!existing) throw new Error("Notification settings not found");

  const [updated] = await db
    .update(notificationSettings)
    .set({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(notificationSettings.id, existing.id))
    .returning();

  return updated;
};

/**
 * ============================================================================
 * USER NOTIFICATION PREFERENCES (Per-user)
 * ============================================================================
 */

export const getUserNotificationPreferences = async (userId: string) => {
  const [preferences] = await db
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userId, userId))
    .limit(1);

  // If no preferences exist, create default (inherits from system settings)
  if (!preferences) {
    const [newPreferences] = await db
      .insert(userNotificationPreferences)
      .values({ userId })
      .returning();
    return newPreferences;
  }

  return preferences;
};

export const updateUserNotificationPreferences = async (
  userId: string,
  data: any,
) => {
  const _existing = await getUserNotificationPreferences(userId);

  const [updated] = await db
    .update(userNotificationPreferences)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(userNotificationPreferences.userId, userId))
    .returning();

  return updated;
};
