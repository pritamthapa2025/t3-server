ALTER TABLE "org"."credit_notes" DROP CONSTRAINT "unique_credit_note_number_per_org";--> statement-breakpoint
ALTER TABLE "org"."credit_note_applications" DROP CONSTRAINT "credit_note_applications_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."credit_notes" DROP CONSTRAINT "credit_notes_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoice_documents" DROP CONSTRAINT "invoice_documents_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoice_reminders" DROP CONSTRAINT "invoice_reminders_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payment_allocations" DROP CONSTRAINT "payment_allocations_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payment_documents" DROP CONSTRAINT "payment_documents_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payment_history" DROP CONSTRAINT "payment_history_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_credit_note_applications_org";--> statement-breakpoint
DROP INDEX "org"."idx_credit_notes_org";--> statement-breakpoint
DROP INDEX "org"."idx_invoice_documents_org";--> statement-breakpoint
DROP INDEX "org"."idx_invoice_reminders_org";--> statement-breakpoint
DROP INDEX "org"."idx_payment_allocations_org";--> statement-breakpoint
DROP INDEX "org"."idx_payment_documents_org";--> statement-breakpoint
DROP INDEX "org"."idx_payment_history_org";--> statement-breakpoint
ALTER TABLE "org"."credit_note_applications" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."credit_notes" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."invoice_documents" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."invoice_reminders" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."payment_allocations" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."payment_documents" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."payment_history" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."credit_notes" ADD CONSTRAINT "unique_credit_note_number" UNIQUE("credit_note_number");