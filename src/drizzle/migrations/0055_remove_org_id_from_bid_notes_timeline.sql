-- Drop indexes that reference organization_id
DROP INDEX IF EXISTS org.idx_bid_timeline_org;
DROP INDEX IF EXISTS org.idx_bid_notes_org;

-- Drop organization_id column from bid_timeline
ALTER TABLE org.bid_timeline DROP COLUMN IF EXISTS organization_id;

-- Drop organization_id column from bid_notes
ALTER TABLE org.bid_notes DROP COLUMN IF EXISTS organization_id;
