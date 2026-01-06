CREATE TABLE "org"."job_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"document_type" varchar(50),
	"uploaded_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."job_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"expense_type" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"expense_date" date NOT NULL,
	"vendor_name" varchar(255),
	"invoice_number" varchar(100),
	"receipt_path" varchar(500),
	"approved_by" uuid,
	"approved_at" timestamp,
	"created_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."job_financial_breakdown" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"materials_equipment" numeric(15, 2) DEFAULT '0' NOT NULL,
	"labor" numeric(15, 2) DEFAULT '0' NOT NULL,
	"travel" numeric(15, 2) DEFAULT '0' NOT NULL,
	"operating_expenses" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_financial_breakdown_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "org"."job_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_value" text,
	"new_value" text,
	"description" text,
	"performed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."job_labor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"employee_id" integer,
	"role" varchar(100) NOT NULL,
	"quantity" integer NOT NULL,
	"days" integer NOT NULL,
	"hours_per_day" numeric(5, 2) NOT NULL,
	"total_hours" numeric(8, 2) NOT NULL,
	"cost_rate" numeric(10, 2) NOT NULL,
	"billable_rate" numeric(10, 2) NOT NULL,
	"total_cost" numeric(15, 2) NOT NULL,
	"total_price" numeric(15, 2) NOT NULL,
	"is_actual" boolean DEFAULT false,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."job_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_cost" numeric(15, 2) NOT NULL,
	"markup" numeric(5, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(15, 2) NOT NULL,
	"is_actual" boolean DEFAULT false,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."job_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_by" uuid NOT NULL,
	"is_internal" boolean DEFAULT true,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."job_operating_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false,
	"gross_revenue_previous_year" numeric(15, 2) DEFAULT '0',
	"current_job_amount" numeric(15, 2) DEFAULT '0',
	"operating_cost_previous_year" numeric(15, 2) DEFAULT '0',
	"inflation_adjusted_operating_cost" numeric(15, 2) DEFAULT '0',
	"inflation_rate" numeric(5, 2) DEFAULT '0',
	"utilization_percentage" numeric(5, 2) DEFAULT '0',
	"calculated_operating_cost" numeric(15, 2) DEFAULT '0',
	"apply_markup" boolean DEFAULT false,
	"markup_percentage" numeric(5, 2) DEFAULT '0',
	"operating_price" numeric(15, 2) DEFAULT '0',
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_operating_expenses_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "org"."job_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"task_name" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"priority" varchar(50) DEFAULT 'medium',
	"assigned_to" uuid,
	"due_date" date,
	"completed_date" date,
	"estimated_hours" numeric(8, 2),
	"actual_hours" numeric(8, 2),
	"sort_order" integer DEFAULT 0,
	"created_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."job_timeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"event" varchar(255) NOT NULL,
	"event_date" timestamp NOT NULL,
	"status" timeline_status_enum DEFAULT 'pending' NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0,
	"created_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."job_travel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"employee_id" integer,
	"employee_name" varchar(255),
	"vehicle_id" uuid,
	"vehicle_name" varchar(255),
	"round_trip_miles" numeric(10, 2) NOT NULL,
	"mileage_rate" numeric(10, 2) NOT NULL,
	"vehicle_day_rate" numeric(10, 2) NOT NULL,
	"days" integer NOT NULL,
	"mileage_cost" numeric(15, 2) NOT NULL,
	"vehicle_cost" numeric(15, 2) NOT NULL,
	"markup" numeric(5, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(15, 2) NOT NULL,
	"total_price" numeric(15, 2) NOT NULL,
	"is_actual" boolean DEFAULT false,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "org"."job_financial_summary" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."job_financial_summary" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "org"."job_documents" ADD CONSTRAINT "job_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_documents" ADD CONSTRAINT "job_documents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_documents" ADD CONSTRAINT "job_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_expenses" ADD CONSTRAINT "job_expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_expenses" ADD CONSTRAINT "job_expenses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_expenses" ADD CONSTRAINT "job_expenses_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_expenses" ADD CONSTRAINT "job_expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_financial_breakdown" ADD CONSTRAINT "job_financial_breakdown_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_financial_breakdown" ADD CONSTRAINT "job_financial_breakdown_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_history" ADD CONSTRAINT "job_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_history" ADD CONSTRAINT "job_history_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_history" ADD CONSTRAINT "job_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_labor" ADD CONSTRAINT "job_labor_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_labor" ADD CONSTRAINT "job_labor_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_labor" ADD CONSTRAINT "job_labor_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_materials" ADD CONSTRAINT "job_materials_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_materials" ADD CONSTRAINT "job_materials_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_notes" ADD CONSTRAINT "job_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_notes" ADD CONSTRAINT "job_notes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_notes" ADD CONSTRAINT "job_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_operating_expenses" ADD CONSTRAINT "job_operating_expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_operating_expenses" ADD CONSTRAINT "job_operating_expenses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_tasks" ADD CONSTRAINT "job_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_tasks" ADD CONSTRAINT "job_tasks_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_tasks" ADD CONSTRAINT "job_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_tasks" ADD CONSTRAINT "job_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_timeline" ADD CONSTRAINT "job_timeline_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_timeline" ADD CONSTRAINT "job_timeline_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_timeline" ADD CONSTRAINT "job_timeline_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_travel" ADD CONSTRAINT "job_travel_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_travel" ADD CONSTRAINT "job_travel_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_travel" ADD CONSTRAINT "job_travel_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_job_documents_org" ON "org"."job_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_job_documents_job_id" ON "org"."job_documents" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_documents_type" ON "org"."job_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_job_documents_uploaded_by" ON "org"."job_documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_job_expenses_org" ON "org"."job_expenses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_job_expenses_job_id" ON "org"."job_expenses" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_expenses_type" ON "org"."job_expenses" USING btree ("expense_type");--> statement-breakpoint
CREATE INDEX "idx_job_expenses_date" ON "org"."job_expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "idx_job_expenses_approved_by" ON "org"."job_expenses" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "idx_job_financial_breakdown_org" ON "org"."job_financial_breakdown" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_job_financial_breakdown_job_id" ON "org"."job_financial_breakdown" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_history_org" ON "org"."job_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_job_history_job_id" ON "org"."job_history" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_history_performed_by" ON "org"."job_history" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_job_history_created_at" ON "org"."job_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_job_history_action" ON "org"."job_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_job_labor_org" ON "org"."job_labor" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_job_labor_job_id" ON "org"."job_labor" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_labor_employee" ON "org"."job_labor" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_job_labor_is_actual" ON "org"."job_labor" USING btree ("is_actual");--> statement-breakpoint
CREATE INDEX "idx_job_materials_org" ON "org"."job_materials" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_job_materials_job_id" ON "org"."job_materials" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_materials_is_actual" ON "org"."job_materials" USING btree ("is_actual");--> statement-breakpoint
CREATE INDEX "idx_job_notes_org" ON "org"."job_notes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_job_notes_job_id" ON "org"."job_notes" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_notes_created_by" ON "org"."job_notes" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_job_notes_internal" ON "org"."job_notes" USING btree ("is_internal");--> statement-breakpoint
CREATE INDEX "idx_job_operating_org" ON "org"."job_operating_expenses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_job_operating_job_id" ON "org"."job_operating_expenses" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_tasks_org" ON "org"."job_tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_job_tasks_job_id" ON "org"."job_tasks" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_tasks_status" ON "org"."job_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_job_tasks_assigned_to" ON "org"."job_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_job_tasks_due_date" ON "org"."job_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_job_timeline_org" ON "org"."job_timeline" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_job_timeline_job_id" ON "org"."job_timeline" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_timeline_status" ON "org"."job_timeline" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_job_timeline_event_date" ON "org"."job_timeline" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "idx_job_travel_org" ON "org"."job_travel" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_job_travel_job_id" ON "org"."job_travel" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_travel_employee" ON "org"."job_travel" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_job_travel_is_actual" ON "org"."job_travel" USING btree ("is_actual");--> statement-breakpoint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'jobs_bid_id_bids_id_fk'
    ) THEN
        ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;