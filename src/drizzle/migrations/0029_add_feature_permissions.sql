-- Add new enums for feature-based permissions
CREATE TYPE "public"."access_level_enum" AS ENUM('none', 'view', 'view_own', 'view_assigned', 'view_team', 'create', 'edit_own', 'edit_assigned', 'edit_team', 'edit_all', 'delete_own', 'delete_all', 'approve', 'admin');
--> statement-breakpoint
CREATE TYPE "public"."ui_element_type_enum" AS ENUM('button', 'field', 'column', 'section', 'tab', 'menu', 'card');
--> statement-breakpoint

-- Update permission_module_enum to include new modules
ALTER TYPE "public"."permission_module_enum" ADD VALUE IF NOT EXISTS 'inventory';
--> statement-breakpoint
ALTER TYPE "public"."permission_module_enum" ADD VALUE IF NOT EXISTS 'compliance';
--> statement-breakpoint
ALTER TYPE "public"."permission_module_enum" ADD VALUE IF NOT EXISTS 'dispatch';
--> statement-breakpoint
ALTER TYPE "public"."permission_module_enum" ADD VALUE IF NOT EXISTS 'payroll';
--> statement-breakpoint
ALTER TYPE "public"."permission_module_enum" ADD VALUE IF NOT EXISTS 'expenses';
--> statement-breakpoint
ALTER TYPE "public"."permission_module_enum" ADD VALUE IF NOT EXISTS 'invoicing';
--> statement-breakpoint
ALTER TYPE "public"."permission_module_enum" ADD VALUE IF NOT EXISTS 'timesheet';
--> statement-breakpoint
ALTER TYPE "public"."permission_module_enum" ADD VALUE IF NOT EXISTS 'mileage';
--> statement-breakpoint
ALTER TYPE "public"."permission_module_enum" ADD VALUE IF NOT EXISTS 'capacity';
--> statement-breakpoint
ALTER TYPE "public"."permission_module_enum" ADD VALUE IF NOT EXISTS 'compensation';
--> statement-breakpoint
ALTER TYPE "public"."permission_module_enum" ADD VALUE IF NOT EXISTS 'performance';
--> statement-breakpoint
ALTER TYPE "public"."permission_module_enum" ADD VALUE IF NOT EXISTS 'maintenance';
--> statement-breakpoint
ALTER TYPE "public"."permission_module_enum" ADD VALUE IF NOT EXISTS 'survey';
--> statement-breakpoint
ALTER TYPE "public"."permission_module_enum" ADD VALUE IF NOT EXISTS 'tasks';
--> statement-breakpoint
ALTER TYPE "public"."permission_module_enum" ADD VALUE IF NOT EXISTS 'documents';
--> statement-breakpoint

-- Create features table
CREATE TABLE IF NOT EXISTS "auth"."features" (
	"id" serial PRIMARY KEY NOT NULL,
	"module" "public"."permission_module_enum" NOT NULL,
	"feature_code" varchar(100) NOT NULL,
	"feature_name" varchar(150) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_module_feature" UNIQUE("module","feature_code")
);
--> statement-breakpoint

-- Create role_features table
CREATE TABLE IF NOT EXISTS "auth"."role_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"feature_id" integer NOT NULL,
	"access_level" "public"."access_level_enum" NOT NULL,
	"conditions" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_role_feature" UNIQUE("role_id","feature_id")
);
--> statement-breakpoint

-- Create ui_elements table
CREATE TABLE IF NOT EXISTS "auth"."ui_elements" (
	"id" serial PRIMARY KEY NOT NULL,
	"module" "public"."permission_module_enum" NOT NULL,
	"element_code" varchar(100) NOT NULL,
	"element_name" varchar(150) NOT NULL,
	"element_type" "public"."ui_element_type_enum" NOT NULL,
	"description" text,
	"required_feature_id" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_module_element" UNIQUE("module","element_code")
);
--> statement-breakpoint

-- Create role_ui_elements table
CREATE TABLE IF NOT EXISTS "auth"."role_ui_elements" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"ui_element_id" integer NOT NULL,
	"is_visible" boolean DEFAULT true,
	"is_enabled" boolean DEFAULT true,
	"conditions" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_role_ui_element" UNIQUE("role_id","ui_element_id")
);
--> statement-breakpoint

-- Create data_filters table
CREATE TABLE IF NOT EXISTS "auth"."data_filters" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"module" "public"."permission_module_enum" NOT NULL,
	"filter_type" varchar(50) NOT NULL,
	"filter_rule" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

-- Create field_permissions table
CREATE TABLE IF NOT EXISTS "auth"."field_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"module" "public"."permission_module_enum" NOT NULL,
	"field_name" varchar(100) NOT NULL,
	"access_level" varchar(20) NOT NULL,
	"conditions" jsonb,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_role_module_field" UNIQUE("role_id","module","field_name")
);
--> statement-breakpoint

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "auth"."role_features" ADD CONSTRAINT "role_features_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "auth"."roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "auth"."role_features" ADD CONSTRAINT "role_features_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "auth"."features"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "auth"."ui_elements" ADD CONSTRAINT "ui_elements_required_feature_id_features_id_fk" FOREIGN KEY ("required_feature_id") REFERENCES "auth"."features"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "auth"."role_ui_elements" ADD CONSTRAINT "role_ui_elements_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "auth"."roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "auth"."role_ui_elements" ADD CONSTRAINT "role_ui_elements_ui_element_id_ui_elements_id_fk" FOREIGN KEY ("ui_element_id") REFERENCES "auth"."ui_elements"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "auth"."data_filters" ADD CONSTRAINT "data_filters_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "auth"."roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "auth"."field_permissions" ADD CONSTRAINT "field_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "auth"."roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_features_module" ON "auth"."features" ("module");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_features_active" ON "auth"."features" ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_role_features_role" ON "auth"."role_features" ("role_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_role_features_feature" ON "auth"."role_features" ("feature_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_role_features_access" ON "auth"."role_features" ("access_level");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ui_elements_module" ON "auth"."ui_elements" ("module");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ui_elements_type" ON "auth"."ui_elements" ("element_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_role_ui_elements_role" ON "auth"."role_ui_elements" ("role_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_role_ui_elements_element" ON "auth"."role_ui_elements" ("ui_element_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_data_filters_role" ON "auth"."data_filters" ("role_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_data_filters_module" ON "auth"."data_filters" ("module");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_data_filters_type" ON "auth"."data_filters" ("filter_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_field_permissions_role" ON "auth"."field_permissions" ("role_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_field_permissions_module" ON "auth"."field_permissions" ("module");
