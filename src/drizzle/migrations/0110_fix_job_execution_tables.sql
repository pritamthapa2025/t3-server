-- Migration 0110
-- Add missing columns to job_pm_inspections and job_service_calls.
-- Both tables were created by an older db:push with only the first ~17 columns.
-- All statements use ADD COLUMN IF NOT EXISTS so this is fully idempotent.

-- ============================================================
-- 1. job_pm_inspections — missing columns from filter_quality onwards
-- ============================================================
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "filter_quality" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "filter_condition" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "filter_replaced" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "new_filter_size" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "old_filter_photo_url" text;--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "new_filter_photo_url" text;--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "cooling_supply_temp" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "cooling_return_temp" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "heating_supply_temp" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "heating_return_temp" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "supply_air_temp" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "return_air_temp" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "ambient_temp" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "blower_motor_status" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "compressor_status" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "heating_coil_condition" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "cooling_coil_condition" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "thermostat_status" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "cooling_functionality" varchar(20);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "heating_functionality" varchar(20);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "airflow_output" varchar(20);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "exhaust_fans_inspected" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "exhaust_fan_issues" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "exhaust_fan_issues_description" text;--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "locking_panel_in_good_condition" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "check_for_grime_on_external_surfaces" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "condensate_pans_cleaned_provide_photos" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "compressor_connections_provide_photos" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "coils_suppressants_applied" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "add_coils_evap_condensator_refrig_damaged" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "coils_clean_with_power_wash_good_condition" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "heating_and_heat_pump_operating_belts" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "refrigerant_lines_leaks_repaired" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "economize_or_exhaust_damper_open_close" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "supercool_with_power_refrigeration_safety" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "unit_safe_good_working_order" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "has_recommendations" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "recommendation_info" text;--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "overall_photo_url" text;--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "inspection_notes" text;--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "issues_identified" text;--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "recommended_actions" text;--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "priority_level" varchar(20);--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "technician_id" integer;--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "inspection_date" date;--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "created_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "org"."job_pm_inspections" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org"."job_pm_inspections" ADD CONSTRAINT "job_pm_inspections_technician_id_employees_id_fk" FOREIGN KEY ("technician_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org"."job_pm_inspections" ADD CONSTRAINT "job_pm_inspections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_pm_inspections_technician" ON "org"."job_pm_inspections" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_pm_inspections_status" ON "org"."job_pm_inspections" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_pm_inspections_is_deleted" ON "org"."job_pm_inspections" USING btree ("is_deleted");--> statement-breakpoint

-- ============================================================
-- 2. job_service_calls — add all columns that may be missing
-- ============================================================
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "call_date" date;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "technician_id" integer;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "time_in" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "time_out" varchar(10);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "service_description" text;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "building_number" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "unit_tag" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "unit_location" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "make" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "model" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "serial" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "supply_air_temp" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "return_air_temp" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "ambient_temp" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "cooling_supply_temp" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "cooling_return_temp" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "heating_supply_temp" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "heating_return_temp" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "blower_motor_status" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "compressor_status" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "heating_coil_condition" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "cooling_coil_condition" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "thermostat_status" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "plumbing_system_check" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "thermostat_check" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "hvac_system_check" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "client_communication_check" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "filter_inspected" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "electrical_connections_check" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "refrigerant_lines_check" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "safety_controls_check" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "work_performed" text;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "parts_replaced" text;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "issues_found" text;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "recommendations" text;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "priority_level" varchar(20);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "before_photos" text;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "after_photos" text;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "parts_photos" text;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "issues_photos" text;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "customer_signature_path" text;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "customer_name" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "customer_signature_date" date;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "customer_declined_signature" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "created_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "org"."job_service_calls" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org"."job_service_calls" ADD CONSTRAINT "job_service_calls_technician_id_employees_id_fk" FOREIGN KEY ("technician_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org"."job_service_calls" ADD CONSTRAINT "job_service_calls_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_service_calls_technician" ON "org"."job_service_calls" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_service_calls_status" ON "org"."job_service_calls" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_service_calls_is_deleted" ON "org"."job_service_calls" USING btree ("is_deleted");
