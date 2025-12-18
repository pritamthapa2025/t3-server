import { count, eq, and, desc, asc, sql, or, ilike } from "drizzle-orm";
import { db } from "../../config/db.js";
import {
  inventoryItems,
  inventoryCategories,
  inventorySuppliers,
  inventoryLocations,
  inventoryUnitsOfMeasure,
  inventoryItemHistory,
} from "../../drizzle/schema/inventory.schema.js";
import { users } from "../../drizzle/schema/auth.schema.js";

// ============================
// Helper Functions
// ============================

/**
 * Calculate stock status based on quantities
 */
export const calculateStockStatus = (
  quantityOnHand: string,
  reorderLevel: string,
  quantityOnOrder: string
): "in_stock" | "low_stock" | "out_of_stock" | "on_order" => {
  const qtyOnHand = parseFloat(quantityOnHand);
  const reorder = parseFloat(reorderLevel);
  const qtyOnOrder = parseFloat(quantityOnOrder);

  if (qtyOnHand === 0) return "out_of_stock";
  if (qtyOnHand <= reorder) return "low_stock";
  if (qtyOnOrder > 0) return "on_order";
  return "in_stock";
};

// ============================
// Inventory Items
// ============================

export const getInventoryItems = async (
  organizationId: string,
  offset: number,
  limit: number,
  filters?: {
    category?: string;
    status?: string;
    supplier?: string;
    location?: string;
    allocationStatus?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }
) => {
  let whereCondition = and(
    eq(inventoryItems.organizationId, organizationId),
    eq(inventoryItems.isDeleted, false)
  );

  if (filters?.category) {
    whereCondition = and(whereCondition, eq(inventoryItems.categoryId, parseInt(filters.category)));
  }
  if (filters?.status) {
    whereCondition = and(whereCondition, eq(inventoryItems.status, filters.status as any));
  }
  if (filters?.supplier) {
    whereCondition = and(whereCondition, eq(inventoryItems.primarySupplierId, filters.supplier));
  }
  if (filters?.location) {
    whereCondition = and(whereCondition, eq(inventoryItems.primaryLocationId, filters.location));
  }
  if (filters?.search) {
    whereCondition = and(
      whereCondition,
      or(
        ilike(inventoryItems.name, `%${filters.search}%`),
        ilike(inventoryItems.itemCode, `%${filters.search}%`),
        ilike(inventoryItems.description, `%${filters.search}%`)
      )
    );
  }

  const result = await db
    .select({
      item: inventoryItems,
      category: inventoryCategories,
      supplier: inventorySuppliers,
      location: inventoryLocations,
      unit: inventoryUnitsOfMeasure,
    })
    .from(inventoryItems)
    .leftJoin(inventoryCategories, eq(inventoryItems.categoryId, inventoryCategories.id))
    .leftJoin(inventorySuppliers, eq(inventoryItems.primarySupplierId, inventorySuppliers.id))
    .leftJoin(inventoryLocations, eq(inventoryItems.primaryLocationId, inventoryLocations.id))
    .leftJoin(inventoryUnitsOfMeasure, eq(inventoryItems.unitOfMeasureId, inventoryUnitsOfMeasure.id))
    .where(whereCondition)
    .limit(limit)
    .offset(offset)
    .orderBy(filters?.sortOrder === "desc" ? desc(inventoryItems.name) : asc(inventoryItems.name));

  const totalCount = await db.select({ count: count() }).from(inventoryItems).where(whereCondition);
  const total = totalCount[0]?.count ?? 0;

  return {
    data: result.map((r) => ({
      ...r.item,
      category: r.category,
      supplier: r.supplier,
      location: r.location,
      unit: r.unit,
    })),
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getInventoryItemById = async (id: string, organizationId: string) => {
  const result = await db
    .select({
      item: inventoryItems,
      category: inventoryCategories,
      supplier: inventorySuppliers,
      location: inventoryLocations,
      unit: inventoryUnitsOfMeasure,
    })
    .from(inventoryItems)
    .leftJoin(inventoryCategories, eq(inventoryItems.categoryId, inventoryCategories.id))
    .leftJoin(inventorySuppliers, eq(inventoryItems.primarySupplierId, inventorySuppliers.id))
    .leftJoin(inventoryLocations, eq(inventoryItems.primaryLocationId, inventoryLocations.id))
    .leftJoin(inventoryUnitsOfMeasure, eq(inventoryItems.unitOfMeasureId, inventoryUnitsOfMeasure.id))
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.organizationId, organizationId)))
    .limit(1);

  if (result.length === 0) return null;

  return {
    ...result[0]!.item!,
    category: result[0]!.category,
    supplier: result[0]!.supplier,
    location: result[0]!.location,
    unit: result[0]!.unit,
  };
};

export const createInventoryItem = async (data: any, organizationId: string, userId: string) => {
  const [newItem] = await db.insert(inventoryItems).values({
    organizationId,
    itemCode: data.itemCode,
    name: data.name,
    description: data.description,
    categoryId: data.categoryId,
    primarySupplierId: data.primarySupplierId,
    unitOfMeasureId: data.unitOfMeasureId,
    unitCost: data.unitCost || "0",
    sellingPrice: data.sellingPrice,
    quantityOnHand: "0",
    quantityAllocated: "0",
    quantityAvailable: "0",
    quantityOnOrder: "0",
    reorderLevel: data.reorderLevel || "0",
    reorderQuantity: data.reorderQuantity || "0",
    maxStockLevel: data.maxStockLevel,
    primaryLocationId: data.primaryLocationId,
    manufacturer: data.manufacturer,
    modelNumber: data.modelNumber,
    partNumber: data.partNumber,
    barcode: data.barcode,
    weight: data.weight,
    weightUnit: data.weightUnit,
    dimensions: data.dimensions,
    specifications: data.specifications,
    tags: data.tags,
    images: data.images,
    trackBySerialNumber: data.trackBySerialNumber || false,
    trackByBatch: data.trackByBatch || false,
    isActive: data.isActive !== undefined ? data.isActive : true,
    status: "out_of_stock",
    notes: data.notes,
    isDeleted: false,
  }).returning();

  return newItem!;
};

export const updateInventoryItem = async (
  id: string,
  data: any,
  organizationId: string,
  userId: string
) => {
  const existingItem = await db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.organizationId, organizationId)))
    .limit(1);

  if (existingItem.length === 0) throw new Error("Item not found");

  const updateData: any = {
    updatedAt: new Date(),
  };

  // Only update provided fields
  if (data.itemCode !== undefined) updateData.itemCode = data.itemCode;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.primarySupplierId !== undefined) updateData.primarySupplierId = data.primarySupplierId;
  if (data.unitOfMeasureId !== undefined) updateData.unitOfMeasureId = data.unitOfMeasureId;
  if (data.unitCost !== undefined) updateData.unitCost = data.unitCost;
  if (data.sellingPrice !== undefined) updateData.sellingPrice = data.sellingPrice;
  if (data.reorderLevel !== undefined) updateData.reorderLevel = data.reorderLevel;
  if (data.reorderQuantity !== undefined) updateData.reorderQuantity = data.reorderQuantity;
  if (data.maxStockLevel !== undefined) updateData.maxStockLevel = data.maxStockLevel;
  if (data.primaryLocationId !== undefined) updateData.primaryLocationId = data.primaryLocationId;
  if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer;
  if (data.modelNumber !== undefined) updateData.modelNumber = data.modelNumber;
  if (data.partNumber !== undefined) updateData.partNumber = data.partNumber;
  if (data.barcode !== undefined) updateData.barcode = data.barcode;
  if (data.weight !== undefined) updateData.weight = data.weight;
  if (data.weightUnit !== undefined) updateData.weightUnit = data.weightUnit;
  if (data.dimensions !== undefined) updateData.dimensions = data.dimensions;
  if (data.specifications !== undefined) updateData.specifications = data.specifications;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.images !== undefined) updateData.images = data.images;
  if (data.trackBySerialNumber !== undefined) updateData.trackBySerialNumber = data.trackBySerialNumber;
  if (data.trackByBatch !== undefined) updateData.trackByBatch = data.trackByBatch;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.notes !== undefined) updateData.notes = data.notes;

  // Recalculate status if reorder level changed
  if (data.reorderLevel !== undefined) {
    const qtyOnHand = existingItem[0]!.quantityOnHand;
    const qtyOnOrder = existingItem[0]!.quantityOnOrder;
    updateData.status = calculateStockStatus(qtyOnHand, data.reorderLevel, qtyOnOrder);
  }

  const [updatedItem] = await db
    .update(inventoryItems)
    .set(updateData)
    .where(eq(inventoryItems.id, id))
    .returning();

  // Track significant changes in history
  if (data.unitCost !== undefined && data.unitCost !== existingItem[0]!.unitCost) {
    await db.insert(inventoryItemHistory).values({
      organizationId,
      itemId: id,
      action: "price_changed",
      fieldChanged: "unitCost",
      oldValue: existingItem[0]!.unitCost,
      newValue: data.unitCost,
      description: `Unit cost changed from ${existingItem[0]!.unitCost} to ${data.unitCost}`,
      performedBy: userId,
    });
  }

  return updatedItem!;
};

export const deleteInventoryItem = async (id: string, organizationId: string, userId: string) => {
  const [deletedItem] = await db
    .update(inventoryItems)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
    })
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.organizationId, organizationId)))
    .returning();

  if (!deletedItem) throw new Error("Item not found");

  // Log deletion
  await db.insert(inventoryItemHistory).values({
    organizationId,
    itemId: id,
    action: "deleted",
    description: "Item deleted",
    performedBy: userId,
  });

  return deletedItem;
};

export const getItemHistory = async (itemId: string, organizationId: string) => {
  const result = await db
    .select({
      history: inventoryItemHistory,
      user: users,
    })
    .from(inventoryItemHistory)
    .leftJoin(users, eq(inventoryItemHistory.performedBy, users.id))
    .where(
      and(
        eq(inventoryItemHistory.itemId, itemId),
        eq(inventoryItemHistory.organizationId, organizationId)
      )
    )
    .orderBy(desc(inventoryItemHistory.createdAt))
    .limit(100);

  return result.map((r) => ({
    ...r.history,
    performedByUser: r.user,
  }));
};

