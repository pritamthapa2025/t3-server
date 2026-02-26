CREATE TABLE "notifications"."notification_cooldowns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(100) NOT NULL,
	"last_sent_at" timestamp NOT NULL,
	"next_allowed_at" timestamp NOT NULL,
	"cooldown_days" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notif_cooldowns_unique" UNIQUE("event_type","entity_type","entity_id")
);
--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "setup_token_used_at" timestamp;--> statement-breakpoint
CREATE INDEX "notif_cooldowns_next_allowed_idx" ON "notifications"."notification_cooldowns" USING btree ("next_allowed_at");--> statement-breakpoint
CREATE INDEX "notif_cooldowns_event_type_idx" ON "notifications"."notification_cooldowns" USING btree ("event_type");