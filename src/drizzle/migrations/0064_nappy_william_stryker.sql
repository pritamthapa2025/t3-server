ALTER TABLE "org"."bids" ADD COLUMN "primary_contact_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD COLUMN "property_id" uuid;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_primary_contact_id_client_contacts_id_fk" FOREIGN KEY ("primary_contact_id") REFERENCES "org"."client_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bids" ADD CONSTRAINT "bids_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "org"."properties"("id") ON DELETE no action ON UPDATE no action;