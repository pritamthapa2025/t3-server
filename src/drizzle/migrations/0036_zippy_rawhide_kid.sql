ALTER TABLE "org"."bid_documents" DROP CONSTRAINT "bid_documents_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_bid_documents_org";--> statement-breakpoint
ALTER TABLE "org"."bid_documents" DROP COLUMN "organization_id";