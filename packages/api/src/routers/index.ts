import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { alertRouter } from "./alert";
import { analyticsRouter } from "./analytics";
import { conversationRouter } from "./conversation";
import { leadSourceRouter } from "./lead-source";
import { opportunityRouter } from "./opportunity";

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
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
