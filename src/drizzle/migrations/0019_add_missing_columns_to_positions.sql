-- Migration: Add all missing columns to positions table
-- This migration adds all columns that are defined in the schema but missing from the database
-- Based on schema: pay_rate, pay_type, currency, notes, is_active, sort_order, is_deleted

-- ============================================
-- Add all missing columns to positions table
-- ============================================

-- Add pay_rate column (numeric(10,2), NOT NULL, default 0)
ALTER TABLE "org"."positions" 
ADD COLUMN IF NOT EXISTS "pay_rate" numeric(10, 2) DEFAULT 0;

-- Update existing rows to set pay_rate = 0 if NULL
UPDATE "org"."positions" 
SET "pay_rate" = 0 
WHERE "pay_rate" IS NULL;

-- Make pay_rate NOT NULL after setting defaults
ALTER TABLE "org"."positions" 
ALTER COLUMN "pay_rate" SET NOT NULL,
ALTER COLUMN "pay_rate" SET DEFAULT 0;

-- Add pay_type column (varchar(20), NOT NULL, default 'Hourly')
ALTER TABLE "org"."positions" 
ADD COLUMN IF NOT EXISTS "pay_type" varchar(20) DEFAULT 'Hourly';

-- Update existing rows to set pay_type = 'Hourly' if NULL
UPDATE "org"."positions" 
SET "pay_type" = 'Hourly' 
WHERE "pay_type" IS NULL;

-- Make pay_type NOT NULL after setting defaults
ALTER TABLE "org"."positions" 
ALTER COLUMN "pay_type" SET NOT NULL,
ALTER COLUMN "pay_type" SET DEFAULT 'Hourly';

-- Add currency column (varchar(3), NOT NULL, default 'USD')
ALTER TABLE "org"."positions" 
ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'USD';

-- Update existing rows to set currency = 'USD' if NULL
UPDATE "org"."positions" 
SET "currency" = 'USD' 
WHERE "currency" IS NULL;

-- Make currency NOT NULL after setting defaults
ALTER TABLE "org"."positions" 
ALTER COLUMN "currency" SET NOT NULL,
ALTER COLUMN "currency" SET DEFAULT 'USD';

-- Add notes column (text, nullable)
ALTER TABLE "org"."positions" 
ADD COLUMN IF NOT EXISTS "notes" text;

-- Add is_active column (boolean, NOT NULL, default true)
ALTER TABLE "org"."positions" 
ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;

-- Update existing rows to set is_active = true if NULL
UPDATE "org"."positions" 
SET "is_active" = true 
WHERE "is_active" IS NULL;

-- Make is_active NOT NULL after setting defaults
ALTER TABLE "org"."positions" 
ALTER COLUMN "is_active" SET NOT NULL,
ALTER COLUMN "is_active" SET DEFAULT true;

-- Add sort_order column (integer, nullable)
ALTER TABLE "org"."positions" 
ADD COLUMN IF NOT EXISTS "sort_order" integer;

-- Add is_deleted column (boolean, default false)
ALTER TABLE "org"."positions" 
ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;

-- Update any NULL values to false (shouldn't be any, but just in case)
UPDATE "org"."positions" 
SET "is_deleted" = false 
WHERE "is_deleted" IS NULL;

-- ============================================
-- Add indexes for positions table
-- ============================================

-- Index for department positions lookup
CREATE INDEX IF NOT EXISTS "idx_positions_department" 
ON "org"."positions" USING btree ("department_id");

-- Index for active positions
CREATE INDEX IF NOT EXISTS "idx_positions_active" 
ON "org"."positions" USING btree ("is_active", "department_id");

-- Index for soft delete filtering
CREATE INDEX IF NOT EXISTS "idx_positions_deleted" 
ON "org"."positions" USING btree ("is_deleted");

-- ============================================
-- Notes:
-- - This migration is idempotent (safe to run multiple times)
-- - Existing positions will get default values for all new columns:
--   - pay_rate: 0
--   - pay_type: 'Hourly'
--   - currency: 'USD'
--   - is_active: true
--   - is_deleted: false
-- - You may want to update existing positions manually with appropriate
--   pay_rate and pay_type values after running this migration
-- ============================================

