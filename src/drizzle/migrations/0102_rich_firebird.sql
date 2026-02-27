ALTER TABLE "org"."bid_labor" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."employees" DROP COLUMN "is_online";--> statement-breakpoint
ALTER TABLE "org"."employees" DROP COLUMN "last_seen";