-- Migration: Add wonAt and lostAt timestamps to opportunities table
-- Date: 2026-01-28
-- Description: 新增成交時間和拒絕時間欄位，向後相容

ALTER TABLE opportunities
ADD COLUMN won_at TIMESTAMP,
ADD COLUMN lost_at TIMESTAMP;

-- Add comments for documentation
COMMENT ON COLUMN opportunities.won_at IS '成交時間（當 status = won 時設定）';
COMMENT ON COLUMN opportunities.lost_at IS '拒絕時間（當 status = lost 時設定）';
