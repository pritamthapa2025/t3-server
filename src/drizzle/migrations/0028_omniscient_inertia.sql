ALTER TABLE "org"."bid_survey_data" DROP CONSTRAINT IF EXISTS "bid_survey_data_technician_id_employees_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "org"."idx_bid_survey_technician";--> statement-breakpoint
ALTER TABLE "org"."bids" ALTER COLUMN "expires_date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" DROP COLUMN IF EXISTS "technician_id";