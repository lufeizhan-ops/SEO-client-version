-- ============================================
-- Supabase Schema Update for Two-Portal Integration
-- ============================================
-- This file contains updates to the existing schema to support
-- the interaction between Agency Portal and Client Portal
-- INCLUDING: Multi-client campaign support and email authentication
-- ============================================

-- ============================================
-- SECTION A: CONTACTS TABLE (for email-based authentication)
-- ============================================

-- Create contacts table for multiple contact persons per client
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint on email (globally unique)
DO $$ BEGIN
    ALTER TABLE contacts ADD CONSTRAINT contacts_email_unique UNIQUE (email);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add indexes for contacts
CREATE INDEX IF NOT EXISTS idx_contacts_client_id ON contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- Grant permissions
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE contacts TO public;

COMMENT ON TABLE contacts IS 'Contact persons for each client. Each client can have multiple contacts.';
COMMENT ON COLUMN contacts.email IS 'Email address used for Client Portal authentication.';

-- ============================================
-- SECTION B: CAMPAIGN_CLIENTS JUNCTION TABLE (many-to-many)
-- ============================================

-- Create junction table for campaigns and clients
CREATE TABLE IF NOT EXISTS campaign_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint
DO $$ BEGIN
    ALTER TABLE campaign_clients ADD CONSTRAINT campaign_clients_unique UNIQUE (campaign_id, client_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_campaign_clients_campaign ON campaign_clients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_clients_client ON campaign_clients(client_id);

-- Grant permissions
ALTER TABLE campaign_clients DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE campaign_clients TO public;

COMMENT ON TABLE campaign_clients IS 'Junction table for many-to-many relationship between campaigns and clients.';

-- ============================================
-- SECTION C: MIGRATE EXISTING DATA (if any)
-- ============================================

-- Migrate existing single-client relationships to junction table
INSERT INTO campaign_clients (campaign_id, client_id)
SELECT id, client_id FROM campaigns 
WHERE client_id IS NOT NULL
ON CONFLICT (campaign_id, client_id) DO NOTHING;

-- ============================================
-- SECTION D: ARTICLES TABLE UPDATES
-- ============================================

-- 1. Add missing fields to articles table
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS selected_title TEXT;

-- 2. Create status enum type (PostgreSQL native enum)
-- Note: If enum already exists, this will fail gracefully
DO $$ BEGIN
    CREATE TYPE article_status_enum AS ENUM (
        'NEEDS_TITLES',
        'AWAITING_REVIEW_TITLES',
        'TITLES_APPROVED',
        'NEEDS_OUTLINE',
        'AWAITING_REVIEW_OUTLINE',
        'OUTLINE_APPROVED',
        'NEEDS_DRAFT',
        'AWAITING_REVIEW_DRAFT',
        'DRAFT_APPROVED',
        'NEEDS_REVISION',
        'PUBLISHED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Add CHECK constraint for status field (if not using enum)
-- Alternative approach: Use CHECK constraint instead of enum
-- This allows more flexibility and doesn't require dropping/recreating the column
ALTER TABLE articles 
DROP CONSTRAINT IF EXISTS articles_status_check;

ALTER TABLE articles 
ADD CONSTRAINT articles_status_check 
CHECK (status IN (
    'NEEDS_TITLES',
    'AWAITING_REVIEW_TITLES',
    'TITLES_APPROVED',
    'NEEDS_OUTLINE',
    'AWAITING_REVIEW_OUTLINE',
    'OUTLINE_APPROVED',
    'NEEDS_DRAFT',
    'AWAITING_REVIEW_DRAFT',
    'DRAFT_APPROVED',
    'NEEDS_REVISION',
    'PUBLISHED'
));

-- 4. Add indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_campaign_id ON articles(campaign_id);
CREATE INDEX IF NOT EXISTS idx_articles_last_updated ON articles(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id);

-- 5. Create function to automatically update last_updated timestamp
CREATE OR REPLACE FUNCTION update_articles_last_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger to auto-update last_updated
DROP TRIGGER IF EXISTS trigger_update_articles_last_updated ON articles;

CREATE TRIGGER trigger_update_articles_last_updated
    BEFORE UPDATE ON articles
    FOR EACH ROW
    EXECUTE FUNCTION update_articles_last_updated();

-- 7. Add comment to status column for documentation
COMMENT ON COLUMN articles.status IS 'Article workflow status. Valid values: NEEDS_TITLES, AWAITING_REVIEW_TITLES, TITLES_APPROVED, NEEDS_OUTLINE, AWAITING_REVIEW_OUTLINE, OUTLINE_APPROVED, NEEDS_DRAFT, AWAITING_REVIEW_DRAFT, DRAFT_APPROVED, NEEDS_REVISION, PUBLISHED';

COMMENT ON COLUMN articles.client_comments IS 'JSONB array of client feedback comments. Structure: [{"id": "uuid", "author": "Client", "text": "comment text", "timestamp": "ISO date string"}]';

COMMENT ON COLUMN articles.selected_title IS 'The title selected by the client from proposed_titles array';

COMMENT ON COLUMN articles.last_updated IS 'Timestamp of last update to the article. Auto-updated by trigger.';

-- 8. Update existing NULL statuses to default value
UPDATE articles 
SET status = 'NEEDS_TITLES' 
WHERE status IS NULL;

-- 9. Set NOT NULL constraint on status (after updating NULLs)
ALTER TABLE articles 
ALTER COLUMN status SET NOT NULL;

-- 10. Create view for articles awaiting client review (optional, for easier querying)
CREATE OR REPLACE VIEW articles_awaiting_review AS
SELECT 
    a.id,
    a.title,
    a.status,
    a.campaign_id,
    c.name as campaign_name,
    cl.name as client_name,
    a.created_at,
    a.last_updated
FROM articles a
JOIN campaigns c ON a.campaign_id = c.id
JOIN clients cl ON c.client_id = cl.id
WHERE a.status IN (
    'AWAITING_REVIEW_TITLES',
    'AWAITING_REVIEW_OUTLINE',
    'AWAITING_REVIEW_DRAFT'
)
ORDER BY a.last_updated DESC;

-- 11. Grant permissions on view
GRANT SELECT ON articles_awaiting_review TO public;

-- 12. Add outline_sections field for structured outline data
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS outline_sections JSONB;

COMMENT ON COLUMN articles.outline_sections IS 
'Structured outline data. Format: [{"id": "uuid", "level": "H1|H2|H3", "title": "string", "description": "string", "wordCountEstimate": number}]';

-- ============================================
-- SECTION E: HELPER VIEWS FOR AUTHENTICATION
-- ============================================

-- View to check if an email has access to a campaign
CREATE OR REPLACE VIEW campaign_email_access AS
SELECT DISTINCT
    co.email,
    cc.campaign_id,
    c.name as campaign_name,
    cl.id as client_id,
    cl.name as client_name,
    co.name as contact_name
FROM contacts co
JOIN clients cl ON co.client_id = cl.id
JOIN campaign_clients cc ON cl.id = cc.client_id
JOIN campaigns c ON cc.campaign_id = c.id;

GRANT SELECT ON campaign_email_access TO public;

-- ============================================
-- VERIFICATION QUERIES (run manually to verify)
-- ============================================
-- SELECT * FROM contacts;
-- SELECT * FROM campaign_clients;
-- SELECT * FROM campaign_email_access WHERE email = 'test@example.com';

