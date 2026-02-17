CREATE TYPE "public"."expense_category_enum" AS ENUM('materials', 'equipment', 'transportation', 'permits', 'subcontractor', 'utilities', 'tools', 'safety', 'fleet', 'maintenance', 'fuel', 'tires', 'registration', 'repairs', 'insurance', 'office_supplies', 'rent', 'internet', 'other');--> statement-breakpoint
ALTER TABLE "org"."expense_categories" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "org"."expense_categories" CASCADE;--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" DROP CONSTRAINT IF EXISTS "expense_budgets_category_id_expense_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."expenses" DROP CONSTRAINT IF EXISTS "expenses_category_id_expense_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."job_expenses" DROP CONSTRAINT IF EXISTS "job_expenses_expense_category_id_expense_categories_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_expense_budgets_category";--> statement-breakpoint
DROP INDEX "org"."idx_expenses_category";--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" ADD COLUMN "category" "expense_category_enum";--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD COLUMN "category" "expense_category_enum" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."job_expenses" ADD COLUMN "category" "expense_category_enum" DEFAULT 'other' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_expense_budgets_category" ON "org"."expense_budgets" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_expenses_category" ON "org"."expenses" USING btree ("category");--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" DROP COLUMN "category_id";--> statement-breakpoint
ALTER TABLE "org"."expenses" DROP COLUMN "category_id";--> statement-breakpoint
ALTER TABLE "org"."job_expenses" DROP COLUMN "expense_category_id";