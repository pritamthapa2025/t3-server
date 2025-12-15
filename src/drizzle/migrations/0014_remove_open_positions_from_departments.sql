-- Migration: Remove open_positions column from departments table
-- This migration removes the 'open_positions' column from org.departments table

-- Drop the open_positions column from departments table
ALTER TABLE "org"."departments" DROP COLUMN IF EXISTS "open_positions";

-- Note: This is a safe operation as open_positions was just a counter field
-- No data loss concerns as this was just metadata
