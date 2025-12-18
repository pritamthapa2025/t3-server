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
 * Get all roles for a specific user
 */
export const getUserRoles = async (userId: string) => {
  const result = await db
    .select({
      roleId: roles.id,
      roleName: roles.name,
      roleDescription: roles.description,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(userRoles.userId, userId), eq(roles.isDeleted, false)));

  return result;
};

/**
 * Assign a role to a user (creates entry in userRoles table)
 */
export const assignRoleToUser = async (userId: string, roleId: number) => {
  // Check if the role assignment already exists
  const existing = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
    .limit(1);

  if (existing.length > 0) {
    // Role already assigned
    return existing[0];
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
};

/**
 * Remove a role from a user
 */
export const removeRoleFromUser = async (userId: string, roleId: number) => {
  const [userRole] = await db
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
    .returning();

  return userRole || null;
};

/**
 * Update user roles - removes all existing roles and assigns new ones
 */
export const updateUserRoles = async (userId: string, roleIds: number[]) => {
  // Delete all existing roles for the user
  await db.delete(userRoles).where(eq(userRoles.userId, userId));

  // If no new roles provided, we're done
  if (!roleIds || roleIds.length === 0) {
    return [];
  }

  // Insert new roles
  const newRoles = roleIds.map((roleId) => ({
    userId,
    roleId,
  }));

  const result = await db.insert(userRoles).values(newRoles).returning();

  return result;
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

