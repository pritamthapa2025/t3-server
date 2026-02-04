-- Add primary contact for ABC Company
-- This migration adds a primary contact to existing organizations that don't have one

-- Insert primary contact for ABC Company (if it exists)
DO $$
DECLARE
    abc_org_id uuid;
    contact_count integer;
BEGIN
    -- Get ABC Company's ID
    SELECT id INTO abc_org_id
    FROM org.organizations
    WHERE name = 'ABC Company'
    AND is_deleted = false
    LIMIT 1;

    -- Only proceed if ABC Company exists
    IF abc_org_id IS NOT NULL THEN
        -- Check if there's already a primary contact
        SELECT COUNT(*) INTO contact_count
        FROM org.client_contacts
        WHERE organization_id = abc_org_id
        AND is_primary = true
        AND is_deleted = false;

        -- If no primary contact exists, create one
        IF contact_count = 0 THEN
            -- Check if there are ANY existing contacts
            SELECT COUNT(*) INTO contact_count
            FROM org.client_contacts
            WHERE organization_id = abc_org_id
            AND is_deleted = false;

            IF contact_count > 0 THEN
                -- Update the first contact to be primary
                UPDATE org.client_contacts
                SET is_primary = true
                WHERE id = (
                    SELECT id
                    FROM org.client_contacts
                    WHERE organization_id = abc_org_id
                    AND is_deleted = false
                    ORDER BY created_at ASC
                    LIMIT 1
                );
                
                RAISE NOTICE 'Updated existing contact to be primary for ABC Company';
            ELSE
                -- No contacts exist, create a new primary contact
                INSERT INTO org.client_contacts (
                    organization_id,
                    full_name,
                    email,
                    phone,
                    title,
                    contact_type,
                    is_primary,
                    is_deleted
                ) VALUES (
                    abc_org_id,
                    'John Smith',
                    'john.smith@abccompany.com',
                    '(555) 123-4567',
                    'Operations Manager',
                    'primary',
                    true,
                    false
                );
                
                RAISE NOTICE 'Created new primary contact for ABC Company';
            END IF;
        ELSE
            RAISE NOTICE 'ABC Company already has a primary contact';
        END IF;
    ELSE
        RAISE NOTICE 'ABC Company not found, skipping primary contact creation';
    END IF;
END $$;

-- General fix: For any other organizations without a primary contact,
-- set their first contact (if any) to be primary
DO $$
DECLARE
    org_record RECORD;
    contact_count integer;
BEGIN
    -- Loop through all active organizations
    FOR org_record IN
        SELECT DISTINCT o.id, o.name
        FROM org.organizations o
        WHERE o.is_deleted = false
        AND NOT EXISTS (
            SELECT 1
            FROM org.client_contacts cc
            WHERE cc.organization_id = o.id
            AND cc.is_primary = true
            AND cc.is_deleted = false
        )
    LOOP
        -- Check if this org has any contacts
        SELECT COUNT(*) INTO contact_count
        FROM org.client_contacts
        WHERE organization_id = org_record.id
        AND is_deleted = false;

        -- If contacts exist, make the first one primary
        IF contact_count > 0 THEN
            UPDATE org.client_contacts
            SET is_primary = true
            WHERE id = (
                SELECT id
                FROM org.client_contacts
                WHERE organization_id = org_record.id
                AND is_deleted = false
                ORDER BY created_at ASC
                LIMIT 1
            );
            
            RAISE NOTICE 'Set primary contact for organization: %', org_record.name;
        END IF;
    END LOOP;
END $$;
