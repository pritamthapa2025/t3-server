-- Add performance indexes for employee_reviews table
-- These indexes will significantly speed up queries for latest reviews per employee

-- Index on employee_id for fast lookups (foreign key already has one, but explicit is better)
CREATE INDEX IF NOT EXISTS "idx_employee_reviews_employee_id" 
ON "org"."employee_reviews" USING btree ("employee_id");

-- Composite index on employee_id and review_date for optimal DISTINCT ON queries
-- This allows PostgreSQL to efficiently get the latest review per employee
CREATE INDEX IF NOT EXISTS "idx_employee_reviews_employee_date" 
ON "org"."employee_reviews" USING btree ("employee_id", "review_date" DESC NULLS LAST);

-- Index on review_date alone for sorting operations
CREATE INDEX IF NOT EXISTS "idx_employee_reviews_review_date" 
ON "org"."employee_reviews" USING btree ("review_date" DESC NULLS LAST);







