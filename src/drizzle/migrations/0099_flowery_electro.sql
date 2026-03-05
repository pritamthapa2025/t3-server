CREATE TABLE "org"."user_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_type" "user_organization_type_enum" DEFAULT 'client_user' NOT NULL,
	"title" varchar(100),
	"is_active" boolean DEFAULT true,
	"is_primary" boolean DEFAULT false,
	"joined_at" timestamp DEFAULT now(),
	"left_at" timestamp,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_org" UNIQUE("user_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "org"."user_organizations" ADD CONSTRAINT "user_organizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."user_organizations" ADD CONSTRAINT "user_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_orgs_user" ON "org"."user_organizations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_orgs_org" ON "org"."user_organizations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_user_orgs_type" ON "org"."user_organizations" USING btree ("user_type");--> statement-breakpoint
CREATE INDEX "idx_user_orgs_is_active" ON "org"."user_organizations" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "org"."employees" DROP COLUMN IF EXISTS "is_online";--> statement-breakpoint
ALTER TABLE "org"."employees" DROP COLUMN IF EXISTS "last_seen";