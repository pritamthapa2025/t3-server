ALTER TABLE "org"."employees" ADD COLUMN "is_online" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN "last_seen" timestamp;