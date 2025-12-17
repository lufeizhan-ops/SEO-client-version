-- ============================================
-- Database Migration: Add Revision History Support
-- ============================================
-- This migration adds support for tracking multiple rounds of revisions
-- and preserving comment history across review cycles
-- ============================================

-- Add revision_history field to articles table
-- This will store an array of all previous client_comments
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS revision_history JSONB DEFAULT '[]'::jsonb;

-- Add revision_round field to track which round of revisions we're in
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS revision_round INTEGER DEFAULT 1;

-- Add comment to document the new columns
COMMENT ON COLUMN articles.revision_history IS 'Array of all previous client review submissions (client_comments history)';
COMMENT ON COLUMN articles.revision_round IS 'Current revision round number (1 = first review, 2 = first revision, etc.)';

-- Note: This is backwards compatible - existing rows will have empty array for revision_history and 1 for revision_round


