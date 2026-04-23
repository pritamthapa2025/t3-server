ALTER TABLE "org"."safety_inspections" ADD COLUMN "driver_side_exterior_photo" varchar(500);--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ADD COLUMN "passenger_side_exterior_photo" varchar(500);--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ADD COLUMN "driver_side_interior_photo" varchar(500);--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" ADD COLUMN "passenger_side_interior_photo" varchar(500);--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP COLUMN "exterior_photos";--> statement-breakpoint
ALTER TABLE "org"."safety_inspections" DROP COLUMN "interior_photos";