CREATE TABLE "org"."bid_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bid_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_url" varchar(500),
	"file_type" varchar(50),
	"file_size" integer,
	"media_type" varchar(50),
	"thumbnail_path" varchar(500),
	"thumbnail_url" varchar(500),
	"caption" text,
	"uploaded_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "org"."bid_media" ADD CONSTRAINT "bid_media_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "org"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org"."bid_media" ADD CONSTRAINT "bid_media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bid_media_bid_id" ON "org"."bid_media" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_bid_media_type" ON "org"."bid_media" USING btree ("media_type");--> statement-breakpoint
CREATE INDEX "idx_bid_media_uploaded_by" ON "org"."bid_media" USING btree ("uploaded_by");