-- 新增 Follow-up 追蹤欄位到 conversations 表
-- 用於追蹤業務是否已設定 follow-up 待辦或標記拒絕

ALTER TABLE "conversations"
ADD COLUMN "follow_up_status" text,
ADD COLUMN "follow_up_set_at" timestamp;

-- 可選：為現有已完成的 conversations 設定預設值（舊資料保持 null）
-- COMMENT: follow_up_status 可能的值:
-- null = 舊資料（遷移前）
-- "pending" = 音檔已上傳，尚未設定 follow-up
-- "created" = 已建立 follow-up 待辦
-- "rejected" = 已標記客戶拒絕
