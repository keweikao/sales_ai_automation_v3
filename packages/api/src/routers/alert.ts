/**
 * Alert API Router
 * Handles alert listing, acknowledgment, resolution, and dismissal
 */

import { db } from "@Sales_ai_automation_v3/db";
import { alerts, opportunities } from "@Sales_ai_automation_v3/db/schema";
import {
	acknowledgeAlert,
	dismissAlert,
	resolveAlert,
} from "@Sales_ai_automation_v3/services";
import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

// ============================================================
// Schemas
// ============================================================

const listAlertsSchema = z.object({
	status: z
		.enum(["pending", "acknowledged", "resolved", "dismissed"])
		.optional(),
	type: z.enum(["close_now", "missing_dm", "manager_escalation"]).optional(),
	opportunityId: z.string().optional(),
	limit: z.number().min(1).max(100).default(20),
	offset: z.number().min(0).default(0),
});

const getAlertSchema = z.object({
	alertId: z.string(),
});

const acknowledgeAlertSchema = z.object({
	alertId: z.string(),
});

const resolveAlertSchema = z.object({
	alertId: z.string(),
	resolution: z.string().min(1),
});

const dismissAlertSchema = z.object({
	alertId: z.string(),
});

// ============================================================
// List Alerts
// ============================================================

export const listAlerts = protectedProcedure
	.input(listAlertsSchema)
	.handler(async ({ input, context }) => {
		const userId = context.session?.user.id;

		if (!userId) {
			throw new ORPCError("UNAUTHORIZED");
		}

		const { status, type, opportunityId, limit, offset } = input;

		// 建立查詢條件
		const conditions = [];

		// 只顯示使用者有權限的商機的警示
		const userOpportunities = await db
			.select({ id: opportunities.id })
			.from(opportunities)
			.where(eq(opportunities.userId, userId));

		const opportunityIds = userOpportunities.map((o: { id: string }) => o.id);

		if (opportunityIds.length === 0) {
			return { alerts: [], total: 0 };
		}

		conditions.push(inArray(alerts.opportunityId, opportunityIds));

		if (status) {
			conditions.push(eq(alerts.status, status));
		}
		if (type) {
			conditions.push(eq(alerts.type, type));
		}
		if (opportunityId) {
			conditions.push(eq(alerts.opportunityId, opportunityId));
		}

		// 查詢警示
		const alertList = await db
			.select()
			.from(alerts)
			.where(and(...conditions))
			.orderBy(desc(alerts.createdAt))
			.limit(limit)
			.offset(offset);

		// 查詢總數
		const totalResult = await db
			.select({ count: count() })
			.from(alerts)
			.where(and(...conditions));

		const total = totalResult[0]?.count ?? 0;

		return {
			alerts: alertList,
			total,
		};
	});

// ============================================================
// Get Alert by ID
// ============================================================

export const getAlert = protectedProcedure
	.input(getAlertSchema)
	.handler(async ({ input, context }) => {
		const userId = context.session?.user.id;
		const { alertId } = input;

		if (!userId) {
			throw new ORPCError("UNAUTHORIZED");
		}

		const alert = await db.query.alerts.findFirst({
			where: eq(alerts.id, alertId),
			with: {
				opportunity: true,
				conversation: true,
			},
		});

		if (!alert) {
			throw new ORPCError("NOT_FOUND");
		}

		// 驗證權限
		if (alert.opportunity?.userId !== userId) {
			throw new ORPCError("FORBIDDEN");
		}

		return alert;
	});

// ============================================================
// Acknowledge Alert
// ============================================================

export const acknowledgeAlertHandler = protectedProcedure
	.input(acknowledgeAlertSchema)
	.handler(async ({ input, context }) => {
		const userId = context.session?.user.id;
		const { alertId } = input;

		if (!userId) {
			throw new ORPCError("UNAUTHORIZED");
		}

		// 驗證警示存在且有權限
		const alert = await db.query.alerts.findFirst({
			where: eq(alerts.id, alertId),
			with: { opportunity: true },
		});

		if (!alert) {
			throw new ORPCError("NOT_FOUND");
		}

		if (alert.opportunity?.userId !== userId) {
			throw new ORPCError("FORBIDDEN");
		}

		await acknowledgeAlert(alertId, userId);

		return { success: true };
	});

// ============================================================
// Resolve Alert
// ============================================================

export const resolveAlertHandler = protectedProcedure
	.input(resolveAlertSchema)
	.handler(async ({ input, context }) => {
		const userId = context.session?.user.id;
		const { alertId, resolution } = input;

		if (!userId) {
			throw new ORPCError("UNAUTHORIZED");
		}

		// 驗證警示存在且有權限
		const alert = await db.query.alerts.findFirst({
			where: eq(alerts.id, alertId),
			with: { opportunity: true },
		});

		if (!alert) {
			throw new ORPCError("NOT_FOUND");
		}

		if (alert.opportunity?.userId !== userId) {
			throw new ORPCError("FORBIDDEN");
		}

		await resolveAlert(alertId, userId, resolution);

		return { success: true };
	});

// ============================================================
// Dismiss Alert
// ============================================================

export const dismissAlertHandler = protectedProcedure
	.input(dismissAlertSchema)
	.handler(async ({ input, context }) => {
		const userId = context.session?.user.id;
		const { alertId } = input;

		if (!userId) {
			throw new ORPCError("UNAUTHORIZED");
		}

		// 驗證警示存在且有權限
		const alert = await db.query.alerts.findFirst({
			where: eq(alerts.id, alertId),
			with: { opportunity: true },
		});

		if (!alert) {
			throw new ORPCError("NOT_FOUND");
		}

		if (alert.opportunity?.userId !== userId) {
			throw new ORPCError("FORBIDDEN");
		}

		await dismissAlert(alertId);

		return { success: true };
	});

// ============================================================
// Get Alert Stats
// ============================================================

export const getAlertStats = protectedProcedure.handler(async ({ context }) => {
	const userId = context.session?.user.id;

	if (!userId) {
		throw new ORPCError("UNAUTHORIZED");
	}

	// 取得使用者的商機
	const userOpportunities = await db
		.select({ id: opportunities.id })
		.from(opportunities)
		.where(eq(opportunities.userId, userId));

	const opportunityIds = userOpportunities.map((o: { id: string }) => o.id);

	if (opportunityIds.length === 0) {
		return {
			pending: 0,
			acknowledged: 0,
			resolved: 0,
			byType: { close_now: 0, missing_dm: 0, manager_escalation: 0 },
		};
	}

	// 按狀態統計
	const pendingCount = await db
		.select({ count: count() })
		.from(alerts)
		.where(
			and(
				inArray(alerts.opportunityId, opportunityIds),
				eq(alerts.status, "pending"),
			),
		);

	const acknowledgedCount = await db
		.select({ count: count() })
		.from(alerts)
		.where(
			and(
				inArray(alerts.opportunityId, opportunityIds),
				eq(alerts.status, "acknowledged"),
			),
		);

	const resolvedCount = await db
		.select({ count: count() })
		.from(alerts)
		.where(
			and(
				inArray(alerts.opportunityId, opportunityIds),
				eq(alerts.status, "resolved"),
			),
		);

	// 按類型統計（僅 pending）
	const closeNowCount = await db
		.select({ count: count() })
		.from(alerts)
		.where(
			and(
				inArray(alerts.opportunityId, opportunityIds),
				eq(alerts.status, "pending"),
				eq(alerts.type, "close_now"),
			),
		);

	const missingDmCount = await db
		.select({ count: count() })
		.from(alerts)
		.where(
			and(
				inArray(alerts.opportunityId, opportunityIds),
				eq(alerts.status, "pending"),
				eq(alerts.type, "missing_dm"),
			),
		);

	const managerCount = await db
		.select({ count: count() })
		.from(alerts)
		.where(
			and(
				inArray(alerts.opportunityId, opportunityIds),
				eq(alerts.status, "pending"),
				eq(alerts.type, "manager_escalation"),
			),
		);

	return {
		pending: pendingCount[0]?.count ?? 0,
		acknowledged: acknowledgedCount[0]?.count ?? 0,
		resolved: resolvedCount[0]?.count ?? 0,
		byType: {
			close_now: closeNowCount[0]?.count ?? 0,
			missing_dm: missingDmCount[0]?.count ?? 0,
			manager_escalation: managerCount[0]?.count ?? 0,
		},
	};
});

// ============================================================
// Router Export
// ============================================================

export const alertRouter = {
	list: listAlerts,
	get: getAlert,
	acknowledge: acknowledgeAlertHandler,
	resolve: resolveAlertHandler,
	dismiss: dismissAlertHandler,
	stats: getAlertStats,
};
