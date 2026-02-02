-- Vehicle configuration and notification settings (Vehicle Settings page)
ALTER TABLE "org"."vehicles" ADD COLUMN "fuel_type" "public"."fuel_type_enum";--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "oil_change_interval_miles" integer;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "tire_rotation_interval_miles" integer;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "brake_inspection_interval_miles" integer;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "safety_inspection_interval_months" integer;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "maintenance_reminders_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "overdue_repairs_alerts_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "org"."vehicles" ADD COLUMN "safety_inspection_reminders_enabled" boolean DEFAULT true;
