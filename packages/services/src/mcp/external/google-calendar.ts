/**
 * Google Calendar MCP Tools
 * 用於自動排程後續跟進、建立會議、管理行事曆
 *
 * 注意: 需要 Google OAuth 2.0 憑證
 * 環境變數:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_REFRESH_TOKEN
 */

import { z } from "zod";
import type { MCPTool } from "../types.js";

// ============================================================
// Google Calendar API Client Setup
// ============================================================

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    responseStatus?: string;
  }>;
  htmlLink: string;
}

/**
 * 初始化 Google Calendar API 客戶端
 */
async function initCalendarClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!(clientId && clientSecret && refreshToken)) {
    throw new Error(
      "Missing Google OAuth credentials. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN environment variables."
    );
  }

  // 取得 Access Token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const { access_token } = (await tokenResponse.json()) as {
    access_token: string;
  };

  return {
    accessToken: access_token,
    baseUrl: "https://www.googleapis.com/calendar/v3",
  };
}

// ============================================================
// Schedule Follow-Up Tool (Enhanced)
// ============================================================

const ScheduleFollowUpInputSchema = z.object({
  opportunityId: z.string().min(1, "Opportunity ID is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  scheduledFor: z.string(), // ISO 8601 date-time or relative time like "next_week"
  durationMinutes: z.number().min(15).max(480).optional().default(30),
  attendeeEmails: z.array(z.string().email()).optional(),
  location: z.string().optional(),
  talkTrack: z.string().optional(),
});

const ScheduleFollowUpOutputSchema = z.object({
  eventId: z.string(),
  opportunityId: z.string(),
  title: z.string(),
  scheduledAt: z.string(),
  htmlLink: z.string(),
  attendees: z.array(z.string()).optional(),
  timestamp: z.date(),
});

type ScheduleFollowUpInput = z.infer<typeof ScheduleFollowUpInputSchema>;
type ScheduleFollowUpOutput = z.infer<typeof ScheduleFollowUpOutputSchema>;

export const calendarScheduleFollowUpTool: MCPTool<
  ScheduleFollowUpInput,
  ScheduleFollowUpOutput
> = {
  name: "calendar_schedule_follow_up",
  description:
    "排程後續跟進會議。基於商機 ID 自動建立 Calendar 事件,支援相對時間(next_week, tomorrow)和絕對時間。",
  inputSchema: ScheduleFollowUpInputSchema,
  handler: async (
    input: ScheduleFollowUpInput
  ): Promise<ScheduleFollowUpOutput> => {
    try {
      const calendar = await initCalendarClient();

      // 解析時間
      let startTime: Date;

      if (input.scheduledFor === "tomorrow") {
        startTime = new Date();
        startTime.setDate(startTime.getDate() + 1);
        startTime.setHours(10, 0, 0, 0); // 明天上午 10:00
      } else if (input.scheduledFor === "next_week") {
        startTime = new Date();
        startTime.setDate(startTime.getDate() + 7);
        startTime.setHours(10, 0, 0, 0); // 下週上午 10:00
      } else {
        startTime = new Date(input.scheduledFor);
      }

      const endTime = new Date(
        startTime.getTime() + input.durationMinutes * 60 * 1000
      );

      // 建立事件描述
      let description = input.description || "";
      if (input.talkTrack) {
        description += `\n\n## 話術建議\n${input.talkTrack}`;
      }
      description += `\n\n商機 ID: ${input.opportunityId}`;

      // 建立 Calendar 事件
      const event = {
        summary: input.title,
        description,
        location: input.location,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: "Asia/Taipei",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "Asia/Taipei",
        },
        attendees: input.attendeeEmails?.map((email) => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // 1 天前提醒
            { method: "popup", minutes: 30 }, // 30 分鐘前提醒
          ],
        },
      };

      const response = await fetch(
        `${calendar.baseUrl}/calendars/primary/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${calendar.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create event: ${error}`);
      }

      const createdEvent = (await response.json()) as CalendarEvent;

      return {
        eventId: createdEvent.id,
        opportunityId: input.opportunityId,
        title: createdEvent.summary,
        scheduledAt: createdEvent.start.dateTime || createdEvent.start.date!,
        htmlLink: createdEvent.htmlLink,
        attendees: input.attendeeEmails,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Calendar schedule follow-up failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// Create Event Tool
// ============================================================

const CreateEventInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startTime: z.string(), // ISO 8601
  endTime: z.string(), // ISO 8601
  attendeeEmails: z.array(z.string().email()).optional(),
  location: z.string().optional(),
  sendNotifications: z.boolean().optional().default(true),
});

const CreateEventOutputSchema = z.object({
  eventId: z.string(),
  title: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  htmlLink: z.string(),
  attendees: z.array(z.string()).optional(),
  timestamp: z.date(),
});

type CreateEventInput = z.infer<typeof CreateEventInputSchema>;
type CreateEventOutput = z.infer<typeof CreateEventOutputSchema>;

export const calendarCreateEventTool: MCPTool<
  CreateEventInput,
  CreateEventOutput
> = {
  name: "calendar_create_event",
  description:
    "建立 Google Calendar 事件。可指定參與者、地點、時間等資訊。支援發送邀請通知。",
  inputSchema: CreateEventInputSchema,
  handler: async (input: CreateEventInput): Promise<CreateEventOutput> => {
    try {
      const calendar = await initCalendarClient();

      const event = {
        summary: input.title,
        description: input.description,
        location: input.location,
        start: {
          dateTime: input.startTime,
          timeZone: "Asia/Taipei",
        },
        end: {
          dateTime: input.endTime,
          timeZone: "Asia/Taipei",
        },
        attendees: input.attendeeEmails?.map((email) => ({ email })),
      };

      const params = new URLSearchParams({
        sendUpdates: input.sendNotifications ? "all" : "none",
      });

      const response = await fetch(
        `${calendar.baseUrl}/calendars/primary/events?${params}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${calendar.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create event: ${error}`);
      }

      const createdEvent = (await response.json()) as CalendarEvent;

      return {
        eventId: createdEvent.id,
        title: createdEvent.summary,
        startTime: createdEvent.start.dateTime || createdEvent.start.date!,
        endTime: createdEvent.end.dateTime || createdEvent.end.date!,
        htmlLink: createdEvent.htmlLink,
        attendees: input.attendeeEmails,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Calendar event creation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// List Events Tool
// ============================================================

const ListEventsInputSchema = z.object({
  timeMin: z.string().optional(), // ISO 8601
  timeMax: z.string().optional(), // ISO 8601
  maxResults: z.number().min(1).max(100).optional().default(10),
  orderBy: z.enum(["startTime", "updated"]).optional().default("startTime"),
  singleEvents: z.boolean().optional().default(true),
});

const ListEventsOutputSchema = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      startTime: z.string(),
      endTime: z.string(),
      location: z.string().optional(),
      htmlLink: z.string(),
      attendees: z
        .array(
          z.object({
            email: z.string(),
            responseStatus: z.string().optional(),
          })
        )
        .optional(),
    })
  ),
  count: z.number(),
  timestamp: z.date(),
});

type ListEventsInput = z.infer<typeof ListEventsInputSchema>;
type ListEventsOutput = z.infer<typeof ListEventsOutputSchema>;

export const calendarListEventsTool: MCPTool<
  ListEventsInput,
  ListEventsOutput
> = {
  name: "calendar_list_events",
  description:
    "列出 Google Calendar 中的事件。可指定時間範圍、最大結果數等篩選條件。用於查看業務行程。",
  inputSchema: ListEventsInputSchema,
  handler: async (input: ListEventsInput): Promise<ListEventsOutput> => {
    try {
      const calendar = await initCalendarClient();

      const params = new URLSearchParams({
        maxResults: input.maxResults.toString(),
        orderBy: input.orderBy,
        singleEvents: input.singleEvents.toString(),
      });

      if (input.timeMin) {
        params.append("timeMin", input.timeMin);
      } else {
        // 預設從現在開始
        params.append("timeMin", new Date().toISOString());
      }

      if (input.timeMax) {
        params.append("timeMax", input.timeMax);
      }

      const response = await fetch(
        `${calendar.baseUrl}/calendars/primary/events?${params}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${calendar.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to list events: ${error}`);
      }

      const data = (await response.json()) as { items: CalendarEvent[] };

      return {
        events: data.items.map((event) => ({
          id: event.id,
          title: event.summary,
          description: event.description,
          startTime: event.start.dateTime || event.start.date!,
          endTime: event.end.dateTime || event.end.date!,
          location: event.location,
          htmlLink: event.htmlLink,
          attendees: event.attendees,
        })),
        count: data.items.length,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Calendar list events failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// Update Event Tool
// ============================================================

const UpdateEventInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  title: z.string().optional(),
  description: z.string().optional(),
  startTime: z.string().optional(), // ISO 8601
  endTime: z.string().optional(), // ISO 8601
  attendeeEmails: z.array(z.string().email()).optional(),
  location: z.string().optional(),
  sendNotifications: z.boolean().optional().default(true),
});

const UpdateEventOutputSchema = z.object({
  eventId: z.string(),
  title: z.string(),
  updated: z.boolean(),
  htmlLink: z.string(),
  timestamp: z.date(),
});

type UpdateEventInput = z.infer<typeof UpdateEventInputSchema>;
type UpdateEventOutput = z.infer<typeof UpdateEventOutputSchema>;

export const calendarUpdateEventTool: MCPTool<
  UpdateEventInput,
  UpdateEventOutput
> = {
  name: "calendar_update_event",
  description:
    "更新 Google Calendar 事件。可修改標題、時間、參與者等資訊。支援發送更新通知。",
  inputSchema: UpdateEventInputSchema,
  handler: async (input: UpdateEventInput): Promise<UpdateEventOutput> => {
    try {
      const calendar = await initCalendarClient();

      // 先取得現有事件
      const getResponse = await fetch(
        `${calendar.baseUrl}/calendars/primary/events/${input.eventId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${calendar.accessToken}`,
          },
        }
      );

      if (!getResponse.ok) {
        const error = await getResponse.text();
        throw new Error(`Failed to get event: ${error}`);
      }

      const existingEvent = (await getResponse.json()) as CalendarEvent;

      // 更新欄位
      const updatedEvent = {
        ...existingEvent,
        summary: input.title || existingEvent.summary,
        description: input.description || existingEvent.description,
        location: input.location || existingEvent.location,
      };

      if (input.startTime) {
        updatedEvent.start = {
          dateTime: input.startTime,
          timeZone: "Asia/Taipei",
        };
      }

      if (input.endTime) {
        updatedEvent.end = {
          dateTime: input.endTime,
          timeZone: "Asia/Taipei",
        };
      }

      if (input.attendeeEmails) {
        updatedEvent.attendees = input.attendeeEmails.map((email) => ({
          email,
        }));
      }

      const params = new URLSearchParams({
        sendUpdates: input.sendNotifications ? "all" : "none",
      });

      const updateResponse = await fetch(
        `${calendar.baseUrl}/calendars/primary/events/${input.eventId}?${params}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${calendar.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedEvent),
        }
      );

      if (!updateResponse.ok) {
        const error = await updateResponse.text();
        throw new Error(`Failed to update event: ${error}`);
      }

      const updated = (await updateResponse.json()) as CalendarEvent;

      return {
        eventId: updated.id,
        title: updated.summary,
        updated: true,
        htmlLink: updated.htmlLink,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Calendar update event failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// Delete Event Tool
// ============================================================

const DeleteEventInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  sendNotifications: z.boolean().optional().default(true),
});

const DeleteEventOutputSchema = z.object({
  eventId: z.string(),
  deleted: z.boolean(),
  timestamp: z.date(),
});

type DeleteEventInput = z.infer<typeof DeleteEventInputSchema>;
type DeleteEventOutput = z.infer<typeof DeleteEventOutputSchema>;

export const calendarDeleteEventTool: MCPTool<
  DeleteEventInput,
  DeleteEventOutput
> = {
  name: "calendar_delete_event",
  description: "刪除 Google Calendar 事件。可選擇是否發送取消通知給參與者。",
  inputSchema: DeleteEventInputSchema,
  handler: async (input: DeleteEventInput): Promise<DeleteEventOutput> => {
    try {
      const calendar = await initCalendarClient();

      const params = new URLSearchParams({
        sendUpdates: input.sendNotifications ? "all" : "none",
      });

      const response = await fetch(
        `${calendar.baseUrl}/calendars/primary/events/${input.eventId}?${params}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${calendar.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete event: ${error}`);
      }

      return {
        eventId: input.eventId,
        deleted: true,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Calendar delete event failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};
