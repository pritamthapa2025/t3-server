CREATE TABLE "org"."client_document_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"category_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_doc_category" UNIQUE("document_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "org"."client_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "org"."document_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(7),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "document_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "org"."industry_classifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"code" varchar(20),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "industry_classifications_name_unique" UNIQUE("name"),
	CONSTRAINT "industry_classifications_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "org"."organizations" RENAME COLUMN "client_type" TO "client_type_id";--> statement-breakpoint
ALTER TABLE "org"."organizations" RENAME COLUMN "industry_classification" TO "industry_classification_id";--> statement-breakpoint

-- Convert legacy enum/text columns to integer FK columns
-- 1) client_type_id: previously a client_type_enum (or text) -> now references org.client_types(id)
INSERT INTO "org"."client_types" ("name")
SELECT DISTINCT ("client_type_id"::text)
FROM "org"."organizations"
WHERE "client_type_id" IS NOT NULL
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint

ALTER TABLE "org"."organizations" ADD COLUMN "client_type_id_int" integer;--> statement-breakpoint
UPDATE "org"."organizations" o
SET "client_type_id_int" = ct."id"
FROM "org"."client_types" ct
WHERE ct."name" = o."client_type_id"::text;--> statement-breakpoint
ALTER TABLE "org"."organizations" DROP COLUMN "client_type_id";--> statement-breakpoint
ALTER TABLE "org"."organizations" RENAME COLUMN "client_type_id_int" TO "client_type_id";--> statement-breakpoint

-- 2) industry_classification_id: previously a text/enum -> now references org.industry_classifications(id)
INSERT INTO "org"."industry_classifications" ("name")
SELECT DISTINCT ("industry_classification_id"::text)
FROM "org"."organizations"
WHERE "industry_classification_id" IS NOT NULL
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint

ALTER TABLE "org"."organizations" ADD COLUMN "industry_classification_id_int" integer;--> statement-breakpoint
UPDATE "org"."organizations" o
SET "industry_classification_id_int" = ic."id"
FROM "org"."industry_classifications" ic
WHERE ic."name" = o."industry_classification_id"::text;--> statement-breakpoint
ALTER TABLE "org"."organizations" DROP COLUMN "industry_classification_id";--> statement-breakpoint
ALTER TABLE "org"."organizations" RENAME COLUMN "industry_classification_id_int" TO "industry_classification_id";--> statement-breakpoint

ALTER TABLE "org"."organizations" DROP CONSTRAINT "organizations_parent_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "org"."organizations" DROP CONSTRAINT "organizations_account_manager_users_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "org"."idx_client_docs_type";--> statement-breakpoint
DROP INDEX IF EXISTS "org"."idx_orgs_client_type";--> statement-breakpoint
DROP INDEX IF EXISTS "org"."idx_orgs_parent";--> statement-breakpoint
DROP INDEX IF EXISTS "org"."idx_orgs_account_manager";--> statement-breakpoint
ALTER TABLE "org"."client_contacts" ADD COLUMN "picture" varchar(500);--> statement-breakpoint
-- Add as nullable first so existing rows don't violate NOT NULL, then backfill and enforce.
ALTER TABLE "org"."organizations" ADD COLUMN "client_id" varchar(20);--> statement-breakpoint
WITH ranked AS (
	SELECT
		"id",
		row_number() OVER (ORDER BY "created_at" NULLS LAST, "id") AS rn
	FROM "org"."organizations"
)
UPDATE "org"."organizations" o
SET "client_id" = 'CLT-' || lpad(ranked.rn::text, 5, '0')
FROM ranked
WHERE o."id" = ranked."id"
  AND o."client_id" IS NULL;--> statement-breakpoint
ALTER TABLE "org"."organizations" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE client_priority_enum AS ENUM ('low', 'medium', 'high');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN "priority" "client_priority_enum" DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN "number_of_employees" integer;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN "street_address" varchar(255);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN "state" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN "zip_code" varchar(20);--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN "billing_contact_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN "billing_day" integer;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD COLUMN "tax_exempt" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."client_document_categories" ADD CONSTRAINT "client_document_categories_document_id_client_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "org"."client_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."client_document_categories" ADD CONSTRAINT "client_document_categories_category_id_document_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "org"."document_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_doc_categories_document" ON "org"."client_document_categories" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_doc_categories_category" ON "org"."client_document_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_client_types_active" ON "org"."client_types" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_client_types_sort" ON "org"."client_types" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_doc_categories_active" ON "org"."document_categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_doc_categories_sort" ON "org"."document_categories" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_industry_active" ON "org"."industry_classifications" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_industry_code" ON "org"."industry_classifications" USING btree ("code");--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD CONSTRAINT "organizations_client_type_id_client_types_id_fk" FOREIGN KEY ("client_type_id") REFERENCES "org"."client_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD CONSTRAINT "organizations_industry_classification_id_industry_classifications_id_fk" FOREIGN KEY ("industry_classification_id") REFERENCES "org"."industry_classifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD CONSTRAINT "organizations_billing_contact_id_client_contacts_id_fk" FOREIGN KEY ("billing_contact_id") REFERENCES "org"."client_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_orgs_client_id" ON "org"."organizations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_orgs_priority" ON "org"."organizations" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_orgs_client_type_id" ON "org"."organizations" USING btree ("client_type_id");--> statement-breakpoint
CREATE INDEX "idx_orgs_industry_id" ON "org"."organizations" USING btree ("industry_classification_id");--> statement-breakpoint
CREATE INDEX "idx_orgs_number_of_employees" ON "org"."organizations" USING btree ("number_of_employees");--> statement-breakpoint
CREATE INDEX "idx_orgs_billing_contact" ON "org"."organizations" USING btree ("billing_contact_id");--> statement-breakpoint
CREATE INDEX "idx_orgs_city_state" ON "org"."organizations" USING btree ("city","state");--> statement-breakpoint
ALTER TABLE "org"."client_documents" DROP COLUMN "document_type";--> statement-breakpoint
ALTER TABLE "org"."organizations" DROP COLUMN "parent_organization_id";--> statement-breakpoint
ALTER TABLE "org"."organizations" DROP COLUMN "billing_address_line1";--> statement-breakpoint
ALTER TABLE "org"."organizations" DROP COLUMN "billing_address_line2";--> statement-breakpoint
ALTER TABLE "org"."organizations" DROP COLUMN "billing_city";--> statement-breakpoint
ALTER TABLE "org"."organizations" DROP COLUMN "billing_state";--> statement-breakpoint
ALTER TABLE "org"."organizations" DROP COLUMN "billing_zip_code";--> statement-breakpoint
ALTER TABLE "org"."organizations" DROP COLUMN "billing_country";--> statement-breakpoint
ALTER TABLE "org"."organizations" DROP COLUMN "account_manager";--> statement-breakpoint
ALTER TABLE "org"."organizations" ADD CONSTRAINT "organizations_client_id_unique" UNIQUE("client_id");