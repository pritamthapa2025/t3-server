DROP INDEX "org"."idx_dispatch_assignments_clock_in";--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" DROP COLUMN "clock_in";--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" DROP COLUMN "clock_out";--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" DROP COLUMN "actual_duration";