ALTER TABLE "org"."bid_design_build_data" RENAME COLUMN "design_fees" TO "design_price";--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "approval_milestones" text;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_revision_limit" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_design_build_data" ADD COLUMN "design_cost" numeric(15, 2) DEFAULT '0';