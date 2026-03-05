ALTER TABLE "org"."bid_labor" ALTER COLUMN "position_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD COLUMN "custom_role" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN "previous_pm_job_id" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN "pricing_model" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN "price_per_unit" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN "flat_rate_per_visit" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN "annual_contract_value" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN "include_filter_replacement" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN "filter_replacement_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN "include_coil_cleaning" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN "coil_cleaning_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN "emergency_service_rate" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN "payment_schedule" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bid_preventative_maintenance_data" ADD COLUMN "pricing_notes" text;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "service_type" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "equipment_type" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "issue_category" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "reported_issue" text;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "preliminary_assessment" text;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "estimated_work_scope" text;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "lead_technician_id" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "helper_technician_id" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "pricing_model" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "number_of_techs" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "labor_hours" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "labor_rate" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "materials_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "travel_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "service_markup" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "flat_rate_price" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "diagnostic_fee" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "estimated_repair_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD COLUMN "pricing_notes" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "survey_type" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "number_of_buildings" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "expected_units_to_survey" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "building_numbers" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "unit_types" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "include_photo_documentation" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "include_performance_testing" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "include_energy_analysis" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "include_recommendations" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "scheduling_constraints" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "technician_id" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "pricing_model" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "flat_survey_fee" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "price_per_unit" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "estimated_hours" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "hourly_rate" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "estimated_expenses" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "total_survey_fee" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "survey_date" date;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "survey_by" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "survey_notes" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "access_requirements" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "utility_locations" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "existing_equipment" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "measurements" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "photos" text;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "industry_classification" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "scheduled_date_time" timestamp;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "terms_template_selection" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "site_contact_name" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "site_contact_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "access_instructions" text;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "final_bid_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "actual_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "submitted_date" date;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "decision_date" date;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "converted_to_job_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "conversion_date" date;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "lost_reason" text;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD CONSTRAINT "bid_service_data_lead_technician_id_employees_id_fk" FOREIGN KEY ("lead_technician_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_service_data" ADD CONSTRAINT "bid_service_data_helper_technician_id_employees_id_fk" FOREIGN KEY ("helper_technician_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD CONSTRAINT "bid_survey_data_technician_id_employees_id_fk" FOREIGN KEY ("technician_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;