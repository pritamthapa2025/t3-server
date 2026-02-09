import {
  pgSchema,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const seedTrackingSchema = pgSchema("seed_tracking");

/**
 * Seed Tracking Table
 * Tracks which seed files have been executed to prevent duplicates
 */
export const seedTracking = seedTrackingSchema.table(
  "seed_tracking",
  {
    seedName: varchar("seed_name", { length: 255 }).primaryKey(),
    executedAt: timestamp("executed_at").defaultNow().notNull(),
    executedBy: varchar("executed_by", { length: 255 }),
    version: varchar("version", { length: 50 }),
    recordCount: varchar("record_count", { length: 50 }),
  },
  (table) => ({
    executedAtIdx: index("seed_tracking_executed_at_idx").on(table.executedAt),
  })
);

// Type Exports
export type SeedTracking = typeof seedTracking.$inferSelect;
export type NewSeedTracking = typeof seedTracking.$inferInsert;
