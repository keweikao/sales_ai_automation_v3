# Dashboard 分析總數 Bug 修復

**日期**：2026-01-29
**Commit**：afaf751
**狀態**：已修復並部署

---

## 問題描述

Dashboard 首頁的「分析總數」顯示數字與實際不符：
- 機會總數：245
- 已完成分析的對話：219
- **Dashboard 顯示的分析總數**：85（錯誤）

## 根本原因

原本的查詢邏輯是從 `meddic_analyses` 表計算記錄數：

```typescript
const totalAnalysesResults = await db
  .select({ count: count() })
  .from(meddicAnalyses)
  .innerJoin(opportunities, eq(meddicAnalyses.opportunityId, opportunities.id))
  .where(...);
```

但 `meddic_analyses` 表只有 85 筆記錄，與已完成分析的對話數（219）不一致。

原因推測：早期資料可能沒有完整寫入 `meddic_analyses` 表，或是某些分析流程沒有建立對應記錄。

## 修復方案

將「分析總數」改為查詢 `conversations` 表中 `status = 'completed'` 的數量：

```typescript
const analysisConditions = [eq(conversations.status, "completed")];
// ...
const totalAnalysesResults = await db
  .select({ count: count() })
  .from(conversations)
  .innerJoin(opportunities, eq(conversations.opportunityId, opportunities.id))
  .where(and(...analysisConditions));
```

## 修改檔案

- `packages/api/src/routers/analytics/dashboard.ts`

## 驗證

部署後 Dashboard 分析總數應顯示 **219**（或相近數字），與「已完成分析的對話」一致。
