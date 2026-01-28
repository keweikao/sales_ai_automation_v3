# Skills + MCP 開發規劃

> 文件建立日期：2026-01-27
> 狀態：待開發

## 概述

本文件規劃 Sales AI 系統的 Skills 和 MCP 整合開發路線圖，目標是提升開發維運效率和自動化程度。

---

## 現有自動化

| 類型 | 名稱 | 功能 |
|------|------|------|
| Skill | `/diagnose` | 問題診斷、日誌查詢、代碼定位 |
| Skill | `/smart-deploy` | 變更檢測、前置檢查、漸進部署 |
| Skill | `/report` | 即時報告、統計查詢 |
| Cron | 每日 08:00 | 健康報告（自動推送 Slack） |
| Cron | 每週一 08:00 | 週報 |
| Cron | 每日 09:00 | Todo 提醒 |

---

## Phase 1: Skills 全面開發

### P0 - 高優先級

#### 1. `/db` - 資料庫管理

```
/db status           # 連線狀態、表格大小
/db migrate          # 執行遷移
/db backup           # 備份資料庫
/db validate         # 資料一致性檢查
```

**使用情境**：部署前檢查遷移狀態、資料異常時快速驗證

#### 2. `/analytics` - 進階分析查詢

```
/analytics meddic --user 王大明    # 個人 MEDDIC 趨勢
/analytics team --dept sales       # 團隊績效
/analytics funnel                  # 銷售漏斗分析
/analytics compare --period month  # 月度對比
```

**使用情境**：經理月會前查詢團隊績效、分析特定業務的弱項

### P1 - 中優先級

#### 3. `/pr` - GitHub PR 管理

```
/pr review 123       # 審核 PR #123
/pr status           # 查看待處理 PR
/pr merge 123        # 合併 PR（需確認）
/pr issues           # 查看 open issues
```

#### 4. `/slack` - Slack 操作

```
/slack notify #channel "訊息"   # 發送通知
/slack users                     # 用戶映射狀態
/slack threads --pending         # 待處理 threads
```

### P2 - 低優先級

#### 5. `/cost` - 成本分析

```
/cost today          # 今日 API 成本
/cost month          # 月度成本報告
/cost forecast       # 預測下月成本
```

#### 6. `/calendar` - Google Calendar 整合

```
/calendar sync       # 同步待辦到 Calendar
/calendar today      # 今日行程
/calendar week       # 本週行程
```

---

## Phase 2: 強化 `/diagnose`

將資料庫查詢和 S3 查詢功能整合到 `/diagnose` skill：

- 排查問題時可直接查詢 Neon PostgreSQL
- 排查問題時可查詢 S3 音檔狀態
- 透過 skill 內部腳本實現，不需獨立 MCP

---

## Phase 3: Slack 功能整合

### 資料流程

```
[業務上傳音檔]
      │
      ▼
┌─────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐
│ Slack   │───▶│ Lambda   │───▶│ Groq      │───▶│ Gemini   │
│ Bot     │    │ 壓縮     │    │ Whisper   │    │ MEDDIC   │
└─────────┘    └──────────┘    └───────────┘    └──────────┘
      │                                               │
      │◀──────────────────────────────────────────────┘
      │              回傳分析結果
      ▼
[Slack Thread 通知]
```

### 功能分類

**A. 直接整合進現有流程（不需 MCP）**

| 功能 | 整合位置 | 優先級 | 說明 |
|------|---------|--------|------|
| update_message | queue-worker | P0 | 處理狀態變更時原地更新訊息 |
| download_file | queue-worker | P0 | 處理失敗時自動重新下載音檔重試 |

**B. 保留為 MCP（未來 Slack Agent 互動用）**

| 功能 | 優先級 | 說明 |
|------|--------|------|
| upload_file | P1 | /report --export 功能 |
| get_thread | P2 | 未來 Agent 互動時取得對話上下文 |
| schedule_message | P3 | Cron 已足夠，未來考慮 |
| delete_message | P3 | 手動清理用 |

---

## 可新增的 MCP 服務

### P0 - 高優先級

| MCP 服務 | 現狀 | 整合場景 |
|----------|------|---------|
| Neon PostgreSQL | Drizzle CLI 操作 | `/db`、`/report` 直接查詢 |
| AWS S3 | 手動 AWS Console | Lambda 音檔管理 |

### P1 - 中優先級

| MCP 服務 | 現狀 | 整合場景 |
|----------|------|---------|
| EVERY8D SMS | 已實作但無 MCP | 業務跟進提醒 |
| Slack Advanced | 功能有限 | `/slack` skill 後端 |

### P2 - 低優先級（Q2）

| MCP 服務 | 整合場景 |
|----------|---------|
| Google Gemini | 即時測試 prompts |
| Groq API | 直接轉錄音檔 |
| Salesforce CRM | MEDDIC 自動更新 |

---

## 實作時程

| 週次 | 項目 | 類型 |
|------|------|------|
| Week 1 | `/db`、`/analytics` | Skill |
| Week 1-2 | update_message、download_file 整合 | 直接整合 |
| Week 2 | `/pr`、`/slack` | Skill |
| Week 2 | 強化 `/diagnose` | Skill 優化 |
| Week 3 | `/cost`、`/calendar` | Skill |
| Q2 | Slack Advanced MCP | MCP |

---

## 驗證方式

- 執行 `/db status` 確認資料庫連線
- 執行 `/analytics meddic --user [業務名]` 驗證查詢功能
- 執行 `/diagnose` 驗證整合的查詢功能
- 測試 queue-worker 的 update_message 功能

---

## 相關文件

- [SKILL.md - /diagnose](.claude/skills/diagnose/SKILL.md)
- [SKILL.md - /report](.claude/skills/report/SKILL.md)
- [SKILL.md - /smart-deploy](.claude/skills/smart-deploy/SKILL.md)
