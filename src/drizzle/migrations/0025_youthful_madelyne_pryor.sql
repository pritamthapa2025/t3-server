ALTER TABLE "org"."jobs" DROP CONSTRAINT IF EXISTS "unique_job_number_per_org";--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" DROP CONSTRAINT "bid_design_build_data_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" DROP CONSTRAINT "bid_financial_breakdown_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_labor" DROP CONSTRAINT "bid_labor_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_materials" DROP CONSTRAINT "bid_materials_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" DROP CONSTRAINT "bid_operating_expenses_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" DROP CONSTRAINT "bid_plan_spec_data_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" DROP CONSTRAINT "bid_survey_data_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" DROP CONSTRAINT "bid_survey_data_technician_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_travel" DROP CONSTRAINT "bid_travel_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bid_travel" DROP CONSTRAINT "bid_travel_bid_id_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bids" DROP CONSTRAINT "bids_primary_teammate_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bids" DROP CONSTRAINT "bids_supervisor_manager_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bids" DROP CONSTRAINT "bids_technician_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."bids" DROP CONSTRAINT "bids_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."jobs" DROP CONSTRAINT "jobs_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_bid_design_build_org";--> statement-breakpoint
DROP INDEX "org"."idx_bid_design_build_bid_id";--> statement-breakpoint
DROP INDEX "org"."idx_bid_financial_org";--> statement-breakpoint
DROP INDEX "org"."idx_bid_financial_bid_id";--> statement-breakpoint
DROP INDEX "org"."idx_bid_labor_org";--> statement-breakpoint
DROP INDEX "org"."idx_bid_materials_org";--> statement-breakpoint
DROP INDEX "org"."idx_bid_operating_org";--> statement-breakpoint
DROP INDEX "org"."idx_bid_plan_spec_org";--> statement-breakpoint
DROP INDEX "org"."idx_bid_plan_spec_bid_id";--> statement-breakpoint
DROP INDEX "org"."idx_bid_survey_org";--> statement-breakpoint
DROP INDEX "org"."idx_bid_survey_bid_id";--> statement-breakpoint
DROP INDEX "org"."idx_bid_travel_org";--> statement-breakpoint
DROP INDEX "org"."idx_bid_travel_bid_id";--> statement-breakpoint
DROP INDEX "org"."idx_jobs_org";--> statement-breakpoint
DROP INDEX "org"."idx_jobs_property";--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" DROP COLUMN IF EXISTS "technician_id";--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "technician_id" integer;--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN IF EXISTS "supervisor_manager";--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "supervisor_manager" integer;--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN IF EXISTS "technician_id";--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "technician_id" integer;--> statement-breakpoint
ALTER TABLE "org"."jobs" ALTER COLUMN "bid_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD COLUMN "employee_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "additional_notes" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "terms_and_conditions" text;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "date_of_survey" date;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD COLUMN "time_of_survey" time;--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD COLUMN "bid_labor_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD CONSTRAINT "bid_labor_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" ADD CONSTRAINT "bid_survey_data_technician_id_employees_id_fk" FOREIGN KEY ("technician_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD CONSTRAINT "bid_travel_bid_labor_id_bid_labor_id_fk" FOREIGN KEY ("bid_labor_id") REFERENCES "org"."bid_labor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_supervisor_manager_employees_id_fk" FOREIGN KEY ("supervisor_manager") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_technician_id_employees_id_fk" FOREIGN KEY ("technician_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bid_labor_employee_id" ON "org"."bid_labor" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_bid_travel_labor_id" ON "org"."bid_travel" USING btree ("bid_labor_id");--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."bid_labor" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."bid_labor" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "org"."bid_materials" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."bid_survey_data" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."bid_travel" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."bid_travel" DROP COLUMN "bid_id";--> statement-breakpoint
ALTER TABLE "org"."bid_travel" DROP COLUMN "employee_name";--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "client_name";--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "client_email";--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "client_phone";--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "super_client";--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "super_primary_contact";--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "primary_contact";--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "industry_classification";--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "property";--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "primary_teammate";--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "job_id";--> statement-breakpoint
ALTER TABLE "org"."jobs" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."jobs" DROP COLUMN "property_id";--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD CONSTRAINT "unique_job_number_per_bid" UNIQUE("bid_id","job_number");