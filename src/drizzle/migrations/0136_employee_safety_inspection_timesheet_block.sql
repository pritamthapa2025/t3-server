-- Vehicle reference is application-enforced (Drizzle schema omits .references() to avoid org.schema ↔ fleet.schema import cycle).
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "timesheet_blocked_safety_inspection" boolean DEFAULT false NOT NULL;
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "timesheet_safety_block_vehicle_id" uuid;
