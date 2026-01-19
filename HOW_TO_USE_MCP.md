# 如何使用 MCP 工具 - 完整指南

> 💡 **核心概念**: MCP 工具不是用來"手動呼叫"的,而是用來**自動化業務流程**的!

---

## 🎯 3 種使用方式

### 1. 自動化排程任務 ⏰ (最推薦)

**適合**: 週期性任務,例如週報、風險監控

**範例**: 每週一自動生成團隊報告

```bash
# 執行
bun run examples/01-weekly-team-report.ts
```

**流程**:
```
每週一 09:00 自動執行
    ↓
分析團隊數據 (generate_team_dashboard)
    ↓
匯出 CSV (export_analytics_to_sheets)
    ↓
上傳 Drive (gdrive_upload_report)
    ↓
建立會議 (calendar_create_event)
    ↓
Slack 通知團隊 ✅
```

**設定 Cron**:
```toml
# wrangler.toml (Cloudflare Workers)
[triggers]
crons = ["0 9 * * 1"]  # 每週一 09:00
```

---

### 2. Slack 即時命令 💬

**適合**: 臨時查詢、即時分析

**範例**: 在 Slack 中查詢團隊報告

**在 Slack 輸入**:
```
/analyze team week
```

**立即收到**:
```
📊 團隊績效報告 (week)

• 總對話數: 25
• 平均評分: 72.5/100
• 成交案件: 5 筆

🏆 Top Performers:
1. 張三 - 85.2/100
2. 李四 - 78.9/100
```

**實作**:
```bash
# 部署 Slack 命令處理器
bun run examples/03-slack-commands.ts
```

---

### 3. 事件驅動觸發 🔔

**適合**: 條件觸發,例如高風險商機警示

**範例**: 發現高風險商機時自動跟進

```typescript
// 每天下午 5:00 檢查
if (發現高風險商機) {
  → 自動排程跟進會議
  → 生成風險報告
  → Slack 警示 Manager
}
```

**執行**:
```bash
bun run examples/02-high-risk-opportunity-monitor.ts
```

---

## 🚀 快速開始 (5 分鐘)

### Step 1: 試跑第一個範例

```bash
# 安裝依賴
bun install

# 執行週報範例 (使用模擬數據)
bun run examples/01-weekly-team-report.ts
```

**預期輸出**:
```
📊 開始生成每週團隊報告...

🔄 Step 1: 分析團隊績效數據...
✅ 團隊報告生成完成
   總對話數: 25
   平均 MEDDIC 評分: 72.5/100
   成交案件: 5

🔄 Step 2: 匯出 CSV 數據...
✅ CSV 匯出成功: reports/team-performance.csv

🔄 Step 3: 上傳報告到 Google Drive...
✅ 報告已上傳到 Google Drive
   連結: https://drive.google.com/file/d/...

🔄 Step 4: 建立週報討論會議...
✅ 會議已建立
   時間: 2026-01-20 10:00:00

🔄 Step 5: 發送 Slack 通知...
✅ Slack 通知已發送

🎉 每週團隊報告流程完成!
```

---

### Step 2: 查看生成的檔案

```bash
# 查看生成的報告
ls -la reports/

# 輸出:
# Team-Dashboard-2026-01-15.md  ← Markdown 報告
# team-performance.csv           ← CSV 數據
```

---

### Step 3: 設定自動執行

**選項 A: Cloudflare Workers (推薦)**

```toml
# wrangler.toml
[triggers]
crons = ["0 9 * * 1"]  # 每週一 09:00
```

```typescript
// worker.ts
export default {
  async scheduled(event, env, ctx) {
    await generateWeeklyTeamReport();
  }
}
```

**選項 B: Node.js Cron**

```typescript
import cron from 'node-cron';

cron.schedule('0 9 * * 1', async () => {
  await generateWeeklyTeamReport();
});
```

---

## 📖 3 個實用範例

### 範例 1: 每週團隊報告

**檔案**: `examples/01-weekly-team-report.ts`

**功能**:
- 分析團隊績效 (過去 7 天)
- 匯出 CSV 數據
- 上傳到 Google Drive
- 建立週會 Calendar 事件
- Slack 通知團隊

**使用的工具** (6 個):
1. `generate_team_dashboard`
2. `export_analytics_to_sheets`
3. `filesystem_read`
4. `gdrive_upload_report`
5. `calendar_create_event`
6. `slack_post_formatted_analysis`

**節省時間**: 2 小時 → 30 秒 (99.6%)

---

### 範例 2: 高風險商機監控

**檔案**: `examples/02-high-risk-opportunity-monitor.ts`

**功能**:
- 預測所有商機成交機率
- 識別高風險商機 (>= 3 個風險因素)
- 自動排程跟進會議 (包含 Talk Track)
- 生成風險報告
- Slack 警示 Sales Manager

**使用的工具** (4 個):
1. `forecast_opportunities`
2. `calendar_schedule_follow_up`
3. `gdrive_upload_report`
4. `slack_post_alert`

**節省時間**: 4 小時 → 1 分鐘 (99.6%)

---

### 範例 3: Slack 命令整合

**檔案**: `examples/03-slack-commands.ts`

**功能**:
- `/analyze team [period]` - 團隊報告
- `/analyze rep [user-id]` - 個人報告
- `/forecast` - 商機預測
- `/schedule-follow-up [opp-id]` - 排程跟進

**使用方式**:
```
/analyze team week
/forecast
/schedule-follow-up opp-123
```

**部署**: Cloudflare Worker

---

## 🛠️ 自訂您的自動化

### 建立新的工作流程

```typescript
import { createFullMCPServer } from './packages/services/src/mcp/server.js';

async function myCustomWorkflow() {
  const server = createFullMCPServer();

  // 1. 使用任何 MCP 工具
  const teamReport = await server.executeTool(
    'generate_team_dashboard',
    { period: 'month' },
    { timestamp: new Date() }
  );

  // 2. 組合多個工具
  const csv = await server.executeTool(
    'export_analytics_to_sheets',
    { dataType: 'team', period: 'month' },
    { timestamp: new Date() }
  );

  // 3. 條件執行
  if (teamReport.teamMetrics.avgMeddicScore < 70) {
    await sendAlertToManager(teamReport);
  }

  // 4. 返回結果
  return {
    reportGenerated: true,
    csvPath: csv.filePath,
    avgScore: teamReport.teamMetrics.avgMeddicScore,
  };
}
```

---

## 🔧 可用的 59 個工具

### Analytics (4 tools)
```typescript
// 團隊報告
await server.executeTool('generate_team_dashboard', {
  period: 'week',
  generateReport: true,
});

// 個人報告
await server.executeTool('generate_rep_performance', {
  repId: 'user-123',
  period: 'month',
});

// 商機預測
await server.executeTool('forecast_opportunities', {
  minMeddicScore: 50,
  includeRiskFactors: true,
});

// 匯出數據
await server.executeTool('export_analytics_to_sheets', {
  dataType: 'team',
  format: 'csv',
});
```

### Google Drive (4 tools)
```typescript
// 上傳報告
await server.executeTool('gdrive_upload_report', {
  reportContent: '# Report...',
  fileName: 'report.md',
});

// 建立資料夾
await server.executeTool('gdrive_create_folder', {
  folderName: '2026-01',
});

// 設定分享
await server.executeTool('gdrive_share_file', {
  fileId: 'file-id',
  type: 'anyone',
});

// 搜尋檔案
await server.executeTool('gdrive_search_files', {
  query: 'Team-Dashboard',
});
```

### Google Calendar (5 tools)
```typescript
// 排程跟進
await server.executeTool('calendar_schedule_follow_up', {
  opportunityId: 'opp-123',
  scheduledFor: 'next_week',
});

// 建立事件
await server.executeTool('calendar_create_event', {
  title: '週報會議',
  startTime: '2026-01-20T10:00:00+08:00',
});

// 列出事件
await server.executeTool('calendar_list_events', {
  timeMin: new Date().toISOString(),
});
```

**完整工具清單**: 參見 [MCP_Tools_Complete_Overview.md](.doc/20260115_MCP_Tools_Complete_Overview.md)

---

## 💡 實用技巧

### 技巧 1: 組合多個工具

```typescript
// 生成報告 → 上傳 → 分享 → 通知
const report = await server.executeTool('generate_team_dashboard', ...);
const file = await server.executeTool('gdrive_upload_report', ...);
await server.executeTool('gdrive_share_file', ...);
await slackPostFormattedAnalysisTool.handler(...);
```

---

### 技巧 2: 條件執行

```typescript
const forecast = await server.executeTool('forecast_opportunities', ...);

if (forecast.summary.highRiskCount > 5) {
  // 高風險商機過多,立即警示
  await slackPostAlertTool.handler({
    message: `⚠️ 發現 ${forecast.summary.highRiskCount} 個高風險商機!`,
    severity: 'critical',
  });
}
```

---

### 技巧 3: 錯誤處理

```typescript
const result = await server.safeExecuteTool('tool_name', input, context);

if (!result.success) {
  console.error('錯誤:', result.error);
  // 發送警示
  await slackPostAlertTool.handler({
    message: `❌ 自動化失敗: ${result.error}`,
  });
}
```

---

### 技巧 4: 批次處理

```typescript
const opportunities = [...];

for (const opp of opportunities.slice(0, 10)) {  // 限制最多 10 個
  await server.executeTool('calendar_schedule_follow_up', {
    opportunityId: opp.id,
    scheduledFor: 'next_week',
  });

  // 延遲避免過載
  await new Promise(r => setTimeout(r, 1000));
}
```

---

## 📊 效益對比

### 週報生成

| 步驟 | 原本 | MCP 自動化 |
|------|------|-----------|
| 查詢數據 | 30 分鐘 | 自動 |
| 整理報告 | 60 分鐘 | 自動 |
| 上傳分享 | 10 分鐘 | 自動 |
| 建立會議 | 10 分鐘 | 自動 |
| 通知團隊 | 10 分鐘 | 自動 |
| **總計** | **2 小時** | **30 秒** |

**節省**: 99.6% 時間

---

### 商機監控

| 步驟 | 原本 | MCP 自動化 |
|------|------|-----------|
| 檢視商機 | 60 分鐘 | 自動 |
| 計算評分 | 45 分鐘 | 自動 |
| 識別風險 | 30 分鐘 | 自動 |
| 排程會議 | 50 分鐘 | 自動 |
| 準備議程 | 75 分鐘 | 自動 |
| **總計** | **4 小時** | **1 分鐘** |

**節省**: 99.6% 時間

---

## 🎯 下一步行動

### 立即可做 ✅
1. 執行範例: `bun run examples/01-weekly-team-report.ts`
2. 查看生成的報告
3. 理解工作流程

### 本週目標 📅
1. 設定 Google OAuth (如需 Drive/Calendar)
2. 部署第一個自動化 (週報)
3. 測試 Slack 命令

### 下週目標 🚀
1. 部署風險監控
2. 設定 Cron Job
3. 團隊培訓

---

## 📚 完整文檔

- **[examples/README.md](examples/README.md)** - 範例說明
- **[MCP_Practical_Applications.md](.doc/20260115_MCP_Practical_Applications.md)** - 實際應用詳解
- **[Quick_Start_Guide.md](.doc/20260115_Quick_Start_Guide.md)** - 工具使用指南
- **[MCP_Tools_Complete_Overview.md](.doc/20260115_MCP_Tools_Complete_Overview.md)** - 59 工具總覽

---

## ❓ 常見問題

**Q: MCP 工具是用來手動呼叫的嗎?**
A: 不是!MCP 工具是用來**建立自動化工作流程**的。設定後自動執行,不需要人工介入。

**Q: 我需要學習所有 59 個工具嗎?**
A: 不需要!從 3 個範例開始,理解工作流程概念即可。

**Q: 如何自訂我的工作流程?**
A: 參考範例腳本,組合不同的 MCP 工具即可。

**Q: 可以在 Slack 中即時查詢嗎?**
A: 可以!部署 `examples/03-slack-commands.ts` 即可使用 `/analyze` 等命令。

---

## ✅ 總結

**MCP 工具的核心價值**:
- 🤖 **自動化** - 設定後自動執行
- 🔗 **組合** - 建立端到端工作流程
- ⚡ **即時** - Slack 命令即時查詢
- 🎯 **智能** - 條件觸發,事件驅動

**不是**: 手動呼叫 API
**而是**: 智能自動化系統

**現在開始**:
```bash
bun run examples/01-weekly-team-report.ts
```

🚀 **準備好自動化您的銷售流程了嗎?**

