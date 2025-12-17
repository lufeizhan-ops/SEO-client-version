-- ============================================
-- Database Migration: Add general_comments to review_drafts
-- ============================================
-- This migration adds support for general comments on entire articles
-- in both Outline Review and Content Review
-- ============================================

-- Add general_comments column to review_drafts table
ALTER TABLE review_drafts 
ADD COLUMN IF NOT EXISTS general_comments TEXT;

-- Add comment to document the new column
COMMENT ON COLUMN review_drafts.general_comments IS 'General feedback comments on the entire article (not tied to specific sections/blocks)';

-- Note: This is backwards compatible - existing rows will have NULL for this field
-- The application handles NULL as empty string


