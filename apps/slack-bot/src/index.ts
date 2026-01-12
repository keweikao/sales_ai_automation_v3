/**
 * Slack Bot - Cloudflare Workers Entry Point
 *
 * 這個檔案是 Cloudflare Workers 的入口點，
 * 負責處理 Slack 事件和指令請求
 */

import { Hono } from "hono";
import { handleAcknowledgeAlert, handleDismissAlert } from "./alerts";
import { handleSlackCommand } from "./commands";
import { handleSlackEvent } from "./events";
import type { Env, SlackRequestBody } from "./types";
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

  if (!timestamp || !signature) {
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

  if (!timestamp || !signature) {
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

  if (!timestamp || !signature) {
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

  // Handle different interaction types
  if (payload.type === "block_actions") {
    // Handle button clicks
    const action = payload.actions?.[0];
    if (action) {
      const actionId = action.action_id;
      const value = action.value;

      console.log(`Button action: ${actionId}`, value);

      // Process alert actions asynchronously
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

            default:
              console.log(`Unhandled action: ${actionId}`);
          }
        })()
      );
    }
  }

  return c.json({ ok: true });
});

export default app;
