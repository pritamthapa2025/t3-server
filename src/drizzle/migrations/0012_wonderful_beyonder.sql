CREATE TABLE "auth"."trusted_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_token" varchar(255) NOT NULL,
	"device_name" varchar(200),
	"ip_address" varchar(50),
	"user_agent" text,
	"last_used_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "trusted_devices_device_token_unique" UNIQUE("device_token")
);
--> statement-breakpoint
ALTER TABLE "auth"."trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_trusted_devices_user_id" ON "auth"."trusted_devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_trusted_devices_token" ON "auth"."trusted_devices" USING btree ("device_token");--> statement-breakpoint
CREATE INDEX "idx_trusted_devices_expires_at" ON "auth"."trusted_devices" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_trusted_devices_active" ON "auth"."trusted_devices" USING btree ("is_active");