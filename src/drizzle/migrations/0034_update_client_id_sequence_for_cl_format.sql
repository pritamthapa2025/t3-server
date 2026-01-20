-- Migration: Update client_id sequence to handle CL- format
-- Purpose: Ensure the sequence is properly initialized for CL- format (not just CLT-)
-- This migration updates the existing sequence or creates it if it doesn't exist

-- ======================================================================
-- Update client_id sequence to handle both CL- and CLT- formats
-- ======================================================================

DO $$
DECLARE
  max_client_num INTEGER;
  seq_exists BOOLEAN;
BEGIN
  -- Check if sequence exists
  SELECT EXISTS (
    SELECT 1 FROM pg_sequences 
    WHERE schemaname = 'org' AND sequencename = 'client_id_seq'
  ) INTO seq_exists;

  -- Get the highest numeric value from existing client_ids
  -- Handle both CL- and CLT- formats
  WITH client_numbers AS (
    SELECT 
      CASE 
        WHEN client_id ~ '^CL-\d+$' THEN
          CAST(SUBSTRING(client_id FROM 'CL-(\d+)') AS INTEGER)
        WHEN client_id ~ '^CLT-\d+$' THEN
          CAST(SUBSTRING(client_id FROM 'CLT-(\d+)') AS INTEGER)
        ELSE NULL
      END AS num_value
    FROM org.organizations
    WHERE is_deleted = false
      AND (client_id ~ '^CL-\d+$' OR client_id ~ '^CLT-\d+$')
  )
  SELECT COALESCE(MAX(num_value), 0)
  INTO max_client_num
  FROM client_numbers;

  -- If sequence exists, update it to the correct value
  -- If sequence doesn't exist, create it
  IF seq_exists THEN
    -- Reset sequence to the next available number
    EXECUTE format('ALTER SEQUENCE org.client_id_seq RESTART WITH %s', max_client_num + 1);
  ELSE
    -- Create sequence starting from the next available number
    EXECUTE format('CREATE SEQUENCE org.client_id_seq START WITH %s INCREMENT BY 1', max_client_num + 1);
  END IF;
END $$;

-- ======================================================================
-- Grant permissions (if needed for specific users/roles)
-- ======================================================================
-- GRANT USAGE, SELECT ON SEQUENCE org.client_id_seq TO your_app_user;

-- ======================================================================
-- NOTES:
-- ======================================================================
-- - This migration ensures the sequence handles both CL- and CLT- formats
-- - The sequence will be set to the next available number based on existing data
-- - The application code uses CL- format going forward
-- - The sequence is atomic and thread-safe, preventing duplicate IDs

