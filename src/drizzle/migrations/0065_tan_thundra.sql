CREATE TABLE "org"."invoice_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"default_payment_terms" varchar(50) DEFAULT 'Net 30',
	"default_payment_terms_days" integer DEFAULT 30,
	"default_tax_rate" numeric(5, 4) DEFAULT '0',
	"enable_late_fees" boolean DEFAULT false,
	"late_fee_percentage" numeric(5, 2) DEFAULT '0',
	"late_fee_grace_period_days" integer DEFAULT 0,
	"show_line_item_details" boolean DEFAULT true,
	"show_labor_breakdown" boolean DEFAULT true,
	"show_materials_breakdown" boolean DEFAULT true,
	"default_invoice_notes" text,
	"default_terms_and_conditions" text,
	"auto_send_on_completion" boolean DEFAULT false,
	"auto_remind_before_due" boolean DEFAULT false,
	"reminder_days_before_due" integer DEFAULT 7,
	"default_email_subject" varchar(500),
	"default_email_message" text,
	"always_attach_pdf" boolean DEFAULT true,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoice_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "org"."invoice_settings" ADD CONSTRAINT "invoice_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."invoice_settings" ADD CONSTRAINT "invoice_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_invoice_settings_org" ON "org"."invoice_settings" USING btree ("organization_id");