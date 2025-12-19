CREATE TYPE "public"."inventory_allocation_status_enum" AS ENUM('allocated', 'issued', 'partially_used', 'fully_used', 'returned', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."inventory_stock_status_enum" AS ENUM('in_stock', 'low_stock', 'out_of_stock', 'on_order', 'discontinued');--> statement-breakpoint
CREATE TYPE "public"."inventory_transaction_type_enum" AS ENUM('receipt', 'issue', 'adjustment', 'transfer', 'return', 'write_off', 'initial_stock');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status_enum" AS ENUM('draft', 'pending_approval', 'approved', 'sent', 'partially_received', 'received', 'cancelled', 'closed');--> statement-breakpoint
CREATE TABLE "org"."inventory_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"job_id" uuid,
	"bid_id" uuid,
	"quantity_allocated" numeric(10, 2) NOT NULL,
	"quantity_used" numeric(10, 2) DEFAULT '0' NOT NULL,
	"quantity_returned" numeric(10, 2) DEFAULT '0' NOT NULL,
	"allocation_date" date DEFAULT now() NOT NULL,
	"expected_use_date" date,
	"actual_use_date" date,
	"status" "inventory_allocation_status_enum" DEFAULT 'allocated' NOT NULL,
	"allocated_by" uuid NOT NULL,
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."inventory_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"code" varchar(20),
	"color" varchar(7),
	"icon" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "inventory_categories_name_unique" UNIQUE("name"),
	CONSTRAINT "inventory_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "org"."inventory_count_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"count_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"system_quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"counted_quantity" numeric(10, 2),
	"variance" numeric(10, 2),
	"variance_percentage" numeric(5, 2),
	"unit_cost" numeric(15, 2),
	"variance_cost" numeric(15, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_count_item" UNIQUE("count_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "org"."inventory_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"count_number" varchar(100) NOT NULL,
	"count_type" varchar(50) NOT NULL,
	"location_id" uuid,
	"count_date" date NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"status" varchar(50) NOT NULL,
	"performed_by" uuid,
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_count_number_per_org" UNIQUE("organization_id","count_number")
);
--> statement-breakpoint
CREATE TABLE "org"."inventory_item_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"field_changed" varchar(100),
	"old_value" text,
	"new_value" text,
	"description" text,
	"performed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."inventory_item_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"bin_number" varchar(50),
	"aisle" varchar(50),
	"shelf" varchar(50),
	"last_counted_date" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_item_location" UNIQUE("item_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "org"."inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category_id" integer NOT NULL,
	"primary_supplier_id" uuid,
	"unit_of_measure_id" integer NOT NULL,
	"unit_cost" numeric(15, 2) DEFAULT '0' NOT NULL,
	"last_purchase_price" numeric(15, 2),
	"average_cost" numeric(15, 2),
	"selling_price" numeric(15, 2),
	"quantity_on_hand" numeric(10, 2) DEFAULT '0' NOT NULL,
	"quantity_allocated" numeric(10, 2) DEFAULT '0' NOT NULL,
	"quantity_available" numeric(10, 2) DEFAULT '0' NOT NULL,
	"quantity_on_order" numeric(10, 2) DEFAULT '0' NOT NULL,
	"reorder_level" numeric(10, 2) DEFAULT '0' NOT NULL,
	"reorder_quantity" numeric(10, 2),
	"max_stock_level" numeric(10, 2),
	"primary_location_id" uuid,
	"manufacturer" varchar(150),
	"model_number" varchar(100),
	"part_number" varchar(100),
	"barcode" varchar(100),
	"weight" numeric(10, 2),
	"weight_unit" varchar(20),
	"dimensions" varchar(100),
	"specifications" jsonb,
	"tags" jsonb,
	"images" jsonb,
	"track_by_serial_number" boolean DEFAULT false,
	"track_by_batch" boolean DEFAULT false,
	"status" "inventory_stock_status_enum" DEFAULT 'in_stock' NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_restocked_date" date,
	"last_counted_date" date,
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_item_code_per_org" UNIQUE("organization_id","item_code")
);
--> statement-breakpoint
CREATE TABLE "org"."inventory_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_code" varchar(50),
	"name" varchar(255) NOT NULL,
	"location_type" varchar(50),
	"parent_location_id" uuid,
	"street_address" varchar(255),
	"city" varchar(100),
	"state" varchar(50),
	"zip_code" varchar(20),
	"capacity" numeric(10, 2),
	"capacity_unit" varchar(20),
	"manager_id" uuid,
	"access_instructions" text,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_location_code_per_org" UNIQUE("organization_id","location_code")
);
--> statement-breakpoint
CREATE TABLE "org"."inventory_purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"quantity_ordered" numeric(10, 2) DEFAULT '0' NOT NULL,
	"quantity_received" numeric(10, 2) DEFAULT '0' NOT NULL,
	"unit_cost" numeric(15, 2) NOT NULL,
	"line_total" numeric(15, 2) NOT NULL,
	"expected_delivery_date" date,
	"actual_delivery_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_po_item" UNIQUE("purchase_order_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "org"."inventory_purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"po_number" varchar(100) NOT NULL,
	"supplier_id" uuid NOT NULL,
	"order_date" date NOT NULL,
	"expected_delivery_date" date,
	"actual_delivery_date" date,
	"status" "purchase_order_status_enum" DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0',
	"shipping_cost" numeric(15, 2) DEFAULT '0',
	"total_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ship_to_location_id" uuid,
	"shipping_address" text,
	"tracking_number" varchar(100),
	"payment_terms" varchar(100),
	"payment_status" varchar(50),
	"amount_paid" numeric(15, 2) DEFAULT '0',
	"supplier_invoice_number" varchar(100),
	"notes" text,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_po_number_per_org" UNIQUE("organization_id","po_number")
);
--> statement-breakpoint
CREATE TABLE "org"."inventory_stock_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"alert_type" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"current_quantity" numeric(10, 2),
	"threshold_quantity" numeric(10, 2),
	"is_acknowledged" boolean DEFAULT false,
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp,
	"is_resolved" boolean DEFAULT false,
	"resolved_by" uuid,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."inventory_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_code" varchar(50),
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"contact_name" varchar(150),
	"email" varchar(150),
	"phone" varchar(20),
	"website" varchar(255),
	"street_address" varchar(255),
	"city" varchar(100),
	"state" varchar(50),
	"zip_code" varchar(20),
	"country" varchar(100) DEFAULT 'USA',
	"tax_id" varchar(50),
	"account_number" varchar(100),
	"payment_terms" varchar(100),
	"credit_limit" numeric(15, 2),
	"rating" numeric(3, 2),
	"lead_time_days" integer,
	"is_active" boolean DEFAULT true,
	"is_preferred" boolean DEFAULT false,
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_supplier_code_per_org" UNIQUE("organization_id","supplier_code")
);
--> statement-breakpoint
CREATE TABLE "org"."inventory_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"transaction_number" varchar(100) NOT NULL,
	"item_id" uuid NOT NULL,
	"location_id" uuid,
	"transaction_type" "inventory_transaction_type_enum" NOT NULL,
	"transaction_date" timestamp DEFAULT now() NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_cost" numeric(15, 2),
	"total_cost" numeric(15, 2),
	"balance_after" numeric(10, 2),
	"purchase_order_id" uuid,
	"job_id" uuid,
	"bid_id" uuid,
	"from_location_id" uuid,
	"to_location_id" uuid,
	"batch_number" varchar(100),
	"serial_number" varchar(100),
	"expiration_date" date,
	"reference_number" varchar(100),
	"notes" text,
	"performed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_transaction_number_per_org" UNIQUE("organization_id","transaction_number")
);
--> statement-breakpoint
CREATE TABLE "org"."inventory_units_of_measure" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"abbreviation" varchar(10) NOT NULL,
	"unit_type" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "inventory_units_of_measure_name_unique" UNIQUE("name"),
	CONSTRAINT "inventory_units_of_measure_abbreviation_unique" UNIQUE("abbreviation")
);
--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" ADD CONSTRAINT "inventory_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" ADD CONSTRAINT "inventory_allocations_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" ADD CONSTRAINT "inventory_allocations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" ADD CONSTRAINT "inventory_allocations_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_allocations" ADD CONSTRAINT "inventory_allocations_allocated_by_users_id_fk" FOREIGN KEY ("allocated_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_count_items" ADD CONSTRAINT "inventory_count_items_count_id_inventory_counts_id_fk" FOREIGN KEY ("count_id") REFERENCES "org"."inventory_counts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_count_items" ADD CONSTRAINT "inventory_count_items_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_count_items" ADD CONSTRAINT "inventory_count_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_counts" ADD CONSTRAINT "inventory_counts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_counts" ADD CONSTRAINT "inventory_counts_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_counts" ADD CONSTRAINT "inventory_counts_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_item_history" ADD CONSTRAINT "inventory_item_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_item_history" ADD CONSTRAINT "inventory_item_history_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_item_history" ADD CONSTRAINT "inventory_item_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_item_locations" ADD CONSTRAINT "inventory_item_locations_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_item_locations" ADD CONSTRAINT "inventory_item_locations_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_item_locations" ADD CONSTRAINT "inventory_item_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_items" ADD CONSTRAINT "inventory_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_items" ADD CONSTRAINT "inventory_items_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "org"."inventory_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_items" ADD CONSTRAINT "inventory_items_primary_supplier_id_inventory_suppliers_id_fk" FOREIGN KEY ("primary_supplier_id") REFERENCES "org"."inventory_suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_items" ADD CONSTRAINT "inventory_items_unit_of_measure_id_inventory_units_of_measure_id_fk" FOREIGN KEY ("unit_of_measure_id") REFERENCES "org"."inventory_units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_items" ADD CONSTRAINT "inventory_items_primary_location_id_inventory_locations_id_fk" FOREIGN KEY ("primary_location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_locations" ADD CONSTRAINT "inventory_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_locations" ADD CONSTRAINT "inventory_locations_parent_location_id_inventory_locations_id_fk" FOREIGN KEY ("parent_location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_locations" ADD CONSTRAINT "inventory_locations_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" ADD CONSTRAINT "inventory_purchase_order_items_purchase_order_id_inventory_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "org"."inventory_purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" ADD CONSTRAINT "inventory_purchase_order_items_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_order_items" ADD CONSTRAINT "inventory_purchase_order_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" ADD CONSTRAINT "inventory_purchase_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" ADD CONSTRAINT "inventory_purchase_orders_supplier_id_inventory_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "org"."inventory_suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" ADD CONSTRAINT "inventory_purchase_orders_ship_to_location_id_inventory_locations_id_fk" FOREIGN KEY ("ship_to_location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" ADD CONSTRAINT "inventory_purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_purchase_orders" ADD CONSTRAINT "inventory_purchase_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" ADD CONSTRAINT "inventory_stock_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" ADD CONSTRAINT "inventory_stock_alerts_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" ADD CONSTRAINT "inventory_stock_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_stock_alerts" ADD CONSTRAINT "inventory_stock_alerts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_suppliers" ADD CONSTRAINT "inventory_suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "org"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_location_id_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_purchase_order_id_inventory_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "org"."inventory_purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_from_location_id_inventory_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_to_location_id_inventory_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "org"."inventory_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inventory_allocations_org" ON "org"."inventory_allocations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_allocations_item" ON "org"."inventory_allocations" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_allocations_job" ON "org"."inventory_allocations" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_allocations_bid" ON "org"."inventory_allocations" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_allocations_status" ON "org"."inventory_allocations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_inventory_allocations_date" ON "org"."inventory_allocations" USING btree ("allocation_date");--> statement-breakpoint
CREATE INDEX "idx_inventory_allocations_deleted" ON "org"."inventory_allocations" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_inventory_allocations_active" ON "org"."inventory_allocations" USING btree ("item_id","status","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_inventory_categories_active" ON "org"."inventory_categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_inventory_categories_code" ON "org"."inventory_categories" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_inventory_count_items_count" ON "org"."inventory_count_items" USING btree ("count_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_count_items_item" ON "org"."inventory_count_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_count_items_org" ON "org"."inventory_count_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_count_items_variance" ON "org"."inventory_count_items" USING btree ("variance");--> statement-breakpoint
CREATE INDEX "idx_inventory_counts_org" ON "org"."inventory_counts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_counts_location" ON "org"."inventory_counts" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_counts_status" ON "org"."inventory_counts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_inventory_counts_date" ON "org"."inventory_counts" USING btree ("count_date");--> statement-breakpoint
CREATE INDEX "idx_inventory_counts_deleted" ON "org"."inventory_counts" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_inventory_item_history_org" ON "org"."inventory_item_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_item_history_item" ON "org"."inventory_item_history" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_item_history_action" ON "org"."inventory_item_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_inventory_item_history_performed_by" ON "org"."inventory_item_history" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_inventory_item_history_created" ON "org"."inventory_item_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_inventory_item_history_item_date" ON "org"."inventory_item_history" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_inventory_item_locations_item" ON "org"."inventory_item_locations" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_item_locations_location" ON "org"."inventory_item_locations" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_item_locations_org" ON "org"."inventory_item_locations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_items_org" ON "org"."inventory_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_items_category" ON "org"."inventory_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_items_supplier" ON "org"."inventory_items" USING btree ("primary_supplier_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_items_location" ON "org"."inventory_items" USING btree ("primary_location_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_items_status" ON "org"."inventory_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_inventory_items_barcode" ON "org"."inventory_items" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "idx_inventory_items_active" ON "org"."inventory_items" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_inventory_items_deleted" ON "org"."inventory_items" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_inventory_items_stock_check" ON "org"."inventory_items" USING btree ("organization_id","quantity_on_hand","reorder_level");--> statement-breakpoint
CREATE INDEX "idx_inventory_locations_org" ON "org"."inventory_locations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_locations_type" ON "org"."inventory_locations" USING btree ("location_type");--> statement-breakpoint
CREATE INDEX "idx_inventory_locations_parent" ON "org"."inventory_locations" USING btree ("parent_location_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_locations_active" ON "org"."inventory_locations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_inventory_locations_deleted" ON "org"."inventory_locations" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_inventory_po_items_po" ON "org"."inventory_purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_po_items_item" ON "org"."inventory_purchase_order_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_po_items_org" ON "org"."inventory_purchase_order_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_po_org" ON "org"."inventory_purchase_orders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_po_supplier" ON "org"."inventory_purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_po_status" ON "org"."inventory_purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_inventory_po_order_date" ON "org"."inventory_purchase_orders" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "idx_inventory_po_expected_delivery" ON "org"."inventory_purchase_orders" USING btree ("expected_delivery_date");--> statement-breakpoint
CREATE INDEX "idx_inventory_po_created_by" ON "org"."inventory_purchase_orders" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_inventory_po_deleted" ON "org"."inventory_purchase_orders" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_inventory_alerts_org" ON "org"."inventory_stock_alerts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_alerts_item" ON "org"."inventory_stock_alerts" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_alerts_type" ON "org"."inventory_stock_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "idx_inventory_alerts_severity" ON "org"."inventory_stock_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_inventory_alerts_acknowledged" ON "org"."inventory_stock_alerts" USING btree ("is_acknowledged");--> statement-breakpoint
CREATE INDEX "idx_inventory_alerts_resolved" ON "org"."inventory_stock_alerts" USING btree ("is_resolved");--> statement-breakpoint
CREATE INDEX "idx_inventory_alerts_created" ON "org"."inventory_stock_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_inventory_alerts_active" ON "org"."inventory_stock_alerts" USING btree ("organization_id","is_resolved","severity");--> statement-breakpoint
CREATE INDEX "idx_inventory_suppliers_org" ON "org"."inventory_suppliers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_suppliers_active" ON "org"."inventory_suppliers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_inventory_suppliers_preferred" ON "org"."inventory_suppliers" USING btree ("is_preferred");--> statement-breakpoint
CREATE INDEX "idx_inventory_suppliers_deleted" ON "org"."inventory_suppliers" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_inventory_transactions_org" ON "org"."inventory_transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_transactions_item" ON "org"."inventory_transactions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_transactions_location" ON "org"."inventory_transactions" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_transactions_type" ON "org"."inventory_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "idx_inventory_transactions_date" ON "org"."inventory_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "idx_inventory_transactions_po" ON "org"."inventory_transactions" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_transactions_job" ON "org"."inventory_transactions" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_transactions_performed_by" ON "org"."inventory_transactions" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_inventory_transactions_item_date" ON "org"."inventory_transactions" USING btree ("item_id","transaction_date");--> statement-breakpoint
CREATE INDEX "idx_inventory_uom_active" ON "org"."inventory_units_of_measure" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_inventory_uom_type" ON "org"."inventory_units_of_measure" USING btree ("unit_type");