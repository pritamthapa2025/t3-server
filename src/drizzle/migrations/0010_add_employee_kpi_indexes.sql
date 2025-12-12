-- Add performance indexes for employee KPI queries
-- These indexes will significantly speed up the getEmployeeKPIs endpoint

-- Composite index for filtering by isDeleted and status (used in KPI queries)
CREATE INDEX IF NOT EXISTS "idx_employees_deleted_status" 
ON "org"."employees" USING btree ("is_deleted", "status");

-- Index on isDeleted for filtering active employees (most common filter)
CREATE INDEX IF NOT EXISTS "idx_employees_deleted" 
ON "org"."employees" USING btree ("is_deleted");

-- Composite index for timesheet employee_id, status, and date range queries
-- This optimizes the attendance calculation query (EXISTS subquery)
-- Order: employee_id first (for join), then date (for range), then status (for filter)
CREATE INDEX IF NOT EXISTS "idx_timesheets_employee_date_status" 
ON "org"."timesheets" USING btree ("employee_id", "sheet_date", "status");

-- Additional index for status and date filtering (alternative query patterns)
CREATE INDEX IF NOT EXISTS "idx_timesheets_status_date" 
ON "org"."timesheets" USING btree ("status", "sheet_date");

