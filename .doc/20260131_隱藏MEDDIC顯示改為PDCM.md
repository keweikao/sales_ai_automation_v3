# 隱藏 MEDDIC 顯示，改為 PDCM

**日期**: 2026-01-31
**類型**: 前端顯示優化
**影響範圍**: Slack 通知、Web UI

---

## 背景

系統原本同時支援兩種銷售分析框架：
- **MEDDIC**: 6 維度 (Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion)
- **PDCM**: 4 維度 (Pain, Decision, Champion, Metrics)

經過架構分析發現：
1. PDCM 是由 Agent 2 實際執行 AI 分析產生的原始資料
2. MEDDIC 分數是在 Orchestrator 中透過**純程式碼映射**從 PDCM 轉換而來，**不消耗額外 token**
3. 用戶主要使用 PDCM，MEDDIC 顯示造成混淆

## 決策

**選擇方案 A: 隱藏 MEDDIC 顯示，保留 PDCM**

原因：
- MEDDIC 計算不消耗 token，無成本節省效益
- 保留 MEDDIC 資料供 Voice Tagging Layer 2 使用（觸發條件）
- 只修改顯示層，不影響後端邏輯

---

## 修改內容

### 1. `packages/services/src/notifications/slack.ts`

```typescript
// Before
const fallbackText = "... (MEDDIC 分數: " + params.analysisResult.overallScore + "/100)";

// After
const fallbackText = "... (PDCM 分數: " + params.analysisResult.overallScore + "/100)";
```

### 2. `packages/services/src/notifications/blocks.ts`

```typescript
// Line 142: 向下相容區塊
// Before
text: `*📊 MEDDIC 分數:*\n*${analysisResult.overallScore}/100*`

// After
text: `*📊 PDCM 分數:*\n*${analysisResult.overallScore}/100*`
```

### 3. `apps/slack-bot/src/events/file.ts`

將所有 "MEDDIC" 文字改為 "PDCM+SPIN"：

| 位置 | Before | After |
|------|--------|-------|
| Line 5 (註解) | `轉錄和 MEDDIC 分析` | `轉錄和 PDCM+SPIN 分析` |
| Line 243 | `轉錄和 MEDDIC 分析可能需要幾分鐘` | `轉錄和 PDCM+SPIN 分析可能需要幾分鐘` |
| Line 302 | `MEDDIC 分析完成` | `PDCM+SPIN 分析完成` |
| Line 597 | `MEDDIC 分析,完成後會通知您` | `PDCM+SPIN 分析,完成後會通知您` |
| Line 732 | `*MEDDIC 評分:*` | `*PDCM+SPIN 評分:*` |
| Line 746 | `🤖 *MEDDIC 分析*` | `🤖 *PDCM+SPIN 分析*` |

### 4. `apps/slack-bot/src/blocks/analysis-result.ts`

#### Interface 更新

```typescript
export interface AnalysisResultData {
  // ... 其他欄位

  // 新增: PDCM 四維度
  pdcmScores?: {
    pain: number;
    decision: number;
    champion: number;
    metrics: number;
    totalScore: number;
    dealProbability: "high" | "medium" | "low";
  };

  // Legacy: MEDDIC 六維度 (向下相容)
  dimensions?: {
    metrics: number;
    economicBuyer: number;
    decisionCriteria: number;
    decisionProcess: number;
    identifyPain: number;
    champion: number;
  };
}
```

#### `buildAnalysisResultBlocks()` 函數更新

- Header: `"MEDDIC 分析完成"` → `"PDCM+SPIN 分析完成"`
- 優先顯示 PDCM 四維度 (P/D/C/M)
- 保留 MEDDIC 六維度作為向下相容（當沒有 PDCM 資料時）

---

## PDCM → MEDDIC 映射邏輯（參考）

此映射邏輯位於 `packages/services/src/llm/orchestrator.ts` (lines 340-352)，**不消耗 token**：

```
PDCM (4維度)              →    MEDDIC (6維度)
─────────────────────────────────────────────
P (Pain)                  →    Identify Pain
D (Decision)              →    Decision Process + Economic Buyer
C (Champion)              →    Champion + Decision Criteria
M (Metrics)               →    Metrics

Economic Buyer 特殊邏輯: has_authority ? 80 : 40
```

---

## 未修改項目

以下項目已確認**原本就使用 PDCM 顯示**，無需修改：

1. `apps/web/src/routes/opportunities/$id.tsx` - 機會詳情頁
2. `apps/web/src/routes/conversations/$id.tsx` - 對話詳情頁
3. `packages/services/src/notifications/blocks.ts` 的 `buildProcessingCompletedBlocks()` - Queue Worker 完成通知

---

## 驗證結果

- ✅ TypeScript 類型檢查通過
- ✅ Lint 檢查通過
- ✅ 後端邏輯不受影響
- ✅ Voice Tagging Layer 2 仍可使用 MEDDIC 分數作為觸發條件

---

## 部署注意事項

需重新部署以下服務：

```bash
# Slack Bot
cd apps/slack-bot && bunx wrangler deploy

# Queue Worker (如有更新 services package)
cd apps/queue-worker && bunx wrangler deploy
```

---

## 相關文件

- `packages/services/src/llm/orchestrator.ts` - PDCM → MEDDIC 映射邏輯
- `scripts/show-analysis-example.ts` - 顯示 PDCM/MEDDIC 分析範例
