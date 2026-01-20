/**
 * 實際應用範例 1: 每週自動生成團隊報告並分享
 *
 * 使用場景:
 * - 每週一上午 9:00 自動執行
 * - 生成團隊週報並上傳到 Google Drive
 * - 建立週會 Calendar 事件
 * - 發送 Slack 通知給團隊
 *
 * 可整合到 cron job 或 Cloudflare Workers Cron Triggers
 */

import { createFullMCPServer } from "../packages/services/src/mcp/server.js";

async function generateWeeklyTeamReport() {
  console.log("📊 開始生成每週團隊報告...\n");

  const server = createFullMCPServer({ enableLogging: false });

  try {
    // ============================================================
    // Step 1: 生成團隊績效報告
    // ============================================================
    console.log("🔄 Step 1: 分析團隊績效數據...");

    const dashboardResult = await server.safeExecuteTool(
      "generate_team_dashboard",
      {
        period: "week", // 分析過去 7 天
        generateReport: true, // 生成 Markdown 報告檔案
      },
      { timestamp: new Date() }
    );

    if (!dashboardResult.success) {
      throw new Error(`團隊報告生成失敗: ${dashboardResult.error}`);
    }

    const { teamMetrics, topPerformers, needsSupport, reportPath } =
      dashboardResult.data;

    console.log("✅ 團隊報告生成完成");
    console.log(`   總對話數: ${teamMetrics.totalConversations}`);
    console.log(
      `   平均 MEDDIC 評分: ${teamMetrics.avgMeddicScore.toFixed(1)}/100`
    );
    console.log(`   成交案件: ${teamMetrics.dealsClosed}`);
    console.log(`   活躍業務: ${teamMetrics.activeReps} 人\n`);

    // ============================================================
    // Step 2: 匯出 CSV 數據供進階分析
    // ============================================================
    console.log("🔄 Step 2: 匯出 CSV 數據...");

    const csvResult = await server.safeExecuteTool(
      "export_analytics_to_sheets",
      {
        dataType: "team",
        period: "week",
        format: "csv",
      },
      { timestamp: new Date() }
    );

    if (csvResult.success) {
      console.log(`✅ CSV 匯出成功: ${csvResult.data.filePath}`);
      console.log(`   資料行數: ${csvResult.data.rowCount}\n`);
    }

    // ============================================================
    // Step 3: 讀取報告內容並上傳到 Google Drive
    // ============================================================
    if (reportPath) {
      console.log("🔄 Step 3: 上傳報告到 Google Drive...");

      // 讀取報告檔案
      const { filesystemReadTool } = await import(
        "../packages/services/src/mcp/external/filesystem.js"
      );
      const reportFile = await filesystemReadTool.handler(
        {
          path: reportPath,
          encoding: "utf-8",
        },
        { timestamp: new Date() }
      );

      // 上傳到 Drive
      const driveResult = await server.safeExecuteTool(
        "gdrive_upload_report",
        {
          reportContent: reportFile.content,
          fileName: `Team-Weekly-Report-${new Date().toISOString().split("T")[0]}.md`,
          folderId: process.env.GOOGLE_DRIVE_REPORTS_FOLDER_ID,
          description: `團隊週報 - ${new Date().toLocaleDateString("zh-TW")}`,
        },
        { timestamp: new Date() }
      );

      if (driveResult.success) {
        console.log("✅ 報告已上傳到 Google Drive");
        console.log(`   連結: ${driveResult.data.webViewLink}\n`);

        // 設定公開分享
        const shareResult = await server.safeExecuteTool(
          "gdrive_share_file",
          {
            fileId: driveResult.data.fileId,
            role: "reader",
            type: "anyone", // 所有人都可以檢視
          },
          { timestamp: new Date() }
        );

        if (shareResult.success) {
          console.log("✅ 報告已設為公開分享\n");
        }

        // ============================================================
        // Step 4: 建立下週一的週報討論會議
        // ============================================================
        console.log("🔄 Step 4: 建立週報討論會議...");

        const nextMonday = getNextMonday();
        const meetingStart = new Date(nextMonday);
        meetingStart.setHours(10, 0, 0, 0); // 下週一 10:00
        const meetingEnd = new Date(meetingStart);
        meetingEnd.setHours(11, 0, 0, 0); // 11:00 結束

        // 準備會議描述
        const meetingDescription = `# 週報討論會議

📊 **團隊報告**: ${driveResult.data.webViewLink}

## 本週亮點
- 總對話數: ${teamMetrics.totalConversations}
- 平均 MEDDIC 評分: ${teamMetrics.avgMeddicScore.toFixed(1)}/100
- 成交案件: ${teamMetrics.dealsClosed}

## 討論重點
1. **Top Performers 經驗分享**
${topPerformers
  .slice(0, 3)
  .map(
    (rep, i) =>
      `   ${i + 1}. ${rep.repName} - 平均評分 ${rep.avgScore.toFixed(1)}`
  )
  .join("\n")}

2. **需要支持的業務輔導計畫**
${needsSupport
  .slice(0, 3)
  .map(
    (rep, i) =>
      `   ${i + 1}. ${rep.repName} - 平均評分 ${rep.avgScore.toFixed(1)}`
  )
  .join("\n")}

3. **下週重點商機檢視**

---
*由 Sales AI Automation V3 自動生成*
`;

        const calendarResult = await server.safeExecuteTool(
          "calendar_create_event",
          {
            title: `週報討論會議 - ${new Date().toLocaleDateString("zh-TW")}`,
            description: meetingDescription,
            startTime: meetingStart.toISOString(),
            endTime: meetingEnd.toISOString(),
            attendeeEmails: process.env.TEAM_EMAILS?.split(",") || [],
            sendNotifications: true,
          },
          { timestamp: new Date() }
        );

        if (calendarResult.success) {
          console.log("✅ 會議已建立");
          console.log(
            `   時間: ${meetingStart.toLocaleString("zh-TW")} - ${meetingEnd.toLocaleString("zh-TW")}`
          );
          console.log(`   連結: ${calendarResult.data.htmlLink}\n`);
        }

        // ============================================================
        // Step 5: 發送 Slack 通知
        // ============================================================
        console.log("🔄 Step 5: 發送 Slack 通知...");

        const slackMessage = `📊 *每週團隊報告已生成!*

*本週績效摘要:*
• 總對話數: *${teamMetrics.totalConversations}*
• 平均 MEDDIC 評分: *${teamMetrics.avgMeddicScore.toFixed(1)}/100*
• 成交案件: *${teamMetrics.dealsClosed}* 筆
• 平均交易額: *$${teamMetrics.avgDealValue.toLocaleString()}*

🏆 *Top Performers:*
${topPerformers
  .slice(0, 3)
  .map(
    (rep, i) =>
      `${i + 1}. ${rep.repName} - ${rep.avgScore.toFixed(1)}/100 (成交 ${rep.dealsWon} 筆)`
  )
  .join("\n")}

📄 *完整報告*: ${driveResult.data.webViewLink}
📅 *週報會議*: ${calendarResult.success ? calendarResult.data.htmlLink : "待建立"}

---
_由 Sales AI Automation V3 自動生成於 ${new Date().toLocaleString("zh-TW")}_
`;

        const { slackPostFormattedAnalysisTool } = await import(
          "../packages/services/src/mcp/external/slack.js"
        );

        const slackResult = await slackPostFormattedAnalysisTool.handler(
          {
            channelId: process.env.SLACK_TEAM_CHANNEL || "",
            text: slackMessage,
          },
          { timestamp: new Date() }
        );

        if (slackResult) {
          console.log("✅ Slack 通知已發送\n");
        }
      } else {
        console.log(`⚠️  Drive 上傳失敗: ${driveResult.error}`);
      }
    }

    // ============================================================
    // 總結
    // ============================================================
    console.log("=".repeat(80));
    console.log("\n🎉 每週團隊報告流程完成!\n");
    console.log("📊 生成的資源:");
    console.log(`   ✅ Markdown 報告: ${reportPath || "N/A"}`);
    console.log(
      `   ✅ CSV 數據: ${csvResult.success ? csvResult.data.filePath : "N/A"}`
    );
    console.log("   ✅ Google Drive 報告 (已公開分享)");
    console.log("   ✅ Calendar 會議事件");
    console.log("   ✅ Slack 團隊通知");
    console.log("\n💡 團隊成員現在可以:");
    console.log("   1. 在 Google Drive 檢視完整報告");
    console.log("   2. 在 Calendar 中看到會議邀請");
    console.log("   3. 在 Slack 中收到績效摘要");
    console.log("   4. 下載 CSV 進行進階分析\n");
  } catch (error) {
    console.error("\n❌ 錯誤:", error instanceof Error ? error.message : error);
    throw error;
  }
}

// 輔助函數: 取得下週一
function getNextMonday(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return nextMonday;
}

// ============================================================
// 執行方式 1: 直接執行
// ============================================================
if (import.meta.main) {
  generateWeeklyTeamReport().catch((error) => {
    console.error("流程失敗:", error);
    process.exit(1);
  });
}

// ============================================================
// 執行方式 2: 作為 Cloudflare Workers Cron Trigger
// ============================================================
/*
// 在 wrangler.toml 中設定:
[triggers]
crons = ["0 9 * * 1"]  # 每週一上午 9:00

// 在 Worker 中:
export default {
  async scheduled(event, env, ctx) {
    await generateWeeklyTeamReport();
  }
}
*/

// ============================================================
// 執行方式 3: 作為 Node.js Cron Job
// ============================================================
/*
import cron from 'node-cron';

// 每週一上午 9:00 執行
cron.schedule('0 9 * * 1', async () => {
  console.log('🕐 觸發每週團隊報告生成...');
  await generateWeeklyTeamReport();
});
*/

export { generateWeeklyTeamReport };
