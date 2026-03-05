ALTER TABLE "org"."bid_labor" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."employees" DROP COLUMN IF EXISTS "is_online";--> statement-breakpoint
ALTER TABLE "org"."employees" DROP COLUMN IF EXISTS "last_seen";