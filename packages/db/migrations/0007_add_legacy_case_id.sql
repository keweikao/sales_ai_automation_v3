-- Migration: Add legacy_case_id to conversations table
-- Description: 新增欄位保留 V2 原始 caseId（用於遷移追溯）

ALTER TABLE "conversations" ADD COLUMN "legacy_case_id" text;
