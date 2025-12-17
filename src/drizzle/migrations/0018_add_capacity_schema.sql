-- Create capacity & utilization enums
DO $$ BEGIN
 CREATE TYPE "public"."shift_type_enum" AS ENUM('regular', 'overtime', 'on_call', 'emergency');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "public"."availability_status_enum" AS ENUM('available', 'on_job', 'break', 'pto', 'sick', 'off_shift', 'suspended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "public"."resource_allocation_status_enum" AS ENUM('planned', 'assigned', 'in_progress', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "public"."capacity_period_type_enum" AS ENUM('daily', 'weekly', 'monthly', 'quarterly');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Create capacity & utilization tables
CREATE TABLE IF NOT EXISTS "org"."employee_shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"shift_date" date NOT NULL,
	"shift_start" time NOT NULL,
	"shift_end" time NOT NULL,
	"shift_type" "shift_type_enum" DEFAULT 'regular' NOT NULL,
	"planned_hours" numeric(5, 2) DEFAULT '8.00' NOT NULL,
	"available_hours" numeric(5, 2) DEFAULT '8.00' NOT NULL,
	"break_minutes" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_employee_shift_date" UNIQUE("employee_id","shift_date")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "org"."employee_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"current_status" "availability_status_enum" DEFAULT 'available' NOT NULL,
	"location" varchar(255),
	"status_start_time" timestamp DEFAULT now() NOT NULL,
	"expected_available_time" timestamp,
	"current_job_id" uuid,
	"current_task_description" text,
	"last_updated" timestamp DEFAULT now(),
	"updated_by" uuid,
	CONSTRAINT "unique_employee_availability" UNIQUE("employee_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "org"."resource_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" integer NOT NULL,
	"job_id" uuid,
	"task_id" uuid,
	"planned_start_time" timestamp NOT NULL,
	"planned_end_time" timestamp NOT NULL,
	"planned_hours" numeric(5, 2) NOT NULL,
	"actual_start_time" timestamp,
	"actual_end_time" timestamp,
	"actual_hours" numeric(5, 2),
	"status" "resource_allocation_status_enum" DEFAULT 'planned' NOT NULL,
	"priority" integer DEFAULT 3,
	"notes" text,
	"created_by" uuid,
	"assigned_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "org"."department_capacity_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"department_id" integer NOT NULL,
	"metric_date" date NOT NULL,
	"period_type" "capacity_period_type_enum" DEFAULT 'daily' NOT NULL,
	"total_employees" integer DEFAULT 0 NOT NULL,
	"available_employees" integer DEFAULT 0 NOT NULL,
	"total_planned_hours" numeric(8, 2) DEFAULT '0' NOT NULL,
	"total_scheduled_hours" numeric(8, 2) DEFAULT '0' NOT NULL,
	"total_actual_hours" numeric(8, 2) DEFAULT '0',
	"utilization_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"efficiency_percentage" numeric(5, 2) DEFAULT '0',
	"active_jobs_count" integer DEFAULT 0,
	"completed_jobs_count" integer DEFAULT 0,
	"coverage_areas" jsonb,
	"calculated_at" timestamp DEFAULT now(),
	"calculated_by" uuid,
	CONSTRAINT "unique_dept_capacity_metric" UNIQUE("department_id","metric_date","period_type")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "org"."team_utilization_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"department_id" integer,
	"employee_id" integer,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"period_type" "capacity_period_type_enum" NOT NULL,
	"planned_hours" numeric(8, 2) DEFAULT '0' NOT NULL,
	"scheduled_hours" numeric(8, 2) DEFAULT '0' NOT NULL,
	"actual_hours" numeric(8, 2) DEFAULT '0',
	"utilization_rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"on_time_completion_rate" numeric(5, 4) DEFAULT '0',
	"job_count" integer DEFAULT 0,
	"overtime_hours" numeric(8, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "org"."capacity_planning_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"department_id" integer,
	"day_of_week" integer,
	"shift_start" time NOT NULL,
	"shift_end" time NOT NULL,
	"planned_hours" numeric(5, 2) NOT NULL,
	"min_employees" integer DEFAULT 1,
	"max_employees" integer,
	"required_skills" jsonb,
	"is_active" boolean DEFAULT true,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "org"."employee_shifts" ADD CONSTRAINT "employee_shifts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_shifts" ADD CONSTRAINT "employee_shifts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_availability" ADD CONSTRAINT "employee_availability_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_availability" ADD CONSTRAINT "employee_availability_current_job_id_jobs_id_fk" FOREIGN KEY ("current_job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."employee_availability" ADD CONSTRAINT "employee_availability_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."resource_allocations" ADD CONSTRAINT "resource_allocations_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."resource_allocations" ADD CONSTRAINT "resource_allocations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."resource_allocations" ADD CONSTRAINT "resource_allocations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."resource_allocations" ADD CONSTRAINT "resource_allocations_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."department_capacity_metrics" ADD CONSTRAINT "department_capacity_metrics_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "org"."departments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."department_capacity_metrics" ADD CONSTRAINT "department_capacity_metrics_calculated_by_users_id_fk" FOREIGN KEY ("calculated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."team_utilization_history" ADD CONSTRAINT "team_utilization_history_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "org"."departments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."team_utilization_history" ADD CONSTRAINT "team_utilization_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."capacity_planning_templates" ADD CONSTRAINT "capacity_planning_templates_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "org"."departments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org"."capacity_planning_templates" ADD CONSTRAINT "capacity_planning_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS "idx_employee_shifts_employee" ON "org"."employee_shifts" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "idx_employee_shifts_date" ON "org"."employee_shifts" USING btree ("shift_date");
CREATE INDEX IF NOT EXISTS "idx_employee_shifts_active" ON "org"."employee_shifts" USING btree ("is_active","shift_date");

CREATE INDEX IF NOT EXISTS "idx_employee_availability_status" ON "org"."employee_availability" USING btree ("current_status");
CREATE INDEX IF NOT EXISTS "idx_employee_availability_job" ON "org"."employee_availability" USING btree ("current_job_id");
CREATE INDEX IF NOT EXISTS "idx_employee_availability_updated" ON "org"."employee_availability" USING btree ("last_updated");

CREATE INDEX IF NOT EXISTS "idx_resource_allocations_employee" ON "org"."resource_allocations" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "idx_resource_allocations_job" ON "org"."resource_allocations" USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "idx_resource_allocations_time" ON "org"."resource_allocations" USING btree ("planned_start_time","planned_end_time");
CREATE INDEX IF NOT EXISTS "idx_resource_allocations_status" ON "org"."resource_allocations" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_resource_allocations_priority" ON "org"."resource_allocations" USING btree ("priority","planned_start_time");

CREATE INDEX IF NOT EXISTS "idx_dept_capacity_metrics_dept" ON "org"."department_capacity_metrics" USING btree ("department_id");
CREATE INDEX IF NOT EXISTS "idx_dept_capacity_metrics_date" ON "org"."department_capacity_metrics" USING btree ("metric_date");
CREATE INDEX IF NOT EXISTS "idx_dept_capacity_metrics_period" ON "org"."department_capacity_metrics" USING btree ("department_id","period_type","metric_date");

CREATE INDEX IF NOT EXISTS "idx_team_utilization_dept" ON "org"."team_utilization_history" USING btree ("department_id");
CREATE INDEX IF NOT EXISTS "idx_team_utilization_employee" ON "org"."team_utilization_history" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "idx_team_utilization_period" ON "org"."team_utilization_history" USING btree ("period_start","period_end");
CREATE INDEX IF NOT EXISTS "idx_team_utilization_type" ON "org"."team_utilization_history" USING btree ("period_type","period_start");

CREATE INDEX IF NOT EXISTS "idx_capacity_templates_dept" ON "org"."capacity_planning_templates" USING btree ("department_id");
CREATE INDEX IF NOT EXISTS "idx_capacity_templates_active" ON "org"."capacity_planning_templates" USING btree ("is_active","effective_from","effective_to");
CREATE INDEX IF NOT EXISTS "idx_capacity_templates_day" ON "org"."capacity_planning_templates" USING btree ("day_of_week");


