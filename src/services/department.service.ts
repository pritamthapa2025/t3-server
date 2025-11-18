import { count, eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { departments } from "../drizzle/schema/org.schema.js";

export const getDepartments = async (offset: number, limit: number) => {
  const result = await db
    .select()
    .from(departments)
    .limit(limit)
    .offset(offset);
  const total = await db.select({ count: count() }).from(departments);

  return {
    data: result || [],
    total: total[0]?.count ?? 0,
  };
};

export const getDepartmentById = async (id: number) => {
  const [department] = await db
    .select()
    .from(departments)
    .where(eq(departments.id, id));
  return department || null;
};

export const createDepartment = async (data: {
  name: string;
  description?: string;
}) => {
  const [department] = await db
    .insert(departments)
    .values({
      name: data.name,
      description: data.description || null,
    })
    .returning();
  return department;
};

export const updateDepartment = async (
  id: number,
  data: { name?: string; description?: string }
) => {
  const updateData: { name?: string; description?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.description !== undefined) {
    updateData.description = data.description;
  }

  const [department] = await db
    .update(departments)
    .set(updateData)
    .where(eq(departments.id, id))
    .returning();
  return department || null;
};

export const deleteDepartment = async (id: number) => {
  const [department] = await db
    .delete(departments)
    .where(eq(departments.id, id))
    .returning();
  return department || null;
};
