import { count, eq, and, desc, ilike, gte, lte } from "drizzle-orm";
import { db } from "../../config/db.js";
import {
  inventoryItems,
  inventoryTransactions,
  inventoryLocations,
  inventoryStockAlerts,
} from "../../drizzle/schema/inventory.schema.js";
import { users } from "../../drizzle/schema/auth.schema.js";
import { jobs } from "../../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../../drizzle/schema/bids.schema.js";
import { calculateStockStatus } from "./inventory-items.service.js";

// ============================
// Helper Functions
// ============================

/**
 * Generate unique transaction number
 */
export const generateTransactionNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `TXN-${year}-`;

  const lastTransaction = await db
    .select({ transactionNumber: inventoryTransactions.transactionNumber })
    .from(inventoryTransactions)
    .where(ilike(inventoryTransactions.transactionNumber, `${prefix}%`))
    .orderBy(desc(inventoryTransactions.transactionNumber))
    .limit(1);

  if (lastTransaction.length === 0) {
    return `${prefix}0001`;
  }

  const lastNumber = parseInt(lastTransaction[0]!.transactionNumber.split("-").pop() || "0");
  const nextNumber = (lastNumber + 1).toString().padStart(4, "0");
  return `${prefix}${nextNumber}`;
};

/**
 * Update item quantities after transaction
 * RACE CONDITION SAFE: Uses row-level locking via transaction context
 * This should be called within a transaction that already has the item locked
 */
export const updateItemQuantitiesAfterTransaction = async (
  tx: any, // Transaction context from db.transaction()
  itemId: string,
  transactionType: string,
  quantity: string
) => {
  // 🔒 LOCK ROW: Read with FOR UPDATE to prevent concurrent modifications
  const item = await tx
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.id, itemId))
    .for('update') // ← ROW-LEVEL LOCK: Critical for preventing race conditions
    .limit(1);

  if (item.length === 0) throw new Error("Item not found");

  const currentItem = item[0];
  const qty = parseFloat(quantity);
  let newQuantityOnHand = parseFloat(currentItem.quantityOnHand);

  // Adjust quantity based on transaction type
  switch (transactionType) {
    case "receipt":
    case "return":
      newQuantityOnHand += qty;
      break;
    case "issue":
    case "write_off":
      newQuantityOnHand -= qty;
      break;
    case "adjustment":
      newQuantityOnHand = qty; // Adjustment sets absolute value
      break;
  }

  // Calculate available quantity
  const quantityAllocated = parseFloat(currentItem.quantityAllocated);
  const quantityAvailable = newQuantityOnHand - quantityAllocated;

  // Calculate new status
  const newStatus = calculateStockStatus(
    newQuantityOnHand.toString(),
    currentItem.reorderLevel,
    currentItem.quantityOnOrder
  );

  // Prepare update data
  const updateData: any = {
    quantityOnHand: newQuantityOnHand.toString(),
    quantityAvailable: quantityAvailable.toString(),
    status: newStatus,
    updatedAt: new Date(),
  };

  // Auto-update lastRestockedDate for receipt transactions
  if (transactionType === "receipt") {
    updateData.lastRestockedDate = new Date();
  }

  // Update item (within the locked transaction)
  await tx
    .update(inventoryItems)
    .set(updateData)
    .where(eq(inventoryItems.id, itemId));

  // Check if alert needed
  if (newStatus === "low_stock" || newStatus === "out_of_stock") {
    await checkAndCreateAlert(itemId);
  }

  return { newQuantityOnHand, newStatus };
};

/**
 * Check and create stock alert if needed
 */
export const checkAndCreateAlert = async (itemId: string) => {
  const item = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.id, itemId))
    .limit(1);

  if (item.length === 0) return;

  const currentItem = item[0]!;
  const qtyOnHand = parseFloat(currentItem.quantityOnHand);
  const reorderLevel = parseFloat(currentItem.reorderLevel);

  if (qtyOnHand <= reorderLevel) {
    // Check if alert already exists
    const existingAlert = await db
      .select()
      .from(inventoryStockAlerts)
      .where(
        and(
          eq(inventoryStockAlerts.itemId, itemId),
          eq(inventoryStockAlerts.isResolved, false)
        )
      )
      .limit(1);

    if (existingAlert.length === 0) {
      await db.insert(inventoryStockAlerts).values({
        itemId,
        alertType: qtyOnHand === 0 ? "out_of_stock" : "low_stock",
        severity: qtyOnHand === 0 ? "critical" : "warning",
        currentQuantity: currentItem.quantityOnHand,
        thresholdQuantity: currentItem.reorderLevel,
        message:
            qtyOnHand === 0
            ? `Item ${currentItem.name} is out of stock`
            : `Item ${currentItem.name} is below reorder level (${qtyOnHand} <= ${reorderLevel})`,
        isAcknowledged: false,
        isResolved: false,
      });
    }
  }
};

// ============================
// Transaction Functions
// ============================

export const getTransactions = async (
  offset: number,
  limit: number,
  filters?: {
    itemId?: string;
    transactionType?: string;
    startDate?: string;
    endDate?: string;
    jobId?: string;
    bidId?: string;
  }
) => {
  let whereCondition: any = undefined;

  if (filters?.itemId) {
    whereCondition = whereCondition 
      ? and(whereCondition, eq(inventoryTransactions.itemId, filters.itemId))!
      : eq(inventoryTransactions.itemId, filters.itemId);
  }
  if (filters?.transactionType) {
    whereCondition = whereCondition
      ? and(whereCondition, eq(inventoryTransactions.transactionType, filters.transactionType as any))!
      : eq(inventoryTransactions.transactionType, filters.transactionType as any);
  }
  if (filters?.startDate) {
    whereCondition = whereCondition
      ? and(whereCondition, gte(inventoryTransactions.transactionDate, new Date(filters.startDate)))!
      : gte(inventoryTransactions.transactionDate, new Date(filters.startDate));
  }
  if (filters?.endDate) {
    whereCondition = whereCondition
      ? and(whereCondition, lte(inventoryTransactions.transactionDate, new Date(filters.endDate)))!
      : lte(inventoryTransactions.transactionDate, new Date(filters.endDate));
  }
  if (filters?.jobId) {
    whereCondition = whereCondition
      ? and(whereCondition, eq(inventoryTransactions.jobId, filters.jobId))!
      : eq(inventoryTransactions.jobId, filters.jobId);
  }
  if (filters?.bidId) {
    whereCondition = whereCondition
      ? and(whereCondition, eq(inventoryTransactions.bidId, filters.bidId))!
      : eq(inventoryTransactions.bidId, filters.bidId);
  }

  const result = await db
    .select({
      transaction: inventoryTransactions,
      item: inventoryItems,
      location: inventoryLocations,
      user: users,
      job: jobs,
      bid: bidsTable,
    })
    .from(inventoryTransactions)
    .leftJoin(inventoryItems, eq(inventoryTransactions.itemId, inventoryItems.id))
    .leftJoin(inventoryLocations, eq(inventoryTransactions.locationId, inventoryLocations.id))
    .leftJoin(users, eq(inventoryTransactions.performedBy, users.id))
    .leftJoin(jobs, eq(inventoryTransactions.jobId, jobs.id))
    .leftJoin(bidsTable, eq(inventoryTransactions.bidId, bidsTable.id))
    .where(whereCondition)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(inventoryTransactions.transactionDate));

  const totalCount = await db
    .select({ count: count() })
    .from(inventoryTransactions)
    .where(whereCondition);

  const total = totalCount[0]?.count ?? 0;

  return {
    data: result.map((r) => ({
      ...r.transaction,
      item: r.item ? { id: r.item.id, name: r.item.name, itemCode: r.item.itemCode } : null,
      location: r.location ? { id: r.location.id, name: r.location.name } : null,
      performedByUser: r.user ? { id: r.user.id, fullName: r.user.fullName } : null,
      job: r.job ? { id: r.job.id, name: r.job.name, jobNumber: r.job.jobNumber } : null,
      bid: r.bid ? { id: r.bid.id, title: r.bid.title, bidNumber: r.bid.bidNumber } : null,
    })),
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const createTransaction = async (data: any, userId: string) => {
  // 🔐 WRAP EVERYTHING IN A DATABASE TRANSACTION
  // This ensures atomicity: either ALL operations succeed or ALL fail
  // Also enables row-level locking to prevent race conditions
  return await db.transaction(async (tx) => {
    const transactionNumber = await generateTransactionNumber();

    // 🔒 Get item with FOR UPDATE lock to prevent concurrent modifications
    const item = await tx
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, data.itemId))
      .for('update') // ← CRITICAL: Lock this row until transaction commits
      .limit(1);

    if (item.length === 0) throw new Error("Item not found");

    // Calculate total cost
    let totalCost = null;
    if (data.unitCost) {
      totalCost = (parseFloat(data.quantity) * parseFloat(data.unitCost)).toString();
    }

    // Create transaction record
    const [newTransaction] = await tx
      .insert(inventoryTransactions)
      .values({
        transactionNumber,
        itemId: data.itemId,
        locationId: data.locationId,
        transactionType: data.transactionType,
        quantity: data.quantity,
        unitCost: data.unitCost,
        totalCost,
        purchaseOrderId: data.purchaseOrderId,
        jobId: data.jobId,
        bidId: data.bidId,
        fromLocationId: data.fromLocationId,
        toLocationId: data.toLocationId,
        batchNumber: data.batchNumber,
        serialNumber: data.serialNumber,
        expirationDate: data.expirationDate || null,
        referenceNumber: data.referenceNumber,
        notes: data.notes,
        performedBy: userId,
      })
      .returning();

    // Update item quantities (passes transaction context for locking)
    const { newQuantityOnHand } = await updateItemQuantitiesAfterTransaction(
      tx, // ← Pass transaction context to maintain locks
      data.itemId,
      data.transactionType,
      data.quantity
    );

    // Update transaction with balance
    await tx
      .update(inventoryTransactions)
      .set({ balanceAfter: newQuantityOnHand.toString() })
      .where(eq(inventoryTransactions.id, newTransaction!.id));

    return newTransaction!;
  }); // ← Transaction commits here, releasing all locks
};

export const getItemTransactions = async (itemId: string) => {
  const result = await db
    .select({
      transaction: inventoryTransactions,
      user: users,
      job: jobs,
      bid: bidsTable,
    })
    .from(inventoryTransactions)
    .leftJoin(users, eq(inventoryTransactions.performedBy, users.id))
    .leftJoin(jobs, eq(inventoryTransactions.jobId, jobs.id))
    .leftJoin(bidsTable, eq(inventoryTransactions.bidId, bidsTable.id))
    .where(eq(inventoryTransactions.itemId, itemId))
    .orderBy(desc(inventoryTransactions.transactionDate))
    .limit(50);

  return result.map((r) => ({
    ...r.transaction,
    performedByUser: r.user,
    job: r.job,
    bid: r.bid,
  }));
};

