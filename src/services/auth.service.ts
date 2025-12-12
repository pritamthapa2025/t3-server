import { eq, is } from "drizzle-orm";
import { db } from "../config/db.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { employees, organizations } from "../drizzle/schema/org.schema.js";
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

// Lightweight user fetch for authentication (only needed fields, no password)
export const getUserByIdForAuth = async (userId: string) => {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      isActive: users.isActive,
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

// Update user password
export const updatePassword = async (userId: string, passwordHash: string) => {
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
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
