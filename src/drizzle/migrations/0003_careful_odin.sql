DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_status_enum') THEN
        CREATE TYPE "public"."employee_status_enum" AS ENUM('available', 'on_leave', 'in_field', 'terminated', 'suspended');
    END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org"."employee_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"reviewer_id" uuid,
	"title" varchar(150),
	"review_date" timestamp DEFAULT now(),
	"ratings" jsonb NOT NULL,
	"average_score" varchar(10),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'employees' AND column_name = 'start_date') THEN
        ALTER TABLE "org"."employees" ADD COLUMN "start_date" timestamp;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'employees' AND column_name = 'end_date') THEN
        ALTER TABLE "org"."employees" ADD COLUMN "end_date" timestamp;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'employees' AND column_name = 'performance') THEN
        ALTER TABLE "org"."employees" ADD COLUMN "performance" integer DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'employees' AND column_name = 'violations') THEN
        ALTER TABLE "org"."employees" ADD COLUMN "violations" integer DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'employees' AND column_name = 'status') THEN
        ALTER TABLE "org"."employees" ADD COLUMN "status" "employee_status_enum" DEFAULT 'available' NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'employees' AND column_name = 'is_deleted') THEN
        ALTER TABLE "org"."employees" ADD COLUMN "is_deleted" boolean DEFAULT false;
    END IF;
END $$;
--> statement-breakpoint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'org' 
        AND constraint_name = 'employee_reviews_employee_id_employees_id_fk'
    ) THEN
        ALTER TABLE "org"."employee_reviews" ADD CONSTRAINT "employee_reviews_employee_id_employees_id_fk" 
        FOREIGN KEY ("employee_id") REFERENCES "org"."employees"("id") ON DELETE no action ON UPDATE no action;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'org' 
        AND constraint_name = 'employee_reviews_reviewer_id_users_id_fk'
    ) THEN
        ALTER TABLE "org"."employee_reviews" ADD CONSTRAINT "employee_reviews_reviewer_id_users_id_fk" 
        FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;