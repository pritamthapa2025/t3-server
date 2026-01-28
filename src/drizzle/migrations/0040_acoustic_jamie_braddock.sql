ALTER TABLE "org"."payments" DROP CONSTRAINT "unique_payment_number_per_org";--> statement-breakpoint
ALTER TABLE "org"."invoice_history" DROP CONSTRAINT "invoice_history_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payments" DROP CONSTRAINT "payments_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_invoice_history_org";--> statement-breakpoint
DROP INDEX "org"."idx_payments_org";--> statement-breakpoint
ALTER TABLE "org"."invoice_history" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."payments" ADD CONSTRAINT "unique_payment_number" UNIQUE("payment_number");