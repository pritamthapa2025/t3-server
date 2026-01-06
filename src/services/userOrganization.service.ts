import { count, eq, desc, and, or } from "drizzle-orm";
import { db } from "../config/db.js";
import {
  userOrganizations,
  organizations,
} from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";

// Get user's organization memberships
export const getUserOrganizations = async (userId: string) => {
  return await db
    .select({
      membership: userOrganizations,
      organization: {
        id: organizations.id,
        name: organizations.name,
        clientType: organizations.clientType,
        status: organizations.status,
      },
    })
    .from(userOrganizations)
    .leftJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
    .where(
      and(
        eq(userOrganizations.userId, userId),
        eq(userOrganizations.isActive, true),
        eq(userOrganizations.isDeleted, false)
      )
    )
    .orderBy(desc(userOrganizations.isPrimary), desc(userOrganizations.joinedAt));
};

// Get user's primary organization
export const getUserPrimaryOrganization = async (userId: string) => {
  const result = await db
    .select({
      membership: userOrganizations,
      organization: organizations,
    })
    .from(userOrganizations)
    .leftJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
    .where(
      and(
        eq(userOrganizations.userId, userId),
        eq(userOrganizations.isPrimary, true),
        eq(userOrganizations.isActive, true),
        eq(userOrganizations.isDeleted, false)
      )
    )
    .limit(1);

  return result[0] || null;
};

// Get organization members
export const getOrganizationMembers = async (
  organizationId: string,
  filters?: {
    userType?: string;
    isActive?: boolean;
  }
) => {
  let whereConditions = [
    eq(userOrganizations.organizationId, organizationId),
    eq(userOrganizations.isDeleted, false),
  ];

  if (filters?.userType) {
    whereConditions.push(eq(userOrganizations.userType, filters.userType as any));
  }
  if (filters?.isActive !== undefined) {
    whereConditions.push(eq(userOrganizations.isActive, filters.isActive));
  }

  return await db
    .select({
      membership: userOrganizations,
      user: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        isActive: users.isActive,
      },
    })
    .from(userOrganizations)
    .leftJoin(users, eq(userOrganizations.userId, users.id))
    .where(and(...whereConditions))
    .orderBy(desc(userOrganizations.isPrimary), users.fullName);
};

// Add user to organization
export const addUserToOrganization = async (data: {
  userId: string;
  organizationId: string;
  userType: "t3_employee" | "client_user" | "contractor";
  title?: string;
  isPrimary?: boolean;
}) => {
  // If setting as primary, remove primary from other memberships
  if (data.isPrimary) {
    await db
      .update(userOrganizations)
      .set({ 
        isPrimary: false,
        updatedAt: new Date(),
      })
      .where(eq(userOrganizations.userId, data.userId));
  }

  const [membership] = await db
    .insert(userOrganizations)
    .values({
      userId: data.userId,
      organizationId: data.organizationId,
      userType: data.userType,
      title: data.title || null,
      isPrimary: data.isPrimary || false,
    })
    .returning();

  return membership;
};

// Update user organization membership
export const updateUserOrganizationMembership = async (
  membershipId: string,
  data: {
    userType?: "t3_employee" | "client_user" | "contractor";
    title?: string;
    isPrimary?: boolean;
    isActive?: boolean;
  }
) => {
  // If setting as primary, get the userId first and remove primary from others
  if (data.isPrimary) {
    const currentMembership = await db
      .select({ userId: userOrganizations.userId })
      .from(userOrganizations)
      .where(eq(userOrganizations.id, membershipId))
      .limit(1);

    if (currentMembership[0]) {
      await db
        .update(userOrganizations)
        .set({ 
          isPrimary: false,
          updatedAt: new Date(),
        })
        .where(eq(userOrganizations.userId, currentMembership[0].userId));
    }
  }

  const [membership] = await db
    .update(userOrganizations)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(userOrganizations.id, membershipId))
    .returning();

  return membership || null;
};

// Remove user from organization (soft delete)
export const removeUserFromOrganization = async (
  userId: string,
  organizationId: string
) => {
  const [membership] = await db
    .update(userOrganizations)
    .set({
      isActive: false,
      isDeleted: true,
      leftAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userOrganizations.userId, userId),
        eq(userOrganizations.organizationId, organizationId)
      )
    )
    .returning();

  return membership || null;
};

// Check if user has access to organization
export const checkUserOrganizationAccess = async (
  userId: string,
  organizationId: string
): Promise<boolean> => {
  const result = await db
    .select({ id: userOrganizations.id })
    .from(userOrganizations)
    .where(
      and(
        eq(userOrganizations.userId, userId),
        eq(userOrganizations.organizationId, organizationId),
        eq(userOrganizations.isActive, true),
        eq(userOrganizations.isDeleted, false)
      )
    )
    .limit(1);

  return result.length > 0;
};

// Get user's role in organization
export const getUserOrganizationRole = async (
  userId: string,
  organizationId: string
) => {
  const result = await db
    .select({
      userType: userOrganizations.userType,
      title: userOrganizations.title,
      isPrimary: userOrganizations.isPrimary,
    })
    .from(userOrganizations)
    .where(
      and(
        eq(userOrganizations.userId, userId),
        eq(userOrganizations.organizationId, organizationId),
        eq(userOrganizations.isActive, true),
        eq(userOrganizations.isDeleted, false)
      )
    )
    .limit(1);

  return result[0] || null;
};

// Get T3 employees (internal staff)
export const getT3Employees = async () => {
  return await db
    .select({
      membership: userOrganizations,
      user: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        isActive: users.isActive,
      },
    })
    .from(userOrganizations)
    .leftJoin(users, eq(userOrganizations.userId, users.id))
    .where(
      and(
        eq(userOrganizations.userType, "t3_employee"),
        eq(userOrganizations.isActive, true),
        eq(userOrganizations.isDeleted, false)
      )
    )
    .orderBy(users.fullName);
};

// Get client users for a specific organization
export const getClientUsers = async (organizationId: string) => {
  return await db
    .select({
      membership: userOrganizations,
      user: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        isActive: users.isActive,
      },
    })
    .from(userOrganizations)
    .leftJoin(users, eq(userOrganizations.userId, users.id))
    .where(
      and(
        eq(userOrganizations.organizationId, organizationId),
        eq(userOrganizations.userType, "client_user"),
        eq(userOrganizations.isActive, true),
        eq(userOrganizations.isDeleted, false)
      )
    )
    .orderBy(desc(userOrganizations.isPrimary), users.fullName);
};

















