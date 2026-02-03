DROP INDEX "org"."idx_bids_expires_date";--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "start_date";--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "expires_date";--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "expires_in";