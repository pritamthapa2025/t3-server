-- Rollback Script for Enhanced Schema Migration
-- This script safely rolls back all changes made in 0001_enhanced_schema.sql

-- =====================================================
-- ROLLBACK WARNING
-- =====================================================
-- This rollback will remove enhanced features and may result in data loss
-- Make sure to backup your database before running this rollback

-- =====================================================
-- 1. DROP NEW TABLES (in reverse dependency order)
-- =====================================================

-- Drop property management tables
DROP TABLE IF EXISTS "org"."property_service_history";
DROP TABLE IF EXISTS "org"."property_documents";
DROP TABLE IF EXISTS "org"."property_equipment";
DROP TABLE IF EXISTS "org"."property_contacts";

-- Drop client management tables
DROP TABLE IF EXISTS "org"."client_documents";
DROP TABLE IF EXISTS "org"."client_notes";
DROP TABLE IF EXISTS "org"."client_contacts";

-- Drop job management tables
DROP TABLE IF EXISTS "org"."job_team_members";

-- Drop user organization membership table
DROP TABLE IF EXISTS "org"."user_organizations";

-- =====================================================
-- 2. ROLLBACK JOBS TABLE
-- =====================================================

-- Remove enhanced job columns
ALTER TABLE "org"."jobs" 
DROP COLUMN IF EXISTS "job_number",
DROP COLUMN IF EXISTS "property_id",
DROP COLUMN IF EXISTS "bid_id",
DROP COLUMN IF EXISTS "status",
DROP COLUMN IF EXISTS "priority",
DROP COLUMN IF EXISTS "job_type",
DROP COLUMN IF EXISTS "service_type",
DROP COLUMN IF EXISTS "scheduled_start_date",
DROP COLUMN IF EXISTS "scheduled_end_date",
DROP COLUMN IF EXISTS "actual_start_date",
DROP COLUMN IF EXISTS "actual_end_date",
DROP COLUMN IF EXISTS "site_address",
DROP COLUMN IF EXISTS "site_contact_name",
DROP COLUMN IF EXISTS "site_contact_phone",
DROP COLUMN IF EXISTS "access_instructions",
DROP COLUMN IF EXISTS "contract_value",
DROP COLUMN IF EXISTS "actual_cost",
DROP COLUMN IF EXISTS "project_manager",
DROP COLUMN IF EXISTS "lead_technician",
DROP COLUMN IF EXISTS "completion_notes",
DROP COLUMN IF EXISTS "completion_percentage",
DROP COLUMN IF EXISTS "created_by",
DROP COLUMN IF EXISTS "is_deleted";

-- Drop job indexes
DROP INDEX IF EXISTS "idx_jobs_org";
DROP INDEX IF EXISTS "idx_jobs_property";
DROP INDEX IF EXISTS "idx_jobs_bid";
DROP INDEX IF EXISTS "idx_jobs_status";
DROP INDEX IF EXISTS "idx_jobs_priority";
DROP INDEX IF EXISTS "idx_jobs_scheduled_start";
DROP INDEX IF EXISTS "idx_jobs_is_deleted";
DROP INDEX IF EXISTS "unique_job_number_per_org";

-- =====================================================
-- 3. ROLLBACK EMPLOYEES TABLE
-- =====================================================

-- Remove enhanced employee columns
ALTER TABLE "org"."employees" 
DROP COLUMN IF EXISTS "hire_date",
DROP COLUMN IF EXISTS "termination_date",
DROP COLUMN IF EXISTS "hourly_rate",
DROP COLUMN IF EXISTS "salary",
DROP COLUMN IF EXISTS "pay_type",
DROP COLUMN IF EXISTS "certifications",
DROP COLUMN IF EXISTS "skills",
DROP COLUMN IF EXISTS "licenses",
DROP COLUMN IF EXISTS "employment_type";

-- Drop enhanced employee indexes
DROP INDEX IF EXISTS "idx_employees_department";
DROP INDEX IF EXISTS "idx_employees_position";
DROP INDEX IF EXISTS "idx_employees_status";
DROP INDEX IF EXISTS "idx_employees_reports_to";
DROP INDEX IF EXISTS "idx_employees_pay_type";
DROP INDEX IF EXISTS "idx_employees_employment_type";
DROP INDEX IF EXISTS "unique_employee_id";

-- Restore organizationId to employees (if you want to revert to old model)
-- Note: This will require manual data migration to populate organizationId
-- ALTER TABLE "org"."employees" ADD COLUMN "organization_id" uuid;

-- =====================================================
-- 4. ROLLBACK ORGANIZATIONS TABLE
-- =====================================================

-- Remove enhanced organization columns
ALTER TABLE "org"."organizations" 
DROP COLUMN IF EXISTS "legal_name",
DROP COLUMN IF EXISTS "client_type",
DROP COLUMN IF EXISTS "status",
DROP COLUMN IF EXISTS "industry_classification",
DROP COLUMN IF EXISTS "tax_id",
DROP COLUMN IF EXISTS "website",
DROP COLUMN IF EXISTS "parent_organization_id",
DROP COLUMN IF EXISTS "credit_limit",
DROP COLUMN IF EXISTS "payment_terms",
DROP COLUMN IF EXISTS "preferred_payment_method",
DROP COLUMN IF EXISTS "billing_address_line1",
DROP COLUMN IF EXISTS "billing_address_line2",
DROP COLUMN IF EXISTS "billing_city",
DROP COLUMN IF EXISTS "billing_state",
DROP COLUMN IF EXISTS "billing_zip_code",
DROP COLUMN IF EXISTS "billing_country",
DROP COLUMN IF EXISTS "notes",
DROP COLUMN IF EXISTS "tags",
DROP COLUMN IF EXISTS "account_manager",
DROP COLUMN IF EXISTS "created_by",
DROP COLUMN IF EXISTS "is_deleted";

-- Drop organization indexes
DROP INDEX IF EXISTS "idx_orgs_status";
DROP INDEX IF EXISTS "idx_orgs_client_type";
DROP INDEX IF EXISTS "idx_orgs_parent";
DROP INDEX IF EXISTS "idx_orgs_is_deleted";
DROP INDEX IF EXISTS "idx_orgs_account_manager";

-- =====================================================
-- 5. ROLLBACK AUTH SCHEMA
-- =====================================================

-- Rollback permissions table
ALTER TABLE "auth"."permissions" 
DROP COLUMN IF EXISTS "action";

-- Note: Cannot easily rollback enum change, would need to:
-- 1. Create new column with old type
-- 2. Migrate data
-- 3. Drop old column
-- 4. Rename new column
-- For simplicity, leaving module as enum but removing action column

-- Drop permissions indexes
DROP INDEX IF EXISTS "idx_permissions_module";
DROP INDEX IF EXISTS "idx_permissions_action";

-- Rollback users table
ALTER TABLE "auth"."users" 
DROP COLUMN IF EXISTS "address",
DROP COLUMN IF EXISTS "city",
DROP COLUMN IF EXISTS "state",
DROP COLUMN IF EXISTS "zip_code",
DROP COLUMN IF EXISTS "date_of_birth",
DROP COLUMN IF EXISTS "emergency_contact_name",
DROP COLUMN IF EXISTS "emergency_contact_phone",
DROP COLUMN IF EXISTS "email_verified_at",
DROP COLUMN IF EXISTS "password_changed_at";

-- Drop user indexes
DROP INDEX IF EXISTS "idx_users_city_state";

-- Rollback audit logs (restore old broken version)
DROP TABLE IF EXISTS "auth"."audit_logs";
CREATE TABLE "auth"."audit_logs" (
	"id" bigint PRIMARY KEY NOT NULL, -- Note: This is the broken version without auto-increment
	"user_id" uuid,
	"event_type" varchar(100),
	"description" text,
	"ip_address" varchar(50),
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);

-- Add foreign key for audit logs
DO $$ BEGIN
 ALTER TABLE "auth"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 6. DROP ENUMS (in reverse order)
-- =====================================================

-- Drop new enums
DROP TYPE IF EXISTS "org"."job_priority_enum";
DROP TYPE IF EXISTS "org"."job_status_enum";
DROP TYPE IF EXISTS "org"."user_organization_type_enum";

-- Note: Cannot drop permission_module_enum if permissions.module still uses it
-- DROP TYPE IF EXISTS "auth"."permission_module_enum";

-- =====================================================
-- 7. FINAL CLEANUP
-- =====================================================

-- Update statistics
ANALYZE "auth"."users";
ANALYZE "auth"."audit_logs";
ANALYZE "auth"."permissions";
ANALYZE "org"."organizations";
ANALYZE "org"."employees";
ANALYZE "org"."jobs";

-- Rollback completed
SELECT 'Enhanced schema rollback completed. Some features may be permanently lost.' as rollback_status;
