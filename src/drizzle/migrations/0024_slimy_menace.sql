ALTER TABLE "org"."inventory_counts" DROP CONSTRAINT "unique_count_number_per_org";--> statement-breakpoint
ALTER TABLE "org"."inventory_items" DROP CONSTRAINT "unique_item_code_per_org";--> statement-breakpoint
ALTER TABLE "org"."inventory_locations" DROP CONSTRAINT "unique_location_code_per_org";--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" DROP CONSTRAINT "unique_po_number_per_org";--> statement-breakpoint
ALTER TABLE "org"."inventory_suppliers" DROP CONSTRAINT "unique_supplier_code_per_org";--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT "unique_transaction_number_per_org";--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" DROP CONSTRAINT "inventory_allocations_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_count_items" DROP CONSTRAINT "inventory_count_items_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_counts" DROP CONSTRAINT "inventory_counts_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_item_history" DROP CONSTRAINT "inventory_item_history_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_item_locations" DROP CONSTRAINT "inventory_item_locations_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_items" DROP CONSTRAINT "inventory_items_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_locations" DROP CONSTRAINT "inventory_locations_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" DROP CONSTRAINT "inventory_purchase_order_items_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" DROP CONSTRAINT "inventory_purchase_orders_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" DROP CONSTRAINT "inventory_stock_alerts_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_suppliers" DROP CONSTRAINT "inventory_suppliers_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP CONSTRAINT "inventory_transactions_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_inventory_allocations_org";--> statement-breakpoint
DROP INDEX "org"."idx_inventory_count_items_org";--> statement-breakpoint
DROP INDEX "org"."idx_inventory_counts_org";--> statement-breakpoint
DROP INDEX "org"."idx_inventory_item_history_org";--> statement-breakpoint
DROP INDEX "org"."idx_inventory_item_locations_org";--> statement-breakpoint
DROP INDEX "org"."idx_inventory_items_org";--> statement-breakpoint
DROP INDEX "org"."idx_inventory_locations_org";--> statement-breakpoint
DROP INDEX "org"."idx_inventory_po_items_org";--> statement-breakpoint
DROP INDEX "org"."idx_inventory_po_org";--> statement-breakpoint
DROP INDEX "org"."idx_inventory_alerts_org";--> statement-breakpoint
DROP INDEX "org"."idx_inventory_suppliers_org";--> statement-breakpoint
DROP INDEX "org"."idx_inventory_transactions_org";--> statement-breakpoint
DROP INDEX "org"."idx_inventory_items_stock_check";--> statement-breakpoint
DROP INDEX "org"."idx_inventory_alerts_active";--> statement-breakpoint
CREATE INDEX "idx_inventory_items_stock_check" ON "org"."inventory_items" USING btree ("quantity_on_hand","reorder_level");--> statement-breakpoint
CREATE INDEX "idx_inventory_alerts_active" ON "org"."inventory_stock_alerts" USING btree ("is_resolved","severity");--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."inventory_count_items" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."inventory_counts" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."inventory_item_history" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."inventory_item_locations" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."inventory_items" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."inventory_locations" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."inventory_suppliers" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."inventory_counts" ADD CONSTRAINT "unique_count_number" UNIQUE("count_number");--> statement-breakpoint
ALTER TABLE "org"."inventory_items" ADD CONSTRAINT "unique_item_code" UNIQUE("item_code");--> statement-breakpoint
ALTER TABLE "org"."inventory_locations" ADD CONSTRAINT "unique_location_code" UNIQUE("location_code");--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" ADD CONSTRAINT "unique_po_number" UNIQUE("po_number");--> statement-breakpoint
ALTER TABLE "org"."inventory_suppliers" ADD CONSTRAINT "unique_supplier_code" UNIQUE("supplier_code");--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "unique_transaction_number" UNIQUE("transaction_number");