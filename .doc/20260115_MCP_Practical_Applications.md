# MCP 工具實際應用指南

**日期**: 2026-01-15
**目的**: 展示如何在真實業務場景中使用 59 個 MCP 工具

---

## 📋 概述

MCP (Model Context Protocol) 工具不是用來"手動呼叫"的 - 而是用來**自動化業務流程**的。

這份文檔展示 3 種實際應用方式:
1. **自動化排程任務** - Cron Jobs
2. **即時互動工具** - Slack 命令
3. **事件驅動流程** - Webhooks/Triggers

---

## 🎯 實際應用場景

### 場景 1: 每週自動團隊報告 📊

**業務需求**:
> 每週一上午 9:00,Sales Manager 希望收到上週的團隊績效報告,包含 Top Performers、成交案件、需要支持的業務等資訊。

**原本做法** (2 小時):
1. 手動查詢資料庫
2. 整理數據到 Excel
3. 撰寫 Email
4. 建立週會 Calendar 事件

**使用 MCP 自動化** (30 秒):
```typescript
// 自動執行的腳本
async function generateWeeklyTeamReport() {
  const server = createFullMCPServer();

  // 1. 生成報告 (1 個工具)
  const dashboard = await server.executeTool('generate_team_dashboard', {
    period: 'week',
    generateReport: true,
  });

  // 2. 匯出 CSV (1 個工具)
  const csv = await server.executeTool('export_analytics_to_sheets', {
    dataType: 'team',
    period: 'week',
  });

  // 3. 上傳到 Drive (2 個工具)
  const drive = await server.executeTool('gdrive_upload_report', {
    reportContent: reportContent,
    fileName: 'Team-Report.md',
  });

  await server.executeTool('gdrive_share_file', {
    fileId: drive.fileId,
    type: 'anyone',
  });

  // 4. 建立會議 (1 個工具)
  const meeting = await server.executeTool('calendar_create_event', {
    title: '週報討論會議',
    description: `報告: ${drive.webViewLink}`,
    startTime: nextMondayAt10AM,
  });

  // 5. Slack 通知 (1 個工具)
  await slackPostFormattedAnalysisTool.handler({
    channelId: TEAM_CHANNEL,
    text: `📊 週報已生成!\n報告: ${drive.webViewLink}\n會議: ${meeting.htmlLink}`,
  });
}
```

**設定自動執行**:
```toml
# wrangler.toml
[triggers]
crons = ["0 9 * * 1"]  # 每週一 09:00
```

**結果**:
- ✅ 自動生成報告
- ✅ 自動上傳到 Drive
- ✅ 自動建立週會
- ✅ 自動通知團隊
- ⚡ **節省 99.6% 時間**

**完整範例**: `examples/01-weekly-team-report.ts`

---

### 場景 2: 高風險商機自動跟進 ⚠️

**業務需求**:
> 每天下午 5:00,系統自動識別高風險商機 (MEDDIC 評分低、有多個風險因素),自動排程跟進會議,並通知 Sales Manager。

**原本做法** (4 小時):
1. 手動檢視所有商機
2. 計算 MEDDIC 評分
3. 識別風險因素
4. 逐個排程跟進會議
5. 準備會議議程

**使用 MCP 自動化** (1 分鐘):
```typescript
async function monitorHighRiskOpportunities() {
  const server = createFullMCPServer();

  // 1. 商機預測 (1 個工具)
  const forecast = await server.executeTool('forecast_opportunities', {
    minMeddicScore: 40,
    includeRiskFactors: true,
  });

  // 2. 識別高風險
  const highRisk = forecast.forecasts.filter(opp =>
    opp.riskFactors.length >= 3 &&  // >= 3 個風險因素
    opp.winProbability < 50 &&       // 成交機率 < 50%
    opp.estimatedValue > 10000       // 金額 > $10K
  );

  // 3. 自動排程跟進 (為每個商機)
  for (const opp of highRisk.slice(0, 5)) {
    await server.executeTool('calendar_schedule_follow_up', {
      opportunityId: opp.id,
      title: `🚨 高風險商機跟進: ${opp.accountName}`,
      scheduledFor: 'next_week',  // 下週
      talkTrack: generateTalkTrack(opp.riskFactors),  // 自動生成話術
    });
  }

  // 4. 上傳風險報告
  const report = await server.executeTool('gdrive_upload_report', {
    reportContent: generateRiskReport(highRisk),
    fileName: 'High-Risk-Opportunities.md',
  });

  // 5. Slack 警示
  await slackPostAlertTool.handler({
    channelId: ALERTS_CHANNEL,
    message: `⚠️ 發現 ${highRisk.length} 個高風險商機\n報告: ${report.webViewLink}`,
    severity: 'warning',
  });
}
```

**設定自動執行**:
```toml
[triggers]
crons = ["0 17 * * *"]  # 每天 17:00
```

**Talk Track 自動生成**:
```typescript
function generateTalkTrack(riskFactors) {
  const talkTrack = ["# 會議 Talk Track\n"];

  if (riskFactors.includes("定量指標不明確")) {
    talkTrack.push(`
### 確認定量指標
**話術**: "我們想更深入了解這個專案對貴公司的具體影響。能否分享一下您期望透過這個解決方案達成的具體數字目標?"
    `);
  }

  if (riskFactors.includes("未接觸到經濟決策者")) {
    talkTrack.push(`
### 接觸經濟決策者
**話術**: "為了確保這個專案能順利推進,能否安排一次會議,讓有預算決策權的主管也一起參與討論?"
    `);
  }

  // ... 其他風險因素的話術

  return talkTrack.join("\n");
}
```

**結果**:
- ✅ 自動識別高風險
- ✅ 自動排程跟進 (包含 Talk Track)
- ✅ 自動生成風險報告
- ✅ 自動通知 Manager
- ⚡ **節省 99.6% 時間**

**完整範例**: `examples/02-high-risk-opportunity-monitor.ts`

---

### 場景 3: Slack 即時查詢 💬

**業務需求**:
> 業務在 Slack 中輸入命令,立即取得團隊報告、個人績效、商機預測等資訊,無需等待或手動查詢。

**使用方式**:

**在 Slack 中輸入**:
```
/analyze team week
```

**立即收到回覆**:
```
📊 團隊績效報告 (week)

整體表現:
• 總對話數: 25
• 平均 MEDDIC 評分: 72.5/100
• 成交案件: 5 筆
• 平均交易額: $45,000

🏆 Top Performers:
1. 張三 - 85.2/100
2. 李四 - 78.9/100
3. 王五 - 76.3/100

⚠️ 需要支持:
1. 趙六 - 58.1/100

生成時間: 2026-01-15 14:30
```

**實作方式**:
```typescript
// Cloudflare Worker
export default {
  async fetch(request: Request): Promise<Response> {
    const formData = await request.formData();
    const command = formData.get('command');  // "/analyze"
    const text = formData.get('text');        // "team week"

    const handler = new SlackCommandHandler();
    const response = await handler.handleSlashCommand(
      command,
      text.split(' '),
      userId,
      channelId
    );

    return new Response(JSON.stringify({ text: response }));
  }
}
```

**支援的命令**:
```
/analyze team [period]          - 團隊報告
/analyze rep [user-id] [period] - 個人報告
/forecast                       - 商機預測
/schedule-follow-up [opp-id]    - 排程跟進
/help                           - 幫助
```

**結果**:
- ✅ 即時查詢,秒級回應
- ✅ 無需開啟其他系統
- ✅ 在 Slack 對話中直接使用
- ✅ 降低查詢門檻

**完整範例**: `examples/03-slack-commands.ts`

---

## 🔄 MCP 工具組合模式

### 模式 1: 線性流程

```typescript
// 步驟 1 → 步驟 2 → 步驟 3
const report = await generateReport();
const file = await uploadToDrive(report);
await notifyTeam(file.url);
```

**適用場景**: 週報生成、報告分享

---

### 模式 2: 條件分支

```typescript
const forecast = await predictOpportunities();

if (forecast.highRiskCount > 0) {
  await scheduleFollowUps(forecast.highRisk);
  await alertManager(forecast.highRisk);
} else {
  await congratulateTeam();
}
```

**適用場景**: 風險監控、警示系統

---

### 模式 3: 平行執行

```typescript
// 同時執行多個獨立任務
const [teamReport, repReport, forecast] = await Promise.all([
  server.executeTool('generate_team_dashboard', ...),
  server.executeTool('generate_rep_performance', ...),
  server.executeTool('forecast_opportunities', ...),
]);
```

**適用場景**: 月報生成、儀表板更新

---

### 模式 4: 批次處理

```typescript
// 處理多個商機
for (const opp of opportunities) {
  await server.executeTool('calendar_schedule_follow_up', {
    opportunityId: opp.id,
    scheduledFor: 'next_week',
  });

  // 避免過載,延遲 1 秒
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

**適用場景**: 批次跟進、大量通知

---

## 📊 實際效益對比

### 時間節省

| 任務 | 原本 | MCP 自動化 | 節省 |
|------|------|-----------|------|
| 週報生成 | 2 小時 | 30 秒 | 99.6% |
| 商機風險監控 | 4 小時 | 1 分鐘 | 99.6% |
| 業務績效回顧 | 1 小時 | 30 秒 | 99.2% |
| 報告分享 | 15 分鐘 | 10 秒 | 98.9% |
| 排程跟進 | 10 分鐘 | 10 秒 | 98.3% |

**總計**: 每週節省約 **40 小時** (假設 10 位業務,每人每週 4 小時)

---

### ROI 計算

**成本**:
- API 費用: $7.25/月
- 開發時間: 已完成 (一次性)
- 維護: 約 2 小時/月

**效益** (10 位業務):
- 時間節省: 400 小時/月
- 假設時薪: $50/hr
- 總效益: $20,000/月

**ROI**: ($20,000 - $7.25) / $7.25 = **275,762%** 🚀

---

## 🛠️ 部署方式

### 方式 1: Cloudflare Workers (推薦)

**優點**:
- ✅ 全球分散式
- ✅ 自動擴展
- ✅ 免費額度充足
- ✅ Cron Triggers 內建

**設定**:
```toml
# wrangler.toml
name = "sales-ai-automation"

[triggers]
crons = [
  "0 9 * * 1",   # 每週一 09:00 - 團隊報告
  "0 17 * * *"   # 每天 17:00 - 風險監控
]
```

```typescript
// worker.ts
export default {
  async scheduled(event, env, ctx) {
    if (event.cron === "0 9 * * 1") {
      await generateWeeklyTeamReport();
    }

    if (event.cron === "0 17 * * *") {
      await monitorHighRiskOpportunities();
    }
  }
}
```

**部署**:
```bash
wrangler deploy
```

---

### 方式 2: Node.js Cron Job

**優點**:
- ✅ 完全控制
- ✅ 本地執行
- ✅ 簡單設定

**設定**:
```typescript
import cron from 'node-cron';

// 每週一 09:00
cron.schedule('0 9 * * 1', async () => {
  await generateWeeklyTeamReport();
});

// 每天 17:00
cron.schedule('0 17 * * *', async () => {
  await monitorHighRiskOpportunities();
});
```

**執行**:
```bash
bun run cron-server.ts
# 或使用 PM2
pm2 start cron-server.ts
```

---

### 方式 3: GitHub Actions (CI/CD)

**優點**:
- ✅ 免費
- ✅ 與 Git 整合
- ✅ 容易監控

**設定**:
```yaml
# .github/workflows/weekly-report.yml
name: Weekly Team Report

on:
  schedule:
    - cron: '0 9 * * 1'  # 每週一 09:00 UTC

jobs:
  generate-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run examples/01-weekly-team-report.ts
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          GOOGLE_REFRESH_TOKEN: ${{ secrets.GOOGLE_REFRESH_TOKEN }}
```

---

## 💡 最佳實踐

### 1. 錯誤處理

```typescript
try {
  const result = await server.safeExecuteTool('tool_name', input, context);

  if (!result.success) {
    // 發送警示
    await slackPostAlertTool.handler({
      channelId: ALERTS_CHANNEL,
      message: `❌ 自動化失敗: ${result.error}`,
      severity: 'error',
    });

    throw new Error(result.error);
  }
} catch (error) {
  console.error('流程失敗:', error);
  // 記錄到監控系統
  await logError(error);
}
```

---

### 2. 限流保護

```typescript
// 避免批次處理過載
for (const [index, item] of items.entries()) {
  await processItem(item);

  // 每 10 個延遲 1 秒
  if ((index + 1) % 10 === 0) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

---

### 3. 冪等性

```typescript
// 確保重複執行不會造成問題
const reportPath = `reports/team-${date}-v1.md`;

// 檢查是否已存在
const exists = await filesystemReadTool.handler({ path: reportPath });

if (!exists) {
  await generateReport(reportPath);
}
```

---

### 4. 監控與日誌

```typescript
console.log(`✅ [${new Date().toISOString()}] 報告已生成`);
console.log(`📊 總對話數: ${metrics.totalConversations}`);
console.log(`💰 成交案件: ${metrics.dealsClosed}`);

// 記錄到 PostgreSQL
await sql`
  INSERT INTO automation_logs (type, status, metadata, created_at)
  VALUES ('weekly_report', 'success', ${JSON.stringify(metrics)}, NOW())
`;
```

---

## 🎯 實施路徑

### Week 1: 基礎設定
- [ ] 完成 Google OAuth 配置
- [ ] 測試基本 MCP 工具
- [ ] 執行範例腳本

### Week 2: 第一個自動化
- [ ] 部署週報自動化
- [ ] 設定 Cron Job
- [ ] 驗證執行結果

### Week 3: 擴展功能
- [ ] 部署風險監控
- [ ] 整合 Slack 命令
- [ ] 團隊培訓

### Week 4: 優化與監控
- [ ] 設定錯誤警示
- [ ] 調整執行頻率
- [ ] 收集使用者回饋

---

## 📚 相關資源

### 範例程式碼
- `examples/01-weekly-team-report.ts` - 每週團隊報告
- `examples/02-high-risk-opportunity-monitor.ts` - 風險商機監控
- `examples/03-slack-commands.ts` - Slack 命令整合

### 文檔
- [Quick_Start_Guide.md](.doc/20260115_Quick_Start_Guide.md) - 工具使用指南
- [MCP_Tools_Complete_Overview.md](.doc/20260115_MCP_Tools_Complete_Overview.md) - 59 工具總覽
- [Setup_Checklist.md](.doc/20260115_Setup_Checklist.md) - 設定清單

---

## ✅ 總結

MCP 工具的**真正價值**在於:

1. **自動化重複性任務** - 不是手動呼叫,而是設定後自動執行
2. **組合多個工具** - 建立端到端工作流程
3. **即時互動** - 透過 Slack 命令即時查詢
4. **事件驅動** - 根據條件自動觸發行動

**不是**: 手動呼叫 API
**而是**: 建立智能自動化系統

**開始使用**:
```bash
bun run examples/01-weekly-team-report.ts
```

🚀 **現在就開始自動化您的銷售流程!**

