CREATE TABLE "org"."bid_document_tag_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_document_tag" UNIQUE("document_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "org"."bid_document_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bid_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_bid_document_tag_name_per_bid" UNIQUE("bid_id","name")
);
--> statement-breakpoint
ALTER TABLE "org"."bid_document_tag_links" ADD CONSTRAINT "bid_document_tag_links_document_id_bid_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "org"."bid_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_document_tag_links" ADD CONSTRAINT "bid_document_tag_links_tag_id_bid_document_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "org"."bid_document_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_document_tags" ADD CONSTRAINT "bid_document_tags_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bid_document_tag_links_document" ON "org"."bid_document_tag_links" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_bid_document_tag_links_tag" ON "org"."bid_document_tag_links" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_bid_document_tags_bid_id" ON "org"."bid_document_tags" USING btree ("bid_id");