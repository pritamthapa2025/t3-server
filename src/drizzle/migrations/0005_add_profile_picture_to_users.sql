DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'profile_picture') THEN
        ALTER TABLE "auth"."users" ADD COLUMN "profile_picture" varchar(500);
    END IF;
END $$;

