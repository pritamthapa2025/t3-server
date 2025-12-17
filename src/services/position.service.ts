import { count, eq, and, or, ilike, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { positions } from "../drizzle/schema/org.schema.js";

export const getPositions = async (
  offset: number,
  limit: number,
  search?: string
) => {
  let whereConditions: any[] = [];

  // Add search filter if provided
  if (search) {
    whereConditions.push(
      or(
        ilike(positions.name, `%${search}%`),
        ilike(positions.description, `%${search}%`)
      )!
    );
  }

  // Add soft delete filter
  whereConditions.push(eq(positions.isDeleted, false));
  const finalWhereClause = and(...whereConditions);

  const result = await db
    .select()
    .from(positions)
    .where(finalWhereClause)
    .limit(limit)
    .offset(offset);

  const total = await db
    .select({ count: count() })
    .from(positions)
    .where(finalWhereClause);

  const totalCount = total[0]?.count ?? 0;

  return {
    data: result || [],
    total: totalCount,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit: limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

export const getPositionById = async (id: number) => {
  const [position] = await db
    .select()
    .from(positions)
    .where(and(eq(positions.id, id), eq(positions.isDeleted, false)));
  return position || null;
};

export const getPositionByName = async (name: string) => {
  const [position] = await db
    .select()
    .from(positions)
    .where(and(eq(positions.name, name), eq(positions.isDeleted, false)));
  return position || null;
};

export const createPosition = async (data: {
  name: string;
  departmentId?: number | null;
  description?: string;
  payRate: number;
  payType: string;
  currency?: string;
  notes?: string;
  isActive?: boolean;
  sortOrder?: number | null;
}) => {
  const [position] = await db
    .insert(positions)
    .values({
      name: data.name,
      departmentId: data.departmentId || null,
      description: data.description || null,
      payRate: String(data.payRate),
      payType: data.payType,
      currency: data.currency || "USD",
      notes: data.notes || null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder || null,
      isDeleted: false,
    })
    .returning();
  return position;
};

export const updatePosition = async (
  id: number,
  data: {
    name?: string;
    departmentId?: number | null;
    description?: string;
    payRate?: number;
    payType?: string;
    currency?: string;
    notes?: string | null;
    isActive?: boolean;
    sortOrder?: number | null;
  }
) => {
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.departmentId !== undefined)
    updateData.departmentId = data.departmentId;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.payRate !== undefined) updateData.payRate = String(data.payRate);
  if (data.payType !== undefined) updateData.payType = data.payType;
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const [position] = await db
    .update(positions)
    .set(updateData)
    .where(and(eq(positions.id, id), eq(positions.isDeleted, false)))
    .returning();
  return position || null;
};

export const deletePosition = async (id: number) => {
  // Soft delete: set isDeleted to true instead of hard delete
  const [position] = await db
    .update(positions)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(and(eq(positions.id, id), eq(positions.isDeleted, false)))
    .returning();
  return position || null;
};

export const getPositionsByDepartment = async (departmentId: number) => {
  // Get positions list filtered by department ID, returning only id and name
  try {
    const result = await db
      .select({
        id: positions.id,
        name: positions.name,
      })
      .from(positions)
      .where(
        and(
          eq(positions.departmentId, departmentId),
          eq(positions.isDeleted, false)
        )
      )
      .orderBy(positions.name);

    return result;
  } catch (error: any) {
    // Log the actual database error for debugging
    console.error("Database error in getPositionsByDepartment:", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
      stack: error?.stack,
    });
    throw error;
  }
};
