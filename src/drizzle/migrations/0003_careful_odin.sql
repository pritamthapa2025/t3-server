CREATE TYPE "public"."employee_status_enum" AS ENUM('available', 'on_leave', 'in_field', 'terminated', 'suspended');--> statement-breakpoint
CREATE TABLE "org"."employee_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"reviewer_id" uuid,
	"title" varchar(150),
	"review_date" timestamp DEFAULT now(),
	"ratings" jsonb NOT NULL,
	"average_score" varchar(10),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN "start_date" timestamp;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN "end_date" timestamp;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN "performance" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN "violations" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN "status" "employee_status_enum" DEFAULT 'available' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."employees" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."employee_reviews" ADD CONSTRAINT "employee_reviews_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_reviews" ADD CONSTRAINT "employee_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;