ALTER TABLE "org"."bid_financial_breakdown" ADD COLUMN "actual_materials_equipment" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" ADD COLUMN "actual_labor" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" ADD COLUMN "actual_travel" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" ADD COLUMN "actual_operating_expenses" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" ADD COLUMN "actual_total_cost" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" ADD COLUMN "actual_total_price" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_financial_breakdown" ADD COLUMN "actual_gross_profit" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD COLUMN "actual_days" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD COLUMN "actual_hours_per_day" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD COLUMN "actual_total_hours" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD COLUMN "actual_cost_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD COLUMN "actual_billable_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD COLUMN "actual_total_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_labor" ADD COLUMN "actual_total_price" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_materials" ADD COLUMN "total_price" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_materials" ADD COLUMN "actual_quantity" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_materials" ADD COLUMN "actual_unit_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_materials" ADD COLUMN "actual_markup" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_materials" ADD COLUMN "actual_total_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_materials" ADD COLUMN "actual_total_price" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" ADD COLUMN "actual_current_bid_amount" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" ADD COLUMN "actual_calculated_operating_cost" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" ADD COLUMN "actual_inflation_adjusted_operating_cost" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" ADD COLUMN "actual_operating_price" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD COLUMN "actual_round_trip_miles" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD COLUMN "actual_mileage_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD COLUMN "actual_vehicle_day_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD COLUMN "actual_days" integer;--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD COLUMN "actual_mileage_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD COLUMN "actual_vehicle_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD COLUMN "actual_markup" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD COLUMN "actual_total_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_travel" ADD COLUMN "actual_total_price" numeric(15, 2);