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
import {
  createExpenseFromSource,
  getDefaultExpenseCategoryId,
} from "../../services/expense.service.js";

// ============================
// Helper Functions
// ============================

export const generatePONumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;

  const lastPO = await db
    .select({ poNumber: inventoryPurchaseOrders.poNumber })
    .from(inventoryPurchaseOrders)
    .where(ilike(inventoryPurchaseOrders.poNumber, `${prefix}%`))
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
  offset: number,
  limit: number,
  filters?: {
    status?: string;
    supplierId?: string;
    startDate?: string;
    endDate?: string;
  }
) => {
  const conditions = [eq(inventoryPurchaseOrders.isDeleted, false)];

  if (filters?.status) {
    conditions.push(eq(inventoryPurchaseOrders.status, filters.status as any));
  }
  if (filters?.supplierId) {
    conditions.push(eq(inventoryPurchaseOrders.supplierId, filters.supplierId));
  }
  if (filters?.startDate) {
    conditions.push(gte(inventoryPurchaseOrders.orderDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(inventoryPurchaseOrders.orderDate, filters.endDate));
  }

  const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0];

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

export const getPurchaseOrderById = async (id: string) => {
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
    .where(eq(inventoryPurchaseOrders.id, id))
    .limit(1);

  if (result.length === 0) return null;

  const items = await getPurchaseOrderItems(id);

  return {
    ...result[0]!.po!,
    supplier: result[0]!.supplier,
    location: result[0]!.location,
    createdByUser: result[0]!.createdByUser,
    items: items.data,
  };
};

export const createPurchaseOrder = async (data: any, userId: string) => {
  const poNumber = await generatePONumber();

  const [newPO] = await db
    .insert(inventoryPurchaseOrders)
    .values({
      poNumber,
      title: data.title || null,
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
  data: any
) => {
  const updateData: any = {};

  if (data.title !== undefined) updateData.title = data.title;
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
    .where(eq(inventoryPurchaseOrders.id, id))
    .returning();

  if (!updatedPO) throw new Error("Purchase order not found");

  return updatedPO;
};

export const approvePurchaseOrder = async (
  id: string,
  userId: string,
  isExpense?: boolean
) => {
  const [approvedPO] = await db
    .update(inventoryPurchaseOrders)
    .set({
      status: "approved",
      approvedBy: userId,
      approvedAt: new Date(),
    })
    .where(eq(inventoryPurchaseOrders.id, id))
    .returning();

  if (!approvedPO) throw new Error("Purchase order not found");

  if (isExpense && approvedPO.totalAmount && parseFloat(approvedPO.totalAmount) > 0) {
    try {
      const categoryId = await getDefaultExpenseCategoryId();
      const orderDate = approvedPO.orderDate;
      const expenseDate =
        (typeof orderDate === "string"
          ? orderDate.slice(0, 10)
          : orderDate
            ? new Date(orderDate as string | Date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]) as string;
      await createExpenseFromSource({
        sourceId: approvedPO.id,
        categoryId,
        expenseType: "inventory_purchase",
        amount: approvedPO.totalAmount,
        expenseDate,
        description: `Purchase order ${approvedPO.poNumber}`,
        title: `PO ${approvedPO.poNumber}`,
        vendor: null,
        createdBy: userId,
        source: "inventory",
      });
    } catch {
      // Log but don't fail the approval
    }
  }

  return approvedPO;
};

export const sendPurchaseOrder = async (id: string) => {
  // Validate PO can be sent (must be approved)
  const po = await db
    .select()
    .from(inventoryPurchaseOrders)
    .where(eq(inventoryPurchaseOrders.id, id))
    .limit(1);

  if (po.length === 0) throw new Error("Purchase order not found");
  
  if (po[0]!.status !== "approved") {
    throw new Error("Purchase order must be approved before sending");
  }

  const [sentPO] = await db
    .update(inventoryPurchaseOrders)
    .set({
      status: "sent",
    })
    .where(eq(inventoryPurchaseOrders.id, id))
    .returning();

  if (!sentPO) throw new Error("Purchase order not found");

  return sentPO;
};

export const cancelPurchaseOrder = async (id: string, reason?: string) => {
  // Validate PO can be cancelled (not received or closed)
  const po = await db
    .select()
    .from(inventoryPurchaseOrders)
    .where(eq(inventoryPurchaseOrders.id, id))
    .limit(1);

  if (po.length === 0) throw new Error("Purchase order not found");
  
  if (po[0]!.status === "received" || po[0]!.status === "closed") {
    throw new Error("Cannot cancel received or closed purchase orders");
  }

  const [cancelledPO] = await db
    .update(inventoryPurchaseOrders)
    .set({
      status: "cancelled",
      notes: reason ? `${po[0]!.notes || ''}\n\nCancellation reason: ${reason}`.trim() : po[0]!.notes,
    })
    .where(eq(inventoryPurchaseOrders.id, id))
    .returning();

  if (!cancelledPO) throw new Error("Purchase order not found");

  return cancelledPO;
};

export const closePurchaseOrder = async (id: string, _userId: string) => {
  // Validate PO can be closed (must be received)
  const po = await db
    .select()
    .from(inventoryPurchaseOrders)
    .where(eq(inventoryPurchaseOrders.id, id))
    .limit(1);

  if (po.length === 0) throw new Error("Purchase order not found");
  
  if (po[0]!.status !== "received") {
    throw new Error("Purchase order must be fully received before closing");
  }

  const [closedPO] = await db
    .update(inventoryPurchaseOrders)
    .set({
      status: "closed",
    })
    .where(eq(inventoryPurchaseOrders.id, id))
    .returning();

  if (!closedPO) throw new Error("Purchase order not found");

  return closedPO;
};

export const receivePurchaseOrder = async (
  id: string,
  data: { items: Array<{ itemId: string; quantityReceived: string; notes?: string }>; locationId?: string },
  userId: string
) => {
  // 🔐 WRAP IN TRANSACTION
  return await db.transaction(async (tx) => {
    const po = await getPurchaseOrderById(id);
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
    const updatedItems = await getPurchaseOrderItems(id);
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

export const getPurchaseOrderItems = async (purchaseOrderId: string) => {
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

// ============================
// PO Line Item Management
// ============================

export const addPurchaseOrderItem = async (
  purchaseOrderId: string,
  data: {
    itemId: string;
    quantityOrdered: string;
    unitCost: string;
    expectedDeliveryDate?: string;
    notes?: string;
  }
) => {
  // Validate PO exists and is editable
  const po = await db
    .select()
    .from(inventoryPurchaseOrders)
    .where(eq(inventoryPurchaseOrders.id, purchaseOrderId))
    .limit(1);

  if (po.length === 0) throw new Error("Purchase order not found");
  
  if (po[0]!.status !== "draft" && po[0]!.status !== "pending_approval") {
    throw new Error("Cannot modify purchase order items after approval");
  }

  const lineTotal = (parseFloat(data.quantityOrdered) * parseFloat(data.unitCost)).toString();

  const [newItem] = await db
    .insert(inventoryPurchaseOrderItems)
    .values({
      purchaseOrderId,
      itemId: data.itemId,
      quantityOrdered: data.quantityOrdered,
      quantityReceived: "0",
      unitCost: data.unitCost,
      lineTotal,
      expectedDeliveryDate: data.expectedDeliveryDate || null,
      notes: data.notes,
    })
    .returning();

  return newItem!;
};

export const updatePurchaseOrderItem = async (
  id: string,
  data: {
    quantityOrdered?: string;
    unitCost?: string;
    expectedDeliveryDate?: string;
    notes?: string;
  }
) => {
  // Get the PO item to check if PO is editable
  const poItem = await db
    .select({
      poItem: inventoryPurchaseOrderItems,
      po: inventoryPurchaseOrders,
    })
    .from(inventoryPurchaseOrderItems)
    .leftJoin(inventoryPurchaseOrders, eq(inventoryPurchaseOrderItems.purchaseOrderId, inventoryPurchaseOrders.id))
    .where(eq(inventoryPurchaseOrderItems.id, id))
    .limit(1);

  if (poItem.length === 0) throw new Error("Purchase order item not found");
  
  if (poItem[0]!.po!.status !== "draft" && poItem[0]!.po!.status !== "pending_approval") {
    throw new Error("Cannot modify purchase order items after approval");
  }

  const updateData: any = {};

  if (data.quantityOrdered !== undefined) updateData.quantityOrdered = data.quantityOrdered;
  if (data.unitCost !== undefined) updateData.unitCost = data.unitCost;
  if (data.expectedDeliveryDate !== undefined) updateData.expectedDeliveryDate = data.expectedDeliveryDate;
  if (data.notes !== undefined) updateData.notes = data.notes;

  // Recalculate line total if quantity or unit cost changed
  if (data.quantityOrdered !== undefined || data.unitCost !== undefined) {
    const qty = data.quantityOrdered || poItem[0]!.poItem!.quantityOrdered;
    const cost = data.unitCost || poItem[0]!.poItem!.unitCost;
    updateData.lineTotal = (parseFloat(qty) * parseFloat(cost)).toString();
  }

  const [updatedItem] = await db
    .update(inventoryPurchaseOrderItems)
    .set(updateData)
    .where(eq(inventoryPurchaseOrderItems.id, id))
    .returning();

  if (!updatedItem) throw new Error("Purchase order item not found");

  return updatedItem;
};

export const deletePurchaseOrderItem = async (id: string) => {
  // Get the PO item to check if PO is editable
  const poItem = await db
    .select({
      poItem: inventoryPurchaseOrderItems,
      po: inventoryPurchaseOrders,
    })
    .from(inventoryPurchaseOrderItems)
    .leftJoin(inventoryPurchaseOrders, eq(inventoryPurchaseOrderItems.purchaseOrderId, inventoryPurchaseOrders.id))
    .where(eq(inventoryPurchaseOrderItems.id, id))
    .limit(1);

  if (poItem.length === 0) throw new Error("Purchase order item not found");
  
  if (poItem[0]!.po!.status !== "draft" && poItem[0]!.po!.status !== "pending_approval") {
    throw new Error("Cannot modify purchase order items after approval");
  }

  const [deletedItem] = await db
    .delete(inventoryPurchaseOrderItems)
    .where(eq(inventoryPurchaseOrderItems.id, id))
    .returning();

  if (!deletedItem) throw new Error("Purchase order item not found");

  return deletedItem;
};

// ============================
// Partial Receiving Workflow
// ============================

export const receivePartialPurchaseOrder = async (
  id: string,
  data: { 
    items: Array<{ 
      itemId: string; 
      quantityReceived: string; 
      actualDeliveryDate?: string;
      notes?: string 
    }>; 
    locationId?: string;
    trackingNumber?: string;
    supplierInvoiceNumber?: string;
  },
  userId: string
) => {
  // 🔐 WRAP IN TRANSACTION for atomic partial receiving
  return await db.transaction(async (tx) => {
    const po = await getPurchaseOrderById(id);
    if (!po) throw new Error("Purchase order not found");

    if (po.status !== "sent" && po.status !== "partially_received") {
      throw new Error("Purchase order must be sent before receiving items");
    }

    let hasNewReceipts = false;

    for (const receivedItem of data.items) {
      const poItem = po.items?.find((i: any) => i.itemId === receivedItem.itemId);
      if (!poItem) continue;

      const qtyReceived = parseFloat(receivedItem.quantityReceived);
      if (qtyReceived <= 0) continue;

      const previouslyReceived = parseFloat(poItem.quantityReceived);
      const qtyOrdered = parseFloat(poItem.quantityOrdered);
      const newTotalReceived = previouslyReceived + qtyReceived;

      // Validate not over-receiving
      if (newTotalReceived > qtyOrdered) {
        throw new Error(`Cannot receive more than ordered quantity for item ${poItem.item?.name}. Ordered: ${qtyOrdered}, Already received: ${previouslyReceived}, Attempting: ${qtyReceived}`);
      }

      // Update PO line item with individual delivery date
      await tx
        .update(inventoryPurchaseOrderItems)
        .set({
          quantityReceived: newTotalReceived.toString(),
          actualDeliveryDate: receivedItem.actualDeliveryDate || new Date().toISOString().split('T')[0],
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
          notes: `Partial receipt from PO ${po.poNumber}${receivedItem.notes ? ` - ${receivedItem.notes}` : ''}`,
        },
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

      hasNewReceipts = true;
    }

    if (!hasNewReceipts) {
      throw new Error("No valid items to receive");
    }

    // Check completion status
    const updatedItems = await getPurchaseOrderItems(id);
    const allReceived = updatedItems.data.every(
      (item: any) => parseFloat(item.quantityReceived) >= parseFloat(item.quantityOrdered)
    );

    const someReceived = updatedItems.data.some((item: any) => parseFloat(item.quantityReceived) > 0);

    let newStatus: any = po.status;
    let actualDeliveryDate = null;

    if (allReceived) {
      newStatus = "received";
      actualDeliveryDate = new Date().toISOString().split('T')[0];
    } else if (someReceived) {
      newStatus = "partially_received";
    }

    // Update PO status and tracking info
    const updateData: any = { status: newStatus };
    if (actualDeliveryDate) updateData.actualDeliveryDate = actualDeliveryDate;
    if (data.trackingNumber) updateData.trackingNumber = data.trackingNumber;
    if (data.supplierInvoiceNumber) updateData.supplierInvoiceNumber = data.supplierInvoiceNumber;

    await tx
      .update(inventoryPurchaseOrders)
      .set(updateData)
      .where(eq(inventoryPurchaseOrders.id, id));

    return { 
      success: true, 
      status: newStatus, 
      fullyReceived: allReceived,
      itemsProcessed: data.items.length
    };
  });
};

