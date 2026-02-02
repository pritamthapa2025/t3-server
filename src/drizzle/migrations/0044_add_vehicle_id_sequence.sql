-- Migration: Add PostgreSQL sequence for vehicles.vehicle_id (VEH-000001 format)
-- Purpose: Auto-generate serial vehicle IDs in format VEH-000001, VEH-000002, etc.

DO $$
DECLARE
  max_vehicle_num INTEGER;
BEGIN
  -- Get the highest numeric part from vehicle_id (e.g., VEH-000001 -> 1, VEH-001 -> 1)
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(vehicle_id FROM 'VEH-(\d+)') AS INTEGER
      )
    ),
    0
  )
  INTO max_vehicle_num
  FROM org.vehicles
  WHERE vehicle_id ~ '^VEH-\d+$';

  -- Create sequence starting from the next available number
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS org.vehicle_id_seq START WITH %s INCREMENT BY 1', max_vehicle_num + 1);
END $$;
