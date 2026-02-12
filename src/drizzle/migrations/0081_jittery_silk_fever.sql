ALTER TABLE "org"."invoice_line_items" RENAME COLUMN "unit_price" TO "quoted_price";--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" RENAME COLUMN "line_total" TO "billed_total";--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" ADD COLUMN "billing_percentage" numeric(10, 2) DEFAULT '100' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD COLUMN "is_labor" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD COLUMN "is_travel" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD COLUMN "is_operating_expense" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD COLUMN "is_material" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" DROP COLUMN "discount_amount";--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" DROP COLUMN "tax_amount";--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP COLUMN "purchase_order_item_ids";--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP COLUMN "job_material_ids";--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP COLUMN "labor_ids";--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP COLUMN "travel_ids";--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP COLUMN "operating_expense_ids";