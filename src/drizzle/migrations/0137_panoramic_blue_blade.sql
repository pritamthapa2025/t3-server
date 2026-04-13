ALTER TABLE "org"."bids" ADD COLUMN "proposal_basis_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "org"."bids" DROP COLUMN "proposal_basis";