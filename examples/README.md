# MCP 工具實際應用範例

這個資料夾包含了實際業務場景中如何使用 59 個 MCP 工具的完整範例。

---

## 📚 範例清單

### 1. 每週自動團隊報告 (`01-weekly-team-report.ts`)

**使用場景**: 每週一上午自動生成團隊績效報告

**使用的 MCP 工具**:
- `generate_team_dashboard` - 分析團隊績效
- `export_analytics_to_sheets` - 匯出 CSV 數據
- `filesystem_read` - 讀取報告檔案
- `gdrive_upload_report` - 上傳到 Google Drive
- `gdrive_share_file` - 設定公開分享
- `calendar_create_event` - 建立週會
- `slack_post_formatted_analysis` - Slack 通知

**執行方式**:
```bash
# 手動執行
bun run examples/01-weekly-team-report.ts

# 設定 Cron Job (每週一 09:00)
# 在 wrangler.toml 中:
[triggers]
crons = ["0 9 * * 1"]
```

**流程**:
```
分析團隊數據 → 匯出 CSV → 上傳 Drive → 設定分享 → 建立會議 → Slack 通知
```

**產出**:
- ✅ Markdown 團隊報告 (本地)
- ✅ CSV 數據檔案 (可匯入 Sheets)
- ✅ Google Drive 報告 (公開連結)
- ✅ Calendar 週會事件
- ✅ Slack 通知給團隊

---

### 2. 高風險商機監控 (`02-high-risk-opportunity-monitor.ts`)

**使用場景**: 每天自動識別並跟進高風險商機

**使用的 MCP 工具**:
- `forecast_opportunities` - 商機預測
- `calendar_schedule_follow_up` - 自動排程跟進
- `gdrive_upload_report` - 上傳風險報告
- `slack_post_alert` - 發送警示

**執行方式**:
```bash
# 手動執行
bun run examples/02-high-risk-opportunity-monitor.ts

# 設定 Cron Job (每天 17:00)
[triggers]
crons = ["0 17 * * *"]
```

**流程**:
```
商機預測 → 識別高風險 (>= 3 個風險因素) → 自動排程會議 → 生成報告 → Slack 警示
```

**高風險條件**:
- 風險因素 >= 3 個
- 成交機率 < 50%
- 商機金額 > $10,000

**產出**:
- ✅ 高風險商機列表
- ✅ 自動排程的跟進會議 (48 小時內)
- ✅ 包含 Talk Track 的會議描述
- ✅ Google Drive 風險報告
- ✅ Slack 警示給 Sales Manager

---

### 3. Slack 命令整合 (`03-slack-commands.ts`)

**使用場景**: 在 Slack 中使用斜線命令快速存取 MCP 工具

**支援的命令**:
```
/analyze team [week|month|quarter]  - 生成團隊報告
/analyze rep [user-id] [period]     - 生成個人報告
/forecast                           - 商機預測
/schedule-follow-up [opp-id]        - 排程跟進
/help                               - 顯示幫助
```

**執行方式**:
```bash
# 本地測試
bun run examples/03-slack-commands.ts

# 部署為 Cloudflare Worker
cd packages/slack-bot
wrangler deploy
```

**使用範例**:

在 Slack 中輸入:
```
/analyze team week
```

立即收到回覆:
```
📊 團隊績效報告 (week)

整體表現:
• 總對話數: 25
• 平均 MEDDIC 評分: 72.5/100
• 成交案件: 5 筆
• 平均交易額: $45,000
• 活躍業務: 8 人

🏆 Top Performers:
1. 張三 - 85.2/100
2. 李四 - 78.9/100
3. 王五 - 76.3/100
...
```

**Slack App 設定**:
1. 建立 Slack App
2. 新增 Slash Commands:
   - `/analyze` → `https://your-worker.workers.dev/analyze`
   - `/forecast` → `https://your-worker.workers.dev/forecast`
   - `/schedule-follow-up` → `https://your-worker.workers.dev/schedule`
3. 設定 Verification Token
4. 安裝到 Workspace

---

## 🚀 快速開始

### 1. 執行單一範例

```bash
# 安裝依賴
bun install

# 執行範例
bun run examples/01-weekly-team-report.ts
```

### 2. 設定 Cron Job (Cloudflare Workers)

**在 `wrangler.toml` 中**:
```toml
[triggers]
crons = [
  "0 9 * * 1",   # 每週一 09:00 - 團隊報告
  "0 17 * * *"   # 每天 17:00 - 風險監控
]
```

**在 Worker 中**:
```typescript
import { generateWeeklyTeamReport } from './examples/01-weekly-team-report.js';
import { monitorHighRiskOpportunities } from './examples/02-high-risk-opportunity-monitor.js';

export default {
  async scheduled(event, env, ctx) {
    const hour = new Date().getHours();
    const day = new Date().getDay();

    // 週一 09:00 - 團隊報告
    if (day === 1 && hour === 9) {
      await generateWeeklyTeamReport();
    }

    // 每天 17:00 - 風險監控
    if (hour === 17) {
      await monitorHighRiskOpportunities();
    }
  }
}
```

### 3. 本地 Cron Job (Node.js)

```typescript
import cron from 'node-cron';
import { generateWeeklyTeamReport } from './examples/01-weekly-team-report.js';
import { monitorHighRiskOpportunities } from './examples/02-high-risk-opportunity-monitor.js';

// 每週一 09:00
cron.schedule('0 9 * * 1', async () => {
  console.log('🕐 觸發每週團隊報告...');
  await generateWeeklyTeamReport();
});

// 每天 17:00
cron.schedule('0 17 * * *', async () => {
  console.log('🕐 觸發商機風險監控...');
  await monitorHighRiskOpportunities();
});

console.log('⏰ Cron jobs 已設定');
```

---

## 🛠️ 自訂範例

### 建立新的自動化工作流程

```typescript
import { createFullMCPServer } from '../packages/services/src/mcp/server.js';

async function myCustomWorkflow() {
  const server = createFullMCPServer();

  // Step 1: 使用任何 MCP 工具
  const result = await server.executeTool(
    'generate_team_dashboard',
    { period: 'month' },
    { timestamp: new Date() }
  );

  // Step 2: 處理結果
  console.log(result);

  // Step 3: 組合多個工具
  // ...
}
```

### 可用的 59 個 MCP 工具

**Analytics (4 tools)**:
- `generate_team_dashboard`
- `generate_rep_performance`
- `forecast_opportunities`
- `export_analytics_to_sheets`

**Google Drive (4 tools)**:
- `gdrive_upload_report`
- `gdrive_create_folder`
- `gdrive_share_file`
- `gdrive_search_files`

**Google Calendar (5 tools)**:
- `calendar_schedule_follow_up`
- `calendar_create_event`
- `calendar_list_events`
- `calendar_update_event`
- `calendar_delete_event`

**完整工具清單**: 參見 [MCP_Tools_Complete_Overview.md](../.doc/20260115_MCP_Tools_Complete_Overview.md)

---

## 📊 實際效益

### 範例 1: 每週團隊報告

**原本流程**:
1. 手動查詢資料庫 (30 分鐘)
2. 整理數據到 Excel (60 分鐘)
3. 撰寫報告 (30 分鐘)
4. Email 給團隊 (10 分鐘)
5. 建立 Calendar 事件 (10 分鐘)

**總時間**: 2 小時 20 分鐘

**使用 MCP 自動化後**:
1. 一鍵執行腳本 (30 秒)

**節省時間**: 99.6% 🚀

---

### 範例 2: 高風險商機監控

**原本流程**:
1. 手動檢視所有商機 (60 分鐘)
2. 計算 MEDDIC 評分 (45 分鐘)
3. 識別風險因素 (30 分鐘)
4. 排程跟進會議 (每個 10 分鐘 × 5 = 50 分鐘)
5. 準備會議議程 (每個 15 分鐘 × 5 = 75 分鐘)

**總時間**: 4 小時 20 分鐘

**使用 MCP 自動化後**:
1. 自動執行 (1 分鐘)

**節省時間**: 99.6% 🚀

---

## 💡 最佳實踐

### 1. 錯誤處理

```typescript
const result = await server.safeExecuteTool('tool_name', input, context);

if (!result.success) {
  // 發送 Slack 警示
  await slackPostAlertTool.handler({
    channelId: process.env.SLACK_ALERTS_CHANNEL,
    message: `❌ 自動化流程失敗: ${result.error}`,
    severity: 'error',
  });

  throw new Error(result.error);
}
```

### 2. 條件執行

```typescript
// 只在有新數據時執行
const dashboard = await server.executeTool('generate_team_dashboard', ...);

if (dashboard.teamMetrics.totalConversations > 0) {
  // 上傳報告
  await server.executeTool('gdrive_upload_report', ...);
}
```

### 3. 批次處理

```typescript
// 處理多個商機
for (const opp of highRiskOpportunities.slice(0, 10)) {  // 限制最多 10 個
  await server.executeTool('calendar_schedule_follow_up', {
    opportunityId: opp.id,
    scheduledFor: 'next_week',
  });
}
```

### 4. 日誌記錄

```typescript
console.log(`✅ 報告已生成: ${reportPath}`);
console.log(`📊 總對話數: ${teamMetrics.totalConversations}`);
console.log(`💰 成交案件: ${teamMetrics.dealsClosed}`);

// 記錄到資料庫供審計
await logAutomationEvent({
  type: 'weekly_report',
  status: 'success',
  metadata: { conversationCount: teamMetrics.totalConversations },
});
```

---

## 🎯 下一步

1. **執行範例**: 試試三個範例腳本
2. **自訂工作流程**: 根據業務需求修改範例
3. **設定 Cron**: 配置自動化排程
4. **監控執行**: 設定 Slack 警示
5. **持續優化**: 根據實際使用調整

---

## 📚 相關文檔

- [Quick_Start_Guide.md](../.doc/20260115_Quick_Start_Guide.md) - 工具使用指南
- [MCP_Tools_Complete_Overview.md](../.doc/20260115_MCP_Tools_Complete_Overview.md) - 59 工具總覽
- [Phase4_Complete.md](../.doc/20260115_Phase4_Complete.md) - Phase 4 詳細報告

---

**有問題?** 查看文檔或聯繫開發團隊。

**準備好開始了嗎?** 執行 `bun run examples/01-weekly-team-report.ts` 看看效果!

