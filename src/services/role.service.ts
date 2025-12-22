import { eq, and } from "drizzle-orm";
import { db } from "../config/db.js";
import { roles, userRoles } from "../drizzle/schema/auth.schema.js";

/**
 * Get role by ID
 */
export const getRoleById = async (roleId: number) => {
  const [role] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.isDeleted, false)))
    .limit(1);

  return role || null;
};

/**
 * Get the role for a specific user (one user, one role)
 */
export const getUserRoles = async (userId: string) => {
  const [result] = await db
    .select({
      roleId: roles.id,
      roleName: roles.name,
      roleDescription: roles.description,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(userRoles.userId, userId), eq(roles.isDeleted, false)))
    .limit(1);

  return result || null;
};

/**
 * Assign a role to a user (upserts entry in userRoles table)
 * Since userId is the primary key, this will update existing role or create new one
 */
export const assignRoleToUser = async (userId: string, roleId: number) => {
  try {
    // Check if user already has a role assigned
    const existing = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing role assignment
      const [userRole] = await db
        .update(userRoles)
        .set({ roleId })
        .where(eq(userRoles.userId, userId))
        .returning();

      return userRole;
    }

    // Create new role assignment
    const [userRole] = await db
      .insert(userRoles)
      .values({
        userId,
        roleId,
      })
      .returning();

    return userRole;
  } catch (error: any) {
    // Add more context to the error
    if (error.code === "23503") {
      // Foreign key violation
      if (error.constraint?.includes("user_id")) {
        throw new Error(`User with ID ${userId} does not exist`);
      }
      if (error.constraint?.includes("role_id")) {
        throw new Error(`Role with ID ${roleId} does not exist`);
      }
    }
    if (error.code === "23505") {
      // Unique constraint violation (shouldn't happen with PK, but just in case)
      throw new Error(`User ${userId} already has a role assigned`);
    }
    throw error;
  }
};

/**
 * Remove role from a user (deletes the user's role assignment)
 * Since one user can only have one role, we only need userId
 */
export const removeRoleFromUser = async (userId: string) => {
  const [userRole] = await db
    .delete(userRoles)
    .where(eq(userRoles.userId, userId))
    .returning();

  return userRole || null;
};

/**
 * Update user role - assigns a single role to a user (one user, one role)
 * If roleId is null/undefined, removes the user's role
 */
export const updateUserRoles = async (userId: string, roleId: number | null | undefined) => {
  // If no role provided, remove existing role
  if (roleId === null || roleId === undefined) {
    const [deleted] = await db
      .delete(userRoles)
      .where(eq(userRoles.userId, userId))
      .returning();
    return deleted || null;
  }

  // Use assignRoleToUser which handles upsert logic
  return await assignRoleToUser(userId, roleId);
};

/**
 * Get all available roles
 */
export const getAllRoles = async () => {
  const result = await db
    .select()
    .from(roles)
    .where(eq(roles.isDeleted, false))
    .orderBy(roles.name);

  return result;
};

