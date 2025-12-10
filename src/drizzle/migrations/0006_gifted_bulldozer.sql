CREATE TYPE "public"."bid_job_type_enum" AS ENUM('survey', 'plan_spec', 'design_build');--> statement-breakpoint
CREATE TYPE "public"."bid_priority_enum" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."bid_status_enum" AS ENUM('draft', 'in_progress', 'pending', 'submitted', 'accepted', 'won', 'rejected', 'lost', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."timeline_status_enum" AS ENUM('completed', 'pending', 'in_progress', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."timesheet_status_enum" AS ENUM('pending', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "org"."bid_design_build_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"design_requirements" text,
	"build_specifications" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bid_design_build_data_bid_id_unique" UNIQUE("bid_id")
);
--> statement-breakpoint
CREATE TABLE "org"."bid_design_build_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_size" integer,
	"uploaded_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."bid_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"document_type" varchar(50),
	"uploaded_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."bid_financial_breakdown" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"materials_equipment" numeric(15, 2) DEFAULT '0' NOT NULL,
	"labor" numeric(15, 2) DEFAULT '0' NOT NULL,
	"travel" numeric(15, 2) DEFAULT '0' NOT NULL,
	"operating_expenses" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bid_financial_breakdown_bid_id_unique" UNIQUE("bid_id")
);
--> statement-breakpoint
CREATE TABLE "org"."bid_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_value" text,
	"new_value" text,
	"description" text,
	"performed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."bid_labor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"role" varchar(100) NOT NULL,
	"quantity" integer NOT NULL,
	"days" integer NOT NULL,
	"hours_per_day" numeric(5, 2) NOT NULL,
	"total_hours" numeric(8, 2) NOT NULL,
	"cost_rate" numeric(10, 2) NOT NULL,
	"billable_rate" numeric(10, 2) NOT NULL,
	"total_cost" numeric(15, 2) NOT NULL,
	"total_price" numeric(15, 2) NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."bid_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_cost" numeric(15, 2) NOT NULL,
	"markup" numeric(5, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(15, 2) NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."bid_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_by" uuid NOT NULL,
	"is_internal" boolean DEFAULT true,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."bid_operating_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false,
	"gross_revenue_previous_year" numeric(15, 2) DEFAULT '0',
	"current_bid_amount" numeric(15, 2) DEFAULT '0',
	"operating_cost_previous_year" numeric(15, 2) DEFAULT '0',
	"inflation_adjusted_operating_cost" numeric(15, 2) DEFAULT '0',
	"inflation_rate" numeric(5, 2) DEFAULT '0',
	"utilization_percentage" numeric(5, 2) DEFAULT '0',
	"calculated_operating_cost" numeric(15, 2) DEFAULT '0',
	"apply_markup" boolean DEFAULT false,
	"markup_percentage" numeric(5, 2) DEFAULT '0',
	"operating_price" numeric(15, 2) DEFAULT '0',
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bid_operating_expenses_bid_id_unique" UNIQUE("bid_id")
);
--> statement-breakpoint
CREATE TABLE "org"."bid_plan_spec_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"specifications" text,
	"design_requirements" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bid_plan_spec_data_bid_id_unique" UNIQUE("bid_id")
);
--> statement-breakpoint
CREATE TABLE "org"."bid_plan_spec_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"file_type" varchar(20) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_size" integer,
	"uploaded_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."bid_survey_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"building_number" varchar(100),
	"site_location" text,
	"work_type" varchar(50),
	"has_existing_unit" boolean DEFAULT false,
	"unit_tag" varchar(100),
	"unit_location" varchar(255),
	"make" varchar(100),
	"model" varchar(100),
	"serial" varchar(100),
	"system_type" varchar(100),
	"power_status" varchar(50),
	"voltage_phase" varchar(50),
	"overall_condition" varchar(100),
	"site_access_notes" text,
	"site_conditions" text,
	"client_requirements" text,
	"technician_id" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bid_survey_data_bid_id_unique" UNIQUE("bid_id")
);
--> statement-breakpoint
CREATE TABLE "org"."bid_timeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"event" varchar(255) NOT NULL,
	"event_date" timestamp NOT NULL,
	"status" timeline_status_enum DEFAULT 'pending' NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0,
	"created_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."bid_travel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bid_id" uuid NOT NULL,
	"employee_name" varchar(255),
	"vehicle_name" varchar(255),
	"round_trip_miles" numeric(10, 2) NOT NULL,
	"mileage_rate" numeric(10, 2) NOT NULL,
	"vehicle_day_rate" numeric(10, 2) NOT NULL,
	"days" integer NOT NULL,
	"mileage_cost" numeric(15, 2) NOT NULL,
	"vehicle_cost" numeric(15, 2) NOT NULL,
	"markup" numeric(5, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(15, 2) NOT NULL,
	"total_price" numeric(15, 2) NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bid_number" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"job_type" "bid_job_type_enum" NOT NULL,
	"status" "bid_status_enum" DEFAULT 'draft' NOT NULL,
	"priority" "bid_priority_enum" DEFAULT 'medium' NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_name" varchar(255),
	"client_email" varchar(150),
	"client_phone" varchar(20),
	"city" varchar(100),
	"super_client" varchar(255),
	"super_primary_contact" varchar(255),
	"primary_contact" varchar(255),
	"industry_classification" varchar(100),
	"project_name" varchar(255),
	"site_address" text,
	"building_suite_number" varchar(100),
	"property" varchar(255),
	"across_valuations" varchar(255),
	"scope_of_work" text,
	"special_requirements" text,
	"description" text,
	"start_date" date,
	"end_date" date,
	"planned_start_date" date,
	"estimated_completion" date,
	"created_date" timestamp DEFAULT now(),
	"expires_date" timestamp,
	"removal_date" date,
	"bid_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"estimated_duration" integer,
	"profit_margin" numeric(5, 2),
	"expires_in" integer,
	"payment_terms" text,
	"warranty_period" varchar(50),
	"warranty_period_labor" varchar(50),
	"warranty_details" text,
	"special_terms" text,
	"exclusions" text,
	"proposal_basis" text,
	"reference_date" varchar(50),
	"template_selection" varchar(100),
	"primary_teammate" uuid,
	"supervisor_manager" uuid,
	"technician_id" uuid,
	"created_by" uuid NOT NULL,
	"assigned_to" uuid,
	"qty_number" varchar(50),
	"marked" varchar(20),
	"convert_to_job" boolean DEFAULT false,
	"job_id" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_bid_number_per_org" UNIQUE("organization_id","bid_number")
);
--> statement-breakpoint
CREATE TABLE "org"."cash_flow_projection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"projection_date" date NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"projected_income" numeric(15, 2) DEFAULT '0' NOT NULL,
	"projected_expenses" numeric(15, 2) DEFAULT '0' NOT NULL,
	"pipeline_coverage_months" numeric(5, 2) DEFAULT '0' NOT NULL,
	"open_invoices_count" integer DEFAULT 0 NOT NULL,
	"average_collection_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."cash_flow_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"projection_id" uuid NOT NULL,
	"scenario_type" varchar(20) NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text,
	"projected_income" numeric(15, 2) DEFAULT '0' NOT NULL,
	"projected_expenses" numeric(15, 2) DEFAULT '0' NOT NULL,
	"change_description" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."financial_cost_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category_key" varchar(50) NOT NULL,
	"category_label" varchar(255) NOT NULL,
	"spent" numeric(15, 2) DEFAULT '0' NOT NULL,
	"budget" numeric(15, 2) DEFAULT '0' NOT NULL,
	"percent_of_total" numeric(5, 2) DEFAULT '0' NOT NULL,
	"status" varchar(20) DEFAULT 'on-track' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."financial_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"report_key" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"report_config" jsonb,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_org_report" UNIQUE("organization_id","report_key")
);
--> statement-breakpoint
CREATE TABLE "org"."financial_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_contract_value" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_invoiced" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_paid" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_job_expenses" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_operating_expenses" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(15, 2) DEFAULT '0' NOT NULL,
	"projected_profit" numeric(15, 2) DEFAULT '0' NOT NULL,
	"actual_profit" numeric(15, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."job_financial_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"contract_value" numeric(15, 2) NOT NULL,
	"total_invoiced" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_paid" numeric(15, 2) DEFAULT '0' NOT NULL,
	"vendors_owed" numeric(15, 2) DEFAULT '0' NOT NULL,
	"labor_paid_to_date" numeric(15, 2) DEFAULT '0' NOT NULL,
	"job_completion_rate" numeric(5, 2),
	"profitability" numeric(5, 2),
	"profit_margin" numeric(5, 2),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_job_financial" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "org"."jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."profit_trend" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period" varchar(50) NOT NULL,
	"period_date" date NOT NULL,
	"revenue" numeric(15, 2) DEFAULT '0' NOT NULL,
	"expenses" numeric(15, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."revenue_forecast" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"month" varchar(10) NOT NULL,
	"month_date" date NOT NULL,
	"committed" numeric(15, 2) DEFAULT '0' NOT NULL,
	"pipeline" numeric(15, 2) DEFAULT '0' NOT NULL,
	"probability" numeric(5, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."timesheet_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"timesheet_id" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"performed_by" uuid NOT NULL,
	"remarks" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."timesheets" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"sheet_date" date NOT NULL,
	"clock_in" timestamp NOT NULL,
	"clock_out" timestamp NOT NULL,
	"break_minutes" integer DEFAULT 0,
	"total_hours" numeric(5, 2) DEFAULT '0',
	"overtime_hours" numeric(5, 2) DEFAULT '0',
	"notes" text,
	"status" timesheet_status_enum DEFAULT 'pending' NOT NULL,
	"submitted_by" uuid,
	"approved_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_employee_day" UNIQUE("employee_id","sheet_date")
);
--> statement-breakpoint
ALTER TABLE "org"."departments" DROP CONSTRAINT "departments_name_unique";--> statement-breakpoint
ALTER TABLE "org"."employees" DROP CONSTRAINT "employees_employee_id_unique";--> statement-breakpoint
-- Add organization_id columns with proper handling for existing data
ALTER TABLE "org"."departments" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN "organization_id" uuid;--> statement-breakpoint

-- Create a default organization if none exists
INSERT INTO "org"."organizations" (id, name, description)
SELECT gen_random_uuid(), 'Default Organization', 'Auto-created during migration'
WHERE NOT EXISTS (SELECT 1 FROM "org"."organizations");--> statement-breakpoint

-- Update existing departments with the first available organization
UPDATE "org"."departments" 
SET "organization_id" = (SELECT id FROM "org"."organizations" LIMIT 1)
WHERE "organization_id" IS NULL;--> statement-breakpoint

-- Update existing employees with the first available organization  
UPDATE "org"."employees" 
SET "organization_id" = (SELECT id FROM "org"."organizations" LIMIT 1)
WHERE "organization_id" IS NULL;--> statement-breakpoint

-- Now make the columns NOT NULL
ALTER TABLE "org"."departments" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."employees" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD CONSTRAINT "bid_design_build_data_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD CONSTRAINT "bid_design_build_data_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_files" ADD CONSTRAINT "bid_design_build_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_files" ADD CONSTRAINT "bid_design_build_files_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_files" ADD CONSTRAINT "bid_design_build_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_documents" ADD CONSTRAINT "bid_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_documents" ADD CONSTRAINT "bid_documents_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_documents" ADD CONSTRAINT "bid_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" ADD CONSTRAINT "bid_financial_breakdown_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" ADD CONSTRAINT "bid_financial_breakdown_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_history" ADD CONSTRAINT "bid_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_history" ADD CONSTRAINT "bid_history_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_history" ADD CONSTRAINT "bid_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD CONSTRAINT "bid_labor_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD CONSTRAINT "bid_labor_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_materials" ADD CONSTRAINT "bid_materials_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_materials" ADD CONSTRAINT "bid_materials_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_notes" ADD CONSTRAINT "bid_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_notes" ADD CONSTRAINT "bid_notes_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_notes" ADD CONSTRAINT "bid_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" ADD CONSTRAINT "bid_operating_expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" ADD CONSTRAINT "bid_operating_expenses_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD CONSTRAINT "bid_plan_spec_data_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD CONSTRAINT "bid_plan_spec_data_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_files" ADD CONSTRAINT "bid_plan_spec_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_files" ADD CONSTRAINT "bid_plan_spec_files_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_files" ADD CONSTRAINT "bid_plan_spec_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD CONSTRAINT "bid_survey_data_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD CONSTRAINT "bid_survey_data_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD CONSTRAINT "bid_survey_data_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" ADD CONSTRAINT "bid_timeline_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" ADD CONSTRAINT "bid_timeline_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_timeline" ADD CONSTRAINT "bid_timeline_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD CONSTRAINT "bid_travel_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD CONSTRAINT "bid_travel_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_primary_teammate_users_id_fk" FOREIGN KEY ("primary_teammate") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_supervisor_manager_users_id_fk" FOREIGN KEY ("supervisor_manager") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."cash_flow_projection" ADD CONSTRAINT "cash_flow_projection_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."cash_flow_scenarios" ADD CONSTRAINT "cash_flow_scenarios_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."cash_flow_scenarios" ADD CONSTRAINT "cash_flow_scenarios_projection_id_cash_flow_projection_id_fk" FOREIGN KEY ("projection_id") REFERENCES "org"."cash_flow_projection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."financial_cost_categories" ADD CONSTRAINT "financial_cost_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."financial_reports" ADD CONSTRAINT "financial_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."financial_summary" ADD CONSTRAINT "financial_summary_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_financial_summary" ADD CONSTRAINT "job_financial_summary_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_financial_summary" ADD CONSTRAINT "job_financial_summary_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."profit_trend" ADD CONSTRAINT "profit_trend_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."revenue_forecast" ADD CONSTRAINT "revenue_forecast_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_timesheet_id_timesheets_id_fk" FOREIGN KEY ("timesheet_id") REFERENCES "org"."timesheets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."timesheets" ADD CONSTRAINT "timesheets_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."timesheets" ADD CONSTRAINT "timesheets_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."timesheets" ADD CONSTRAINT "timesheets_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bid_design_build_org" ON "org"."bid_design_build_data" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bid_design_build_bid_id" ON "org"."bid_design_build_data" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bid_design_build_files_org" ON "org"."bid_design_build_files" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bid_design_build_files_bid_id" ON "org"."bid_design_build_files" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bid_documents_org" ON "org"."bid_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bid_documents_bid_id" ON "org"."bid_documents" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bid_documents_type" ON "org"."bid_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_bid_financial_org" ON "org"."bid_financial_breakdown" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bid_financial_bid_id" ON "org"."bid_financial_breakdown" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bid_history_org" ON "org"."bid_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bid_history_bid_id" ON "org"."bid_history" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bid_history_performed_by" ON "org"."bid_history" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_bid_history_created_at" ON "org"."bid_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_bid_labor_org" ON "org"."bid_labor" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bid_labor_bid_id" ON "org"."bid_labor" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bid_materials_org" ON "org"."bid_materials" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bid_materials_bid_id" ON "org"."bid_materials" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bid_notes_org" ON "org"."bid_notes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bid_notes_bid_id" ON "org"."bid_notes" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bid_notes_created_by" ON "org"."bid_notes" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_bid_operating_org" ON "org"."bid_operating_expenses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bid_operating_bid_id" ON "org"."bid_operating_expenses" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bid_plan_spec_org" ON "org"."bid_plan_spec_data" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bid_plan_spec_bid_id" ON "org"."bid_plan_spec_data" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bid_plan_spec_files_org" ON "org"."bid_plan_spec_files" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bid_plan_spec_files_bid_id" ON "org"."bid_plan_spec_files" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bid_plan_spec_files_type" ON "org"."bid_plan_spec_files" USING btree ("file_type");--> statement-breakpoint
CREATE INDEX "idx_bid_survey_org" ON "org"."bid_survey_data" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bid_survey_bid_id" ON "org"."bid_survey_data" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bid_timeline_org" ON "org"."bid_timeline" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bid_timeline_bid_id" ON "org"."bid_timeline" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bid_timeline_status" ON "org"."bid_timeline" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bid_travel_org" ON "org"."bid_travel" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bid_travel_bid_id" ON "org"."bid_travel" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bids_org" ON "org"."bids" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bids_status" ON "org"."bids" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bids_org_status" ON "org"."bids" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_bids_created_by" ON "org"."bids" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_bids_job_type" ON "org"."bids" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "idx_bids_priority" ON "org"."bids" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_bids_expires_date" ON "org"."bids" USING btree ("expires_date");--> statement-breakpoint
CREATE INDEX "idx_bids_is_deleted" ON "org"."bids" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_bids_created_at" ON "org"."bids" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "org"."departments" ADD CONSTRAINT "departments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD CONSTRAINT "employees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."departments" ADD CONSTRAINT "unique_dept_per_org" UNIQUE("organization_id","name");--> statement-breakpoint
ALTER TABLE "org"."employees" ADD CONSTRAINT "unique_employee_per_org" UNIQUE("organization_id","employee_id");