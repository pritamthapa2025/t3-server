CREATE INDEX "idx_dispatch_tasks_deleted_status" ON "org"."dispatch_tasks" USING btree ("is_deleted","status");--> statement-breakpoint
CREATE INDEX "idx_invoices_is_deleted_status" ON "org"."invoices" USING btree ("is_deleted","status");--> statement-breakpoint
CREATE INDEX "idx_jobs_is_deleted_status" ON "org"."jobs" USING btree ("is_deleted","status");--> statement-breakpoint
CREATE INDEX "idx_timesheets_deleted_date_status" ON "org"."timesheets" USING btree ("is_deleted","sheet_date","status");