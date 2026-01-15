-- Add missing enum values to bid_job_type_enum
-- These values are already defined in the code enum but missing from the database
-- This migration adds: 'general', 'service', 'preventative_maintenance'

-- IMPORTANT: ALTER TYPE ... ADD VALUE cannot be executed inside a DO block or function
-- These must be run as standalone statements
-- If a value already exists, you'll get an error - that's okay, just means it's already there
-- For PostgreSQL 12+, these can be run in a transaction
-- For PostgreSQL < 12, run each statement separately outside a transaction

-- Add 'general' value
ALTER TYPE "public"."bid_job_type_enum" ADD VALUE 'general';
--> statement-breakpoint

-- Add 'service' value
ALTER TYPE "public"."bid_job_type_enum" ADD VALUE 'service';
--> statement-breakpoint

-- Add 'preventative_maintenance' value
ALTER TYPE "public"."bid_job_type_enum" ADD VALUE 'preventative_maintenance';


