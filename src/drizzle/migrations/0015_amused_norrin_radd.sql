-- Create enum types first (required for invoicing tables)
DO $$ BEGIN
    CREATE TYPE "invoice_status_enum" AS ENUM('draft', 'pending', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled', 'void');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "invoice_type_enum" AS ENUM('standard', 'recurring', 'proforma', 'credit_memo', 'debit_memo');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "payment_status_enum" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'reversed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "invoice_payment_method_enum" AS ENUM('cash', 'check', 'credit_card', 'debit_card', 'ach', 'wire_transfer', 'paypal', 'stripe', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "payment_type_enum" AS ENUM('full', 'partial', 'deposit', 'refund', 'adjustment');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "recurring_frequency_enum" AS ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'semi_annually', 'annually', 'custom');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE "org"."credit_note_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"credit_note_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"applied_amount" numeric(15, 2) NOT NULL,
	"application_date" timestamp DEFAULT now(),
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_credit_note_invoice_application" UNIQUE("credit_note_id","invoice_id")
);
--> statement-breakpoint
CREATE TABLE "org"."credit_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_number" varchar(100) NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"invoice_id" uuid,
	"payment_id" uuid,
	"credit_note_date" date NOT NULL,
	"reason" varchar(100),
	"description" text,
	"credit_amount" numeric(15, 2) NOT NULL,
	"applied_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"remaining_amount" numeric(15, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"expiry_date" date,
	"applied_date" timestamp,
	"created_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_credit_note_number_per_org" UNIQUE("organization_id","credit_note_number")
);
--> statement-breakpoint
CREATE TABLE "org"."invoice_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"document_type" varchar(50),
	"mime_type" varchar(100),
	"uploaded_by" uuid NOT NULL,
	"description" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."invoice_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_value" text,
	"new_value" text,
	"description" text,
	"performed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"item_type" varchar(50),
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"discount_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(15, 2) NOT NULL,
	"job_id" uuid,
	"bid_id" uuid,
	"inventory_item_id" uuid,
	"sort_order" integer DEFAULT 0,
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."invoice_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"reminder_type" varchar(50),
	"days_overdue" integer,
	"sent_date" timestamp NOT NULL,
	"sent_to" varchar(255),
	"subject" varchar(255),
	"message" text,
	"email_opened" boolean DEFAULT false,
	"email_opened_at" timestamp,
	"link_clicked" boolean DEFAULT false,
	"link_clicked_at" timestamp,
	"sent_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar(100) NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"job_id" uuid,
	"bid_id" uuid,
	"invoice_type" "invoice_type_enum" DEFAULT 'standard' NOT NULL,
	"status" "invoice_status_enum" DEFAULT 'draft' NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date NOT NULL,
	"sent_date" timestamp,
	"paid_date" timestamp,
	"last_reminder_date" timestamp,
	"subtotal" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"discount_type" varchar(20),
	"discount_value" numeric(10, 2),
	"total_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(15, 2) DEFAULT '0' NOT NULL,
	"balance_due" numeric(15, 2) DEFAULT '0' NOT NULL,
	"payment_terms" varchar(100),
	"payment_terms_days" integer,
	"notes" text,
	"terms_and_conditions" text,
	"internal_notes" text,
	"billing_address_line1" varchar(255),
	"billing_address_line2" varchar(255),
	"billing_city" varchar(100),
	"billing_state" varchar(100),
	"billing_zip_code" varchar(20),
	"billing_country" varchar(100),
	"is_recurring" boolean DEFAULT false,
	"recurring_frequency" "recurring_frequency_enum",
	"recurring_start_date" date,
	"recurring_end_date" date,
	"next_invoice_date" date,
	"parent_invoice_id" uuid,
	"email_sent" boolean DEFAULT false,
	"email_sent_to" varchar(255),
	"reminder_sent" boolean DEFAULT false,
	"reminder_count" integer DEFAULT 0,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_invoice_number_per_org" UNIQUE("organization_id","invoice_number")
);
--> statement-breakpoint
CREATE TABLE "org"."payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"allocated_amount" numeric(15, 2) NOT NULL,
	"allocation_date" timestamp DEFAULT now(),
	"notes" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_payment_invoice_allocation" UNIQUE("payment_id","invoice_id")
);
--> statement-breakpoint
CREATE TABLE "org"."payment_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"document_type" varchar(50),
	"mime_type" varchar(100),
	"uploaded_by" uuid NOT NULL,
	"description" text,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."payment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_value" text,
	"new_value" text,
	"description" text,
	"performed_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org"."payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_number" varchar(100) NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"invoice_id" uuid,
	"payment_type" "payment_type_enum" DEFAULT 'full' NOT NULL,
	"payment_method" "invoice_payment_method_enum" NOT NULL,
	"status" "payment_status_enum" DEFAULT 'pending' NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"exchange_rate" numeric(10, 6) DEFAULT '1' NOT NULL,
	"payment_date" date NOT NULL,
	"received_date" timestamp,
	"processed_date" timestamp,
	"cleared_date" timestamp,
	"check_number" varchar(50),
	"transaction_id" varchar(255),
	"reference_number" varchar(255),
	"bank_name" varchar(255),
	"account_last_four" varchar(4),
	"processing_fee" numeric(15, 2) DEFAULT '0' NOT NULL,
	"late_fee" numeric(15, 2) DEFAULT '0' NOT NULL,
	"discount_applied" numeric(15, 2) DEFAULT '0' NOT NULL,
	"adjustment_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"adjustment_reason" text,
	"notes" text,
	"internal_notes" text,
	"created_by" uuid NOT NULL,
	"processed_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_payment_number_per_org" UNIQUE("organization_id","payment_number")
);
--> statement-breakpoint
ALTER TABLE "org"."credit_note_applications" ADD CONSTRAINT "credit_note_applications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."credit_note_applications" ADD CONSTRAINT "credit_note_applications_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "org"."credit_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."credit_note_applications" ADD CONSTRAINT "credit_note_applications_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."credit_notes" ADD CONSTRAINT "credit_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."credit_notes" ADD CONSTRAINT "credit_notes_client_id_organizations_id_fk" FOREIGN KEY ("client_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."credit_notes" ADD CONSTRAINT "credit_notes_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "org"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."credit_notes" ADD CONSTRAINT "credit_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_documents" ADD CONSTRAINT "invoice_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_documents" ADD CONSTRAINT "invoice_documents_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_documents" ADD CONSTRAINT "invoice_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_history" ADD CONSTRAINT "invoice_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_history" ADD CONSTRAINT "invoice_history_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_history" ADD CONSTRAINT "invoice_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" ADD CONSTRAINT "invoice_line_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" ADD CONSTRAINT "invoice_line_items_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" ADD CONSTRAINT "invoice_line_items_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_line_items" ADD CONSTRAINT "invoice_line_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "org"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_reminders" ADD CONSTRAINT "invoice_reminders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_reminders" ADD CONSTRAINT "invoice_reminders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_reminders" ADD CONSTRAINT "invoice_reminders_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD CONSTRAINT "invoices_client_id_organizations_id_fk" FOREIGN KEY ("client_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD CONSTRAINT "invoices_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD CONSTRAINT "invoices_parent_invoice_id_invoices_id_fk" FOREIGN KEY ("parent_invoice_id") REFERENCES "org"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoices" ADD CONSTRAINT "invoices_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payment_allocations" ADD CONSTRAINT "payment_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "org"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payment_documents" ADD CONSTRAINT "payment_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payment_documents" ADD CONSTRAINT "payment_documents_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "org"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payment_documents" ADD CONSTRAINT "payment_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payment_history" ADD CONSTRAINT "payment_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payment_history" ADD CONSTRAINT "payment_history_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "org"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payment_history" ADD CONSTRAINT "payment_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payments" ADD CONSTRAINT "payments_client_id_organizations_id_fk" FOREIGN KEY ("client_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "org"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."payments" ADD CONSTRAINT "payments_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_credit_note_applications_org" ON "org"."credit_note_applications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_credit_note_applications_credit_note" ON "org"."credit_note_applications" USING btree ("credit_note_id");--> statement-breakpoint
CREATE INDEX "idx_credit_note_applications_invoice" ON "org"."credit_note_applications" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_credit_notes_org" ON "org"."credit_notes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_credit_notes_client" ON "org"."credit_notes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_credit_notes_invoice" ON "org"."credit_notes" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_credit_notes_payment" ON "org"."credit_notes" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_credit_notes_status" ON "org"."credit_notes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_credit_notes_credit_note_date" ON "org"."credit_notes" USING btree ("credit_note_date");--> statement-breakpoint
CREATE INDEX "idx_invoice_documents_org" ON "org"."invoice_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_documents_invoice" ON "org"."invoice_documents" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_documents_type" ON "org"."invoice_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_invoice_documents_uploaded_by" ON "org"."invoice_documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_invoice_history_org" ON "org"."invoice_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_history_invoice" ON "org"."invoice_history" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_history_performed_by" ON "org"."invoice_history" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_invoice_history_created_at" ON "org"."invoice_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_invoice_history_action" ON "org"."invoice_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_org" ON "org"."invoice_line_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_invoice" ON "org"."invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_job" ON "org"."invoice_line_items" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_bid" ON "org"."invoice_line_items" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_inventory" ON "org"."invoice_line_items" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_reminders_org" ON "org"."invoice_reminders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_reminders_invoice" ON "org"."invoice_reminders" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_reminders_sent_date" ON "org"."invoice_reminders" USING btree ("sent_date");--> statement-breakpoint
CREATE INDEX "idx_invoice_reminders_type" ON "org"."invoice_reminders" USING btree ("reminder_type");--> statement-breakpoint
CREATE INDEX "idx_invoices_org" ON "org"."invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_client" ON "org"."invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_job" ON "org"."invoices" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_bid" ON "org"."invoices" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "org"."invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoices_type" ON "org"."invoices" USING btree ("invoice_type");--> statement-breakpoint
CREATE INDEX "idx_invoices_invoice_date" ON "org"."invoices" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "idx_invoices_due_date" ON "org"."invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_invoices_is_deleted" ON "org"."invoices" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_invoices_created_at" ON "org"."invoices" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_invoices_recurring" ON "org"."invoices" USING btree ("is_recurring","parent_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payment_allocations_org" ON "org"."payment_allocations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_payment_allocations_payment" ON "org"."payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_payment_allocations_invoice" ON "org"."payment_allocations" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payment_documents_org" ON "org"."payment_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_payment_documents_payment" ON "org"."payment_documents" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_payment_documents_type" ON "org"."payment_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_payment_documents_uploaded_by" ON "org"."payment_documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_payment_history_org" ON "org"."payment_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_payment_history_payment" ON "org"."payment_history" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_payment_history_performed_by" ON "org"."payment_history" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_payment_history_created_at" ON "org"."payment_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_payment_history_action" ON "org"."payment_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_payments_org" ON "org"."payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_payments_client" ON "org"."payments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_payments_invoice" ON "org"."payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "org"."payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payments_method" ON "org"."payments" USING btree ("payment_method");--> statement-breakpoint
CREATE INDEX "idx_payments_payment_date" ON "org"."payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_payments_received_date" ON "org"."payments" USING btree ("received_date");--> statement-breakpoint
CREATE INDEX "idx_payments_is_deleted" ON "org"."payments" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_payments_created_at" ON "org"."payments" USING btree ("created_at");