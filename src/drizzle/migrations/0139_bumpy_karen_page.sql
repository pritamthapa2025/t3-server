ALTER TABLE "org"."dispatch_assignments" ADD COLUMN "break_taken" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD COLUMN "break_start_time" timestamp;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD COLUMN "break_minutes" integer DEFAULT 30;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD COLUMN "media_attachments" jsonb;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD COLUMN "ca_labor_violation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD COLUMN "ca_violation_details" text;--> statement-breakpoint
ALTER TABLE "org"."timesheets" ADD COLUMN "weekly_confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "org"."timesheets" ADD COLUMN "weekly_confirmation_notes" text;--> statement-breakpoint
ALTER TABLE "org"."timesheets" DROP COLUMN "clock_in";--> statement-breakpoint
ALTER TABLE "org"."timesheets" DROP COLUMN "clock_out";