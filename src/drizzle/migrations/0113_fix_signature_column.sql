-- Fix customer_signature_path column to support large base64 image data
-- The column was VARCHAR(500) but base64 image data can be several KB
ALTER TABLE "org"."job_service_calls" ALTER COLUMN "customer_signature_path" TYPE TEXT;
