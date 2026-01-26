-- 業務待辦事項表
CREATE TABLE IF NOT EXISTS "sales_todos" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "opportunity_id" text REFERENCES "opportunities"("id") ON DELETE SET NULL,
    "conversation_id" text REFERENCES "conversations"("id") ON DELETE SET NULL,
    "title" text NOT NULL,
    "description" text,
    "due_date" timestamp NOT NULL,
    "original_due_date" timestamp NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "completion_record" jsonb,
    "postpone_history" jsonb DEFAULT '[]'::jsonb,
    "cancellation_reason" text,
    "reminder_sent" boolean DEFAULT false,
    "reminder_sent_at" timestamp,
    "slack_message_ts" text,
    "source" text DEFAULT 'slack' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS "sales_todos_user_id_idx" ON "sales_todos" ("user_id");
CREATE INDEX IF NOT EXISTS "sales_todos_due_date_idx" ON "sales_todos" ("due_date");
CREATE INDEX IF NOT EXISTS "sales_todos_status_idx" ON "sales_todos" ("status");
CREATE INDEX IF NOT EXISTS "sales_todos_opportunity_id_idx" ON "sales_todos" ("opportunity_id");
