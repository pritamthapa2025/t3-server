ALTER TABLE "org"."bid_labor" ALTER COLUMN "position_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD COLUMN IF NOT EXISTS "custom_role" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN IF NOT EXISTS "previous_pm_job_id" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN IF NOT EXISTS "pricing_model" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN IF NOT EXISTS "price_per_unit" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN IF NOT EXISTS "flat_rate_per_visit" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN IF NOT EXISTS "annual_contract_value" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN IF NOT EXISTS "include_filter_replacement" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN IF NOT EXISTS "filter_replacement_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN IF NOT EXISTS "include_coil_cleaning" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN IF NOT EXISTS "coil_cleaning_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN IF NOT EXISTS "emergency_service_rate" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN IF NOT EXISTS "payment_schedule" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN IF NOT EXISTS "pricing_notes" text;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "service_type" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "equipment_type" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "issue_category" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "reported_issue" text;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "preliminary_assessment" text;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "estimated_work_scope" text;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "lead_technician_id" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "helper_technician_id" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "pricing_model" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "number_of_techs" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "labor_hours" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "labor_rate" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "materials_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "travel_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "service_markup" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "flat_rate_price" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "diagnostic_fee" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "estimated_repair_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN IF NOT EXISTS "pricing_notes" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "survey_type" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "number_of_buildings" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "expected_units_to_survey" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "building_numbers" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "unit_types" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "include_photo_documentation" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "include_performance_testing" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "include_energy_analysis" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "include_recommendations" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "scheduling_constraints" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "technician_id" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "pricing_model" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "flat_survey_fee" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "price_per_unit" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "estimated_hours" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "hourly_rate" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "estimated_expenses" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "total_survey_fee" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "survey_date" date;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "survey_by" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "survey_notes" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "access_requirements" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "utility_locations" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "existing_equipment" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "measurements" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN IF NOT EXISTS "photos" text;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN IF NOT EXISTS "industry_classification" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN IF NOT EXISTS "scheduled_date_time" timestamp;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN IF NOT EXISTS "terms_template_selection" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN IF NOT EXISTS "site_contact_name" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN IF NOT EXISTS "site_contact_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN IF NOT EXISTS "access_instructions" text;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN IF NOT EXISTS "final_bid_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN IF NOT EXISTS "actual_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN IF NOT EXISTS "submitted_date" date;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN IF NOT EXISTS "decision_date" date;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN IF NOT EXISTS "converted_to_job_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN IF NOT EXISTS "conversion_date" date;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN IF NOT EXISTS "lost_reason" text;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN IF NOT EXISTS "rejection_reason" text;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "org"."bid_service_data" ADD CONSTRAINT "bid_service_data_lead_technician_id_employees_id_fk" FOREIGN KEY ("lead_technician_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "org"."bid_service_data" ADD CONSTRAINT "bid_service_data_helper_technician_id_employees_id_fk" FOREIGN KEY ("helper_technician_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "org"."bid_survey_data" ADD CONSTRAINT "bid_survey_data_technician_id_employees_id_fk" FOREIGN KEY ("technician_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;
