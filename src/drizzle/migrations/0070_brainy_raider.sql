ALTER TABLE "org"."check_in_out_records" DROP CONSTRAINT "check_in_out_records_dispatch_task_id_dispatch_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" DROP COLUMN "dispatch_task_id";