CREATE TYPE "public"."job_task_status_enum" AS ENUM('backlog', 'in_progress', 'in_review', 'done');--> statement-breakpoint
UPDATE "org"."job_tasks" SET "status" = 'backlog' WHERE "status" = 'pending';--> statement-breakpoint
UPDATE "org"."job_tasks" SET "status" = 'done' WHERE "status" = 'completed';--> statement-breakpoint
UPDATE "org"."job_tasks" SET "status" = 'backlog' WHERE "status" = 'cancelled';--> statement-breakpoint
UPDATE "org"."job_tasks" SET "status" = 'in_review' WHERE "status" = 'review';--> statement-breakpoint
ALTER TABLE "org"."job_tasks" ALTER COLUMN "status" SET DEFAULT 'backlog'::"public"."job_task_status_enum";--> statement-breakpoint
ALTER TABLE "org"."job_tasks" ALTER COLUMN "status" SET DATA TYPE "public"."job_task_status_enum" USING "status"::"public"."job_task_status_enum";