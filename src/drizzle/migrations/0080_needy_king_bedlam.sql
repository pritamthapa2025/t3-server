CREATE TABLE "org"."job_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"building_number" varchar(100),
	"unit_tag_label" varchar(100),
	"unit_location" varchar(255),
	"technician_id" integer,
	"make" varchar(255),
	"model_number" varchar(255),
	"serial_number" varchar(255),
	"system_type" varchar(100),
	"power_status" varchar(100),
	"voltage_phase" varchar(100),
	"overall_unit_condition" varchar(100),
	"physical_condition_notes" text,
	"corrosion_or_rust" boolean DEFAULT false,
	"debris_or_blockage" boolean DEFAULT false,
	"refrigerant_line_condition" varchar(255),
	"electrical_components_condition" varchar(255),
	"ducting_condition" varchar(255),
	"condensate_line_condition" varchar(100),
	"cabinet_integrity" varchar(255),
	"filter_present" boolean DEFAULT false,
	"filter_size" varchar(100),
	"filter_condition" varchar(100),
	"blower_motor_status" varchar(255),
	"blower_motor_condition" varchar(255),
	"airflow_output" varchar(100),
	"belt_condition" varchar(255),
	"temperature_split_supply_f" numeric(8, 2),
	"temperature_split_return_f" numeric(8, 2),
	"cooling_coil_condition" varchar(255),
	"compressor_status" varchar(255),
	"refrigerant_line_temperature_f" numeric(8, 2),
	"cooling_functionality" varchar(100),
	"heating_functionality" varchar(100),
	"gas_valve_condition" varchar(255),
	"heating_coil_condition" varchar(255),
	"photos_media" jsonb,
	"pros" text,
	"cons" text,
	"status" varchar(50) DEFAULT 'draft',
	"created_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_task_id" uuid NOT NULL,
	"comment" text NOT NULL,
	"created_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "org"."job_surveys" ADD CONSTRAINT "job_surveys_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_surveys" ADD CONSTRAINT "job_surveys_technician_id_employees_id_fk" FOREIGN KEY ("technician_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_surveys" ADD CONSTRAINT "job_surveys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."task_comments" ADD CONSTRAINT "task_comments_job_task_id_job_tasks_id_fk" FOREIGN KEY ("job_task_id") REFERENCES "org"."job_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."task_comments" ADD CONSTRAINT "task_comments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_job_surveys_job_id" ON "org"."job_surveys" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_surveys_technician" ON "org"."job_surveys" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "idx_job_surveys_status" ON "org"."job_surveys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_job_surveys_is_deleted" ON "org"."job_surveys" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_task_comments_job_task_id" ON "org"."task_comments" USING btree ("job_task_id");--> statement-breakpoint
CREATE INDEX "idx_task_comments_created_by" ON "org"."task_comments" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_task_comments_is_deleted" ON "org"."task_comments" USING btree ("is_deleted");