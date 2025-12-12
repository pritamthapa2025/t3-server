-- Enhanced Schema Migration
-- This migration adds all the critical improvements to the T3 Mechanical system

-- =====================================================
-- 1. AUTH SCHEMA ENHANCEMENTS
-- =====================================================

-- Add new permission module enum
DO $$ BEGIN
 CREATE TYPE "auth"."permission_module_enum" AS ENUM('dashboard', 'bids', 'jobs', 'clients', 'properties', 'fleet', 'team', 'financial', 'settings', 'reports');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Enhance users table with additional fields
ALTER TABLE "auth"."users" 
ADD COLUMN IF NOT EXISTS "address" text,
ADD COLUMN IF NOT EXISTS "city" varchar(100),
ADD COLUMN IF NOT EXISTS "state" varchar(50),
ADD COLUMN IF NOT EXISTS "zip_code" varchar(20),
ADD COLUMN IF NOT EXISTS "date_of_birth" date,
ADD COLUMN IF NOT EXISTS "emergency_contact_name" varchar(150),
ADD COLUMN IF NOT EXISTS "emergency_contact_phone" varchar(20),
ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp,
ADD COLUMN IF NOT EXISTS "password_changed_at" timestamp;

-- Add indexes for users
CREATE INDEX IF NOT EXISTS "idx_users_city_state" ON "auth"."users" USING btree ("city","state");

-- Fix audit logs table (recreate with proper auto-increment)
DROP TABLE IF EXISTS "auth"."audit_logs";
CREATE TABLE "auth"."audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"description" text,
	"ip_address" varchar(50),
	"metadata" jsonb,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);

-- Add audit logs indexes
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_id" ON "auth"."audit_logs" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_event_type" ON "auth"."audit_logs" USING btree ("event_type");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "auth"."audit_logs" USING btree ("created_at");

-- Add foreign key for audit logs
DO $$ BEGIN
 ALTER TABLE "auth"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Enhance permissions table
ALTER TABLE "auth"."permissions" 
DROP COLUMN IF EXISTS "module",
ADD COLUMN IF NOT EXISTS "module" "auth"."permission_module_enum" NOT NULL DEFAULT 'dashboard',
ADD COLUMN IF NOT EXISTS "action" varchar(50) NOT NULL DEFAULT 'read';

-- Add permissions indexes
CREATE INDEX IF NOT EXISTS "idx_permissions_module" ON "auth"."permissions" USING btree ("module");
CREATE INDEX IF NOT EXISTS "idx_permissions_action" ON "auth"."permissions" USING btree ("action");

-- =====================================================
-- 2. ORG SCHEMA ENHANCEMENTS
-- =====================================================

-- Add new enums for enhanced functionality
DO $$ BEGIN
 CREATE TYPE "org"."user_organization_type_enum" AS ENUM('t3_employee', 'client_user', 'contractor');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "org"."job_status_enum" AS ENUM('planned', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled', 'invoiced', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "org"."job_priority_enum" AS ENUM('low', 'medium', 'high', 'emergency');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CRITICAL: Create user-organization membership table
CREATE TABLE IF NOT EXISTS "org"."user_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_type" "org"."user_organization_type_enum" DEFAULT 'client_user' NOT NULL,
	"title" varchar(100),
	"is_active" boolean DEFAULT true,
	"is_primary" boolean DEFAULT false,
	"joined_at" timestamp DEFAULT now(),
	"left_at" timestamp,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_org" UNIQUE("user_id","organization_id")
);

-- Add user organizations indexes
CREATE INDEX IF NOT EXISTS "idx_user_orgs_user" ON "org"."user_organizations" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_orgs_org" ON "org"."user_organizations" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_user_orgs_type" ON "org"."user_organizations" USING btree ("user_type");
CREATE INDEX IF NOT EXISTS "idx_user_orgs_is_active" ON "org"."user_organizations" USING btree ("is_active");

-- Add foreign keys for user organizations
DO $$ BEGIN
 ALTER TABLE "org"."user_organizations" ADD CONSTRAINT "user_organizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."user_organizations" ADD CONSTRAINT "user_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Enhance organizations table with comprehensive client management
ALTER TABLE "org"."organizations" 
ADD COLUMN IF NOT EXISTS "legal_name" varchar(255),
ADD COLUMN IF NOT EXISTS "client_type" "org"."client_type_enum" DEFAULT 'direct' NOT NULL,
ADD COLUMN IF NOT EXISTS "status" "org"."client_status_enum" DEFAULT 'prospect' NOT NULL,
ADD COLUMN IF NOT EXISTS "industry_classification" varchar(100),
ADD COLUMN IF NOT EXISTS "tax_id" varchar(50),
ADD COLUMN IF NOT EXISTS "website" varchar(255),
ADD COLUMN IF NOT EXISTS "parent_organization_id" uuid,
ADD COLUMN IF NOT EXISTS "credit_limit" numeric(15,2),
ADD COLUMN IF NOT EXISTS "payment_terms" varchar(100),
ADD COLUMN IF NOT EXISTS "preferred_payment_method" varchar(50),
ADD COLUMN IF NOT EXISTS "billing_address_line1" varchar(255),
ADD COLUMN IF NOT EXISTS "billing_address_line2" varchar(255),
ADD COLUMN IF NOT EXISTS "billing_city" varchar(100),
ADD COLUMN IF NOT EXISTS "billing_state" varchar(50),
ADD COLUMN IF NOT EXISTS "billing_zip_code" varchar(20),
ADD COLUMN IF NOT EXISTS "billing_country" varchar(100) DEFAULT 'USA',
ADD COLUMN IF NOT EXISTS "notes" text,
ADD COLUMN IF NOT EXISTS "tags" jsonb,
ADD COLUMN IF NOT EXISTS "account_manager" uuid,
ADD COLUMN IF NOT EXISTS "created_by" uuid,
ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;

-- Add organizations indexes
CREATE INDEX IF NOT EXISTS "idx_orgs_status" ON "org"."organizations" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_orgs_client_type" ON "org"."organizations" USING btree ("client_type");
CREATE INDEX IF NOT EXISTS "idx_orgs_parent" ON "org"."organizations" USING btree ("parent_organization_id");
CREATE INDEX IF NOT EXISTS "idx_orgs_is_deleted" ON "org"."organizations" USING btree ("is_deleted");
CREATE INDEX IF NOT EXISTS "idx_orgs_account_manager" ON "org"."organizations" USING btree ("account_manager");

-- Add organizations foreign keys
DO $$ BEGIN
 ALTER TABLE "org"."organizations" ADD CONSTRAINT "organizations_parent_organization_id_organizations_id_fk" FOREIGN KEY ("parent_organization_id") REFERENCES "org"."organizations"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."organizations" ADD CONSTRAINT "organizations_account_manager_users_id_fk" FOREIGN KEY ("account_manager") REFERENCES "auth"."users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."organizations" ADD CONSTRAINT "organizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Remove organizationId from employees table (they work for T3, not client orgs)
ALTER TABLE "org"."employees" DROP COLUMN IF EXISTS "organization_id";

-- Enhance employees table with comprehensive HR features
ALTER TABLE "org"."employees" 
ADD COLUMN IF NOT EXISTS "hire_date" date,
ADD COLUMN IF NOT EXISTS "termination_date" date,
ADD COLUMN IF NOT EXISTS "hourly_rate" numeric(10,2),
ADD COLUMN IF NOT EXISTS "salary" numeric(15,2),
ADD COLUMN IF NOT EXISTS "pay_type" varchar(20),
ADD COLUMN IF NOT EXISTS "certifications" jsonb,
ADD COLUMN IF NOT EXISTS "skills" jsonb,
ADD COLUMN IF NOT EXISTS "licenses" jsonb,
ADD COLUMN IF NOT EXISTS "employment_type" varchar(50);

-- Add employees indexes
CREATE INDEX IF NOT EXISTS "idx_employees_department" ON "org"."employees" USING btree ("department_id");
CREATE INDEX IF NOT EXISTS "idx_employees_position" ON "org"."employees" USING btree ("position_id");
CREATE INDEX IF NOT EXISTS "idx_employees_status" ON "org"."employees" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_employees_reports_to" ON "org"."employees" USING btree ("reports_to");
CREATE INDEX IF NOT EXISTS "idx_employees_pay_type" ON "org"."employees" USING btree ("pay_type");
CREATE INDEX IF NOT EXISTS "idx_employees_employment_type" ON "org"."employees" USING btree ("employment_type");

-- Make employee_id globally unique (remove per-org constraint)
DROP INDEX IF EXISTS "unique_employee_per_org";
CREATE UNIQUE INDEX IF NOT EXISTS "unique_employee_id" ON "org"."employees" USING btree ("employee_id");

-- Enhance jobs table with comprehensive project management
ALTER TABLE "org"."jobs" 
ADD COLUMN IF NOT EXISTS "job_number" varchar(100),
ADD COLUMN IF NOT EXISTS "property_id" uuid,
ADD COLUMN IF NOT EXISTS "bid_id" uuid,
ADD COLUMN IF NOT EXISTS "status" "org"."job_status_enum" DEFAULT 'planned' NOT NULL,
ADD COLUMN IF NOT EXISTS "priority" "org"."job_priority_enum" DEFAULT 'medium' NOT NULL,
ADD COLUMN IF NOT EXISTS "job_type" varchar(100),
ADD COLUMN IF NOT EXISTS "service_type" varchar(100),
ADD COLUMN IF NOT EXISTS "scheduled_start_date" date,
ADD COLUMN IF NOT EXISTS "scheduled_end_date" date,
ADD COLUMN IF NOT EXISTS "actual_start_date" date,
ADD COLUMN IF NOT EXISTS "actual_end_date" date,
ADD COLUMN IF NOT EXISTS "site_address" text,
ADD COLUMN IF NOT EXISTS "site_contact_name" varchar(150),
ADD COLUMN IF NOT EXISTS "site_contact_phone" varchar(20),
ADD COLUMN IF NOT EXISTS "access_instructions" text,
ADD COLUMN IF NOT EXISTS "contract_value" numeric(15,2),
ADD COLUMN IF NOT EXISTS "actual_cost" numeric(15,2),
ADD COLUMN IF NOT EXISTS "project_manager" uuid,
ADD COLUMN IF NOT EXISTS "lead_technician" uuid,
ADD COLUMN IF NOT EXISTS "completion_notes" text,
ADD COLUMN IF NOT EXISTS "completion_percentage" numeric(5,2) DEFAULT '0',
ADD COLUMN IF NOT EXISTS "created_by" uuid,
ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;

-- Add jobs indexes
CREATE INDEX IF NOT EXISTS "idx_jobs_org" ON "org"."jobs" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_jobs_property" ON "org"."jobs" USING btree ("property_id");
CREATE INDEX IF NOT EXISTS "idx_jobs_bid" ON "org"."jobs" USING btree ("bid_id");
CREATE INDEX IF NOT EXISTS "idx_jobs_status" ON "org"."jobs" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_jobs_priority" ON "org"."jobs" USING btree ("priority");
CREATE INDEX IF NOT EXISTS "idx_jobs_scheduled_start" ON "org"."jobs" USING btree ("scheduled_start_date");
CREATE INDEX IF NOT EXISTS "idx_jobs_is_deleted" ON "org"."jobs" USING btree ("is_deleted");

-- Add unique constraint for job numbers per organization
CREATE UNIQUE INDEX IF NOT EXISTS "unique_job_number_per_org" ON "org"."jobs" USING btree ("organization_id","job_number");

-- Add jobs foreign keys
DO $$ BEGIN
 ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "org"."properties"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_project_manager_users_id_fk" FOREIGN KEY ("project_manager") REFERENCES "auth"."users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_lead_technician_users_id_fk" FOREIGN KEY ("lead_technician") REFERENCES "auth"."users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create job team members table
CREATE TABLE IF NOT EXISTS "org"."job_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"employee_id" integer NOT NULL,
	"role" varchar(100),
	"assigned_date" date DEFAULT now(),
	"removed_date" date,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_job_employee" UNIQUE("job_id","employee_id")
);

-- Add job team members indexes
CREATE INDEX IF NOT EXISTS "idx_job_team_job" ON "org"."job_team_members" USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "idx_job_team_employee" ON "org"."job_team_members" USING btree ("employee_id");

-- Add job team members foreign keys
DO $$ BEGIN
 ALTER TABLE "org"."job_team_members" ADD CONSTRAINT "job_team_members_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."job_team_members" ADD CONSTRAINT "job_team_members_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 3. CLIENT AND PROPERTY MANAGEMENT TABLES
-- =====================================================

-- Client contacts table
CREATE TABLE IF NOT EXISTS "org"."client_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"title" varchar(100),
	"email" varchar(150),
	"phone" varchar(20),
	"mobile_phone" varchar(20),
	"contact_type" "org"."contact_type_enum" DEFAULT 'primary' NOT NULL,
	"is_primary" boolean DEFAULT false,
	"preferred_contact_method" varchar(50),
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Add client contacts indexes
CREATE INDEX IF NOT EXISTS "idx_client_contacts_org" ON "org"."client_contacts" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_client_contacts_type" ON "org"."client_contacts" USING btree ("contact_type");
CREATE INDEX IF NOT EXISTS "idx_client_contacts_is_primary" ON "org"."client_contacts" USING btree ("is_primary");

-- Add client contacts foreign keys
DO $$ BEGIN
 ALTER TABLE "org"."client_contacts" ADD CONSTRAINT "client_contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Client notes table
CREATE TABLE IF NOT EXISTS "org"."client_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"note_type" varchar(50),
	"subject" varchar(255),
	"content" text NOT NULL,
	"created_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Add client notes indexes
CREATE INDEX IF NOT EXISTS "idx_client_notes_org" ON "org"."client_notes" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_client_notes_created_by" ON "org"."client_notes" USING btree ("created_by");
CREATE INDEX IF NOT EXISTS "idx_client_notes_created_at" ON "org"."client_notes" USING btree ("created_at");

-- Add client notes foreign keys
DO $$ BEGIN
 ALTER TABLE "org"."client_notes" ADD CONSTRAINT "client_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."client_notes" ADD CONSTRAINT "client_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Client documents table
CREATE TABLE IF NOT EXISTS "org"."client_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"document_type" varchar(50),
	"description" text,
	"uploaded_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Add client documents indexes
CREATE INDEX IF NOT EXISTS "idx_client_docs_org" ON "org"."client_documents" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_client_docs_type" ON "org"."client_documents" USING btree ("document_type");

-- Add client documents foreign keys
DO $$ BEGIN
 ALTER TABLE "org"."client_documents" ADD CONSTRAINT "client_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."client_documents" ADD CONSTRAINT "client_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE restrict;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Property contacts table
CREATE TABLE IF NOT EXISTS "org"."property_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"title" varchar(100),
	"email" varchar(150),
	"phone" varchar(20),
	"mobile_phone" varchar(20),
	"contact_type" varchar(50),
	"is_primary" boolean DEFAULT false,
	"available_hours" varchar(255),
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Add property contacts indexes
CREATE INDEX IF NOT EXISTS "idx_property_contacts_property" ON "org"."property_contacts" USING btree ("property_id");
CREATE INDEX IF NOT EXISTS "idx_property_contacts_is_primary" ON "org"."property_contacts" USING btree ("is_primary");

-- Add property contacts foreign keys
DO $$ BEGIN
 ALTER TABLE "org"."property_contacts" ADD CONSTRAINT "property_contacts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "org"."properties"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Property equipment table
CREATE TABLE IF NOT EXISTS "org"."property_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"equipment_tag" varchar(100),
	"equipment_type" varchar(100) NOT NULL,
	"location" varchar(255),
	"make" varchar(100),
	"model" varchar(100),
	"serial_number" varchar(100),
	"install_date" date,
	"warranty_expiration" date,
	"capacity" varchar(100),
	"voltage_phase" varchar(50),
	"specifications" jsonb,
	"status" varchar(50) DEFAULT 'active',
	"condition" varchar(50),
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Add property equipment indexes
CREATE INDEX IF NOT EXISTS "idx_property_equipment_property" ON "org"."property_equipment" USING btree ("property_id");
CREATE INDEX IF NOT EXISTS "idx_property_equipment_type" ON "org"."property_equipment" USING btree ("equipment_type");
CREATE INDEX IF NOT EXISTS "idx_property_equipment_status" ON "org"."property_equipment" USING btree ("status");

-- Add property equipment foreign keys
DO $$ BEGIN
 ALTER TABLE "org"."property_equipment" ADD CONSTRAINT "property_equipment_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "org"."properties"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Property documents table
CREATE TABLE IF NOT EXISTS "org"."property_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"document_type" varchar(50),
	"description" text,
	"uploaded_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Add property documents indexes
CREATE INDEX IF NOT EXISTS "idx_property_docs_property" ON "org"."property_documents" USING btree ("property_id");
CREATE INDEX IF NOT EXISTS "idx_property_docs_type" ON "org"."property_documents" USING btree ("document_type");

-- Add property documents foreign keys
DO $$ BEGIN
 ALTER TABLE "org"."property_documents" ADD CONSTRAINT "property_documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "org"."properties"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."property_documents" ADD CONSTRAINT "property_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE restrict;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Property service history table
CREATE TABLE IF NOT EXISTS "org"."property_service_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"job_id" uuid,
	"bid_id" uuid,
	"service_date" date NOT NULL,
	"service_type" varchar(100),
	"description" text,
	"performed_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);

-- Add property service history indexes
CREATE INDEX IF NOT EXISTS "idx_property_service_property" ON "org"."property_service_history" USING btree ("property_id");
CREATE INDEX IF NOT EXISTS "idx_property_service_date" ON "org"."property_service_history" USING btree ("service_date");
CREATE INDEX IF NOT EXISTS "idx_property_service_job" ON "org"."property_service_history" USING btree ("job_id");

-- Add property service history foreign keys
DO $$ BEGIN
 ALTER TABLE "org"."property_service_history" ADD CONSTRAINT "property_service_history_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "org"."properties"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."property_service_history" ADD CONSTRAINT "property_service_history_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."property_service_history" ADD CONSTRAINT "property_service_history_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."property_service_history" ADD CONSTRAINT "property_service_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 4. DATA MIGRATION AND CLEANUP
-- =====================================================

-- Update existing job records with job numbers if they don't have them
UPDATE "org"."jobs" 
SET "job_number" = 'JOB-' || LPAD(CAST(EXTRACT(EPOCH FROM "created_at") AS TEXT), 10, '0')
WHERE "job_number" IS NULL;

-- Set default status for existing jobs
UPDATE "org"."jobs" 
SET "status" = 'planned'
WHERE "status" IS NULL;

-- Set default priority for existing jobs  
UPDATE "org"."jobs"
SET "priority" = 'medium'
WHERE "priority" IS NULL;

-- Update existing organizations with default client type and status
UPDATE "org"."organizations"
SET "client_type" = 'direct'
WHERE "client_type" IS NULL;

UPDATE "org"."organizations"
SET "status" = 'active'
WHERE "status" IS NULL;

-- =====================================================
-- 5. FINAL CLEANUP AND VALIDATION
-- =====================================================

-- Refresh materialized views if any exist
-- (Add any materialized view refreshes here if needed)

-- Update statistics for better query performance
ANALYZE "auth"."users";
ANALYZE "auth"."audit_logs";
ANALYZE "auth"."permissions";
ANALYZE "org"."organizations";
ANALYZE "org"."user_organizations";
ANALYZE "org"."employees";
ANALYZE "org"."jobs";
ANALYZE "org"."job_team_members";
ANALYZE "org"."properties";
ANALYZE "org"."client_contacts";
ANALYZE "org"."client_notes";
ANALYZE "org"."client_documents";
ANALYZE "org"."property_contacts";
ANALYZE "org"."property_equipment";
ANALYZE "org"."property_documents";
ANALYZE "org"."property_service_history";

-- Migration completed successfully
SELECT 'Enhanced schema migration completed successfully!' as migration_status;
