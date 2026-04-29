DROP TABLE "org"."bid_document_tag_links" CASCADE;--> statement-breakpoint
DROP TABLE "org"."bid_document_tags" CASCADE;--> statement-breakpoint
ALTER TABLE "org"."bid_documents" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_media" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bid_walk_photos" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;