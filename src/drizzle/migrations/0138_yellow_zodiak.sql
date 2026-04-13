ALTER TABLE "org"."bids" ADD COLUMN "google_calendar_end_date_event_id" varchar(512);--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "google_calendar_end_date_owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."dispatch_assignments" ADD COLUMN "google_calendar_event_id" varchar(512);--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_google_calendar_end_date_owner_user_id_users_id_fk" FOREIGN KEY ("google_calendar_end_date_owner_user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;