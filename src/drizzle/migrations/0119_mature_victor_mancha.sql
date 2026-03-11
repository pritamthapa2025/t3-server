ALTER TABLE "org"."bids" ADD COLUMN "parent_bid_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "version" varchar(20) DEFAULT 'V1' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_parent_bid_id_bids_id_fk" FOREIGN KEY ("parent_bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;