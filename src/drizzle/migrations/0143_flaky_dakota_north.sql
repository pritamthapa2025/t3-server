CREATE TABLE "org"."timesheet_job_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"timesheet_id" integer NOT NULL,
	"job_id" uuid,
	"time_in" varchar(10),
	"time_out" varchar(10),
	"break_minutes" integer DEFAULT 0,
	"hours" numeric(5, 2) NOT NULL,
	"entry_type" varchar(20) DEFAULT 'manual',
	"notes" text,
	"ca_labor_violation" boolean DEFAULT false NOT NULL,
	"ca_violation_details" text,
	"break_taken" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "org"."timesheet_job_entries" ADD CONSTRAINT "timesheet_job_entries_timesheet_id_timesheets_id_fk" FOREIGN KEY ("timesheet_id") REFERENCES "org"."timesheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."timesheet_job_entries" ADD CONSTRAINT "timesheet_job_entries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."timesheet_job_entries" ADD CONSTRAINT "timesheet_job_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tsje_timesheet" ON "org"."timesheet_job_entries" USING btree ("timesheet_id");--> statement-breakpoint
CREATE INDEX "idx_tsje_job" ON "org"."timesheet_job_entries" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_tsje_entry_type" ON "org"."timesheet_job_entries" USING btree ("entry_type");--> statement-breakpoint
CREATE INDEX "idx_tsje_created_by" ON "org"."timesheet_job_entries" USING btree ("created_by");