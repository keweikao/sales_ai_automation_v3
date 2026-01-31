# Voice Tagging AI 深度分析實作計畫

> 建立日期：2026-01-31
> 狀態：規劃中

## 背景

目前 Voice Tagging 系統使用規則匹配處理對話標籤，覆蓋率約 25.8%。經過 AI 分析比較後發現：

- **規則匹配**：標準化、可聚合、免費，但標籤較抽象
- **AI 分析**：具體情境、深度洞察、競品識別，但成本較高

為了在效率與成本間取得平衡，設計「規則先行，AI 延伸」的三層架構。

---

## 架構設計

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: 週度市場洞察報告                                   │
│  ─────────────────────────────────────────                  │
│  • 聚合 Layer 1 標籤統計 + 趨勢                              │
│  • 彙整 Layer 2 深度洞察                                     │
│  • AI 產生整體市場洞察摘要                                   │
│  • 每週一發送 Slack                                          │
│  成本：~$0.5/週                                              │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 智慧觸發 AI 深度解讀                               │
│  ─────────────────────────────────────────                  │
│  觸發條件：                                                  │
│    • 高價值機會 (>50K)                                       │
│    • 談判階段                                                │
│    • 提到競品                                                │
│    • 長對話 (>30分鐘)                                        │
│    • 首次接觸                                                │
│  產出：基於規則標籤的深度解讀、具體情境、建議話術            │
│  成本：估計 3-5 筆/天 × $0.05 = ~$5-10/月                   │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 規則匹配 + 持續擴充                                │
│  ─────────────────────────────────────────                  │
│  • 每筆對話都跑                                              │
│  • 從 AI 結果學習，擴充規則字典                              │
│  成本：$0                                                    │
└─────────────────────────────────────────────────────────────┘

總成本：~$10-15/月
```

---

## 核心設計原則

### 規則先行，AI 延伸

1. **規則匹配**：產出標準化標籤（features, pains, objections）
2. **AI 分析**：基於規則標籤，給出深度解讀

```
規則匹配結果：
  objection: ["price"]

AI 深度解讀（基於 price 標籤）：
  - 具體情境：客戶擔心硬體設備需額外購買
  - 原文引述：「機器還要另外買喔？」
  - 子分類：hardware_cost（可聚合）
  - 建議話術：強調租賃方案，或分期付款選項
```

### 好處

| 面向 | 效果 |
|------|------|
| **統計聚合** | 用標準標籤：price 異議出現 45 次 |
| **深度下鑽** | 45 次 price 中：硬體成本 30 次、月費 10 次、抽成 5 次 |
| **AI 輸出穩定** | 基於固定標籤展開，不會天馬行空 |
| **可比較性** | 同標籤下的情境可以互相比較 |

---

## 資料結構

### 現有欄位（Layer 1 規則匹配）

```sql
-- customer_voice_tags 表
features_mentioned  jsonb  -- [{ tag, quotes, count, source }]
pain_tags           jsonb  -- [{ tag, severity, quotes, source }]
objection_tags      jsonb  -- [{ tag, quotes, source }]
competitor_mentions jsonb  -- [{ name, sentiment, quotes }]
```

### 新增欄位（Layer 2 AI 分析）

```sql
ALTER TABLE customer_voice_tags ADD COLUMN ai_analysis jsonb;
ALTER TABLE customer_voice_tags ADD COLUMN ai_analyzed_at timestamp;
```

### AI 分析結構

```typescript
interface AIAnalysis {
  // 針對每個規則標籤的深度解讀
  tag_insights: {
    [tag: string]: {
      context: string;           // 具體情境描述
      quote: string;             // 原文引述
      sub_category: string;      // 子分類（可聚合）
      implicit_need?: string;    // 隱含需求
      suggested_response?: string; // 建議話術
    };
  };

  // 競品識別（規則沒覆蓋的部分）
  competitors: Array<{
    name: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    context: string;
  }>;

  // 整體摘要
  summary: string;

  // 分析時間
  analyzed_at: string;
}
```

---

## Layer 2：智慧觸發條件

基於 MEDDIC 分數判斷是否需要深度分析：

```typescript
function shouldRunLayer2Analysis(
  voiceTagResult: VoiceTaggingResult,
  meddicScore?: number | null,
  conversationMeta?: {
    isFirstContact?: boolean;
    durationMinutes?: number;
  }
): boolean {
  // 1. MEDDIC 高分（>=70）- 成交機會大，值得深度分析
  if (meddicScore && meddicScore >= 70) {
    return true;
  }

  // 2. MEDDIC 低分（<=40）- 可能有問題需要分析
  if (meddicScore && meddicScore <= 40) {
    return true;
  }

  // 3. 規則匹配到競品
  if (voiceTagResult.competitors.length > 0) {
    return true;
  }

  // 4. 長對話（>200句，約 30 分鐘）
  if (voiceTagResult.totalSentences > 200) {
    return true;
  }

  // 5. 首次接觸
  if (conversationMeta?.isFirstContact) {
    return true;
  }

  return false;
}
```

### 觸發條件說明

| 條件 | 閾值 | 原因 |
|------|------|------|
| MEDDIC 高分 | >=70 | 成交機會大，深度分析可提供致勝話術 |
| MEDDIC 低分 | <=40 | 可能有問題，分析可發現改善機會 |
| 競品提及 | >0 | 需要競爭情報和應對策略 |
| 長對話 | >200句 | 內容豐富，值得深度分析 |
| 首次接觸 | - | 了解客戶初始需求和痛點 |

---

## Layer 3：週度報告格式

```markdown
## 本週市場洞察 (2026/01/27 - 02/02)

### 📊 本週統計
- 新增對話：85 筆
- AI 深度分析：23 筆

### 🔥 熱門功能需求 Top 5
| 排名 | 功能 | 次數 | 較上週 |
|------|------|------|--------|
| 1 | 線上點餐 | 35 | ↑5 |
| 2 | 外送整合 | 28 | ↑2 |
| 3 | 會員系統 | 22 | → |
| 4 | 電子發票 | 18 | ↓3 |
| 5 | 庫存管理 | 15 | ↑1 |

### 😣 主要痛點趨勢
| 痛點 | 次數 | 趨勢 | 主要情境 |
|------|------|------|----------|
| 外送平台抽成 | 18 | ↑15% | 客戶反映 UberEats 抽成過高 |
| 訂位 no-show | 12 | → | 週末高峰期問題嚴重 |
| 手動對帳 | 10 | ↓5% | - |

### 🚫 常見異議分布
- 價格考量：45% (硬體成本 60%, 月費 25%, 抽成 15%)
- 時機問題：25%
- 學習曲線：15% ↑8%
- 其他：15%

### 🏢 競品動態
| 競品 | 提及次數 | 較上週 | 客戶評價 |
|------|----------|--------|----------|
| 肚肚 | 12 | +3 | 價格便宜但功能少 |
| 快一點 | 5 | +1 | 專注外送 |

### 💡 本週關鍵洞察

> 本週對話顯示客戶對外送平台高抽成的痛感加劇，
> 建議強調 iCHEF 自有線上點餐可節省平台費用的價值。
> 另外，「學習曲線」擔憂上升 8%，可能需要加強
> Demo 時的操作簡易度展示。

### 🎯 建議行動
1. 製作「自有線上點餐 vs 外送平台」成本比較表
2. Demo 時優先展示最常用的 3 個功能
3. 追蹤本週提到肚肚的 12 個機會
```

---

## 實作任務清單

### Phase 1：基礎建設

| # | 任務 | 說明 | 預估時間 |
|---|------|------|----------|
| 1.1 | 擴充規則字典 | 從 AI 分析學到的新標籤補進去 | 1hr |
| 1.2 | DB Migration | 新增 `ai_analysis`, `ai_analyzed_at` 欄位 | 0.5hr |
| 1.3 | 更新 TypeScript 型別 | 新增 AIAnalysis interface | 0.5hr |

### Phase 2：Layer 2 實作

| # | 任務 | 說明 | 預估時間 |
|---|------|------|----------|
| 2.1 | AI Prompt 設計 | 基於規則標籤產出深度解讀 | 1hr |
| 2.2 | 觸發條件邏輯 | shouldRunAIAnalysis 函數 | 1hr |
| 2.3 | 整合到處理流程 | 規則匹配後判斷是否觸發 AI | 1hr |
| 2.4 | 舊資料補跑 | 符合條件的舊資料補跑 AI 分析 | 1hr |

### Phase 3：Layer 3 實作

| # | 任務 | 說明 | 預估時間 |
|---|------|------|----------|
| 3.1 | 週報資料聚合 | 統計標籤、趨勢計算 | 2hr |
| 3.2 | AI 洞察摘要 | 聚合資料後產生洞察 | 1hr |
| 3.3 | Slack 發送 | 格式化 + 排程發送 | 1hr |
| 3.4 | Cron 設定 | 每週一早上執行 | 0.5hr |

### Phase 4：優化迭代

| # | 任務 | 說明 | 預估時間 |
|---|------|------|----------|
| 4.1 | 監控 AI 成本 | 追蹤每日 AI 呼叫次數和成本 | 1hr |
| 4.2 | 規則字典維護流程 | 定期從 AI 結果學習新標籤 | 持續 |
| 4.3 | 報告內容調整 | 根據團隊回饋優化 | 持續 |

---

## 新增規則標籤（從 AI 分析學習）

### Pains

```typescript
// packages/services/src/nlp/dictionaries/ichef.ts

// 新增
"platform_commission": {
  keywords: ["抽成", "平台費", "佣金", "手續費"],
  severity: "high"
},
"no_show": {
  keywords: ["no show", "放鴿子", "訂位沒來", "爽約"],
  severity: "medium"
},
"learning_curve": {
  keywords: ["學習曲線", "不會用", "太複雜", "要學很久"],
  severity: "medium"
},
"hardware_cost": {
  keywords: ["機器", "設備", "硬體", "iPad"],
  severity: "medium"
}
```

### Features

```typescript
// 新增
"stamp_card": {
  keywords: ["記杯", "集點", "點數", "會員點數"],
  category: "crm"
},
"multi_pot": {
  keywords: ["多鍋", "分鍋", "雙鍋", "鴛鴦鍋"],
  category: "order_management"
},
"online_booking": {
  keywords: ["線上訂位", "網路訂位", "預約"],
  category: "reservation"
}
```

---

## AI Prompt 設計（Layer 2）

```typescript
const buildAIPrompt = (
  transcript: string,
  ruleTags: {
    features: string[];
    pains: string[];
    objections: string[];
  }
) => `
你是 iCHEF POS 系統的銷售對話分析專家。

以下對話已經透過規則匹配識別出這些標籤：
- 功能需求：${ruleTags.features.join(', ') || '無'}
- 痛點：${ruleTags.pains.join(', ') || '無'}
- 異議：${ruleTags.objections.join(', ') || '無'}

請基於這些標籤，分析對話內容，提供深度解讀：

1. 針對每個標籤，說明：
   - 具體情境（客戶的實際狀況）
   - 原文引述（最能代表的一句話）
   - 子分類（更細的分類，用於統計）
   - 建議話術（業務可以怎麼回應）

2. 識別對話中提到的競品及客戶評價

3. 一句話總結這個對話的關鍵洞察

請用 JSON 格式回覆：
{
  "tag_insights": {
    "標籤名稱": {
      "context": "具體情境",
      "quote": "原文引述",
      "sub_category": "子分類",
      "suggested_response": "建議話術"
    }
  },
  "competitors": [
    { "name": "競品名稱", "sentiment": "positive/negative/neutral", "context": "評價內容" }
  ],
  "summary": "一句話洞察"
}

對話內容：
${transcript}
`;
```

---

## 成本預估

| 項目 | 計算 | 月成本 |
|------|------|--------|
| Layer 1 規則匹配 | 免費 | $0 |
| Layer 2 AI 分析 | 3-5 筆/天 × 30 天 × $0.05 | $5-10 |
| Layer 3 週報 | 4 次/月 × $0.5 | $2 |
| **總計** | | **$7-12/月** |

---

## 驗收標準

- [ ] Layer 1：規則覆蓋率從 25.8% 提升到 35%+
- [ ] Layer 2：高價值對話自動產生深度洞察
- [ ] Layer 3：每週一自動發送市場洞察報告到 Slack
- [ ] 舊資料：符合條件的舊對話完成 AI 分析補跑

---

## 相關檔案

- `packages/services/src/nlp/dictionaries/ichef.ts` - 規則字典
- `packages/services/src/nlp/voice-tagger.ts` - Voice Tagging 主程式
- `apps/queue-worker/src/handlers/voice-tagging.ts` - 排程處理
- `apps/queue-worker/src/index.ts` - Cron 設定
