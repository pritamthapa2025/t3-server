-- Comprehensive Schema Sync Migration
-- This migration ensures all tables and columns from all schema files are created
-- Created: 2025-01-17
-- Covers: auth, org, jobs, bids, timesheet, payroll, capacity, compliance schemas

-- ===========================================
-- PART 1: CREATE ALL MISSING ENUMS
-- ===========================================

-- Auth enums
DO $$ BEGIN
    CREATE TYPE permission_module_enum AS ENUM (
        'users', 'roles', 'permissions', 'departments', 'employees', 'organizations', 
        'clients', 'properties', 'jobs', 'bids', 'timesheets', 'payroll', 
        'compliance', 'capacity', 'reports', 'settings'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Org enums
DO $$ BEGIN
    CREATE TYPE account_type_enum AS ENUM ('checking', 'savings');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE employee_status_enum AS ENUM (
        'available', 'on_job', 'break', 'pto', 'sick', 'off_shift', 'suspended'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE client_type_enum AS ENUM ('direct', 'sub_client', 'partner');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE client_status_enum AS ENUM (
        'prospect', 'active', 'inactive', 'suspended', 'terminated'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE contact_type_enum AS ENUM (
        'primary', 'billing', 'technical', 'emergency', 'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE property_type_enum AS ENUM (
        'office', 'retail', 'industrial', 'warehouse', 'mixed_use', 'residential'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE property_status_enum AS ENUM ('active', 'inactive', 'maintenance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_organization_type_enum AS ENUM (
        'client_user', 'property_manager', 'account_admin'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Jobs enums
DO $$ BEGIN
    CREATE TYPE job_status_enum AS ENUM (
        'planned', 'scheduled', 'in_progress', 'completed', 'cancelled', 'on_hold'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_priority_enum AS ENUM ('low', 'medium', 'high', 'emergency');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Bids enums
DO $$ BEGIN
    CREATE TYPE bid_status_enum AS ENUM (
        'draft', 'submitted', 'under_review', 'awarded', 'rejected', 'expired'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE bid_priority_enum AS ENUM ('low', 'medium', 'high', 'rush');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE bid_job_type_enum AS ENUM (
        'survey', 'plan_spec', 'design_build', 'maintenance', 'repair', 'installation'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE timeline_status_enum AS ENUM ('pending', 'completed', 'overdue');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Timesheet enums
DO $$ BEGIN
    CREATE TYPE timesheet_status_enum AS ENUM (
        'pending', 'approved', 'rejected', 'submitted'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===========================================
-- PART 2: CREATE ALL MISSING TABLES
-- ===========================================

-- Jobs schema tables
CREATE TABLE IF NOT EXISTS "org"."jobs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "job_number" varchar(100) NOT NULL,
    "organization_id" uuid NOT NULL,
    "property_id" uuid,
    "bid_id" uuid,
    "name" varchar(255) NOT NULL,
    "description" text,
    "status" job_status_enum DEFAULT 'planned' NOT NULL,
    "priority" job_priority_enum DEFAULT 'medium' NOT NULL,
    "job_type" varchar(100),
    "service_type" varchar(100),
    "scheduled_start_date" date,
    "scheduled_end_date" date,
    "actual_start_date" date,
    "actual_end_date" date,
    "site_address" text,
    "site_contact_name" varchar(150),
    "site_contact_phone" varchar(20),
    "access_instructions" text,
    "contract_value" numeric(15, 2),
    "actual_cost" numeric(15, 2),
    "project_manager" uuid,
    "lead_technician" uuid,
    "completion_notes" text,
    "completion_percentage" numeric(5, 2) DEFAULT '0',
    "created_by" uuid,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org"."job_team_members" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "job_id" uuid NOT NULL,
    "employee_id" integer NOT NULL,
    "role" varchar(100),
    "assigned_date" date DEFAULT now(),
    "removed_date" date,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org"."job_financial_summary" (
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
    "updated_at" timestamp DEFAULT now()
);

-- Bids schema tables (comprehensive)
CREATE TABLE IF NOT EXISTS "org"."bids" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "bid_number" varchar(100) NOT NULL,
    "title" varchar(255) NOT NULL,
    "job_type" bid_job_type_enum NOT NULL,
    "status" bid_status_enum DEFAULT 'draft' NOT NULL,
    "priority" bid_priority_enum DEFAULT 'medium' NOT NULL,
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
    "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org"."bid_financial_breakdown" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "bid_id" uuid NOT NULL UNIQUE,
    "materials_equipment" numeric(15, 2) DEFAULT '0' NOT NULL,
    "labor" numeric(15, 2) DEFAULT '0' NOT NULL,
    "travel" numeric(15, 2) DEFAULT '0' NOT NULL,
    "operating_expenses" numeric(15, 2) DEFAULT '0' NOT NULL,
    "total_cost" numeric(15, 2) DEFAULT '0' NOT NULL,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org"."bid_materials" (
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

CREATE TABLE IF NOT EXISTS "org"."bid_labor" (
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

CREATE TABLE IF NOT EXISTS "org"."bid_travel" (
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

CREATE TABLE IF NOT EXISTS "org"."bid_operating_expenses" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "bid_id" uuid NOT NULL UNIQUE,
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
    "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org"."bid_survey_data" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "bid_id" uuid NOT NULL UNIQUE,
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
    "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org"."bid_plan_spec_data" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "bid_id" uuid NOT NULL UNIQUE,
    "specifications" text,
    "design_requirements" text,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org"."bid_design_build_data" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "bid_id" uuid NOT NULL UNIQUE,
    "design_requirements" text,
    "build_specifications" text,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org"."bid_timeline" (
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

CREATE TABLE IF NOT EXISTS "org"."bid_documents" (
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

CREATE TABLE IF NOT EXISTS "org"."bid_plan_spec_files" (
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

CREATE TABLE IF NOT EXISTS "org"."bid_design_build_files" (
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

CREATE TABLE IF NOT EXISTS "org"."bid_notes" (
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

CREATE TABLE IF NOT EXISTS "org"."bid_history" (
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

-- ===========================================
-- PART 3: ADD FOREIGN KEY CONSTRAINTS
-- ===========================================

-- Jobs foreign keys
DO $$ BEGIN
    ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_organization_id_organizations_id_fk" 
    FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_project_manager_users_id_fk" 
    FOREIGN KEY ("project_manager") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_lead_technician_users_id_fk" 
    FOREIGN KEY ("lead_technician") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_created_by_users_id_fk" 
    FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Job team members foreign keys
DO $$ BEGIN
    ALTER TABLE "org"."job_team_members" ADD CONSTRAINT "job_team_members_job_id_jobs_id_fk" 
    FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "org"."job_team_members" ADD CONSTRAINT "job_team_members_employee_id_employees_id_fk" 
    FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Job financial summary foreign keys
DO $$ BEGIN
    ALTER TABLE "org"."job_financial_summary" ADD CONSTRAINT "job_financial_summary_job_id_jobs_id_fk" 
    FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "org"."job_financial_summary" ADD CONSTRAINT "job_financial_summary_organization_id_organizations_id_fk" 
    FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Bids foreign keys
DO $$ BEGIN
    ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_organization_id_organizations_id_fk" 
    FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_primary_teammate_users_id_fk" 
    FOREIGN KEY ("primary_teammate") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_supervisor_manager_users_id_fk" 
    FOREIGN KEY ("supervisor_manager") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_technician_id_users_id_fk" 
    FOREIGN KEY ("technician_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_created_by_users_id_fk" 
    FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_assigned_to_users_id_fk" 
    FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_job_id_jobs_id_fk" 
    FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Bid financial breakdown foreign keys
DO $$ BEGIN
    ALTER TABLE "org"."bid_financial_breakdown" ADD CONSTRAINT "bid_financial_breakdown_organization_id_organizations_id_fk" 
    FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "org"."bid_financial_breakdown" ADD CONSTRAINT "bid_financial_breakdown_bid_id_bids_id_fk" 
    FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===========================================
-- PART 4: CREATE INDEXES FOR PERFORMANCE
-- ===========================================

-- Jobs indexes
CREATE INDEX IF NOT EXISTS "idx_jobs_org" ON "org"."jobs" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_jobs_property" ON "org"."jobs" USING btree ("property_id");
CREATE INDEX IF NOT EXISTS "idx_jobs_bid" ON "org"."jobs" USING btree ("bid_id");
CREATE INDEX IF NOT EXISTS "idx_jobs_status" ON "org"."jobs" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_jobs_priority" ON "org"."jobs" USING btree ("priority");
CREATE INDEX IF NOT EXISTS "idx_jobs_scheduled_start" ON "org"."jobs" USING btree ("scheduled_start_date");
CREATE INDEX IF NOT EXISTS "idx_jobs_project_manager" ON "org"."jobs" USING btree ("project_manager");
CREATE INDEX IF NOT EXISTS "idx_jobs_lead_technician" ON "org"."jobs" USING btree ("lead_technician");
CREATE INDEX IF NOT EXISTS "idx_jobs_is_deleted" ON "org"."jobs" USING btree ("is_deleted");

-- Job team members indexes
CREATE INDEX IF NOT EXISTS "idx_job_team_job" ON "org"."job_team_members" USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "idx_job_team_employee" ON "org"."job_team_members" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "idx_job_team_active" ON "org"."job_team_members" USING btree ("is_active");
CREATE INDEX IF NOT EXISTS "idx_job_team_role" ON "org"."job_team_members" USING btree ("role");

-- Job financial summary indexes
CREATE INDEX IF NOT EXISTS "idx_job_financial_org" ON "org"."job_financial_summary" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_job_financial_updated" ON "org"."job_financial_summary" USING btree ("updated_at");

-- Bids indexes
CREATE INDEX IF NOT EXISTS "idx_bids_org" ON "org"."bids" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_bids_status" ON "org"."bids" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_bids_org_status" ON "org"."bids" USING btree ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "idx_bids_created_by" ON "org"."bids" USING btree ("created_by");
CREATE INDEX IF NOT EXISTS "idx_bids_job_type" ON "org"."bids" USING btree ("job_type");
CREATE INDEX IF NOT EXISTS "idx_bids_priority" ON "org"."bids" USING btree ("priority");
CREATE INDEX IF NOT EXISTS "idx_bids_expires_date" ON "org"."bids" USING btree ("expires_date");
CREATE INDEX IF NOT EXISTS "idx_bids_is_deleted" ON "org"."bids" USING btree ("is_deleted");
CREATE INDEX IF NOT EXISTS "idx_bids_created_at" ON "org"."bids" USING btree ("created_at");

-- Bid financial breakdown indexes
CREATE INDEX IF NOT EXISTS "idx_bid_financial_org" ON "org"."bid_financial_breakdown" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_bid_financial_bid_id" ON "org"."bid_financial_breakdown" USING btree ("bid_id");

-- Bid materials indexes
CREATE INDEX IF NOT EXISTS "idx_bid_materials_org" ON "org"."bid_materials" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_bid_materials_bid_id" ON "org"."bid_materials" USING btree ("bid_id");

-- Bid labor indexes
CREATE INDEX IF NOT EXISTS "idx_bid_labor_org" ON "org"."bid_labor" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_bid_labor_bid_id" ON "org"."bid_labor" USING btree ("bid_id");

-- Bid travel indexes
CREATE INDEX IF NOT EXISTS "idx_bid_travel_org" ON "org"."bid_travel" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_bid_travel_bid_id" ON "org"."bid_travel" USING btree ("bid_id");

-- ===========================================
-- PART 5: CREATE UNIQUE CONSTRAINTS
-- ===========================================

-- Jobs unique constraints (removed - handled in later migration)

-- Job team members unique constraints (removed - handled in later migration)

-- Job financial summary unique constraints (removed - handled in later migration)

-- Bids unique constraints (removed - handled in later migration)

-- ===========================================
-- NOTES:
-- - This migration is idempotent (safe to run multiple times)
-- - All tables use IF NOT EXISTS to prevent errors
-- - Foreign keys use DO blocks to handle duplicates
-- - Indexes use IF NOT EXISTS for safety
-- - This covers jobs, bids, and all their related tables
-- - Payroll, compliance, and capacity schemas are already covered by previous migrations
-- ===========================================
