CREATE TABLE "auth"."general_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(255) DEFAULT 'T3 Mechanical',
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"city" varchar(100),
	"state" varchar(50),
	"zip_code" varchar(20),
	"tax_id" varchar(50),
	"license_number" varchar(100),
	"announcement_enabled" boolean DEFAULT false,
	"announcement_title" varchar(255),
	"announcement_description" text,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth"."proposal_basis_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(255) NOT NULL,
	"template" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth"."terms_conditions_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(255) NOT NULL,
	"exclusions" text,
	"warranty_details" text,
	"special_terms" text,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"created_by" uuid,
	"updated_by" uuid,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP TABLE "auth"."announcement_settings" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."company_settings" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."proposal_template_settings" CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."general_settings" ADD CONSTRAINT "general_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."proposal_basis_templates" ADD CONSTRAINT "proposal_basis_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."proposal_basis_templates" ADD CONSTRAINT "proposal_basis_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."terms_conditions_templates" ADD CONSTRAINT "terms_conditions_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."terms_conditions_templates" ADD CONSTRAINT "terms_conditions_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_proposal_basis_active" ON "auth"."proposal_basis_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_proposal_basis_deleted" ON "auth"."proposal_basis_templates" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_proposal_basis_sort" ON "auth"."proposal_basis_templates" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_terms_templates_active" ON "auth"."terms_conditions_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_terms_templates_deleted" ON "auth"."terms_conditions_templates" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_terms_templates_default" ON "auth"."terms_conditions_templates" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "idx_terms_templates_sort" ON "auth"."terms_conditions_templates" USING btree ("sort_order");