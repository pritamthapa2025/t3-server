ALTER TABLE "org"."bids" ALTER COLUMN "title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bids" ALTER COLUMN "project_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_phase" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_start_date" date;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_completion_date" date;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_team_members" text;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "concept_description" text;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_deliverables" text;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "client_approval_required" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_fee_basis" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_fees" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "plans_received_date" date;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "plan_revision" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "plan_review_notes" text;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "specifications_received_date" date;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "specification_revision" varchar(100);--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "specification_review_notes" text;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "compliance_requirements" text;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "code_compliance_status" varchar(50);--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "addenda_received" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "addenda_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_data" ADD COLUMN "addenda_notes" text;--> statement-breakpoint
CREATE INDEX "idx_bid_design_build_bid_id" ON "org"."bid_design_build_data" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bid_plan_spec_bid_id" ON "org"."bid_plan_spec_data" USING btree ("bid_id");