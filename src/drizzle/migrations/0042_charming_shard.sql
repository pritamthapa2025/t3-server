ALTER TABLE "org"."expenses" ADD COLUMN "employee_id" integer;--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD COLUMN "is_reimbursable" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD COLUMN "reimbursement_status" "reimbursement_status_enum";--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD COLUMN "reimbursement_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD CONSTRAINT "expenses_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_expenses_employee" ON "org"."expenses" USING btree ("employee_id");