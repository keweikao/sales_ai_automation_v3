/**
 * Audio Repair Agent
 * 定期檢測和修復音檔處理失敗的案件
 *
 * 核心原則：有機會就應該有分析
 * - Slack 上傳成功 → 建立機會 → 應該要有完成的分析
 * - 如果機會建立超過 3 小時但沒有分析 → 視為異常，需要處理
 */

import { sql } from "drizzle-orm";
import type { R2StorageService } from "../../storage/r2.js";

// ============================================================
// Types
// ============================================================

// 使用通用的資料庫型別，支援 PostgresJs 和 NeonHttp
interface DatabaseClient {
  execute: (query: ReturnType<typeof sql.raw>) => Promise<{ rows: unknown[] }>;
}

export interface AudioRepairAgentOptions {
  db: DatabaseClient;
  r2Service: R2StorageService;
  slackToken: string;
  serverUrl: string;
  apiToken: string;
  dryRun?: boolean;
  maxRetryAttempts?: number; // 預設 2
  stuckThresholdHours?: number; // 預設 3
}

export interface RepairResult {
  opportunityId: string;
  conversationId: string | null;
  caseNumber: string | null;
  slackUserId: string | null;
  customerNumber: string;
  companyName: string;
  action: "retried" | "deleted" | "skipped";
  reason: string;
}

export interface AudioRepairSummary {
  executionTime: Date;
  checkedCount: number;
  retriedCount: number;
  deletedCount: number;
  skippedCount: number;
  results: RepairResult[];
}

// Slack 頻道 ID
const OPS_ALERT_CHANNEL_ID = "C0A7C2HUXRR";

// ============================================================
// Helper Functions
// ============================================================

/**
 * 從 audioUrl 提取 R2 key
 */
function extractR2Key(audioUrl: string | null): string | null {
  if (!audioUrl) {
    return null;
  }

  // 處理各種格式的 URL
  // 格式 1: https://bucket.endpoint/audio/xxx.mp3
  // 格式 2: audio/xxx.mp3 (直接 key)
  try {
    if (audioUrl.startsWith("http")) {
      const url = new URL(audioUrl);
      // 移除開頭的 /
      return url.pathname.replace(/^\//, "");
    }
    return audioUrl;
  } catch {
    return audioUrl;
  }
}

/**
 * 格式化時間戳 (UTC+8)
 */
function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei",
  }).format(date);
}

// ============================================================
// Main Agent Function
// ============================================================

/**
 * 執行音檔修復 Agent
 */
export async function runAudioRepairAgent(
  options: AudioRepairAgentOptions
): Promise<AudioRepairSummary> {
  const {
    db,
    r2Service,
    slackToken,
    serverUrl,
    apiToken,
    dryRun = false,
    maxRetryAttempts = 2,
    stuckThresholdHours = 3,
  } = options;

  const startTime = new Date();
  const results: RepairResult[] = [];

  console.log(
    `[AudioRepairAgent] Starting execution at ${formatTimestamp(startTime)}`
  );
  console.log(
    `[AudioRepairAgent] Config: dryRun=${dryRun}, maxRetryAttempts=${maxRetryAttempts}, stuckThresholdHours=${stuckThresholdHours}`
  );

  // 計算閾值時間 (機會建立超過 N 小時)
  const thresholdTime = new Date(
    startTime.getTime() - stuckThresholdHours * 60 * 60 * 1000
  );

  // ========================================
  // Step 1: 查詢需要處理的機會
  // ========================================
  // 條件：
  // - 建立超過 3 小時
  // - 沒有 meddic_analyses 記錄
  // - 未超過重試次數限制
  const stuckOpportunities = await db.execute(sql`
    SELECT
      o.id as opportunity_id,
      o.customer_number,
      o.company_name,
      o.retry_count,
      o.last_retry_at,
      c.id as conversation_id,
      c.case_number,
      c.status as conv_status,
      c.audio_url,
      c.slack_user_id,
      c.error_message
    FROM opportunities o
    LEFT JOIN conversations c ON c.opportunity_id = o.id
    LEFT JOIN meddic_analyses m ON m.opportunity_id = o.id
    WHERE o.created_at < ${thresholdTime.toISOString()}::timestamp
      AND m.id IS NULL
      AND (o.retry_count IS NULL OR o.retry_count < ${maxRetryAttempts})
    ORDER BY o.created_at ASC
    LIMIT 100
  `);

  console.log(
    `[AudioRepairAgent] Found ${stuckOpportunities.rows.length} opportunities to check`
  );

  // ========================================
  // Step 2: 處理每個機會
  // ========================================
  for (const row of stuckOpportunities.rows as any[]) {
    const opportunityId = row.opportunity_id;
    const conversationId = row.conversation_id;
    const caseNumber = row.case_number;
    const customerNumber = row.customer_number;
    const companyName = row.company_name;
    const convStatus = row.conv_status;
    const audioUrl = row.audio_url;
    const slackUserId = row.slack_user_id;
    const currentRetryCount = row.retry_count || 0;

    console.log(
      `[AudioRepairAgent] Processing: ${caseNumber || opportunityId} (${companyName})`
    );

    // Case A: 沒有對話記錄 → 異常資料，刪除機會
    if (!conversationId) {
      console.log(
        `[AudioRepairAgent] No conversation found for opportunity ${opportunityId}, marking for deletion`
      );

      if (!dryRun) {
        await deleteOpportunity(db, opportunityId);
      }

      results.push({
        opportunityId,
        conversationId: null,
        caseNumber,
        slackUserId,
        customerNumber,
        companyName,
        action: "deleted",
        reason: "無對話記錄的異常機會",
      });
      continue;
    }

    // Case B: 檢查 R2 音檔是否存在
    const r2Key = extractR2Key(audioUrl);
    let audioExists = false;

    if (r2Key) {
      try {
        audioExists = await r2Service.exists(r2Key);
        console.log(`[AudioRepairAgent] R2 check for ${r2Key}: ${audioExists}`);
      } catch (error) {
        console.error(
          `[AudioRepairAgent] R2 check failed for ${r2Key}:`,
          error
        );
      }
    }

    // Case C: 音檔不存在 → 無法修復，刪除記錄
    if (!audioExists) {
      console.log(
        `[AudioRepairAgent] Audio not found in R2, deleting records for ${caseNumber}`
      );

      if (!dryRun) {
        // 發送 Slack 通知給業務
        if (slackUserId && slackToken) {
          await notifyUserReupload(slackToken, slackUserId, {
            customerNumber,
            companyName,
            reason: "音檔存儲失敗",
          });
        }

        // 刪除相關記錄
        await deleteConversationAndOpportunity(
          db,
          conversationId,
          opportunityId
        );
      }

      results.push({
        opportunityId,
        conversationId,
        caseNumber,
        slackUserId,
        customerNumber,
        companyName,
        action: "deleted",
        reason: "音檔不存在於 R2",
      });
      continue;
    }

    // Case D: 音檔存在 → 嘗試重試
    // 檢查對話狀態
    if (convStatus === "completed") {
      // 對話已完成但沒有分析，可能是分析階段失敗
      console.log(
        `[AudioRepairAgent] Conversation completed but no analysis, attempting retry for ${caseNumber}`
      );
    } else if (convStatus === "failed" || convStatus === "pending") {
      // 對話失敗或卡在 pending，需要重試
      console.log(
        `[AudioRepairAgent] Conversation status is ${convStatus}, attempting retry for ${caseNumber}`
      );
    } else {
      // 其他狀態 (transcribing, analyzing) - 跳過，可能正在處理中
      console.log(
        `[AudioRepairAgent] Conversation in progress (${convStatus}), skipping ${caseNumber}`
      );
      results.push({
        opportunityId,
        conversationId,
        caseNumber,
        slackUserId,
        customerNumber,
        companyName,
        action: "skipped",
        reason: `對話正在處理中 (${convStatus})`,
      });
      continue;
    }

    // 執行重試
    if (dryRun) {
      results.push({
        opportunityId,
        conversationId,
        caseNumber,
        slackUserId,
        customerNumber,
        companyName,
        action: "skipped",
        reason: "[DRY RUN] 將嘗試重試",
      });
    } else {
      const retrySuccess = await retryConversation(
        serverUrl,
        apiToken,
        conversationId,
        caseNumber
      );

      if (retrySuccess) {
        // 更新 retry_count
        await db.execute(sql`
          UPDATE opportunities
          SET retry_count = ${currentRetryCount + 1},
              last_retry_at = NOW(),
              updated_at = NOW()
          WHERE id = ${opportunityId}
        `);

        results.push({
          opportunityId,
          conversationId,
          caseNumber,
          slackUserId,
          customerNumber,
          companyName,
          action: "retried",
          reason: `重試成功 (第 ${currentRetryCount + 1} 次)`,
        });
      } else {
        // 重試失敗，增加 retry_count
        await db.execute(sql`
          UPDATE opportunities
          SET retry_count = ${currentRetryCount + 1},
              last_retry_at = NOW(),
              updated_at = NOW()
          WHERE id = ${opportunityId}
        `);

        // 如果已達到最大重試次數，標記為需要刪除
        if (currentRetryCount + 1 >= maxRetryAttempts) {
          // 發送通知給業務
          if (slackUserId && slackToken) {
            await notifyUserReupload(slackToken, slackUserId, {
              customerNumber,
              companyName,
              reason: "轉錄多次失敗",
            });
          }

          // 刪除記錄
          await deleteConversationAndOpportunity(
            db,
            conversationId,
            opportunityId
          );

          results.push({
            opportunityId,
            conversationId,
            caseNumber,
            slackUserId,
            customerNumber,
            companyName,
            action: "deleted",
            reason: `重試失敗超過 ${maxRetryAttempts} 次`,
          });
        } else {
          results.push({
            opportunityId,
            conversationId,
            caseNumber,
            slackUserId,
            customerNumber,
            companyName,
            action: "retried",
            reason: `重試請求已發送 (第 ${currentRetryCount + 1} 次)，等待結果`,
          });
        }
      }
    }
  }

  // ========================================
  // Step 3: 產生報告摘要
  // ========================================
  const summary: AudioRepairSummary = {
    executionTime: startTime,
    checkedCount: stuckOpportunities.rows.length,
    retriedCount: results.filter((r) => r.action === "retried").length,
    deletedCount: results.filter((r) => r.action === "deleted").length,
    skippedCount: results.filter((r) => r.action === "skipped").length,
    results,
  };

  console.log(
    `[AudioRepairAgent] Completed: checked=${summary.checkedCount}, retried=${summary.retriedCount}, deleted=${summary.deletedCount}, skipped=${summary.skippedCount}`
  );

  // ========================================
  // Step 4: 發送 Ops 日報
  // ========================================
  if (!dryRun && slackToken && summary.checkedCount > 0) {
    await sendOpsDailyReport(slackToken, summary);
  }

  return summary;
}

// ============================================================
// Database Operations
// ============================================================

/**
 * 刪除對話和相關資料
 */
async function deleteConversationAndOpportunity(
  db: DatabaseClient,
  conversationId: string,
  opportunityId: string
): Promise<void> {
  console.log(
    `[AudioRepairAgent] Deleting conversation ${conversationId} and opportunity ${opportunityId}`
  );

  // 按正確順序刪除（考慮外鍵約束）
  // 1. meddic_analyses (WHERE conversation_id)
  await db.execute(sql`
    DELETE FROM meddic_analyses WHERE conversation_id = ${conversationId}
  `);

  // 2. alerts (WHERE conversation_id)
  await db.execute(sql`
    DELETE FROM alerts WHERE conversation_id = ${conversationId}
  `);

  // 3. customer_voice_tags (已有 CASCADE)
  // 4. share_tokens (已有 CASCADE)

  // 5. sales_todos - 先取消關聯
  await db.execute(sql`
    UPDATE sales_todos SET conversation_id = NULL WHERE conversation_id = ${conversationId}
  `);

  // 6. sms_logs
  await db.execute(sql`
    DELETE FROM sms_logs WHERE conversation_id = ${conversationId}
  `);

  // 7. conversations
  await db.execute(sql`
    DELETE FROM conversations WHERE id = ${conversationId}
  `);

  // 檢查是否還有其他對話關聯到此機會
  const remainingConversations = await db.execute(sql`
    SELECT id FROM conversations WHERE opportunity_id = ${opportunityId} LIMIT 1
  `);

  // 如果沒有其他對話，刪除機會
  if (remainingConversations.rows.length === 0) {
    await deleteOpportunity(db, opportunityId);
  }
}

/**
 * 刪除機會和相關資料
 */
async function deleteOpportunity(
  db: DatabaseClient,
  opportunityId: string
): Promise<void> {
  console.log(`[AudioRepairAgent] Deleting opportunity ${opportunityId}`);

  // 刪除機會相關的資料
  // 1. sales_todos
  await db.execute(sql`
    DELETE FROM sales_todos WHERE opportunity_id = ${opportunityId}
  `);

  // 2. follow_ups
  await db.execute(sql`
    DELETE FROM follow_ups WHERE opportunity_id = ${opportunityId}
  `);

  // 3. alerts (機會層級)
  await db.execute(sql`
    DELETE FROM alerts WHERE opportunity_id = ${opportunityId}
  `);

  // 4. meddic_analyses (機會層級)
  await db.execute(sql`
    DELETE FROM meddic_analyses WHERE opportunity_id = ${opportunityId}
  `);

  // 5. opportunities
  await db.execute(sql`
    DELETE FROM opportunities WHERE id = ${opportunityId}
  `);
}

// ============================================================
// API Operations
// ============================================================

/**
 * 呼叫 retry API 重新處理對話
 */
async function retryConversation(
  serverUrl: string,
  apiToken: string,
  conversationId: string,
  caseNumber: string | null
): Promise<boolean> {
  try {
    console.log(
      `[AudioRepairAgent] Calling retry API for ${caseNumber || conversationId}`
    );

    const response = await fetch(`${serverUrl}/api/admin/retry-conversation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        conversationId,
        caseNumber,
      }),
    });

    const result = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    if (response.ok && result.success) {
      console.log(
        `[AudioRepairAgent] Retry request successful for ${caseNumber}`
      );
      return true;
    }
    console.error(
      `[AudioRepairAgent] Retry request failed for ${caseNumber}:`,
      result.error
    );
    return false;
  } catch (error) {
    console.error("[AudioRepairAgent] Retry API call failed:", error);
    return false;
  }
}

// ============================================================
// Slack Notifications
// ============================================================

/**
 * 通知業務重新上傳音檔
 */
async function notifyUserReupload(
  slackToken: string,
  slackUserId: string,
  info: {
    customerNumber: string;
    companyName: string;
    reason: string;
  }
): Promise<void> {
  try {
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🔔 音檔重新上傳通知",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "您上傳的音檔因技術問題無法處理，請重新上傳。",
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*客戶編號:*\n\`${info.customerNumber}\``,
          },
          {
            type: "mrkdwn",
            text: `*客戶名稱:*\n${info.companyName}`,
          },
          {
            type: "mrkdwn",
            text: `*原因:*\n${info.reason}`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "請重新上傳音檔到 Slack，並填寫上述客戶資訊。如有疑問請聯繫技術團隊。",
          },
        ],
      },
    ];

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${slackToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: slackUserId, // DM to user
        blocks,
        text: `🔔 音檔重新上傳通知：${info.companyName}`,
      }),
    });

    const result = (await response.json()) as { ok: boolean; error?: string };

    if (!result.ok) {
      console.error(
        `[AudioRepairAgent] Failed to notify user ${slackUserId}:`,
        result.error
      );
    }
  } catch (error) {
    console.error("[AudioRepairAgent] Error notifying user:", error);
  }
}

/**
 * 發送 Ops 頻道日報
 */
async function sendOpsDailyReport(
  slackToken: string,
  summary: AudioRepairSummary
): Promise<void> {
  try {
    const deletedCases = summary.results
      .filter((r) => r.action === "deleted")
      .map(
        (r) =>
          `- ${r.caseNumber || r.opportunityId} (${r.companyName}) - ${r.reason}`
      )
      .join("\n");

    const retriedCases = summary.results
      .filter((r) => r.action === "retried")
      .map((r) => `- ${r.caseNumber || r.opportunityId} - ${r.reason}`)
      .join("\n");

    const blocks: any[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📊 音檔修復 Agent 日報",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*執行時間:*\n${formatTimestamp(summary.executionTime)}`,
          },
          {
            type: "mrkdwn",
            text: `*檢查數量:*\n${summary.checkedCount} 筆`,
          },
          {
            type: "mrkdwn",
            text: `*重試:*\n${summary.retriedCount} 筆`,
          },
          {
            type: "mrkdwn",
            text: `*已刪除:*\n${summary.deletedCount} 筆`,
          },
        ],
      },
    ];

    if (deletedCases) {
      blocks.push(
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*已刪除案件:*\n${deletedCases}`,
          },
        }
      );
    }

    if (retriedCases) {
      blocks.push(
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*待觀察案件:*\n${retriedCases}`,
          },
        }
      );
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "🤖 由 Audio Repair Agent 自動產生",
        },
      ],
    });

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${slackToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: OPS_ALERT_CHANNEL_ID,
        blocks,
        text: `📊 音檔修復 Agent 日報：檢查 ${summary.checkedCount} 筆，重試 ${summary.retriedCount} 筆，刪除 ${summary.deletedCount} 筆`,
      }),
    });

    const result = (await response.json()) as { ok: boolean; error?: string };

    if (!result.ok) {
      console.error(
        "[AudioRepairAgent] Failed to send daily report:",
        result.error
      );
    }
  } catch (error) {
    console.error("[AudioRepairAgent] Error sending daily report:", error);
  }
}
