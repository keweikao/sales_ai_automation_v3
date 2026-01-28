-- Migration: 新增 competitor_analysis 欄位到 meddic_analyses 表
-- 用於儲存競品分析結果

ALTER TABLE "meddic_analyses"
ADD COLUMN IF NOT EXISTS "competitor_analysis" jsonb;

-- 新增註解說明欄位用途
COMMENT ON COLUMN "meddic_analyses"."competitor_analysis" IS '競品分析結果,包含偵測到的競品、威脅等級、應對建議等';
