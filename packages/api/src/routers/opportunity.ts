/**
 * Opportunity API Router
 * CRUD operations for sales opportunities
 */

import { db } from "@Sales_ai_automation_v3/db";
import { opportunities } from "@Sales_ai_automation_v3/db/schema";
import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

// ============================================================
// Schemas
// ============================================================

const createOpportunitySchema = z.object({
  customerNumber: z.string().min(1), // Required: Salesforce UUID
  companyName: z.string().min(1),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  source: z.enum(["manual", "import", "api", "referral"]).default("manual"),
  status: z
    .enum([
      "new",
      "contacted",
      "qualified",
      "proposal",
      "negotiation",
      "won",
      "lost",
    ])
    .default("new"),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  notes: z.string().optional(),
});

const updateOpportunitySchema = z.object({
  opportunityId: z.string(),
  customerNumber: z.string().min(1).optional(),
  companyName: z.string().min(1).optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  source: z.enum(["manual", "import", "api", "referral"]).optional(),
  status: z
    .enum([
      "new",
      "contacted",
      "qualified",
      "proposal",
      "negotiation",
      "won",
      "lost",
    ])
    .optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  notes: z.string().optional(),
});

const deleteOpportunitySchema = z.object({
  opportunityId: z.string(),
});

const listOpportunitiesSchema = z.object({
  status: z
    .enum([
      "new",
      "contacted",
      "qualified",
      "proposal",
      "negotiation",
      "won",
      "lost",
    ])
    .optional(),
  source: z.enum(["manual", "import", "api", "referral"]).optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const getOpportunitySchema = z.object({
  opportunityId: z.string(),
});

const getOpportunityByCustomerNumberSchema = z.object({
  customerNumber: z.string(),
});

// ============================================================
// Create Opportunity
// ============================================================

export const createOpportunity = protectedProcedure
  .input(createOpportunitySchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const result = await db
      .insert(opportunities)
      .values({
        id: randomUUID(),
        userId,
        customerNumber: input.customerNumber,
        companyName: input.companyName,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        source: input.source,
        status: input.status,
        industry: input.industry,
        companySize: input.companySize,
        notes: input.notes,
      })
      .returning();

    const opportunity = result[0];
    if (!opportunity) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    return {
      id: opportunity.id,
      customerNumber: opportunity.customerNumber,
      companyName: opportunity.companyName,
      contactName: opportunity.contactName,
      contactEmail: opportunity.contactEmail,
      contactPhone: opportunity.contactPhone,
      source: opportunity.source,
      status: opportunity.status,
      industry: opportunity.industry,
      companySize: opportunity.companySize,
      notes: opportunity.notes,
      createdAt: opportunity.createdAt,
      updatedAt: opportunity.updatedAt,
    };
  });

// ============================================================
// Update Opportunity
// ============================================================

export const updateOpportunity = protectedProcedure
  .input(updateOpportunitySchema)
  .handler(async ({ input, context }) => {
    const { opportunityId, ...updates } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const existingOpportunity = await db.query.opportunities.findFirst({
      where: and(
        eq(opportunities.id, opportunityId),
        eq(opportunities.userId, userId)
      ),
    });

    if (!existingOpportunity) {
      throw new ORPCError("NOT_FOUND");
    }

    const updateResult = await db
      .update(opportunities)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(opportunities.id, opportunityId))
      .returning();

    const updatedOpportunity = updateResult[0];
    if (!updatedOpportunity) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    return {
      id: updatedOpportunity.id,
      customerNumber: updatedOpportunity.customerNumber,
      companyName: updatedOpportunity.companyName,
      contactName: updatedOpportunity.contactName,
      contactEmail: updatedOpportunity.contactEmail,
      contactPhone: updatedOpportunity.contactPhone,
      source: updatedOpportunity.source,
      status: updatedOpportunity.status,
      industry: updatedOpportunity.industry,
      companySize: updatedOpportunity.companySize,
      notes: updatedOpportunity.notes,
      createdAt: updatedOpportunity.createdAt,
      updatedAt: updatedOpportunity.updatedAt,
    };
  });

// ============================================================
// Delete Opportunity
// ============================================================

export const deleteOpportunity = protectedProcedure
  .input(deleteOpportunitySchema)
  .handler(async ({ input, context }) => {
    const { opportunityId } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const existingOpportunity = await db.query.opportunities.findFirst({
      where: and(
        eq(opportunities.id, opportunityId),
        eq(opportunities.userId, userId)
      ),
    });

    if (!existingOpportunity) {
      throw new ORPCError("NOT_FOUND");
    }

    await db.delete(opportunities).where(eq(opportunities.id, opportunityId));

    return {
      success: true,
      message: "Opportunity deleted successfully",
    };
  });

// ============================================================
// List Opportunities
// ============================================================

export const listOpportunities = protectedProcedure
  .input(listOpportunitiesSchema)
  .handler(async ({ input, context }) => {
    const { status, source, search, limit, offset } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const conditions = [eq(opportunities.userId, userId)];

    if (status) {
      conditions.push(eq(opportunities.status, status));
    }

    if (source) {
      conditions.push(eq(opportunities.source, source));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(opportunities.companyName, searchPattern),
          ilike(opportunities.contactName, searchPattern),
          ilike(opportunities.contactEmail, searchPattern),
          ilike(opportunities.customerNumber, searchPattern)
        )!
      );
    }

    const results = await db
      .select()
      .from(opportunities)
      .where(and(...conditions))
      .orderBy(desc(opportunities.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      opportunities: results.map((opportunity) => ({
        id: opportunity.id,
        customerNumber: opportunity.customerNumber,
        companyName: opportunity.companyName,
        contactName: opportunity.contactName,
        contactEmail: opportunity.contactEmail,
        contactPhone: opportunity.contactPhone,
        source: opportunity.source,
        status: opportunity.status,
        industry: opportunity.industry,
        companySize: opportunity.companySize,
        notes: opportunity.notes,
        opportunityScore: opportunity.opportunityScore,
        meddicScore: opportunity.meddicScore,
        createdAt: opportunity.createdAt,
        updatedAt: opportunity.updatedAt,
      })),
      total: results.length,
      limit,
      offset,
    };
  });

// ============================================================
// Get Opportunity Details
// ============================================================

export const getOpportunity = protectedProcedure
  .input(getOpportunitySchema)
  .handler(async ({ input, context }) => {
    const { opportunityId } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const opportunity = await db.query.opportunities.findFirst({
      where: and(
        eq(opportunities.id, opportunityId),
        eq(opportunities.userId, userId)
      ),
      with: {
        conversations: {
          orderBy: (conversations, { desc }) => [
            desc(conversations.conversationDate),
          ],
          limit: 10,
          with: {
            meddicAnalyses: {
              orderBy: (meddicAnalyses, { desc }) => [
                desc(meddicAnalyses.createdAt),
              ],
              limit: 1,
            },
          },
        },
      },
    });

    if (!opportunity) {
      throw new ORPCError("NOT_FOUND");
    }

    return {
      id: opportunity.id,
      customerNumber: opportunity.customerNumber,
      companyName: opportunity.companyName,
      contactName: opportunity.contactName,
      contactEmail: opportunity.contactEmail,
      contactPhone: opportunity.contactPhone,
      source: opportunity.source,
      status: opportunity.status,
      industry: opportunity.industry,
      companySize: opportunity.companySize,
      notes: opportunity.notes,
      opportunityScore: opportunity.opportunityScore,
      meddicScore: opportunity.meddicScore,
      createdAt: opportunity.createdAt,
      updatedAt: opportunity.updatedAt,
      lastContactedAt: opportunity.lastContactedAt,
      conversations: opportunity.conversations.map((conv) => ({
        id: conv.id,
        caseNumber: conv.caseNumber,
        title: conv.title,
        type: conv.type,
        status: conv.status,
        audioUrl: conv.audioUrl,
        duration: conv.duration,
        conversationDate: conv.conversationDate,
        createdAt: conv.createdAt,
        latestAnalysis: conv.meddicAnalyses[0] || null,
      })),
    };
  });

// ============================================================
// Get Opportunity by Customer Number
// ============================================================

export const getOpportunityByCustomerNumber = protectedProcedure
  .input(getOpportunityByCustomerNumberSchema)
  .handler(async ({ input, context }) => {
    const { customerNumber } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    const opportunity = await db.query.opportunities.findFirst({
      where: and(
        eq(opportunities.customerNumber, customerNumber),
        eq(opportunities.userId, userId)
      ),
      with: {
        conversations: {
          orderBy: (conversations, { desc }) => [
            desc(conversations.conversationDate),
          ],
          limit: 10,
        },
      },
    });

    if (!opportunity) {
      throw new ORPCError("NOT_FOUND");
    }

    return {
      id: opportunity.id,
      customerNumber: opportunity.customerNumber,
      companyName: opportunity.companyName,
      contactName: opportunity.contactName,
      status: opportunity.status,
      opportunityScore: opportunity.opportunityScore,
      meddicScore: opportunity.meddicScore,
      conversationCount: opportunity.conversations.length,
      createdAt: opportunity.createdAt,
      updatedAt: opportunity.updatedAt,
    };
  });

// ============================================================
// Router Export
// ============================================================

export const opportunityRouter = {
  create: createOpportunity,
  update: updateOpportunity,
  delete: deleteOpportunity,
  list: listOpportunities,
  get: getOpportunity,
  getByCustomerNumber: getOpportunityByCustomerNumber,
};
