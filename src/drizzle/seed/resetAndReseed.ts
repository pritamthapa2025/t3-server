/**
 * Reset & Re-seed Script
 *
 * Clears all feature permission tables then re-runs the seed fresh.
 * No seed tracking — always runs clean.
 *
 * Usage:  pnpm run seed:reset
 */

import { db } from "../../config/db.js";
import { sql } from "drizzle-orm";
import { seedFeaturePermissionsInternal } from "./featurePermissions.seed.js";

async function resetAndReseed() {
  console.log("🗑️  Starting reset...\n");

  // ── Step 1: Truncate all feature permission tables ───────────────────────
  console.log("1️⃣  Truncating feature permission tables...");
  await db.execute(sql`TRUNCATE auth.field_permissions  RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE auth.data_filters        RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE auth.role_ui_elements    RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE auth.ui_elements         RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE auth.role_features       RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE auth.features            RESTART IDENTITY CASCADE`);
  console.log("   ✅ All feature tables cleared.\n");

  // ── Step 2: Verify empty ──────────────────────────────────────────────────
  const counts = await db.execute<{ table_name: string; row_count: string }>(sql`
    SELECT 'features'           AS table_name, COUNT(*)::text AS row_count FROM auth.features
    UNION ALL
    SELECT 'role_features',     COUNT(*)::text FROM auth.role_features
    UNION ALL
    SELECT 'data_filters',      COUNT(*)::text FROM auth.data_filters
    UNION ALL
    SELECT 'field_permissions', COUNT(*)::text FROM auth.field_permissions
    UNION ALL
    SELECT 'ui_elements',       COUNT(*)::text FROM auth.ui_elements
    UNION ALL
    SELECT 'role_ui_elements',  COUNT(*)::text FROM auth.role_ui_elements
  `);

  console.log("2️⃣  Table counts (all should be 0):");
  for (const row of counts.rows) {
    const icon = row.row_count === "0" ? "✅" : "❌";
    console.log(`   ${icon}  ${row.table_name.padEnd(20)} ${row.row_count}`);
  }
  console.log();

  // ── Step 3: Re-run the seed ───────────────────────────────────────────────
  console.log("3️⃣  Running feature permissions seed fresh...\n");
  await seedFeaturePermissionsInternal();

  console.log("\n✅ Reset & re-seed complete!");
  console.log("   Run `pnpm run seed:notification-rules` separately if needed.\n");
}

resetAndReseed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Reset failed:", err);
    process.exit(1);
  });
