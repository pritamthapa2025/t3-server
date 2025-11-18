import { db } from "../../config/db.js";
import { roles } from "../schema/auth.schema.js";

export const seedRoles = async () => {
  try {
    await db
      .insert(roles)
      .values([
        {
          name: "Executive",
          description:
            "Responsible for high-level decision making and overseeing departments",
        },
        {
          name: "Manager",
          description:
            "Manages daily operations and team performance within their department",
        },
        {
          name: "Field Technician",
          description:
            "Performs technical tasks in the field and assists clients on-site",
        },
        {
          name: "Client",
          description:
            "External user with limited access to view and manage their own data",
        },
      ])
      .onConflictDoNothing();
    console.log("Roles seeded successfully!");
  } catch (error) {
    console.error("Error seeding roles: ", error);
  }
};
