-- Create expense-related enums first
CREATE TYPE "expense_status_enum" AS ENUM('draft', 'submitted', 'approved', 'rejected', 'paid', 'reimbursed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "expense_type_enum" AS ENUM('travel', 'meals', 'accommodation', 'fuel', 'vehicle_maintenance', 'equipment', 'materials', 'tools', 'permits', 'licenses', 'insurance', 'professional_services', 'subcontractor', 'office_supplies', 'utilities', 'marketing', 'training', 'software', 'subscriptions', 'other');
--> statement-breakpoint
CREATE TYPE "expense_payment_method_enum" AS ENUM('cash', 'personal_card', 'company_card', 'check', 'bank_transfer', 'petty_cash', 'reimbursement', 'other');
--> statement-breakpoint
CREATE TYPE "expense_report_status_enum" AS ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected', 'paid', 'cancelled');
--> statement-breakpoint
CREATE TYPE "approval_status_enum" AS ENUM('pending', 'approved', 'rejected', 'escalated', 'expired');
--> statement-breakpoint
CREATE TYPE "reimbursement_status_enum" AS ENUM('pending', 'approved', 'processing', 'paid', 'rejected', 'cancelled');
--> statement-breakpoint
CREATE TYPE "mileage_type_enum" AS ENUM('business', 'personal', 'commute', 'client_visit', 'job_site', 'office_travel', 'other');
--> statement-breakpoint
CREATE TYPE "tax_status_enum" AS ENUM('deductible', 'non_deductible', 'taxable', 'non_taxable', 'tax_exempt', 'pending_review');
--> statement-breakpoint
CREATE TYPE "receipt_status_enum" AS ENUM('required', 'pending', 'uploaded', 'verified', 'rejected', 'missing');
--> statement-breakpoint
CREATE TYPE "budget_period_enum" AS ENUM('monthly', 'quarterly', 'yearly', 'project_based', 'custom');
--> statement-breakpoint
CREATE TABLE "org"."expense_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"expense_id" uuid NOT NULL,
	"allocation_type" varchar(50) NOT NULL,
	"job_id" uuid,
	"bid_id" uuid,
	"department_id" integer,
	"percentage" numeric(5, 2) DEFAULT '100' NOT NULL,
	"allocated_amount" numeric(15, 2) NOT NULL,
	"cost_center" varchar(50),
	"account_code" varchar(50),
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."expense_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"expense_id" uuid,
	"report_id" uuid,
	"approval_level" integer NOT NULL,
	"status" "approval_status_enum" DEFAULT 'pending' NOT NULL,
	"approver_id" uuid NOT NULL,
	"approver_role" varchar(50),
	"requested_at" timestamp DEFAULT now(),
	"responded_at" timestamp,
	"due_date" timestamp,
	"comments" text,
	"rejection_reason" text,
	"escalated_from" uuid,
	"escalated_to" uuid,
	"escalated_at" timestamp,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."expense_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"budget_type" varchar(50) NOT NULL,
	"category_id" uuid,
	"department_id" integer,
	"employee_id" integer,
	"job_id" uuid,
	"budget_period" "budget_period_enum" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"budget_amount" numeric(15, 2) NOT NULL,
	"spent_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"committed_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"remaining_amount" numeric(15, 2) NOT NULL,
	"warning_threshold" numeric(5, 2) DEFAULT '80',
	"alert_threshold" numeric(5, 2) DEFAULT '90',
	"is_active" boolean DEFAULT true,
	"created_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"code" varchar(20) NOT NULL,
	"expense_type" "expense_type_enum" NOT NULL,
	"parent_category_id" uuid,
	"requires_receipt" boolean DEFAULT true,
	"requires_approval" boolean DEFAULT true,
	"is_reimbursable" boolean DEFAULT true,
	"is_tax_deductible" boolean DEFAULT true,
	"daily_limit" numeric(15, 2),
	"monthly_limit" numeric(15, 2),
	"yearly_limit" numeric(15, 2),
	"approval_threshold" numeric(15, 2),
	"requires_manager_approval" boolean DEFAULT true,
	"requires_finance_approval" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_expense_category_code_per_org" UNIQUE("organization_id","code"),
	CONSTRAINT "unique_expense_category_name_per_org" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "org"."expense_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"expense_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_value" text,
	"new_value" text,
	"description" text,
	"report_id" uuid,
	"performed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."expense_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"expense_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"mime_type" varchar(100),
	"receipt_date" date,
	"receipt_number" varchar(100),
	"receipt_total" numeric(15, 2),
	"vendor" varchar(255),
	"ocr_processed" boolean DEFAULT false,
	"ocr_data" jsonb,
	"ocr_confidence" numeric(5, 4),
	"uploaded_by" uuid NOT NULL,
	"description" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."expense_reimbursement_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reimbursement_id" uuid NOT NULL,
	"expense_id" uuid NOT NULL,
	"reimbursement_amount" numeric(15, 2) NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_expense_per_reimbursement" UNIQUE("reimbursement_id","expense_id")
);
--> statement-breakpoint
CREATE TABLE "org"."expense_reimbursements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reimbursement_number" varchar(100) NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" integer NOT NULL,
	"report_id" uuid,
	"status" "reimbursement_status_enum" DEFAULT 'pending' NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"payment_method" varchar(50),
	"payment_reference" varchar(100),
	"payment_date" date,
	"bank_account_id" uuid,
	"check_number" varchar(50),
	"requested_date" timestamp DEFAULT now(),
	"approved_date" timestamp,
	"processed_date" timestamp,
	"paid_date" timestamp,
	"approved_by" uuid,
	"processed_by" uuid,
	"notes" text,
	"internal_notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_reimbursement_number_per_org" UNIQUE("organization_id","reimbursement_number")
);
--> statement-breakpoint
CREATE TABLE "org"."expense_report_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"expense_id" uuid NOT NULL,
	"added_at" timestamp DEFAULT now(),
	"sort_order" integer DEFAULT 0,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_expense_per_report" UNIQUE("report_id","expense_id")
);
--> statement-breakpoint
CREATE TABLE "org"."expense_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_number" varchar(100) NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" integer NOT NULL,
	"status" "expense_report_status_enum" DEFAULT 'draft' NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"report_period_start" date NOT NULL,
	"report_period_end" date NOT NULL,
	"total_expenses" integer DEFAULT 0,
	"total_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_reimbursable" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_non_reimbursable" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_mileage" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_mileage_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"submitted_date" timestamp,
	"approved_date" timestamp,
	"paid_date" timestamp,
	"approved_by" uuid,
	"rejected_by" uuid,
	"rejection_reason" text,
	"notes" text,
	"internal_notes" text,
	"created_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_expense_report_number_per_org" UNIQUE("organization_id","report_number")
);
--> statement-breakpoint
CREATE TABLE "org"."expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_number" varchar(100) NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" integer NOT NULL,
	"category_id" uuid NOT NULL,
	"job_id" uuid,
	"bid_id" uuid,
	"status" "expense_status_enum" DEFAULT 'draft' NOT NULL,
	"expense_type" "expense_type_enum" NOT NULL,
	"payment_method" "expense_payment_method_enum" NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"vendor" varchar(255),
	"location" varchar(255),
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"exchange_rate" numeric(10, 6) DEFAULT '1' NOT NULL,
	"amount_in_base_currency" numeric(15, 2) NOT NULL,
	"tax_status" "tax_status_enum" DEFAULT 'deductible' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"expense_date" date NOT NULL,
	"submitted_date" timestamp,
	"approved_date" timestamp,
	"paid_date" timestamp,
	"receipt_status" "receipt_status_enum" DEFAULT 'required' NOT NULL,
	"receipt_number" varchar(100),
	"has_receipt" boolean DEFAULT false,
	"receipt_total" numeric(15, 2),
	"is_mileage_expense" boolean DEFAULT false,
	"mileage_type" "mileage_type_enum",
	"miles" numeric(10, 2),
	"mileage_rate" numeric(10, 4),
	"start_location" varchar(255),
	"end_location" varchar(255),
	"is_reimbursable" boolean DEFAULT true,
	"reimbursement_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"reimbursement_status" "reimbursement_status_enum" DEFAULT 'pending',
	"reimbursed_date" timestamp,
	"requires_approval" boolean DEFAULT true,
	"approved_by" uuid,
	"rejected_by" uuid,
	"rejection_reason" text,
	"business_purpose" text,
	"attendees" text,
	"notes" text,
	"internal_notes" text,
	"created_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_expense_number_per_org" UNIQUE("organization_id","expense_number")
);
--> statement-breakpoint
CREATE TABLE "org"."mileage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" integer NOT NULL,
	"expense_id" uuid,
	"date" date NOT NULL,
	"start_location" varchar(255) NOT NULL,
	"end_location" varchar(255) NOT NULL,
	"purpose" text NOT NULL,
	"mileage_type" "mileage_type_enum" NOT NULL,
	"miles" numeric(10, 2) NOT NULL,
	"rate" numeric(10, 4) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"vehicle_id" uuid,
	"vehicle_license" varchar(20),
	"odometer_start" integer,
	"odometer_end" integer,
	"job_id" uuid,
	"bid_id" uuid,
	"gps_start_coordinates" varchar(50),
	"gps_end_coordinates" varchar(50),
	"route_data" jsonb,
	"is_verified" boolean DEFAULT false,
	"verified_by" uuid,
	"verified_at" timestamp,
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "org"."expense_allocations" ADD CONSTRAINT "expense_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_allocations" ADD CONSTRAINT "expense_allocations_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "org"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_allocations" ADD CONSTRAINT "expense_allocations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_allocations" ADD CONSTRAINT "expense_allocations_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_approvals" ADD CONSTRAINT "expense_approvals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_approvals" ADD CONSTRAINT "expense_approvals_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "org"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_approvals" ADD CONSTRAINT "expense_approvals_report_id_expense_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "org"."expense_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_approvals" ADD CONSTRAINT "expense_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_approvals" ADD CONSTRAINT "expense_approvals_escalated_from_expense_approvals_id_fk" FOREIGN KEY ("escalated_from") REFERENCES "org"."expense_approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_approvals" ADD CONSTRAINT "expense_approvals_escalated_to_users_id_fk" FOREIGN KEY ("escalated_to") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" ADD CONSTRAINT "expense_budgets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" ADD CONSTRAINT "expense_budgets_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "org"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" ADD CONSTRAINT "expense_budgets_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" ADD CONSTRAINT "expense_budgets_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_budgets" ADD CONSTRAINT "expense_budgets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_categories" ADD CONSTRAINT "expense_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_categories" ADD CONSTRAINT "expense_categories_parent_category_id_expense_categories_id_fk" FOREIGN KEY ("parent_category_id") REFERENCES "org"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_history" ADD CONSTRAINT "expense_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_history" ADD CONSTRAINT "expense_history_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "org"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_history" ADD CONSTRAINT "expense_history_report_id_expense_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "org"."expense_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_history" ADD CONSTRAINT "expense_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_receipts" ADD CONSTRAINT "expense_receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_receipts" ADD CONSTRAINT "expense_receipts_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "org"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_receipts" ADD CONSTRAINT "expense_receipts_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursement_items" ADD CONSTRAINT "expense_reimbursement_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursement_items" ADD CONSTRAINT "expense_reimbursement_items_reimbursement_id_expense_reimbursements_id_fk" FOREIGN KEY ("reimbursement_id") REFERENCES "org"."expense_reimbursements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursement_items" ADD CONSTRAINT "expense_reimbursement_items_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "org"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" ADD CONSTRAINT "expense_reimbursements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" ADD CONSTRAINT "expense_reimbursements_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" ADD CONSTRAINT "expense_reimbursements_report_id_expense_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "org"."expense_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" ADD CONSTRAINT "expense_reimbursements_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reimbursements" ADD CONSTRAINT "expense_reimbursements_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_report_items" ADD CONSTRAINT "expense_report_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_report_items" ADD CONSTRAINT "expense_report_items_report_id_expense_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "org"."expense_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_report_items" ADD CONSTRAINT "expense_report_items_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "org"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reports" ADD CONSTRAINT "expense_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reports" ADD CONSTRAINT "expense_reports_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reports" ADD CONSTRAINT "expense_reports_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reports" ADD CONSTRAINT "expense_reports_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expense_reports" ADD CONSTRAINT "expense_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD CONSTRAINT "expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD CONSTRAINT "expenses_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "org"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD CONSTRAINT "expenses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD CONSTRAINT "expenses_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD CONSTRAINT "expenses_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD CONSTRAINT "expenses_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."mileage_logs" ADD CONSTRAINT "mileage_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."mileage_logs" ADD CONSTRAINT "mileage_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."mileage_logs" ADD CONSTRAINT "mileage_logs_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "org"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."mileage_logs" ADD CONSTRAINT "mileage_logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."mileage_logs" ADD CONSTRAINT "mileage_logs_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."mileage_logs" ADD CONSTRAINT "mileage_logs_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_expense_allocations_org" ON "org"."expense_allocations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_expense_allocations_expense" ON "org"."expense_allocations" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "idx_expense_allocations_job" ON "org"."expense_allocations" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_expense_allocations_bid" ON "org"."expense_allocations" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_expense_allocations_type" ON "org"."expense_allocations" USING btree ("allocation_type");--> statement-breakpoint
CREATE INDEX "idx_expense_approvals_org" ON "org"."expense_approvals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_expense_approvals_expense" ON "org"."expense_approvals" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "idx_expense_approvals_report" ON "org"."expense_approvals" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "idx_expense_approvals_approver" ON "org"."expense_approvals" USING btree ("approver_id");--> statement-breakpoint
CREATE INDEX "idx_expense_approvals_status" ON "org"."expense_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_expense_approvals_due_date" ON "org"."expense_approvals" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_expense_budgets_org" ON "org"."expense_budgets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_expense_budgets_type" ON "org"."expense_budgets" USING btree ("budget_type");--> statement-breakpoint
CREATE INDEX "idx_expense_budgets_category" ON "org"."expense_budgets" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_expense_budgets_employee" ON "org"."expense_budgets" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_expense_budgets_job" ON "org"."expense_budgets" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_expense_budgets_period" ON "org"."expense_budgets" USING btree ("budget_period");--> statement-breakpoint
CREATE INDEX "idx_expense_budgets_period_start" ON "org"."expense_budgets" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "idx_expense_budgets_period_end" ON "org"."expense_budgets" USING btree ("period_end");--> statement-breakpoint
CREATE INDEX "idx_expense_budgets_active" ON "org"."expense_budgets" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_expense_categories_org" ON "org"."expense_categories" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_expense_categories_type" ON "org"."expense_categories" USING btree ("expense_type");--> statement-breakpoint
CREATE INDEX "idx_expense_categories_parent" ON "org"."expense_categories" USING btree ("parent_category_id");--> statement-breakpoint
CREATE INDEX "idx_expense_categories_active" ON "org"."expense_categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_expense_history_org" ON "org"."expense_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_expense_history_expense" ON "org"."expense_history" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "idx_expense_history_performed_by" ON "org"."expense_history" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_expense_history_created_at" ON "org"."expense_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_expense_history_action" ON "org"."expense_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_expense_receipts_org" ON "org"."expense_receipts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_expense_receipts_expense" ON "org"."expense_receipts" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "idx_expense_receipts_uploaded_by" ON "org"."expense_receipts" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_expense_receipts_receipt_date" ON "org"."expense_receipts" USING btree ("receipt_date");--> statement-breakpoint
CREATE INDEX "idx_expense_reimbursement_items_org" ON "org"."expense_reimbursement_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_expense_reimbursement_items_reimbursement" ON "org"."expense_reimbursement_items" USING btree ("reimbursement_id");--> statement-breakpoint
CREATE INDEX "idx_expense_reimbursement_items_expense" ON "org"."expense_reimbursement_items" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "idx_expense_reimbursements_org" ON "org"."expense_reimbursements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_expense_reimbursements_employee" ON "org"."expense_reimbursements" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_expense_reimbursements_report" ON "org"."expense_reimbursements" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "idx_expense_reimbursements_status" ON "org"."expense_reimbursements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_expense_reimbursements_payment_date" ON "org"."expense_reimbursements" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_expense_reimbursements_approved_by" ON "org"."expense_reimbursements" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "idx_expense_report_items_org" ON "org"."expense_report_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_expense_report_items_report" ON "org"."expense_report_items" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "idx_expense_report_items_expense" ON "org"."expense_report_items" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "idx_expense_reports_org" ON "org"."expense_reports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_expense_reports_employee" ON "org"."expense_reports" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_expense_reports_status" ON "org"."expense_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_expense_reports_period_start" ON "org"."expense_reports" USING btree ("report_period_start");--> statement-breakpoint
CREATE INDEX "idx_expense_reports_period_end" ON "org"."expense_reports" USING btree ("report_period_end");--> statement-breakpoint
CREATE INDEX "idx_expense_reports_submitted_date" ON "org"."expense_reports" USING btree ("submitted_date");--> statement-breakpoint
CREATE INDEX "idx_expense_reports_approved_by" ON "org"."expense_reports" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "idx_expense_reports_is_deleted" ON "org"."expense_reports" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_expense_reports_created_at" ON "org"."expense_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_expenses_org" ON "org"."expenses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_expenses_employee" ON "org"."expenses" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_expenses_category" ON "org"."expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_expenses_job" ON "org"."expenses" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_expenses_bid" ON "org"."expenses" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_expenses_status" ON "org"."expenses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_expenses_type" ON "org"."expenses" USING btree ("expense_type");--> statement-breakpoint
CREATE INDEX "idx_expenses_expense_date" ON "org"."expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "idx_expenses_submitted_date" ON "org"."expenses" USING btree ("submitted_date");--> statement-breakpoint
CREATE INDEX "idx_expenses_approved_by" ON "org"."expenses" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "idx_expenses_reimbursement_status" ON "org"."expenses" USING btree ("reimbursement_status");--> statement-breakpoint
CREATE INDEX "idx_expenses_is_deleted" ON "org"."expenses" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_expenses_created_at" ON "org"."expenses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_mileage_logs_org" ON "org"."mileage_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_mileage_logs_employee" ON "org"."mileage_logs" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_mileage_logs_expense" ON "org"."mileage_logs" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "idx_mileage_logs_date" ON "org"."mileage_logs" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_mileage_logs_job" ON "org"."mileage_logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_mileage_logs_bid" ON "org"."mileage_logs" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_mileage_logs_type" ON "org"."mileage_logs" USING btree ("mileage_type");