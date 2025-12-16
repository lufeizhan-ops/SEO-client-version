-- ============================================
-- Client Edit and Draft Schema
-- ============================================
-- This schema supports:
-- 1. Direct editing of outlines and content by clients
-- 2. Draft saving for resumable reviews
-- 3. Multi-person collaboration
-- ============================================

-- ============================================
-- SECTION A: CLIENT_EDITS TABLE
-- ============================================
-- Stores edit suggestions from clients (Track Changes mode)

CREATE TABLE IF NOT EXISTS client_edits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    contact_email TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    
    -- 编辑类型：outline（大纲）或 content（内容）
    edit_type TEXT NOT NULL CHECK (edit_type IN ('outline', 'content')),
    
    -- 目标元素 ID（section id 或 block id）
    target_id TEXT NOT NULL,
    
    -- 编辑操作类型：modify（修改）、delete（删除）、add（添加）
    action_type TEXT NOT NULL CHECK (action_type IN ('modify', 'delete', 'add')),
    
    -- 原始内容（JSONB格式，用于冲突检测）
    original_content JSONB,
    
    -- 建议的新内容（JSONB格式）
    suggested_content JSONB,
    
    -- 状态：pending（待处理）、accepted（已接受）、rejected（已拒绝）
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_client_edits_article ON client_edits(article_id);
CREATE INDEX IF NOT EXISTS idx_client_edits_status ON client_edits(status);
CREATE INDEX IF NOT EXISTS idx_client_edits_contact ON client_edits(contact_email);
CREATE INDEX IF NOT EXISTS idx_client_edits_type ON client_edits(edit_type);

-- 禁用 RLS（开发阶段）
ALTER TABLE client_edits DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE client_edits TO public;

-- 注释
COMMENT ON TABLE client_edits IS 'Client edit suggestions for outlines and content (Track Changes mode)';
COMMENT ON COLUMN client_edits.edit_type IS 'Type of content being edited: outline or content';
COMMENT ON COLUMN client_edits.target_id IS 'ID of the section (outline) or block (content) being edited';
COMMENT ON COLUMN client_edits.action_type IS 'Type of edit: modify, delete, or add';
COMMENT ON COLUMN client_edits.original_content IS 'Original content before edit, stored for conflict detection';
COMMENT ON COLUMN client_edits.suggested_content IS 'Suggested new content from client';
COMMENT ON COLUMN client_edits.status IS 'Status of the edit suggestion: pending, accepted, or rejected';

-- ============================================
-- SECTION B: REVIEW_DRAFTS TABLE
-- ============================================
-- Stores draft state for resumable reviews

CREATE TABLE IF NOT EXISTS review_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    contact_email TEXT NOT NULL,
    
    -- 草稿类型：title（标题）、outline（大纲）、content（内容）
    review_type TEXT NOT NULL CHECK (review_type IN ('title', 'outline', 'content')),
    
    -- 草稿数据（JSONB格式）
    draft_edits JSONB DEFAULT '[]'::jsonb,      -- 编辑建议数组
    draft_comments JSONB DEFAULT '[]'::jsonb,   -- 评论数组
    draft_selections JSONB DEFAULT '{}'::jsonb, -- 其他选择状态（如标题选择）
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 唯一约束：一个联系人对一篇文章的同一类型审核只有一个草稿
DO $$ BEGIN
    ALTER TABLE review_drafts ADD CONSTRAINT review_drafts_unique 
        UNIQUE (article_id, contact_email, review_type);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 索引
CREATE INDEX IF NOT EXISTS idx_review_drafts_article ON review_drafts(article_id);
CREATE INDEX IF NOT EXISTS idx_review_drafts_contact ON review_drafts(contact_email);
CREATE INDEX IF NOT EXISTS idx_review_drafts_type ON review_drafts(review_type);

-- 禁用 RLS（开发阶段）
ALTER TABLE review_drafts DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE review_drafts TO public;

-- 注释
COMMENT ON TABLE review_drafts IS 'Draft state for resumable client reviews';
COMMENT ON COLUMN review_drafts.review_type IS 'Type of review: title, outline, or content';
COMMENT ON COLUMN review_drafts.draft_edits IS 'Array of edit suggestions saved in draft';
COMMENT ON COLUMN review_drafts.draft_comments IS 'Array of comments saved in draft';
COMMENT ON COLUMN review_drafts.draft_selections IS 'Additional selection state (e.g., selected titles)';

-- ============================================
-- SECTION C: AUTO-UPDATE TRIGGER
-- ============================================
-- Automatically update updated_at timestamp

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for client_edits
DROP TRIGGER IF EXISTS update_client_edits_modtime ON client_edits;
CREATE TRIGGER update_client_edits_modtime
    BEFORE UPDATE ON client_edits
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Trigger for review_drafts
DROP TRIGGER IF EXISTS update_review_drafts_modtime ON review_drafts;
CREATE TRIGGER update_review_drafts_modtime
    BEFORE UPDATE ON review_drafts
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- ============================================
-- SECTION D: CLEANUP FUNCTION
-- ============================================
-- Function to clean up old drafts (30 days)

CREATE OR REPLACE FUNCTION cleanup_old_drafts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM review_drafts
    WHERE updated_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_drafts() IS 'Deletes drafts older than 30 days. Returns count of deleted rows.';

-- ============================================
-- SECTION E: HELPER VIEWS
-- ============================================

-- View for pending edits by article
CREATE OR REPLACE VIEW pending_edits_by_article AS
SELECT 
    article_id,
    edit_type,
    COUNT(*) as edit_count,
    array_agg(DISTINCT contact_name) as editors
FROM client_edits
WHERE status = 'pending'
GROUP BY article_id, edit_type;

GRANT SELECT ON pending_edits_by_article TO public;

-- View for active reviewers (with drafts in last 24 hours)
CREATE OR REPLACE VIEW active_reviewers AS
SELECT 
    article_id,
    review_type,
    contact_email,
    updated_at
FROM review_drafts
WHERE updated_at > NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC;

GRANT SELECT ON active_reviewers TO public;

COMMENT ON VIEW pending_edits_by_article IS 'Shows count of pending edits per article';
COMMENT ON VIEW active_reviewers IS 'Shows users who have been actively reviewing in the last 24 hours';

