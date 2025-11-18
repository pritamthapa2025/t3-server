import { seedRoles } from "./roles.seed.js";
import { seedUserRoles } from "./userRoles.seed.js";
import { seedUsers } from "./users.seed.js";

const runSeeders = async () => {
  try {
    await seedRoles();
    await seedUsers();
    await seedUserRoles();

    console.log("All seeders executed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error running seeders:", error);
    process.exit(1);
  }
};

runSeeders();
