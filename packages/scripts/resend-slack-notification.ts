/**
 * 重新發送案件 202601-IC019 的 Slack 通知
 */

import { db } from "@Sales_ai_automation_v3/db";
import { conversations } from "@Sales_ai_automation_v3/db/schema";
import { SlackService } from "@Sales_ai_automation_v3/services/notifications";
import { eq } from "drizzle-orm";

const conversationId = "cf75684f-4f5b-4667-8e09-0cd50262d9bc";

async function main() {
  console.log("📤 重新發送 202601-IC019 的 Slack 通知\n");

  // 查詢 conversation 和相關資料
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    with: {
      opportunity: {
        with: {
          user: {
            with: {
              slackUser: true,
            },
          },
        },
      },
      meddicAnalysis: true,
    },
  });

  if (!conv) {
    throw new Error("Conversation not found");
  }

  if (!conv.meddicAnalysis) {
    throw new Error("MEDDIC analysis not found");
  }

  const slackUser = conv.opportunity.user.slackUser;
  if (!slackUser) {
    throw new Error("User not linked to Slack");
  }

  console.log(`案件: ${conv.caseNumber}`);
  console.log(`用戶: ${conv.opportunity.user.name}`);
  console.log(`Slack ID: ${slackUser.slackUserId}\n`);

  // 初始化 Slack service
  const slackService = new SlackService(
    process.env.SLACK_BOT_TOKEN!,
    process.env.SLACK_SIGNING_SECRET!
  );

  // 準備分析資料
  const analysis = conv.meddicAnalysis;
  const agentOutputs = (analysis.agentOutputs as any) || {};

  // 轉換 dimensions
  const convertedDimensions: Record<string, any> = {};
  if (analysis.dimensions) {
    for (const [key, value] of Object.entries(analysis.dimensions)) {
      convertedDimensions[key] = {
        name: key,
        ...(value as any),
      };
    }
  }

  // 提取警報
  const alerts: string[] = [];
  if (
    agentOutputs.agent6?.alert_triggered &&
    agentOutputs.agent6.alert_message
  ) {
    alerts.push(agentOutputs.agent6.alert_message);
  }
  if (agentOutputs.agent2?.missed_opportunities?.length > 0) {
    alerts.push(
      `錯失推進機會 - ${agentOutputs.agent2.missed_opportunities[0]}`
    );
  }

  // 提取痛點
  const painPoints: string[] = [];
  const summary = agentOutputs.agent4?.markdown;
  if (summary) {
    const painPointsMatch = summary.match(
      /##\s*🔍\s*您目前遇到的挑戰\s*\n\n((?:- \*\*.*?\*\*:.*?\n)+)/
    );
    if (painPointsMatch?.[1]) {
      const matches = Array.from(
        painPointsMatch[1].matchAll(/- \*\*(.*?)\*\*:/g)
      );
      painPoints.push(...matches.map((m: any) => m[1]).filter(Boolean));
    }
  }

  // 發送通知
  await slackService.notifyProcessingCompleted({
    userId: slackUser.slackUserId,
    conversationId: conv.id,
    caseNumber: conv.caseNumber || "Unknown",
    analysisResult: {
      overallScore: analysis.overallScore || 0,
      qualificationStatus: analysis.qualificationStatus || "unknown",
      dimensions: convertedDimensions,
      keyFindings: analysis.keyFindings || [],
      nextSteps: (analysis.nextSteps || []).map((step: any) => ({
        action: step.action,
        priority: "Medium",
        owner: step.owner || "Unassigned",
      })),
      risks: analysis.risks || [],
      alerts: alerts.filter((a) => a?.trim()),
      painPoints,
      summary,
      smsText: agentOutputs.agent4?.sms_text,
      contactPhone: conv.opportunity.contactPhone,
    },
    processingTimeMs: 105_700,
  });

  console.log("✅ Slack 通知已發送!");
}

main().catch((error) => {
  console.error("❌ 錯誤:", error);
  process.exit(1);
});
