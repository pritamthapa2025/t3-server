ALTER TABLE "org"."assignment_history" ADD COLUMN "job_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."assignment_history" ADD CONSTRAINT "assignment_history_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_assignment_history_job" ON "org"."assignment_history" USING btree ("job_id");