-- Migration: Add PostgreSQL sequence for supplier codes
-- Purpose: Auto-generate supplier codes (SUP-00001, SUP-00002, etc.) with race condition handling
-- Format: SUP-00001 to SUP-99999 (5 digits padded), then SUP-100000 onwards (no padding)
-- Supports unlimited digits after 99999

-- ======================================================================
-- 1. Create sequence for supplier codes (SUP-XXXXX format)
-- ======================================================================

-- Extract the highest numeric value from existing supplier_codes
DO $$
DECLARE
  max_supplier_num INTEGER;
BEGIN
  -- Get the highest numeric part from supplier_code (e.g., SUP-00001 -> 1, SUP-100000 -> 100000)
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(supplier_code FROM '^SUP-(\d+)$') AS INTEGER
      )
    ), 
    0
  )
  INTO max_supplier_num
  FROM org.inventory_suppliers
  WHERE supplier_code ~ '^SUP-\d+$';

  -- Create sequence starting from the next available number
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS org.supplier_code_seq START WITH %s INCREMENT BY 1', max_supplier_num + 1);
END $$;

-- ======================================================================
-- 2. Grant permissions (if needed for specific users/roles)
-- ======================================================================
-- GRANT USAGE, SELECT ON SEQUENCE org.supplier_code_seq TO your_app_user;

-- ======================================================================
-- NOTES:
-- ======================================================================
-- - Supplier code sequence is atomic and thread-safe
-- - Format: SUP-00001 to SUP-99999 (5 digits padded), then SUP-100000 onwards (no padding)
-- - Sequence ensures no duplicate codes even under high concurrency
-- - The application code handles the formatting (5 digits until 99999, then no padding)



