CREATE TYPE "public"."account_type_enum" AS ENUM('savings', 'current', 'salary', 'checking', 'business');--> statement-breakpoint
CREATE TABLE "org"."user_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_holder_name" varchar(150) NOT NULL,
	"bank_name" varchar(150) NOT NULL,
	"account_number" varchar(100) NOT NULL,
	"routing_number" varchar(100),
	"account_type" "account_type_enum" NOT NULL,
	"branch_name" varchar(150),
	"is_primary" boolean DEFAULT false,
	"is_verified" boolean DEFAULT false,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "org"."user_bank_accounts" ADD CONSTRAINT "user_bank_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_users_id" ON "auth"."users" USING btree ("id");--> statement-breakpoint
CREATE INDEX "idx_users_is_active" ON "auth"."users" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_users_is_deleted" ON "auth"."users" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_users_active_not_deleted" ON "auth"."users" USING btree ("is_active","is_deleted");