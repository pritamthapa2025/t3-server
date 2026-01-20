-- Migration: Fix client_id sequence format from CLT- to CL-
-- Purpose: Update existing sequence to handle CL- format (6-digit padding) instead of CLT- format
-- This aligns the database sequence with the application code expectations

-- ======================================================================
-- Update client_id sequence to handle CL- format with proper initialization
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
  -- Handle both CL- and CLT- formats for backward compatibility
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
    RAISE NOTICE 'Updated existing sequence org.client_id_seq to start with %', max_client_num + 1;
  ELSE
    -- Create sequence starting from the next available number
    EXECUTE format('CREATE SEQUENCE org.client_id_seq START WITH %s INCREMENT BY 1', max_client_num + 1);
    RAISE NOTICE 'Created new sequence org.client_id_seq starting with %', max_client_num + 1;
  END IF;

  -- Display current status
  RAISE NOTICE 'Client ID sequence updated for CL- format (6-digit padding). Next ID: CL-%', lpad((max_client_num + 1)::text, 6, '0');
END $$;

-- ======================================================================
-- NOTES:
-- ======================================================================
-- - This migration fixes the format mismatch between migration 0009 (CLT-) and service code (CL-)
-- - The sequence now properly supports CL-000001, CL-000002, etc. format
-- - Backward compatibility maintained for any existing CLT- format IDs
-- - Application code uses CL- format with 6-digit padding (CL-000001 to CL-999999)
-- - Sequence is atomic and thread-safe, preventing duplicate IDs under high concurrency
