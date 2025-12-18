import { count, eq, and, desc } from "drizzle-orm";
import { db } from "../../config/db.js";
import {
  inventoryItems,
  inventoryAllocations,
} from "../../drizzle/schema/inventory.schema.js";
import { users } from "../../drizzle/schema/auth.schema.js";
import { jobs } from "../../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../../drizzle/schema/bids.schema.js";
import { createTransaction } from "./inventory-transactions.service.js";

// ============================
// Allocations
// ============================

export const getAllocations = async (
  organizationId: string,
  offset: number,
  limit: number,
  filters?: {
    itemId?: string;
    jobId?: string;
    bidId?: string;
    status?: string;
  }
) => {
  let whereCondition = and(
    eq(inventoryAllocations.organizationId, organizationId),
    eq(inventoryAllocations.isDeleted, false)
  );

  if (filters?.itemId) {
    whereCondition = and(whereCondition, eq(inventoryAllocations.itemId, filters.itemId));
  }
  if (filters?.jobId) {
    whereCondition = and(whereCondition, eq(inventoryAllocations.jobId, filters.jobId));
  }
  if (filters?.bidId) {
    whereCondition = and(whereCondition, eq(inventoryAllocations.bidId, filters.bidId));
  }
  if (filters?.status) {
    whereCondition = and(whereCondition, eq(inventoryAllocations.status, filters.status as any));
  }

  const result = await db
    .select({
      allocation: inventoryAllocations,
      item: inventoryItems,
      job: jobs,
      bid: bidsTable,
      user: users,
    })
    .from(inventoryAllocations)
    .leftJoin(inventoryItems, eq(inventoryAllocations.itemId, inventoryItems.id))
    .leftJoin(jobs, eq(inventoryAllocations.jobId, jobs.id))
    .leftJoin(bidsTable, eq(inventoryAllocations.bidId, bidsTable.id))
    .leftJoin(users, eq(inventoryAllocations.allocatedBy, users.id))
    .where(whereCondition)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(inventoryAllocations.allocationDate));

  const totalCount = await db
    .select({ count: count() })
    .from(inventoryAllocations)
    .where(whereCondition);

  const total = totalCount[0]?.count ?? 0;

  return {
    data: result.map((r) => ({
      ...r.allocation,
      item: r.item
        ? { id: r.item.id, name: r.item.name, itemCode: r.item.itemCode, unitCost: r.item.unitCost }
        : null,
      job: r.job ? { id: r.job.id, name: r.job.name, jobNumber: r.job.jobNumber } : null,
      bid: r.bid ? { id: r.bid.id, title: r.bid.title, bidNumber: r.bid.bidNumber } : null,
      allocatedByUser: r.user ? { id: r.user.id, fullName: r.user.fullName } : null,
    })),
    total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getAllocationById = async (id: string, organizationId: string) => {
  const result = await db
    .select({
      allocation: inventoryAllocations,
      item: inventoryItems,
      job: jobs,
      bid: bidsTable,
      user: users,
    })
    .from(inventoryAllocations)
    .leftJoin(inventoryItems, eq(inventoryAllocations.itemId, inventoryItems.id))
    .leftJoin(jobs, eq(inventoryAllocations.jobId, jobs.id))
    .leftJoin(bidsTable, eq(inventoryAllocations.bidId, bidsTable.id))
    .leftJoin(users, eq(inventoryAllocations.allocatedBy, users.id))
    .where(and(eq(inventoryAllocations.id, id), eq(inventoryAllocations.organizationId, organizationId)))
    .limit(1);

  if (result.length === 0) return null;

  return {
    ...result[0]!.allocation!,
    item: result[0]!.item,
    job: result[0]!.job,
    bid: result[0]!.bid,
    allocatedByUser: result[0]!.user,
  };
};

export const createAllocation = async (data: any, organizationId: string, userId: string) => {
  // 🔐 WRAP IN TRANSACTION to prevent over-allocation race condition
  return await db.transaction(async (tx) => {
    // 🔒 LOCK the item row with FOR UPDATE
    const item = await tx
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, data.itemId))
      .for('update') // ← CRITICAL: Prevents concurrent allocations
      .limit(1);

    if (item.length === 0) throw new Error("Item not found");

    const quantityAvailable = parseFloat(item[0]!.quantityAvailable);
    const quantityToAllocate = parseFloat(data.quantityAllocated);

    if (quantityAvailable < quantityToAllocate) {
      throw new Error(`Insufficient quantity available. Available: ${quantityAvailable}, Requested: ${quantityToAllocate}`);
    }

    // Create allocation record
    const [newAllocation] = await tx
      .insert(inventoryAllocations)
      .values({
        organizationId,
        itemId: data.itemId,
        jobId: data.jobId,
        bidId: data.bidId,
        quantityAllocated: data.quantityAllocated,
        quantityUsed: "0",
        quantityReturned: "0",
        expectedUseDate: data.expectedUseDate || null,
        status: "allocated",
        allocatedBy: userId,
        notes: data.notes,
        isDeleted: false,
      })
      .returning();

    // Update item quantities atomically
    const newQuantityAllocated = parseFloat(item[0]!.quantityAllocated) + quantityToAllocate;
    const newQuantityAvailable = parseFloat(item[0]!.quantityOnHand) - newQuantityAllocated;

    await tx
      .update(inventoryItems)
      .set({
        quantityAllocated: newQuantityAllocated.toString(),
        quantityAvailable: newQuantityAvailable.toString(),
      })
      .where(eq(inventoryItems.id, data.itemId));

    return newAllocation!;
  });
};

export const updateAllocation = async (
  id: string,
  data: any,
  organizationId: string
) => {
  const updateData: any = {};

  if (data.quantityAllocated !== undefined) updateData.quantityAllocated = data.quantityAllocated;
  if (data.quantityUsed !== undefined) updateData.quantityUsed = data.quantityUsed;
  if (data.quantityReturned !== undefined) updateData.quantityReturned = data.quantityReturned;
  if (data.actualUseDate !== undefined) updateData.actualUseDate = data.actualUseDate;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const [updatedAllocation] = await db
    .update(inventoryAllocations)
    .set(updateData)
    .where(and(eq(inventoryAllocations.id, id), eq(inventoryAllocations.organizationId, organizationId)))
    .returning();

  if (!updatedAllocation) throw new Error("Allocation not found");

  return updatedAllocation;
};

export const issueAllocation = async (
  id: string,
  organizationId: string,
  userId: string
) => {
  // 🔐 WRAP IN TRANSACTION
  return await db.transaction(async (tx) => {
    const allocation = await getAllocationById(id, organizationId);
    if (!allocation) throw new Error("Allocation not found");

    if (allocation.status !== "allocated") {
      throw new Error("Can only issue allocations with 'allocated' status");
    }

    // Create issue transaction
    await createTransaction(
      {
        itemId: allocation.itemId,
        transactionType: "issue",
        quantity: allocation.quantityAllocated,
        jobId: allocation.jobId,
        bidId: allocation.bidId,
        referenceNumber: id,
        notes: `Issued for ${allocation.jobId ? "job" : "bid"}`,
      },
      organizationId,
      userId
    );

    // Update allocation status
    const [updatedAllocation] = await tx
      .update(inventoryAllocations)
      .set({
        status: "issued",
        actualUseDate: new Date().toISOString(),
      })
      .where(eq(inventoryAllocations.id, id))
      .returning();

    return updatedAllocation!;
  });
};

export const returnAllocation = async (
  id: string,
  data: { quantityReturned: string; notes?: string },
  organizationId: string,
  userId: string
) => {
  // 🔐 WRAP IN TRANSACTION
  return await db.transaction(async (tx) => {
    const allocation = await getAllocationById(id, organizationId);
    if (!allocation) throw new Error("Allocation not found");

    if (allocation.status !== "issued" && allocation.status !== "partially_used") {
      throw new Error("Can only return issued or partially used allocations");
    }

    const qtyReturned = parseFloat(data.quantityReturned);
    const qtyAllocated = parseFloat(allocation.quantityAllocated);
    const qtyUsed = parseFloat(allocation.quantityUsed);

    if (qtyReturned > qtyAllocated - qtyUsed) {
      throw new Error("Return quantity exceeds allocated quantity");
    }

    // Create return transaction
    await createTransaction(
      {
        itemId: allocation.itemId,
        transactionType: "return",
        quantity: data.quantityReturned,
        jobId: allocation.jobId,
        bidId: allocation.bidId,
        referenceNumber: id,
        notes: data.notes || `Returned from ${allocation.jobId ? "job" : "bid"}`,
      },
      organizationId,
      userId
    );

    // Update allocation
    const [updatedAllocation] = await tx
      .update(inventoryAllocations)
      .set({
        quantityReturned: data.quantityReturned,
        status: "returned",
      })
      .where(eq(inventoryAllocations.id, id))
      .returning();

    // 🔒 LOCK and release allocation from item
    const item = await tx
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, allocation.itemId))
      .for('update')
      .limit(1);

    if (item.length > 0) {
      const newQuantityAllocated = parseFloat(item[0]!.quantityAllocated) - qtyAllocated;
      await tx
        .update(inventoryItems)
        .set({
          quantityAllocated: Math.max(0, newQuantityAllocated).toString(),
        })
        .where(eq(inventoryItems.id, allocation.itemId));
    }

    return updatedAllocation!;
  });
};

export const cancelAllocation = async (
  id: string,
  organizationId: string
) => {
  // 🔐 WRAP IN TRANSACTION
  return await db.transaction(async (tx) => {
    const allocation = await getAllocationById(id, organizationId);
    if (!allocation) throw new Error("Allocation not found");

    // 🔒 LOCK the item row
    const item = await tx
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, allocation.itemId))
      .for('update')
      .limit(1);

    if (item.length > 0) {
      const qtyAllocated = parseFloat(allocation.quantityAllocated);
      const newQuantityAllocated = parseFloat(item[0]!.quantityAllocated) - qtyAllocated;
      const newQuantityAvailable = parseFloat(item[0]!.quantityOnHand) - newQuantityAllocated;

      await tx
        .update(inventoryItems)
        .set({
          quantityAllocated: Math.max(0, newQuantityAllocated).toString(),
          quantityAvailable: newQuantityAvailable.toString(),
        })
        .where(eq(inventoryItems.id, allocation.itemId));
    }

    // Update allocation status
    const [updatedAllocation] = await tx
      .update(inventoryAllocations)
      .set({
        status: "cancelled",
      })
      .where(eq(inventoryAllocations.id, id))
      .returning();

    return updatedAllocation!;
  });
};

export const getAllocationsByJob = async (jobId: string, organizationId: string) => {
  return getAllocations(organizationId, 0, 1000, { jobId });
};

export const getAllocationsByBid = async (bidId: string, organizationId: string) => {
  return getAllocations(organizationId, 0, 1000, { bidId });
};

