-- Migration: 0013_add_conversation_search_indexes
-- 用途：優化機會列表搜尋功能的效能
-- Date: 2026-01-28

-- 1. case_number 索引（已存在 UNIQUE constraint，自動建立索引）
-- 不需要額外建立

-- 2. store_name 索引（用於搜尋）
-- 使用 partial index 排除 NULL 值，節省空間
CREATE INDEX IF NOT EXISTS idx_conversations_store_name
  ON conversations(store_name)
  WHERE store_name IS NOT NULL;

-- 3. opportunity_id + created_at 複合索引（用於取得最新 conversation）
CREATE INDEX IF NOT EXISTS idx_conversations_opp_created
  ON conversations(opportunity_id, created_at DESC);

-- 驗證索引建立
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'conversations'
  AND indexname LIKE 'idx_conversations%';
