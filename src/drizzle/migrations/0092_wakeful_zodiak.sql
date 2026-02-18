CREATE TABLE "org"."revenue_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"target_amount" numeric(15, 2) NOT NULL,
	"label" varchar(150),
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_revenue_target_month_year" UNIQUE("month","year")
);
--> statement-breakpoint
ALTER TABLE "org"."revenue_targets" ADD CONSTRAINT "revenue_targets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."revenue_targets" ADD CONSTRAINT "revenue_targets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."revenue_targets" ADD CONSTRAINT "revenue_targets_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_revenue_targets_year" ON "org"."revenue_targets" USING btree ("year");--> statement-breakpoint
CREATE INDEX "idx_revenue_targets_month_year" ON "org"."revenue_targets" USING btree ("month","year");--> statement-breakpoint
CREATE INDEX "idx_revenue_targets_is_deleted" ON "org"."revenue_targets" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_revenue_targets_created_by" ON "org"."revenue_targets" USING btree ("created_by");