ALTER TABLE "notifications"."notification_cooldowns" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
