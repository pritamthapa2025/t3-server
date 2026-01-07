-- Create enum types for dispatch and fleet modules
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_assignment_status_enum') THEN
        CREATE TYPE "dispatch_assignment_status_enum" AS ENUM('pending', 'started', 'completed');
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_task_type_enum') THEN
        CREATE TYPE "dispatch_task_type_enum" AS ENUM('service', 'pm', 'install', 'emergency', 'survey');
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_task_priority_enum') THEN
        CREATE TYPE "dispatch_task_priority_enum" AS ENUM('low', 'medium', 'high', 'emergency');
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_task_status_enum') THEN
        CREATE TYPE "dispatch_task_status_enum" AS ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'technician_status_enum') THEN
        CREATE TYPE "technician_status_enum" AS ENUM('available', 'on_job', 'off_shift', 'break', 'pto');
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'check_in_out_type_enum') THEN
        CREATE TYPE "check_in_out_type_enum" AS ENUM('check_in', 'check_out');
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fuel_type_enum') THEN
        CREATE TYPE "fuel_type_enum" AS ENUM('gasoline', 'diesel', 'electric');
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'maintenance_status_enum') THEN
        CREATE TYPE "maintenance_status_enum" AS ENUM('completed', 'in_progress', 'scheduled', 'overdue', 'cancelled', 'pending_approval', 'approved', 'rejected');
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority_enum') THEN
        CREATE TYPE "priority_enum" AS ENUM('low', 'medium', 'high', 'critical');
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'repair_status_enum') THEN
        CREATE TYPE "repair_status_enum" AS ENUM('completed', 'in_progress', 'scheduled', 'overdue', 'cancelled', 'pending_approval', 'approved', 'rejected');
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inspection_item_status_enum') THEN
        CREATE TYPE "public"."inspection_item_status_enum" AS ENUM('passed', 'failed');
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inspection_status_enum') THEN
        CREATE TYPE "public"."inspection_status_enum" AS ENUM('passed', 'failed', 'conditional_pass', 'scheduled', 'overdue');
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_status_enum') THEN
        CREATE TYPE "public"."vehicle_status_enum" AS ENUM('active', 'in_maintenance', 'out_of_service');
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_type_enum') THEN
        CREATE TYPE "public"."vehicle_type_enum" AS ENUM('truck', 'van', 'car', 'specialized');
    END IF;
END $$;
--> statement-breakpoint
CREATE TABLE "org"."dispatch_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"technician_id" integer NOT NULL,
	"status" "dispatch_assignment_status_enum" DEFAULT 'pending' NOT NULL,
	"clock_in" timestamp,
	"clock_out" timestamp,
	"actual_duration" integer,
	"role" varchar(50),
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."dispatch_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"task_type" "dispatch_task_type_enum" NOT NULL,
	"priority" "dispatch_task_priority_enum" DEFAULT 'medium' NOT NULL,
	"status" "dispatch_task_status_enum" DEFAULT 'pending' NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"estimated_duration" integer,
	"linked_job_task_ids" jsonb,
	"notes" text,
	"attachments" jsonb,
	"assigned_vehicle_id" uuid,
	"created_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."technician_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"status" "technician_status_enum" DEFAULT 'available' NOT NULL,
	"shift_start" time,
	"shift_end" time,
	"hours_scheduled" numeric(5, 2) DEFAULT '0',
	"role" varchar(50),
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."assignment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"driver" varchar(255) NOT NULL,
	"driver_avatar" varchar(500),
	"driver_id" integer,
	"start_date" date NOT NULL,
	"end_date" date,
	"mileage_driven" numeric(10, 2) DEFAULT '0',
	"job_id" uuid,
	"job_type" varchar(100),
	"job_location" varchar(255),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."check_in_out_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"type" "check_in_out_type_enum" NOT NULL,
	"date" date NOT NULL,
	"time" varchar(20),
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"driver" varchar(255) NOT NULL,
	"driver_id" integer,
	"driver_avatar" varchar(500),
	"odometer" numeric(10, 2) NOT NULL,
	"fuel_level" numeric(5, 2) NOT NULL,
	"job_id" uuid,
	"job_location" varchar(255),
	"dispatch_task_id" uuid,
	"notes" text,
	"created_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."fuel_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"date" date NOT NULL,
	"odometer" numeric(10, 2) NOT NULL,
	"gallons" numeric(10, 3) NOT NULL,
	"cost_per_gallon" numeric(10, 4) NOT NULL,
	"total_cost" numeric(15, 2) NOT NULL,
	"location" varchar(255),
	"fuel_type" "fuel_type_enum" NOT NULL,
	"employee_id" integer,
	"employee_name" varchar(255),
	"notes" text,
	"created_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."maintenance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"status" "maintenance_status_enum" DEFAULT 'scheduled' NOT NULL,
	"priority" "priority_enum" DEFAULT 'low',
	"cost" numeric(15, 2) DEFAULT '0' NOT NULL,
	"date" date NOT NULL,
	"mileage" varchar(50),
	"scheduled_date" date,
	"estimated_duration" varchar(50),
	"vendor" varchar(255),
	"performed_by" varchar(255),
	"assigned_to" varchar(255),
	"assigned_to_employee_id" integer,
	"needs_approval" boolean DEFAULT false,
	"approved_by" uuid,
	"approved_date" timestamp,
	"approval_comments" text,
	"rejected_by" uuid,
	"rejected_date" timestamp,
	"rejection_reason" text,
	"note" text,
	"created_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."repair_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"status" "repair_status_enum" DEFAULT 'scheduled' NOT NULL,
	"priority" "priority_enum" DEFAULT 'medium' NOT NULL,
	"cost" numeric(15, 2) DEFAULT '0' NOT NULL,
	"date" date NOT NULL,
	"mileage" varchar(50),
	"scheduled_date" date,
	"completed_date" date,
	"estimated_duration" varchar(50),
	"reported_by" varchar(255) NOT NULL,
	"vendor" varchar(255),
	"performed_by" varchar(255),
	"assigned_to" varchar(255),
	"assigned_to_employee_id" integer,
	"linked_maintenance_id" uuid,
	"linked_inspection_id" uuid,
	"needs_approval" boolean DEFAULT false,
	"approved_by" uuid,
	"approved_date" timestamp,
	"approval_comments" text,
	"rejected_by" uuid,
	"rejected_date" timestamp,
	"rejection_reason" text,
	"notes" text,
	"created_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."vehicle_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"document_type" varchar(50),
	"description" text,
	"expiration_date" date,
	"uploaded_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."vehicle_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"field_changed" varchar(100),
	"old_value" text,
	"new_value" text,
	"description" text,
	"performed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."vehicle_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(100),
	"size" numeric(10, 2),
	"url" varchar(500),
	"thumbnail_url" varchar(500),
	"tags" jsonb,
	"uploaded_by" uuid NOT NULL,
	"uploaded_date" date DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."vehicle_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"utilization_rate" numeric(5, 2) DEFAULT '0',
	"cost_per_mile" numeric(10, 4) DEFAULT '0',
	"average_mpg" numeric(5, 2) DEFAULT '0',
	"maintenance_adherence" numeric(5, 2) DEFAULT '0',
	"monthly_operating_cost" numeric(15, 2) DEFAULT '0',
	"total_miles_driven" numeric(10, 2) DEFAULT '0',
	"total_fuel_cost" numeric(15, 2) DEFAULT '0',
	"total_maintenance_cost" numeric(15, 2) DEFAULT '0',
	"period_start" date,
	"period_end" date,
	"is_deleted" boolean DEFAULT false,
	"calculated_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "vehicle_metrics_vehicle_id_unique" UNIQUE("vehicle_id")
);
--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" RENAME COLUMN "inspection_date" TO "date";--> statement-breakpoint
ALTER TABLE "org"."vehicles" RENAME COLUMN "last_service_date" TO "last_service";--> statement-breakpoint
ALTER TABLE "org"."vehicles" RENAME COLUMN "next_service_date" TO "next_service";--> statement-breakpoint
ALTER TABLE "org"."vehicles" RENAME COLUMN "next_inspection_date" TO "next_inspection_due";--> statement-breakpoint
ALTER TABLE "org"."vehicles" RENAME COLUMN "day_rate" TO "vehicle_day_rate";--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP CONSTRAINT "safety_inspections_inspection_number_unique";--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP CONSTRAINT "safety_inspections_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP CONSTRAINT "safety_inspections_performed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP CONSTRAINT "safety_inspections_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."vehicles" DROP CONSTRAINT "vehicles_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_safety_inspection_items_inspection";--> statement-breakpoint
DROP INDEX "org"."idx_safety_inspection_items_status";--> statement-breakpoint
DROP INDEX "org"."idx_safety_inspections_vehicle";--> statement-breakpoint
DROP INDEX "org"."idx_safety_inspections_org";--> statement-breakpoint
DROP INDEX "org"."idx_safety_inspections_status";--> statement-breakpoint
DROP INDEX "org"."idx_safety_inspections_date";--> statement-breakpoint
DROP INDEX "org"."idx_safety_inspections_next_due";--> statement-breakpoint
DROP INDEX "org"."idx_vehicles_org";--> statement-breakpoint
DROP INDEX "org"."idx_vehicles_assigned_to";--> statement-breakpoint
DROP INDEX "org"."idx_vehicles_next_inspection";--> statement-breakpoint
ALTER TABLE "org"."safety_inspection_items" ALTER COLUMN "status" SET DATA TYPE "public"."inspection_item_status_enum" USING status::text::"public"."inspection_item_status_enum";--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ALTER COLUMN "mileage" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ALTER COLUMN "mileage" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ALTER COLUMN "performed_by" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ALTER COLUMN "performed_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ALTER COLUMN "vin" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "org"."vehicles" ALTER COLUMN "license_plate" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ALTER COLUMN "status" SET DATA TYPE "public"."vehicle_status_enum" USING status::text::"public"."vehicle_status_enum";--> statement-breakpoint
ALTER TABLE "org"."vehicles" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "org"."vehicles" ALTER COLUMN "type" SET DATA TYPE "public"."vehicle_type_enum" USING type::text::"public"."vehicle_type_enum";--> statement-breakpoint
ALTER TABLE "org"."vehicles" ALTER COLUMN "mileage" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."vehicles" ALTER COLUMN "mileage" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "org"."vehicles" ALTER COLUMN "mileage" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ALTER COLUMN "fuel_level" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "current_dispatch_task_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "next_service_due" date;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "next_service_days" integer;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "next_inspection_days" integer;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "dealer" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "monthly_payment" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "loan_balance" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "insurance_provider" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "insurance_policy_number" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "insurance_coverage" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "insurance_expiration" date;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "insurance_annual_premium" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "registration_state" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "registration_number" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "registration_expiration" date;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "mpg" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "miles_last_12_months" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "service_history_cost_last_12_months" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "delivery_completed" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "current_location_lat" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "current_location_lng" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "current_location_address" text;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "current_location_last_updated" timestamp;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "image" varchar(500);--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_task_id_dispatch_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "org"."dispatch_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_technician_id_employees_id_fk" FOREIGN KEY ("technician_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."dispatch_tasks" ADD CONSTRAINT "dispatch_tasks_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."dispatch_tasks" ADD CONSTRAINT "dispatch_tasks_assigned_vehicle_id_vehicles_id_fk" FOREIGN KEY ("assigned_vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."dispatch_tasks" ADD CONSTRAINT "dispatch_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."technician_availability" ADD CONSTRAINT "technician_availability_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."assignment_history" ADD CONSTRAINT "assignment_history_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."assignment_history" ADD CONSTRAINT "assignment_history_driver_id_employees_id_fk" FOREIGN KEY ("driver_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."assignment_history" ADD CONSTRAINT "assignment_history_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" ADD CONSTRAINT "check_in_out_records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" ADD CONSTRAINT "check_in_out_records_driver_id_employees_id_fk" FOREIGN KEY ("driver_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" ADD CONSTRAINT "check_in_out_records_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."check_in_out_records" ADD CONSTRAINT "check_in_out_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."fuel_records" ADD CONSTRAINT "fuel_records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."fuel_records" ADD CONSTRAINT "fuel_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."fuel_records" ADD CONSTRAINT "fuel_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."maintenance_records" ADD CONSTRAINT "maintenance_records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."maintenance_records" ADD CONSTRAINT "maintenance_records_assigned_to_employee_id_employees_id_fk" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."maintenance_records" ADD CONSTRAINT "maintenance_records_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."maintenance_records" ADD CONSTRAINT "maintenance_records_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."maintenance_records" ADD CONSTRAINT "maintenance_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."repair_records" ADD CONSTRAINT "repair_records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."repair_records" ADD CONSTRAINT "repair_records_assigned_to_employee_id_employees_id_fk" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."repair_records" ADD CONSTRAINT "repair_records_linked_maintenance_id_maintenance_records_id_fk" FOREIGN KEY ("linked_maintenance_id") REFERENCES "org"."maintenance_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."repair_records" ADD CONSTRAINT "repair_records_linked_inspection_id_safety_inspections_id_fk" FOREIGN KEY ("linked_inspection_id") REFERENCES "org"."safety_inspections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."repair_records" ADD CONSTRAINT "repair_records_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."repair_records" ADD CONSTRAINT "repair_records_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."repair_records" ADD CONSTRAINT "repair_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicle_documents" ADD CONSTRAINT "vehicle_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicle_history" ADD CONSTRAINT "vehicle_history_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicle_history" ADD CONSTRAINT "vehicle_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicle_media" ADD CONSTRAINT "vehicle_media_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicle_media" ADD CONSTRAINT "vehicle_media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicle_metrics" ADD CONSTRAINT "vehicle_metrics_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_dispatch_assignments_task" ON "org"."dispatch_assignments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_dispatch_assignments_technician" ON "org"."dispatch_assignments" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "idx_dispatch_assignments_status" ON "org"."dispatch_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_dispatch_assignments_clock_in" ON "org"."dispatch_assignments" USING btree ("clock_in");--> statement-breakpoint
CREATE INDEX "idx_dispatch_assignments_is_deleted" ON "org"."dispatch_assignments" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_dispatch_assignments_tech_task" ON "org"."dispatch_assignments" USING btree ("technician_id","task_id");--> statement-breakpoint
CREATE INDEX "idx_dispatch_tasks_job" ON "org"."dispatch_tasks" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_dispatch_tasks_status" ON "org"."dispatch_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_dispatch_tasks_type" ON "org"."dispatch_tasks" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX "idx_dispatch_tasks_priority" ON "org"."dispatch_tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_dispatch_tasks_start_time" ON "org"."dispatch_tasks" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "idx_dispatch_tasks_end_time" ON "org"."dispatch_tasks" USING btree ("end_time");--> statement-breakpoint
CREATE INDEX "idx_dispatch_tasks_vehicle" ON "org"."dispatch_tasks" USING btree ("assigned_vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_dispatch_tasks_is_deleted" ON "org"."dispatch_tasks" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_dispatch_tasks_date_range" ON "org"."dispatch_tasks" USING btree ("start_time","end_time");--> statement-breakpoint
CREATE INDEX "idx_technician_availability_employee" ON "org"."technician_availability" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_technician_availability_date" ON "org"."technician_availability" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_technician_availability_status" ON "org"."technician_availability" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_technician_availability_is_deleted" ON "org"."technician_availability" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_technician_availability_employee_date" ON "org"."technician_availability" USING btree ("employee_id","date");--> statement-breakpoint
CREATE INDEX "idx_assignment_history_vehicle" ON "org"."assignment_history" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_assignment_history_driver" ON "org"."assignment_history" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "idx_assignment_history_status" ON "org"."assignment_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_assignment_history_start_date" ON "org"."assignment_history" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_assignment_history_job" ON "org"."assignment_history" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_assignment_history_is_deleted" ON "org"."assignment_history" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_assignment_history_active" ON "org"."assignment_history" USING btree ("vehicle_id","status");--> statement-breakpoint
CREATE INDEX "idx_check_in_out_vehicle" ON "org"."check_in_out_records" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_check_in_out_type" ON "org"."check_in_out_records" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_check_in_out_date" ON "org"."check_in_out_records" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_check_in_out_timestamp" ON "org"."check_in_out_records" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_check_in_out_driver" ON "org"."check_in_out_records" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "idx_check_in_out_job" ON "org"."check_in_out_records" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_check_in_out_is_deleted" ON "org"."check_in_out_records" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_check_in_out_vehicle_date" ON "org"."check_in_out_records" USING btree ("vehicle_id","date");--> statement-breakpoint
CREATE INDEX "idx_fuel_vehicle" ON "org"."fuel_records" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_fuel_date" ON "org"."fuel_records" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_fuel_employee" ON "org"."fuel_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_fuel_type" ON "org"."fuel_records" USING btree ("fuel_type");--> statement-breakpoint
CREATE INDEX "idx_fuel_is_deleted" ON "org"."fuel_records" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_fuel_vehicle_date" ON "org"."fuel_records" USING btree ("vehicle_id","date");--> statement-breakpoint
CREATE INDEX "idx_maintenance_vehicle" ON "org"."maintenance_records" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_maintenance_status" ON "org"."maintenance_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_maintenance_priority" ON "org"."maintenance_records" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_maintenance_date" ON "org"."maintenance_records" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_maintenance_scheduled_date" ON "org"."maintenance_records" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "idx_maintenance_needs_approval" ON "org"."maintenance_records" USING btree ("needs_approval");--> statement-breakpoint
CREATE INDEX "idx_maintenance_assigned_employee" ON "org"."maintenance_records" USING btree ("assigned_to_employee_id");--> statement-breakpoint
CREATE INDEX "idx_maintenance_is_deleted" ON "org"."maintenance_records" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_maintenance_overdue" ON "org"."maintenance_records" USING btree ("status","scheduled_date");--> statement-breakpoint
CREATE INDEX "idx_repair_vehicle" ON "org"."repair_records" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_repair_status" ON "org"."repair_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_repair_priority" ON "org"."repair_records" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_repair_date" ON "org"."repair_records" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_repair_scheduled_date" ON "org"."repair_records" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "idx_repair_needs_approval" ON "org"."repair_records" USING btree ("needs_approval");--> statement-breakpoint
CREATE INDEX "idx_repair_reported_by" ON "org"."repair_records" USING btree ("reported_by");--> statement-breakpoint
CREATE INDEX "idx_repair_assigned_employee" ON "org"."repair_records" USING btree ("assigned_to_employee_id");--> statement-breakpoint
CREATE INDEX "idx_repair_linked_maintenance" ON "org"."repair_records" USING btree ("linked_maintenance_id");--> statement-breakpoint
CREATE INDEX "idx_repair_linked_inspection" ON "org"."repair_records" USING btree ("linked_inspection_id");--> statement-breakpoint
CREATE INDEX "idx_repair_is_deleted" ON "org"."repair_records" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_repair_critical" ON "org"."repair_records" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "idx_vehicle_documents_vehicle" ON "org"."vehicle_documents" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_vehicle_documents_type" ON "org"."vehicle_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_vehicle_documents_expiration" ON "org"."vehicle_documents" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX "idx_vehicle_documents_uploaded_by" ON "org"."vehicle_documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_vehicle_documents_is_deleted" ON "org"."vehicle_documents" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_vehicle_history_vehicle" ON "org"."vehicle_history" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_vehicle_history_action" ON "org"."vehicle_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_vehicle_history_performed_by" ON "org"."vehicle_history" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_vehicle_history_created_at" ON "org"."vehicle_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_vehicle_history_vehicle_date" ON "org"."vehicle_history" USING btree ("vehicle_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_vehicle_media_vehicle" ON "org"."vehicle_media" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_vehicle_media_type" ON "org"."vehicle_media" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_vehicle_media_uploaded_by" ON "org"."vehicle_media" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_vehicle_media_is_deleted" ON "org"."vehicle_media" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_vehicle_metrics_vehicle" ON "org"."vehicle_metrics" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_vehicle_metrics_period" ON "org"."vehicle_metrics" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_vehicle_metrics_is_deleted" ON "org"."vehicle_metrics" USING btree ("is_deleted");--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inspection_items_inspection" ON "org"."safety_inspection_items" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX "idx_inspection_items_category" ON "org"."safety_inspection_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_inspection_items_status" ON "org"."safety_inspection_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_inspection_items_is_deleted" ON "org"."safety_inspection_items" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_inspections_vehicle" ON "org"."safety_inspections" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "idx_inspections_date" ON "org"."safety_inspections" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_inspections_status" ON "org"."safety_inspections" USING btree ("overall_status");--> statement-breakpoint
CREATE INDEX "idx_inspections_performed_by" ON "org"."safety_inspections" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_inspections_is_deleted" ON "org"."safety_inspections" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_inspections_vehicle_date" ON "org"."safety_inspections" USING btree ("vehicle_id","date");--> statement-breakpoint
CREATE INDEX "idx_vehicles_type" ON "org"."vehicles" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_vehicles_assigned_employee" ON "org"."vehicles" USING btree ("assigned_to_employee_id");--> statement-breakpoint
CREATE INDEX "idx_vehicles_current_job" ON "org"."vehicles" USING btree ("current_job_id");--> statement-breakpoint
CREATE INDEX "idx_vehicles_license_plate" ON "org"."vehicles" USING btree ("license_plate");--> statement-breakpoint
CREATE INDEX "idx_vehicles_vin" ON "org"."vehicles" USING btree ("vin");--> statement-breakpoint
CREATE INDEX "idx_vehicles_next_service" ON "org"."vehicles" USING btree ("next_service_due");--> statement-breakpoint
CREATE INDEX "idx_vehicles_is_deleted" ON "org"."vehicles" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_vehicles_active" ON "org"."vehicles" USING btree ("status","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_vehicles_next_inspection" ON "org"."vehicles" USING btree ("next_inspection_due");--> statement-breakpoint
ALTER TABLE "org"."safety_inspection_items" DROP COLUMN "photo";--> statement-breakpoint
ALTER TABLE "org"."safety_inspection_items" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP COLUMN "inspection_number";--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP COLUMN "approved_by";--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP COLUMN "total_items";--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP COLUMN "passed_items";--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP COLUMN "failed_items";--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP COLUMN "next_inspection_due";--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP COLUMN "repairs_generated";--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP COLUMN "generated_repair_ids";--> statement-breakpoint
ALTER TABLE "org"."vehicles" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "org"."vehicles" DROP COLUMN "next_service_mileage";