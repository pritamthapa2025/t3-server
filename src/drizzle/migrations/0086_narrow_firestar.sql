ALTER TABLE "org"."bid_design_build_files" ADD COLUMN "is_starred" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_documents" ADD COLUMN "is_starred" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_media" ADD COLUMN "is_starred" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."bid_plan_spec_files" ADD COLUMN "is_starred" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."client_documents" ADD COLUMN "is_starred" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."property_documents" ADD COLUMN "is_starred" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."vehicle_documents" ADD COLUMN "is_starred" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."vehicle_media" ADD COLUMN "is_starred" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."invoice_documents" ADD COLUMN "is_starred" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "org"."payment_documents" ADD COLUMN "is_starred" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX "idx_bid_design_build_files_starred" ON "org"."bid_design_build_files" USING btree ("is_starred");--> statement-breakpoint
CREATE INDEX "idx_bid_documents_starred" ON "org"."bid_documents" USING btree ("is_starred");--> statement-breakpoint
CREATE INDEX "idx_bid_media_starred" ON "org"."bid_media" USING btree ("is_starred");--> statement-breakpoint
CREATE INDEX "idx_bid_plan_spec_files_starred" ON "org"."bid_plan_spec_files" USING btree ("is_starred");--> statement-breakpoint
CREATE INDEX "idx_client_docs_starred" ON "org"."client_documents" USING btree ("is_starred");--> statement-breakpoint
CREATE INDEX "idx_property_docs_starred" ON "org"."property_documents" USING btree ("is_starred");--> statement-breakpoint
CREATE INDEX "idx_vehicle_documents_starred" ON "org"."vehicle_documents" USING btree ("is_starred");--> statement-breakpoint
CREATE INDEX "idx_vehicle_media_starred" ON "org"."vehicle_media" USING btree ("is_starred");--> statement-breakpoint
CREATE INDEX "idx_invoice_documents_starred" ON "org"."invoice_documents" USING btree ("is_starred");--> statement-breakpoint
CREATE INDEX "idx_payment_documents_starred" ON "org"."payment_documents" USING btree ("is_starred");