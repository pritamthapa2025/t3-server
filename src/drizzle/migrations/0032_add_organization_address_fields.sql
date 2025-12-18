-- Add address fields to organizations table
ALTER TABLE "org"."organizations" ADD COLUMN "street_address" varchar(255);
--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN "city" varchar(100);
--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN "state" varchar(50);
--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN "zip_code" varchar(20);
--> statement-breakpoint
-- Add index for city and state lookup
CREATE INDEX IF NOT EXISTS "idx_orgs_city_state" ON "org"."organizations" USING btree ("city","state");

