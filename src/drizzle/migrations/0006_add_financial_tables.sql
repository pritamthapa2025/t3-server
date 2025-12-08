-- Add organizations table (if not exists)
CREATE TABLE IF NOT EXISTS "org"."organizations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" varchar(255) NOT NULL,
    "description" text,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

-- Add jobs table (if not exists)
CREATE TABLE IF NOT EXISTS "org"."jobs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "name" varchar(255) NOT NULL,
    "description" text,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

-- Financial summary table
CREATE TABLE IF NOT EXISTS "org"."financial_summary" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "period_start" date NOT NULL,
    "period_end" date NOT NULL,
    -- Revenue metrics
    "total_contract_value" numeric(15,2) NOT NULL DEFAULT 0,
    "total_invoiced" numeric(15,2) NOT NULL DEFAULT 0,
    "total_paid" numeric(15,2) NOT NULL DEFAULT 0,
    "remaining_balance" numeric(15,2) GENERATED ALWAYS AS (
        total_invoiced - total_paid
    ) STORED,
    -- Expense metrics
    "total_job_expenses" numeric(15,2) NOT NULL DEFAULT 0,
    "total_operating_expenses" numeric(15,2) NOT NULL DEFAULT 0,
    "total_cost" numeric(15,2) NOT NULL DEFAULT 0,
    -- Profit metrics
    "projected_profit" numeric(15,2) NOT NULL DEFAULT 0,
    "actual_profit" numeric(15,2) NOT NULL DEFAULT 0,
    "profitability_percentage" numeric(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN projected_profit > 0 THEN (actual_profit / projected_profit) * 100
            ELSE 0
        END
    ) STORED,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

-- Job financial summary table
CREATE TABLE IF NOT EXISTS "org"."job_financial_summary" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "job_id" uuid NOT NULL,
    "organization_id" uuid NOT NULL,
    "contract_value" numeric(15,2) NOT NULL,
    "total_invoiced" numeric(15,2) NOT NULL DEFAULT 0,
    "total_paid" numeric(15,2) NOT NULL DEFAULT 0,
    "outstanding_balance" numeric(15,2) GENERATED ALWAYS AS (
        total_invoiced - total_paid
    ) STORED,
    "vendors_owed" numeric(15,2) NOT NULL DEFAULT 0,
    "labor_paid_to_date" numeric(15,2) NOT NULL DEFAULT 0,
    "billing_completion_rate" numeric(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN contract_value > 0 
            THEN (total_invoiced / contract_value) * 100
            ELSE 0
        END
    ) STORED,
    "job_completion_rate" numeric(5,2),
    "profitability" numeric(5,2),
    "profit_margin" numeric(5,2),
    "total_profit" numeric(15,2) GENERATED ALWAYS AS (
        total_paid - (vendors_owed + labor_paid_to_date)
    ) STORED,
    "updated_at" timestamp DEFAULT now(),
    UNIQUE("job_id")
);

-- Financial cost categories table
CREATE TABLE IF NOT EXISTS "org"."financial_cost_categories" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "category_key" varchar(50) NOT NULL,
    "category_label" varchar(255) NOT NULL,
    "spent" numeric(15,2) NOT NULL DEFAULT 0,
    "budget" numeric(15,2) NOT NULL DEFAULT 0,
    "percent_of_total" numeric(5,2) NOT NULL DEFAULT 0,
    "status" varchar(20) NOT NULL DEFAULT 'on-track'
        CHECK (status IN ('on-track', 'warning', 'over')),
    "period_start" date NOT NULL,
    "period_end" date NOT NULL,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

-- Profit trend table
CREATE TABLE IF NOT EXISTS "org"."profit_trend" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "period" varchar(50) NOT NULL,
    "period_date" date NOT NULL,
    "revenue" numeric(15,2) NOT NULL DEFAULT 0,
    "expenses" numeric(15,2) NOT NULL DEFAULT 0,
    "profit" numeric(15,2) GENERATED ALWAYS AS (
        revenue - expenses
    ) STORED,
    "created_at" timestamp DEFAULT now()
);

-- Cash flow projection table
CREATE TABLE IF NOT EXISTS "org"."cash_flow_projection" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "projection_date" date NOT NULL,
    "period_start" date NOT NULL,
    "period_end" date NOT NULL,
    "projected_income" numeric(15,2) NOT NULL DEFAULT 0,
    "projected_expenses" numeric(15,2) NOT NULL DEFAULT 0,
    "net_cash_flow" numeric(15,2) GENERATED ALWAYS AS (
        projected_income - projected_expenses
    ) STORED,
    "pipeline_coverage_months" numeric(5,2) NOT NULL DEFAULT 0,
    "open_invoices_count" integer NOT NULL DEFAULT 0,
    "average_collection_days" integer NOT NULL DEFAULT 0,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

-- Cash flow scenarios table
CREATE TABLE IF NOT EXISTS "org"."cash_flow_scenarios" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "projection_id" uuid NOT NULL,
    "scenario_type" varchar(20) NOT NULL
        CHECK (scenario_type IN ('best', 'realistic', 'worst')),
    "label" varchar(255) NOT NULL,
    "description" text,
    "projected_income" numeric(15,2) NOT NULL DEFAULT 0,
    "projected_expenses" numeric(15,2) NOT NULL DEFAULT 0,
    "net_cash_flow" numeric(15,2) GENERATED ALWAYS AS (
        projected_income - projected_expenses
    ) STORED,
    "change_description" varchar(255),
    "created_at" timestamp DEFAULT now()
);

-- Revenue forecast table
CREATE TABLE IF NOT EXISTS "org"."revenue_forecast" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "month" varchar(10) NOT NULL,
    "month_date" date NOT NULL,
    "committed" numeric(15,2) NOT NULL DEFAULT 0,
    "pipeline" numeric(15,2) NOT NULL DEFAULT 0,
    "probability" numeric(5,4) NOT NULL DEFAULT 0,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

-- Financial reports table
CREATE TABLE IF NOT EXISTS "org"."financial_reports" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "report_key" varchar(50) NOT NULL,
    "title" varchar(255) NOT NULL,
    "description" text,
    "category" varchar(50) NOT NULL 
        CHECK (category IN ('Revenue', 'Expenses', 'Profitability', 'Vendors')),
    "report_config" jsonb,
    "updated_at" timestamp DEFAULT now(),
    "created_at" timestamp DEFAULT now(),
    UNIQUE("organization_id", "report_key")
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "org"."jobs" ADD CONSTRAINT "jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."financial_summary" ADD CONSTRAINT "financial_summary_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."job_financial_summary" ADD CONSTRAINT "job_financial_summary_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "org"."jobs"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."job_financial_summary" ADD CONSTRAINT "job_financial_summary_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."financial_cost_categories" ADD CONSTRAINT "financial_cost_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."profit_trend" ADD CONSTRAINT "profit_trend_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."cash_flow_projection" ADD CONSTRAINT "cash_flow_projection_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."cash_flow_scenarios" ADD CONSTRAINT "cash_flow_scenarios_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."cash_flow_scenarios" ADD CONSTRAINT "cash_flow_scenarios_projection_id_cash_flow_projection_id_fk" FOREIGN KEY ("projection_id") REFERENCES "org"."cash_flow_projection"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."revenue_forecast" ADD CONSTRAINT "revenue_forecast_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "org"."financial_reports" ADD CONSTRAINT "financial_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "org"."organizations"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_financial_summary_org_id" ON "org"."financial_summary"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_financial_summary_period" ON "org"."financial_summary"("period_start", "period_end");

CREATE INDEX IF NOT EXISTS "idx_job_financial_summary_job_id" ON "org"."job_financial_summary"("job_id");
CREATE INDEX IF NOT EXISTS "idx_job_financial_summary_org_id" ON "org"."job_financial_summary"("organization_id");

CREATE INDEX IF NOT EXISTS "idx_financial_cost_categories_org_id" ON "org"."financial_cost_categories"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_financial_cost_categories_period" ON "org"."financial_cost_categories"("period_start", "period_end");
CREATE INDEX IF NOT EXISTS "idx_financial_cost_categories_key" ON "org"."financial_cost_categories"("category_key");

CREATE INDEX IF NOT EXISTS "idx_profit_trend_org_id" ON "org"."profit_trend"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_profit_trend_period_date" ON "org"."profit_trend"("period_date");

CREATE INDEX IF NOT EXISTS "idx_cash_flow_projection_org_id" ON "org"."cash_flow_projection"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_cash_flow_projection_date" ON "org"."cash_flow_projection"("projection_date");

CREATE INDEX IF NOT EXISTS "idx_cash_flow_scenarios_org_id" ON "org"."cash_flow_scenarios"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_cash_flow_scenarios_projection_id" ON "org"."cash_flow_scenarios"("projection_id");

CREATE INDEX IF NOT EXISTS "idx_revenue_forecast_org_id" ON "org"."revenue_forecast"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_revenue_forecast_month_date" ON "org"."revenue_forecast"("month_date");

CREATE INDEX IF NOT EXISTS "idx_financial_reports_org_id" ON "org"."financial_reports"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_financial_reports_category" ON "org"."financial_reports"("category");
