CREATE TABLE IF NOT EXISTS "org"."bid_preventative_maintenance_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bid_id" uuid NOT NULL,
	"pm_type" varchar(100),
	"maintenance_frequency" varchar(50),
	"number_of_buildings" integer,
	"number_of_units" integer,
	"building_numbers" text,
	"expected_unit_tags" text,
	"filter_replacement_included" boolean DEFAULT false,
	"coil_cleaning_included" boolean DEFAULT false,
	"temperature_readings_included" boolean DEFAULT false,
	"visual_inspection_included" boolean DEFAULT false,
	"service_scope" text,
	"special_requirements" text,
	"client_pm_requirements" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bid_preventative_maintenance_data_bid_id_unique" UNIQUE("bid_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."bid_service_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bid_id" uuid NOT NULL,
	"service_call_technician" integer,
	"time_in" varchar(50),
	"time_out" varchar(50),
	"service_description" text,
	"plumbing_system_check" boolean DEFAULT false,
	"thermostat_check" boolean DEFAULT false,
	"hvac_system_check" boolean DEFAULT false,
	"client_communication_check" boolean DEFAULT false,
	"customer_signature_path" varchar(500),
	"customer_signature_date" timestamp,
	"service_notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bid_service_data_bid_id_unique" UNIQUE("bid_id")
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "org"."bid_preventative_maintenance_data" ADD CONSTRAINT "bid_preventative_maintenance_data_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "org"."bid_service_data" ADD CONSTRAINT "bid_service_data_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "org"."bid_service_data" ADD CONSTRAINT "bid_service_data_service_call_technician_employees_id_fk" FOREIGN KEY ("service_call_technician") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bid_pm_data_bid_id" ON "org"."bid_preventative_maintenance_data" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bid_service_data_bid_id" ON "org"."bid_service_data" USING btree ("bid_id");
