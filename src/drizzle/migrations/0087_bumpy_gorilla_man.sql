CREATE TABLE "org"."employee_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" integer NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"document_type" varchar(50),
	"description" text,
	"expiration_date" date,
	"uploaded_by" uuid NOT NULL,
	"is_starred" boolean DEFAULT false,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "org"."employee_documents" ADD CONSTRAINT "employee_documents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."employee_documents" ADD CONSTRAINT "employee_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_employee_documents_employee" ON "org"."employee_documents" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_documents_type" ON "org"."employee_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_employee_documents_expiration" ON "org"."employee_documents" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX "idx_employee_documents_uploaded_by" ON "org"."employee_documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_employee_documents_starred" ON "org"."employee_documents" USING btree ("is_starred");--> statement-breakpoint
CREATE INDEX "idx_employee_documents_is_deleted" ON "org"."employee_documents" USING btree ("is_deleted");