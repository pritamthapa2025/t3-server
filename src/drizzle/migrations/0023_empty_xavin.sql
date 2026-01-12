ALTER TABLE "org"."employee_compliance_cases" ADD COLUMN "disciplinary_action" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD COLUMN "action_date" date;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD COLUMN "action_notes" text;--> statement-breakpoint
ALTER TABLE "org"."employee_compliance_cases" ADD COLUMN "performance_impact" numeric(5, 2);