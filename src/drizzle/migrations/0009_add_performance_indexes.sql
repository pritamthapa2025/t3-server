-- Add performance indexes for getEmployeeById optimization
-- These indexes will significantly speed up queries for employee details

-- Timesheets indexes
CREATE INDEX IF NOT EXISTS "idx_timesheets_employee_id" 
ON "org"."timesheets" USING btree ("employee_id");

CREATE INDEX IF NOT EXISTS "idx_timesheets_employee_date" 
ON "org"."timesheets" USING btree ("employee_id", "sheet_date" DESC);

CREATE INDEX IF NOT EXISTS "idx_timesheets_employee_created" 
ON "org"."timesheets" USING btree ("employee_id", "created_at" DESC);

-- Composite index for date range queries (employee_id + date range)
CREATE INDEX IF NOT EXISTS "idx_timesheets_employee_date_range" 
ON "org"."timesheets" USING btree ("employee_id", "sheet_date");

-- Timesheet approvals indexes
CREATE INDEX IF NOT EXISTS "idx_timesheet_approvals_timesheet_id" 
ON "org"."timesheet_approvals" USING btree ("timesheet_id");

CREATE INDEX IF NOT EXISTS "idx_timesheet_approvals_created_at" 
ON "org"."timesheet_approvals" USING btree ("created_at" DESC);

-- User bank accounts indexes
CREATE INDEX IF NOT EXISTS "idx_user_bank_accounts_user_id" 
ON "org"."user_bank_accounts" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "idx_user_bank_accounts_user_primary" 
ON "org"."user_bank_accounts" USING btree ("user_id", "is_primary", "is_deleted");

-- Employee reviews indexes (additional optimization)
CREATE INDEX IF NOT EXISTS "idx_employee_reviews_employee_created" 
ON "org"."employee_reviews" USING btree ("employee_id", "review_date" DESC);

CREATE INDEX IF NOT EXISTS "idx_employee_reviews_reviewer_id" 
ON "org"."employee_reviews" USING btree ("reviewer_id");



