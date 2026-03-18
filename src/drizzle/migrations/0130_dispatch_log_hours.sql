ALTER TABLE "org"."dispatch_assignments"
  ADD COLUMN IF NOT EXISTS "actual_start_time" timestamp,
  ADD COLUMN IF NOT EXISTS "actual_end_time" timestamp,
  ADD COLUMN IF NOT EXISTS "actual_hours" numeric(6,2),
  ADD COLUMN IF NOT EXISTS "log_notes" text,
  ADD COLUMN IF NOT EXISTS "logged_at" timestamp,
  ADD COLUMN IF NOT EXISTS "logged_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL;
