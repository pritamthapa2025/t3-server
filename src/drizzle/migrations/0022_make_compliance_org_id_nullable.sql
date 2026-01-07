-- Migration: Make organization_id nullable in employee_compliance_cases
-- Purpose: Allow compliance cases to be created without a client association (for T3 internal cases)
-- organization_id is optional and only used to track which client the compliance case relates to

-- Make organization_id nullable
ALTER TABLE "org"."employee_compliance_cases" 
ALTER COLUMN "organization_id" DROP NOT NULL;

