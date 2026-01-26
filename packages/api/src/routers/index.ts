import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
// TODO: Sales Coach Agent 開發中，暫時停用
// import { agentRouter } from "./agent";
import { alertRouter } from "./alert";
import { analyticsRouter } from "./analytics";
import { conversationRouter } from "./conversation";
import { leadSourceRouter } from "./lead-source";
import { opportunityRouter } from "./opportunity";
import { salesTodoRouter } from "./sales-todo";
import { shareRouter } from "./share";
import { smsRouter } from "./sms";
import { teamRouter } from "./team";
// TODO: Talk Tracks 開發中，暫時停用
// import { talkTrackRouter } from "./talk-track";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),

  // Opportunity management (Salesforce integration)
  opportunities: opportunityRouter,

  // Conversation & transcription
  conversations: conversationRouter,

  // Analytics & MEDDIC insights
  analytics: analyticsRouter,

  // Alert management
  alert: alertRouter,

  // Lead source & UTM tracking
  leadSources: leadSourceRouter,

  // Public share links (不需登入)
  share: shareRouter,

  // SMS notifications
  sms: smsRouter,

  // Team management (Admin only)
  team: teamRouter,

  // Sales Todo management
  salesTodo: salesTodoRouter,

  // TODO: Sales Coach Agent 開發中，暫時停用
  // agent: agentRouter,

  // TODO: Talk Tracks Knowledge Base 開發中，暫時停用
  // talkTracks: talkTrackRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
