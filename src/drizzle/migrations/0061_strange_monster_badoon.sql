CREATE TABLE "auth"."proposal_template_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enable_custom_templates" boolean DEFAULT false,
	"default_template" varchar(100) DEFAULT 'standard',
	"include_company_logo" boolean DEFAULT true,
	"include_terms_and_conditions" boolean DEFAULT true,
	"include_payment_schedule" boolean DEFAULT true,
	"default_terms_and_conditions" text,
	"default_warranty_info" text,
	"default_payment_terms" text,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP TABLE "auth"."inventory_settings" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."invoice_settings" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."job_settings" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."notification_settings" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."tax_settings" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."user_notification_preferences" CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."proposal_template_settings" ADD CONSTRAINT "proposal_template_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;