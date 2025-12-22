-- Remove duplicate user_id entries before changing primary key
-- Keep only one role per user (the one with the lowest role_id, assuming lower IDs are more important)
DELETE FROM "auth"."user_roles" ur1
WHERE EXISTS (
  SELECT 1 FROM "auth"."user_roles" ur2
  WHERE ur2.user_id = ur1.user_id
  AND ur2.role_id < ur1.role_id
);--> statement-breakpoint

-- Drop the composite primary key
ALTER TABLE "auth"."user_roles" DROP CONSTRAINT "user_roles_user_id_role_id_pk";--> statement-breakpoint

-- Add primary key on user_id only (one user = one role)
ALTER TABLE "auth"."user_roles" ADD PRIMARY KEY ("user_id");