-- Create job_design_build_notes table for Design Build project notes
CREATE TABLE IF NOT EXISTS "org"."job_design_build_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "org"."jobs"("id") ON DELETE CASCADE,
  "organization_id" uuid,
  "date" date NOT NULL,
  "phase" varchar(20) NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "photos" text,
  "status" varchar(20) DEFAULT 'draft',
  "created_by" uuid REFERENCES "auth"."users"("id"),
  "author_name" varchar(255),
  "is_deleted" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_job_design_build_notes_job_id" ON "org"."job_design_build_notes" ("job_id");
CREATE INDEX IF NOT EXISTS "idx_job_design_build_notes_phase" ON "org"."job_design_build_notes" ("phase");
CREATE INDEX IF NOT EXISTS "idx_job_design_build_notes_status" ON "org"."job_design_build_notes" ("status");
CREATE INDEX IF NOT EXISTS "idx_job_design_build_notes_is_deleted" ON "org"."job_design_build_notes" ("is_deleted");
