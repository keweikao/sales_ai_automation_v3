# 2026-01-26 Git Commit 記錄

> 分支: `feature/aws-lambda-s3-mode`
> 推送時間: 2026-01-26 23:37
> Commits 數量: 9 筆

---

## 總覽

今日共提交 9 筆 commits，主要包含：
1. **業務待辦 (Sales Todo) 功能** - 完整的 CRUD API 和前端頁面
2. **PDCM 分析框架更新** - 新的銷售分析維度
3. **開發工具和腳本** - 測試和重試腳本
4. **產品配置更新** - iCHEF 店家類型和競品
5. **文件記錄** - 詳細的開發文件

---

## Commit 詳細記錄

### 1. 88a163a - feat(sales-todo): 新增業務待辦事項 API 和資料庫遷移

**日期**: 2026-01-26 23:34

**變更內容**:
- 新增 `sales_todos` 資料表 schema 和 migration
- 實作完整 CRUD API (create, complete, postpone, cancel, list, get)
- 支援按日期、狀態、用戶篩選
- 經理和 Admin 可查看團隊待辦
- 新增今日待辦查詢 API 供 Cron Job 使用

**修改檔案**:
- `packages/db/src/migrations/0007_add_sales_todos.sql` (新增)
- `packages/api/src/routers/sales-todo.ts` (新增, 624 行)
- `packages/api/src/routers/index.ts` (修改, 註冊 router)

---

### 2. f017c18 - feat(slack-bot): 新增 Follow-up Modal 和 Todo 提醒功能

**日期**: 2026-01-26 23:34

**變更內容**:
- 新增 follow-up-modal.ts: 音檔上傳後設定待辦 Modal
- 新增 todo-reminder.ts: 每日提醒訊息 Blocks 建構器
- 支援完成、改期、取消待辦的 Slack 互動
- 整合 Slack Bot 主程式處理新的 Modal 和按鈕

**修改檔案**:
- `apps/slack-bot/src/blocks/follow-up-modal.ts` (新增, 150 行)
- `apps/slack-bot/src/blocks/todo-reminder.ts` (新增, 375 行)
- `apps/slack-bot/src/blocks/index.ts` (修改)
- `apps/slack-bot/src/index.ts` (修改)
- `apps/slack-bot/src/events/file.ts` (修改)

---

### 3. 00d1034 - feat(web): 新增待辦事項頁面和 MTD 上傳列表

**日期**: 2026-01-26 23:34

**變更內容**:
- 新增 `/todos` 個人待辦頁面 (日曆選擇、完成、改期功能)
- 新增 `/todos/team` 團隊待辦頁面 (主管視角)
- 新增 `/reports/mtd-uploads` MTD 上傳列表頁面
- 更新路由樹和導覽列

**修改檔案**:
- `apps/web/src/routes/todos/index.tsx` (新增, 907 行)
- `apps/web/src/routes/todos/team.tsx` (新增, 790 行)
- `apps/web/src/routes/reports/mtd-uploads.tsx` (新增, 308 行)
- `apps/web/src/routeTree.gen.ts` (修改)
- `apps/web/src/routes/reports/index.tsx` (修改)
- `apps/web/src/components/header.tsx` (修改)
- `apps/web/src/routes/index.tsx` (修改)

---

### 4. 045f415 - feat(services): PDCM 分析框架更新

**日期**: 2026-01-26 23:35

**變更內容**:
- 更新 `Agent2Output` 類型定義支援 PDCM scores
- 新增 Pain/Decision/Champion/Metrics 維度評分
- 更新 Orchestrator 分數計算邏輯 (PDCM 權重)
- 改進風險識別和 MEDDIC 維度映射

**修改檔案**:
- `packages/services/src/llm/types.ts` (修改)
- `packages/services/src/llm/orchestrator.ts` (修改)
- `packages/services/src/llm/prompts.generated.ts` (修改)

**PDCM 權重**:
- Pain: 35%
- Decision: 25%
- Champion: 25%
- Metrics: 15%

---

### 5. c274320 - fix(ichef): 更新產品配置和通知 Blocks

**日期**: 2026-01-26 23:35

**變更內容**:
- 新增店家類型: 小吃店 🍜、攤車 🛒
- 更新競品名稱: DUDU→Dudoo, EZTABLE→365, Inline→大麥
- 修正通知 Blocks 格式

**修改檔案**:
- `packages/shared/src/product-configs/ichef.ts` (修改)
- `packages/services/src/notifications/blocks.ts` (修改)

---

### 6. 62ea199 - chore(queue-worker): 啟用 Observability 日誌追蹤

**日期**: 2026-01-26 23:35

**變更內容**:
- 新增 `[observability] enabled = true`
- 可在 Cloudflare Dashboard 查看即時日誌

**修改檔案**:
- `apps/queue-worker/wrangler.toml` (修改)

---

### 7. 21da3df - feat(scripts): 新增開發和測試腳本

**日期**: 2026-01-26 23:35

**變更內容**:
- `retry-conversation.ts`: 重試失敗對話的腳本
- `send-reports-now.ts`: 立即發送每日/週報告到 Slack
- `test-gemini-api.ts`: 測試 Gemini API 連線
- `test-meddic-analysis.ts`: 測試 MEDDIC 分析流程

**新增檔案**:
- `scripts/retry-conversation.ts` (30 行)
- `scripts/send-reports-now.ts` (186 行)
- `scripts/test-gemini-api.ts` (70 行)
- `scripts/test-meddic-analysis.ts` (80 行)

---

### 8. b9b6852 - docs: 新增 2026-01-26 開發文件

**日期**: 2026-01-26 23:36

**變更內容**:
- MCP Server 實作計劃
- Slack 用戶映射與 PDCM 分析框架更新報告
- 業務 Todo 功能實作執行文件

**新增檔案**:
- `.doc/20260126_MCP_Server實作計劃.md` (267 行)
- `.doc/20260126_Slack用戶映射與PDCM分析框架更新報告.md` (271 行)
- `.doc/20260126_業務Todo功能實作執行文件.md` (429 行)

---

### 9. e0a12a3 - chore: 雜項配置和資源更新

**日期**: 2026-01-26 23:36

**變更內容**:
- 更新 `.gitignore` 排除 `.mcp.json` 敏感檔案
- 新增 VSCode 擴充套件推薦
- 更新 `CLAUDE.md` 專案文件
- 更新分享頁面
- 新增 Lambda ffmpeg 二進位檔

**修改檔案**:
- `.gitignore` (修改)
- `.vscode/extensions.json` (新增)
- `.claude/CLAUDE.md` (修改)
- `apps/web/src/routes/share/$token.tsx` (修改)
- `apps/lambda-audio-compressor/bin/ffmpeg` (新增, 76MB)

---

## 統計摘要

| 類別 | 新增檔案 | 修改檔案 |
|------|---------|---------|
| API/後端 | 2 | 1 |
| Slack Bot | 2 | 3 |
| Web 前端 | 3 | 4 |
| Services | 0 | 3 |
| Scripts | 4 | 0 |
| 文件 | 3 | 0 |
| 配置 | 2 | 3 |
| **總計** | **16** | **14** |

## 功能重點

### 🎯 業務待辦功能 (Sales Todo)
完整的待辦事項管理系統，包含：
- 資料庫 schema 設計
- RESTful API (7 個端點)
- Slack 互動 (Modal + 按鈕)
- Web 頁面 (個人 + 團隊)
- 每日 Cron 提醒

### 📊 PDCM 分析框架
新的銷售對話分析維度：
- **Pain** (痛點): 35% 權重
- **Decision** (決策): 25% 權重
- **Champion** (擁護者): 25% 權重
- **Metrics** (量化): 15% 權重

### 🛠 開發工具
- 重試失敗對話腳本
- Gemini API 測試
- MEDDIC 分析測試
- Slack 報告發送

---

## 相關文件

- [業務 Todo 功能實作執行文件](../.doc/20260126_業務Todo功能實作執行文件.md)
- [PDCM 分析框架更新報告](../.doc/20260126_Slack用戶映射與PDCM分析框架更新報告.md)
- [MCP Server 實作計劃](../.doc/20260126_MCP_Server實作計劃.md)
