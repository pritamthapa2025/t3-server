import { db } from "../config/db.js";
import { seedTracking } from "../drizzle/schema/seedTracking.schema.js";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Check if a seed has already been executed
 */
export async function hasBeenSeeded(seedName: string): Promise<boolean> {
  try {
    const result = await db
      .select()
      .from(seedTracking)
      .where(eq(seedTracking.seedName, seedName))
      .limit(1);

    return result.length > 0;
  } catch (error) {
    // If table doesn't exist yet (first migration), return false
    logger.warn(`Seed tracking table may not exist yet: ${error}`);
    return false;
  }
}

/**
 * Mark a seed as executed
 */
export async function markSeeded(
  seedName: string,
  recordCount?: number,
  version?: string
): Promise<void> {
  try {
    await db
      .insert(seedTracking)
      .values({
        seedName,
        executedAt: new Date(),
        recordCount: recordCount?.toString() || null,
        version: version || "1.0.0",
      })
      .onConflictDoUpdate({
        target: seedTracking.seedName,
        set: {
          executedAt: new Date(),
          recordCount: recordCount?.toString() || null,
          version: version || "1.0.0",
        },
      });

    logger.info(`✅ Marked seed as executed: ${seedName}`);
  } catch (error) {
    logger.error(`❌ Failed to mark seed as executed: ${seedName}`, error);
  }
}

/**
 * Wrapper function to run a seed only once
 */
export async function runSeedOnce(
  seedName: string,
  seedFunction: () => Promise<number>,
  version?: string
): Promise<void> {
  const alreadySeeded = await hasBeenSeeded(seedName);

  if (alreadySeeded) {
    logger.info(`⏭️  Seed already executed, skipping: ${seedName}`);
    return;
  }

  logger.info(`🌱 Running seed: ${seedName}`);
  const recordCount = await seedFunction();
  await markSeeded(seedName, recordCount, version);
}
