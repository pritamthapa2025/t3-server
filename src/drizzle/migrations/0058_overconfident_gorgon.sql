ALTER TABLE "org"."dispatch_tasks" DROP CONSTRAINT "dispatch_tasks_assigned_vehicle_id_vehicles_id_fk";
--> statement-breakpoint
DROP INDEX "org"."idx_dispatch_tasks_vehicle";--> statement-breakpoint
ALTER TABLE "org"."dispatch_tasks" DROP COLUMN "assigned_vehicle_id";