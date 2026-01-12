/**
 * Schedule Follow-up Tool
 * 排程跟進提醒的 MCP Tool
 */

import { db } from "@Sales_ai_automation_v3/db";
import { followUps } from "@Sales_ai_automation_v3/db/schema";
import { z } from "zod";

import type { ExecutionContext, MCPTool } from "../types.js";

// ============================================================
// Input/Output Types
// ============================================================

/** 跟進時機選項 */
const timingOptions = ["2_hours", "tomorrow_9am", "3_days", "1_week"] as const;

/** 頻道選項 */
const channelOptions = ["slack_dm", "slack_channel"] as const;

/** Schedule Follow-up 輸入 Schema */
export const scheduleFollowUpInputSchema = z.object({
  /** 跟進時機 */
  timing: z.enum(timingOptions),
  /** 發送頻道 */
  channel: z.enum(channelOptions),
  /** 跟進訊息 */
  message: z.string().min(1, "Message is required"),
  /** 建議的 Talk Track */
  talkTrack: z.string().optional(),
  /** 目標頻道 ID（可選） */
  channelTarget: z.string().optional(),
});

export type ScheduleFollowUpInput = z.infer<typeof scheduleFollowUpInputSchema>;

/** Schedule Follow-up 輸出 */
export interface ScheduleFollowUpOutput {
  /** 是否成功 */
  success: boolean;
  /** 建立的 Follow-up ID */
  followUpId: string;
  /** 排程時間 */
  scheduledAt: string;
  /** 訊息 */
  message?: string;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 計算排程時間
 * @param timing - 跟進時機
 * @returns 排程的 Date 物件
 */
function calculateScheduledTime(timing: ScheduleFollowUpInput["timing"]): Date {
  const now = new Date();

  switch (timing) {
    case "2_hours": {
      return new Date(now.getTime() + 2 * 60 * 60 * 1000);
    }
    case "tomorrow_9am": {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;
    }
    case "3_days": {
      return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    }
    case "1_week": {
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }
}

/**
 * 產生唯一 ID
 * 使用時間戳和隨機字串組合
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `fu_${timestamp}_${random}`;
}

// ============================================================
// Tool Handler
// ============================================================

/**
 * Schedule Follow-up Handler
 * 建立一個新的跟進排程
 */
async function scheduleFollowUpHandler(
  input: ScheduleFollowUpInput,
  context: ExecutionContext
): Promise<ScheduleFollowUpOutput> {
  // 驗證必要的上下文
  if (!context.userId) {
    throw new Error("User ID is required in execution context");
  }

  // 計算排程時間
  const scheduledAt = calculateScheduledTime(input.timing);

  // 產生唯一 ID
  const followUpId = generateId();

  // 建立 Follow-up 記錄
  await db.insert(followUps).values({
    id: followUpId,
    userId: context.userId,
    opportunityId: context.opportunityId ?? null,
    scheduledAt,
    timing: input.timing,
    channel: input.channel,
    channelTarget: input.channelTarget ?? null,
    status: "pending",
    message: input.message,
    talkTrack: input.talkTrack ?? null,
    createdAt: context.timestamp,
    updatedAt: context.timestamp,
  });

  return {
    success: true,
    followUpId,
    scheduledAt: scheduledAt.toISOString(),
    message: `Follow-up scheduled for ${scheduledAt.toLocaleString()}`,
  };
}

// ============================================================
// Tool Definition
// ============================================================

/**
 * Schedule Follow-up Tool
 * 用於排程後續跟進提醒
 */
export const scheduleFollowUpTool: MCPTool<
  ScheduleFollowUpInput,
  ScheduleFollowUpOutput
> = {
  name: "schedule_follow_up",
  description:
    "排程跟進提醒。可選擇不同的跟進時機（2小時後、明天早上9點、3天後、1週後）和發送頻道（Slack DM 或頻道）。用於確保銷售代表在適當時間跟進客戶。",
  inputSchema: scheduleFollowUpInputSchema,
  handler: scheduleFollowUpHandler,
};

// ============================================================
// Factory Function
// ============================================================

/**
 * 建立 Schedule Follow-up Tool
 * @returns MCPTool 實例
 */
export function createScheduleFollowUpTool(): MCPTool<
  ScheduleFollowUpInput,
  ScheduleFollowUpOutput
> {
  return scheduleFollowUpTool;
}
