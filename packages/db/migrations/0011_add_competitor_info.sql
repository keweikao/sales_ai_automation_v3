-- Migration: 建立競品資訊表
-- Date: 2026-01-28
-- Description: 建立 competitor_info 表用於儲存競品知識庫資料

-- 建立競品資訊表
CREATE TABLE IF NOT EXISTS "competitor_info" (
  "id" text PRIMARY KEY NOT NULL,
  "competitor_name" text NOT NULL UNIQUE,
  "strengths" jsonb,
  "weaknesses" jsonb,
  "our_advantages" jsonb,
  "counter_talk_tracks" jsonb,
  "switching_cases" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 建立索引加速查詢（用於模糊匹配）
CREATE INDEX IF NOT EXISTS "competitor_info_name_idx" ON "competitor_info" ("competitor_name");

-- 新增註解
COMMENT ON TABLE "competitor_info" IS '競品資訊表，儲存競品優劣勢、我方優勢、反制話術等';
COMMENT ON COLUMN "competitor_info"."competitor_name" IS '競品名稱（唯一）';
COMMENT ON COLUMN "competitor_info"."strengths" IS '競品優勢（JSONB 陣列）';
COMMENT ON COLUMN "competitor_info"."weaknesses" IS '競品弱點（JSONB 陣列）';
COMMENT ON COLUMN "competitor_info"."our_advantages" IS '我方優勢（JSONB 陣列）';
COMMENT ON COLUMN "competitor_info"."counter_talk_tracks" IS '反制話術（JSONB 陣列）';
COMMENT ON COLUMN "competitor_info"."switching_cases" IS '客戶轉換案例（JSONB 陣列）';
