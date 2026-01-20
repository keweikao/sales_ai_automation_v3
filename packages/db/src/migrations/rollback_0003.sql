-- Rollback for 0003_add_product_line.sql
-- ⚠️ 緊急情況使用

-- Drop indexes
DROP INDEX IF EXISTS idx_opportunities_product_line;
DROP INDEX IF EXISTS idx_conversations_product_line;
DROP INDEX IF EXISTS idx_talk_tracks_product_line;
DROP INDEX IF EXISTS idx_meddic_analyses_product_line;

-- Drop columns
ALTER TABLE opportunities DROP COLUMN IF EXISTS product_line;
ALTER TABLE conversations DROP COLUMN IF EXISTS product_line;
ALTER TABLE talk_tracks DROP COLUMN IF EXISTS product_line;
ALTER TABLE meddic_analyses DROP COLUMN IF EXISTS product_line;
