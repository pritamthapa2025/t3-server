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
CREATE TABLE IF NOT EXISTS "org"."job_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"employee_id" integer NOT NULL,
	"role" varchar(100),
	"assigned_date" date DEFAULT now(),
	"removed_date" date,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_job_employee" UNIQUE("job_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."client_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"title" varchar(100),
	"email" varchar(150),
	"phone" varchar(20),
	"mobile_phone" varchar(20),
	"contact_type" "contact_type_enum" DEFAULT 'primary' NOT NULL,
	"is_primary" boolean DEFAULT false,
	"preferred_contact_method" varchar(50),
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."client_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"document_type" varchar(50),
	"description" text,
	"uploaded_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."client_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"note_type" varchar(50),
	"subject" varchar(255),
	"content" text NOT NULL,
	"created_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_name" varchar(255) NOT NULL,
	"property_code" varchar(50),
	"property_type" "property_type_enum" NOT NULL,
	"status" "property_status_enum" DEFAULT 'active' NOT NULL,
	"address_line1" varchar(255) NOT NULL,
	"address_line2" varchar(255),
	"city" varchar(100) NOT NULL,
	"state" varchar(50) NOT NULL,
	"zip_code" varchar(20) NOT NULL,
	"country" varchar(100) DEFAULT 'USA',
	"square_footage" numeric(10, 2),
	"number_of_floors" integer,
	"year_built" integer,
	"access_instructions" text,
	"gate_code" varchar(50),
	"parking_instructions" text,
	"operating_hours" jsonb,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"description" text,
	"notes" text,
	"tags" jsonb,
	"created_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_property_code_per_org" UNIQUE("organization_id","property_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."property_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"title" varchar(100),
	"email" varchar(150),
	"phone" varchar(20),
	"mobile_phone" varchar(20),
	"contact_type" varchar(50),
	"is_primary" boolean DEFAULT false,
	"available_hours" varchar(255),
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."property_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"document_type" varchar(50),
	"description" text,
	"uploaded_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."property_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"equipment_tag" varchar(100),
	"equipment_type" varchar(100) NOT NULL,
	"location" varchar(255),
	"make" varchar(100),
	"model" varchar(100),
	"serial_number" varchar(100),
	"install_date" date,
	"warranty_expiration" date,
	"capacity" varchar(100),
	"voltage_phase" varchar(50),
	"specifications" jsonb,
	"status" varchar(50) DEFAULT 'active',
	"condition" varchar(50),
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."property_service_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"job_id" uuid,
	"bid_id" uuid,
	"service_date" date NOT NULL,
	"service_type" varchar(100),
	"description" text,
	"performed_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."user_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_type" "user_organization_type_enum" DEFAULT 'client_user' NOT NULL,
	"title" varchar(100),
	"is_active" boolean DEFAULT true,
	"is_primary" boolean DEFAULT false,
	"joined_at" timestamp DEFAULT now(),
	"left_at" timestamp,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_org" UNIQUE("user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."employee_benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" integer NOT NULL,
	"organization_id" uuid NOT NULL,
	"benefit_type" "benefit_type_enum" NOT NULL,
	"plan_name" varchar(255),
	"description" text,
	"employee_contribution" numeric(15, 2) DEFAULT '0',
	"employer_contribution" numeric(15, 2) DEFAULT '0',
	"is_percentage" boolean DEFAULT false,
	"coverage_level" varchar(50),
	"effective_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."employee_compensation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" integer NOT NULL,
	"organization_id" uuid NOT NULL,
	"base_salary" numeric(15, 2),
	"hourly_rate" numeric(10, 2),
	"pay_type" "pay_type_enum" NOT NULL,
	"pay_frequency" "payroll_frequency_enum" NOT NULL,
	"overtime_multiplier" numeric(5, 2) DEFAULT '1.5',
	"double_overtime_multiplier" numeric(5, 2) DEFAULT '2.0',
	"overtime_threshold_daily" numeric(5, 2) DEFAULT '8.0',
	"overtime_threshold_weekly" numeric(5, 2) DEFAULT '40.0',
	"holiday_multiplier" numeric(5, 2) DEFAULT '1.5',
	"pto_accrual_rate" numeric(5, 4),
	"sick_accrual_rate" numeric(5, 4),
	"effective_date" date NOT NULL,
	"end_date" date,
	"created_by" uuid,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."employee_leave_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" integer NOT NULL,
	"organization_id" uuid NOT NULL,
	"leave_type" "leave_type_enum" NOT NULL,
	"current_balance" numeric(8, 2) DEFAULT '0',
	"accrual_rate" numeric(5, 4),
	"max_balance" numeric(8, 2),
	"ytd_accrued" numeric(8, 2) DEFAULT '0',
	"ytd_used" numeric(8, 2) DEFAULT '0',
	"balance_as_of_date" date NOT NULL,
	"last_accrual_date" date,
	"is_deleted" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_employee_leave_type" UNIQUE("employee_id","leave_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."pay_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period_number" integer NOT NULL,
	"frequency" "payroll_frequency_enum" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"pay_date" date NOT NULL,
	"status" "payroll_status_enum" DEFAULT 'draft' NOT NULL,
	"is_holiday_period" boolean DEFAULT false,
	"timesheet_cutoff_date" timestamp,
	"approval_deadline" timestamp,
	"approval_workflow" "approval_workflow_enum" DEFAULT 'auto_from_timesheet' NOT NULL,
	"lock_status" "lock_status_enum" DEFAULT 'unlocked' NOT NULL,
	"locked_at" timestamp,
	"locked_by" uuid,
	"timesheet_cutoff_enforced" boolean DEFAULT true,
	"auto_generate_from_timesheets" boolean DEFAULT true,
	"created_by" uuid,
	"approved_by" uuid,
	"processed_by" uuid,
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_pay_period" UNIQUE("organization_id","frequency","start_date","end_date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."payroll_approval_workflow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"payroll_entry_id" uuid,
	"workflow_type" "approval_workflow_enum" NOT NULL,
	"current_step" varchar(50) NOT NULL,
	"total_steps" integer NOT NULL,
	"approval_chain" jsonb,
	"current_approver" uuid,
	"auto_approval_triggered" boolean DEFAULT false,
	"auto_approval_reason" text,
	"auto_approval_timestamp" timestamp,
	"manual_override_allowed" boolean DEFAULT true,
	"overridden_by" uuid,
	"override_reason" text,
	"status" "payroll_status_enum" DEFAULT 'pending_approval' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."payroll_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference_type" varchar(50) NOT NULL,
	"reference_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"description" text,
	"is_automated_action" boolean DEFAULT false,
	"automation_source" varchar(50),
	"performed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."payroll_deductions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_entry_id" uuid NOT NULL,
	"deduction_type" "deduction_type_enum" NOT NULL,
	"description" varchar(255) NOT NULL,
	"is_percentage" boolean DEFAULT false,
	"rate" numeric(10, 6),
	"amount" numeric(15, 2) NOT NULL,
	"max_amount" numeric(15, 2),
	"year_to_date_amount" numeric(15, 2) DEFAULT '0',
	"employer_amount" numeric(15, 2) DEFAULT '0',
	"tax_bracket" varchar(50),
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."payroll_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"employee_id" integer NOT NULL,
	"entry_number" varchar(50) NOT NULL,
	"status" "payroll_status_enum" DEFAULT 'draft' NOT NULL,
	"source_type" varchar(50) DEFAULT 'manual' NOT NULL,
	"timesheet_integration_status" timesheet_integration_status_enum DEFAULT 'manual_override',
	"auto_approval_reason" text,
	"approval_workflow" "approval_workflow_enum" DEFAULT 'manual' NOT NULL,
	"auto_approved_at" timestamp,
	"requires_manager_approval" boolean DEFAULT false,
	"is_locked" boolean DEFAULT false,
	"locked_reason" varchar(100),
	"regular_hours" numeric(8, 2) DEFAULT '0',
	"overtime_hours" numeric(8, 2) DEFAULT '0',
	"double_overtime_hours" numeric(8, 2) DEFAULT '0',
	"pto_hours" numeric(8, 2) DEFAULT '0',
	"sick_hours" numeric(8, 2) DEFAULT '0',
	"holiday_hours" numeric(8, 2) DEFAULT '0',
	"total_hours" numeric(8, 2) DEFAULT '0',
	"hourly_rate" numeric(10, 2) NOT NULL,
	"overtime_multiplier" numeric(5, 2) DEFAULT '1.5',
	"double_overtime_multiplier" numeric(5, 2) DEFAULT '2.0',
	"holiday_multiplier" numeric(5, 2) DEFAULT '1.5',
	"regular_pay" numeric(15, 2) DEFAULT '0',
	"overtime_pay" numeric(15, 2) DEFAULT '0',
	"double_overtime_pay" numeric(15, 2) DEFAULT '0',
	"pto_pay" numeric(15, 2) DEFAULT '0',
	"sick_pay" numeric(15, 2) DEFAULT '0',
	"holiday_pay" numeric(15, 2) DEFAULT '0',
	"bonuses" numeric(15, 2) DEFAULT '0',
	"gross_pay" numeric(15, 2) NOT NULL,
	"total_deductions" numeric(15, 2) DEFAULT '0',
	"net_pay" numeric(15, 2) NOT NULL,
	"payment_method" "payment_method_enum" DEFAULT 'direct_deposit' NOT NULL,
	"bank_account_id" uuid,
	"check_number" varchar(50),
	"scheduled_date" date,
	"processed_date" date,
	"paid_date" date,
	"processed_by" uuid,
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_payroll_entry_number" UNIQUE("organization_id","entry_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."payroll_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lock_scope" varchar(50) NOT NULL,
	"reference_type" varchar(50) NOT NULL,
	"reference_id" uuid NOT NULL,
	"lock_status" "lock_status_enum" NOT NULL,
	"lock_reason" varchar(100) NOT NULL,
	"locked_at" timestamp NOT NULL,
	"locked_by" uuid,
	"can_unlock" boolean DEFAULT false,
	"unlock_requires_reason" boolean DEFAULT true,
	"unlocked_at" timestamp,
	"unlocked_by" uuid,
	"unlock_reason" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_active_lock" UNIQUE("reference_type","reference_id","is_active")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"pay_period_id" uuid NOT NULL,
	"run_number" varchar(50) NOT NULL,
	"run_type" varchar(20) DEFAULT 'regular',
	"status" "payroll_status_enum" DEFAULT 'draft' NOT NULL,
	"total_employees" integer DEFAULT 0,
	"total_gross_pay" numeric(15, 2) DEFAULT '0',
	"total_deductions" numeric(15, 2) DEFAULT '0',
	"total_net_pay" numeric(15, 2) DEFAULT '0',
	"total_employer_taxes" numeric(15, 2) DEFAULT '0',
	"total_regular_hours" numeric(10, 2) DEFAULT '0',
	"total_overtime_hours" numeric(10, 2) DEFAULT '0',
	"total_bonuses" numeric(15, 2) DEFAULT '0',
	"calculated_at" timestamp,
	"approved_at" timestamp,
	"processed_at" timestamp,
	"paid_at" timestamp,
	"created_by" uuid,
	"approved_by" uuid,
	"processed_by" uuid,
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_payroll_run_number" UNIQUE("organization_id","run_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."payroll_timesheet_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_entry_id" uuid NOT NULL,
	"timesheet_id" integer NOT NULL,
	"hours_included" numeric(8, 2) NOT NULL,
	"overtime_hours" numeric(8, 2) DEFAULT '0',
	"double_overtime_hours" numeric(8, 2) DEFAULT '0',
	"job_id" uuid,
	"job_hours" numeric(8, 2) DEFAULT '0',
	"included_in_payroll" boolean DEFAULT true,
	"exclusion_reason" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_payroll_timesheet" UNIQUE("payroll_entry_id","timesheet_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."tax_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tax_type" "tax_type_enum" NOT NULL,
	"jurisdiction" varchar(100) NOT NULL,
	"tax_year" integer NOT NULL,
	"brackets" jsonb NOT NULL,
	"standard_deduction" numeric(15, 2) DEFAULT '0',
	"personal_exemption" numeric(15, 2) DEFAULT '0',
	"effective_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_tax_table" UNIQUE("tax_type","jurisdiction","tax_year")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."timesheet_payroll_integration_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_entry_id" uuid NOT NULL,
	"timesheet_ids" jsonb NOT NULL,
	"total_timesheets_processed" integer NOT NULL,
	"integration_status" timesheet_integration_status_enum NOT NULL,
	"auto_generation_triggered" boolean DEFAULT false,
	"auto_approval_triggered" boolean DEFAULT false,
	"job_references" jsonb,
	"total_job_hours" numeric(8, 2),
	"generated_at" timestamp DEFAULT now(),
	"generated_by" varchar(50) DEFAULT 'system',
	"integration_errors" jsonb,
	"retry_count" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."departments" DROP CONSTRAINT IF EXISTS "unique_dept_per_org";
EXCEPTION
    WHEN undefined_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employees" DROP CONSTRAINT IF EXISTS "unique_employee_per_org";
EXCEPTION
    WHEN undefined_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."departments" DROP CONSTRAINT IF EXISTS "departments_organization_id_organizations_id_fk";
EXCEPTION
    WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employees" DROP CONSTRAINT IF EXISTS "employees_organization_id_organizations_id_fk";
EXCEPTION
    WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."timesheets" DROP CONSTRAINT IF EXISTS "timesheets_submitted_by_users_id_fk";
EXCEPTION
    WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "auth"."audit_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "auth"."audit_logs" ALTER COLUMN "event_type" SET NOT NULL;--> statement-breakpoint
-- First drop the default, change type, then set new default if needed
ALTER TABLE "auth"."permissions" ALTER COLUMN "module" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "auth"."permissions" ALTER COLUMN "module" SET DATA TYPE "public"."permission_module_enum" USING module::text::"public"."permission_module_enum";--> statement-breakpoint
ALTER TABLE "auth"."permissions" ALTER COLUMN "module" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."timesheets" ALTER COLUMN "clock_out" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."audit_logs" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "auth"."permissions" ADD COLUMN IF NOT EXISTS "action" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "address" text;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "city" varchar(100);--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "state" varchar(50);--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "zip_code" varchar(20);--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "emergency_contact_name" varchar(150);--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "emergency_contact_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN IF NOT EXISTS "password_changed_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."departments" ADD COLUMN IF NOT EXISTS "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."departments" ADD COLUMN IF NOT EXISTS "contact_email" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."departments" ADD COLUMN IF NOT EXISTS "primary_location" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."departments" ADD COLUMN IF NOT EXISTS "shift_coverage" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."departments" ADD COLUMN IF NOT EXISTS "utilization" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "org"."departments" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."departments" ADD COLUMN IF NOT EXISTS "sort_order" integer;--> statement-breakpoint
ALTER TABLE "org"."departments" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "hire_date" date;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "termination_date" date;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "hourly_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "salary" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "pay_type" varchar(20);--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "certifications" jsonb;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "skills" jsonb;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "licenses" jsonb;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN IF NOT EXISTS "employment_type" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "job_number" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "property_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "bid_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "status" "job_status_enum" DEFAULT 'planned' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "priority" "job_priority_enum" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "job_type" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "service_type" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "scheduled_start_date" date;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "scheduled_end_date" date;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "actual_start_date" date;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "actual_end_date" date;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "site_address" text;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "site_contact_name" varchar(150);--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "site_contact_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "access_instructions" text;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "contract_value" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "actual_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "project_manager" uuid;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "lead_technician" uuid;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "completion_notes" text;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "completion_percentage" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "created_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."jobs" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "legal_name" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "client_type" "client_type_enum" DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "status" "client_status_enum" DEFAULT 'prospect' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "industry_classification" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "tax_id" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "website" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "parent_organization_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "credit_limit" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "payment_terms" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "preferred_payment_method" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "billing_address_line1" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "billing_address_line2" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "billing_city" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "billing_state" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "billing_zip_code" varchar(20);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "billing_country" varchar(100) DEFAULT 'USA';--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "tags" jsonb;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "account_manager" uuid;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "created_by" uuid;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."positions" ADD COLUMN IF NOT EXISTS "pay_rate" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."positions" ADD COLUMN IF NOT EXISTS "pay_type" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."positions" ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."positions" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
ALTER TABLE "org"."positions" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."positions" ADD COLUMN IF NOT EXISTS "sort_order" integer;--> statement-breakpoint
ALTER TABLE "org"."positions" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."timesheets" ADD COLUMN IF NOT EXISTS "rejected_by" uuid;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."capacity_planning_templates" ADD CONSTRAINT "capacity_planning_templates_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "org"."departments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."capacity_planning_templates" ADD CONSTRAINT "capacity_planning_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."department_capacity_metrics" ADD CONSTRAINT "department_capacity_metrics_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "org"."departments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."department_capacity_metrics" ADD CONSTRAINT "department_capacity_metrics_calculated_by_users_id_fk" FOREIGN KEY ("calculated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_availability" ADD CONSTRAINT "employee_availability_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_availability" ADD CONSTRAINT "employee_availability_current_job_id_jobs_id_fk" FOREIGN KEY ("current_job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_availability" ADD CONSTRAINT "employee_availability_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_shifts" ADD CONSTRAINT "employee_shifts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_shifts" ADD CONSTRAINT "employee_shifts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."resource_allocations" ADD CONSTRAINT "resource_allocations_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."resource_allocations" ADD CONSTRAINT "resource_allocations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."resource_allocations" ADD CONSTRAINT "resource_allocations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."resource_allocations" ADD CONSTRAINT "resource_allocations_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."team_utilization_history" ADD CONSTRAINT "team_utilization_history_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "org"."departments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."team_utilization_history" ADD CONSTRAINT "team_utilization_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."compliance_audit_log" ADD CONSTRAINT "compliance_audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."compliance_audit_log" ADD CONSTRAINT "compliance_audit_log_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_certifications" ADD CONSTRAINT "employee_certifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_certifications" ADD CONSTRAINT "employee_certifications_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_compliance_cases" ADD CONSTRAINT "employee_compliance_cases_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_training_records" ADD CONSTRAINT "employee_training_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_training_records" ADD CONSTRAINT "employee_training_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_training_records" ADD CONSTRAINT "employee_training_records_training_program_id_training_programs_id_fk" FOREIGN KEY ("training_program_id") REFERENCES "org"."training_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_compliance_case_id_employee_compliance_cases_id_fk" FOREIGN KEY ("compliance_case_id") REFERENCES "org"."employee_compliance_cases"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_violation_history" ADD CONSTRAINT "employee_violation_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."safety_inspection_items" ADD CONSTRAINT "safety_inspection_items_inspection_id_safety_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "org"."safety_inspections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "org"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."safety_inspections" ADD CONSTRAINT "safety_inspections_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."training_programs" ADD CONSTRAINT "training_programs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_assigned_to_employee_id_employees_id_fk" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "org"."employees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."vehicles" ADD CONSTRAINT "vehicles_current_job_id_jobs_id_fk" FOREIGN KEY ("current_job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."job_team_members" ADD CONSTRAINT "job_team_members_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."job_team_members" ADD CONSTRAINT "job_team_members_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."client_contacts" ADD CONSTRAINT "client_contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."client_documents" ADD CONSTRAINT "client_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."client_documents" ADD CONSTRAINT "client_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."client_notes" ADD CONSTRAINT "client_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."client_notes" ADD CONSTRAINT "client_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."properties" ADD CONSTRAINT "properties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."properties" ADD CONSTRAINT "properties_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."property_contacts" ADD CONSTRAINT "property_contacts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "org"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."property_documents" ADD CONSTRAINT "property_documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "org"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."property_documents" ADD CONSTRAINT "property_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."property_equipment" ADD CONSTRAINT "property_equipment_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "org"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."property_service_history" ADD CONSTRAINT "property_service_history_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "org"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."property_service_history" ADD CONSTRAINT "property_service_history_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."property_service_history" ADD CONSTRAINT "property_service_history_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."property_service_history" ADD CONSTRAINT "property_service_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."user_organizations" ADD CONSTRAINT "user_organizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."user_organizations" ADD CONSTRAINT "user_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_benefits" ADD CONSTRAINT "employee_benefits_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_benefits" ADD CONSTRAINT "employee_benefits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_compensation" ADD CONSTRAINT "employee_compensation_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_compensation" ADD CONSTRAINT "employee_compensation_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_compensation" ADD CONSTRAINT "employee_compensation_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."pay_periods" ADD CONSTRAINT "pay_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."pay_periods" ADD CONSTRAINT "pay_periods_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."pay_periods" ADD CONSTRAINT "pay_periods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."pay_periods" ADD CONSTRAINT "pay_periods_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."pay_periods" ADD CONSTRAINT "pay_periods_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_approval_workflow" ADD CONSTRAINT "payroll_approval_workflow_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "org"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_approval_workflow" ADD CONSTRAINT "payroll_approval_workflow_payroll_entry_id_payroll_entries_id_fk" FOREIGN KEY ("payroll_entry_id") REFERENCES "org"."payroll_entries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_approval_workflow" ADD CONSTRAINT "payroll_approval_workflow_current_approver_users_id_fk" FOREIGN KEY ("current_approver") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_approval_workflow" ADD CONSTRAINT "payroll_approval_workflow_overridden_by_users_id_fk" FOREIGN KEY ("overridden_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_audit_log" ADD CONSTRAINT "payroll_audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_audit_log" ADD CONSTRAINT "payroll_audit_log_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_deductions" ADD CONSTRAINT "payroll_deductions_payroll_entry_id_payroll_entries_id_fk" FOREIGN KEY ("payroll_entry_id") REFERENCES "org"."payroll_entries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_entries" ADD CONSTRAINT "payroll_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_entries" ADD CONSTRAINT "payroll_entries_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "org"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_entries" ADD CONSTRAINT "payroll_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_entries" ADD CONSTRAINT "payroll_entries_bank_account_id_user_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "org"."user_bank_accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_entries" ADD CONSTRAINT "payroll_entries_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_locks" ADD CONSTRAINT "payroll_locks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_locks" ADD CONSTRAINT "payroll_locks_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_locks" ADD CONSTRAINT "payroll_locks_unlocked_by_users_id_fk" FOREIGN KEY ("unlocked_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_runs" ADD CONSTRAINT "payroll_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_runs" ADD CONSTRAINT "payroll_runs_pay_period_id_pay_periods_id_fk" FOREIGN KEY ("pay_period_id") REFERENCES "org"."pay_periods"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_runs" ADD CONSTRAINT "payroll_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_runs" ADD CONSTRAINT "payroll_runs_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_timesheet_entries" ADD CONSTRAINT "payroll_timesheet_entries_payroll_entry_id_payroll_entries_id_fk" FOREIGN KEY ("payroll_entry_id") REFERENCES "org"."payroll_entries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_timesheet_entries" ADD CONSTRAINT "payroll_timesheet_entries_timesheet_id_timesheets_id_fk" FOREIGN KEY ("timesheet_id") REFERENCES "org"."timesheets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."payroll_timesheet_entries" ADD CONSTRAINT "payroll_timesheet_entries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."timesheet_payroll_integration_log" ADD CONSTRAINT "timesheet_payroll_integration_log_payroll_entry_id_payroll_entries_id_fk" FOREIGN KEY ("payroll_entry_id") REFERENCES "org"."payroll_entries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_capacity_templates_dept" ON "org"."capacity_planning_templates" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_capacity_templates_active" ON "org"."capacity_planning_templates" USING btree ("is_active","effective_from","effective_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_capacity_templates_day" ON "org"."capacity_planning_templates" USING btree ("day_of_week");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dept_capacity_metrics_dept" ON "org"."department_capacity_metrics" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dept_capacity_metrics_date" ON "org"."department_capacity_metrics" USING btree ("metric_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dept_capacity_metrics_period" ON "org"."department_capacity_metrics" USING btree ("department_id","period_type","metric_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_availability_status" ON "org"."employee_availability" USING btree ("current_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_availability_job" ON "org"."employee_availability" USING btree ("current_job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_availability_updated" ON "org"."employee_availability" USING btree ("last_updated");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_shifts_employee" ON "org"."employee_shifts" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_shifts_date" ON "org"."employee_shifts" USING btree ("shift_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_shifts_active" ON "org"."employee_shifts" USING btree ("is_active","shift_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resource_allocations_employee" ON "org"."resource_allocations" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resource_allocations_job" ON "org"."resource_allocations" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resource_allocations_time" ON "org"."resource_allocations" USING btree ("planned_start_time","planned_end_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resource_allocations_status" ON "org"."resource_allocations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resource_allocations_priority" ON "org"."resource_allocations" USING btree ("priority","planned_start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_team_utilization_dept" ON "org"."team_utilization_history" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_team_utilization_employee" ON "org"."team_utilization_history" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_team_utilization_period" ON "org"."team_utilization_history" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_team_utilization_type" ON "org"."team_utilization_history" USING btree ("period_type","period_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_compliance_audit_org" ON "org"."compliance_audit_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_compliance_audit_reference" ON "org"."compliance_audit_log" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_compliance_audit_performed_by" ON "org"."compliance_audit_log" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_compliance_audit_created_at" ON "org"."compliance_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_certifications_employee" ON "org"."employee_certifications" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_certifications_org" ON "org"."employee_certifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_certifications_status" ON "org"."employee_certifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_certifications_expiration" ON "org"."employee_certifications" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_certifications_required" ON "org"."employee_certifications" USING btree ("is_required");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_compliance_cases_employee" ON "org"."employee_compliance_cases" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_compliance_cases_org" ON "org"."employee_compliance_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_compliance_cases_status" ON "org"."employee_compliance_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_compliance_cases_type" ON "org"."employee_compliance_cases" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_compliance_cases_assigned_to" ON "org"."employee_compliance_cases" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_compliance_cases_due_date" ON "org"."employee_compliance_cases" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_training_employee" ON "org"."employee_training_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_training_org" ON "org"."employee_training_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_training_status" ON "org"."employee_training_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_training_expiration" ON "org"."employee_training_records" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_violation_history_employee" ON "org"."employee_violation_history" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_violation_history_org" ON "org"."employee_violation_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_violation_history_type" ON "org"."employee_violation_history" USING btree ("violation_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_violation_history_date" ON "org"."employee_violation_history" USING btree ("violation_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_violation_history_resolved" ON "org"."employee_violation_history" USING btree ("is_resolved");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_safety_inspection_items_inspection" ON "org"."safety_inspection_items" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_safety_inspection_items_status" ON "org"."safety_inspection_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_safety_inspections_vehicle" ON "org"."safety_inspections" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_safety_inspections_org" ON "org"."safety_inspections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_safety_inspections_status" ON "org"."safety_inspections" USING btree ("overall_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_safety_inspections_date" ON "org"."safety_inspections" USING btree ("inspection_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_safety_inspections_next_due" ON "org"."safety_inspections" USING btree ("next_inspection_due");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_training_programs_org" ON "org"."training_programs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_training_programs_required" ON "org"."training_programs" USING btree ("is_required");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_training_programs_active" ON "org"."training_programs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vehicles_org" ON "org"."vehicles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vehicles_status" ON "org"."vehicles" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vehicles_assigned_to" ON "org"."vehicles" USING btree ("assigned_to_employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vehicles_next_inspection" ON "org"."vehicles" USING btree ("next_inspection_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_team_job" ON "org"."job_team_members" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_team_employee" ON "org"."job_team_members" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_team_active" ON "org"."job_team_members" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_team_role" ON "org"."job_team_members" USING btree ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_contacts_org" ON "org"."client_contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_contacts_type" ON "org"."client_contacts" USING btree ("contact_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_contacts_is_primary" ON "org"."client_contacts" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_docs_org" ON "org"."client_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_docs_type" ON "org"."client_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_notes_org" ON "org"."client_notes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_notes_created_by" ON "org"."client_notes" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_notes_created_at" ON "org"."client_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_properties_org" ON "org"."properties" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_properties_type" ON "org"."properties" USING btree ("property_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_properties_status" ON "org"."properties" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_properties_city_state" ON "org"."properties" USING btree ("city","state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_properties_is_deleted" ON "org"."properties" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_property_contacts_property" ON "org"."property_contacts" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_property_contacts_is_primary" ON "org"."property_contacts" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_property_docs_property" ON "org"."property_documents" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_property_docs_type" ON "org"."property_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_property_equipment_property" ON "org"."property_equipment" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_property_equipment_type" ON "org"."property_equipment" USING btree ("equipment_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_property_equipment_status" ON "org"."property_equipment" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_property_service_property" ON "org"."property_service_history" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_property_service_date" ON "org"."property_service_history" USING btree ("service_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_property_service_job" ON "org"."property_service_history" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_orgs_user" ON "org"."user_organizations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_orgs_org" ON "org"."user_organizations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_orgs_type" ON "org"."user_organizations" USING btree ("user_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_orgs_is_active" ON "org"."user_organizations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_benefits_employee" ON "org"."employee_benefits" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_benefits_org" ON "org"."employee_benefits" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_benefits_type" ON "org"."employee_benefits" USING btree ("benefit_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_benefits_active" ON "org"."employee_benefits" USING btree ("is_active","effective_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_compensation_employee" ON "org"."employee_compensation" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_compensation_org" ON "org"."employee_compensation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_compensation_active" ON "org"."employee_compensation" USING btree ("is_active","effective_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_compensation_dates" ON "org"."employee_compensation" USING btree ("effective_date","end_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_leave_balances_employee" ON "org"."employee_leave_balances" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employee_leave_balances_org" ON "org"."employee_leave_balances" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pay_periods_org_status" ON "org"."pay_periods" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pay_periods_pay_date" ON "org"."pay_periods" USING btree ("pay_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pay_periods_lock_status" ON "org"."pay_periods" USING btree ("lock_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pay_periods_workflow" ON "org"."pay_periods" USING btree ("approval_workflow");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_approval_workflow_run" ON "org"."payroll_approval_workflow" USING btree ("payroll_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_approval_workflow_entry" ON "org"."payroll_approval_workflow" USING btree ("payroll_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_approval_workflow_status" ON "org"."payroll_approval_workflow" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_approval_workflow_approver" ON "org"."payroll_approval_workflow" USING btree ("current_approver");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_audit_org" ON "org"."payroll_audit_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_audit_reference" ON "org"."payroll_audit_log" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_audit_performed_by" ON "org"."payroll_audit_log" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_audit_created_at" ON "org"."payroll_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_audit_automated" ON "org"."payroll_audit_log" USING btree ("is_automated_action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_deductions_entry" ON "org"."payroll_deductions" USING btree ("payroll_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_deductions_type" ON "org"."payroll_deductions" USING btree ("deduction_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_entries_run" ON "org"."payroll_entries" USING btree ("payroll_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_entries_employee" ON "org"."payroll_entries" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_entries_status" ON "org"."payroll_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_entries_scheduled_date" ON "org"."payroll_entries" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_entries_source_type" ON "org"."payroll_entries" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_entries_integration_status" ON "org"."payroll_entries" USING btree ("timesheet_integration_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_entries_locked" ON "org"."payroll_entries" USING btree ("is_locked");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_locks_org" ON "org"."payroll_locks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_locks_reference" ON "org"."payroll_locks" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_locks_status" ON "org"."payroll_locks" USING btree ("lock_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_runs_org_status" ON "org"."payroll_runs" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_runs_pay_period" ON "org"."payroll_runs" USING btree ("pay_period_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_runs_processed_at" ON "org"."payroll_runs" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_timesheet_entries_payroll" ON "org"."payroll_timesheet_entries" USING btree ("payroll_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_timesheet_entries_timesheet" ON "org"."payroll_timesheet_entries" USING btree ("timesheet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payroll_timesheet_entries_job" ON "org"."payroll_timesheet_entries" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tax_tables_type_jurisdiction" ON "org"."tax_tables" USING btree ("tax_type","jurisdiction");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tax_tables_year" ON "org"."tax_tables" USING btree ("tax_year");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tax_tables_active" ON "org"."tax_tables" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_timesheet_payroll_integration_entry" ON "org"."timesheet_payroll_integration_log" USING btree ("payroll_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_timesheet_payroll_integration_status" ON "org"."timesheet_payroll_integration_log" USING btree ("integration_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_timesheet_payroll_integration_generated_at" ON "org"."timesheet_payroll_integration_log" USING btree ("generated_at");--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."departments" ADD CONSTRAINT "departments_lead_id_users_id_fk" FOREIGN KEY ("lead_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_project_manager_users_id_fk" FOREIGN KEY ("project_manager") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_lead_technician_users_id_fk" FOREIGN KEY ("lead_technician") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."organizations" ADD CONSTRAINT "organizations_parent_organization_id_organizations_id_fk" FOREIGN KEY ("parent_organization_id") REFERENCES "org"."organizations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."organizations" ADD CONSTRAINT "organizations_account_manager_users_id_fk" FOREIGN KEY ("account_manager") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."organizations" ADD CONSTRAINT "organizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."timesheets" ADD CONSTRAINT "timesheets_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_id" ON "auth"."audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_event_type" ON "auth"."audit_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "auth"."audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_permissions_module" ON "auth"."permissions" USING btree ("module");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_permissions_action" ON "auth"."permissions" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_city_state" ON "auth"."users" USING btree ("city","state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bid_documents_uploaded_by" ON "org"."bid_documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bid_history_action" ON "org"."bid_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bid_notes_internal" ON "org"."bid_notes" USING btree ("is_internal");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bid_survey_technician" ON "org"."bid_survey_data" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bid_timeline_event_date" ON "org"."bid_timeline" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_departments_active" ON "org"."departments" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_departments_lead" ON "org"."departments" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_departments_deleted" ON "org"."departments" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employees_department" ON "org"."employees" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employees_position" ON "org"."employees" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employees_status" ON "org"."employees" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employees_reports_to" ON "org"."employees" USING btree ("reports_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employees_pay_type" ON "org"."employees" USING btree ("pay_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employees_employment_type" ON "org"."employees" USING btree ("employment_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employees_deleted_status" ON "org"."employees" USING btree ("is_deleted","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employees_deleted" ON "org"."employees" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_financial_org" ON "org"."job_financial_summary" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_financial_updated" ON "org"."job_financial_summary" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_org" ON "org"."jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_property" ON "org"."jobs" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_bid" ON "org"."jobs" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_status" ON "org"."jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_priority" ON "org"."jobs" USING btree ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_scheduled_start" ON "org"."jobs" USING btree ("scheduled_start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_project_manager" ON "org"."jobs" USING btree ("project_manager");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_lead_technician" ON "org"."jobs" USING btree ("lead_technician");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_is_deleted" ON "org"."jobs" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orgs_status" ON "org"."organizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orgs_client_type" ON "org"."organizations" USING btree ("client_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orgs_parent" ON "org"."organizations" USING btree ("parent_organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orgs_is_deleted" ON "org"."organizations" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orgs_account_manager" ON "org"."organizations" USING btree ("account_manager");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_positions_department" ON "org"."positions" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_positions_active" ON "org"."positions" USING btree ("is_active","department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_positions_deleted" ON "org"."positions" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_timesheet_approvals_timesheet" ON "org"."timesheet_approvals" USING btree ("timesheet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_timesheet_approvals_performed_by" ON "org"."timesheet_approvals" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_timesheet_approvals_created_at" ON "org"."timesheet_approvals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_timesheets_employee" ON "org"."timesheets" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_timesheets_date" ON "org"."timesheets" USING btree ("sheet_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_timesheets_status" ON "org"."timesheets" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_timesheets_approved_by" ON "org"."timesheets" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_timesheets_rejected_by" ON "org"."timesheets" USING btree ("rejected_by");--> statement-breakpoint
ALTER TABLE "org"."departments" DROP COLUMN IF EXISTS "organization_id";--> statement-breakpoint
ALTER TABLE "org"."employees" DROP COLUMN IF EXISTS "organization_id";--> statement-breakpoint
ALTER TABLE "org"."timesheets" DROP COLUMN IF EXISTS "submitted_by";--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."departments" ADD CONSTRAINT "unique_dept_name" UNIQUE("name");
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employees" ADD CONSTRAINT "employees_employee_id_unique" UNIQUE("employee_id");
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."employees" ADD CONSTRAINT "unique_employee_id" UNIQUE("employee_id");
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "org"."jobs" ADD CONSTRAINT "unique_job_number_per_org" UNIQUE("organization_id","job_number");
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN SQLSTATE '42P07' THEN null; -- relation already exists
END $$;--> statement-breakpoint
DO $$ BEGIN
    DROP TYPE IF EXISTS "public"."account_type_enum";
EXCEPTION
    WHEN dependent_objects_still_exist THEN null; -- Other objects depend on this type
    WHEN undefined_object THEN null; -- Type doesn't exist
END $$;--> statement-breakpoint
DO $$ BEGIN
    DROP TYPE IF EXISTS "public"."bid_job_type_enum";
EXCEPTION
    WHEN dependent_objects_still_exist THEN null; -- Other objects depend on this type
    WHEN undefined_object THEN null; -- Type doesn't exist
END $$;--> statement-breakpoint
DO $$ BEGIN
    DROP TYPE IF EXISTS "public"."bid_priority_enum";
EXCEPTION
    WHEN dependent_objects_still_exist THEN null; -- Other objects depend on this type
    WHEN undefined_object THEN null; -- Type doesn't exist
END $$;--> statement-breakpoint
DO $$ BEGIN
    DROP TYPE IF EXISTS "public"."bid_status_enum";
EXCEPTION
    WHEN dependent_objects_still_exist THEN null; -- Other objects depend on this type
    WHEN undefined_object THEN null; -- Type doesn't exist
END $$;--> statement-breakpoint
DO $$ BEGIN
    DROP TYPE IF EXISTS "public"."employee_status_enum";
EXCEPTION
    WHEN dependent_objects_still_exist THEN null; -- Other objects depend on this type
    WHEN undefined_object THEN null; -- Type doesn't exist
END $$;--> statement-breakpoint
DO $$ BEGIN
    DROP TYPE IF EXISTS "public"."timeline_status_enum";
EXCEPTION
    WHEN dependent_objects_still_exist THEN null; -- Other objects depend on this type
    WHEN undefined_object THEN null; -- Type doesn't exist
END $$;--> statement-breakpoint
DO $$ BEGIN
    DROP TYPE IF EXISTS "public"."timesheet_status_enum";
EXCEPTION
    WHEN dependent_objects_still_exist THEN null; -- Other objects depend on this type
    WHEN undefined_object THEN null; -- Type doesn't exist
END $$;