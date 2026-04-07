/**
 * Migration: Remove "planned" status from job_status_enum
 *
 * 1. Updates all jobs with status = "planned":
 *    - scheduledStartDate <= today  →  "in_progress"
 *    - scheduledStartDate >  today (or null)  →  "scheduled"
 *
 * 2. Recreates the PostgreSQL enum without the "planned" value
 *    (PostgreSQL does not support DROP VALUE on enums — must recreate)
 *
 * Run:  npx tsx src/drizzle/migrations/migrate-planned-jobs.ts
 */

import * as dotenv from "dotenv";
dotenv.config();

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";
import { businessTodayLocalDateString } from "../../utils/naive-datetime.js";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function run() {
  const today = businessTodayLocalDateString();

  console.log("=== Job Status Migration: planned → scheduled/in_progress ===\n");

  // ── Step 1: Preview what will change ──────────────────────────────────────
  const preview = await db.execute(sql`
    SELECT id, job_number, status, scheduled_start_date
    FROM org.jobs
    WHERE status = 'planned'
      AND is_deleted = false
    ORDER BY scheduled_start_date ASC NULLS LAST
  `);

  if (preview.rows.length === 0) {
    console.log("✓ No jobs with status = 'planned' found. Nothing to migrate.");
  } else {
    console.log(`Found ${preview.rows.length} job(s) with status = 'planned':\n`);
    for (const row of preview.rows) {
      const start = row.scheduled_start_date ? String(row.scheduled_start_date).split("T")[0] : null;
      const newStatus = start && start <= today ? "in_progress" : "scheduled";
      console.log(`  ${row.job_number}  (start: ${start ?? "none"})  →  ${newStatus}`);
    }
    console.log();

    // ── Step 2: Update rows ──────────────────────────────────────────────────
    // Use raw SQL with a CASE expression — avoids the enum constraint on the ORM layer
    const updateResult = await db.execute(sql`
      UPDATE org.jobs
      SET
        status = (CASE
          WHEN scheduled_start_date IS NOT NULL
            AND scheduled_start_date::date <= ${today}::date
          THEN 'in_progress'
          ELSE 'scheduled'
        END)::job_status_enum,
        updated_at = NOW()
      WHERE status = 'planned'
        AND is_deleted = false
    `);

    console.log(`✓ Updated ${(updateResult as any).rowCount ?? "?"} job(s).\n`);
  }

  // ── Step 3: Remove "planned" from the PostgreSQL enum ─────────────────────
  // PostgreSQL doesn't support DROP VALUE; we must rename + recreate.
  console.log("Removing 'planned' from org.job_status_enum...");

  await db.execute(sql`
    DO $$
    BEGIN
      -- Only run if 'planned' still exists in the enum
      IF EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'org'
          AND t.typname = 'job_status_enum'
          AND e.enumlabel = 'planned'
      ) THEN

        -- 1. Drop the column default (it still references 'planned')
        ALTER TABLE org.jobs ALTER COLUMN status DROP DEFAULT;

        -- 2. Rename old enum
        ALTER TYPE org.job_status_enum RENAME TO job_status_enum_old;

        -- 3. Create new enum without 'planned'
        CREATE TYPE org.job_status_enum AS ENUM (
          'scheduled',
          'in_progress',
          'on_hold',
          'completed',
          'cancelled',
          'invoiced',
          'closed'
        );

        -- 4. Change column to new enum (safe — no 'planned' rows left after data update above)
        ALTER TABLE org.jobs
          ALTER COLUMN status
          TYPE org.job_status_enum
          USING status::text::org.job_status_enum;

        -- 5. Restore column default with new enum
        ALTER TABLE org.jobs
          ALTER COLUMN status SET DEFAULT 'scheduled'::org.job_status_enum;

        -- 6. Drop old enum
        DROP TYPE org.job_status_enum_old;

        RAISE NOTICE 'job_status_enum recreated without "planned".';
      ELSE
        RAISE NOTICE '"planned" not found in job_status_enum — skipping enum recreation.';
      END IF;
    END
    $$;
  `);

  console.log("✓ Enum updated successfully.\n");
  console.log("=== Migration complete ===");

  await pool.end();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
