import { count, eq, and, desc, ilike, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import {
  inventoryItems,
  inventoryStockAlerts,
  inventoryCounts,
  inventoryCountItems,
  inventoryCategories,
  inventoryLocations,
} from "../../drizzle/schema/inventory.schema.js";

// ============================
// Dashboard & Reports
// ============================

export const getDashboardSummary = async () => {
  // Get total items count
  const totalItems = await db
    .select({ count: count() })
    .from(inventoryItems)
    .where(eq(inventoryItems.isDeleted, false));

  // Get items by status
  const lowStockItems = await db
    .select({ count: count() })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.status, "low_stock"),
        eq(inventoryItems.isDeleted, false),
      ),
    );

  const outOfStockItems = await db
    .select({ count: count() })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.status, "out_of_stock"),
        eq(inventoryItems.isDeleted, false),
      ),
    );

  // Get total inventory value
  const totalValue = await db
    .select({
      value: sql<string>`COALESCE(SUM(CAST(${inventoryItems.quantityOnHand} AS NUMERIC) * CAST(${inventoryItems.unitCost} AS NUMERIC)), 0)`,
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.isDeleted, false));

  // Get unresolved alerts
  const unresolvedAlerts = await db
    .select({ count: count() })
    .from(inventoryStockAlerts)
    .where(eq(inventoryStockAlerts.isResolved, false));

  return {
    totalItems: totalItems[0]?.count ?? 0,
    lowStockItems: lowStockItems[0]?.count ?? 0,
    outOfStockItems: outOfStockItems[0]?.count ?? 0,
    totalInventoryValue: totalValue[0]?.value ?? "0",
    unresolvedAlerts: unresolvedAlerts[0]?.count ?? 0,
  };
};

export const getStatsByCategory = async () => {
  const stats = await db
    .select({
      categoryId: inventoryItems.categoryId,
      categoryName: inventoryCategories.name,
      itemCount: count(inventoryItems.id),
    })
    .from(inventoryItems)
    .leftJoin(
      inventoryCategories,
      eq(inventoryItems.categoryId, inventoryCategories.id),
    )
    .where(eq(inventoryItems.isDeleted, false))
    .groupBy(inventoryItems.categoryId, inventoryCategories.name);

  return stats;
};

export const getStatsByLocation = async () => {
  const stats = await db
    .select({
      locationId: inventoryItems.primaryLocationId,
      locationName: inventoryLocations.name,
      itemCount: count(inventoryItems.id),
    })
    .from(inventoryItems)
    .leftJoin(
      inventoryLocations,
      eq(inventoryItems.primaryLocationId, inventoryLocations.id),
    )
    .where(eq(inventoryItems.isDeleted, false))
    .groupBy(inventoryItems.primaryLocationId, inventoryLocations.name);

  return stats;
};

export const getStatsByStatus = async () => {
  const stats = await db
    .select({
      status: inventoryItems.status,
      count: count(inventoryItems.id),
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.isDeleted, false))
    .groupBy(inventoryItems.status);

  return stats;
};

// ============================
// Stock Alerts
// ============================

export const getAlerts = async () => {
  const result = await db
    .select({
      alert: inventoryStockAlerts,
      item: inventoryItems,
    })
    .from(inventoryStockAlerts)
    .leftJoin(
      inventoryItems,
      eq(inventoryStockAlerts.itemId, inventoryItems.id),
    )
    .orderBy(desc(inventoryStockAlerts.createdAt));

  return result.map((r) => ({ ...r.alert, item: r.item }));
};

export const getUnresolvedAlerts = async () => {
  const result = await db
    .select({
      alert: inventoryStockAlerts,
      item: inventoryItems,
    })
    .from(inventoryStockAlerts)
    .leftJoin(
      inventoryItems,
      eq(inventoryStockAlerts.itemId, inventoryItems.id),
    )
    .where(eq(inventoryStockAlerts.isResolved, false))
    .orderBy(desc(inventoryStockAlerts.createdAt));

  return result.map((r) => ({ ...r.alert, item: r.item }));
};

export const acknowledgeAlert = async (id: string, userId: string) => {
  const [acknowledgedAlert] = await db
    .update(inventoryStockAlerts)
    .set({
      isAcknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
    })
    .where(eq(inventoryStockAlerts.id, id))
    .returning();

  if (!acknowledgedAlert) throw new Error("Alert not found");

  return acknowledgedAlert;
};

export const resolveAlert = async (
  id: string,
  data: { resolutionNotes?: string },
  userId: string,
) => {
  const [resolvedAlert] = await db
    .update(inventoryStockAlerts)
    .set({
      isResolved: true,
      resolvedBy: userId,
      resolvedAt: new Date(),
      resolutionNotes: data.resolutionNotes,
    })
    .where(eq(inventoryStockAlerts.id, id))
    .returning();

  if (!resolvedAlert) throw new Error("Alert not found");

  return resolvedAlert;
};

export const triggerAlertCheck = async () => {
  const itemsToCheck = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.isDeleted, false));

  let alertsCreated = 0;

  for (const item of itemsToCheck) {
    const qtyOnHand = parseFloat(item.quantityOnHand);
    const reorderLevel = parseFloat(item.reorderLevel);

    if (qtyOnHand <= reorderLevel) {
      const existingAlert = await db
        .select()
        .from(inventoryStockAlerts)
        .where(
          and(
            eq(inventoryStockAlerts.itemId, item.id),
            eq(inventoryStockAlerts.isResolved, false),
          ),
        )
        .limit(1);

      if (existingAlert.length === 0) {
        await db.insert(inventoryStockAlerts).values({
          itemId: item.id,
          alertType: qtyOnHand === 0 ? "out_of_stock" : "low_stock",
          severity: qtyOnHand === 0 ? "critical" : "warning", // Required field
          currentQuantity: item.quantityOnHand,
          message:
            qtyOnHand === 0
              ? `Item ${item.name} is out of stock`
              : `Item ${item.name} is below reorder level (${qtyOnHand} <= ${reorderLevel})`,
          isAcknowledged: false,
          isResolved: false,
        });
        alertsCreated++;
      }
    }
  }

  return { alertsCreated };
};

// ============================
// Inventory Counts
// ============================

export const generateCountNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `CNT-${year}-`;

  const lastCount = await db
    .select({ countNumber: inventoryCounts.countNumber })
    .from(inventoryCounts)
    .where(ilike(inventoryCounts.countNumber, `${prefix}%`))
    .orderBy(desc(inventoryCounts.countNumber))
    .limit(1);

  if (lastCount.length === 0) {
    return `${prefix}0001`;
  }

  const lastNumber = parseInt(
    lastCount[0]!.countNumber.split("-").pop() || "0",
  );
  const nextNumber = (lastNumber + 1).toString().padStart(4, "0");
  return `${prefix}${nextNumber}`;
};

export const getCounts = async () => {
  const result = await db
    .select({
      count: inventoryCounts,
      location: inventoryLocations,
    })
    .from(inventoryCounts)
    .leftJoin(
      inventoryLocations,
      eq(inventoryCounts.locationId, inventoryLocations.id),
    )
    .orderBy(desc(inventoryCounts.countDate));

  return result.map((r) => ({
    ...r.count,
    location: r.location,
  }));
};

export const getCountById = async (id: string) => {
  const result = await db
    .select({
      count: inventoryCounts,
      location: inventoryLocations,
    })
    .from(inventoryCounts)
    .leftJoin(
      inventoryLocations,
      eq(inventoryCounts.locationId, inventoryLocations.id),
    )
    .where(eq(inventoryCounts.id, id))
    .limit(1);

  if (result.length === 0) return null;

  const items = await getCountItems(id);

  return {
    ...result[0]!.count!,
    location: result[0]!.location,
    items: items.data,
  };
};

export const createCount = async (data: any, _userId: string) => {
  const countNumber = await generateCountNumber();

  const [newCount] = await db
    .insert(inventoryCounts)
    .values({
      countNumber,
      countType: data.countType || "cycle", // Required field
      locationId: data.locationId,
      countDate: data.countDate || new Date().toISOString().split("T")[0], // Required field
      status: "planned",
      notes: data.notes,
    })
    .returning();

  return newCount!;
};

export const updateCount = async (
  id: string,
  data: { status?: string; notes?: string },
) => {
  const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.notes !== undefined) updatePayload.notes = data.notes;

  const [updated] = await db
    .update(inventoryCounts)
    .set(updatePayload as any)
    .where(eq(inventoryCounts.id, id))
    .returning();

  return updated ?? null;
};

export const startCount = async (id: string) => {
  const [startedCount] = await db
    .update(inventoryCounts)
    .set({
      status: "in_progress",
      startedAt: new Date(),
    })
    .where(eq(inventoryCounts.id, id))
    .returning();

  if (!startedCount) throw new Error("Count not found");

  // Create count items for all items at location
  const items = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        startedCount.locationId
          ? eq(inventoryItems.primaryLocationId, startedCount.locationId)
          : undefined,
        eq(inventoryItems.isDeleted, false),
      ),
    );

  const countItems = items.map((item) => ({
    countId: id,
    itemId: item.id,
    systemQuantity: item.quantityOnHand,
    countedQuantity: null,
    variance: null,
    notes: null,
  }));

  if (countItems.length > 0) {
    await db.insert(inventoryCountItems).values(countItems);
  }

  return startedCount;
};

export const completeCount = async (id: string, _userId: string) => {
  // Get all items that were counted in this count
  const countItems = await db
    .select({ itemId: inventoryCountItems.itemId })
    .from(inventoryCountItems)
    .where(eq(inventoryCountItems.countId, id));

  const currentDate = new Date();

  // Update lastCountedDate for all counted items
  if (countItems.length > 0) {
    const itemIds = countItems.map((item) => item.itemId);
    await db
      .update(inventoryItems)
      .set({
        lastCountedDate: currentDate.toISOString().split("T")[0],
        updatedAt: currentDate,
      })
      .where(sql`${inventoryItems.id} = ANY(${itemIds})`);
  }

  const [completedCount] = await db
    .update(inventoryCounts)
    .set({
      status: "completed",
      completedAt: currentDate,
    })
    .where(eq(inventoryCounts.id, id))
    .returning();

  if (!completedCount) throw new Error("Count not found");

  return completedCount;
};

export const getCountItems = async (countId: string) => {
  const result = await db
    .select({
      countItem: inventoryCountItems,
      item: inventoryItems,
    })
    .from(inventoryCountItems)
    .leftJoin(inventoryItems, eq(inventoryCountItems.itemId, inventoryItems.id))
    .where(eq(inventoryCountItems.countId, countId))
    .orderBy(inventoryCountItems.createdAt);

  return {
    data: result.map((r) => ({
      ...r.countItem,
      item: r.item,
    })),
  };
};

export const recordCountItem = async (
  countId: string,
  itemId: string,
  data: { actualQuantity: string; notes?: string },
) => {
  const countItem = await db
    .select()
    .from(inventoryCountItems)
    .where(
      and(
        eq(inventoryCountItems.countId, countId),
        eq(inventoryCountItems.itemId, itemId),
      ),
    )
    .limit(1);

  if (countItem.length === 0) throw new Error("Count item not found");

  const systemQty = parseFloat(countItem[0]!.systemQuantity);
  const actualQty = parseFloat(data.actualQuantity);
  const variance = actualQty - systemQty;
  const varianceCost = variance * parseFloat(countItem[0]!.unitCost || "0");

  const [updatedCountItem] = await db
    .update(inventoryCountItems)
    .set({
      countedQuantity: data.actualQuantity,
      variance: variance.toString(),
      varianceCost: varianceCost.toString(),
      notes: data.notes,
    })
    .where(eq(inventoryCountItems.id, countItem[0]!.id))
    .returning();

  return updatedCountItem!;
};
