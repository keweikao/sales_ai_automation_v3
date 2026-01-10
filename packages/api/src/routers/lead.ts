/**
 * Lead API Router
 * CRUD operations for sales leads
 */

import { db } from "@Sales_ai_automation_v3/db/client";
import { leads } from "@Sales_ai_automation_v3/db/schema";
import { ORPCError } from "@orpc/server";
import { oz } from "@orpc/zod";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

// ============================================================
// Schemas
// ============================================================

const createLeadSchema = oz.input(
  z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    position: z.string().optional(),
    source: z.enum(["website", "referral", "cold_call", "event", "other"]),
    status: z
      .enum(["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"])
      .default("new"),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
  })
);

const updateLeadSchema = oz.input(
  z.object({
    leadId: z.string(),
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    position: z.string().optional(),
    source: z.enum(["website", "referral", "cold_call", "event", "other"]).optional(),
    status: z
      .enum(["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"])
      .optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
  })
);

const deleteLeadSchema = oz.input(
  z.object({
    leadId: z.string(),
  })
);

const listLeadsSchema = oz.input(
  z.object({
    status: z
      .enum(["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"])
      .optional(),
    source: z.enum(["website", "referral", "cold_call", "event", "other"]).optional(),
    search: z.string().optional(), // Search by name, email, company
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
  })
);

const getLeadSchema = oz.input(
  z.object({
    leadId: z.string(),
  })
);

// ============================================================
// Create Lead
// ============================================================

/**
 * POST /leads
 * Create a new lead
 */
export const createLead = protectedProcedure
  .input(createLeadSchema)
  .handler(async ({ input, context }) => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", "User not authenticated");
    }

    const [lead] = await db
      .insert(leads)
      .values({
        userId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        company: input.company,
        position: input.position,
        source: input.source,
        status: input.status,
        tags: input.tags || [],
        notes: input.notes,
      })
      .returning();

    return {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      position: lead.position,
      source: lead.source,
      status: lead.status,
      tags: lead.tags,
      notes: lead.notes,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  });

// ============================================================
// Update Lead
// ============================================================

/**
 * PATCH /leads/:id
 * Update an existing lead
 */
export const updateLead = protectedProcedure
  .input(updateLeadSchema)
  .handler(async ({ input, context }) => {
    const { leadId, ...updates } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", "User not authenticated");
    }

    // Verify lead exists and belongs to user
    const existingLead = await db.query.leads.findFirst({
      where: and(eq(leads.id, leadId), eq(leads.userId, userId)),
    });

    if (!existingLead) {
      throw new ORPCError("NOT_FOUND", "Lead not found");
    }

    // Update lead
    const [updatedLead] = await db
      .update(leads)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId))
      .returning();

    return {
      id: updatedLead.id,
      name: updatedLead.name,
      email: updatedLead.email,
      phone: updatedLead.phone,
      company: updatedLead.company,
      position: updatedLead.position,
      source: updatedLead.source,
      status: updatedLead.status,
      tags: updatedLead.tags,
      notes: updatedLead.notes,
      createdAt: updatedLead.createdAt,
      updatedAt: updatedLead.updatedAt,
    };
  });

// ============================================================
// Delete Lead
// ============================================================

/**
 * DELETE /leads/:id
 * Delete a lead (soft delete - mark as deleted)
 */
export const deleteLead = protectedProcedure
  .input(deleteLeadSchema)
  .handler(async ({ input, context }) => {
    const { leadId } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", "User not authenticated");
    }

    // Verify lead exists and belongs to user
    const existingLead = await db.query.leads.findFirst({
      where: and(eq(leads.id, leadId), eq(leads.userId, userId)),
    });

    if (!existingLead) {
      throw new ORPCError("NOT_FOUND", "Lead not found");
    }

    // Hard delete for now (can be changed to soft delete later)
    await db.delete(leads).where(eq(leads.id, leadId));

    return {
      success: true,
      message: "Lead deleted successfully",
    };
  });

// ============================================================
// List Leads
// ============================================================

/**
 * GET /leads
 * List all leads with optional filters
 */
export const listLeads = protectedProcedure
  .input(listLeadsSchema)
  .handler(async ({ input, context }) => {
    const { status, source, search, limit, offset } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", "User not authenticated");
    }

    // Build query conditions
    const conditions = [eq(leads.userId, userId)];

    if (status) {
      conditions.push(eq(leads.status, status));
    }

    if (source) {
      conditions.push(eq(leads.source, source));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(leads.name, searchPattern),
          ilike(leads.email, searchPattern),
          ilike(leads.company, searchPattern)
        )!
      );
    }

    const results = await db
      .select()
      .from(leads)
      .where(and(...conditions))
      .orderBy(desc(leads.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      leads: results.map((lead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        position: lead.position,
        source: lead.source,
        status: lead.status,
        tags: lead.tags,
        notes: lead.notes,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      })),
      total: results.length,
      limit,
      offset,
    };
  });

// ============================================================
// Get Lead Details
// ============================================================

/**
 * GET /leads/:id
 * Get detailed lead information with conversations and analyses
 */
export const getLead = protectedProcedure
  .input(getLeadSchema)
  .handler(async ({ input, context }) => {
    const { leadId } = input;
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", "User not authenticated");
    }

    const lead = await db.query.leads.findFirst({
      where: and(eq(leads.id, leadId), eq(leads.userId, userId)),
      with: {
        conversations: {
          orderBy: (conversations, { desc }) => [desc(conversations.recordedAt)],
          limit: 10,
          with: {
            meddicAnalyses: {
              orderBy: (meddicAnalyses, { desc }) => [desc(meddicAnalyses.createdAt)],
              limit: 1,
            },
          },
        },
      },
    });

    if (!lead) {
      throw new ORPCError("NOT_FOUND", "Lead not found");
    }

    return {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      position: lead.position,
      source: lead.source,
      status: lead.status,
      tags: lead.tags,
      notes: lead.notes,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      conversations: lead.conversations.map((conv) => ({
        id: conv.id,
        audioUrl: conv.audioUrl,
        status: conv.status,
        duration: conv.duration,
        recordedAt: conv.recordedAt,
        createdAt: conv.createdAt,
        latestAnalysis: conv.meddicAnalyses[0] || null,
      })),
    };
  });

// ============================================================
// Router Export
// ============================================================

export const leadRouter = {
  create: createLead,
  update: updateLead,
  delete: deleteLead,
  list: listLeads,
  get: getLead,
};
