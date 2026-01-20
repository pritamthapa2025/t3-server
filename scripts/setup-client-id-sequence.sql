-- Setup Client ID Sequence for CL- Format
-- Purpose: Create/update PostgreSQL sequence for automatic client ID generation
-- Format: CL-000001, CL-000002, etc.
-- This script ensures thread-safe client ID generation

-- ======================================================================
-- Setup client_id sequence to handle CL- format
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
  RAISE NOTICE 'Client ID sequence setup complete. Next ID will be: CL-%', lpad((max_client_num + 1)::text, 6, '0');
END $$;

-- ======================================================================
-- Verification Query (Optional)
-- ======================================================================
-- Uncomment the following lines to verify the sequence was created properly:

-- SELECT 
--   schemaname,
--   sequencename,
--   start_value,
--   increment_by,
--   max_value,
--   min_value,
--   cache_size,
--   cycle,
--   last_value
-- FROM pg_sequences 
-- WHERE schemaname = 'org' AND sequencename = 'client_id_seq';

-- Test sequence (uncomment to test):
-- SELECT nextval('org.client_id_seq') as next_value;
-- SELECT 'CL-' || lpad(currval('org.client_id_seq')::text, 6, '0') as formatted_id;
