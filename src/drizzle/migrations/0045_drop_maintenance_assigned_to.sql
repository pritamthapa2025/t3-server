-- Migration: Drop assigned_to column from org.maintenance_records
-- Technician assignment is tracked via assigned_to_employee_id only

ALTER TABLE org.maintenance_records DROP COLUMN IF EXISTS assigned_to;
