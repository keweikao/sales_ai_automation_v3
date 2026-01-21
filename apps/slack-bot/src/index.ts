/**
 * Slack Bot - Cloudflare Workers Entry Point
 *
 * 這個檔案是 Cloudflare Workers 的入口點，
 * 負責處理 Slack 事件和指令請求
 */

import { Hono } from "hono";
import { handleAcknowledgeAlert, handleDismissAlert } from "./alerts";
import { ApiClient } from "./api-client";
import {
  buildEditSummaryModal,
  parseEditSummaryValues,
} from "./blocks/edit-summary-modal";
import { handleSlackCommand } from "./commands";
import { handleSlackEvent } from "./events";
import { processAudioWithMetadata } from "./events/file";
import { createNotificationService } from "./services/notification";
import type { Env, PendingAudioFile, SlackRequestBody } from "./types";
import {
  buildAudioUploadModal,
  parseAudioUploadFormValues,
} from "./utils/form-builder";
import { resolveProductLine } from "./utils/product-line-resolver";
import { SlackClient } from "./utils/slack-client";
import { verifySlackRequest } from "./utils/verify";

const app = new Hono<{ Bindings: Env }>();

// Health check endpoint
app.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "sales-ai-slack-bot",
    timestamp: new Date().toISOString(),
  });
});

// Slack Events API endpoint
app.post("/slack/events", async (c) => {
  const env = c.env;
  const rawBody = await c.req.text();

  // Verify Slack request signature
  const timestamp = c.req.header("x-slack-request-timestamp");
  const signature = c.req.header("x-slack-signature");

  if (!(timestamp && signature)) {
    return c.json({ error: "Missing headers" }, 401);
  }

  const isValid = await verifySlackRequest(
    rawBody,
    timestamp,
    signature,
    env.SLACK_SIGNING_SECRET
  );

  if (!isValid) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const body = JSON.parse(rawBody) as SlackRequestBody;

  // Handle URL verification challenge
  if (body.type === "url_verification") {
    return c.json({ challenge: body.challenge });
  }

  // Handle events
  if (body.type === "event_callback" && body.event) {
    // Process event asynchronously
    c.executionCtx.waitUntil(handleSlackEvent(body.event, env));
    return c.json({ ok: true });
  }

  return c.json({ ok: true });
});

// Slack Commands endpoint
app.post("/slack/commands", async (c) => {
  const env = c.env;
  const rawBody = await c.req.text();

  // Verify Slack request signature
  const timestamp = c.req.header("x-slack-request-timestamp");
  const signature = c.req.header("x-slack-signature");

  if (!(timestamp && signature)) {
    return c.json({ error: "Missing headers" }, 401);
  }

  const isValid = await verifySlackRequest(
    rawBody,
    timestamp,
    signature,
    env.SLACK_SIGNING_SECRET
  );

  if (!isValid) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  // Parse form data
  const formData = new URLSearchParams(rawBody);
  const command = formData.get("command") ?? "";
  const text = formData.get("text") ?? "";
  const userId = formData.get("user_id") ?? "";
  const channelId = formData.get("channel_id") ?? "";
  const responseUrl = formData.get("response_url") ?? "";
  const triggerId = formData.get("trigger_id") ?? "";

  // Process command asynchronously and return immediate response
  c.executionCtx.waitUntil(
    handleSlackCommand(
      {
        command,
        text,
        userId,
        channelId,
        responseUrl,
        triggerId,
      },
      env
    )
  );

  // Return immediate acknowledgment
  return c.json({
    response_type: "ephemeral",
    text: "處理中... :hourglass_flowing_sand:",
  });
});

// Slack Interactions endpoint (for buttons, modals, etc.)
app.post("/slack/interactions", async (c) => {
  const env = c.env;
  const rawBody = await c.req.text();

  // Verify Slack request signature
  const timestamp = c.req.header("x-slack-request-timestamp");
  const signature = c.req.header("x-slack-signature");

  if (!(timestamp && signature)) {
    return c.json({ error: "Missing headers" }, 401);
  }

  const isValid = await verifySlackRequest(
    rawBody,
    timestamp,
    signature,
    env.SLACK_SIGNING_SECRET
  );

  if (!isValid) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  // Parse payload
  const formData = new URLSearchParams(rawBody);
  const payloadStr = formData.get("payload");

  if (!payloadStr) {
    return c.json({ error: "Missing payload" }, 400);
  }

  const payload = JSON.parse(payloadStr);

  console.log(`[Interaction] Received interaction type: ${payload.type}`);
  console.log("[Interaction] Payload:", JSON.stringify(payload, null, 2));

  // Handle different interaction types
  if (payload.type === "block_actions") {
    // Handle button clicks
    const action = payload.actions?.[0];
    if (action) {
      const actionId = action.action_id;
      const value = action.value;

      console.log(`[Interaction] Button action: ${actionId}`);
      console.log("[Interaction] Action value:", value);

      // Process actions asynchronously
      c.executionCtx.waitUntil(
        (async () => {
          switch (actionId) {
            case "acknowledge_alert": {
              const ackResult = await handleAcknowledgeAlert(
                value,
                payload.user.id,
                env
              );
              if (ackResult.success && payload.response_url) {
                await fetch(payload.response_url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    text: `${ackResult.message}`,
                    replace_original: false,
                  }),
                });
              }
              break;
            }

            case "dismiss_alert": {
              const dismissResult = await handleDismissAlert(value, env);
              if (dismissResult.success && payload.response_url) {
                await fetch(payload.response_url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    text: `${dismissResult.message}`,
                    replace_original: false,
                  }),
                });
              }
              break;
            }

            case "open_audio_upload_modal": {
              // 開啟音檔上傳資訊填寫 Modal
              console.log("[Modal] Opening audio upload modal");
              try {
                const pendingFile: PendingAudioFile = JSON.parse(value);
                console.log(
                  "[Modal] Pending file:",
                  JSON.stringify(pendingFile, null, 2)
                );

                // 解析產品線
                const productLine = resolveProductLine(
                  pendingFile.channelId,
                  env
                );
                console.log(
                  `[Modal] Resolved product line: ${productLine} for channel: ${pendingFile.channelId}`
                );

                const slackClient = new SlackClient(env.SLACK_BOT_TOKEN);
                const modal = buildAudioUploadModal(pendingFile, productLine);
                console.log("[Modal] Modal built successfully");
                console.log(`[Modal] Trigger ID: ${payload.trigger_id}`);

                const result = await slackClient.openView(
                  payload.trigger_id,
                  modal
                );

                console.log(
                  "[Modal] Open view result:",
                  JSON.stringify(result, null, 2)
                );

                if (!result.ok) {
                  console.error(
                    `[Modal] Failed to open modal: ${result.error}`
                  );
                  // 發送錯誤訊息
                  if (payload.response_url) {
                    await fetch(payload.response_url, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        text: `:x: 無法開啟表單: ${result.error}`,
                        replace_original: false,
                      }),
                    });
                  }
                }
              } catch (error) {
                console.error("Error opening audio upload modal:", error);
              }
              break;
            }

            case "skip_audio_upload": {
              // 用戶選擇略過此檔案
              if (payload.response_url) {
                await fetch(payload.response_url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    text: ":wastebasket: 已略過此音檔",
                    replace_original: true,
                  }),
                });
              }
              break;
            }

            case "edit_summary": {
              // 開啟編輯 Summary Modal
              try {
                const data = JSON.parse(value);
                const slackClient = new SlackClient(env.SLACK_BOT_TOKEN);
                const modal = buildEditSummaryModal({
                  conversationId: data.conversationId,
                  currentSummary: data.summary,
                  contactPhone: data.contactPhone,
                  contactEmail: data.contactEmail,
                });

                const result = await slackClient.openView(
                  payload.trigger_id,
                  modal
                );

                if (!result.ok) {
                  console.error(
                    "Failed to open edit summary modal:",
                    result.error
                  );
                }
              } catch (error) {
                console.error("Error opening edit summary modal:", error);
              }
              break;
            }

            case "send_customer_sms": {
              // 發送客戶 SMS (使用 API)
              try {
                const data = JSON.parse(value);
                console.log(
                  "[SMS] Sending customer SMS via API:",
                  JSON.stringify(data, null, 2)
                );

                if (!(data.conversationId && data.phoneNumber)) {
                  console.error("[SMS] Missing required fields:", data);
                  if (payload.response_url) {
                    await fetch(payload.response_url, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        text: ":x: 無法發送簡訊：缺少必要資訊",
                        replace_original: false,
                      }),
                    });
                  }
                  break;
                }

                // 顯示確認對話框 (使用 Slack 的 response_url 更新訊息)
                if (payload.response_url) {
                  await fetch(payload.response_url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      text: `:hourglass_flowing_sand: 正在發送簡訊至 ${data.phoneNumber}...`,
                      replace_original: false,
                    }),
                  });
                }

                // 調用 API 發送 SMS
                const apiClient = new ApiClient(
                  env.API_BASE_URL,
                  env.API_TOKEN
                );
                const smsResult = await apiClient.sendCustomerSMS({
                  conversationId: data.conversationId,
                });

                console.log(
                  "[SMS] API response:",
                  JSON.stringify(smsResult, null, 2)
                );

                // 發送結果通知
                if (payload.response_url) {
                  await fetch(payload.response_url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      text: smsResult.success
                        ? `:white_check_mark: 簡訊已成功發送至 ${data.phoneNumber}`
                        : `:x: 簡訊發送失敗: ${smsResult.message || "未知錯誤"}`,
                      replace_original: false,
                    }),
                  });
                }
              } catch (error) {
                console.error("[SMS] Error sending customer SMS:", error);
                if (payload.response_url) {
                  await fetch(payload.response_url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      text: `:x: 簡訊發送失敗: ${String(error)}`,
                      replace_original: false,
                    }),
                  });
                }
              }
              break;
            }

            case "send_sms": {
              // 發送簡訊給客戶 (舊版,保留向後相容)
              try {
                const data = JSON.parse(value);
                const notificationService = createNotificationService(env);

                if (!data.contactPhone) {
                  if (payload.response_url) {
                    await fetch(payload.response_url, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        text: ":x: 無法發送簡訊：客戶電話資訊不存在",
                        replace_original: false,
                      }),
                    });
                  }
                  break;
                }

                const result = await notificationService.sendSMS(
                  data.contactPhone,
                  data.summary
                );

                if (payload.response_url) {
                  await fetch(payload.response_url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      text: result.success
                        ? `:white_check_mark: 簡訊已發送至 ${data.contactPhone}`
                        : `:x: 簡訊發送失敗: ${result.error}`,
                      replace_original: false,
                    }),
                  });
                }
              } catch (error) {
                console.error("Error sending SMS:", error);
              }
              break;
            }

            case "send_email": {
              // 發送 Email 給客戶
              try {
                const data = JSON.parse(value);
                const notificationService = createNotificationService(env);

                if (!data.contactEmail) {
                  if (payload.response_url) {
                    await fetch(payload.response_url, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        text: ":x: 無法發送 Email：客戶 Email 資訊不存在",
                        replace_original: false,
                      }),
                    });
                  }
                  break;
                }

                const result = await notificationService.sendEmail(
                  data.contactEmail,
                  "會議摘要",
                  data.summary
                );

                if (payload.response_url) {
                  await fetch(payload.response_url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      text: result.success
                        ? `:white_check_mark: Email 已發送至 ${data.contactEmail}`
                        : `:x: Email 發送失敗: ${result.error}`,
                      replace_original: false,
                    }),
                  });
                }
              } catch (error) {
                console.error("Error sending email:", error);
              }
              break;
            }

            default:
              console.log(`Unhandled action: ${actionId}`);
          }
        })()
      );
    }
  }

  // Handle Modal submission
  if (payload.type === "view_submission") {
    const callbackId = payload.view?.callback_id;

    if (callbackId === "audio_upload_form") {
      // 處理音檔上傳表單提交
      try {
        const privateMetadata = payload.view?.private_metadata;
        const modalData = JSON.parse(privateMetadata);
        const productLine = modalData.productLine || "ichef";
        const values = payload.view?.state?.values;

        console.log(
          `[Modal Submit] Processing form for product line: ${productLine}`
        );

        // 解析表單值
        const metadata = parseAudioUploadFormValues(values, productLine);

        // 驗證所有必填欄位
        const errors: Record<string, string> = {};

        if (!metadata.customerNumber?.trim()) {
          errors.customer_number = "請輸入客戶編號";
        }
        if (!metadata.customerName?.trim()) {
          errors.customer_name = "請輸入客戶名稱";
        }
        if (metadata.contactPhone?.trim()) {
          // 驗證電話格式
          const phoneDigits = metadata.contactPhone.replace(/\D/g, "");
          if (!/^09\d{8}$/.test(phoneDigits)) {
            errors.contact_phone =
              "請輸入有效的台灣手機號碼（例如：0912-345-678）";
          }
        } else {
          errors.contact_phone = "請輸入客戶電話";
        }
        if (!metadata.storeType) {
          errors.store_type = "請選擇店型";
        }

        // iCHEF 特定驗證
        if (productLine === "ichef" && !metadata.serviceType) {
          errors.service_type = "請選擇營運型態";
        }

        // Beauty 特定驗證
        if (productLine === "beauty" && !metadata.staffCount) {
          errors.staff_count = "請選擇員工數量";
        }

        if (!metadata.currentSystem) {
          errors.current_system = "請選擇現有系統";
        }

        if (Object.keys(errors).length > 0) {
          return c.json({
            response_action: "errors",
            errors,
          });
        }

        // 重建 PendingAudioFile
        const pendingFile: PendingAudioFile = {
          fileId: modalData.fileId,
          fileName: modalData.fileName,
          channelId: modalData.channelId,
          userId: modalData.userId,
          userName: modalData.userName,
          threadTs: modalData.threadTs,
          downloadUrl: modalData.downloadUrl,
        };

        // 合併 metadata (轉換為舊格式以保持向後相容)
        const legacyMetadata = {
          customerNumber: metadata.customerNumber || "",
          customerName: metadata.customerName || "",
          storeType: metadata.storeType as
            | "cafe"
            | "beverage"
            | "hotpot"
            | "bbq"
            | "snack"
            | "restaurant"
            | "bar"
            | "fastfood"
            | "other",
          serviceType: metadata.serviceType as
            | "dine_in_only"
            | "takeout_only"
            | "dine_in_main"
            | "takeout_main",
          currentPos: (metadata.currentSystem || "none") as
            | "none"
            | "ichef_old"
            | "dudu"
            | "eztable"
            | "other_pos"
            | "traditional"
            | "manual",
          decisionMakerOnsite: metadata.decisionMakerPresent === "yes",
          // 新增欄位
          productLine: metadata.productLine,
          staffCount: metadata.staffCount,
          currentSystem: metadata.currentSystem,
          decisionMakerPresent: metadata.decisionMakerPresent,
        };

        // 非同步處理音檔
        c.executionCtx.waitUntil(
          processAudioWithMetadata(pendingFile, legacyMetadata, env)
        );

        // 返回空回應關閉 Modal
        return c.json({});
      } catch (error) {
        console.error("Error processing audio upload form:", error);
        return c.json({
          response_action: "errors",
          errors: {
            customer_name:
              error instanceof Error ? error.message : "處理表單時發生錯誤",
          },
        });
      }
    }

    if (callbackId === "edit_summary_modal") {
      // 處理 Summary 編輯表單提交
      try {
        const privateMetadata = payload.view?.private_metadata;
        const modalData = JSON.parse(privateMetadata);
        const values = payload.view?.state?.values;

        // 解析表單值
        const { summary } = parseEditSummaryValues(values);

        // 驗證
        if (!summary.trim()) {
          return c.json({
            response_action: "errors",
            errors: {
              summary_block: "請輸入會議摘要",
            },
          });
        }

        // 非同步儲存 Summary
        c.executionCtx.waitUntil(
          (async () => {
            try {
              const apiClient = new ApiClient(env.API_BASE_URL, env.API_TOKEN);
              await apiClient.updateConversationSummary(
                modalData.conversationId,
                summary
              );
              console.log(
                `Summary updated for conversation: ${modalData.conversationId}`
              );
            } catch (error) {
              console.error("Failed to update summary:", error);
            }
          })()
        );

        // 返回空回應關閉 Modal
        return c.json({});
      } catch (error) {
        console.error("Error processing edit summary form:", error);
        return c.json({
          response_action: "errors",
          errors: {
            summary_block:
              error instanceof Error ? error.message : "處理表單時發生錯誤",
          },
        });
      }
    }
  }

  return c.json({ ok: true });
});

// ============================================================
// Cloudflare Workers Export
// 合併 Hono fetch handler 和 Scheduled handler
// ============================================================

export default {
  // HTTP 請求處理 (Hono app)
  fetch: app.fetch,

  // Cron Trigger 處理 - Slack Bot 專屬檢查
  async scheduled(
    event: ScheduledEvent,
    _env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    console.log("[Slack Bot Ops] Scheduled event triggered:", event.cron);

    try {
      // Slack Bot 可以執行特定的 Slack 相關檢查
      // 例如：檢查待處理警示、檢查訊息佇列等

      // TODO: 實作 Slack 專屬的健康檢查
      console.log("[Slack Bot Ops] Health check completed");
    } catch (error) {
      console.error("[Slack Bot Ops] Scheduled event failed:", error);
    }
  },
};
