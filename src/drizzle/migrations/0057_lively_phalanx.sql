DROP INDEX "org"."idx_bid_timeline_status";--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" ADD COLUMN "estimated_duration" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" ADD COLUMN "duration_type" varchar(10) DEFAULT 'days' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" ADD COLUMN "is_completed" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX "idx_bid_timeline_is_completed" ON "org"."bid_timeline" USING btree ("is_completed");--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" DROP COLUMN "status";