-- Remove driver and job columns from assignment_history; driver from vehicles.assignedToEmployeeId, job from vehicles.currentDispatchTaskId
DROP INDEX IF EXISTS "org"."idx_assignment_history_driver";--> statement-breakpoint
DROP INDEX IF EXISTS "org"."idx_assignment_history_job";--> statement-breakpoint
ALTER TABLE "org"."assignment_history" DROP COLUMN IF EXISTS "driver";--> statement-breakpoint
ALTER TABLE "org"."assignment_history" DROP COLUMN IF EXISTS "driver_avatar";--> statement-breakpoint
ALTER TABLE "org"."assignment_history" DROP COLUMN IF EXISTS "driver_id";--> statement-breakpoint
ALTER TABLE "org"."assignment_history" DROP COLUMN IF EXISTS "job_id";--> statement-breakpoint
ALTER TABLE "org"."assignment_history" DROP COLUMN IF EXISTS "job_type";--> statement-breakpoint
ALTER TABLE "org"."assignment_history" DROP COLUMN IF EXISTS "job_location";
