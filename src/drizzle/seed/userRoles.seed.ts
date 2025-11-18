import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { userRoles } from "../schema/auth.schema.js"; // Import the user_roles table schema
import { users } from "../schema/auth.schema.js"; // Import the users table schema
import { roles } from "../schema/auth.schema.js"; // Import the roles table schema

export const seedUserRoles = async () => {
  try {
    // Assuming roles are already seeded, and we have user IDs like
    const adminUser = await db
      .select()
      .from(users)
      .where(eq(users.email, "tools@quixta.in"))
      .limit(1);
    const executiveRole = await db
      .select()
      .from(roles)
      .where(eq(roles.name, "Executive"))
      .limit(1);

    if (!adminUser[0] || !executiveRole[0]) {
      throw new Error(
        "Admin user or Executive role not found. Please ensure they're seeded first."
      );
    }

    // Insert admin role for the admin user
    await db
      .insert(userRoles)
      .values([{ userId: adminUser[0].id, roleId: executiveRole[0].id }]);
    console.log("User roles seeded successfully!");
  } catch (error) {
    console.error("Error seeding user roles: ", error);
  }
};
