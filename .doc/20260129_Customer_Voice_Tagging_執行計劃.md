# 2026-01-29 Customer Voice Tagging 執行計劃

**日期**: 2026-01-29
**類型**: 功能開發
**優先級**: 高
**預估工時**: 1.5 個工作天

---

## 目標

建立自動化的客戶聲音標籤系統，每日批次處理已分析的對話，提取並分類客戶提到的：
- 功能需求
- 痛點
- 異議
- 競品提及

供週報聚合分析，產出市場洞察。

---

## 架構設計

```
每日 00:30 (UTC+8)
┌─────────────────────────────────────────────────────────────┐
│                   Cron: Voice Tagging Job                    │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ 1. 撈取昨日   │ → │ 2. 分類處理   │ → │ 3. 儲存結果   │   │
│  │   已分析對話  │    │              │    │              │   │
│  └──────────────┘    └──────┬───────┘    └──────────────┘   │
│                             │                                │
│                    ┌────────┴────────┐                      │
│                    ▼                 ▼                      │
│             ┌───────────┐     ┌───────────┐                 │
│             │ 規則匹配   │     │ AI 補強   │                 │
│             │ (免費)    │     │ (Gemini)  │                 │
│             └───────────┘     └───────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  每週一 08:00     │
                    │  週報整合輸出     │
                    └──────────────────┘
```

---

## 技術選型

### AI 模型

| 項目 | 選擇 | 原因 |
|------|------|------|
| **模型** | `gemini-2.5-flash-lite` | 成本最低 ($0.10/$0.40 per M tokens)，足夠處理標籤任務 |
| **備選** | `gemini-2.5-flash` | 若 lite 品質不足可升級 |
| **現有整合** | `packages/services/src/llm/gemini.ts` | 已有完整的 GeminiClient 實作 |

### 成本估算

| 項目 | 數值 |
|------|------|
| 每日對話數 | ~20-50 筆 |
| 每筆送 AI 句子 | ~5-10 句 (不確定的) |
| 每句平均 token | ~50 input + 30 output |
| 每日 token 用量 | ~20,000 input + 12,000 output |
| 每日成本 | ~$0.002 + $0.005 = **$0.007** |
| 每月成本 | **~$0.21** |

---

## 資料庫設計

### 新增表：customer_voice_tags

```sql
CREATE TABLE customer_voice_tags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  opportunity_id TEXT,
  product_line TEXT NOT NULL DEFAULT 'ichef',

  -- 功能需求標籤
  features_mentioned JSONB DEFAULT '[]',
  -- [{ tag, category, sentiment, quotes, count, source }]

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
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(conversation_id)
);

-- 索引
CREATE INDEX idx_voice_tags_date ON customer_voice_tags(conversation_date);
CREATE INDEX idx_voice_tags_product ON customer_voice_tags(product_line);
CREATE INDEX idx_voice_tags_rep ON customer_voice_tags(sales_rep_id);

-- GIN 索引支援 JSONB 查詢
CREATE INDEX idx_voice_tags_features ON customer_voice_tags USING GIN (features_mentioned);
CREATE INDEX idx_voice_tags_pains ON customer_voice_tags USING GIN (pain_tags);
```

### 新增表：daily_voice_summary

```sql
CREATE TABLE daily_voice_summary (
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

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(summary_date, product_line)
);

CREATE INDEX idx_daily_summary_date ON daily_voice_summary(summary_date);
```

---

## 標籤字典設計

### 檔案結構

```
packages/services/src/nlp/
├── dictionaries/
│   ├── ichef.ts          # iCHEF 標籤字典
│   ├── beauty.ts         # 美業標籤字典
│   └── common.ts         # 共用模式（異議、情緒詞等）
├── voice-tagger.ts       # 核心標籤邏輯
├── sentence-classifier.ts # 句子分類器
└── index.ts              # 導出
```

### iCHEF 標籤字典 (dictionaries/ichef.ts)

```typescript
export const ICHEF_FEATURE_TAGS = {
  // 核心功能
  pos_basic: {
    keywords: ["收銀", "結帳", "POS", "點餐", "買單", "開單"],
    category: "核心功能",
  },
  order_management: {
    keywords: ["訂單", "出單", "廚房", "KDS", "列印", "叫號", "出餐"],
    category: "核心功能",
  },
  inventory: {
    keywords: ["庫存", "進貨", "盤點", "原物料", "進銷存", "採購"],
    category: "核心功能",
  },
  reporting: {
    keywords: ["報表", "營收", "分析", "數據", "統計", "業績", "營業額"],
    category: "報表",
  },

  // 整合功能
  delivery_integration: {
    keywords: ["外送", "Uber", "UberEats", "foodpanda", "熊貓", "接單", "外送平台", "外帶"],
    category: "整合",
  },
  payment: {
    keywords: ["行動支付", "Line Pay", "街口", "刷卡", "Apple Pay", "悠遊付", "信用卡", "支付"],
    category: "整合",
  },
  einvoice: {
    keywords: ["電子發票", "載具", "歸戶", "發票", "雲端發票", "統編"],
    category: "整合",
  },

  // 管理功能
  staff_management: {
    keywords: ["員工", "排班", "打卡", "權限", "薪資", "人事"],
    category: "管理",
  },
  multi_store: {
    keywords: ["分店", "總部", "多店", "連鎖", "跨店", "總公司"],
    category: "管理",
  },
  crm: {
    keywords: ["會員", "集點", "儲值", "回購", "顧客", "VIP", "熟客", "常客"],
    category: "行銷",
  },
  reservation: {
    keywords: ["訂位", "預約", "候位", "排隊", "預訂"],
    category: "整合",
  },

  // 進階功能
  table_management: {
    keywords: ["桌位", "座位", "翻桌", "桌號", "併桌", "換桌"],
    category: "核心功能",
  },
  menu_management: {
    keywords: ["菜單", "品項", "套餐", "加購", "客製化", "口味"],
    category: "核心功能",
  },
};

export const ICHEF_PAIN_TAGS = {
  manual_reconciliation: {
    keywords: ["對帳", "核帳", "算帳", "帳對不起來", "差額", "收支"],
    severity_boost: ["每天", "花很久", "好幾個小時", "很累", "對到很晚"],
  },
  order_errors: {
    keywords: ["漏單", "錯單", "出錯", "送錯", "key錯", "打錯", "少做"],
    severity_boost: ["常常", "一直", "每次", "客人罵", "客訴"],
  },
  slow_service: {
    keywords: ["很慢", "等很久", "排隊", "來不及", "忙不過來", "塞住"],
    severity_boost: ["客人抱怨", "客人罵", "尖峰", "午餐"],
  },
  staff_training: {
    keywords: ["教不會", "新人", "流動率", "離職", "不會用", "學很久"],
    severity_boost: ["每次", "一直", "又要教"],
  },
  data_management: {
    keywords: ["資料", "找不到", "沒記錄", "不知道", "查不到", "忘記"],
    severity_boost: ["重要", "客人問", "老闆要"],
  },
  manual_input: {
    keywords: ["手動", "手key", "手寫", "紙本", "抄", "登記"],
    severity_boost: ["每筆", "全部", "很多"],
  },
  system_issues: {
    keywords: ["當機", "卡住", "跑很慢", "不穩", "斷線", "連不上"],
    severity_boost: ["常常", "一直", "尖峰時"],
  },
};

export const ICHEF_COMPETITORS = {
  "肚肚": ["肚肚", "dudu", "DUDU", "Dudu"],
  "Eats365": ["eats365", "Eats365", "EATS365", "365"],
  "微碧": ["微碧", "weiby", "WEIBY", "Weiby"],
  "客立樂": ["客立樂", "KLOOK", "klook"],
  "POS365": ["pos365", "POS365"],
  "快一點": ["快一點", "kuaiyidian"],
  "饗賓": ["饗賓", "inwin"],
  "振樺": ["振樺", "posiflex"],
  "NEC": ["NEC", "nec"],
};
```

### 共用模式 (dictionaries/common.ts)

```typescript
// 異議標籤 - 所有產品線共用
export const OBJECTION_TAGS = {
  price: {
    keywords: ["太貴", "預算", "成本", "便宜", "划不划算", "值不值得", "CP值", "價格"],
  },
  switching_cost: {
    keywords: ["很麻煩", "要重來", "資料搬", "員工學", "習慣了", "適應", "轉換"],
  },
  timing: {
    keywords: ["現在不行", "等一下", "過完年", "之後再說", "忙季", "淡季", "年底"],
  },
  authority: {
    keywords: ["問老闆", "做不了主", "要討論", "股東", "合夥人", "老婆", "家人"],
  },
  competitor_preference: {
    keywords: ["已經用", "在比較", "別人", "其他家", "朋友推薦", "比較看看"],
  },
  trust: {
    keywords: ["不確定", "怕", "擔心", "萬一", "保障", "售後"],
  },
};

// 「看起來重要」的啟發式模式
export const IMPORTANCE_PATTERNS = {
  // 描述客戶行為/需求
  customer_need: [
    /客人(問|說|要|想|希望|反應|抱怨|建議)/,
    /有沒有.*(功能|辦法|方式|可以)/,
    /可不可以/,
    /能不能/,
    /怎麼.*[？?]/,
    /如果.*就好了/,
    /希望/,
    /需要/,
    /想要/,
  ],

  // 外部平台提及
  external_platform: [
    /LINE|FB|Facebook|IG|Instagram|Google|Uber|foodpanda/i,
    /蝦皮|PChome|momo|Yahoo/,
    /Excel|Word|紙本|手寫/,
  ],

  // 問題情境
  problem_context: [
    /常常/,
    /每次/,
    /都會/,
    /一直/,
    /很麻煩/,
    /不知道/,
    /找不到/,
    /忘記/,
    /來不及/,
  ],

  // 量化描述
  quantification: /\d+[次小時分鐘天週月年萬元塊%筆個位]/,

  // 情緒強烈
  strong_emotion: [
    /很|超|太|非常|真的|實在/,
    /煩|累|痛苦|受不了|頭痛|崩潰/,
    /爽|讚|方便|省|快/,
  ],
};

// 回應詞（應跳過）
export const SKIP_PATTERNS = {
  response_words: ["好", "嗯", "對", "是", "OK", "了解", "知道了", "謝謝", "好的", "沒問題"],
  min_length: 6,
  max_length: 150,
};
```

---

## 核心處理邏輯

### 句子分類器 (sentence-classifier.ts)

```typescript
import { IMPORTANCE_PATTERNS, SKIP_PATTERNS } from "./dictionaries/common";

export type SentenceStatus = "matched" | "uncertain" | "skip";
export type UncertainReason =
  | "customer_need"
  | "external_platform"
  | "problem_context"
  | "quantified"
  | "strong_emotion"
  | "general_important";

export interface ClassifiedSentence {
  sentence: string;
  status: SentenceStatus;
  matchedTags?: Array<{ category: string; tag: string }>;
  uncertainReason?: UncertainReason;
  skipReason?: string;
}

export function classifySentence(
  sentence: string,
  ruleMatches: Array<{ category: string; tag: string }>
): ClassifiedSentence {
  const trimmed = sentence.trim();

  // 1. 太短或太長
  if (trimmed.length < SKIP_PATTERNS.min_length) {
    return { sentence, status: "skip", skipReason: "too_short" };
  }
  if (trimmed.length > SKIP_PATTERNS.max_length) {
    return { sentence, status: "skip", skipReason: "too_long" };
  }

  // 2. 純回應詞
  if (SKIP_PATTERNS.response_words.includes(trimmed)) {
    return { sentence, status: "skip", skipReason: "response_word" };
  }

  // 3. 有規則匹配
  if (ruleMatches.length > 0) {
    return { sentence, status: "matched", matchedTags: ruleMatches };
  }

  // 4. 判斷是否「看起來重要」
  const uncertainReason = detectUncertainReason(trimmed);
  if (uncertainReason) {
    return { sentence, status: "uncertain", uncertainReason };
  }

  // 5. 不重要
  return { sentence, status: "skip", skipReason: "not_important" };
}

function detectUncertainReason(sentence: string): UncertainReason | null {
  // 檢查各種重要模式
  for (const pattern of IMPORTANCE_PATTERNS.customer_need) {
    if (pattern.test(sentence)) return "customer_need";
  }

  for (const pattern of IMPORTANCE_PATTERNS.external_platform) {
    if (pattern.test(sentence)) return "external_platform";
  }

  for (const pattern of IMPORTANCE_PATTERNS.problem_context) {
    if (pattern.test(sentence)) return "problem_context";
  }

  if (IMPORTANCE_PATTERNS.quantification.test(sentence)) {
    return "quantified";
  }

  for (const pattern of IMPORTANCE_PATTERNS.strong_emotion) {
    if (pattern.test(sentence)) return "strong_emotion";
  }

  return null;
}
```

### AI 標籤處理 (voice-tagger.ts)

```typescript
import { GeminiClient } from "../llm/gemini";
import type { ClassifiedSentence, UncertainReason } from "./sentence-classifier";

interface AITagResult {
  index: number;
  tags: Array<{
    category: "feature" | "pain" | "objection" | "competitor";
    tag: string;
    confidence: number;
  }>;
  implicit_need?: string;
  severity?: "critical" | "high" | "medium" | "low";
}

export async function processUncertainWithAI(
  sentences: Array<{ sentence: string; reason: UncertainReason }>,
  productLine: "ichef" | "beauty",
  geminiApiKey: string
): Promise<AITagResult[]> {
  if (sentences.length === 0) return [];

  const client = new GeminiClient(geminiApiKey);

  // 根據產品線取得標籤列表
  const tagList = productLine === "ichef"
    ? ICHEF_TAG_LIST
    : BEAUTY_TAG_LIST;

  const prompt = buildAIPrompt(sentences, tagList);

  try {
    const result = await client.generateJSON<AITagResult[]>(prompt, {
      model: "gemini-2.5-flash-lite", // 使用最經濟的模型
      temperature: 0.2,
      maxTokens: 2048,
    });

    return result;
  } catch (error) {
    console.error("[VoiceTagger] AI processing failed:", error);
    return [];
  }
}

function buildAIPrompt(
  sentences: Array<{ sentence: string; reason: UncertainReason }>,
  tagList: string
): string {
  const contextHints: Record<UncertainReason, string> = {
    customer_need: "這些句子描述了客戶/顧客的行為或需求",
    external_platform: "這些句子提到了外部平台，可能暗示整合需求",
    problem_context: "這些句子描述了重複發生的問題",
    quantified: "這些句子包含數字，可能是量化的痛點",
    strong_emotion: "這些句子包含情緒詞，注意判斷正負面",
    general_important: "這些句子可能包含重要的客戶洞察",
  };

  // 按原因分組提示
  const reasonGroups = groupBy(sentences, s => s.reason);
  const hints = Object.entries(reasonGroups)
    .map(([reason, items]) => `- ${contextHints[reason as UncertainReason]} (${items.length}句)`)
    .join("\n");

  return `你是餐飲/美業 POS 系統的客戶需求分析專家。分析以下客戶語句，提取標籤。

## 分析提示
${hints}

## 可用標籤
${tagList}

## 客戶語句
${sentences.map((s, i) => `${i + 1}. 「${s.sentence}」`).join("\n")}

## 輸出規則
1. 只輸出有把握的標籤 (confidence >= 0.6)
2. 若句子暗示需求但沒明說，填寫 implicit_need
3. 若是痛點，評估 severity
4. 若無法判斷，該句子回傳空 tags 陣列

## 輸出 JSON 格式
[
  {
    "index": 1,
    "tags": [
      { "category": "feature", "tag": "crm", "confidence": 0.8 }
    ],
    "implicit_need": "會員管理系統",
    "severity": null
  }
]`;
}

const ICHEF_TAG_LIST = `功能 (feature):
- pos_basic: 收銀/結帳/點餐
- order_management: 訂單/出單/廚房
- inventory: 庫存/盤點
- reporting: 報表/分析/數據
- delivery_integration: 外送整合
- payment: 行動支付
- einvoice: 電子發票
- staff_management: 員工管理
- multi_store: 多店/連鎖
- crm: 會員/集點/儲值
- reservation: 訂位/預約
- table_management: 桌位管理
- menu_management: 菜單管理

痛點 (pain):
- manual_reconciliation: 對帳困難
- order_errors: 訂單錯誤
- slow_service: 服務太慢
- staff_training: 員工訓練困難
- data_management: 資料管理問題
- manual_input: 手動輸入繁瑣
- system_issues: 系統不穩定

異議 (objection):
- price: 價格疑慮
- switching_cost: 轉換成本
- timing: 時機不對
- authority: 決策權限
- competitor_preference: 偏好競品
- trust: 信任疑慮`;
```

---

## Cron Handler 實作

### wrangler.toml 更新

```toml
[triggers]
crons = [
  "0 0 * * *",     # 每日 08:00 (UTC+8) - 健康報告
  "0 0 * * 1",     # 每週一 08:00 (UTC+8) - 週報
  "0 1 * * *",     # 每日 09:00 (UTC+8) - Todo 提醒
  "30 16 * * *",   # 每日 00:30 (UTC+8) - Voice Tagging ← 新增
]
```

### Handler 邏輯

```typescript
// apps/queue-worker/src/handlers/voice-tagging.ts

export async function handleDailyVoiceTagging(env: Env): Promise<void> {
  const startTime = Date.now();
  console.log("[VoiceTagging] Starting daily voice tagging...");

  const sql = neon(env.DATABASE_URL);

  // 1. 撈取昨日已分析的對話
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0];

  const conversations = await sql`
    SELECT
      c.id,
      c.transcript,
      c.opportunity_id,
      c.product_line,
      c.created_by as sales_rep_id,
      c.conversation_date
    FROM conversations c
    LEFT JOIN customer_voice_tags cvt ON cvt.conversation_id = c.id
    WHERE c.status = 'completed'
      AND c.analyzed_at::date = ${dateStr}::date
      AND c.transcript IS NOT NULL
      AND cvt.id IS NULL  -- 尚未處理過
  `;

  if (conversations.length === 0) {
    console.log("[VoiceTagging] No new conversations to process");
    return;
  }

  console.log(`[VoiceTagging] Processing ${conversations.length} conversations`);

  // 統計
  let totalAICalls = 0;
  let totalSentences = 0;

  // 2. 批次處理
  for (const conv of conversations) {
    try {
      const result = await processConversation(conv, env);
      totalAICalls += result.aiCalls;
      totalSentences += result.totalSentences;

      // 儲存結果
      await sql`
        INSERT INTO customer_voice_tags (
          id, conversation_id, opportunity_id, product_line,
          features_mentioned, pain_tags, objection_tags,
          competitor_mentions, decision_factors,
          total_sentences, rule_matched_count, ai_processed_count, skipped_count,
          conversation_date, sales_rep_id, processing_time_ms
        ) VALUES (
          ${crypto.randomUUID()},
          ${conv.id},
          ${conv.opportunity_id},
          ${conv.product_line || "ichef"},
          ${JSON.stringify(result.features)},
          ${JSON.stringify(result.pains)},
          ${JSON.stringify(result.objections)},
          ${JSON.stringify(result.competitors)},
          ${JSON.stringify(result.decisionFactors)},
          ${result.totalSentences},
          ${result.ruleMatched},
          ${result.aiProcessed},
          ${result.skipped},
          ${conv.conversation_date || dateStr},
          ${conv.sales_rep_id},
          ${result.processingTime}
        )
      `;
    } catch (error) {
      console.error(`[VoiceTagging] Failed to process ${conv.id}:`, error);
    }
  }

  // 3. 更新每日聚合
  await updateDailySummary(sql, dateStr);

  const totalTime = Date.now() - startTime;
  console.log(`[VoiceTagging] Completed in ${totalTime}ms. ` +
    `Processed: ${conversations.length}, AI calls: ${totalAICalls}, ` +
    `Total sentences: ${totalSentences}`);
}

async function processConversation(conv: Conversation, env: Env) {
  const startTime = Date.now();
  const productLine = (conv.product_line || "ichef") as "ichef" | "beauty";

  // 解析逐字稿
  const transcript = typeof conv.transcript === "string"
    ? conv.transcript
    : conv.transcript?.fullText || "";

  // 分離句子
  const sentences = extractSentences(transcript);

  // 規則匹配 + 分類
  const classified = sentences.map(s => {
    const ruleMatches = matchRules(s, productLine);
    return classifySentence(s, ruleMatches);
  });

  // 分組
  const matched = classified.filter(c => c.status === "matched");
  const uncertain = classified.filter(c => c.status === "uncertain");
  const skipped = classified.filter(c => c.status === "skip");

  // AI 處理不確定的句子
  let aiResults: AITagResult[] = [];
  if (uncertain.length > 0 && env.GEMINI_API_KEY) {
    const toProcess = uncertain.slice(0, 15); // 限制最多 15 句
    aiResults = await processUncertainWithAI(
      toProcess.map(c => ({ sentence: c.sentence, reason: c.uncertainReason! })),
      productLine,
      env.GEMINI_API_KEY
    );
  }

  // 合併結果
  const result = mergeResults(matched, aiResults, productLine);

  return {
    ...result,
    totalSentences: sentences.length,
    ruleMatched: matched.length,
    aiProcessed: aiResults.length,
    skipped: skipped.length,
    aiCalls: aiResults.length > 0 ? 1 : 0,
    processingTime: Date.now() - startTime,
  };
}
```

---

## 週報整合查詢

```typescript
// 在 handleWeeklyReport 中新增
async function getWeeklyVoiceInsights(sql: NeonClient, productLine: string) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const dateStr = weekAgo.toISOString().split("T")[0];

  // Top 功能需求
  const topFeatures = await sql`
    WITH feature_stats AS (
      SELECT
        f->>'tag' as tag,
        f->>'category' as category,
        COUNT(*) as mention_count,
        COUNT(DISTINCT conversation_id) as unique_convs,
        array_agg(DISTINCT (f->'quotes'->>0)) FILTER (WHERE f->'quotes'->>0 IS NOT NULL) as sample_quotes
      FROM customer_voice_tags,
           jsonb_array_elements(features_mentioned) as f
      WHERE conversation_date >= ${dateStr}::date
        AND product_line = ${productLine}
      GROUP BY f->>'tag', f->>'category'
    )
    SELECT * FROM feature_stats
    ORDER BY mention_count DESC
    LIMIT 10
  `;

  // Top 痛點
  const topPains = await sql`
    WITH pain_stats AS (
      SELECT
        p->>'tag' as tag,
        COUNT(*) as count,
        MODE() WITHIN GROUP (ORDER BY p->>'severity') as common_severity,
        SUM(CASE WHEN (p->>'is_quantified')::boolean THEN 1 ELSE 0 END) as quantified_count
      FROM customer_voice_tags,
           jsonb_array_elements(pain_tags) as p
      WHERE conversation_date >= ${dateStr}::date
        AND product_line = ${productLine}
      GROUP BY p->>'tag'
    )
    SELECT * FROM pain_stats
    ORDER BY count DESC
    LIMIT 10
  `;

  // Top 異議
  const topObjections = await sql`
    SELECT
      o->>'tag' as tag,
      COUNT(*) as count
    FROM customer_voice_tags,
         jsonb_array_elements(objection_tags) as o
    WHERE conversation_date >= ${dateStr}::date
      AND product_line = ${productLine}
    GROUP BY o->>'tag'
    ORDER BY count DESC
    LIMIT 5
  `;

  return { topFeatures, topPains, topObjections };
}
```

---

## 執行步驟

### Day 1（上午）

| 順序 | 任務 | 預估時間 |
|------|------|---------|
| 1 | 建立 `packages/services/src/nlp/` 目錄結構 | 10 分鐘 |
| 2 | 實作標籤字典 (ichef.ts, common.ts) | 1 小時 |
| 3 | 實作句子分類器 (sentence-classifier.ts) | 1 小時 |
| 4 | 實作 AI 標籤處理 (voice-tagger.ts) | 1.5 小時 |

### Day 1（下午）

| 順序 | 任務 | 預估時間 |
|------|------|---------|
| 5 | 建立資料庫 Migration | 30 分鐘 |
| 6 | 更新 Drizzle Schema | 30 分鐘 |
| 7 | 實作 Cron Handler | 1.5 小時 |
| 8 | 本地測試 | 1 小時 |

### Day 2（上午）

| 順序 | 任務 | 預估時間 |
|------|------|---------|
| 9 | 整合週報查詢 | 1 小時 |
| 10 | 部署到 Staging | 30 分鐘 |
| 11 | 測試完整流程 | 1 小時 |
| 12 | 部署到 Production | 30 分鐘 |

---

## 測試計劃

### 單元測試

```typescript
// tests/services/nlp/voice-tagger.test.ts

describe("VoiceTagger", () => {
  describe("classifySentence", () => {
    it("should match feature keywords", () => {
      const result = classifySentence("我想要電子發票功能", []);
      expect(result.status).toBe("matched");
      expect(result.matchedTags).toContainEqual({ category: "feature", tag: "einvoice" });
    });

    it("should flag uncertain sentences for AI", () => {
      const result = classifySentence("客人問有沒有 LINE 可以加", []);
      expect(result.status).toBe("uncertain");
      expect(result.uncertainReason).toBe("customer_need");
    });

    it("should skip short responses", () => {
      const result = classifySentence("好", []);
      expect(result.status).toBe("skip");
    });
  });
});
```

### 整合測試

```typescript
// 使用真實對話測試
const testTranscripts = [
  { name: "高痛點案例", file: "test-data/high-pain.txt" },
  { name: "競品比較案例", file: "test-data/competitor.txt" },
  { name: "功能諮詢案例", file: "test-data/feature-inquiry.txt" },
];
```

---

## 監控指標

| 指標 | 目標 | 警報閾值 |
|------|------|---------|
| 每日處理成功率 | > 95% | < 90% |
| 平均處理時間/對話 | < 5s | > 10s |
| AI 呼叫次數/對話 | < 1.5 | > 3 |
| 規則匹配率 | > 60% | < 40% |

---

## 相關文件

- [MEDDIC 分析架構](./20260129_新增Agent分析欄位實作計劃.md)
- [報告頁面排版優化](./20260128_報告頁面排版優化.md)
