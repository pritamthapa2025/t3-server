import { db } from "../config/db.js";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger.js";

/**
 * Cleanup duplicate notification rules
 * Keeps the oldest record for each event_type
 */
async function cleanupDuplicateNotificationRules() {
  try {
    logger.info("🔍 Checking for duplicate notification rules...");

    // Show duplicates before cleanup
    const duplicatesBefore = await db.execute(sql`
      SELECT event_type, COUNT(*) as count
      FROM notifications.notification_rules
      GROUP BY event_type
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    if (duplicatesBefore.rows.length === 0) {
      logger.info("✅ No duplicates found!");
      return;
    }

    logger.info(`Found ${duplicatesBefore.rows.length} duplicate event types:`);
    duplicatesBefore.rows.forEach((row: any) => {
      logger.info(`  - ${row.event_type}: ${row.count} records`);
    });

    // Delete duplicates, keeping the oldest record for each event_type
    logger.info("\n🗑️  Deleting duplicates (keeping oldest record)...");
    
    const deleteResult = await db.execute(sql`
      DELETE FROM notifications.notification_rules
      WHERE id IN (
        SELECT id
        FROM (
          SELECT 
            id,
            event_type,
            ROW_NUMBER() OVER (PARTITION BY event_type ORDER BY created_at ASC) as row_num
          FROM notifications.notification_rules
        ) t
        WHERE row_num > 1
      )
    `);

    logger.info(`✅ Deleted ${deleteResult.rowCount} duplicate records`);

    // Show results after cleanup
    const totalAfter = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM notifications.notification_rules
    `);

    logger.info(`\n📊 Total rules after cleanup: ${totalAfter.rows[0]?.count ?? 0}`);

    // Verify no duplicates remain
    const duplicatesAfter = await db.execute(sql`
      SELECT event_type, COUNT(*) as count
      FROM notifications.notification_rules
      GROUP BY event_type
      HAVING COUNT(*) > 1
    `);

    if (duplicatesAfter.rows.length === 0) {
      logger.info("✅ All duplicates removed successfully!");
    } else {
      logger.warn("⚠️  Some duplicates still remain:");
      duplicatesAfter.rows.forEach((row: any) => {
        logger.warn(`  - ${row.event_type}: ${row.count} records`);
      });
    }
  } catch (error) {
    logger.error("❌ Error cleaning up duplicate notification rules:", error);
    throw error;
  }
}

// Run the cleanup
cleanupDuplicateNotificationRules()
  .then(() => {
    logger.info("\n✅ Cleanup complete!");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Failed to cleanup duplicates:", error);
    process.exit(1);
  });
