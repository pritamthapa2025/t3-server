-- Repair: 0033 dropped org.job_history; no migration recreated it before 0121 altered it.
-- Deployments that ran 0033+ therefore hit "relation org.job_history does not exist".
-- Shape matches jobs.schema.ts jobHistory (no organization_id; job_id CASCADE on delete).

CREATE TABLE IF NOT EXISTS "org"."job_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_value" text,
	"new_value" text,
	"description" text,
	"performed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'job_history_job_id_jobs_id_fk'
 ) THEN
   ALTER TABLE "org"."job_history" ADD CONSTRAINT "job_history_job_id_jobs_id_fk"
     FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE CASCADE;
 END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'job_history_performed_by_users_id_fk'
 ) THEN
   ALTER TABLE "org"."job_history" ADD CONSTRAINT "job_history_performed_by_users_id_fk"
     FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id");
 END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_history_job_id" ON "org"."job_history" USING btree ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_history_performed_by" ON "org"."job_history" USING btree ("performed_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_history_created_at" ON "org"."job_history" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_history_action" ON "org"."job_history" USING btree ("action");
