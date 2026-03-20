ALTER TABLE "org"."jobs" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "org"."jobs" ALTER COLUMN "status" SET DEFAULT 'scheduled'::text;--> statement-breakpoint
-- Legacy "planned" is not in the new enum; map before cast (same rules as migrate-planned-jobs.ts)
UPDATE "org"."jobs"
SET
	"status" = CASE
		WHEN "scheduled_start_date" IS NOT NULL
			AND ("scheduled_start_date"::date <= CURRENT_DATE)
		THEN 'in_progress'
		ELSE 'scheduled'
	END
WHERE "status" = 'planned';--> statement-breakpoint
DROP TYPE "public"."job_status_enum";--> statement-breakpoint
CREATE TYPE "public"."job_status_enum" AS ENUM('scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled', 'invoiced', 'closed');--> statement-breakpoint
ALTER TABLE "org"."jobs" ALTER COLUMN "status" SET DATA TYPE "public"."job_status_enum" USING "status"::"public"."job_status_enum";--> statement-breakpoint
ALTER TABLE "org"."jobs" ALTER COLUMN "status" SET DEFAULT 'scheduled'::"public"."job_status_enum";
