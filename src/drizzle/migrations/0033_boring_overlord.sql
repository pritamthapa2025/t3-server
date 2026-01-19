ALTER TABLE "org"."job_documents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org"."job_financial_breakdown" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org"."job_financial_summary" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org"."job_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org"."job_labor" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org"."job_materials" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org"."job_notes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org"."job_operating_expenses" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org"."job_timeline" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org"."job_travel" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "org"."job_documents" CASCADE;--> statement-breakpoint
DROP TABLE "org"."job_financial_breakdown" CASCADE;--> statement-breakpoint
DROP TABLE "org"."job_financial_summary" CASCADE;--> statement-breakpoint
DROP TABLE "org"."job_history" CASCADE;--> statement-breakpoint
DROP TABLE "org"."job_labor" CASCADE;--> statement-breakpoint
DROP TABLE "org"."job_materials" CASCADE;--> statement-breakpoint
DROP TABLE "org"."job_notes" CASCADE;--> statement-breakpoint
DROP TABLE "org"."job_operating_expenses" CASCADE;--> statement-breakpoint
DROP TABLE "org"."job_timeline" CASCADE;--> statement-breakpoint
DROP TABLE "org"."job_travel" CASCADE;--> statement-breakpoint
ALTER TABLE "org"."bid_labor" DROP CONSTRAINT "bid_labor_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."jobs" DROP CONSTRAINT "jobs_project_manager_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."jobs" DROP CONSTRAINT "jobs_lead_technician_users_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_bid_labor_employee_id";--> statement-breakpoint
DROP INDEX "org"."idx_job_team_role";--> statement-breakpoint
DROP INDEX "org"."idx_jobs_priority";--> statement-breakpoint
DROP INDEX "org"."idx_jobs_project_manager";--> statement-breakpoint
DROP INDEX "org"."idx_jobs_lead_technician";--> statement-breakpoint
ALTER TABLE "org"."jobs" ALTER COLUMN "scheduled_start_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."jobs" ALTER COLUMN "scheduled_end_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD COLUMN "position_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."job_team_members" ADD COLUMN "position_id" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD CONSTRAINT "bid_labor_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "org"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_team_members" ADD CONSTRAINT "job_team_members_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "org"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bid_labor_position_id" ON "org"."bid_labor" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "idx_job_team_position" ON "org"."job_team_members" USING btree ("position_id");--> statement-breakpoint
ALTER TABLE "org"."bid_labor" DROP COLUMN "employee_id";--> statement-breakpoint
ALTER TABLE "org"."bid_labor" DROP COLUMN "quantity";--> statement-breakpoint
ALTER TABLE "org"."bid_travel" DROP COLUMN "vehicle_name";--> statement-breakpoint
ALTER TABLE "org"."job_team_members" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "org"."jobs" DROP COLUMN "priority";--> statement-breakpoint
ALTER TABLE "org"."jobs" DROP COLUMN "project_manager";--> statement-breakpoint
ALTER TABLE "org"."jobs" DROP COLUMN "lead_technician";