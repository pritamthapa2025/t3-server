ALTER TABLE "org"."invoices" DROP CONSTRAINT "unique_invoice_number_per_org";--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" DROP CONSTRAINT "invoice_line_items_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" DROP CONSTRAINT "invoice_line_items_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" DROP CONSTRAINT "invoice_line_items_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" DROP CONSTRAINT "invoice_line_items_inventory_item_id_inventory_items_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP CONSTRAINT "invoices_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP CONSTRAINT "invoices_client_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP CONSTRAINT "invoices_bid_id_bids_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_invoice_line_items_org";--> statement-breakpoint
DROP INDEX "org"."idx_invoice_line_items_job";--> statement-breakpoint
DROP INDEX "org"."idx_invoice_line_items_bid";--> statement-breakpoint
DROP INDEX "org"."idx_invoice_line_items_inventory";--> statement-breakpoint
DROP INDEX "org"."idx_invoices_org";--> statement-breakpoint
DROP INDEX "org"."idx_invoices_client";--> statement-breakpoint
DROP INDEX "org"."idx_invoices_bid";--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" ADD COLUMN "title" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" DROP COLUMN "tax_rate";--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" DROP COLUMN "job_id";--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" DROP COLUMN "bid_id";--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" DROP COLUMN "inventory_item_id";--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP COLUMN "client_id";--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP COLUMN "bid_id";--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD CONSTRAINT "unique_invoice_number" UNIQUE("invoice_number");