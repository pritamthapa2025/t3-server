ALTER TABLE "org"."dispatch_assignments" RENAME COLUMN "actual_start_time" TO "time_in";--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" RENAME COLUMN "actual_end_time" TO "time_out";