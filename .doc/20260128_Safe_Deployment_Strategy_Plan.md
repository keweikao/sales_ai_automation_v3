# 安全部署策略實作計畫

> 建立日期：2026-01-28
> 目標：避免開發新功能時影響現有系統運營

---

## 問題診斷總結

| 問題 | 風險等級 | 影響 |
|------|----------|------|
| CI 中的測試全部被禁用 | 🔴 高 | 無法自動發現程式錯誤 |
| 沒有 Staging 環境 | 🔴 高 | 無法在上線前驗證功能 |
| 直接部署到 Production | 🔴 高 | 問題直接影響用戶 |
| 沒有部署前的強制檢查 | 🟡 中 | 容易遺漏檢查步驟 |
| 缺少 Rollback 機制 | 🟡 中 | 出問題時無法快速恢復 |

---

## 實作計畫總覽

```
Phase 1: 基礎防護 (Week 1)
├── 1.1 建立安全部署腳本
├── 1.2 配置 Preview 環境
└── 1.3 建立部署前 Checklist

Phase 2: CI/CD 強化 (Week 2)
├── 2.1 修復資料庫測試相容性
├── 2.2 啟用 CI 測試
└── 2.3 加入部署 Gate

Phase 3: 進階保護 (Week 3)
├── 3.1 建立 Rollback 機制
├── 3.2 加入監控與警報
└── 3.3 建立 Canary 部署流程
```

---

## Phase 1: 基礎防護

### 1.1 建立安全部署腳本

**目標**：自動化部署前檢查，阻止不安全的部署

**檔案**：`scripts/deploy-safe.sh`

**功能**：
```bash
#!/bin/bash
# 安全部署腳本 - 在部署前執行所有必要檢查

# 1. 檢查是否有未提交的變更
# 2. 執行類型檢查 (typecheck)
# 3. 執行程式碼品質檢查 (ultracite)
# 4. 執行單元測試
# 5. 確認目標環境 (preview/production)
# 6. 執行部署
```

**使用方式**：
```bash
# 部署到 Preview（安全）
./scripts/deploy-safe.sh server preview

# 部署到 Production（需要額外確認）
./scripts/deploy-safe.sh server production
```

### 1.2 配置 Preview 環境

**目標**：每個 app 都有獨立的 Preview 環境供測試

**需要修改的檔案**：
- `apps/server/wrangler.toml` - 加入 `[env.preview]`
- `apps/queue-worker/wrangler.toml` - 加入 `[env.preview]`
- `apps/slack-bot/wrangler.toml` - 已有，需確認配置
- `apps/web` - 配置 Cloudflare Pages Preview

**Preview 環境命名規則**：
| App | Production | Preview |
|-----|------------|---------|
| server | sales-ai-server | sales-ai-server-preview |
| queue-worker | sales-ai-queue-worker | sales-ai-queue-worker-preview |
| slack-bot | sales-ai-slack-bot | sales-ai-slack-bot-preview |
| web | sales-ai-web | sales-ai-web-preview |

**環境變數隔離**：
- Preview 使用獨立的測試資料庫
- Preview 使用獨立的 Slack workspace（或測試頻道）
- Preview 的 CORS 設定指向 preview 前端

### 1.3 建立部署前 Checklist

**目標**：標準化部署流程，避免遺漏

**檔案**：`.doc/DEPLOYMENT_CHECKLIST.md`

**內容**：
```markdown
## 部署前檢查清單

### 必要檢查
- [ ] 所有變更已提交並推送
- [ ] `bun run typecheck` 通過
- [ ] `bun x ultracite check` 通過
- [ ] `bun run test` 通過
- [ ] PR 已經過 Code Review

### 部署流程
- [ ] 先部署到 Preview 環境
- [ ] 在 Preview 環境驗證功能
- [ ] 確認無錯誤後部署到 Production
- [ ] 部署後監控 5-10 分鐘確認穩定
```

---

## Phase 2: CI/CD 強化

### 2.1 修復資料庫測試相容性

**問題**：Neon serverless driver 與標準 PostgreSQL driver 不相容

**解決方案**：
```typescript
// packages/db/src/client.ts
// 根據環境選擇正確的 driver

export function createDbClient() {
  if (process.env.NODE_ENV === 'test') {
    // 測試環境使用標準 pg driver
    return createStandardPgClient();
  } else {
    // Production 使用 Neon serverless
    return createNeonClient();
  }
}
```

**需要修改的檔案**：
- `packages/db/src/client.ts`
- `packages/db/src/index.ts`
- `vitest.config.ts` - 設定測試環境變數

### 2.2 啟用 CI 測試

**目標**：在 GitHub Actions 中重新啟用所有測試

**修改檔案**：`.github/workflows/test.yml`

**新的 CI 流程**：
```yaml
jobs:
  lint-and-typecheck:
    # 現有的 lint 和 typecheck

  unit-tests:
    needs: lint-and-typecheck
    # 單元測試

  integration-tests:
    needs: unit-tests
    # 整合測試（需要 PostgreSQL service）

  deploy-preview:
    needs: integration-tests
    if: github.event_name == 'pull_request'
    # 自動部署 PR 到 Preview 環境
```

### 2.3 加入部署 Gate

**目標**：只有 CI 全部通過才能合併/部署

**GitHub 設定**：
- 啟用 Branch Protection Rules
- 要求所有 CI checks 通過
- 要求至少一人 Code Review

---

## Phase 3: 進階保護

### 3.1 建立 Rollback 機制

**目標**：出問題時能快速回復到上一個穩定版本

**方案 A - Cloudflare Workers Rollback**：
```bash
# 使用 wrangler 回滾到指定版本
wrangler rollback --version <version-id>

# 或回滾到上一個版本
wrangler rollback
```

**方案 B - Git Tag 版本控制**：
```bash
# 部署成功後自動打 tag
git tag -a "deploy/server/v1.2.3" -m "Production deploy"
git push --tags

# 需要 rollback 時
git checkout deploy/server/v1.2.2
./scripts/deploy-safe.sh server production --force
```

**Rollback 腳本**：`scripts/rollback.sh`
```bash
#!/bin/bash
# 快速回滾腳本

APP=$1  # server, queue-worker, slack-bot, web

echo "正在回滾 $APP 到上一個版本..."
cd apps/$APP
wrangler rollback
echo "回滾完成！請立即驗證服務狀態。"
```

### 3.2 加入監控與警報

**目標**：部署後自動監控，異常時立即通知

**Cloudflare 內建監控**：
- 啟用 `[observability]` (已配置)
- 設定錯誤率警報閾值

**自訂健康檢查**：
```typescript
// apps/server/src/routes/health.ts
export const healthRoutes = new Hono()
  .get('/health', async (c) => {
    const checks = {
      database: await checkDatabase(),
      cache: await checkCache(),
      queue: await checkQueue(),
    };

    const healthy = Object.values(checks).every(v => v);
    return c.json({ healthy, checks }, healthy ? 200 : 503);
  });
```

**Slack 警報整合**：
```typescript
// 部署後自動發送狀態到 Slack
async function notifyDeployment(app: string, version: string, status: 'success' | 'failed') {
  await slack.chat.postMessage({
    channel: '#deployments',
    text: `${status === 'success' ? '✅' : '❌'} ${app} ${version} 部署${status === 'success' ? '成功' : '失敗'}`,
  });
}
```

### 3.3 建立 Canary 部署流程

**目標**：漸進式部署，先讓小部分流量使用新版本

**Cloudflare Workers Gradual Rollout**：
```toml
# wrangler.toml
[deployment]
strategy = "percentage"
percentage = 10  # 先部署 10% 流量
```

**流程**：
1. 部署新版本，只給 10% 流量
2. 監控 15 分鐘，確認無異常
3. 逐步增加到 50% → 100%
4. 若有問題，立即回滾

---

## 實作優先順序

| 優先級 | 項目 | 預估工時 | 影響力 |
|--------|------|----------|--------|
| P0 | 1.1 安全部署腳本 | 2 小時 | 🔥🔥🔥 立即阻止不安全部署 |
| P0 | 1.2 Preview 環境配置 | 3 小時 | 🔥🔥🔥 部署前可驗證 |
| P1 | 2.1 修復資料庫測試 | 4 小時 | 🔥🔥 重新啟用自動測試 |
| P1 | 2.2 啟用 CI 測試 | 2 小時 | 🔥🔥 自動化品質保證 |
| P1 | 3.1 Rollback 機制 | 2 小時 | 🔥🔥 快速恢復能力 |
| P2 | 2.3 部署 Gate | 1 小時 | 🔥 強制流程合規 |
| P2 | 3.2 監控與警報 | 3 小時 | 🔥 主動發現問題 |
| P3 | 3.3 Canary 部署 | 4 小時 | 穩定性更上一層 |

---

## 快速開始

### 第一步：建立安全部署腳本

```bash
# 建立腳本後，所有部署都使用這個指令
./scripts/deploy-safe.sh <app> <environment>

# 範例
./scripts/deploy-safe.sh server preview    # 部署 server 到 preview
./scripts/deploy-safe.sh server production # 部署 server 到 production
```

### 第二步：配置 Preview 環境

需要在 Cloudflare Dashboard 建立：
- `sales-ai-server-preview` Worker
- `sales-ai-queue-worker-preview` Worker
- `sales-ai-slack-bot-preview` Worker
- Preview 用的 KV namespace
- Preview 用的 Queue

### 第三步：設定 Preview 資料庫

選項 A：使用 Neon 的 branching 功能（推薦）
選項 B：建立獨立的 Preview 資料庫

---

## 部署流程對照

### 現在（危險）
```
開發 → 直接部署 Production → 🔥 出問題
```

### 改善後（安全）
```
開發 → PR → CI 測試通過 → Deploy Preview → 驗證 → Deploy Production → 監控
                                   ↓
                              發現問題就停止
```

---

## 附錄：相關檔案清單

### 需要建立的新檔案
- `scripts/deploy-safe.sh` - 安全部署腳本
- `scripts/rollback.sh` - 快速回滾腳本
- `scripts/health-check.sh` - 健康檢查腳本
- `.doc/DEPLOYMENT_CHECKLIST.md` - 部署檢查清單

### 需要修改的現有檔案
- `apps/server/wrangler.toml` - 加入 preview 環境
- `apps/queue-worker/wrangler.toml` - 加入 preview 環境
- `.github/workflows/test.yml` - 啟用測試
- `packages/db/src/client.ts` - 修復測試相容性

---

## 成功指標

實作完成後，應該達到：

1. ✅ 每次部署前自動執行所有檢查
2. ✅ 新功能先在 Preview 環境驗證
3. ✅ CI 測試 100% 通過才能合併
4. ✅ 出問題時 5 分鐘內可以 Rollback
5. ✅ 部署狀態自動通知到 Slack
