import { alias } from "drizzle-orm/pg-core";
import { and, count, eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { users } from "../drizzle/schema/auth.schema.js";
import {
  employees,
  departments,
  positions,
} from "../drizzle/schema/org.schema.js";

const managerUsers = alias(users, "manager_users");

export const getUsers = async (offset: number, limit: number) => {
  const result = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      isVerified: users.isVerified,
      isDeleted: users.isDeleted,
      lastLogin: users.lastLogin,
      employeeId: employees.employeeId,
      departmentName: departments.name,
      positionName: positions.name,
      reportsToName: managerUsers.fullName,
    })
    .from(users)
    .leftJoin(employees, eq(users.id, employees.userId))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .leftJoin(managerUsers, eq(employees.reportsTo, managerUsers.id))
    .where(eq(users.isDeleted, false))
    .limit(limit)
    .offset(offset);
  const total = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.isDeleted, false));

  return {
    data: result || [],
    total: total[0]?.count ?? 0,
  };
};

export const getUserById = async (userId: string) => {
  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      isVerified: users.isVerified,
      isDeleted: users.isDeleted,
      lastLogin: users.lastLogin,
      employeeId: employees.employeeId,
      departmentName: departments.name,
      positionName: positions.name,
      reportsToName: managerUsers.fullName,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .leftJoin(employees, eq(users.id, employees.userId))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .leftJoin(managerUsers, eq(employees.reportsTo, managerUsers.id))
    .where(and(eq(users.id, userId), eq(users.isDeleted, false)));

  return user || null;
};

export const createUser = async (data: {
  fullName: string;
  email: string;
  passwordHash: string;
  phone?: string;
  isActive?: boolean;
  isVerified?: boolean;
}) => {
  const [user] = await db
    .insert(users)
    .values({
      fullName: data.fullName,
      email: data.email,
      passwordHash: data.passwordHash,
      phone: data.phone || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      isVerified: data.isVerified !== undefined ? data.isVerified : false,
    })
    .returning();
  return user;
};

export const updateUser = async (
  userId: string,
  data: {
    fullName?: string;
    email?: string;
    phone?: string;
    isActive?: boolean;
    isVerified?: boolean;
  }
) => {
  const updateData: {
    fullName?: string;
    email?: string;
    phone?: string | null;
    isActive?: boolean;
    isVerified?: boolean;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (data.fullName !== undefined) {
    updateData.fullName = data.fullName;
  }
  if (data.email !== undefined) {
    updateData.email = data.email;
  }
  if (data.phone !== undefined) {
    updateData.phone = data.phone || null;
  }
  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }
  if (data.isVerified !== undefined) {
    updateData.isVerified = data.isVerified;
  }

  const [user] = await db
    .update(users)
    .set(updateData)
    .where(and(eq(users.id, userId), eq(users.isDeleted, false)))
    .returning();
  return user || null;
};

export const deleteUser = async (userId: string) => {
  const [user] = await db
    .update(users)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.isDeleted, false)))
    .returning();
  return user || null;
};
