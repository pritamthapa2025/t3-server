ALTER TABLE "auth"."proposal_basis_templates" ALTER COLUMN "template" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "auth"."proposal_basis_templates" ADD COLUMN "job_type" varchar(100);--> statement-breakpoint
ALTER TABLE "auth"."proposal_basis_templates" ADD COLUMN "items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_proposal_basis_job_type" ON "auth"."proposal_basis_templates" USING btree ("job_type");