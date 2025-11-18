import { count, eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { employees } from "../drizzle/schema/org.schema.js";

export const getEmployees = async (offset: number, limit: number) => {
  const result = await db.select().from(employees).limit(limit).offset(offset);
  const total = await db.select({ count: count() }).from(employees);

  return {
    data: result || [],
    total: total[0]?.count ?? 0,
  };
};

export const getEmployeeById = async (id: number) => {
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, id));
  return employee || null;
};

export const generateEmployeeId = async (): Promise<string> => {
  const totalResult = await db.select({ count: count() }).from(employees);
  const total = totalResult[0]?.count ?? 0;
  const nextNumber = total + 1;
  // Format: T3-00001, T3-00002, etc. (5 digits padding)
  const employeeId = `T3-${String(nextNumber).padStart(5, "0")}`;
  return employeeId;
};

export const createEmployee = async (data: {
  userId: string;
  employeeId?: string;
  departmentId?: number;
  positionId?: number;
  reportsTo?: string;
}) => {
  // Auto-generate employeeId if not provided
  const employeeId = data.employeeId || (await generateEmployeeId());

  const [employee] = await db
    .insert(employees)
    .values({
      userId: data.userId,
      employeeId: employeeId,
      departmentId: data.departmentId || null,
      positionId: data.positionId || null,
      reportsTo: data.reportsTo || null,
    })
    .returning();
  return employee;
};

export const updateEmployee = async (
  id: number,
  data: {
    userId?: string;
    employeeId?: string;
    departmentId?: number;
    positionId?: number;
    reportsTo?: string;
  }
) => {
  const updateData: {
    userId?: string;
    employeeId?: string | null;
    departmentId?: number | null;
    positionId?: number | null;
    reportsTo?: string | null;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (data.userId !== undefined) {
    updateData.userId = data.userId;
  }
  if (data.employeeId !== undefined) {
    updateData.employeeId = data.employeeId || null;
  }
  if (data.departmentId !== undefined) {
    updateData.departmentId = data.departmentId || null;
  }
  if (data.positionId !== undefined) {
    updateData.positionId = data.positionId || null;
  }
  if (data.reportsTo !== undefined) {
    updateData.reportsTo = data.reportsTo || null;
  }

  const [employee] = await db
    .update(employees)
    .set(updateData)
    .where(eq(employees.id, id))
    .returning();
  return employee || null;
};

export const deleteEmployee = async (id: number) => {
  const [employee] = await db
    .delete(employees)
    .where(eq(employees.id, id))
    .returning();
  return employee || null;
};
