-- Create compliance enums
DO $$ BEGIN
 CREATE TYPE "public"."compliance_case_type_enum" AS ENUM('safety', 'timesheet', 'conduct', 'training', 'certification', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "public"."compliance_severity_enum" AS ENUM('low', 'medium', 'high', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "public"."compliance_status_enum" AS ENUM('open', 'investigating', 'resolved', 'closed', 'escalated');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "public"."certification_status_enum" AS ENUM('active', 'expired', 'expiring_soon', 'suspended', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "public"."training_status_enum" AS ENUM('not_started', 'in_progress', 'completed', 'failed', 'overdue');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "public"."inspection_status_enum" AS ENUM('passed', 'failed', 'conditional_pass', 'scheduled', 'overdue');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Create compliance tables
CREATE TABLE IF NOT EXISTS "org"."employee_compliance_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" integer NOT NULL,
	"case_number" varchar(50) NOT NULL,
	"type" "compliance_case_type_enum" NOT NULL,
	"severity" "compliance_severity_enum" NOT NULL,
	"status" "compliance_status_enum" DEFAULT 'open' NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"notes" text,
	"opened_on" date NOT NULL,
	"due_date" date,
	"resolved_date" date,
	"reported_by" uuid,
	"assigned_to" uuid,
	"resolved_by" uuid,
	"impact_level" varchar(50),
	"corrective_action" text,
	"preventive_action" text,
	"attachments" jsonb,
	"evidence_photos" jsonb,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "employee_compliance_cases_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "org"."employee_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" integer NOT NULL,
	"certification_name" varchar(255) NOT NULL,
	"certification_code" varchar(100),
	"issuing_authority" varchar(255) NOT NULL,
	"issued_date" date NOT NULL,
	"expiration_date" date,
	"last_renewal_date" date,
	"next_renewal_date" date,
	"status" "certification_status_enum" DEFAULT 'active' NOT NULL,
	"verification_number" varchar(100),
	"is_required" boolean DEFAULT false,
	"certificate_file_path" varchar(500),
	"notes" text,
	"renewal_reminder_days" integer DEFAULT 30,
	"auto_renewal" boolean DEFAULT false,
	"renewal_cost" numeric(10, 2),
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "org"."employee_violation_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" integer NOT NULL,
	"compliance_case_id" uuid,
	"violation_type" "compliance_case_type_enum" NOT NULL,
	"violation_date" date NOT NULL,
	"description" text NOT NULL,
	"severity" "compliance_severity_enum" NOT NULL,
	"disciplinary_action" varchar(100),
	"action_date" date,
	"action_notes" text,
	"performance_impact" numeric(5, 2),
	"is_resolved" boolean DEFAULT false,
	"resolution_date" date,
	"resolution_notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "org"."vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vehicle_id" varchar(50) NOT NULL,
	"make" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"year" integer NOT NULL,
	"vin" varchar(17),
	"license_plate" varchar(20),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"assigned_to_employee_id" integer,
	"current_job_id" uuid,
	"type" varchar(50) NOT NULL,
	"color" varchar(50),
	"mileage" integer DEFAULT 0,
	"fuel_level" numeric(5, 2) DEFAULT '100',
	"last_service_date" date,
	"next_service_date" date,
	"next_service_mileage" integer,
	"next_inspection_date" date,
	"purchase_date" date,
	"purchase_cost" numeric(15, 2),
	"estimated_value" numeric(15, 2),
	"mileage_rate" numeric(10, 4) DEFAULT '0.67',
	"day_rate" numeric(10, 2) DEFAULT '95.00',
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "vehicles_vehicle_id_unique" UNIQUE("vehicle_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "org"."safety_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"inspection_number" varchar(50) NOT NULL,
	"inspection_date" date NOT NULL,
	"mileage" integer NOT NULL,
	"performed_by" uuid,
	"approved_by" uuid,
	"overall_status" "inspection_status_enum" NOT NULL,
	"total_items" integer NOT NULL,
	"passed_items" integer NOT NULL,
	"failed_items" integer NOT NULL,
	"inspection_notes" text,
	"before_photos" jsonb,
	"exterior_photos" jsonb,
	"interior_photos" jsonb,
	"next_inspection_due" date,
	"repairs_generated" boolean DEFAULT false,
	"generated_repair_ids" jsonb,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "safety_inspections_inspection_number_unique" UNIQUE("inspection_number")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "org"."safety_inspection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"item" varchar(255) NOT NULL,
	"status" varchar(20) NOT NULL,
	"notes" text,
	"photo" varchar(500),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "org"."training_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"program_name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"is_required" boolean DEFAULT false,
	"required_for_positions" jsonb,
	"required_for_departments" jsonb,
	"duration_hours" numeric(5, 2),
	"validity_period" integer,
	"materials" jsonb,
	"external_url" varchar(500),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "org"."employee_training_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" integer NOT NULL,
	"training_program_id" uuid NOT NULL,
	"status" "training_status_enum" DEFAULT 'not_started' NOT NULL,
	"started_date" date,
	"completed_date" date,
	"expiration_date" date,
	"score" numeric(5, 2),
	"passing_score" numeric(5, 2) DEFAULT '80',
	"attempts" integer DEFAULT 0,
	"certificate_file_path" varchar(500),
	"instructor_notes" text,
	"reminder_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_employee_training" UNIQUE("employee_id","training_program_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "org"."compliance_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference_type" varchar(50) NOT NULL,
	"reference_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"description" text,
	"performed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_certifications" ADD CONSTRAINT "employee_certifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_certifications" ADD CONSTRAINT "employee_certifications_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_compliance_case_id_employee_compliance_cases_id_fk" FOREIGN KEY ("compliance_case_id") REFERENCES "org"."employee_compliance_cases"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_assigned_to_employee_id_employees_id_fk" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_current_job_id_jobs_id_fk" FOREIGN KEY ("current_job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."safety_inspection_items" ADD CONSTRAINT "safety_inspection_items_inspection_id_safety_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "org"."safety_inspections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."training_programs" ADD CONSTRAINT "training_programs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_training_records" ADD CONSTRAINT "employee_training_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_training_records" ADD CONSTRAINT "employee_training_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_training_records" ADD CONSTRAINT "employee_training_records_training_program_id_training_programs_id_fk" FOREIGN KEY ("training_program_id") REFERENCES "org"."training_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."compliance_audit_log" ADD CONSTRAINT "compliance_audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."compliance_audit_log" ADD CONSTRAINT "compliance_audit_log_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS "idx_compliance_cases_employee" ON "org"."employee_compliance_cases" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_cases_org" ON "org"."employee_compliance_cases" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_cases_status" ON "org"."employee_compliance_cases" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_compliance_cases_type" ON "org"."employee_compliance_cases" USING btree ("type");
CREATE INDEX IF NOT EXISTS "idx_compliance_cases_assigned_to" ON "org"."employee_compliance_cases" USING btree ("assigned_to");
CREATE INDEX IF NOT EXISTS "idx_compliance_cases_due_date" ON "org"."employee_compliance_cases" USING btree ("due_date");

CREATE INDEX IF NOT EXISTS "idx_employee_certifications_employee" ON "org"."employee_certifications" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "idx_employee_certifications_org" ON "org"."employee_certifications" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_employee_certifications_status" ON "org"."employee_certifications" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_employee_certifications_expiration" ON "org"."employee_certifications" USING btree ("expiration_date");
CREATE INDEX IF NOT EXISTS "idx_employee_certifications_required" ON "org"."employee_certifications" USING btree ("is_required");

CREATE INDEX IF NOT EXISTS "idx_violation_history_employee" ON "org"."employee_violation_history" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "idx_violation_history_org" ON "org"."employee_violation_history" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_violation_history_type" ON "org"."employee_violation_history" USING btree ("violation_type");
CREATE INDEX IF NOT EXISTS "idx_violation_history_date" ON "org"."employee_violation_history" USING btree ("violation_date");
CREATE INDEX IF NOT EXISTS "idx_violation_history_resolved" ON "org"."employee_violation_history" USING btree ("is_resolved");

CREATE INDEX IF NOT EXISTS "idx_vehicles_org" ON "org"."vehicles" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_vehicles_status" ON "org"."vehicles" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_vehicles_assigned_to" ON "org"."vehicles" USING btree ("assigned_to_employee_id");
CREATE INDEX IF NOT EXISTS "idx_vehicles_next_inspection" ON "org"."vehicles" USING btree ("next_inspection_date");

CREATE INDEX IF NOT EXISTS "idx_safety_inspections_vehicle" ON "org"."safety_inspections" USING btree ("vehicle_id");
CREATE INDEX IF NOT EXISTS "idx_safety_inspections_org" ON "org"."safety_inspections" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_safety_inspections_status" ON "org"."safety_inspections" USING btree ("overall_status");
CREATE INDEX IF NOT EXISTS "idx_safety_inspections_date" ON "org"."safety_inspections" USING btree ("inspection_date");
CREATE INDEX IF NOT EXISTS "idx_safety_inspections_next_due" ON "org"."safety_inspections" USING btree ("next_inspection_due");

CREATE INDEX IF NOT EXISTS "idx_safety_inspection_items_inspection" ON "org"."safety_inspection_items" USING btree ("inspection_id");
CREATE INDEX IF NOT EXISTS "idx_safety_inspection_items_status" ON "org"."safety_inspection_items" USING btree ("status");

CREATE INDEX IF NOT EXISTS "idx_training_programs_org" ON "org"."training_programs" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_training_programs_required" ON "org"."training_programs" USING btree ("is_required");
CREATE INDEX IF NOT EXISTS "idx_training_programs_active" ON "org"."training_programs" USING btree ("is_active");

CREATE INDEX IF NOT EXISTS "idx_employee_training_employee" ON "org"."employee_training_records" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "idx_employee_training_org" ON "org"."employee_training_records" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_employee_training_status" ON "org"."employee_training_records" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_employee_training_expiration" ON "org"."employee_training_records" USING btree ("expiration_date");

CREATE INDEX IF NOT EXISTS "idx_compliance_audit_org" ON "org"."compliance_audit_log" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_audit_reference" ON "org"."compliance_audit_log" USING btree ("reference_type","reference_id");
CREATE INDEX IF NOT EXISTS "idx_compliance_audit_performed_by" ON "org"."compliance_audit_log" USING btree ("performed_by");
CREATE INDEX IF NOT EXISTS "idx_compliance_audit_created_at" ON "org"."compliance_audit_log" USING btree ("created_at");



