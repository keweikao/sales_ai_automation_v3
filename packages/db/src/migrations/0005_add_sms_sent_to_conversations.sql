-- Migration: Add SMS sent tracking to conversations
-- Date: 2026-01-20
-- Description: Add sms_sent and sms_sent_at fields to track SMS notifications

ALTER TABLE conversations
ADD COLUMN sms_sent BOOLEAN DEFAULT false,
ADD COLUMN sms_sent_at TIMESTAMP;

-- Add index for querying conversations with unsent SMS
CREATE INDEX idx_conversations_sms_sent ON conversations(sms_sent);

-- Comment the columns
COMMENT ON COLUMN conversations.sms_sent IS 'SMS 是否已發送給客戶';
COMMENT ON COLUMN conversations.sms_sent_at IS 'SMS 發送時間';
