-- Convert clock_in and clock_out from timestamp to varchar(5) (HH:MM format)
-- Step 1: Add temporary columns
ALTER TABLE "org"."timesheets" 
  ADD COLUMN "clock_in_temp" VARCHAR(5),
  ADD COLUMN "clock_out_temp" VARCHAR(5);

-- Step 2: Convert existing timestamp data to HH:MM format
UPDATE "org"."timesheets"
SET 
  "clock_in_temp" = TO_CHAR("clock_in" AT TIME ZONE 'UTC', 'HH24:MI'),
  "clock_out_temp" = CASE 
    WHEN "clock_out" IS NOT NULL THEN TO_CHAR("clock_out" AT TIME ZONE 'UTC', 'HH24:MI')
    ELSE NULL
  END;

-- Step 3: Drop old columns
ALTER TABLE "org"."timesheets" 
  DROP COLUMN "clock_in",
  DROP COLUMN "clock_out";

-- Step 4: Rename temporary columns to final names
ALTER TABLE "org"."timesheets" 
  RENAME COLUMN "clock_in_temp" TO "clock_in";
ALTER TABLE "org"."timesheets" 
  RENAME COLUMN "clock_out_temp" TO "clock_out";

-- Step 5: Add NOT NULL constraint back to clock_in
ALTER TABLE "org"."timesheets" 
  ALTER COLUMN "clock_in" SET NOT NULL;