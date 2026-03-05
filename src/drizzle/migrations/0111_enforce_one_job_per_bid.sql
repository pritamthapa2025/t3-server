ALTER TABLE "org"."jobs" DROP CONSTRAINT IF EXISTS "unique_job_number_per_bid";--> statement-breakpoint
-- Remove duplicate jobs, keeping only the one with the highest id per bid_id
DELETE FROM "org"."jobs"
WHERE id NOT IN (
  SELECT DISTINCT ON (bid_id) id
  FROM "org"."jobs"
  WHERE bid_id IS NOT NULL
  ORDER BY bid_id, created_at DESC NULLS LAST, id DESC
);--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD CONSTRAINT "unique_job_per_bid" UNIQUE("bid_id");
