/**
 * Talk Track API Router
 * 話術知識庫查詢與管理 API
 */

import { db } from "@Sales_ai_automation_v3/db";
import {
  CUSTOMER_TYPES,
  STORE_TYPES,
  TALK_TRACK_SITUATIONS,
  talkTracks,
} from "@Sales_ai_automation_v3/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure } from "../index";

// ============================================================
// Schemas
// ============================================================

const getBySituationSchema = z.object({
  situation: z.enum(TALK_TRACK_SITUATIONS),
  customerType: z.enum(CUSTOMER_TYPES).optional(),
  storeType: z.enum(STORE_TYPES).optional(),
});

const searchSchema = z.object({
  keyword: z.string().min(1),
  limit: z.number().min(1).max(20).default(5),
});

const listSchema = z.object({
  includeInactive: z.boolean().default(false),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

const createSchema = z.object({
  situation: z.enum(TALK_TRACK_SITUATIONS),
  customerType: z.enum(CUSTOMER_TYPES).optional(),
  storeType: z.enum(STORE_TYPES).optional(),
  talkTrack: z.string().min(10),
  context: z.string().optional(),
  expectedOutcome: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sourceType: z
    .enum(["expert", "extracted", "user_submitted"])
    .default("expert"),
});

const updateSchema = z.object({
  id: z.string(),
  talkTrack: z.string().min(10).optional(),
  context: z.string().optional(),
  expectedOutcome: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const recordUsageSchema = z.object({
  talkTrackId: z.string(),
});

// ============================================================
// Get Talk Tracks by Situation
// ============================================================

export const getBySituation = publicProcedure
  .input(getBySituationSchema)
  .handler(async ({ input }) => {
    const { situation, customerType, storeType } = input;

    const conditions = [
      eq(talkTracks.situation, situation),
      eq(talkTracks.isActive, true),
    ];

    if (customerType) {
      conditions.push(eq(talkTracks.customerType, customerType));
    }

    if (storeType) {
      conditions.push(eq(talkTracks.storeType, storeType));
    }

    const results = await db
      .select()
      .from(talkTracks)
      .where(and(...conditions))
      .orderBy(desc(talkTracks.successRate), desc(talkTracks.usageCount));

    return results;
  });

// ============================================================
// Search Talk Tracks
// ============================================================

export const search = publicProcedure
  .input(searchSchema)
  .handler(async ({ input }) => {
    const { keyword, limit } = input;
    const searchPattern = `%${keyword}%`;

    const results = await db
      .select()
      .from(talkTracks)
      .where(
        and(
          eq(talkTracks.isActive, true),
          or(
            ilike(talkTracks.talkTrack, searchPattern),
            ilike(talkTracks.context, searchPattern),
            ilike(talkTracks.situation, searchPattern),
            sql`${talkTracks.tags}::text ILIKE ${searchPattern}`
          )
        )
      )
      .orderBy(desc(talkTracks.successRate))
      .limit(limit);

    return results;
  });

// ============================================================
// List All Talk Tracks (Admin)
// ============================================================

export const list = protectedProcedure
  .input(listSchema)
  .handler(async ({ input }) => {
    const { includeInactive, limit, offset } = input;

    const conditions = [];
    if (!includeInactive) {
      conditions.push(eq(talkTracks.isActive, true));
    }

    const results = await db
      .select()
      .from(talkTracks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(talkTracks.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  });

// ============================================================
// Create Talk Track (Admin)
// ============================================================

export const create = protectedProcedure
  .input(createSchema)
  .handler(async ({ input }) => {
    const id = `tt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const [result] = await db
      .insert(talkTracks)
      .values({
        id,
        situation: input.situation,
        customerType: input.customerType ?? null,
        storeType: input.storeType ?? null,
        talkTrack: input.talkTrack,
        context: input.context ?? null,
        expectedOutcome: input.expectedOutcome ?? null,
        tags: input.tags ?? null,
        sourceType: input.sourceType,
        successRate: null,
        usageCount: 0,
        version: 1,
        isActive: true,
      })
      .returning();

    return result;
  });

// ============================================================
// Update Talk Track (Admin)
// ============================================================

export const update = protectedProcedure
  .input(updateSchema)
  .handler(async ({ input }) => {
    const { id, ...updates } = input;

    // 檢查話術是否存在
    const existing = await db.query.talkTracks.findFirst({
      where: eq(talkTracks.id, id),
    });

    if (!existing) {
      throw new ORPCError("NOT_FOUND", { message: "話術不存在" });
    }

    // 準備更新資料
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      version: (existing.version ?? 1) + 1,
    };

    if (updates.talkTrack !== undefined) {
      updateData.talkTrack = updates.talkTrack;
    }
    if (updates.context !== undefined) {
      updateData.context = updates.context;
    }
    if (updates.expectedOutcome !== undefined) {
      updateData.expectedOutcome = updates.expectedOutcome;
    }
    if (updates.tags !== undefined) {
      updateData.tags = updates.tags;
    }
    if (updates.isActive !== undefined) {
      updateData.isActive = updates.isActive;
    }

    const [result] = await db
      .update(talkTracks)
      .set(updateData)
      .where(eq(talkTracks.id, id))
      .returning();

    return result;
  });

// ============================================================
// Record Usage (for tracking)
// ============================================================

export const recordUsage = publicProcedure
  .input(recordUsageSchema)
  .handler(async ({ input }) => {
    const { talkTrackId } = input;

    const [result] = await db
      .update(talkTracks)
      .set({
        usageCount: sql`COALESCE(${talkTracks.usageCount}, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(eq(talkTracks.id, talkTrackId))
      .returning();

    if (!result) {
      throw new ORPCError("NOT_FOUND", { message: "話術不存在" });
    }

    return { success: true, usageCount: result.usageCount };
  });

// ============================================================
// Get Situations Summary
// ============================================================

export const getSituations = publicProcedure.handler(async () => {
  const results = await db
    .select({
      situation: talkTracks.situation,
      count: sql<number>`count(*)::int`,
    })
    .from(talkTracks)
    .where(eq(talkTracks.isActive, true))
    .groupBy(talkTracks.situation);

  return results;
});

// ============================================================
// Router Export
// ============================================================

export const talkTrackRouter = {
  getBySituation,
  search,
  list,
  create,
  update,
  recordUsage,
  getSituations,
};
