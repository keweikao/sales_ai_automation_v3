/**
 * 實際應用範例 3: Slack 命令整合
 *
 * 使用場景:
 * - 在 Slack 中使用斜線命令快速存取 MCP 工具
 * - 即時生成報告和分析
 * - 互動式查詢商機資訊
 *
 * 支援的命令:
 * - /analyze team [period] - 生成團隊報告
 * - /analyze rep [user-id] - 生成個人報告
 * - /forecast - 商機預測
 * - /schedule-follow-up [opp-id] - 排程跟進
 */

import { createFullMCPServer } from "../packages/services/src/mcp/server.js";

/**
 * Slack 命令處理器
 */
export class SlackCommandHandler {
  private server: ReturnType<typeof createFullMCPServer>;

  constructor() {
    this.server = createFullMCPServer({ enableLogging: false });
  }

  /**
   * 處理 Slack 斜線命令
   */
  async handleSlashCommand(
    command: string,
    args: string[],
    userId: string,
    channelId: string
  ): Promise<string> {
    try {
      switch (command) {
        case "/analyze":
          return await this.handleAnalyzeCommand(args, userId, channelId);

        case "/forecast":
          return await this.handleForecastCommand(args, channelId);

        case "/schedule-follow-up":
          return await this.handleScheduleCommand(args, userId, channelId);

        case "/help":
          return this.getHelpMessage();

        default:
          return `❌ 未知命令: ${command}\n使用 \`/help\` 查看可用命令`;
      }
    } catch (error) {
      return `❌ 錯誤: ${error instanceof Error ? error.message : "Unknown"}`;
    }
  }

  /**
   * 處理 /analyze 命令
   */
  private async handleAnalyzeCommand(
    args: string[],
    userId: string,
    channelId: string
  ): Promise<string> {
    const subCommand = args[0];

    if (subCommand === "team") {
      // /analyze team [week|month|quarter]
      const period = args[1] || "week";

      // 發送 "正在處理..." 訊息
      await this.sendTypingIndicator(channelId);

      const result = await this.server.safeExecuteTool(
        "generate_team_dashboard",
        {
          period: period as "week" | "month" | "quarter",
          generateReport: false, // Slack 中不需要檔案
        },
        { timestamp: new Date() }
      );

      if (!result.success) {
        return `❌ 生成報告失敗: ${result.error}`;
      }

      const { teamMetrics, topPerformers, needsSupport } = result.data;

      return `📊 *團隊績效報告* (${period})

*整體表現:*
• 總對話數: *${teamMetrics.totalConversations}*
• 平均 MEDDIC 評分: *${teamMetrics.avgMeddicScore.toFixed(1)}/100*
• 成交案件: *${teamMetrics.dealsClosed}* 筆
• 平均交易額: *$${teamMetrics.avgDealValue.toLocaleString()}*
• 活躍業務: *${teamMetrics.activeReps}* 人

🏆 *Top Performers:*
${topPerformers
  .slice(0, 3)
  .map((rep, i) => `${i + 1}. ${rep.repName} - ${rep.avgScore.toFixed(1)}/100`)
  .join("\n")}

⚠️ *需要支持:*
${needsSupport
  .slice(0, 3)
  .map((rep, i) => `${i + 1}. ${rep.repName} - ${rep.avgScore.toFixed(1)}/100`)
  .join("\n")}

_生成時間: ${new Date().toLocaleString("zh-TW")}_`;
    }

    if (subCommand === "rep") {
      // /analyze rep [user-id] [week|month|quarter]
      const repId = args[1] || userId;
      const period = args[2] || "week";

      await this.sendTypingIndicator(channelId);

      const result = await this.server.safeExecuteTool(
        "generate_rep_performance",
        {
          repId,
          period: period as "week" | "month" | "quarter",
          generateReport: false,
          includeMeddicBreakdown: true,
        },
        { timestamp: new Date() }
      );

      if (!result.success) {
        return `❌ 生成報告失敗: ${result.error}`;
      }

      const { repName, performance } = result.data;

      return `👤 *個人績效報告 - ${repName}* (${period})

*整體表現:*
• 對話數: *${performance.conversationCount}*
• 平均 MEDDIC 評分: *${performance.avgOverallScore.toFixed(1)}/100*
• 成交數: *${performance.dealsClosed}*
• 平均交易額: *$${performance.avgDealValue.toLocaleString()}*

📊 *MEDDIC 六維度評分:*
• Metrics (定量指標): ${performance.meddicScores?.metrics.toFixed(1) || "N/A"}/5
• Economic Buyer (經濟決策者): ${performance.meddicScores?.economicBuyer.toFixed(1) || "N/A"}/5
• Decision Criteria (決策標準): ${performance.meddicScores?.decisionCriteria.toFixed(1) || "N/A"}/5
• Decision Process (決策流程): ${performance.meddicScores?.decisionProcess.toFixed(1) || "N/A"}/5
• Identify Pain (識別痛點): ${performance.meddicScores?.identifyPain.toFixed(1) || "N/A"}/5
• Champion (內部支持者): ${performance.meddicScores?.champion.toFixed(1) || "N/A"}/5

${this.getImprovementSuggestions(performance.meddicScores)}

_生成時間: ${new Date().toLocaleString("zh-TW")}_`;
    }

    return `❌ 未知子命令: ${subCommand}\n使用 \`/analyze team\` 或 \`/analyze rep\``;
  }

  /**
   * 處理 /forecast 命令
   */
  private async handleForecastCommand(
    args: string[],
    channelId: string
  ): Promise<string> {
    await this.sendTypingIndicator(channelId);

    const minScore = Number.parseInt(args[0]) || 50;

    const result = await this.server.safeExecuteTool(
      "forecast_opportunities",
      {
        minMeddicScore: minScore,
        includeRiskFactors: true,
      },
      { timestamp: new Date() }
    );

    if (!result.success) {
      return `❌ 商機預測失敗: ${result.error}`;
    }

    const { forecasts, summary } = result.data;

    // 識別高風險商機
    const highRisk = forecasts.filter(
      (f: { riskFactors?: string[] }) =>
        f.riskFactors && f.riskFactors.length >= 3
    );

    return `🎯 *商機預測分析*

*總體概況:*
• 總商機數: *${summary.totalOpportunities}*
• 平均成交機率: *${summary.avgWinProbability.toFixed(1)}%*
• 預估總金額: *$${summary.totalEstimatedValue.toLocaleString()}*

⚠️ *高風險商機:* ${highRisk.length} 個
${
  highRisk.length > 0
    ? `\n最需要關注:\n${highRisk
        .slice(0, 3)
        .map(
          (opp: {
            accountName?: string;
            estimatedValue: number;
            winProbability: number;
          }) =>
            `• ${opp.accountName} - $${opp.estimatedValue.toLocaleString()} (${opp.winProbability.toFixed(1)}%)`
        )
        .join("\n")}`
    : ""
}

💡 *建議行動:*
${highRisk.length > 0 ? "• 使用 `/schedule-follow-up [opp-id]` 排程跟進" : "• 繼續保持!"}
• 查看完整報告請使用 \`/analyze team\`

_生成時間: ${new Date().toLocaleString("zh-TW")}_`;
  }

  /**
   * 處理 /schedule-follow-up 命令
   */
  private async handleScheduleCommand(
    args: string[],
    userId: string,
    channelId: string
  ): Promise<string> {
    const oppId = args[0];
    if (!oppId) {
      return "❌ 請提供商機 ID\n用法: `/schedule-follow-up [opportunity-id]`";
    }

    await this.sendTypingIndicator(channelId);

    // 先取得商機資訊
    const forecastResult = await this.server.safeExecuteTool(
      "forecast_opportunities",
      {
        opportunityIds: [oppId],
        includeRiskFactors: true,
      },
      { timestamp: new Date() }
    );

    if (!forecastResult.success || forecastResult.data.forecasts.length === 0) {
      return `❌ 找不到商機: ${oppId}`;
    }

    const opp = forecastResult.data.forecasts[0];

    // 排程會議
    const scheduleResult = await this.server.safeExecuteTool(
      "calendar_schedule_follow_up",
      {
        opportunityId: oppId,
        title: `跟進商機: ${opp.accountName}`,
        description: `MEDDIC 評分: ${opp.meddicScore}/100\n風險因素: ${opp.riskFactors?.length || 0} 個`,
        scheduledFor: "next_week",
        durationMinutes: 60,
      },
      { timestamp: new Date() }
    );

    if (!scheduleResult.success) {
      return `❌ 排程失敗: ${scheduleResult.error}`;
    }

    return `✅ *跟進會議已排程!*

*商機資訊:*
• 客戶: ${opp.accountName}
• 預估金額: $${opp.estimatedValue.toLocaleString()}
• 成交機率: ${opp.winProbability.toFixed(1)}%

*會議資訊:*
• 時間: ${new Date(scheduleResult.data.scheduledAt).toLocaleString("zh-TW")}
• 連結: ${scheduleResult.data.htmlLink}

${
  opp.riskFactors && opp.riskFactors.length > 0
    ? `⚠️ *需要解決的風險:*\n${opp.riskFactors.map((r: string) => `• ${r}`).join("\n")}`
    : ""
}`;
  }

  /**
   * 取得幫助訊息
   */
  private getHelpMessage(): string {
    return `📚 *Sales AI Automation - 可用命令*

*分析命令:*
• \`/analyze team [week|month|quarter]\` - 生成團隊報告
• \`/analyze rep [user-id] [period]\` - 生成個人報告

*商機管理:*
• \`/forecast\` - 商機預測分析
• \`/schedule-follow-up [opp-id]\` - 排程跟進會議

*其他:*
• \`/help\` - 顯示此幫助訊息

*範例:*
\`/analyze team week\` - 本週團隊報告
\`/analyze rep user-123 month\` - 某業務的月報
\`/forecast\` - 所有商機預測
\`/schedule-follow-up opp-456\` - 排程跟進

有問題?聯繫 IT 支援或查看文檔。`;
  }

  /**
   * 根據 MEDDIC 評分提供改進建議
   */
  private getImprovementSuggestions(scores?: {
    metrics: number;
    economicBuyer: number;
    decisionCriteria: number;
    decisionProcess: number;
    identifyPain: number;
    champion: number;
  }): string {
    if (!scores) return "";

    const suggestions: string[] = [];

    if (scores.metrics < 3) {
      suggestions.push("• 加強與客戶確認定量指標和 ROI");
    }
    if (scores.economicBuyer < 3) {
      suggestions.push("• 需要接觸有預算決策權的主管");
    }
    if (scores.decisionCriteria < 3) {
      suggestions.push("• 了解客戶的評估標準和優先順序");
    }
    if (scores.decisionProcess < 3) {
      suggestions.push("• 確認決策流程和時間表");
    }
    if (scores.identifyPain < 3) {
      suggestions.push("• 深入挖掘客戶的痛點和需求");
    }
    if (scores.champion < 3) {
      suggestions.push("• 培養內部支持者來推動專案");
    }

    if (suggestions.length === 0) {
      return "\n✅ *表現優秀!* 繼續保持各維度的高分!";
    }

    return `\n💡 *改進建議:*\n${suggestions.join("\n")}`;
  }

  /**
   * 發送 typing indicator (讓使用者知道正在處理)
   */
  private async sendTypingIndicator(channelId: string): Promise<void> {
    // 實際實作會呼叫 Slack API
    // 這裡僅作示意
    console.log(`Sending typing indicator to ${channelId}...`);
  }
}

/**
 * Cloudflare Workers 範例 - 處理 Slack 斜線命令
 */
export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // 解析 Slack 命令
    const formData = await request.formData();
    const command = formData.get("command") as string;
    const text = formData.get("text") as string;
    const userId = formData.get("user_id") as string;
    const channelId = formData.get("channel_id") as string;

    // 驗證 Slack token
    const token = formData.get("token") as string;
    if (token !== process.env.SLACK_VERIFICATION_TOKEN) {
      return new Response("Invalid token", { status: 401 });
    }

    // 處理命令
    const handler = new SlackCommandHandler();
    const args = text.split(" ");
    const response = await handler.handleSlashCommand(
      command,
      args,
      userId,
      channelId
    );

    return new Response(
      JSON.stringify({
        response_type: "in_channel", // 或 "ephemeral" 僅自己可見
        text: response,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  },
};

/**
 * 本地測試
 */
if (import.meta.main) {
  const handler = new SlackCommandHandler();

  console.log("🧪 測試 Slack 命令...\n");

  // 測試 /analyze team
  console.log("1. 測試: /analyze team week");
  const teamResult = await handler.handleSlashCommand(
    "/analyze",
    ["team", "week"],
    "user-123",
    "channel-456"
  );
  console.log(teamResult);
  console.log("\n" + "=".repeat(80) + "\n");

  // 測試 /forecast
  console.log("2. 測試: /forecast");
  const forecastResult = await handler.handleSlashCommand(
    "/forecast",
    [],
    "user-123",
    "channel-456"
  );
  console.log(forecastResult);
  console.log("\n" + "=".repeat(80) + "\n");

  // 測試 /help
  console.log("3. 測試: /help");
  const helpResult = await handler.handleSlashCommand(
    "/help",
    [],
    "user-123",
    "channel-456"
  );
  console.log(helpResult);
}
