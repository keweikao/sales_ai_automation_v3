/**
 * 實際應用範例 2: 高風險商機監控與自動跟進
 *
 * 使用場景:
 * - 每天下午 5:00 執行商機預測
 * - 識別高風險商機 (>= 3 個風險因素)
 * - 自動排程後續跟進會議
 * - 發送警示給 Sales Manager
 *
 * 目的: 確保高價值商機不會因為 MEDDIC 評分不足而流失
 */

import { createFullMCPServer } from "../packages/services/src/mcp/server.js";

async function monitorHighRiskOpportunities() {
  console.log("⚠️  開始高風險商機監控...\n");

  const server = createFullMCPServer({ enableLogging: false });

  try {
    // ============================================================
    // Step 1: 執行商機預測分析
    // ============================================================
    console.log("🔄 Step 1: 分析所有活躍商機...");

    const forecastResult = await server.safeExecuteTool(
      "forecast_opportunities",
      {
        minMeddicScore: 40, // 包含評分較低的商機
        includeRiskFactors: true, // 必須包含風險分析
      },
      { timestamp: new Date() }
    );

    if (!forecastResult.success) {
      throw new Error(`商機預測失敗: ${forecastResult.error}`);
    }

    const { forecasts, summary } = forecastResult.data;

    console.log("✅ 商機預測完成");
    console.log(`   總商機數: ${summary.totalOpportunities}`);
    console.log(`   平均成交機率: ${summary.avgWinProbability.toFixed(1)}%`);
    console.log(
      `   預估總金額: $${summary.totalEstimatedValue.toLocaleString()}\n`
    );

    // ============================================================
    // Step 2: 識別高風險商機
    // ============================================================
    console.log("🔄 Step 2: 識別高風險商機...");

    const highRiskOpportunities = forecasts.filter((opp) => {
      // 高風險條件:
      // 1. 有 3 個或以上風險因素
      // 2. 成交機率 < 50%
      // 3. 商機金額 > $10,000 (避免浪費時間在小案子)
      return (
        opp.riskFactors &&
        opp.riskFactors.length >= 3 &&
        opp.winProbability < 50 &&
        opp.estimatedValue > 10_000
      );
    });

    console.log(`⚠️  發現 ${highRiskOpportunities.length} 個高風險商機\n`);

    if (highRiskOpportunities.length === 0) {
      console.log("✅ 太好了!目前沒有高風險商機需要處理\n");
      return;
    }

    // 按預估金額排序 (優先處理高價值商機)
    highRiskOpportunities.sort((a, b) => b.estimatedValue - a.estimatedValue);

    // ============================================================
    // Step 3: 為每個高風險商機排程跟進會議
    // ============================================================
    console.log("🔄 Step 3: 自動排程跟進會議...\n");

    const scheduledMeetings = [];

    for (const opp of highRiskOpportunities.slice(0, 5)) {
      // 最多處理前 5 個
      console.log(`   處理商機: ${opp.accountName}`);
      console.log(`   - 預估金額: $${opp.estimatedValue.toLocaleString()}`);
      console.log(`   - 成交機率: ${opp.winProbability.toFixed(1)}%`);
      console.log(`   - 風險因素: ${opp.riskFactors?.length || 0} 個`);

      // 準備 Talk Track (根據風險因素)
      const talkTrack = generateTalkTrack(opp);

      // 排程跟進會議 (48 小時內)
      const scheduledFor = new Date();
      scheduledFor.setHours(scheduledFor.getHours() + 48); // 2 天後
      scheduledFor.setHours(14, 0, 0, 0); // 下午 2:00

      const followUpResult = await server.safeExecuteTool(
        "calendar_schedule_follow_up",
        {
          opportunityId: opp.opportunityId,
          title: `🚨 高風險商機跟進: ${opp.accountName}`,
          description: `# 高風險商機跟進會議

## 商機資訊
- **客戶**: ${opp.accountName}
- **預估金額**: $${opp.estimatedValue.toLocaleString()}
- **當前階段**: ${opp.currentStage}
- **MEDDIC 評分**: ${opp.meddicScore}/100
- **成交機率**: ${opp.winProbability.toFixed(1)}%

## 風險因素
${opp.riskFactors?.map((risk) => `⚠️ ${risk}`).join("\n")}

## 建議行動
${opp.recommendations?.map((rec) => `✅ ${rec}`).join("\n")}

## 會議目標
1. 解決上述風險因素
2. 提升 MEDDIC 評分到 70 以上
3. 制定明確的下一步行動計畫

---
*由 Sales AI Automation V3 自動排程*
`,
          scheduledFor: scheduledFor.toISOString(),
          durationMinutes: 60,
          talkTrack,
        },
        { timestamp: new Date() }
      );

      if (followUpResult.success) {
        console.log(`   ✅ 已排程會議: ${followUpResult.data.htmlLink}`);
        scheduledMeetings.push({
          opportunity: opp,
          meeting: followUpResult.data,
        });
      } else {
        console.log(`   ❌ 排程失敗: ${followUpResult.error}`);
      }

      console.log(); // 空行
    }

    // ============================================================
    // Step 4: 生成風險報告並上傳到 Drive
    // ============================================================
    console.log("🔄 Step 4: 生成風險分析報告...");

    const reportContent = generateRiskReport(
      highRiskOpportunities,
      scheduledMeetings
    );

    const driveResult = await server.safeExecuteTool(
      "gdrive_upload_report",
      {
        reportContent,
        fileName: `High-Risk-Opportunities-${new Date().toISOString().split("T")[0]}.md`,
        folderId: process.env.GOOGLE_DRIVE_REPORTS_FOLDER_ID,
        description: "高風險商機分析報告",
      },
      { timestamp: new Date() }
    );

    let reportUrl = "";
    if (driveResult.success) {
      console.log(`✅ 報告已上傳: ${driveResult.data.webViewLink}\n`);
      reportUrl = driveResult.data.webViewLink;

      // 設定分享給 Sales Manager
      await server.safeExecuteTool(
        "gdrive_share_file",
        {
          fileId: driveResult.data.fileId,
          role: "reader",
          type: "anyone",
        },
        { timestamp: new Date() }
      );
    }

    // ============================================================
    // Step 5: 發送 Slack 警示給 Sales Manager
    // ============================================================
    console.log("🔄 Step 5: 發送 Slack 警示...");

    const alertMessage = `🚨 *高風險商機警示*

發現 *${highRiskOpportunities.length}* 個高風險商機需要立即處理!

*前 5 個高價值商機:*
${highRiskOpportunities
  .slice(0, 5)
  .map(
    (opp, i) =>
      `${i + 1}. *${opp.accountName}* - $${opp.estimatedValue.toLocaleString()} (${opp.winProbability.toFixed(1)}% 成交機率)`
  )
  .join("\n")}

📊 *總體狀況:*
• 總高風險商機: ${highRiskOpportunities.length} 個
• 總預估金額: $${highRiskOpportunities.reduce((sum, opp) => sum + opp.estimatedValue, 0).toLocaleString()}
• 已排程跟進: ${scheduledMeetings.length} 場會議

📄 *完整報告*: ${reportUrl || "生成中..."}

⚠️ *建議行動:*
• 檢視高風險商機列表
• 參加已排程的跟進會議
• 協助團隊解決 MEDDIC 評分不足的問題

---
_由 Sales AI Automation V3 自動監控於 ${new Date().toLocaleString("zh-TW")}_
`;

    const { slackPostAlertTool } = await import(
      "../packages/services/src/mcp/external/slack.js"
    );

    const slackResult = await slackPostAlertTool.handler(
      {
        channelId: process.env.SLACK_ALERTS_CHANNEL || "",
        message: alertMessage,
        severity: "warning",
      },
      { timestamp: new Date() }
    );

    if (slackResult) {
      console.log("✅ Slack 警示已發送\n");
    }

    // ============================================================
    // 總結
    // ============================================================
    console.log("=".repeat(80));
    console.log("\n✅ 高風險商機監控完成!\n");
    console.log("📊 處理結果:");
    console.log(`   ⚠️  高風險商機: ${highRiskOpportunities.length} 個`);
    console.log(`   📅 已排程會議: ${scheduledMeetings.length} 場`);
    console.log(
      `   💰 涉及金額: $${highRiskOpportunities.reduce((sum, opp) => sum + opp.estimatedValue, 0).toLocaleString()}`
    );
    console.log("\n💡 下一步行動:");
    console.log("   1. Sales Manager 收到 Slack 警示");
    console.log("   2. 業務收到 Calendar 會議邀請");
    console.log("   3. 團隊可在 Drive 查看完整報告");
    console.log("   4. 48 小時內進行跟進會議\n");
  } catch (error) {
    console.error("\n❌ 錯誤:", error instanceof Error ? error.message : error);
    throw error;
  }
}

// ============================================================
// 輔助函數
// ============================================================

/**
 * 根據風險因素生成 Talk Track
 */
function generateTalkTrack(opp: {
  riskFactors?: string[];
  recommendations?: string[];
}): string {
  const talkTrack = ["# 會議 Talk Track\n"];

  if (opp.riskFactors && opp.riskFactors.length > 0) {
    talkTrack.push("## 需要解決的問題\n");

    for (const risk of opp.riskFactors) {
      if (risk.includes("定量指標")) {
        talkTrack.push(
          "### 1. 確認定量指標\n" +
            "**問題**: 客戶的業務目標和 ROI 指標不明確\n" +
            "**話術**: 「我們想更深入了解這個專案對貴公司的具體影響。能否分享一下您期望透過這個解決方案達成的具體數字目標?例如增加多少營收、節省多少成本、或提升多少效率?」\n"
        );
      }

      if (risk.includes("經濟決策者")) {
        talkTrack.push(
          "### 2. 接觸經濟決策者\n" +
            "**問題**: 尚未接觸到有預算決策權的人\n" +
            "**話術**: 「為了確保這個專案能順利推進,我們需要了解預算審批流程。能否安排一次會議,讓有預算決策權的主管也一起參與討論?」\n"
        );
      }

      if (risk.includes("決策標準")) {
        talkTrack.push(
          "### 3. 了解決策標準\n" +
            "**問題**: 客戶的評估標準不清楚\n" +
            "**話術**: 「在評估不同供應商時,貴公司最看重哪些方面?是價格、功能、服務支持、還是其他因素?我們想確保能針對您最關心的部分提供資訊。」\n"
        );
      }

      if (risk.includes("決策流程")) {
        talkTrack.push(
          "### 4. 確認決策流程\n" +
            "**問題**: 決策時間表和流程未確認\n" +
            "**話術**: 「為了配合貴公司的時程,能否分享一下決策流程?包括需要哪些人核准、預計什麼時候做出決定?」\n"
        );
      }

      if (risk.includes("痛點")) {
        talkTrack.push(
          "### 5. 深入了解痛點\n" +
            "**問題**: 客戶的痛點不夠明確\n" +
            "**話術**: 「目前最困擾您的問題是什麼?如果這個問題沒有解決,會對業務造成什麼影響?」\n"
        );
      }

      if (risk.includes("內部支持者") || risk.includes("冠軍")) {
        talkTrack.push(
          "### 6. 培養內部支持者\n" +
            "**問題**: 缺少內部推動者\n" +
            "**話術**: 「我們發現成功的專案通常需要內部有人大力推動。在貴公司內部,誰最關心這個問題的解決?我們可以如何協助您在內部爭取支持?」\n"
        );
      }
    }
  }

  if (opp.recommendations && opp.recommendations.length > 0) {
    talkTrack.push("\n## 行動計畫\n");
    for (const [index, rec] of opp.recommendations.entries()) {
      talkTrack.push(`${index + 1}. ${rec}\n`);
    }
  }

  talkTrack.push(
    "\n## 會議結束前\n" +
      "✅ 確認下一步行動和時間表\n" +
      "✅ 取得承諾或明確的拒絕理由\n" +
      "✅ 更新 CRM 並排程下次跟進\n"
  );

  return talkTrack.join("");
}

/**
 * 生成風險分析報告
 */
function generateRiskReport(
  opportunities: Array<{
    opportunityId: string;
    accountName?: string;
    meddicScore: number;
    winProbability: number;
    estimatedValue: number;
    currentStage: string;
    riskFactors?: string[];
    recommendations?: string[];
  }>,
  meetings: Array<{
    opportunity: { accountName?: string };
    meeting: { htmlLink: string; scheduledAt: string };
  }>
): string {
  return `# 高風險商機分析報告

**生成時間**: ${new Date().toLocaleString("zh-TW")}
**監控商機數**: ${opportunities.length}

---

## 📊 總體概況

| 指標 | 數值 |
|------|------|
| 高風險商機數 | ${opportunities.length} |
| 總預估金額 | $${opportunities.reduce((sum, opp) => sum + opp.estimatedValue, 0).toLocaleString()} |
| 平均成交機率 | ${(opportunities.reduce((sum, opp) => sum + opp.winProbability, 0) / opportunities.length).toFixed(1)}% |
| 已排程跟進 | ${meetings.length} 場會議 |

---

## ⚠️ 高風險商機列表

${opportunities
  .map(
    (opp, i) => `
### ${i + 1}. ${opp.accountName || "Unknown"}

- **預估金額**: $${opp.estimatedValue.toLocaleString()}
- **當前階段**: ${opp.currentStage}
- **MEDDIC 評分**: ${opp.meddicScore}/100
- **成交機率**: ${opp.winProbability.toFixed(1)}%

**風險因素** (${opp.riskFactors?.length || 0} 個):
${opp.riskFactors?.map((risk) => `- ⚠️ ${risk}`).join("\n") || "無"}

**建議行動**:
${opp.recommendations?.map((rec) => `- ✅ ${rec}`).join("\n") || "無"}

---
`
  )
  .join("\n")}

## 📅 已排程跟進會議

${meetings.length > 0 ? meetings.map((m, i) => `${i + 1}. **${m.opportunity.accountName}** - ${new Date(m.meeting.scheduledAt).toLocaleString("zh-TW")}\n   連結: ${m.meeting.htmlLink}`).join("\n\n") : "尚無排程"}

---

## 💡 行動建議

1. **立即行動**: 優先處理預估金額 > $50,000 的商機
2. **團隊協作**: Sales Manager 參與高價值商機的跟進會議
3. **持續監控**: 每週檢視 MEDDIC 評分變化
4. **培訓需求**: 識別團隊在哪些 MEDDIC 維度需要加強

---

*此報告由 Sales AI Automation V3 自動生成*
`;
}

// ============================================================
// 執行方式
// ============================================================
if (import.meta.main) {
  monitorHighRiskOpportunities().catch((error) => {
    console.error("監控失敗:", error);
    process.exit(1);
  });
}

export { monitorHighRiskOpportunities };
