ALTER TABLE "org"."invoices" RENAME COLUMN "subtotal" TO "line_item_sub_total";--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP CONSTRAINT "invoices_purchaseorder_id_inventory_purchase_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD COLUMN "po_sub_total" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD COLUMN "job_subtotal" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD COLUMN "purchase_order_ids" jsonb;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD COLUMN "purchase_order_item_ids" jsonb;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD COLUMN "job_material_ids" jsonb;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD COLUMN "labor_ids" jsonb;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD COLUMN "travel_ids" jsonb;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD COLUMN "operating_expense_ids" jsonb;--> statement-breakpoint
ALTER TABLE "org"."invoices" DROP COLUMN "purchaseorder_id";