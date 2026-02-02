-- Make performed_by nullable in safety_inspections (team member inspections use employeeId instead)
ALTER TABLE "org"."safety_inspections" ALTER COLUMN "performed_by" DROP NOT NULL;
