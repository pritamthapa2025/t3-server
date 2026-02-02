ALTER TABLE "org"."expenses" DROP CONSTRAINT "expenses_employee_id_employees_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_expenses_employee";--> statement-breakpoint
ALTER TABLE "org"."expenses" DROP COLUMN "employee_id";