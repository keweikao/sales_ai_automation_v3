import { db } from "@sales_ai_automation_v3/db";
import {
	alerts,
	conversations,
	meddicAnalyses,
	opportunities,
} from "@sales_ai_automation_v3/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { ALERT_RULES } from "./rules";
import type { AlertResult, EvaluationContext } from "./types";

/**
 * 評估並建立警示
 */
export async function evaluateAndCreateAlerts(
	opportunityId: string,
	conversationId: string,
	userId?: string,
): Promise<AlertResult[]> {
	// 取得評估所需的資料
	const context = await buildEvaluationContext(
		opportunityId,
		conversationId,
		userId,
	);

	if (!context) {
		console.log("Cannot build evaluation context for", opportunityId);
		return [];
	}

	const triggeredAlerts: AlertResult[] = [];

	// 評估所有規則
	for (const rule of ALERT_RULES) {
		const result = rule.evaluate(context);

		if (result) {
			// 檢查是否已有相同類型的未處理警示
			const existingAlert = await db.query.alerts.findFirst({
				where: and(
					eq(alerts.opportunityId, opportunityId),
					eq(alerts.type, result.type),
					eq(alerts.status, "pending"),
				),
			});

			if (!existingAlert) {
				// 建立新警示
				const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

				await db.insert(alerts).values({
					id: alertId,
					opportunityId,
					conversationId,
					userId,
					type: result.type,
					severity: result.severity,
					status: "pending",
					title: result.title,
					message: result.message,
					context: result.context,
				});

				triggeredAlerts.push(result);
				console.log(
					`Alert created: ${result.type} for opportunity ${opportunityId}`,
				);
			}
		}
	}

	return triggeredAlerts;
}

/**
 * 建立評估上下文
 */
async function buildEvaluationContext(
	opportunityId: string,
	conversationId: string,
	userId?: string,
): Promise<EvaluationContext | null> {
	// 取得商機資訊
	const opportunity = await db.query.opportunities.findFirst({
		where: eq(opportunities.id, opportunityId),
	});

	if (!opportunity) {
		return null;
	}

	// 取得最新的 MEDDIC 分析
	const latestAnalysis = await db.query.meddicAnalyses.findFirst({
		where: eq(meddicAnalyses.conversationId, conversationId),
		orderBy: desc(meddicAnalyses.createdAt),
	});

	if (!latestAnalysis) {
		return null;
	}

	// 取得對話數量
	const conversationList = await db.query.conversations.findMany({
		where: eq(conversations.opportunityId, opportunityId),
	});
	const conversationCount = conversationList.length;

	// 取得最近的分析分數
	const recentAnalyses = await db
		.select({ overallScore: meddicAnalyses.overallScore })
		.from(meddicAnalyses)
		.where(eq(meddicAnalyses.opportunityId, opportunityId))
		.orderBy(desc(meddicAnalyses.createdAt))
		.limit(5);

	const recentScores = recentAnalyses
		.map((a) => a.overallScore)
		.filter((s): s is number => s !== null);

	return {
		opportunityId,
		opportunityName: opportunity.companyName,
		conversationId,
		userId,
		meddicAnalysis: {
			overallScore: latestAnalysis.overallScore ?? 0,
			metricsScore: latestAnalysis.metricsScore,
			economicBuyerScore: latestAnalysis.economicBuyerScore,
			decisionCriteriaScore: latestAnalysis.decisionCriteriaScore,
			decisionProcessScore: latestAnalysis.decisionProcessScore,
			identifyPainScore: latestAnalysis.identifyPainScore,
			championScore: latestAnalysis.championScore,
			keyFindings: latestAnalysis.keyFindings as string[] | undefined,
			agentOutputs: latestAnalysis.agentOutputs as
				| Record<string, unknown>
				| undefined,
		},
		conversationCount,
		recentScores,
	};
}

/**
 * 確認警示
 */
export async function acknowledgeAlert(
	alertId: string,
	acknowledgedBy: string,
): Promise<void> {
	await db
		.update(alerts)
		.set({
			status: "acknowledged",
			acknowledgedBy,
			acknowledgedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(alerts.id, alertId));
}

/**
 * 解決警示
 */
export async function resolveAlert(
	alertId: string,
	resolvedBy: string,
	resolution: string,
): Promise<void> {
	await db
		.update(alerts)
		.set({
			status: "resolved",
			resolvedBy,
			resolvedAt: new Date(),
			resolution,
			updatedAt: new Date(),
		})
		.where(eq(alerts.id, alertId));
}

/**
 * 忽略警示
 */
export async function dismissAlert(alertId: string): Promise<void> {
	await db
		.update(alerts)
		.set({
			status: "dismissed",
			updatedAt: new Date(),
		})
		.where(eq(alerts.id, alertId));
}
