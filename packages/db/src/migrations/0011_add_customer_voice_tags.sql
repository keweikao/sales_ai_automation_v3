-- Migration: 0011_add_customer_voice_tags
-- Description: 新增客戶聲音標籤表和每日摘要表

-- 客戶聲音標籤表
CREATE TABLE IF NOT EXISTS customer_voice_tags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  opportunity_id TEXT REFERENCES opportunities(id),
  product_line TEXT NOT NULL DEFAULT 'ichef',

  -- 功能需求標籤
  features_mentioned JSONB DEFAULT '[]',
  -- [{ tag, category, quotes, count, source }]

  -- 痛點標籤
  pain_tags JSONB DEFAULT '[]',
  -- [{ tag, severity, quotes, is_quantified, source }]

  -- 異議標籤
  objection_tags JSONB DEFAULT '[]',
  -- [{ tag, quotes, source }]

  -- 競品提及
  competitor_mentions JSONB DEFAULT '[]',
  -- [{ name, sentiment, quotes, source }]

  -- 決策因素
  decision_factors JSONB DEFAULT '[]',
  -- [{ tag, importance, quotes, source }]

  -- 處理統計
  total_sentences INTEGER DEFAULT 0,
  rule_matched_count INTEGER DEFAULT 0,
  ai_processed_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,

  -- 元資料
  conversation_date DATE NOT NULL,
  sales_rep_id TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_tags_conversation ON customer_voice_tags(conversation_id);
CREATE INDEX IF NOT EXISTS idx_voice_tags_date ON customer_voice_tags(conversation_date);
CREATE INDEX IF NOT EXISTS idx_voice_tags_product ON customer_voice_tags(product_line);
CREATE INDEX IF NOT EXISTS idx_voice_tags_rep ON customer_voice_tags(sales_rep_id);

-- GIN 索引支援 JSONB 查詢
CREATE INDEX IF NOT EXISTS idx_voice_tags_features ON customer_voice_tags USING GIN (features_mentioned);
CREATE INDEX IF NOT EXISTS idx_voice_tags_pains ON customer_voice_tags USING GIN (pain_tags);

-- 每日聲音摘要表
CREATE TABLE IF NOT EXISTS daily_voice_summary (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_date DATE NOT NULL,
  product_line TEXT NOT NULL DEFAULT 'ichef',

  -- 聚合統計
  top_features JSONB DEFAULT '[]',
  -- [{ tag, count, unique_conversations, sample_quotes }]

  top_pain_points JSONB DEFAULT '[]',
  -- [{ tag, count, avg_severity, sample_quotes }]

  top_objections JSONB DEFAULT '[]',
  -- [{ tag, count, sample_quotes }]

  competitor_stats JSONB DEFAULT '[]',
  -- [{ name, count, sentiment_breakdown }]

  -- 處理統計
  total_conversations INTEGER DEFAULT 0,
  total_sentences_processed INTEGER DEFAULT 0,
  ai_calls_made INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 每日摘要索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_summary_date_product ON daily_voice_summary(summary_date, product_line);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_voice_summary(summary_date);
