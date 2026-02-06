ALTER TABLE "org"."pay_periods" DROP CONSTRAINT "unique_pay_period";--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" DROP CONSTRAINT "unique_payroll_entry_number";--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" DROP CONSTRAINT "unique_payroll_run_number";--> statement-breakpoint
ALTER TABLE "org"."employee_benefits" DROP CONSTRAINT "employee_benefits_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_compensation" DROP CONSTRAINT "employee_compensation_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."employee_leave_balances" DROP CONSTRAINT "employee_leave_balances_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."pay_periods" DROP CONSTRAINT "pay_periods_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_audit_log" DROP CONSTRAINT "payroll_audit_log_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" DROP CONSTRAINT "payroll_entries_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_locks" DROP CONSTRAINT "payroll_locks_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" DROP CONSTRAINT "payroll_runs_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_employee_benefits_org";--> statement-breakpoint
DROP INDEX "org"."idx_employee_compensation_org";--> statement-breakpoint
DROP INDEX "org"."idx_employee_leave_balances_org";--> statement-breakpoint
DROP INDEX "org"."idx_pay_periods_org_status";--> statement-breakpoint
DROP INDEX "org"."idx_payroll_audit_org";--> statement-breakpoint
DROP INDEX "org"."idx_payroll_locks_org";--> statement-breakpoint
DROP INDEX "org"."idx_payroll_runs_org_status";--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_current_dispatch_task_id_dispatch_tasks_id_fk" FOREIGN KEY ("current_dispatch_task_id") REFERENCES "org"."dispatch_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pay_periods_status" ON "org"."pay_periods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payroll_runs_status" ON "org"."payroll_runs" USING btree ("status");--> statement-breakpoint
ALTER TABLE "org"."employee_benefits" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."employee_compensation" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."employee_leave_balances" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."pay_periods" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."payroll_audit_log" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."payroll_locks" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."pay_periods" ADD CONSTRAINT "unique_pay_period" UNIQUE("frequency","start_date","end_date");--> statement-breakpoint
ALTER TABLE "org"."payroll_entries" ADD CONSTRAINT "unique_payroll_entry_number" UNIQUE("entry_number");--> statement-breakpoint
ALTER TABLE "org"."payroll_runs" ADD CONSTRAINT "unique_payroll_run_number" UNIQUE("run_number");