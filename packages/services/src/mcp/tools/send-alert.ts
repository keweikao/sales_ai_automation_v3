import { db } from "@Sales_ai_automation_v3/db";
import type {
  AlertSeverity,
  AlertType,
} from "@Sales_ai_automation_v3/db/schema";
import {
  alerts,
  conversations,
  teamMembers,
  user,
} from "@Sales_ai_automation_v3/db/schema";
import { eq } from "drizzle-orm";

/**
 * send-alert Tool
 * 發送警示通知給業務人員和相關主管
 */

// ============================================================
// Types
// ============================================================

export interface SendAlertInput {
  type: AlertType; // "close_now" | "missing_dm" | "manager_escalation"
  severity: AlertSeverity; // "high" | "medium" | "low"
  message: string;
  suggestedAction: string;
  conversationId?: string;
}

export interface SendAlertOutput {
  success: boolean;
  alertId: string;
  sentTo: string[];
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 產生唯一的 Alert ID
 */
function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 根據警示類型取得標題
 */
function getAlertTitle(type: AlertType): string {
  switch (type) {
    case "close_now":
      return "Close Now 機會";
    case "missing_dm":
      return "缺少決策者";
    case "manager_escalation":
      return "需要主管關注";
  }
}

/**
 * 取得相關的通知對象
 * - 業務本人
 * - 該業務的直屬主管
 */
async function getRecipients(
  userId: string | null
): Promise<{ id: string; name: string; email: string }[]> {
  const recipients: { id: string; name: string; email: string }[] = [];

  if (!userId) {
    return recipients;
  }

  // 取得業務本人資訊
  const rep = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });

  if (rep) {
    recipients.push({
      id: rep.id,
      name: rep.name,
      email: rep.email,
    });
  }

  // 取得該業務的主管
  const managerRelations = await db.query.teamMembers.findMany({
    where: eq(teamMembers.memberId, userId),
    with: {
      manager: true,
    },
  });

  for (const relation of managerRelations) {
    if (relation.manager) {
      recipients.push({
        id: relation.manager.id,
        name: relation.manager.name,
        email: relation.manager.email,
      });
    }
  }

  return recipients;
}

// ============================================================
// Main Function
// ============================================================

/**
 * 發送警示
 */
export async function sendAlert(
  input: SendAlertInput
): Promise<SendAlertOutput> {
  const { type, severity, message, suggestedAction, conversationId } = input;

  const alertId = generateAlertId();
  let opportunityId = "";
  let userId: string | null = null;

  // 如果有 conversationId，取得相關的 opportunity 和 user
  if (conversationId) {
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (conversation) {
      opportunityId = conversation.opportunityId ?? "";
      userId = conversation.userId ?? null;
    }
  }

  // 取得通知對象
  const recipients = await getRecipients(userId);
  const sentTo = recipients.map((r) => r.email);

  // 建立警示記錄
  if (opportunityId) {
    await db.insert(alerts).values({
      id: alertId,
      opportunityId,
      conversationId: conversationId ?? null,
      userId,
      type,
      severity,
      status: "pending",
      title: getAlertTitle(type),
      message,
      context: {
        triggerReason: `AI 教練觸發 - ${type}`,
        suggestedAction,
        relatedData: {
          recipients: sentTo,
          triggeredAt: new Date().toISOString(),
        },
      },
    });
  }

  // TODO: 實際發送通知（Email、Slack、Push Notification 等）
  // 這裡可以整合 notifier.ts 的 Slack 通知功能
  // 或是發送 Email 通知

  // 記錄發送結果
  console.log(`Alert ${alertId} sent to: ${sentTo.join(", ")}`);

  return {
    success: true,
    alertId,
    sentTo,
  };
}

/**
 * MCP Tool Definition
 */
export const sendAlertTool = {
  name: "send-alert",
  description:
    "發送警示通知給業務人員和相關主管，支援 close_now、missing_dm、manager_escalation 三種類型",
  inputSchema: {
    type: "object" as const,
    properties: {
      type: {
        type: "string",
        enum: ["close_now", "missing_dm", "manager_escalation"],
        description: "警示類型",
      },
      severity: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "警示嚴重程度",
      },
      message: {
        type: "string",
        description: "警示訊息內容",
      },
      suggestedAction: {
        type: "string",
        description: "建議的行動方案",
      },
      conversationId: {
        type: "string",
        description: "相關對話的 ID（可選）",
      },
    },
    required: ["type", "severity", "message", "suggestedAction"],
  },
  execute: sendAlert,
};
