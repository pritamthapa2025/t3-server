CREATE TABLE "org"."inventory_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"price_type" varchar(50) NOT NULL,
	"old_price" numeric(15, 2),
	"new_price" numeric(15, 2) NOT NULL,
	"supplier_id" uuid,
	"purchase_order_id" uuid,
	"reason" varchar(100),
	"effective_date" date NOT NULL,
	"notes" text,
	"performed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "org"."inventory_price_history" ADD CONSTRAINT "inventory_price_history_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_price_history" ADD CONSTRAINT "inventory_price_history_supplier_id_inventory_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "org"."inventory_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_price_history" ADD CONSTRAINT "inventory_price_history_purchase_order_id_inventory_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "org"."inventory_purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_price_history" ADD CONSTRAINT "inventory_price_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inventory_price_history_item" ON "org"."inventory_price_history" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_price_history_type" ON "org"."inventory_price_history" USING btree ("price_type");--> statement-breakpoint
CREATE INDEX "idx_inventory_price_history_date" ON "org"."inventory_price_history" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "idx_inventory_price_history_supplier" ON "org"."inventory_price_history" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_price_history_item_date" ON "org"."inventory_price_history" USING btree ("item_id","effective_date");