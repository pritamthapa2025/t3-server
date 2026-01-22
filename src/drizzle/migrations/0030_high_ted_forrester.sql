-- Drop NOT NULL constraint from title column if it exists and is NOT NULL
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'org' 
        AND table_name = 'bids' 
        AND column_name = 'title' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "org"."bids" ALTER COLUMN "title" DROP NOT NULL;
    END IF;
END $$;--> statement-breakpoint

-- Set NOT NULL constraint on project_name column if it exists and is nullable
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'org' 
        AND table_name = 'bids' 
        AND column_name = 'project_name' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE "org"."bids" ALTER COLUMN "project_name" SET NOT NULL;
    END IF;
END $$;--> statement-breakpoint

-- Add columns to bid_design_build_data if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_design_build_data' AND column_name = 'design_phase') THEN
        ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_phase" varchar(50);
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_design_build_data' AND column_name = 'design_start_date') THEN
        ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_start_date" date;
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_design_build_data' AND column_name = 'design_completion_date') THEN
        ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_completion_date" date;
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_design_build_data' AND column_name = 'design_team_members') THEN
        ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_team_members" text;
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_design_build_data' AND column_name = 'concept_description') THEN
        ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "concept_description" text;
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_design_build_data' AND column_name = 'design_deliverables') THEN
        ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_deliverables" text;
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_design_build_data' AND column_name = 'client_approval_required') THEN
        ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "client_approval_required" boolean DEFAULT false;
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_design_build_data' AND column_name = 'design_fee_basis') THEN
        ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_fee_basis" varchar(50);
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_design_build_data' AND column_name = 'design_fees') THEN
        ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_fees" numeric(15, 2) DEFAULT '0';
    END IF;
END $$;--> statement-breakpoint

-- Add columns to bid_plan_spec_data if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_plan_spec_data' AND column_name = 'plans_received_date') THEN
        ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "plans_received_date" date;
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_plan_spec_data' AND column_name = 'plan_revision') THEN
        ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "plan_revision" varchar(100);
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_plan_spec_data' AND column_name = 'plan_review_notes') THEN
        ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "plan_review_notes" text;
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_plan_spec_data' AND column_name = 'specifications_received_date') THEN
        ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "specifications_received_date" date;
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_plan_spec_data' AND column_name = 'specification_revision') THEN
        ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "specification_revision" varchar(100);
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_plan_spec_data' AND column_name = 'specification_review_notes') THEN
        ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "specification_review_notes" text;
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_plan_spec_data' AND column_name = 'compliance_requirements') THEN
        ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "compliance_requirements" text;
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_plan_spec_data' AND column_name = 'code_compliance_status') THEN
        ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "code_compliance_status" varchar(50);
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_plan_spec_data' AND column_name = 'addenda_received') THEN
        ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "addenda_received" boolean DEFAULT false;
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_plan_spec_data' AND column_name = 'addenda_count') THEN
        ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "addenda_count" integer DEFAULT 0;
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'bid_plan_spec_data' AND column_name = 'addenda_notes') THEN
        ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "addenda_notes" text;
    END IF;
END $$;--> statement-breakpoint

-- Create indexes if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'org' AND tablename = 'bid_design_build_data' AND indexname = 'idx_bid_design_build_bid_id') THEN
        CREATE INDEX "idx_bid_design_build_bid_id" ON "org"."bid_design_build_data" USING btree ("bid_id");
    END IF;
END $$;--> statement-breakpoint

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'org' AND tablename = 'bid_plan_spec_data' AND indexname = 'idx_bid_plan_spec_bid_id') THEN
        CREATE INDEX "idx_bid_plan_spec_bid_id" ON "org"."bid_plan_spec_data" USING btree ("bid_id");
    END IF;
END $$;