CREATE SCHEMA "seed_tracking";
--> statement-breakpoint
CREATE TABLE "seed_tracking"."seed_tracking" (
	"seed_name" varchar(255) PRIMARY KEY NOT NULL,
	"executed_at" timestamp DEFAULT now() NOT NULL,
	"executed_by" varchar(255),
	"version" varchar(50),
	"record_count" varchar(50)
);
--> statement-breakpoint
CREATE INDEX "seed_tracking_executed_at_idx" ON "seed_tracking"."seed_tracking" USING btree ("executed_at");--> statement-breakpoint
ALTER TABLE "notifications"."notification_rules" ADD CONSTRAINT "notification_rules_event_type_unique" UNIQUE("event_type");