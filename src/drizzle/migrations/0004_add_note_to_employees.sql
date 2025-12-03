DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'org' AND table_name = 'employees' AND column_name = 'note') THEN
        ALTER TABLE "org"."employees" ADD COLUMN "note" jsonb;
    END IF;
END $$;

