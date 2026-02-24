/**
 * Reset & Re-seed — Notifications
 *
 * Wipes all notification data (rules, delivery logs, preferences, in-app
 * notifications) and re-seeds the notification rules fresh.
 *
 * Usage:  pnpm run seed:reset-notifications
 */

import { db } from "../../config/db.js";
import { sql } from "drizzle-orm";
import { seedNotificationRules } from "./notificationRules.seed.js";

async function resetNotifications() {
  console.log("🗑️  Starting notification reset...\n");

  // ── Step 1: Clear all notification tables ────────────────────────────────
  console.log("1️⃣  Truncating notification tables...");

  // Delivery log first (references notifications)
  await db.execute(sql`TRUNCATE notifications.notification_delivery_log RESTART IDENTITY CASCADE`);
  // In-app notifications (references users, rules)
  await db.execute(sql`TRUNCATE notifications.notifications RESTART IDENTITY CASCADE`);
  // Preferences (references users)
  await db.execute(sql`TRUNCATE notifications.notification_preferences RESTART IDENTITY CASCADE`);
  // Rules last (referenced by notifications & delivery log, cascade already handled)
  await db.execute(sql`TRUNCATE notifications.notification_rules RESTART IDENTITY CASCADE`);

  console.log("   ✅ All notification tables cleared.\n");

  // ── Step 2: Verify empty ──────────────────────────────────────────────────
  const counts = await db.execute<{ table_name: string; row_count: string }>(sql`
    SELECT 'notification_rules'         AS table_name, COUNT(*)::text AS row_count FROM notifications.notification_rules
    UNION ALL
    SELECT 'notifications',             COUNT(*)::text FROM notifications.notifications
    UNION ALL
    SELECT 'notification_preferences',  COUNT(*)::text FROM notifications.notification_preferences
    UNION ALL
    SELECT 'notification_delivery_log', COUNT(*)::text FROM notifications.notification_delivery_log
  `);

  console.log("2️⃣  Table counts (all should be 0):");
  for (const row of counts.rows) {
    const icon = row.row_count === "0" ? "✅" : "❌";
    console.log(`   ${icon}  ${row.table_name.padEnd(30)} ${row.row_count}`);
  }
  console.log();

  // ── Step 3: Re-seed rules ─────────────────────────────────────────────────
  console.log("3️⃣  Seeding notification rules fresh...\n");
  await seedNotificationRules();

  // ── Step 4: Verify rules were created ────────────────────────────────────
  const [ruleCount] = await db.execute<{ count: string }>(
    sql`SELECT COUNT(*)::text AS count FROM notifications.notification_rules`
  ).then((r) => r.rows);

  console.log(`\n✅ Reset complete — ${ruleCount?.count ?? 0} notification rules seeded.`);
  console.log("   Existing user preferences and in-app notifications have been cleared.\n");
}

resetNotifications()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Notification reset failed:", err);
    process.exit(1);
  });
