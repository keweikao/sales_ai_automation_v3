-- Migration: Add Share Tokens Table
-- Date: 2026-01-21
-- Description: Add share_tokens table for public sharing functionality

CREATE TABLE IF NOT EXISTS "share_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"view_count" text DEFAULT '0' NOT NULL,
	"last_viewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "share_tokens_token_unique" UNIQUE("token")
);

-- Add foreign key constraint
ALTER TABLE "share_tokens"
ADD CONSTRAINT "share_tokens_conversation_id_conversations_id_fk"
FOREIGN KEY ("conversation_id")
REFERENCES "conversations"("id")
ON DELETE cascade;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS "idx_share_tokens_conversation_id" ON "share_tokens" ("conversation_id");
CREATE INDEX IF NOT EXISTS "idx_share_tokens_token" ON "share_tokens" ("token");

-- Add comments for documentation
COMMENT ON TABLE "share_tokens" IS '公開分享 Token 表格 - 用於生成不需登入即可查看的分享連結';
COMMENT ON COLUMN "share_tokens"."id" IS '主鍵 ID (使用 nanoid 生成)';
COMMENT ON COLUMN "share_tokens"."conversation_id" IS '關聯的對話 ID';
COMMENT ON COLUMN "share_tokens"."token" IS '加密 token，用於 URL';
COMMENT ON COLUMN "share_tokens"."expires_at" IS '過期時間（預設 14 天）';
COMMENT ON COLUMN "share_tokens"."is_revoked" IS '是否已撤銷';
COMMENT ON COLUMN "share_tokens"."view_count" IS '查看次數';
COMMENT ON COLUMN "share_tokens"."last_viewed_at" IS '最後查看時間';
