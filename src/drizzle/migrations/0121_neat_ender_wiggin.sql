ALTER TABLE "org"."bid_history" DROP CONSTRAINT "bid_history_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_bid_history_org";
--> statement-breakpoint
ALTER TABLE "org"."bid_history" DROP COLUMN "organization_id";
--> statement-breakpoint
ALTER TABLE "org"."job_history" DROP CONSTRAINT "job_history_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_job_history_org";
--> statement-breakpoint
ALTER TABLE "org"."job_history" DROP COLUMN "organization_id";
