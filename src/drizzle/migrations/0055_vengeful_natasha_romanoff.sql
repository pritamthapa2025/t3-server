ALTER TABLE "org"."bid_notes" DROP CONSTRAINT "bid_notes_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" DROP CONSTRAINT "bid_timeline_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_bid_notes_org";--> statement-breakpoint
DROP INDEX "org"."idx_bid_timeline_org";--> statement-breakpoint
ALTER TABLE "org"."bid_notes" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" DROP COLUMN "organization_id";