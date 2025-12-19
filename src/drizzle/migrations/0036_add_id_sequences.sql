-- Migration: Add PostgreSQL sequences for client_id and employee_id
-- Purpose: Fix race conditions in ID generation by using atomic database sequences

-- ======================================================================
-- 1. Create sequence for organizations.client_id (CLT-XXXXX format)
-- ======================================================================

-- First, extract the highest numeric value from existing client_ids
DO $$
DECLARE
  max_client_num INTEGER;
BEGIN
  -- Get the highest numeric part from client_id (e.g., CLT-00003 -> 3)
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(client_id FROM 'CLT-(\d+)') AS INTEGER
      )
    ), 
    0
  )
  INTO max_client_num
  FROM org.organizations
  WHERE client_id ~ '^CLT-\d+$';

  -- Create sequence starting from the next available number
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS org.client_id_seq START WITH %s INCREMENT BY 1', max_client_num + 1);
END $$;

-- ======================================================================
-- 2. Create sequence for employees.employee_id (T3-XXXXX format)
-- ======================================================================

-- Extract the highest numeric value from existing employee_ids
DO $$
DECLARE
  max_employee_num INTEGER;
BEGIN
  -- Get the highest numeric part from employee_id (e.g., T3-00015 -> 15)
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(employee_id FROM 'T3-(\d+)') AS INTEGER
      )
    ), 
    0
  )
  INTO max_employee_num
  FROM org.employees
  WHERE employee_id ~ '^T3-\d+$';

  -- Create sequence starting from the next available number
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS org.employee_id_seq START WITH %s INCREMENT BY 1', max_employee_num + 1);
END $$;

-- ======================================================================
-- 3. Create counter table for per-organization bid numbers
-- ======================================================================
-- Bid numbers are per-organization (BID-00001, BID-00002, etc. per org)
-- So we need a counter table instead of a single sequence

CREATE TABLE IF NOT EXISTS org.id_counters (
  organization_id UUID NOT NULL,
  counter_type VARCHAR(50) NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (organization_id, counter_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_id_counters_org_type 
  ON org.id_counters(organization_id, counter_type);

-- Populate initial values for bid numbers from existing data
INSERT INTO org.id_counters (organization_id, counter_type, current_value)
SELECT 
  organization_id,
  'bid_number' as counter_type,
  COALESCE(
    MAX(
      CAST(
        SUBSTRING(bid_number FROM 'BID-(\d+)') AS INTEGER
      )
    ), 
    0
  ) as current_value
FROM org.bids
WHERE bid_number ~ '^BID-\d+$'
GROUP BY organization_id
ON CONFLICT (organization_id, counter_type) 
DO UPDATE SET current_value = EXCLUDED.current_value;

-- ======================================================================
-- 4. Create function to get next counter value atomically
-- ======================================================================
-- This function uses SELECT FOR UPDATE to prevent race conditions

CREATE OR REPLACE FUNCTION org.get_next_counter(
  p_org_id UUID,
  p_counter_type VARCHAR(50)
) RETURNS INTEGER AS $$
DECLARE
  v_next_value INTEGER;
BEGIN
  -- Lock the row and get/increment counter atomically
  INSERT INTO org.id_counters (organization_id, counter_type, current_value, updated_at)
  VALUES (p_org_id, p_counter_type, 1, NOW())
  ON CONFLICT (organization_id, counter_type) 
  DO UPDATE SET 
    current_value = org.id_counters.current_value + 1,
    updated_at = NOW()
  RETURNING current_value INTO v_next_value;
  
  RETURN v_next_value;
END;
$$ LANGUAGE plpgsql;

-- ======================================================================
-- 5. Grant permissions (if needed for specific users/roles)
-- ======================================================================
-- GRANT USAGE, SELECT ON SEQUENCE org.client_id_seq TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE org.employee_id_seq TO your_app_user;
-- GRANT ALL ON TABLE org.id_counters TO your_app_user;
-- GRANT EXECUTE ON FUNCTION org.get_next_counter TO your_app_user;

-- ======================================================================
-- NOTES:
-- ======================================================================
-- - Global sequences (client_id, employee_id) are atomic and thread-safe
-- - Per-organization counters use SELECT FOR UPDATE for atomic operations
-- - The get_next_counter() function ensures no race conditions
-- - Counters are transactional (rolled back if transaction fails)
-- - This ensures no duplicate IDs even under high concurrency

