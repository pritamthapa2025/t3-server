ALTER TABLE "org"."jobs" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "org"."jobs" ALTER COLUMN "status" SET DEFAULT 'scheduled'::text;--> statement-breakpoint
DROP TYPE "public"."job_status_enum";--> statement-breakpoint
CREATE TYPE "public"."job_status_enum" AS ENUM('scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled', 'invoiced', 'closed');--> statement-breakpoint
ALTER TABLE "org"."jobs" ALTER COLUMN "status" SET DEFAULT 'scheduled'::"public"."job_status_enum";--> statement-breakpoint
ALTER TABLE "org"."jobs" ALTER COLUMN "status" SET DATA TYPE "public"."job_status_enum" USING "status"::"public"."job_status_enum";