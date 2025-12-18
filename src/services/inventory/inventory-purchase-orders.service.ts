import { count, eq, and, desc, ilike, gte, lte } from "drizzle-orm";
import { db } from "../../config/db.js";
import {
  inventoryItems,
  inventoryPurchaseOrders,
  inventoryPurchaseOrderItems,
  inventorySuppliers,
  inventoryLocations,
} from "../../drizzle/schema/inventory.schema.js";
import { users } from "../../drizzle/schema/auth.schema.js";
import { createTransaction } from "./inventory-transactions.service.js";

// ============================
// Helper Functions
// ============================

export const generatePONumber = async (organizationId: string): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;

  const lastPO = await db
    .select({ poNumber: inventoryPurchaseOrders.poNumber })
    .from(inventoryPurchaseOrders)
    .where(
      and(
        eq(inventoryPurchaseOrders.organizationId, organizationId),
        ilike(inventoryPurchaseOrders.poNumber, `${prefix}%`)
      )
    )
    .orderBy(desc(inventoryPurchaseOrders.poNumber))
    .limit(1);

  if (lastPO.length === 0) {
    return `${prefix}0001`;
  }

  const lastNumber = parseInt(lastPO[0]!.poNumber.split("-").pop() || "0");
  const nextNumber = (lastNumber + 1).toString().padStart(4, "0");
  return `${prefix}${nextNumber}`;
};

// ============================
// Purchase Orders
// ============================

export const getPurchaseOrders = async (
  organizationId: string,
  offset: number,
  limit: number,
  filters?: {
    status?: string;
    supplierId?: string;
    startDate?: string;
    endDate?: string;
  }
) => {
  let whereCondition = and(
    eq(inventoryPurchaseOrders.organizationId, organizationId),
    eq(inventoryPurchaseOrders.isDeleted, false)
  );

  if (filters?.status) {
    whereCondition = and(whereCondition, eq(inventoryPurchaseOrders.status, filters.status as any));
  }
  if (filters?.supplierId) {
    whereCondition = and(whereCondition, eq(inventoryPurchaseOrders.supplierId, filters.supplierId));
  }
  if (filters?.startDate) {
    whereCondition = and(whereCondition, gte(inventoryPurchaseOrders.orderDate, filters.startDate))!;
  }
  if (filters?.endDate) {
    whereCondition = and(whereCondition, lte(inventoryPurchaseOrders.orderDate, filters.endDate))!;
  }

  const result = await db
    .select({
      po: inventoryPurchaseOrders,
      supplier: inventorySuppliers,
      location: inventoryLocations,
      createdByUser: users,
    })
    .from(inventoryPurchaseOrders)
    .leftJoin(inventorySuppliers, eq(inventoryPurchaseOrders.supplierId, inventorySuppliers.id))
    .leftJoin(inventoryLocations, eq(inventoryPurchaseOrders.shipToLocationId, inventoryLocations.id))
    .leftJoin(users, eq(inventoryPurchaseOrders.createdBy, users.id))
    .where(whereCondition)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(inventoryPurchaseOrders.orderDate));

  const totalCount = await db
    .select({ count: count() })
    .from(inventoryPurchaseOrders)
    .where(whereCondition);

  const total = totalCount[0]?.count ?? 0;

  return {
    data: result.map((r) => ({
      ...r.po,
      supplier: r.supplier,
      location: r.location,
      createdByUser: r.createdByUser,
    })),
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getPurchaseOrderById = async (id: string, organizationId: string) => {
  const result = await db
    .select({
      po: inventoryPurchaseOrders,
      supplier: inventorySuppliers,
      location: inventoryLocations,
      createdByUser: users,
    })
    .from(inventoryPurchaseOrders)
    .leftJoin(inventorySuppliers, eq(inventoryPurchaseOrders.supplierId, inventorySuppliers.id))
    .leftJoin(inventoryLocations, eq(inventoryPurchaseOrders.shipToLocationId, inventoryLocations.id))
    .leftJoin(users, eq(inventoryPurchaseOrders.createdBy, users.id))
    .where(and(eq(inventoryPurchaseOrders.id, id), eq(inventoryPurchaseOrders.organizationId, organizationId)))
    .limit(1);

  if (result.length === 0) return null;

  const items = await getPurchaseOrderItems(id, organizationId);

  return {
    ...result[0]!.po!,
    supplier: result[0]!.supplier,
    location: result[0]!.location,
    createdByUser: result[0]!.createdByUser,
    items: items.data,
  };
};

export const createPurchaseOrder = async (data: any, organizationId: string, userId: string) => {
  const poNumber = await generatePONumber(organizationId);

  const [newPO] = await db
    .insert(inventoryPurchaseOrders)
    .values({
      organizationId,
      poNumber,
      supplierId: data.supplierId,
      orderDate: data.orderDate || new Date().toISOString().split('T')[0], // Required field
      expectedDeliveryDate: data.expectedDeliveryDate || null,
      shipToLocationId: data.shipToLocationId,
      status: "draft",
      subtotal: data.subtotal || "0",
      taxAmount: data.taxAmount || "0",
      shippingCost: data.shippingCost || "0",
      totalAmount: data.totalAmount || "0",
      notes: data.notes,
      isDeleted: false,
      createdBy: userId,
    })
    .returning();

  // Create PO line items
  if (data.items && data.items.length > 0) {
    const itemsToInsert = data.items.map((item: any) => ({
      purchaseOrderId: newPO!.id,
      organizationId,
      itemId: item.itemId,
      quantityOrdered: item.quantityOrdered,
      quantityReceived: "0",
      unitCost: item.unitCost,
      totalCost: (parseFloat(item.quantityOrdered) * parseFloat(item.unitCost)).toString(),
      notes: item.notes,
    }));

    await db.insert(inventoryPurchaseOrderItems).values(itemsToInsert);
  }

  return newPO!;
};

export const updatePurchaseOrder = async (
  id: string,
  data: any,
  organizationId: string
) => {
  const updateData: any = {};

  if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
  if (data.expectedDeliveryDate !== undefined) updateData.expectedDeliveryDate = data.expectedDeliveryDate;
  if (data.shipToLocationId !== undefined) updateData.shipToLocationId = data.shipToLocationId;
  if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
  if (data.taxAmount !== undefined) updateData.taxAmount = data.taxAmount;
  if (data.shippingCost !== undefined) updateData.shippingCost = data.shippingCost;
  if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
  if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms;
  if (data.shippingMethod !== undefined) updateData.shippingMethod = data.shippingMethod;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const [updatedPO] = await db
    .update(inventoryPurchaseOrders)
    .set(updateData)
    .where(and(eq(inventoryPurchaseOrders.id, id), eq(inventoryPurchaseOrders.organizationId, organizationId)))
    .returning();

  if (!updatedPO) throw new Error("Purchase order not found");

  return updatedPO;
};

export const approvePurchaseOrder = async (
  id: string,
  organizationId: string,
  userId: string
) => {
  const [approvedPO] = await db
    .update(inventoryPurchaseOrders)
    .set({
      status: "approved",
      approvedBy: userId,
      approvedAt: new Date(),
    })
    .where(and(eq(inventoryPurchaseOrders.id, id), eq(inventoryPurchaseOrders.organizationId, organizationId)))
    .returning();

  if (!approvedPO) throw new Error("Purchase order not found");

  return approvedPO;
};

export const sendPurchaseOrder = async (id: string, organizationId: string) => {
  const [sentPO] = await db
    .update(inventoryPurchaseOrders)
    .set({
      status: "sent",
    })
    .where(and(eq(inventoryPurchaseOrders.id, id), eq(inventoryPurchaseOrders.organizationId, organizationId)))
    .returning();

  if (!sentPO) throw new Error("Purchase order not found");

  return sentPO;
};

export const receivePurchaseOrder = async (
  id: string,
  data: { items: Array<{ itemId: string; quantityReceived: string; notes?: string }>; locationId?: string },
  organizationId: string,
  userId: string
) => {
  // 🔐 WRAP IN TRANSACTION
  return await db.transaction(async (tx) => {
    const po = await getPurchaseOrderById(id, organizationId);
    if (!po) throw new Error("Purchase order not found");

    for (const receivedItem of data.items) {
      const poItem = po.items?.find((i: any) => i.itemId === receivedItem.itemId);
      if (!poItem) continue;

      const qtyReceived = parseFloat(receivedItem.quantityReceived);
      const previouslyReceived = parseFloat(poItem.quantityReceived);
      const newTotalReceived = previouslyReceived + qtyReceived;

      // Update PO line item
      await tx
        .update(inventoryPurchaseOrderItems)
        .set({
          quantityReceived: newTotalReceived.toString(),
          actualDeliveryDate: new Date().toISOString(),
          notes: receivedItem.notes || poItem.notes,
        })
        .where(eq(inventoryPurchaseOrderItems.id, poItem.id));

      // Create receipt transaction
      await createTransaction(
        {
          itemId: receivedItem.itemId,
          locationId: data.locationId || po.shipToLocationId,
          transactionType: "receipt",
          quantity: receivedItem.quantityReceived,
          unitCost: poItem.unitCost,
          purchaseOrderId: id,
          referenceNumber: po.poNumber,
          notes: `Received from PO ${po.poNumber}`,
        },
        organizationId,
        userId
      );

      // 🔒 LOCK and update item quantityOnOrder
      const item = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, receivedItem.itemId))
        .for('update')
        .limit(1);

      if (item.length > 0) {
        const newQtyOnOrder = Math.max(0, parseFloat(item[0]!.quantityOnOrder) - qtyReceived);
        await tx
          .update(inventoryItems)
          .set({ quantityOnOrder: newQtyOnOrder.toString() })
          .where(eq(inventoryItems.id, receivedItem.itemId));
      }
    }

    // Check if all items received
    const updatedItems = await getPurchaseOrderItems(id, organizationId);
    const allReceived = updatedItems.data.every(
      (item: any) => parseFloat(item.quantityReceived) >= parseFloat(item.quantityOrdered)
    );

    const someReceived = updatedItems.data.some((item: any) => parseFloat(item.quantityReceived) > 0);

    let newStatus: any = po.status;
    if (allReceived) {
      newStatus = "received";
    } else if (someReceived) {
      newStatus = "partially_received";
    }

    // Update PO status
    await tx
      .update(inventoryPurchaseOrders)
      .set({
        status: newStatus,
        actualDeliveryDate: allReceived ? new Date().toISOString() : null,
      })
      .where(eq(inventoryPurchaseOrders.id, id));

    return { success: true, status: newStatus };
  });
};

export const getPurchaseOrderItems = async (purchaseOrderId: string, organizationId: string) => {
  const result = await db
    .select({
      poItem: inventoryPurchaseOrderItems,
      item: inventoryItems,
    })
    .from(inventoryPurchaseOrderItems)
    .leftJoin(inventoryItems, eq(inventoryPurchaseOrderItems.itemId, inventoryItems.id))
    .where(eq(inventoryPurchaseOrderItems.purchaseOrderId, purchaseOrderId))
    .orderBy(inventoryPurchaseOrderItems.createdAt);

  return {
    data: result.map((r) => ({
      ...r.poItem,
      item: r.item,
    })),
  };
};

