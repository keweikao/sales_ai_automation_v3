/**
 * Slack MCP Tools
 * 提供格式化的 Slack 訊息發送功能，使用 Block Kit 優化 MEDDIC 分析結果的展示
 */

import { z } from "zod";
import type { MCPTool } from "../types.js";

// ============================================================
// Type Definitions
// ============================================================

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: unknown[];
  fields?: unknown[];
  accessory?: unknown;
}

// ============================================================
// Slack Post Formatted Analysis Tool
// ============================================================

const SlackPostAnalysisInputSchema = z.object({
  channel: z.string().min(1, "Channel is required"),
  conversationId: z.string(),
  caseNumber: z.string(),
  overallScore: z.number().min(0).max(100),
  qualificationStatus: z.enum([
    "qualified",
    "needs_improvement",
    "not_qualified",
  ]),
  dimensions: z.object({
    metrics: z.number().min(0).max(100),
    economicBuyer: z.number().min(0).max(100),
    decisionCriteria: z.number().min(0).max(100),
    decisionProcess: z.number().min(0).max(100),
    identifyPain: z.number().min(0).max(100),
    champion: z.number().min(0).max(100),
  }),
  keyFindings: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  alertLevel: z.enum(["info", "warning", "critical"]).optional(),
});

const SlackPostAnalysisOutputSchema = z.object({
  success: z.boolean(),
  blocks: z.array(z.any()),
  messagePreview: z.string(),
});

type SlackPostAnalysisInput = z.infer<typeof SlackPostAnalysisInputSchema>;
type SlackPostAnalysisOutput = z.infer<typeof SlackPostAnalysisOutputSchema>;

/**
 * 建立 MEDDIC 分析的 Slack Block Kit 訊息
 */
function buildMeddicBlocks(input: SlackPostAnalysisInput): SlackBlock[] {
  const statusEmoji: Record<string, string> = {
    qualified: ":white_check_mark:",
    needs_improvement: ":warning:",
    not_qualified: ":x:",
  };

  const alertEmoji: Record<string, string> = {
    info: ":information_source:",
    warning: ":warning:",
    critical: ":rotating_light:",
  };

  const scoreBar = (score: number): string => {
    const filled = Math.round(score / 10);
    const empty = 10 - filled;
    if (score >= 70) {
      return (
        ":large_green_square:".repeat(filled) +
        ":white_large_square:".repeat(empty)
      );
    }
    if (score >= 50) {
      return (
        ":large_yellow_square:".repeat(filled) +
        ":white_large_square:".repeat(empty)
      );
    }
    return (
      ":large_red_square:".repeat(filled) + ":white_large_square:".repeat(empty)
    );
  };

  const blocks: SlackBlock[] = [];

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `📊 MEDDIC 分析報告 - ${input.caseNumber}`,
      emoji: true,
    },
  });

  // Alert level (if set)
  if (input.alertLevel && input.alertLevel !== "info") {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${alertEmoji[input.alertLevel]} *警示等級: ${input.alertLevel.toUpperCase()}*`,
      },
    });
  }

  // Overall status
  blocks.push({
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*案件編號:*\n${input.caseNumber}`,
      },
      {
        type: "mrkdwn",
        text: `*對話 ID:*\n${input.conversationId}`,
      },
      {
        type: "mrkdwn",
        text: `*整體評分:*\n*${input.overallScore}/100* ${scoreBar(input.overallScore)}`,
      },
      {
        type: "mrkdwn",
        text: `*資格狀態:*\n${statusEmoji[input.qualificationStatus]} ${input.qualificationStatus.toUpperCase()}`,
      },
    ],
  });

  blocks.push({ type: "divider" });

  // MEDDIC Dimensions
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: "*🎯 MEDDIC 六維度評分*",
    },
  });

  const dimensions = [
    { name: "Metrics", key: "metrics", emoji: "1️⃣" },
    { name: "Economic Buyer", key: "economicBuyer", emoji: "2️⃣" },
    { name: "Decision Criteria", key: "decisionCriteria", emoji: "3️⃣" },
    { name: "Decision Process", key: "decisionProcess", emoji: "4️⃣" },
    { name: "Identify Pain", key: "identifyPain", emoji: "5️⃣" },
    { name: "Champion", key: "champion", emoji: "6️⃣" },
  ] as const;

  for (const dim of dimensions) {
    const score = input.dimensions[dim.key];
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${dim.emoji} *${dim.name}*\n${scoreBar(score)} ${score}/100`,
      },
    });
  }

  // Key Findings
  if (input.keyFindings && input.keyFindings.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*🔍 關鍵發現*",
      },
    });

    for (const finding of input.keyFindings.slice(0, 3)) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `• ${finding}`,
        },
      });
    }
  }

  // Recommendations
  if (input.recommendations && input.recommendations.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*💡 行動建議*",
      },
    });

    for (const rec of input.recommendations.slice(0, 3)) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `• ${rec}`,
        },
      });
    }
  }

  // Footer
  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `生成時間: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} {time}|${new Date().toISOString()}>`,
      },
    ],
  });

  return blocks;
}

export const slackPostFormattedAnalysisTool: MCPTool<
  SlackPostAnalysisInput,
  SlackPostAnalysisOutput
> = {
  name: "slack_post_formatted_analysis",
  description:
    "發送格式化的 MEDDIC 分析結果到 Slack 頻道。使用 Slack Block Kit 優化視覺呈現，包含評分、狀態、建議等。",
  inputSchema: SlackPostAnalysisInputSchema,
  handler: async (input) => {
    try {
      const blocks = buildMeddicBlocks(input);

      // 建立預覽文字
      const statusText =
        input.qualificationStatus === "qualified"
          ? "✅ QUALIFIED"
          : input.qualificationStatus === "needs_improvement"
            ? "⚠️ NEEDS IMPROVEMENT"
            : "❌ NOT QUALIFIED";

      const messagePreview = `MEDDIC 分析報告 - ${input.caseNumber}\n整體評分: ${input.overallScore}/100 (${statusText})`;

      return {
        success: true,
        blocks,
        messagePreview,
      };
    } catch (error) {
      throw new Error(
        `Failed to create Slack message: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// Slack Post Alert Tool
// ============================================================

const SlackPostAlertInputSchema = z.object({
  channel: z.string().min(1, "Channel is required"),
  alertType: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string(),
  details: z.record(z.string(), z.string()).optional(),
  actionRequired: z.string().optional(),
});

const SlackPostAlertOutputSchema = z.object({
  success: z.boolean(),
  blocks: z.array(z.any()),
  messagePreview: z.string(),
});

type SlackPostAlertInput = z.infer<typeof SlackPostAlertInputSchema>;
type SlackPostAlertOutput = z.infer<typeof SlackPostAlertOutputSchema>;

/**
 * 建立警示訊息的 Slack Block Kit
 */
function buildAlertBlocks(input: SlackPostAlertInput): SlackBlock[] {
  const severityEmoji: Record<string, string> = {
    info: ":information_source:",
    warning: ":warning:",
    critical: ":rotating_light:",
  };

  const blocks: SlackBlock[] = [];

  // Header with severity
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `${severityEmoji[input.severity]} ${input.alertType}`,
      emoji: true,
    },
  });

  // Main message
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*訊息:* ${input.message}`,
    },
  });

  // Details (if provided)
  if (input.details && Object.keys(input.details).length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*詳細資訊:*",
      },
    });

    const detailFields = Object.entries(input.details).map(([key, value]) => ({
      type: "mrkdwn",
      text: `*${key}:*\n${value}`,
    }));

    blocks.push({
      type: "section",
      fields: detailFields,
    });
  }

  // Action required (if provided)
  if (input.actionRequired) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*:point_right: 需要採取的行動:*\n${input.actionRequired}`,
      },
    });
  }

  // Footer
  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `警示等級: *${input.severity.toUpperCase()}* | 時間: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} {time}|${new Date().toISOString()}>`,
      },
    ],
  });

  return blocks;
}

export const slackPostAlertTool: MCPTool<
  SlackPostAlertInput,
  SlackPostAlertOutput
> = {
  name: "slack_post_alert",
  description:
    "發送格式化的警示訊息到 Slack 頻道。支援三種嚴重程度（info/warning/critical），可包含詳細資訊和行動建議。",
  inputSchema: SlackPostAlertInputSchema,
  handler: async (input) => {
    try {
      const blocks = buildAlertBlocks(input);

      const messagePreview = `[${input.severity.toUpperCase()}] ${input.alertType}: ${input.message}`;

      return {
        success: true,
        blocks,
        messagePreview,
      };
    } catch (error) {
      throw new Error(
        `Failed to create alert message: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};
