import { count, eq, and, or, ilike } from "drizzle-orm";
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

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const result = await db
    .select()
    .from(positions)
    .where(whereClause)
    .limit(limit)
    .offset(offset);

  const total = await db
    .select({ count: count() })
    .from(positions)
    .where(whereClause);

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
    .where(eq(positions.id, id));
  return position || null;
};

export const getPositionByName = async (name: string) => {
  const [position] = await db
    .select()
    .from(positions)
    .where(eq(positions.name, name));
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
