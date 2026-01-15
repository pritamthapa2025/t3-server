// src/drizzle/seed/users.seed.ts
import { db } from "../../config/db.js";
import { users } from "../schema/auth.schema.js"; // Import the users schema from Drizzle
import { hashPassword } from "../../utils/hash.js"; // Hashing utility for passwords

export const seedUsers = async () => {
  try {
    const hashedPassword = await hashPassword("password");

    await db
      .insert(users)
      .values([
        {
          fullName: "Admin",
          email: "tools@quixta.in",
          passwordHash: hashedPassword,
          isActive: true,
        },
      ])
      .onConflictDoNothing();
    console.log("Users seeded successfully!");
  } catch (error) {
    console.error("Error seeding users: ", error);
  }
};
