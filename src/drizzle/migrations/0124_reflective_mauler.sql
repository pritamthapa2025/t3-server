CREATE TABLE "org"."job_log_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_log_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"file_url" varchar(500) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_name" varchar(255),
	"file_type" varchar(50),
	"caption" varchar(255),
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."job_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"summary" text NOT NULL,
	"hours_worked" numeric(5, 2),
	"completion_percentage" integer,
	"issues" text,
	"next_steps" text,
	"submitted_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "org"."job_log_media" ADD CONSTRAINT "job_log_media_job_log_id_job_logs_id_fk" FOREIGN KEY ("job_log_id") REFERENCES "org"."job_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_log_media" ADD CONSTRAINT "job_log_media_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_log_media" ADD CONSTRAINT "job_log_media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_logs" ADD CONSTRAINT "job_logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."job_logs" ADD CONSTRAINT "job_logs_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_job_log_media_job_log_id" ON "org"."job_log_media" USING btree ("job_log_id");--> statement-breakpoint
CREATE INDEX "idx_job_log_media_job_id" ON "org"."job_log_media" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_log_media_uploaded_by" ON "org"."job_log_media" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_job_logs_job_id" ON "org"."job_logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_logs_submitted_by" ON "org"."job_logs" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "idx_job_logs_work_date" ON "org"."job_logs" USING btree ("work_date");