-- Migration: Add product_line column to support multi-product lines
-- Date: 2026-01-19
-- ⚠️ 注意: 使用 Drizzle ORM 命名慣例 (0003_)

-- Add product_line column to opportunities
ALTER TABLE opportunities
ADD COLUMN product_line TEXT DEFAULT 'ichef' NOT NULL;

-- Add product_line column to conversations
ALTER TABLE conversations
ADD COLUMN product_line TEXT DEFAULT 'ichef' NOT NULL;

-- Add product_line column to talk_tracks
ALTER TABLE talk_tracks
ADD COLUMN product_line TEXT DEFAULT 'ichef' NOT NULL;

-- Add product_line column to meddic_analyses
ALTER TABLE meddic_analyses
ADD COLUMN product_line TEXT DEFAULT 'ichef' NOT NULL;

-- Create indexes for better query performance
CREATE INDEX idx_opportunities_product_line ON opportunities(product_line);
CREATE INDEX idx_conversations_product_line ON conversations(product_line);
CREATE INDEX idx_talk_tracks_product_line ON talk_tracks(product_line);
CREATE INDEX idx_meddic_analyses_product_line ON meddic_analyses(product_line);

-- Comments
COMMENT ON COLUMN opportunities.product_line IS 'Product line identifier (ichef, beauty)';
COMMENT ON COLUMN conversations.product_line IS 'Product line identifier (ichef, beauty)';
COMMENT ON COLUMN talk_tracks.product_line IS 'Product line identifier (ichef, beauty)';
COMMENT ON COLUMN meddic_analyses.product_line IS 'Product line identifier (ichef, beauty)';
