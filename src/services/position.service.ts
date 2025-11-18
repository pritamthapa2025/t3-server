import { count, eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { positions } from "../drizzle/schema/org.schema.js";

export const getPositions = async (offset: number, limit: number) => {
  const result = await db
    .select()
    .from(positions)
    .limit(limit)
    .offset(offset);
  const total = await db.select({ count: count() }).from(positions);

  return {
    data: result || [],
    total: total[0]?.count ?? 0,
  };
};

export const getPositionById = async (id: number) => {
  const [position] = await db
    .select()
    .from(positions)
    .where(eq(positions.id, id));
  return position || null;
};

export const createPosition = async (data: {
  name: string;
  departmentId?: number;
  description?: string;
}) => {
  const [position] = await db
    .insert(positions)
    .values({
      name: data.name,
      departmentId: data.departmentId || null,
      description: data.description || null,
    })
    .returning();
  return position;
};

export const updatePosition = async (
  id: number,
  data: { name?: string; departmentId?: number; description?: string }
) => {
  const updateData: {
    name?: string;
    departmentId?: number | null;
    description?: string;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.departmentId !== undefined) {
    updateData.departmentId = data.departmentId || null;
  }
  if (data.description !== undefined) {
    updateData.description = data.description;
  }

  const [position] = await db
    .update(positions)
    .set(updateData)
    .where(eq(positions.id, id))
    .returning();
  return position || null;
};

export const deletePosition = async (id: number) => {
  const [position] = await db
    .delete(positions)
    .where(eq(positions.id, id))
    .returning();
  return position || null;
};

