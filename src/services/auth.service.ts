import { eq, is } from "drizzle-orm";
import { db } from "../config/db.js";
import { users } from "../drizzle/schema/auth.schema.js";
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

// Fetch user by ID
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
