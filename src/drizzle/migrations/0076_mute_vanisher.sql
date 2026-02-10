-- Add task_number as nullable first so existing rows don't fail
ALTER TABLE "org"."job_tasks" ADD COLUMN "task_number" varchar(100);
--> statement-breakpoint
-- Backfill existing rows with TASK-YYYY-NNNN (name-year-4digit) per year
UPDATE "org"."job_tasks" t
SET task_number = sub.tn
FROM (
  SELECT id,
    'TASK-' || EXTRACT(YEAR FROM created_at)::text || '-' || LPAD(ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM created_at) ORDER BY created_at, id)::text, 4, '0') AS tn
  FROM "org"."job_tasks"
  WHERE task_number IS NULL
) sub
WHERE t.id = sub.id;
--> statement-breakpoint
-- Now enforce NOT NULL
ALTER TABLE "org"."job_tasks" ALTER COLUMN "task_number" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "org"."job_tasks" DROP CONSTRAINT "job_tasks_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_job_tasks_org";
--> statement-breakpoint
ALTER TABLE "org"."job_tasks" DROP COLUMN "organization_id";
