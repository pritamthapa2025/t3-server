-- Enhanced T3 Mechanical Schema Migration
-- This migration implements comprehensive schema enhancements for clients, properties, jobs, employees, and permissions

-- 1. Create new enums
CREATE TYPE "public"."client_type_enum" AS ENUM('direct', 'subcontractor', 'government', 'property_management', 'corporate', 'individual');
CREATE TYPE "public"."client_status_enum" AS ENUM('active', 'inactive', 'prospect', 'suspended', 'archived');
CREATE TYPE "public"."contact_type_enum" AS ENUM('primary', 'billing', 'technical', 'emergency', 'project_manager');
CREATE TYPE "public"."property_type_enum" AS ENUM('commercial', 'industrial', 'residential', 'healthcare', 'education', 'hospitality', 'retail', 'warehouse', 'government', 'mixed_use');
CREATE TYPE "public"."property_status_enum" AS ENUM('active', 'inactive', 'under_construction', 'archived');
CREATE TYPE "public"."job_status_enum" AS ENUM('planned', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled', 'invoiced', 'closed');
CREATE TYPE "public"."job_priority_enum" AS ENUM('low', 'medium', 'high', 'emergency');
CREATE TYPE "public"."user_organization_type_enum" AS ENUM('t3_employee', 'client_user', 'contractor');
CREATE TYPE "public"."permission_module_enum" AS ENUM('dashboard', 'bids', 'jobs', 'clients', 'properties', 'fleet', 'team', 'financial', 'settings', 'reports');

-- 2. Fix audit_logs table primary key (change from bigint to serial)
ALTER TABLE "auth"."audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_pkey";
ALTER TABLE "auth"."audit_logs" ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE IF EXISTS "auth"."audit_logs_id_seq";
CREATE SEQUENCE "auth"."audit_logs_id_seq" AS INTEGER;
ALTER TABLE "auth"."audit_logs" ALTER COLUMN "id" SET DEFAULT nextval('auth.audit_logs_id_seq');
ALTER TABLE "auth"."audit_logs" ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");
ALTER SEQUENCE "auth"."audit_logs_id_seq" OWNED BY "auth"."audit_logs"."id";

-- Add metadata column to audit_logs
ALTER TABLE "auth"."audit_logs" ADD COLUMN IF NOT EXISTS "metadata" jsonb;

-- 3. Enhance users table with additional fields
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "city" varchar(100);
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "state" varchar(50);
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "zip_code" varchar(20);
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "date_of_birth" date;
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "emergency_contact_name" varchar(150);
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "emergency_contact_phone" varchar(20);
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "password_changed_at" timestamp;

-- 4. Enhance permissions table with module categorization
ALTER TABLE "auth"."permissions" ADD COLUMN IF NOT EXISTS "module" "permission_module_enum" NOT NULL DEFAULT 'dashboard';
CREATE INDEX IF NOT EXISTS "idx_permissions_module" ON "auth"."permissions" ("module");

-- 5. Remove organizationId from employees table and enhance it
ALTER TABLE "org"."employees" DROP COLUMN IF EXISTS "organization_id";
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "hire_date" date;
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "termination_date" date;
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "hourly_rate" numeric(10,2);
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "salary" numeric(15,2);
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "pay_type" varchar(20);
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "certifications" jsonb;
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "skills" jsonb;
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "licenses" jsonb;
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "employment_type" varchar(50);

-- Add new indexes for employees
CREATE INDEX IF NOT EXISTS "idx_employees_department" ON "org"."employees" ("department_id");
CREATE INDEX IF NOT EXISTS "idx_employees_position" ON "org"."employees" ("position_id");
CREATE INDEX IF NOT EXISTS "idx_employees_status" ON "org"."employees" ("status");
CREATE INDEX IF NOT EXISTS "idx_employees_reports_to" ON "org"."employees" ("reports_to");

-- 6. Enhance organizations table for comprehensive client management
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "legal_name" varchar(255);
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "client_type" "client_type_enum" NOT NULL DEFAULT 'direct';
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "status" "client_status_enum" NOT NULL DEFAULT 'prospect';
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "industry_classification" varchar(100);
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "tax_id" varchar(50);
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "website" varchar(255);
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "parent_organization_id" uuid REFERENCES "org"."organizations"("id") ON DELETE SET NULL;
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "credit_limit" numeric(15,2);
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "payment_terms" varchar(100);
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "preferred_payment_method" varchar(50);
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "billing_address_line1" varchar(255);
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "billing_address_line2" varchar(255);
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "billing_city" varchar(100);
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "billing_state" varchar(50);
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "billing_zip_code" varchar(20);
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "billing_country" varchar(100) DEFAULT 'USA';
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "tags" jsonb;
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "account_manager" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL;
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "created_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL;
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;

-- Add indexes for organizations
CREATE INDEX IF NOT EXISTS "idx_orgs_status" ON "org"."organizations" ("status");
CREATE INDEX IF NOT EXISTS "idx_orgs_client_type" ON "org"."organizations" ("client_type");
CREATE INDEX IF NOT EXISTS "idx_orgs_parent" ON "org"."organizations" ("parent_organization_id");
CREATE INDEX IF NOT EXISTS "idx_orgs_is_deleted" ON "org"."organizations" ("is_deleted");
CREATE INDEX IF NOT EXISTS "idx_orgs_account_manager" ON "org"."organizations" ("account_manager");

-- 7. Create client contacts table
CREATE TABLE IF NOT EXISTS "org"."client_contacts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" uuid NOT NULL REFERENCES "org"."organizations"("id") ON DELETE CASCADE,
    "full_name" varchar(150) NOT NULL,
    "title" varchar(100),
    "email" varchar(150),
    "phone" varchar(20),
    "mobile_phone" varchar(20),
    "contact_type" "contact_type_enum" NOT NULL DEFAULT 'primary',
    "is_primary" boolean DEFAULT false,
    "preferred_contact_method" varchar(50),
    "notes" text,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE INDEX "idx_client_contacts_org" ON "org"."client_contacts" ("organization_id");
CREATE INDEX "idx_client_contacts_type" ON "org"."client_contacts" ("contact_type");
CREATE INDEX "idx_client_contacts_is_primary" ON "org"."client_contacts" ("is_primary");

-- 8. Create client notes table
CREATE TABLE IF NOT EXISTS "org"."client_notes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" uuid NOT NULL REFERENCES "org"."organizations"("id") ON DELETE CASCADE,
    "note_type" varchar(50),
    "subject" varchar(255),
    "content" text NOT NULL,
    "created_by" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE RESTRICT,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE INDEX "idx_client_notes_org" ON "org"."client_notes" ("organization_id");
CREATE INDEX "idx_client_notes_created_by" ON "org"."client_notes" ("created_by");
CREATE INDEX "idx_client_notes_created_at" ON "org"."client_notes" ("created_at");

-- 9. Create client documents table
CREATE TABLE IF NOT EXISTS "org"."client_documents" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" uuid NOT NULL REFERENCES "org"."organizations"("id") ON DELETE CASCADE,
    "file_name" varchar(255) NOT NULL,
    "file_path" varchar(500) NOT NULL,
    "file_type" varchar(50),
    "file_size" integer,
    "document_type" varchar(50),
    "description" text,
    "uploaded_by" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE RESTRICT,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE INDEX "idx_client_docs_org" ON "org"."client_documents" ("organization_id");
CREATE INDEX "idx_client_docs_type" ON "org"."client_documents" ("document_type");

-- 10. Create properties table
CREATE TABLE IF NOT EXISTS "org"."properties" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" uuid NOT NULL REFERENCES "org"."organizations"("id") ON DELETE CASCADE,
    "property_name" varchar(255) NOT NULL,
    "property_code" varchar(50),
    "property_type" "property_type_enum" NOT NULL,
    "status" "property_status_enum" NOT NULL DEFAULT 'active',
    "address_line1" varchar(255) NOT NULL,
    "address_line2" varchar(255),
    "city" varchar(100) NOT NULL,
    "state" varchar(50) NOT NULL,
    "zip_code" varchar(20) NOT NULL,
    "country" varchar(100) DEFAULT 'USA',
    "square_footage" numeric(10,2),
    "number_of_floors" integer,
    "year_built" integer,
    "access_instructions" text,
    "gate_code" varchar(50),
    "parking_instructions" text,
    "operating_hours" jsonb,
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "description" text,
    "notes" text,
    "tags" jsonb,
    "created_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE INDEX "idx_properties_org" ON "org"."properties" ("organization_id");
CREATE INDEX "idx_properties_type" ON "org"."properties" ("property_type");
CREATE INDEX "idx_properties_status" ON "org"."properties" ("status");
CREATE INDEX "idx_properties_city_state" ON "org"."properties" ("city", "state");
CREATE INDEX "idx_properties_is_deleted" ON "org"."properties" ("is_deleted");
CREATE UNIQUE INDEX "unique_property_code_per_org" ON "org"."properties" ("organization_id", "property_code");

-- 11. Create property contacts table
CREATE TABLE IF NOT EXISTS "org"."property_contacts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "property_id" uuid NOT NULL REFERENCES "org"."properties"("id") ON DELETE CASCADE,
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

CREATE INDEX "idx_property_contacts_property" ON "org"."property_contacts" ("property_id");
CREATE INDEX "idx_property_contacts_is_primary" ON "org"."property_contacts" ("is_primary");

-- 12. Create property equipment table
CREATE TABLE IF NOT EXISTS "org"."property_equipment" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "property_id" uuid NOT NULL REFERENCES "org"."properties"("id") ON DELETE CASCADE,
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

CREATE INDEX "idx_property_equipment_property" ON "org"."property_equipment" ("property_id");
CREATE INDEX "idx_property_equipment_type" ON "org"."property_equipment" ("equipment_type");
CREATE INDEX "idx_property_equipment_status" ON "org"."property_equipment" ("status");

-- 13. Create property documents table
CREATE TABLE IF NOT EXISTS "org"."property_documents" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "property_id" uuid NOT NULL REFERENCES "org"."properties"("id") ON DELETE CASCADE,
    "file_name" varchar(255) NOT NULL,
    "file_path" varchar(500) NOT NULL,
    "file_type" varchar(50),
    "file_size" integer,
    "document_type" varchar(50),
    "description" text,
    "uploaded_by" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE RESTRICT,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE INDEX "idx_property_docs_property" ON "org"."property_documents" ("property_id");
CREATE INDEX "idx_property_docs_type" ON "org"."property_documents" ("document_type");

-- 14. Create property service history table
CREATE TABLE IF NOT EXISTS "org"."property_service_history" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "property_id" uuid NOT NULL REFERENCES "org"."properties"("id") ON DELETE CASCADE,
    "job_id" uuid REFERENCES "org"."jobs"("id") ON DELETE SET NULL,
    "bid_id" uuid REFERENCES "org"."bids"("id") ON DELETE SET NULL,
    "service_date" date NOT NULL,
    "service_type" varchar(100),
    "description" text,
    "performed_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now()
);

CREATE INDEX "idx_property_service_property" ON "org"."property_service_history" ("property_id");
CREATE INDEX "idx_property_service_date" ON "org"."property_service_history" ("service_date");
CREATE INDEX "idx_property_service_job" ON "org"."property_service_history" ("job_id");

-- 15. Create user organizations table (Many-to-Many relationship)
CREATE TABLE IF NOT EXISTS "org"."user_organizations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "organization_id" uuid NOT NULL REFERENCES "org"."organizations"("id") ON DELETE CASCADE,
    "user_type" "user_organization_type_enum" NOT NULL DEFAULT 'client_user',
    "title" varchar(100),
    "is_active" boolean DEFAULT true,
    "is_primary" boolean DEFAULT false,
    "joined_at" timestamp DEFAULT now(),
    "left_at" timestamp,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX "unique_user_org" ON "org"."user_organizations" ("user_id", "organization_id");
CREATE INDEX "idx_user_orgs_user" ON "org"."user_organizations" ("user_id");
CREATE INDEX "idx_user_orgs_org" ON "org"."user_organizations" ("organization_id");
CREATE INDEX "idx_user_orgs_type" ON "org"."user_organizations" ("user_type");
CREATE INDEX "idx_user_orgs_is_active" ON "org"."user_organizations" ("is_active");

-- 16. Enhance jobs table
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "job_number" varchar(100) NOT NULL DEFAULT '';
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "property_id" uuid REFERENCES "org"."properties"("id") ON DELETE SET NULL;
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "bid_id" uuid REFERENCES "org"."bids"("id") ON DELETE SET NULL;
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "status" "job_status_enum" NOT NULL DEFAULT 'planned';
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "priority" "job_priority_enum" NOT NULL DEFAULT 'medium';
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "job_type" varchar(100);
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "service_type" varchar(100);
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "scheduled_start_date" date;
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "scheduled_end_date" date;
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "actual_start_date" date;
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "actual_end_date" date;
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "site_address" text;
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "site_contact_name" varchar(150);
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "site_contact_phone" varchar(20);
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "access_instructions" text;
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "contract_value" numeric(15,2);
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "actual_cost" numeric(15,2);
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "project_manager" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL;
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "lead_technician" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL;
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "completion_notes" text;
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "completion_percentage" numeric(5,2) DEFAULT 0;
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "created_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL;
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;

-- Add unique constraint and indexes for jobs
CREATE UNIQUE INDEX IF NOT EXISTS "unique_job_number_per_org" ON "org"."jobs" ("organization_id", "job_number");
CREATE INDEX IF NOT EXISTS "idx_jobs_org" ON "org"."jobs" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_jobs_property" ON "org"."jobs" ("property_id");
CREATE INDEX IF NOT EXISTS "idx_jobs_bid" ON "org"."jobs" ("bid_id");
CREATE INDEX IF NOT EXISTS "idx_jobs_status" ON "org"."jobs" ("status");
CREATE INDEX IF NOT EXISTS "idx_jobs_priority" ON "org"."jobs" ("priority");
CREATE INDEX IF NOT EXISTS "idx_jobs_scheduled_start" ON "org"."jobs" ("scheduled_start_date");
CREATE INDEX IF NOT EXISTS "idx_jobs_is_deleted" ON "org"."jobs" ("is_deleted");

-- 17. Create job team members table
CREATE TABLE IF NOT EXISTS "org"."job_team_members" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "job_id" uuid NOT NULL REFERENCES "org"."jobs"("id") ON DELETE CASCADE,
    "employee_id" integer NOT NULL REFERENCES "org"."employees"("id") ON DELETE CASCADE,
    "role" varchar(100),
    "assigned_date" date DEFAULT CURRENT_DATE,
    "removed_date" date,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX "unique_job_employee" ON "org"."job_team_members" ("job_id", "employee_id");
CREATE INDEX "idx_job_team_job" ON "org"."job_team_members" ("job_id");
CREATE INDEX "idx_job_team_employee" ON "org"."job_team_members" ("employee_id");

-- 18. Update job_number for existing jobs (generate unique numbers)
UPDATE "org"."jobs" SET "job_number" = 'JOB-' || LPAD(id::text, 6, '0') WHERE "job_number" = '' OR "job_number" IS NULL;

-- Migration completed successfully
-- This migration enhances the T3 Mechanical database with comprehensive client and property management capabilities