ALTER TABLE "org"."dispatch_assignments" ADD COLUMN IF NOT EXISTS "actual_start_time" timestamp;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD COLUMN IF NOT EXISTS "actual_end_time" timestamp;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD COLUMN IF NOT EXISTS "actual_hours" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD COLUMN IF NOT EXISTS "log_notes" text;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD COLUMN IF NOT EXISTS "logged_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD COLUMN IF NOT EXISTS "logged_by" uuid;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dispatch_assignments_logged_by_users_id_fk'
  ) THEN
    ALTER TABLE "org"."dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_logged_by_users_id_fk" FOREIGN KEY ("logged_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;