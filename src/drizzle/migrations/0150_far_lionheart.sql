ALTER TABLE "org"."timesheet_job_entries" ADD COLUMN "break_start_time" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."timesheet_job_entries" ADD COLUMN "break2_taken" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."timesheet_job_entries" ADD COLUMN "break2_minutes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "org"."timesheet_job_entries" ADD COLUMN "break2_start_time" varchar(10);