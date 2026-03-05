CREATE SCHEMA IF NOT EXISTS "financial";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial"."category_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(50) NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"budget_amount" numeric(15, 2) DEFAULT '100000' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_fin_cat_budget_cat_month_year" UNIQUE("category","month","year")
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "financial"."category_budgets" ADD CONSTRAINT "category_budgets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "financial"."category_budgets" ADD CONSTRAINT "category_budgets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "financial"."category_budgets" ADD CONSTRAINT "category_budgets_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_fin_cat_budgets_period" ON "financial"."category_budgets" USING btree ("month","year");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_fin_cat_budgets_category" ON "financial"."category_budgets" USING btree ("category");
