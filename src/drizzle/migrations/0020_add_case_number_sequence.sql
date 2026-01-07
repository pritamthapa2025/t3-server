-- Migration: Add PostgreSQL sequence for compliance case numbers
-- Purpose: Auto-generate case numbers (CASE-0001, CASE-0002, etc.) with race condition handling
-- Format: CASE-0001 to CASE-9999 (4 digits), then CASE-10001 (5 digits), CASE-100001 (6 digits), etc.
-- Supports unlimited digits dynamically

-- ======================================================================
-- 1. Create sequence for compliance case numbers (CASE-XXXX format)
-- ======================================================================

-- Extract the highest numeric value from existing case_numbers
DO $$
DECLARE
  max_case_num INTEGER;
BEGIN
  -- Get the highest numeric part from case_number (e.g., CASE-00015 -> 15, CASE-2024-001 -> NULL)
  -- Only match format CASE-XXXX where XXXX is numeric (not CASE-YYYY-XXX)
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(case_number FROM '^CASE-(\d+)$') AS INTEGER
      )
    ), 
    0
  )
  INTO max_case_num
  FROM org.employee_compliance_cases
  WHERE case_number ~ '^CASE-\d+$';

  -- Create sequence starting from the next available number
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS org.case_number_seq START WITH %s INCREMENT BY 1', max_case_num + 1);
END $$;

-- ======================================================================
-- 2. Update employee_id sequence to handle existing data properly
-- ======================================================================
-- Ensure employee_id_seq exists and is properly initialized
-- (This is a safety check in case the sequence wasn't created properly)

DO $$
DECLARE
  max_employee_num INTEGER;
  seq_exists BOOLEAN;
BEGIN
  -- Check if sequence exists
  SELECT EXISTS (
    SELECT 1 FROM pg_sequences 
    WHERE schemaname = 'org' AND sequencename = 'employee_id_seq'
  ) INTO seq_exists;

  -- If sequence doesn't exist, create it
  IF NOT seq_exists THEN
    -- Get the highest numeric part from employee_id
    SELECT COALESCE(
      MAX(
        CAST(
          SUBSTRING(employee_id FROM '^T3-(\d+)$') AS INTEGER
        )
      ), 
      0
    )
    INTO max_employee_num
    FROM org.employees
    WHERE employee_id ~ '^T3-\d+$';

    -- Create sequence starting from the next available number
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS org.employee_id_seq START WITH %s INCREMENT BY 1', max_employee_num + 1);
  END IF;
END $$;

-- ======================================================================
-- 3. Grant permissions (if needed for specific users/roles)
-- ======================================================================
-- GRANT USAGE, SELECT ON SEQUENCE org.case_number_seq TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE org.employee_id_seq TO your_app_user;

-- ======================================================================
-- NOTES:
-- ======================================================================
-- - Case number sequence is atomic and thread-safe
-- - Format: CASE-0001 to CASE-9999 (4 digits), then CASE-10001 (5 digits), CASE-100001 (6 digits), etc.
-- - Employee ID format: T3-0001 to T3-9999 (4 digits), then T3-10001 (5 digits), T3-100001 (6 digits), etc.
-- - Sequences ensure no duplicate IDs even under high concurrency
-- - The application code handles the formatting dynamically (minimum 4 digits, then uses actual digit count)

