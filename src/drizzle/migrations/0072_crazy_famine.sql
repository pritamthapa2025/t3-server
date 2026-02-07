CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE TABLE "notifications"."notification_delivery_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid,
	"user_id" uuid NOT NULL,
	"channel" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"provider_response" text,
	"error_message" text,
	"sent_at" timestamp,
	"failed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"real_time" boolean DEFAULT true NOT NULL,
	"hourly_digest" boolean DEFAULT false NOT NULL,
	"daily_summary" boolean DEFAULT false NOT NULL,
	"weekly_summary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications"."notification_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(50) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" varchar(20) NOT NULL,
	"recipient_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conditions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" varchar(50) NOT NULL,
	"type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"short_message" varchar(255),
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"related_entity_type" varchar(50),
	"related_entity_id" varchar(100),
	"related_entity_name" varchar(255),
	"created_by" varchar(255),
	"action_url" varchar(500),
	"additional_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "notifications"."notification_delivery_log" ADD CONSTRAINT "notification_delivery_log_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "notifications"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."notification_delivery_log" ADD CONSTRAINT "notification_delivery_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_delivery_log_notification_idx" ON "notifications"."notification_delivery_log" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_log_status_idx" ON "notifications"."notification_delivery_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notification_delivery_log_channel_idx" ON "notifications"."notification_delivery_log" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "notification_delivery_log_user_idx" ON "notifications"."notification_delivery_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_preferences_user_idx" ON "notifications"."notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_rules_event_type_idx" ON "notifications"."notification_rules" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "notification_rules_enabled_idx" ON "notifications"."notification_rules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "notification_rules_category_event_idx" ON "notifications"."notification_rules" USING btree ("category","event_type");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications"."notifications" USING btree ("user_id","read","created_at");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications"."notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_category_idx" ON "notifications"."notifications" USING btree ("category");--> statement-breakpoint
CREATE INDEX "notifications_type_idx" ON "notifications"."notifications" USING btree ("type");