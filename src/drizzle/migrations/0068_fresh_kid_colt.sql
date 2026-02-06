-- Null out orphaned dispatch_task_id so FK constraint can be added (referenced dispatch_tasks may have been deleted)
UPDATE "org"."check_in_out_records"
SET "dispatch_task_id" = NULL
WHERE "dispatch_task_id" IS NOT NULL
  AND "dispatch_task_id" NOT IN (SELECT "id" FROM "org"."dispatch_tasks");--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" ADD COLUMN "job_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" ADD CONSTRAINT "check_in_out_records_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" ADD CONSTRAINT "check_in_out_records_dispatch_task_id_dispatch_tasks_id_fk" FOREIGN KEY ("dispatch_task_id") REFERENCES "org"."dispatch_tasks"("id") ON DELETE no action ON UPDATE no action;