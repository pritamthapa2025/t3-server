ALTER TABLE "org"."bid_materials" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_materials" ADD COLUMN "inventory_item_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."bid_materials" ADD COLUMN "custome_name" text;--> statement-breakpoint
ALTER TABLE "org"."bid_materials" ADD CONSTRAINT "bid_materials_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "org"."inventory_items"("id") ON DELETE no action ON UPDATE no action;