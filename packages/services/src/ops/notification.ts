/**
 * Ops Notification Service
 * 負責發送 Ops 警示通知到 Slack
 */

import type { OpsCheckResult, OpsExecutionSummary } from "./types.js";

// ============================================================
// Constants
// ============================================================

const OPS_ALERT_CHANNEL_ID = "C0A7C2HUXRR"; // Slack 警示頻道 ID

// ============================================================
// Helper Functions
// ============================================================

/**
 * 格式化時間戳
 */
function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

// ============================================================
// Notification Functions
// ============================================================

/**
 * 發送 Ops 警示到 Slack
 */
export async function sendOpsAlert(
  summary: OpsExecutionSummary,
  slackBotToken: string
): Promise<void> {
  const criticalFailures = summary.checkResults.filter(
    (r) => r.status === "critical"
  );

  if (criticalFailures.length === 0) {
    return; // 沒有 critical 問題，不發送通知
  }

  const blocks = buildAlertBlocks(summary, criticalFailures);

  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${slackBotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: OPS_ALERT_CHANNEL_ID,
        blocks,
        text: `🚨 系統健康檢查警示：偵測到 ${criticalFailures.length} 個嚴重問題`,
      }),
    });

    const result = (await response.json()) as { ok: boolean; error?: string };

    if (result.ok) {
      console.log("[Ops Notification] Alert sent successfully to Slack");
    } else {
      console.error(
        "[Ops Notification] Failed to send Slack alert:",
        result.error
      );
    }
  } catch (error) {
    console.error("[Ops Notification] Error sending Slack alert:", error);
  }
}

/**
 * 建立 Slack 訊息 Blocks
 */
function buildAlertBlocks(
  summary: OpsExecutionSummary,
  criticalFailures: OpsCheckResult[]
): any[] {
  const blocks: any[] = [];

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "🚨 系統健康檢查警示",
      emoji: true,
    },
  });

  // 執行摘要
  blocks.push({
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*執行時間:*\n${formatTimestamp(summary.timestamp)}`,
      },
      {
        type: "mrkdwn",
        text: `*總執行時間:*\n${summary.totalTimeMs}ms`,
      },
      {
        type: "mrkdwn",
        text: `*健康檢查:*\n✅ ${summary.healthyCount} / ⚠️ ${summary.degradedCount} / 🚨 ${summary.criticalCount}`,
      },
      {
        type: "mrkdwn",
        text: `*自動修復:*\n✅ ${summary.repairSuccessCount} / ❌ ${summary.repairFailureCount}`,
      },
    ],
  });

  blocks.push({ type: "divider" });

  // Critical 問題詳情
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*偵測到 ${criticalFailures.length} 個嚴重問題:*`,
    },
  });

  for (const failure of criticalFailures) {
    // 檢查是否有對應的修復結果
    const repairResult = summary.repairResults.find((r) =>
      r.toolName.includes(failure.toolName.replace("_check", ""))
    );

    let statusText = "🚨 *嚴重問題*";
    if (repairResult) {
      statusText = repairResult.success ? "✅ *已自動修復*" : "❌ *修復失敗*";
    }

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${statusText}\n\n*檢查項目:* \`${failure.toolName}\`\n*詳細資訊:* ${failure.details || "無詳細資訊"}\n*時間:* ${formatTimestamp(failure.timestamp)}`,
      },
    });
  }

  blocks.push({ type: "divider" });

  // Footer
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "🤖 由 Routine Ops Agent 自動產生",
      },
    ],
  });

  return blocks;
}

/**
 * 發送每日報告到 Slack
 */
export async function sendDailySummary(
  summaries: OpsExecutionSummary[],
  slackBotToken: string
): Promise<void> {
  if (summaries.length === 0) {
    return;
  }

  const blocks = buildDailySummaryBlocks(summaries);

  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${slackBotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: OPS_ALERT_CHANNEL_ID,
        blocks,
        text: "📊 每日系統健康檢查報告",
      }),
    });

    const result = (await response.json()) as { ok: boolean; error?: string };

    if (result.ok) {
      console.log("[Ops Notification] Daily summary sent successfully");
    } else {
      console.error(
        "[Ops Notification] Failed to send daily summary:",
        result.error
      );
    }
  } catch (error) {
    console.error("[Ops Notification] Error sending daily summary:", error);
  }
}

/**
 * 建立每日報告 Blocks
 */
function buildDailySummaryBlocks(summaries: OpsExecutionSummary[]): any[] {
  const totalChecks = summaries.reduce(
    (sum, s) => sum + s.checkResults.length,
    0
  );
  const totalHealthy = summaries.reduce((sum, s) => sum + s.healthyCount, 0);
  const totalDegraded = summaries.reduce((sum, s) => sum + s.degradedCount, 0);
  const totalCritical = summaries.reduce((sum, s) => sum + s.criticalCount, 0);
  const totalRepairs = summaries.reduce(
    (sum, s) => sum + s.repairResults.length,
    0
  );
  const totalRepairSuccess = summaries.reduce(
    (sum, s) => sum + s.repairSuccessCount,
    0
  );

  const blocks: any[] = [];

  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "📊 每日系統健康檢查報告",
      emoji: true,
    },
  });

  blocks.push({
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*執行次數:*\n${summaries.length} 次`,
      },
      {
        type: "mrkdwn",
        text: `*總檢查數:*\n${totalChecks}`,
      },
      {
        type: "mrkdwn",
        text: `*健康比例:*\n${((totalHealthy / totalChecks) * 100).toFixed(1)}%`,
      },
      {
        type: "mrkdwn",
        text: `*修復成功率:*\n${totalRepairs > 0 ? ((totalRepairSuccess / totalRepairs) * 100).toFixed(1) : 0}%`,
      },
    ],
  });

  blocks.push({ type: "divider" });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*狀態分布:*\n✅ 健康: ${totalHealthy}\n⚠️ 降級: ${totalDegraded}\n🚨 嚴重: ${totalCritical}`,
    },
  });

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `報告時間: ${formatTimestamp(new Date())}`,
      },
    ],
  });

  return blocks;
}
