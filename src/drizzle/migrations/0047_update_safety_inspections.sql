-- Migration: Update safety inspections table structure
-- Remove before_photos, add checklist, is_team_member, and employee_id columns

-- Remove before_photos column
ALTER TABLE org.safety_inspections DROP COLUMN IF EXISTS before_photos;

-- Add new columns
ALTER TABLE org.safety_inspections 
  ADD COLUMN checklist jsonb,
  ADD COLUMN is_team_member boolean NOT NULL DEFAULT false,
  ADD COLUMN employee_id integer REFERENCES org.employees(id);

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_inspections_employee ON org.safety_inspections(employee_id);
CREATE INDEX IF NOT EXISTS idx_inspections_is_team_member ON org.safety_inspections(is_team_member);