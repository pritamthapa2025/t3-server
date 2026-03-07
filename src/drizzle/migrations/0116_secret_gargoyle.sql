ALTER TABLE "org"."bid_operating_expenses" ALTER COLUMN "inflation_rate" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" ALTER COLUMN "inflation_rate" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" ALTER COLUMN "utilization_percentage" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" ALTER COLUMN "utilization_percentage" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" ALTER COLUMN "markup_percentage" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "org"."bid_operating_expenses" ALTER COLUMN "markup_percentage" SET DEFAULT '0';