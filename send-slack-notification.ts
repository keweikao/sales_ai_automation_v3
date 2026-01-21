/**
 * 手動發送 Slack 通知腳本
 * 用於重新發送已完成案件的 MEDDIC 分析到 Slack
 */

import { db } from "@Sales_ai_automation_v3/db";
import { conversations } from "@Sales_ai_automation_v3/db/schema";
import { eq } from "drizzle-orm";

const conversationId = "cf75684f-4f5b-4667-8e09-0cd50262d9bc"; // 202601-IC019

async function main() {
  console.log("📤 正在重新發送 Slack 通知...");
  console.log(`Conversation ID: ${conversationId}`);

  // 1. 查詢 conversation
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
    console.error("❌ Conversation not found");
    process.exit(1);
  }

  console.log(`✓ 找到案件: ${conv.caseNumber}`);
  console.log(
    `✓ 用戶: ${conv.opportunity.user.name} (${conv.opportunity.user.email})`
  );

  if (!conv.opportunity.user.slackUser) {
    console.error("❌ 用戶沒有綁定 Slack 帳號");
    process.exit(1);
  }

  const slackUserId = conv.opportunity.user.slackUser.slackUserId;
  console.log(`✓ Slack User ID: ${slackUserId}`);

  if (!conv.meddicAnalysis) {
    console.error("❌ 尚未完成 MEDDIC 分析");
    process.exit(1);
  }

  console.log(`✓ MEDDIC 分數: ${conv.meddicAnalysis.overallScore}/100`);
  console.log(`✓ 資格狀態: ${conv.meddicAnalysis.qualificationStatus}`);

  // 2. 準備通知資料
  const analysis = conv.meddicAnalysis;

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
  if (analysis.agentOutputs) {
    const agentOutputs = analysis.agentOutputs as any;

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
  }

  // 提取痛點
  const painPoints: string[] = [];
  if (analysis.agentOutputs) {
    const summary = (analysis.agentOutputs as any).agent4?.markdown;
    if (summary) {
      const painPointsMatch = summary.match(
        /##\s*🔍\s*您目前遇到的挑戰\s*\n\n((?:- \*\*.*?\*\*:.*?\n)+)/
      );
      if (painPointsMatch?.[1]) {
        const matches = Array.from(
          painPointsMatch[1].matchAll(/- \*\*(.*?)\*\*:/g)
        );
        painPoints.push(...matches.map((m) => m[1]).filter(Boolean));
      }
    }
  }

  // 3. 調用 Slack API 發送通知
  const webhookUrl =
    "https://sales-ai-server.salesaiautomationv3.workers.dev/api/slack/send-notification";

  const payload = {
    userId: slackUserId,
    conversationId: conv.id,
    caseNumber: conv.caseNumber,
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
      summary: (analysis.agentOutputs as any)?.agent4?.markdown,
      smsText: (analysis.agentOutputs as any)?.agent4?.sms_text,
      contactPhone: conv.opportunity.contactPhone,
    },
    processingTimeMs: 105_700, // 原本的處理時間
  };

  console.log("\n📨 發送通知到 Slack...");
  console.log(`Webhook URL: ${webhookUrl}`);

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ 發送失敗: ${response.status} ${response.statusText}`);
    console.error(error);
    process.exit(1);
  }

  const result = await response.json();
  console.log("✅ 通知發送成功!");
  console.log(result);
}

main().catch(console.error);
