CREATE SCHEMA IF NOT EXISTS "org";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"employee_id" varchar(50),
	"department_id" integer,
	"position_id" integer,
	"reports_to" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "employees_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"department_id" integer,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "positions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'org' 
        AND constraint_name = 'employees_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "org"."employees" ADD CONSTRAINT "employees_user_id_users_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'org' 
        AND constraint_name = 'employees_department_id_departments_id_fk'
    ) THEN
        ALTER TABLE "org"."employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" 
        FOREIGN KEY ("department_id") REFERENCES "org"."departments"("id") ON DELETE set null ON UPDATE no action;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'org' 
        AND constraint_name = 'employees_position_id_positions_id_fk'
    ) THEN
        ALTER TABLE "org"."employees" ADD CONSTRAINT "employees_position_id_positions_id_fk" 
        FOREIGN KEY ("position_id") REFERENCES "org"."positions"("id") ON DELETE set null ON UPDATE no action;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'org' 
        AND constraint_name = 'employees_reports_to_users_id_fk'
    ) THEN
        ALTER TABLE "org"."employees" ADD CONSTRAINT "employees_reports_to_users_id_fk" 
        FOREIGN KEY ("reports_to") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'org' 
        AND constraint_name = 'positions_department_id_departments_id_fk'
    ) THEN
        ALTER TABLE "org"."positions" ADD CONSTRAINT "positions_department_id_departments_id_fk" 
        FOREIGN KEY ("department_id") REFERENCES "org"."departments"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;
