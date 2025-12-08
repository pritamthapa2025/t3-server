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

// Get user's organization ID
export const getUserOrganizationId = async (userId: string): Promise<string | null> => {
  try {
    // Try to get organizationId from employee record first
    // Note: This is a temporary solution - in the future we'll have proper user-org relationships
    
    // For now, get the first organization in the system as a fallback
    const [organization] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .limit(1);

    return organization?.id || null;
  } catch (error) {
    console.error("Error getting user organization:", error);
    return null;
  }
};
