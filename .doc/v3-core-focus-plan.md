# Sales AI Automation V3 - 核心功能聚焦計劃

> 最後更新：2026-01-12

## 核心目標

**目標**：業務上傳音檔 → 自動轉錄 → MEDDIC 分析 → 產出可行動的建議

**暫緩**：Lead Source、MQL、Onboarding、Customer Success、Workflow 引擎

---

## Phase 5 & 6 功能取捨

### 需要開發（核心功能）

| 功能 | 說明 | 檔案位置 |
|------|------|----------|
| **Slack 音檔處理** | 上傳 → R2 → 轉錄 → 分析 | `apps/slack-bot/src/events/file.ts` |
| **Groq Whisper 轉錄** | 228x 實時速度，支援分塊 | `packages/services/src/transcription/` |
| **MEDDIC 7-Agent 分析** | 6 維度 + 綜合教練 | `packages/services/src/llm/orchestrator.ts` |
| **警示系統（Alerts）** | Close Now / Missing DM | `packages/services/src/alerts/` |
| **Manager 報表** | `/report` 指令、績效統計 | `apps/slack-bot/src/commands/report.ts` |
| **健康檢查 API** | `/api/health` 端點 | `apps/server/src/index.ts` |

### 可暫緩開發（Phase 5）

| Agent | 功能 | 暫緩原因 |
|-------|------|----------|
| **Agent 4: Lead Source** | Squarespace webhook、UTM 追蹤 | 業務目前手動輸入，不影響核心流程 |
| **Agent 5: MQL 評分** | 自動資格審查、評分規則 | 可手動判斷，後續再自動化 |
| **Agent 6: Onboarding** | 成交後任務管理、進度追蹤 | 成交後流程，非當前優先 |
| **Agent 6: Customer Success** | 客戶健康度、續約管理 | 後續運營需求 |
| **Agent 7: Workflow 引擎** | YAML 編排、動態執行 | 目前 Orchestrator 已夠用 |

### 可暫緩開發（Phase 6）

| 功能 | 暫緩原因 |
|------|----------|
| **Rep Performance 進階** | 勳章系統、AI 改善建議 - 先完成基礎 KPI |
| **跨模組整合測試** | 依賴 Phase 5 模組 |
| **效能驗證** | 功能穩定後再優化 |

---

## 暫緩功能對應的程式碼

以下程式碼**已存在但可暫不開發/維護**：

```
packages/services/src/
├── lead-source/          ❌ 暫緩 - Lead Source 整合
│   ├── squarespace/
│   └── utm/
├── mql/                  ❌ 暫緩 - MQL 評分
├── deal-onboarding/      ❌ 暫緩 - Onboarding 流程
├── customer-success/     ❌ 暫緩 - 客戶成功
└── workflow/             ❌ 暫緩 - Workflow 引擎

packages/api/src/routers/
├── lead-source.ts        ❌ 暫緩
├── mql.ts               ❌ 暫緩（如果存在）
├── onboarding.ts        ❌ 暫緩（如果存在）
└── customer-success.ts  ❌ 暫緩（如果存在）

packages/db/src/schema/
├── lead-source.ts       ❌ 已建立，暫不使用
├── mql.ts              ❌ 暫緩
├── onboarding.ts       ❌ 暫緩
└── customer-success.ts ❌ 暫緩
```

---

## 暫緩功能 - Sales Coach Agent（v3-core 完成後的下一階段）

> 詳見 `.doc/v3-sales-coach-agent-development.md`

Sales Coach Agent 是獨立於 v3-core 的進階功能，包含 22 個任務，分佈在 5 個層級。

### 暫緩的 Schema（Layer 0）

| Schema | 用途 | 暫緩原因 |
|--------|------|----------|
| `talk-tracks.ts` | 話術知識庫 | 需要先累積分析資料 |
| `rep-skills.ts` | 業務技能追蹤 | 非核心功能 |
| `competitor-info.ts` | 競品資訊庫 | 需要手動建立資料 |
| `follow-ups.ts` | 跟進排程 | 可用 Slack 手動追蹤 |

### 暫緩的 MCP Tools（Layer 1）

| Tool | 功能 | 暫緩原因 |
|------|------|----------|
| `query_similar_cases` | 查詢相似案例 | 依賴話術知識庫 |
| `get_talk_tracks` | 取得情境話術 | 依賴話術知識庫 |
| `get_rep_performance` | 業務績效查詢 | 依賴技能 Schema |
| `send_alert` | 發送警示 | 已有基本 Alert 系統 |
| `schedule_follow_up` | 排程跟進 | 可手動追蹤 |
| `get_competitor_info` | 競品資訊查詢 | 依賴競品資料庫 |

### 暫緩的 Agent Core（Layer 2-4）

- `sales-coach-agent.ts` - Agent 核心邏輯
- `tool-executor.ts` - Tool Use 整合
- `result-parser.ts` - 結果解析
- 3 個場景實作（Demo 後教練、Close Now 警示、主管週報）

**預估開發時間**：2-3 週（2 人團隊）

---

## 韌性機制

### LLM API 呼叫

| 情境 | 處理方式 |
|------|----------|
| Gemini API 超時 | 最多重試 3 次，指數退避（1s → 2s → 4s） |
| Gemini API 錯誤 | 記錄錯誤，返回部分結果或預設值 |
| 品質檢查失敗 | 最多精煉 2 次（已實作於 Orchestrator） |

### 轉錄服務

| 情境 | 處理方式 |
|------|----------|
| Groq Whisper 失敗 | 重試 2 次後標記為失敗，通知使用者 |
| 大檔案（>24MB） | 自動分塊，並行轉錄，合併結果 |
| 轉錄品質低 | 返回警示訊息，建議重新上傳 |

### 儲存服務

| 情境 | 處理方式 |
|------|----------|
| R2 上傳失敗 | 重試 2 次，失敗後使用本地暫存 |
| R2 讀取失敗 | 重試 2 次，返回快取（如有） |

---

## 資料遷移策略

### V2 歷史資料處理

**決策**：不遷移 V2 歷史資料，V3 從零開始

**原因**：

1. V2 使用 Firestore，V3 使用 PostgreSQL，Schema 差異大
2. V2 音檔在 GCS，V3 使用 R2，遷移成本高
3. V3 上線後，新資料會快速累積
4. 歷史資料可在 V2 系統查詢（保留 1 個月後下線）

### 如果需要遷移（可選）

參考 `.doc/v3-parallel-development-strategy.md` 的「V2 → V3 資料遷移策略」章節：

- Firestore → PostgreSQL 欄位映射表
- GCS → R2 音檔批次遷移腳本
- 雙寫期間策略

---

## 安全性檢查清單

### 必須驗證

- [ ] **Slack 簽名驗證** - 確保 `SLACK_SIGNING_SECRET` 驗證邏輯正確
- [ ] **API 認證** - oRPC 端點需要 Bearer token 或 session 驗證
- [ ] **R2 存取權限** - 音檔 URL 使用 signed URL，避免公開存取
- [ ] **環境變數隔離** - Production 與 Development 環境變數分離

### 建議驗證

- [ ] **敏感資料日誌** - 確保對話內容不會被記錄到日誌
- [ ] **CORS 設定** - 限制允許的來源網域
- [ ] **Rate Limiting** - API 端點加入請求限制（可用 Cloudflare）

---

## 監控設定

### 必要監控

| 監控項目 | 工具 | 用途 |
|----------|------|------|
| 健康檢查 | `/health`, `/ready`, `/live` | Kubernetes/容器探針 |
| 錯誤追蹤 | Sentry（建議） | 捕獲生產環境錯誤 |
| 服務可用性 | UptimeRobot（免費） | 服務中斷通知 |

### 可選監控

| 監控項目 | 工具 | 用途 |
|----------|------|------|
| 日誌聚合 | LogFlare / Cloudflare Logs | 集中日誌管理 |
| 效能追蹤 | Cloudflare Analytics | API 延遲分析 |
| 自訂指標 | 自建 Dashboard | 轉錄時間、分析時間追蹤 |

### Sentry 整合（建議）

```bash
bun add @sentry/node
```

```typescript
// apps/server/src/index.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

---

## 上線前必須完成清單

### 必須完成

- [ ] **Slack 音檔完整流程測試**
  - 上傳音檔 → R2 儲存 → Whisper 轉錄 → MEDDIC 分析 → 結果回傳

- [ ] **MEDDIC 分析品質驗證**
  - 7 個 Agent 輸出格式正確
  - 評分合理性檢查

- [ ] **Alert 警示系統**
  - Close Now 機會偵測
  - Missing DM 提醒
  - Slack 推播正常

- [ ] **Manager `/report` 指令**
  - Dashboard 統計
  - 團隊趨勢

- [ ] **健康檢查 API**
  - `/health` - 完整健康檢查（含 DB 連線狀態）
  - `/live` - 存活探針
  - `/ready` - 就緒探針

### 可選優化

- [ ] 大檔案分塊轉錄效能
- [ ] MEDDIC 分析快取
- [ ] Slack Block UI 美化

---

## 環境變數（核心功能所需）

```env
# 必要
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=
GEMINI_API_KEY=          # MEDDIC 分析
GROQ_API_KEY=            # Whisper 轉錄
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_ENDPOINT=      # R2 端點 URL
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
BETTER_AUTH_URL=             # 認證回調 URL（如 https://your-app.com）

# 可選
SENTRY_DSN=                  # Sentry 錯誤追蹤
INTERNAL_API_TOKEN=          # Slack Bot 呼叫 API 的內部 token

# 暫緩功能
# SQUARESPACE_WEBHOOK_SECRET=  # Lead Source
# HUBSPOT_API_KEY=             # CRM 整合
```

---

## 上線前工作清單

### Phase 1: 功能補完（1 天）

- [ ] 檢查 `/report` 指令的 API 端點是否完整
- [ ] 新增 `/api/health` 健康檢查端點
- [ ] 測試 Slack 音檔上傳完整流程

### Phase 2: 效能檢視（0.5 天）

- [ ] 測試大檔案轉錄效能
- [ ] 測試 MEDDIC 分析時間
- [ ] 識別並修復效能瓶頸

### Phase 3: 部署準備（1 天）

- [ ] 設定 Production 環境變數
- [ ] 部署 Cloudflare Workers（Backend + Slack Bot）
- [ ] 部署 Cloudflare Pages（Frontend）
- [ ] 設定 Slack App 生產環境
- [ ] DNS + SSL 設定

### Phase 4: 驗證測試（0.5 天）

- [ ] Slack 音檔上傳測試
- [ ] MEDDIC 分析結果驗證
- [ ] `/report` 報表測試
- [ ] 健康檢查 API 測試

---

## 預估上線時間

聚焦核心功能後：**1-2 個工作日**

- Day 1: 測試完整流程 + 修復問題
- Day 2: 部署 + 驗收

---

## 關鍵檔案位置

| 功能 | 檔案路徑 |
|------|----------|
| Slack 音檔處理 | `apps/slack-bot/src/events/file.ts` |
| Slack 報表指令 | `apps/slack-bot/src/commands/report.ts` |
| 對話上傳 API | `packages/api/src/routers/conversation.ts` |
| 分析報表 API | `packages/api/src/routers/analytics.ts` |
| Groq Whisper | `packages/services/src/transcription/groq-whisper.ts` |
| MEDDIC 分析 | `packages/services/src/llm/orchestrator.ts` |
| 警示規則 | `packages/services/src/alerts/rules.ts` |
