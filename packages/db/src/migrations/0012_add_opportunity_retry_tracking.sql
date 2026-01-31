-- Migration: 0012_add_opportunity_retry_tracking
-- Description: Add retry_count and last_retry_at columns to opportunities table for Audio Repair Agent
-- Date: 2026-01-31

-- Add retry_count column to track number of retry attempts
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add last_retry_at column to track when the last retry was attempted
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP;

-- Add index for querying opportunities that need repair
-- (created_at older than threshold, no meddic_analyses, retry_count < max)
CREATE INDEX IF NOT EXISTS idx_opportunities_retry_candidates
ON opportunities (created_at, retry_count)
WHERE retry_count IS NULL OR retry_count < 2;
