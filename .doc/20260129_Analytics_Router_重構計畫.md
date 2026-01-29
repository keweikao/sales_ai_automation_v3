# Analytics Router 模組化重構計畫

## 概述

將 `packages/api/src/routers/analytics.ts`（約 2000 行）拆分為多個模組，提高可維護性和可測試性。

## 重構結果 ✅

| 指標 | 重構前 | 重構後 | 目標 |
|------|--------|--------|------|
| 最大檔案行數 | 1992 行 | 396 行 | ~300 行 ✅ |
| 總模組數 | 1 個 | 13 個 | - |
| 可測試性 | 低 | 高 | 高 ✅ |
| 程式碼重用 | 低 | 高 | 高 ✅ |

## 最終檔案結構

```
packages/api/src/routers/analytics/
├── index.ts                    # 104 行 - Router 匯出
├── schemas.ts                  # 86 行 - 所有 Zod schemas
├── utils.ts                    # 145 行 - 共用工具函數
├── cache.ts                    # 70 行 - KV 快取邏輯
├── dashboard.ts                # 396 行 - getDashboard, getOpportunityStats
├── opportunity-analytics.ts    # 250 行 - getOpportunityAnalytics, getMeddicTrends
├── mtd-uploads.ts              # 126 行 - getMtdUploads
├── rep-performance/
│   ├── index.ts                # 288 行 - getRepPerformance 主函數
│   ├── queries.ts              # 390 行 - 資料庫查詢
│   └── transformers.ts         # 389 行 - 資料轉換邏輯
└── team-performance/
    ├── index.ts                # 333 行 - getTeamPerformance 主函數
    ├── queries.ts              # 374 行 - 資料庫查詢
    └── transformers.ts         # 325 行 - 資料轉換邏輯
```

## 執行階段

### Phase 1: 基礎模組抽取 ✅

- [x] 建立 `analytics/` 目錄
- [x] 抽取 `schemas.ts` - 所有 Zod schemas
- [x] 抽取 `utils.ts` - 共用工具函數
- [x] 抽取 `cache.ts` - KV 快取邏輯

### Phase 2: Rep Performance 拆分 ✅

- [x] 建立 `rep-performance/` 目錄
- [x] 抽取 `queries.ts` - 資料庫查詢函數
- [x] 抽取 `transformers.ts` - 資料轉換邏輯
- [x] 重構 `index.ts` - 主函數簡化

### Phase 3: Team Performance 拆分 ✅

- [x] 建立 `team-performance/` 目錄
- [x] 抽取 `queries.ts` - 資料庫查詢函數
- [x] 抽取 `transformers.ts` - 資料轉換邏輯
- [x] 重構 `index.ts` - 主函數簡化

### Phase 4: 其他 Handlers 整理 ✅

- [x] 抽取 `dashboard.ts`
- [x] 抽取 `opportunity-analytics.ts`
- [x] 抽取 `mtd-uploads.ts`
- [x] 整理 `index.ts` 為純匯出檔案

## 驗證清單 ✅

- [x] `bun x ultracite check` 通過 (13 files, no issues)
- [x] `bun x tsc --noEmit` 通過
- [ ] API 功能正常（待手動測試 Dashboard 頁面）

## 備份檔案

原始檔案已備份至：`packages/api/src/routers/analytics.ts.backup`

確認功能正常後可刪除備份：
```bash
rm packages/api/src/routers/analytics.ts.backup
```

## 相關資訊

- 分支: `refactor/analytics-router-modularization`
- 完成日期: 2026-01-29
