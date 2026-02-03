CREATE TABLE "auth"."announcement_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enabled" boolean DEFAULT false,
	"title" varchar(255),
	"description" text,
	"background_color" varchar(50),
	"text_color" varchar(50),
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth"."company_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(255) DEFAULT 'T3 Mechanical',
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"city" varchar(100),
	"state" varchar(50),
	"zip_code" varchar(20),
	"country" varchar(100) DEFAULT 'USA',
	"tax_id" varchar(50),
	"license_number" varchar(100),
	"logo_url" varchar(500),
	"time_zone" varchar(100) DEFAULT 'America/Los_Angeles',
	"work_week_start" varchar(20) DEFAULT 'Monday',
	"work_start_time" varchar(10) DEFAULT '08:00',
	"work_end_time" varchar(10) DEFAULT '17:00',
	"date_format" varchar(50) DEFAULT 'MM/DD/YYYY',
	"time_format" varchar(20) DEFAULT '12-hour',
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth"."inventory_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enable_low_stock_alerts" boolean DEFAULT true,
	"default_low_stock_threshold" integer DEFAULT 10,
	"enable_auto_reorder" boolean DEFAULT false,
	"default_reorder_quantity" integer DEFAULT 50,
	"default_reorder_point" integer DEFAULT 20,
	"track_serial_numbers" boolean DEFAULT false,
	"track_lot_numbers" boolean DEFAULT false,
	"track_expiration_dates" boolean DEFAULT false,
	"valuation_method" varchar(50) DEFAULT 'FIFO',
	"notify_on_low_stock" boolean DEFAULT true,
	"notify_on_out_of_stock" boolean DEFAULT true,
	"notify_on_reorder_point" boolean DEFAULT true,
	"default_weight_unit" varchar(20) DEFAULT 'lbs',
	"default_volume_unit" varchar(20) DEFAULT 'gal',
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth"."invoice_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number_prefix" varchar(20) DEFAULT 'INV',
	"invoice_number_starting_number" integer DEFAULT 1,
	"default_payment_terms" varchar(50) DEFAULT 'Net 30',
	"default_payment_terms_days" integer DEFAULT 30,
	"enable_late_fees" boolean DEFAULT false,
	"late_fee_percentage" numeric(5, 2) DEFAULT '0.00',
	"late_fee_grace_period_days" integer DEFAULT 0,
	"show_line_item_details" boolean DEFAULT true,
	"show_labor_breakdown" boolean DEFAULT true,
	"show_materials_breakdown" boolean DEFAULT true,
	"default_invoice_notes" text,
	"default_terms_and_conditions" text,
	"auto_send_on_completion" boolean DEFAULT false,
	"auto_remind_before_due" boolean DEFAULT false,
	"reminder_days_before_due" integer DEFAULT 7,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth"."job_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_number_prefix" varchar(20) DEFAULT 'JOB',
	"job_number_starting_number" integer DEFAULT 1,
	"default_job_priority" varchar(50) DEFAULT 'medium',
	"default_job_status" varchar(50) DEFAULT 'scheduled',
	"auto_assign_from_bid" boolean DEFAULT true,
	"require_approval_before_start" boolean DEFAULT false,
	"notify_on_status_change" boolean DEFAULT true,
	"notify_on_completion" boolean DEFAULT true,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth"."labor_rate_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position_id" integer NOT NULL,
	"default_quantity" integer DEFAULT 1,
	"default_days" integer DEFAULT 3,
	"default_hours_per_day" numeric(5, 2) DEFAULT '8.00',
	"default_cost_rate" numeric(10, 2) DEFAULT '35.00',
	"default_billable_rate" numeric(10, 2) DEFAULT '85.00',
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "labor_rate_templates_position_id_unique" UNIQUE("position_id")
);
--> statement-breakpoint
CREATE TABLE "auth"."notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enable_email_notifications" boolean DEFAULT true,
	"enable_push_notifications" boolean DEFAULT true,
	"enable_sms_notifications" boolean DEFAULT false,
	"enable_in_app_notifications" boolean DEFAULT true,
	"notify_on_new_bid" boolean DEFAULT true,
	"notify_on_bid_approval" boolean DEFAULT true,
	"notify_on_job_assignment" boolean DEFAULT true,
	"notify_on_job_completion" boolean DEFAULT true,
	"notify_on_invoice_created" boolean DEFAULT true,
	"notify_on_payment_received" boolean DEFAULT true,
	"notify_on_inventory_low" boolean DEFAULT true,
	"notify_on_vehicle_maintenance" boolean DEFAULT true,
	"notify_on_timesheet_submission" boolean DEFAULT true,
	"notify_on_timesheet_approval" boolean DEFAULT true,
	"enable_daily_digest" boolean DEFAULT false,
	"daily_digest_time" varchar(10) DEFAULT '08:00',
	"enable_weekly_digest" boolean DEFAULT false,
	"weekly_digest_day" varchar(20) DEFAULT 'Monday',
	"quiet_hours_enabled" boolean DEFAULT false,
	"quiet_hours_start" varchar(10) DEFAULT '22:00',
	"quiet_hours_end" varchar(10) DEFAULT '08:00',
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth"."operating_expense_defaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gross_revenue_previous_year" numeric(15, 2) DEFAULT '5000000.00',
	"operating_cost_previous_year" numeric(15, 2) DEFAULT '520000.00',
	"inflation_rate" numeric(5, 2) DEFAULT '4.00',
	"default_markup_percentage" numeric(5, 2) DEFAULT '20.00',
	"enable_by_default" boolean DEFAULT false,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth"."tax_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"default_sales_tax_rate" numeric(5, 4) DEFAULT '0.0000',
	"sales_tax_label" varchar(100) DEFAULT 'Sales Tax',
	"tax_included_in_price" boolean DEFAULT false,
	"apply_tax_to_labor" boolean DEFAULT true,
	"apply_tax_to_materials" boolean DEFAULT true,
	"apply_tax_to_travel" boolean DEFAULT false,
	"allow_tax_exempt" boolean DEFAULT true,
	"require_tax_exempt_certificate" boolean DEFAULT true,
	"tax_jurisdiction" varchar(255),
	"tax_id_number" varchar(100),
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth"."travel_origins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"address_line1" varchar(255) NOT NULL,
	"address_line2" varchar(255),
	"city" varchar(100) NOT NULL,
	"state" varchar(50) NOT NULL,
	"zip_code" varchar(20) NOT NULL,
	"country" varchar(100) DEFAULT 'USA',
	"full_address" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth"."user_notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"enable_email_notifications" boolean,
	"enable_push_notifications" boolean,
	"enable_sms_notifications" boolean,
	"enable_in_app_notifications" boolean,
	"notify_on_new_bid" boolean,
	"notify_on_bid_approval" boolean,
	"notify_on_job_assignment" boolean,
	"notify_on_job_completion" boolean,
	"notify_on_invoice_created" boolean,
	"notify_on_payment_received" boolean,
	"notify_on_inventory_low" boolean,
	"notify_on_vehicle_maintenance" boolean,
	"notify_on_timesheet_submission" boolean,
	"notify_on_timesheet_approval" boolean,
	"enable_daily_digest" boolean,
	"daily_digest_time" varchar(10),
	"enable_weekly_digest" boolean,
	"weekly_digest_day" varchar(20),
	"quiet_hours_enabled" boolean,
	"quiet_hours_start" varchar(10),
	"quiet_hours_end" varchar(10),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "auth"."vehicle_travel_defaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"default_mileage_rate" numeric(10, 4) DEFAULT '0.6700',
	"default_vehicle_day_rate" numeric(10, 2) DEFAULT '95.00',
	"default_markup" numeric(5, 2) DEFAULT '20.00',
	"enable_flat_rate" boolean DEFAULT false,
	"flat_rate_amount" numeric(10, 2) DEFAULT '150.00',
	"gas_price_per_gallon" numeric(10, 4) DEFAULT '3.5000',
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "auth"."announcement_settings" ADD CONSTRAINT "announcement_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."company_settings" ADD CONSTRAINT "company_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."inventory_settings" ADD CONSTRAINT "inventory_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invoice_settings" ADD CONSTRAINT "invoice_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."job_settings" ADD CONSTRAINT "job_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."labor_rate_templates" ADD CONSTRAINT "labor_rate_templates_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "org"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."labor_rate_templates" ADD CONSTRAINT "labor_rate_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."notification_settings" ADD CONSTRAINT "notification_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."operating_expense_defaults" ADD CONSTRAINT "operating_expense_defaults_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."tax_settings" ADD CONSTRAINT "tax_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."travel_origins" ADD CONSTRAINT "travel_origins_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."travel_origins" ADD CONSTRAINT "travel_origins_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."vehicle_travel_defaults" ADD CONSTRAINT "vehicle_travel_defaults_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_labor_rate_templates_position" ON "auth"."labor_rate_templates" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "idx_travel_origins_active" ON "auth"."travel_origins" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_travel_origins_default" ON "auth"."travel_origins" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "idx_travel_origins_deleted" ON "auth"."travel_origins" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_user_notification_prefs_user" ON "auth"."user_notification_preferences" USING btree ("user_id");