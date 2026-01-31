# MCP Servers 連線問題修復報告

**日期**: 2026-01-31
**問題**: Claude Code 啟動時顯示「3 MCP servers failed」

---

## 問題描述

啟動 Claude Code 時，以下 3 個 MCP servers 連線失敗：

| Server | 原始錯誤 |
|--------|----------|
| `plugin:github:github` | Failed to connect (HTTP endpoint) |
| `cloudflare` | Failed to connect |
| `neon` | Failed to connect |

---

## 根本原因分析

### 1. plugin:github:github (GitHub Copilot MCP)

- **原因**: 這是 GitHub Copilot 官方插件，連接到 `https://api.githubcopilot.com/mcp/`
- **問題**: 需要 GitHub Copilot 訂閱才能使用
- **影響**: 專案已有另一個正常運作的 `github` MCP server（使用 Personal Access Token）

### 2. cloudflare

- **原因**: 缺少必要的啟動命令和環境變數
- **問題**:
  - MCP server 需要 `run` 子命令才能啟動
  - 缺少 `CLOUDFLARE_ACCOUNT_ID` 環境變數

### 3. neon

- **原因**: API key 傳遞方式錯誤
- **問題**: Neon MCP server 需要透過命令列參數傳遞 API key，而非環境變數

---

## 解決方案

### 1. 停用 GitHub Copilot 插件

修改 `~/.claude/settings.json`：

```json
{
  "enabledPlugins": {
    "github@claude-plugins-official": false  // 改為 false
  }
}
```

### 2. 修復 Cloudflare MCP 設定

修改 `.mcp.json`：

```json
{
  "cloudflare": {
    "command": "npx",
    "args": ["-y", "@cloudflare/mcp-server-cloudflare", "run"],  // 加入 "run"
    "env": {
      "CLOUDFLARE_ACCOUNT_ID": "2b14cb05a60d60ad55427f4dd7570b90"  // 加入 Account ID
    }
  }
}
```

**取得 Account ID 方式**:
```bash
bunx wrangler whoami
```

### 3. 修復 Neon MCP 設定

修改 `.mcp.json`：

```json
{
  "neon": {
    "command": "npx",
    "args": [
      "-y",
      "@neondatabase/mcp-server-neon",
      "start",                           // 加入 "start" 子命令
      "<NEON_API_KEY>"                   // API key 改為 args 傳遞
    ]
    // 移除 env 區塊
  }
}
```

---

## 修改的檔案

1. **`~/.claude/settings.json`** - 停用 GitHub Copilot 插件
2. **`.mcp.json`** - 修復 cloudflare 和 neon 設定
3. **`~/.claude.json`** - 同步更新 neon 設定（快取）

---

## 驗證結果

修復後執行 `claude mcp list`：

```
✓ plugin:context7:context7  - Connected
✓ plugin:playwright:playwright - Connected
✓ cloudflare - Connected
✓ neon - Connected
✓ github - Connected
✓ context7 - Connected
```

所有 MCP servers 正常連線。

---

## 最終 .mcp.json 設定參考

```json
{
  "mcpServers": {
    "cloudflare": {
      "command": "npx",
      "args": ["-y", "@cloudflare/mcp-server-cloudflare", "run"],
      "env": {
        "CLOUDFLARE_ACCOUNT_ID": "<YOUR_ACCOUNT_ID>"
      }
    },
    "neon": {
      "command": "npx",
      "args": ["-y", "@neondatabase/mcp-server-neon", "start", "<YOUR_NEON_API_KEY>"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<YOUR_GITHUB_PAT>"
      }
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

---

## 注意事項

1. **Cloudflare**: 需要先執行 `bunx wrangler login` 完成 OAuth 認證
2. **Neon**: API key 可從 [Neon Console](https://neon.tech/docs/manage/api-keys) 取得
3. **GitHub**: Personal Access Token 需要適當的 repo 權限
