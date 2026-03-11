ALTER TABLE "org"."bids" ADD COLUMN "root_bid_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "version_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_root_bid_id_bids_id_fk" FOREIGN KEY ("root_bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "version";