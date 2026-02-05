ALTER TABLE "org"."invoice_settings" DROP CONSTRAINT "invoice_settings_organization_id_unique";--> statement-breakpoint
ALTER TABLE "org"."invoice_settings" DROP CONSTRAINT "invoice_settings_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_invoice_settings_org";--> statement-breakpoint
ALTER TABLE "org"."invoice_settings" DROP COLUMN "organization_id";