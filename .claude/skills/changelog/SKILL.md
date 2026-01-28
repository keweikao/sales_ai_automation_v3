---
name: changelog
description: 自動產生 Changelog。當發布新版本、完成多個功能、或用戶要求時自動執行。分析 commits 歷史，按類型分組，產生結構化的變更日誌。
allowed-tools:
  - Bash(git *)
  - Read
  - Glob
  - Write
---

# Changelog - 自動變更日誌

## 自動觸發時機

Claude 會在以下情況**自動執行**此 skill：

| 觸發情境 | 說明 |
|---------|------|
| 發布版本 | 準備發布新版本時 |
| 里程碑完成 | 完成多個功能/修復 |
| 用戶要求 | 「changelog」、「產生變更日誌」 |
| 定期總結 | 週/月總結 |

## Changelog 格式

遵循 [Keep a Changelog](https://keepachangelog.com/) 規範：

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- 新增的功能

### Changed
- 變更的功能

### Deprecated
- 即將移除的功能

### Removed
- 已移除的功能

### Fixed
- Bug 修復

### Security
- 安全相關修復

## [1.0.0] - 2026-01-28

### Added
- Initial release
```

## 執行流程

### 步驟 1: 分析 Commit 歷史

```bash
# 查看自上次 tag 以來的 commits
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# 或查看特定日期範圍
git log --since="2026-01-01" --oneline

# 查看所有 tags
git tag -l --sort=-version:refname
```

### 步驟 2: 分類 Commits

根據 Conventional Commit type 分類：

| Commit Type | Changelog Section |
|-------------|-------------------|
| `feat` | Added |
| `fix` | Fixed |
| `refactor` | Changed |
| `perf` | Changed |
| `docs` | Changed |
| `security` | Security |
| `deprecate` | Deprecated |
| `remove` | Removed |

### 步驟 3: 產生內容

對每個 commit：
1. 解析 type 和 scope
2. 提取 description
3. 關聯的 issue/PR

### 步驟 4: 輸出 Changelog

## 輸出格式

```markdown
## 📋 Changelog 產生完成

### 版本: v1.2.0 (2026-01-28)

---

## [1.2.0] - 2026-01-28

### Added
- **api**: 新增機會批量更新功能 ([#123](https://github.com/...))
- **web**: 新增 Dashboard 權限控制 ([#125](https://github.com/...))
- **slack-bot**: 新增競爭對手分析通知

### Changed
- **services**: 優化 LLM 呼叫效能
- **db**: 改進查詢效能

### Fixed
- **web**: 修復分頁顯示問題 ([#120](https://github.com/...))
- **api**: 修復新用戶角色更新失敗 ([#122](https://github.com/...))
- **queue-worker**: 修復 Slack 通知傳遞問題

### Security
- 更新依賴套件修復安全漏洞

---

### 統計
- **新功能**: 3
- **改進**: 2
- **修復**: 3
- **安全**: 1
- **總 Commits**: 15
- **貢獻者**: 2

### 相關 Issues
- Closes #120, #122, #123, #125
```

## 專案特定設定

### Changelog 存放位置

依照專案規範，changelog 應存放在：
```
.doc/YYYYMMDD_Changelog_vX.X.X.md
```

例如：`.doc/20260128_Changelog_v1.2.0.md`

### 版本號規則

遵循 [Semantic Versioning](https://semver.org/)：

```
MAJOR.MINOR.PATCH

MAJOR - 不相容的 API 變更
MINOR - 向後相容的新功能
PATCH - 向後相容的 Bug 修復
```

### 自動產生範圍

| 時機 | 包含範圍 |
|------|---------|
| 發布版本 | 自上次 tag 以來 |
| 週報 | 過去 7 天 |
| 月報 | 過去 30 天 |
| 里程碑 | 指定的 commit 範圍 |

## 進階功能

### 關聯 Issue/PR

```markdown
- 新增批量更新功能 ([#123](url))
- 修復分頁問題 (Fixes #120)
```

### 分 Scope 顯示

```markdown
### Added

#### API
- 新增批量更新 endpoint
- 新增搜尋 API

#### Web
- 新增 Dashboard
- 新增報表頁面

#### Slack Bot
- 新增通知功能
```

### Breaking Changes 標記

```markdown
### ⚠️ Breaking Changes
- API: `/api/v1/opportunities` 改為 `/api/v2/opportunities`
- 移除已棄用的 `legacyAuth` 函數
```

## 整合的工具

| 工具 | 用途 |
|------|------|
| `Bash(git)` | 讀取 commit 歷史 |
| `Read` | 讀取現有 changelog |
| `Write` | 寫入新 changelog |
| `Glob` | 找出相關文件 |

## 相關 Skills

- `/commit` - 確保 commit 格式正確
- `/pr-review` - PR 合併後更新 changelog
- `/report` - 產生其他報告
