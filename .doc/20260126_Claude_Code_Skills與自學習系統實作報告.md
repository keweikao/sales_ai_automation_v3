# Claude Code Skills 與自學習系統實作報告

## 實作日期
2026-01-26

## 實作摘要

本次實作為專案建立了兩個自定義 Skills，並整合了 claude-reflect 自學習系統，提升 Claude Code 的工作效率和知識累積能力。

---

## 一、Skills 需求分析

### 專案日常運作適合新增 Skills 的項目

| 優先級 | Skill | 原因 |
|--------|-------|------|
| 高 | `/diagnose` | 生產問題排查頻繁，需整合多個工具 |
| 高 | `/smart-deploy` | 部署流程複雜，容易出錯 |
| 中 | `/test` | 測試類型多，選擇複雜 |
| 中 | `/slack-diagnose` | Slack Bot 是核心功能 |
| 低 | `/db` | 指令相對簡單 |

### Skills 效益最大化配合策略

1. **Skills + MCP 服務器** - 整合 cloudflare-observability、cloudflare-bindings、github 等
2. **Skills + Subagents** - 使用 Explore、Plan、code-reviewer 等 agents
3. **Skills + 專案知識庫** - 自動引用 `.doc/` 中的排查文件
4. **Skills + 現有 Scripts** - 封裝 `scripts/` 目錄中的工具腳本

---

## 二、已建立的 Skills

### 2.1 `/diagnose` - 生產問題快速診斷

**檔案位置：** `.claude/skills/diagnose/SKILL.md`

**功能：**
- 分析症狀並分類問題（Slack Bot、Queue Worker、API、轉錄、AI 分析、資料庫）
- 自動搜尋 `.doc/` 知識庫中的相關排查文件
- 使用 `cloudflare-observability` MCP 查詢 Workers 日誌
- 定位問題代碼並提供解決建議

**使用方式：**
```
/diagnose slack bot 沒有回應
/diagnose queue worker 處理失敗
/diagnose API 回傳 500 錯誤
```

**整合的工具：**
| 工具 | 用途 |
|------|------|
| `cloudflare-observability` MCP | 查詢 Workers 日誌和指標 |
| `Explore` subagent | 深入理解代碼結構 |
| `Grep` / `Read` | 搜尋和閱讀代碼 |
| `Glob` | 搜尋相關文件 |
| `Bash` | 執行診斷腳本 |

**關聯的知識庫文件：**
- `.doc/20260113_Slack_Bot問題排查手冊.md`
- `.doc/20260113_Gemini_API錯誤處理改進文檔.md`
- `.doc/20260113_Groq_Whisper錯誤處理改進文檔.md`
- `.doc/20260121_Share_API_500錯誤修復報告.md`

---

### 2.2 `/smart-deploy` - 智慧部署流程

**檔案位置：** `.claude/skills/smart-deploy/SKILL.md`

**功能：**
- 自動檢測 git 變更範圍，判斷需要部署的應用
- 執行前置檢查（ultracite check、type-check、test）
- 依正確順序部署（queue-worker → server → slack-bot）
- 使用 `cloudflare-observability` 進行部署後健康檢查
- 異常時提供回滾機制

**使用方式：**
```
/smart-deploy                # 部署有變更的應用
/smart-deploy server         # 只部署 API Server
/smart-deploy queue-worker   # 只部署 Queue Worker
/smart-deploy --all          # 部署所有應用
```

**部署順序：**
1. queue-worker - 先部署背景處理服務
2. server - 再部署 API 服務
3. slack-bot - 最後部署前端入口

**整合的工具：**
| 工具 | 用途 |
|------|------|
| `cloudflare-observability` MCP | 部署後監控和日誌查詢 |
| `cloudflare-bindings` MCP | 確認 KV/R2/D1 綁定配置 |
| `github` MCP | 更新 PR 狀態 |
| `Bash` | 執行部署命令 |

**關聯的部署腳本：**
- `scripts/deploy.sh`
- `scripts/deploy-and-test.sh`
- `scripts/rollback.sh`

---

## 三、Skills 目錄結構

```
.claude/
├── CLAUDE.md
├── settings.json
├── settings.local.json
└── skills/
    ├── diagnose/
    │   └── SKILL.md
    └── smart-deploy/
        └── SKILL.md
```

### SKILL.md 格式說明

每個 Skill 需要：
1. 放在獨立目錄中（目錄名即 skill 名稱）
2. 檔案必須命名為 `SKILL.md`
3. 頂部需要 YAML 前置事項（frontmatter）

**前置事項範例：**
```yaml
---
name: diagnose
description: 快速診斷生產環境問題...
allowed-tools:
  - Bash(*)
  - Read
  - Glob
---
```

---

## 四、Claude Reflect 自學習系統

### 安裝資訊

```bash
# 已執行的安裝命令
claude plugin marketplace add bayramannakov/claude-reflect
claude plugin install claude-reflect@claude-reflect-marketplace
```

**安裝結果：**
- ✅ Successfully added marketplace: claude-reflect-marketplace
- ✅ Successfully installed plugin: claude-reflect@claude-reflect-marketplace

### 系統功能

**自動捕捉修正：**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  用戶糾正 Claude │ ──► │  Hook 自動捕捉   │ ──► │  /reflect 同步   │
│  "不對，用 X"    │     │  到待學習佇列    │     │  到 CLAUDE.md   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 可用命令

| 命令 | 功能 |
|------|------|
| `/reflect` | 處理待學習項目，人工審核後同步到 CLAUDE.md |
| `/reflect --scan-history` | 掃描所有歷史對話，找出遺漏的學習內容 |
| `/reflect-skills` | 分析對話模式，自動生成可重用的 Skills |
| `/view-queue` | 查看待處理的學習項目 |
| `/skip-reflect` | 丟棄所有待學習項目 |

### 與現有 Skills 的整合效益

| 現有 Skill | + Claude Reflect | 效益 |
|------------|------------------|------|
| `/diagnose` | 自動學習排查經驗 | 每次排查問題後，學習到的經驗會同步到 CLAUDE.md |
| `/smart-deploy` | 自動學習部署偏好 | 部署時的修正會改進 skill 本身 |

**範例流程：**
```
用戶：/smart-deploy
Claude：[部署時沒有先跑測試]
用戶：「不對，要先跑測試再部署」

→ /reflect 偵測到這個修正
→ 詢問是否更新 smart-deploy skill
→ Skill 自動加入「先跑測試」步驟
```

---

## 五、使用建議

### 日常使用流程

1. **問題排查時：**
   ```
   /diagnose [症狀描述]
   ```

2. **部署時：**
   ```
   /smart-deploy
   ```

3. **每次工作結束後：**
   ```
   /reflect
   ```

4. **定期（每月）：**
   ```
   /reflect-skills --days 30
   ```

### 首次使用建議

重啟 Claude Code 後執行：
```
/reflect --scan-history
```
掃描過去所有對話，找出可以學習的修正內容。

---

## 六、後續優化方向

1. **新增更多 Skills：**
   - `/test-suite` - 測試套件管理
   - `/slack-diagnose` - Slack Bot 專屬診斷
   - `/db` - 資料庫操作

2. **知識庫整合：**
   - 建立更多問題排查文件
   - 定期執行 `/reflect --dedupe` 清理重複學習內容

3. **自動化改進：**
   - 設定 git hook 在 commit 後自動提醒 `/reflect`
   - 部署後自動執行健康檢查

---

## 相關文件

- `.claude/skills/diagnose/SKILL.md`
- `.claude/skills/smart-deploy/SKILL.md`
- `.doc/20260113_Slack_Bot問題排查手冊.md`
- `.doc/20260115_Queue架構部署指南.md`
- `scripts/deploy.sh`
- `scripts/deploy-and-test.sh`
