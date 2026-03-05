CREATE TABLE IF NOT EXISTS "org"."job_design_build_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"organization_id" uuid,
	"date" date NOT NULL,
	"phase" varchar(20) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"photos" text,
	"status" varchar(20) DEFAULT 'draft',
	"created_by" uuid,
	"author_name" varchar(255),
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "org"."job_design_build_notes" ADD CONSTRAINT "job_design_build_notes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "org"."job_design_build_notes" ADD CONSTRAINT "job_design_build_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_design_build_notes_job_id" ON "org"."job_design_build_notes" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_design_build_notes_phase" ON "org"."job_design_build_notes" USING btree ("phase");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_design_build_notes_status" ON "org"."job_design_build_notes" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_design_build_notes_is_deleted" ON "org"."job_design_build_notes" USING btree ("is_deleted");
