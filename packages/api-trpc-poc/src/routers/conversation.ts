/**
 * tRPC Conversation Router (POC)
 * 對比 oRPC 實現的性能和類型安全
 */

import type {
  ConversationStatus,
  TranscriptSegment,
} from "@sales_ai_automation_v3/shared/types";
import { z } from "zod";
import { publicProcedure, router } from "../trpc.js";

// 輸入/輸出 Schema
const createConversationSchema = z.object({
  opportunityId: z.string(),
  type: z.enum([
    "discovery_call",
    "demo",
    "negotiation",
    "follow_up",
    "closing",
    "support",
    "other",
  ]),
  title: z.string().optional(),
});

const getConversationSchema = z.object({
  id: z.string(),
});

const listConversationsSchema = z.object({
  opportunityId: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().default(50),
  offset: z.number().default(0),
});

// Router
export const conversationRouter = router({
  create: publicProcedure
    .input(createConversationSchema)
    .mutation(async ({ input }) => {
      const timestamp = Date.now();
      const conversation = {
        id: `conv_${timestamp}`,
        opportunityId: input.opportunityId,
        type: input.type,
        title: input.title,
        status: "pending" as ConversationStatus,
        createdAt: new Date(),
      };

      return conversation;
    }),

  get: publicProcedure.input(getConversationSchema).query(async ({ input }) => {
    return {
      id: input.id,
      opportunityId: "opp_123",
      type: "discovery_call" as const,
      status: "completed" as ConversationStatus,
      transcript: {
        segments: [
          {
            speaker: "Sales Rep",
            text: "Hello, how can I help you today?",
            start: 0,
            end: 2,
          },
        ] as TranscriptSegment[],
        fullText: "Hello, how can I help you today?",
        language: "zh",
      },
      createdAt: new Date(),
    };
  }),

  list: publicProcedure
    .input(listConversationsSchema)
    .query(async ({ input }) => {
      const conversations = Array.from({ length: input.limit }, (_, i) => ({
        id: `conv_${i}`,
        opportunityId: input.opportunityId || "opp_123",
        type: "discovery_call" as const,
        status: "completed" as ConversationStatus,
        createdAt: new Date(),
      }));

      return {
        conversations,
        total: 100,
        hasMore: input.offset + input.limit < 100,
      };
    }),
});

export type ConversationRouter = typeof conversationRouter;
