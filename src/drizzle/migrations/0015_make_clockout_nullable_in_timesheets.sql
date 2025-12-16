-- Migration to make clockOut nullable and update timesheet fields
-- This allows employees to clock in first and clock out later
-- Also removes submittedBy and adds rejectedBy field

-- Make clockOut column nullable
ALTER TABLE "org"."timesheets" ALTER COLUMN "clock_out" DROP NOT NULL;

-- Remove submittedBy column
ALTER TABLE "org"."timesheets" DROP COLUMN IF EXISTS "submitted_by";

-- Add rejectedBy column
ALTER TABLE "org"."timesheets" ADD COLUMN "rejected_by" UUID REFERENCES "auth"."users"("id");

-- Update existing records where clockOut equals clockIn (temporary values) to NULL
-- This handles any existing records created with the old logic
UPDATE "org"."timesheets" 
SET "clock_out" = NULL 
WHERE "clock_out" = "clock_in" 
  AND "total_hours" = '0' 
  AND "status" = 'pending';
