-- Drop and recreate bid_job_type_enum with all required values
-- This ensures all enum values are present: general, plan_spec, design_build, service, preventative_maintenance, survey

-- Step 1: Alter the column to use text temporarily (to allow dropping the enum)
ALTER TABLE "org"."bids" ALTER COLUMN "job_type" TYPE text USING "job_type"::text;
--> statement-breakpoint

-- Step 2: Drop the old enum
DROP TYPE IF EXISTS "public"."bid_job_type_enum";
--> statement-breakpoint

-- Step 3: Recreate the enum with all values
CREATE TYPE "public"."bid_job_type_enum" AS ENUM('general', 'plan_spec', 'design_build', 'service', 'preventative_maintenance', 'survey');
--> statement-breakpoint

-- Step 4: Alter the column back to use the enum
ALTER TABLE "org"."bids" ALTER COLUMN "job_type" TYPE "public"."bid_job_type_enum" USING "job_type"::"public"."bid_job_type_enum";
