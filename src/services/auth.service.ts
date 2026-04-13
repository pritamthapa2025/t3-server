import { eq, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { users, userRoles, roles } from "../drizzle/schema/auth.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";
import { comparePassword } from "../utils/hash.js";

// Fetch user by email
export const getUserByEmail = async (email: string) => {
  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
      isVerified: users.isVerified,
      isDeleted: users.isDeleted,
      setupTokenUsedAt: users.setupTokenUsedAt,
    })
    .from(users)
    .where(eq(users.email, email));

  return user || null;
};

// Fetch user by ID (full user data - for password operations)
export const getUserById = async (userId: string) => {
  // Find user by ID
  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
      isVerified: users.isVerified,
      isDeleted: users.isDeleted,
    })
    .from(users)
    .where(eq(users.id, userId));

  return user || null;
};

// Full user fetch for profile (all fields except password)
export const getUserByIdForProfile = async (userId: string) => {
  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      profilePicture: users.profilePicture,
      isActive: users.isActive,
      isVerified: users.isVerified,
      isDeleted: users.isDeleted,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId));

  return user || null;
};

/**
 * Single round-trip for GET /auth/me: profile fields + role + employee row.
 * user_roles.user_id is PK so at most one role row per user.
 */
export const getMeProfileBundle = async (userId: string) => {
  const [row] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      profilePicture: users.profilePicture,
      isActive: users.isActive,
      isVerified: users.isVerified,
      isDeleted: users.isDeleted,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      roleName: roles.name,
      employeeTableId: employees.id,
      employeeCode: employees.employeeId,
      timesheetBlockedForSafetyInspection:
        employees.timesheetBlockedSafetyInspection,
    })
    .from(users)
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(employees, eq(users.id, employees.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return row ?? null;
};

/** Full row from getMeProfileBundle — used by auth middleware cache and GET /auth/me. */
export type AuthMeProfileRow = NonNullable<
  Awaited<ReturnType<typeof getMeProfileBundle>>
>;

/** Map profile bundle to the slim shape sockets and auth gates use (no second DB round-trip). */
export const mapProfileToAuthGate = (row: AuthMeProfileRow) => ({
  id: row.id,
  email: row.email,
  fullName: row.fullName,
  isActive: row.isActive,
  isDeleted: row.isDeleted,
  employeeId: row.employeeTableId ?? null,
  employeeNumber: row.employeeCode ?? null,
});

/**
 * Same single query as GET /auth/me — one round-trip for sockets and auth gate checks.
 */
export const getUserByIdForAuth = async (userId: string) => {
  const row = await getMeProfileBundle(userId);
  return row ? mapProfileToAuthGate(row) : null;
};

// Update user password
export const updatePassword = async (userId: string, passwordHash: string) => {
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
};

/** Persist last successful sign-in time (password + 2FA or trusted device). */
export const updateUserLastLogin = async (userId: string) => {
  const now = new Date();
  await db
    .update(users)
    .set({
      // Naive `timestamp`: UTC clock reading, no timezone stored in the column
      lastLogin: sql`(now() AT TIME ZONE 'UTC')`,
      updatedAt: now,
    })
    .where(eq(users.id, userId));
};

// Mark the one-time new-user setup token as consumed.
// Call this immediately after a successful password setup so the link cannot be reused.
export const markSetupTokenUsed = async (userId: string) => {
  await db
    .update(users)
    .set({ setupTokenUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
};

// Verify the user's password
export const verifyPassword = async (user: any, password: string) => {
  return comparePassword(password, user.passwordHash);
};

// Note: getUserOrganizationId removed - employees work for T3, not client organizations
// Organizations table now contains client companies that T3 serves

// Get employee record for user (T3 internal staff)
export const getEmployeeByUserId = async (
  userId: string
): Promise<{ id: number; employeeId: string | null } | null> => {
  try {
    const [employee] = await db
      .select({ 
        id: employees.id, 
        employeeId: employees.employeeId 
      })
      .from(employees)
      .where(eq(employees.userId, userId))
      .limit(1);

    return employee || null;
  } catch (error) {
    console.error("Error getting employee record:", error);
    return null;
  }
};
