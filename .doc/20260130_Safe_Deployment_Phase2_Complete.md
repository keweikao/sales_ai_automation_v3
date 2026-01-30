# 安全部署機制 Phase 2 & 3 完成報告

> 建立日期：2026-01-30
> 狀態：已完成

---

## 概述

此次更新完成了安全部署策略的 Phase 2 和 Phase 3，包括：
- CI 測試完整啟用
- Branch Protection 自動化設定
- Canary 漸進式部署機制

---

## 已完成項目

### Phase 2.1: 資料庫測試相容性 ✅
**狀態**：已於之前完成

- `packages/db/src/index.ts` 已實作雙 driver 支援
- 測試環境：使用 `drizzle-orm/node-postgres` + `pg`
- Production：使用 `drizzle-orm/neon-http` + `@neondatabase/serverless`

### Phase 2.2: CI 測試完整啟用 ✅

#### 2.2a Playwright WebServer 配置修復
**檔案**：`playwright.config.ts`

修改內容：
- 改用多伺服器配置（server + web）
- 使用 `bun run dev:server` 和 `bun run dev:web`
- 設定適當的健康檢查 URL

```typescript
webServer: [
  {
    command: "bun run dev:server",
    url: "http://localhost:3000/health",
    ...
  },
  {
    command: "bun run dev:web",
    url: "http://localhost:3001",
    ...
  },
]
```

#### 2.2b 測試資料 Seed 腳本
**檔案**：`packages/db/src/seed.ts`

功能：
- 建立測試用戶（3 個）
- 建立測試機會（5 個，包含高分和低分案例）
- 建立測試對話和 MEDDIC 分析
- 建立測試警示和待辦
- 建立測試話術和競品資訊

使用方式：
```bash
bun run db:seed
```

#### 2.2c E2E 和 Performance 測試啟用
**檔案**：`.github/workflows/test.yml`

修改內容：
- E2E 測試：在 main 分支或加上 `run-e2e` 標籤時執行
- Performance 測試：在 main 分支或加上 `run-perf` 標籤時執行
- 整合 seed 資料到 CI 流程
- 更新 test-summary 包含所有測試結果

### Phase 2.3: Branch Protection 自動化 ✅
**檔案**：`scripts/setup-branch-protection.sh`

功能：
- 使用 GitHub CLI 自動設定 main 分支保護規則
- 要求 PR 審查（至少 1 人）
- 要求 CI 測試通過（Lint, Unit, API Tests）
- 過期審查自動失效
- 要求解決所有對話後才能合併
- 禁止 Force Push 和直接刪除分支

使用方式：
```bash
./scripts/setup-branch-protection.sh
```

### Phase 3.3: Canary 漸進式部署 ✅
**檔案**：`scripts/deploy-canary.sh`

功能：
- 三階段漸進式部署：10% → 50% → 100%
- 每個階段都有監控和確認
- 整合健康檢查
- 支援 server、queue-worker、slack-bot

使用方式：
```bash
./scripts/deploy-canary.sh server         # 預設 10% → 50% → 100%
./scripts/deploy-canary.sh server 25      # 從 25% 開始
./scripts/deploy-canary.sh queue-worker   # 部署 queue-worker
```

---

## 部署腳本總覽

| 腳本 | 用途 | 說明 |
|------|------|------|
| `deploy-staging.sh` | Staging 部署 | 自動檢查 + 部署到 staging |
| `deploy-production.sh` | Production 部署 | 強制確認 + 完整檢查 |
| `deploy-canary.sh` | Canary 部署 | 漸進式 10% → 50% → 100% |
| `rollback.sh` | 快速回滾 | 回復到上一版本 |
| `health-check.sh` | 健康檢查 | 單次或持續監控 |
| `notify-deployment.sh` | Slack 通知 | 部署狀態通知 |
| `setup-branch-protection.sh` | Branch 保護 | 設定 GitHub 保護規則 |

---

## CI 測試流程

```
push/PR 觸發
    │
    ├── Lint & Type Check (必要)
    │       │
    │       ├── Unit & Integration Tests (必要)
    │       │       │
    │       │       ├── API Tests (必要)
    │       │       │       │
    │       │       │       ├── E2E Tests (選擇性，加 run-e2e 標籤)
    │       │       │       │
    │       │       │       └── Performance Tests (選擇性，加 run-perf 標籤)
    │       │       │
    │       │       └── Test Summary
    │       │
    │       └── (Branch Protection 檢查)
    │
    └── 可合併到 main
```

---

## 部署流程建議

### 一般功能部署
```bash
# 1. 開發完成後，先部署到 staging
./scripts/deploy-staging.sh all

# 2. 在 staging 驗證功能

# 3. 確認無問題後，部署到 production
./scripts/deploy-production.sh all
```

### 高風險變更部署
```bash
# 使用 Canary 漸進式部署
./scripts/deploy-canary.sh server

# 每個階段都會暫停確認
# 如發現問題，可以隨時停止並回滾
./scripts/rollback.sh server production
```

---

## 下一步行動

1. **執行 Branch Protection 設定**
   ```bash
   ./scripts/setup-branch-protection.sh
   ```

2. **測試 Canary 部署**
   - 先在非繁忙時段測試一次完整流程
   - 確認監控和通知正常運作

3. **團隊培訓**
   - 分享新的部署流程給團隊
   - 確保所有人了解如何使用 PR 標籤觸發 E2E/Performance 測試

---

## 檔案變更清單

```
新增：
├── packages/db/src/seed.ts                    # 測試資料 seed
├── scripts/setup-branch-protection.sh        # Branch Protection 設定
└── scripts/deploy-canary.sh                  # Canary 部署

修改：
├── playwright.config.ts                       # WebServer 配置
└── .github/workflows/test.yml                 # CI 測試啟用
```
