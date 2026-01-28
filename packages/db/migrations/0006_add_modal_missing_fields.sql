-- Migration: 0006_add_modal_missing_fields
-- 新增 Slack Modal 缺少的資料庫欄位
-- Date: 2026-01-28

-- ============================================================
-- 1. salesTodos 新增 remind_days 欄位
-- ============================================================
-- 用於儲存用戶選擇的提醒天數 (1/3/5/7/14)
ALTER TABLE sales_todos
ADD COLUMN IF NOT EXISTS remind_days INTEGER;

COMMENT ON COLUMN sales_todos.remind_days IS '用戶選擇的提醒天數 (1/3/5/7/14)';

-- ============================================================
-- 2. opportunities 新增 rejection_reason 欄位
-- ============================================================
-- 用於儲存拒絕/失敗原因（Close Case Modal）
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON COLUMN opportunities.rejection_reason IS '拒絕/失敗原因';

-- ============================================================
-- 3. opportunities 新增 selected_competitor 欄位
-- ============================================================
-- 用於儲存客戶選擇的競品（Close Case Modal）
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS selected_competitor TEXT;

COMMENT ON COLUMN opportunities.selected_competitor IS '客戶選擇的競品';

-- ============================================================
-- 驗證
-- ============================================================
-- 確認欄位已建立
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sales_todos' AND column_name = 'remind_days';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'opportunities' AND column_name IN ('rejection_reason', 'selected_competitor');
