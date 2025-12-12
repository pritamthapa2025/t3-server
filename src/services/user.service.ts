import { and, count, eq, or, ilike } from "drizzle-orm";
import { db } from "../config/db.js";
import { users } from "../drizzle/schema/auth.schema.js";

export const getUsers = async (
  offset: number,
  limit: number,
  search?: string
) => {
  let whereConditions = [eq(users.isDeleted, false)];

  // Add search filter if provided
  if (search) {
    whereConditions.push(
      or(
        ilike(users.fullName, `%${search}%`),
        ilike(users.email, `%${search}%`),
        ilike(users.phone, `%${search}%`)
      )!
    );
  }

  const result = await db
    .select()
    .from(users)
    .where(and(...whereConditions))
    .limit(limit)
    .offset(offset);

  const total = await db
    .select({ count: count() })
    .from(users)
    .where(and(...whereConditions));

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

export const getUserById = async (userId: string) => {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isDeleted, false)))
    .limit(1);

  return user || null;
};

export const createUser = async (data: {
  fullName: string;
  email: string;
  passwordHash: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  dateOfBirth?: Date | string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  profilePicture?: string;
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
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zipCode: data.zipCode || null,
      dateOfBirth: data.dateOfBirth
        ? typeof data.dateOfBirth === "string"
          ? data.dateOfBirth
          : data.dateOfBirth.toISOString().split("T")[0]
        : null,
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      profilePicture: data.profilePicture || null,
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
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    dateOfBirth?: Date | string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    profilePicture?: string;
    isActive?: boolean;
    isVerified?: boolean;
  }
) => {
  const updateData: any = {
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
  if (data.address !== undefined) {
    updateData.address = data.address || null;
  }
  if (data.city !== undefined) {
    updateData.city = data.city || null;
  }
  if (data.state !== undefined) {
    updateData.state = data.state || null;
  }
  if (data.zipCode !== undefined) {
    updateData.zipCode = data.zipCode || null;
  }
  if (data.dateOfBirth !== undefined) {
    updateData.dateOfBirth = data.dateOfBirth
      ? typeof data.dateOfBirth === "string"
        ? data.dateOfBirth
        : data.dateOfBirth.toISOString().split("T")[0]
      : null;
  }
  if (data.emergencyContactName !== undefined) {
    updateData.emergencyContactName = data.emergencyContactName || null;
  }
  if (data.emergencyContactPhone !== undefined) {
    updateData.emergencyContactPhone = data.emergencyContactPhone || null;
  }
  if (data.profilePicture !== undefined) {
    updateData.profilePicture = data.profilePicture || null;
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
