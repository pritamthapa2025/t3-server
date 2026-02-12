ALTER TABLE "org"."payment_allocations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "org"."payment_allocations" CASCADE;--> statement-breakpoint
ALTER TABLE "org"."payments" DROP CONSTRAINT "payments_client_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payments" DROP CONSTRAINT "payments_processed_by_users_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_payments_client";--> statement-breakpoint
DROP INDEX "org"."idx_payments_status";--> statement-breakpoint
DROP INDEX "org"."idx_payments_method";--> statement-breakpoint
DROP INDEX "org"."idx_payments_received_date";--> statement-breakpoint
ALTER TABLE "org"."payments" ALTER COLUMN "invoice_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "client_id";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "payment_type";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "exchange_rate";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "received_date";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "processed_date";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "cleared_date";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "check_number";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "transaction_id";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "bank_name";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "account_last_four";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "processing_fee";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "late_fee";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "discount_applied";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "adjustment_amount";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "adjustment_reason";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "internal_notes";--> statement-breakpoint
ALTER TABLE "org"."payments" DROP COLUMN "processed_by";