-- Remove driver and job columns from check_in_out_records; driver from vehicles.assignedToEmployeeId, job from vehicles.currentDispatchTaskId
DROP INDEX IF EXISTS "org"."idx_check_in_out_driver";--> statement-breakpoint
DROP INDEX IF EXISTS "org"."idx_check_in_out_job";--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" DROP COLUMN IF EXISTS "driver";--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" DROP COLUMN IF EXISTS "driver_avatar";--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" DROP COLUMN IF EXISTS "driver_id";--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" DROP COLUMN IF EXISTS "job_id";--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" DROP COLUMN IF EXISTS "job_location";
