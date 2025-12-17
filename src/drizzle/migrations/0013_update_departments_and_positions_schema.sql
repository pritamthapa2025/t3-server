-- Migration: Update departments and positions tables with new columns
-- This migration:
-- 1. Removes organization_id from departments (departments are T3 internal)
-- 2. Adds new columns to departments table
-- 3. Adds new columns to positions table
-- 4. Updates constraints and indexes

-- ============================================
-- PART 1: Update Departments Table
-- ============================================

-- Remove organization_id column and its constraint
ALTER TABLE "org"."departments" DROP CONSTRAINT IF EXISTS "departments_organization_id_organizations_id_fk";
ALTER TABLE "org"."departments" DROP CONSTRAINT IF EXISTS "unique_dept_per_org";
ALTER TABLE "org"."departments" DROP COLUMN IF EXISTS "organization_id";

-- Add new columns to departments
ALTER TABLE "org"."departments" 
  ADD COLUMN IF NOT EXISTS "lead_id" uuid,
  ADD COLUMN IF NOT EXISTS "contact_email" varchar(255),
  ADD COLUMN IF NOT EXISTS "primary_location" varchar(255),
  ADD COLUMN IF NOT EXISTS "shift_coverage" varchar(100),
  ADD COLUMN IF NOT EXISTS "utilization" numeric(5, 4),
  ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "sort_order" integer,
  ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;

-- Add foreign key for lead_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'org' 
    AND constraint_name = 'departments_lead_id_users_id_fk'
  ) THEN
    ALTER TABLE "org"."departments" 
    ADD CONSTRAINT "departments_lead_id_users_id_fk" 
    FOREIGN KEY ("lead_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

-- Update unique constraint (remove organization_id, keep name unique)
DO $$
BEGIN
  -- Check if any unique constraint on department name exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'org' 
    AND table_name = 'departments'
    AND constraint_type = 'UNIQUE'
    AND constraint_name IN ('departments_name_unique', 'unique_dept_name')
  ) THEN
    -- No unique constraint exists, add one
    ALTER TABLE "org"."departments" 
    ADD CONSTRAINT "unique_dept_name" UNIQUE("name");
  END IF;
END $$;

-- Add indexes for departments
CREATE INDEX IF NOT EXISTS "idx_departments_active" ON "org"."departments" USING btree ("is_active");
CREATE INDEX IF NOT EXISTS "idx_departments_lead" ON "org"."departments" USING btree ("lead_id");
CREATE INDEX IF NOT EXISTS "idx_departments_deleted" ON "org"."departments" USING btree ("is_deleted");

-- ============================================
-- PART 2: Update Positions Table
-- ============================================

-- Add new columns to positions
ALTER TABLE "org"."positions" 
  ADD COLUMN IF NOT EXISTS "pay_rate" numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pay_type" varchar(20) NOT NULL DEFAULT 'Hourly',
  ADD COLUMN IF NOT EXISTS "currency" varchar(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "notes" text,
  ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "sort_order" integer,
  ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;

-- Add indexes for positions
CREATE INDEX IF NOT EXISTS "idx_positions_department" ON "org"."positions" USING btree ("department_id");
CREATE INDEX IF NOT EXISTS "idx_positions_active" ON "org"."positions" USING btree ("is_active", "department_id");
CREATE INDEX IF NOT EXISTS "idx_positions_deleted" ON "org"."positions" USING btree ("is_deleted");

-- ============================================
-- Notes:
-- - pay_rate and pay_type are NOT NULL, so existing rows will get default values
-- - If you have existing positions, you may want to update them manually
--   with appropriate pay_rate and pay_type values before running this migration
-- ============================================

