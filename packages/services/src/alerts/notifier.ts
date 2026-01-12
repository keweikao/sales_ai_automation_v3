import { db } from "@sales_ai_automation_v3/db";
import { alerts } from "@sales_ai_automation_v3/db/schema";
import type { Alert } from "@sales_ai_automation_v3/db/schema";
import { eq } from "drizzle-orm";

export interface SlackNotificationConfig {
	botToken: string;
	defaultChannelId: string;
}

/**
 * 發送 Slack 警示通知
 */
export async function sendSlackAlertNotification(
	alert: Alert,
	config: SlackNotificationConfig,
): Promise<boolean> {
	const { botToken, defaultChannelId } = config;
	const channelId = alert.slackChannelId || defaultChannelId;

	try {
		const blocks = buildAlertBlocks(alert);

		const response = await fetch("https://slack.com/api/chat.postMessage", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${botToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				channel: channelId,
				text: `${getAlertEmoji(alert.type)} ${alert.title}`,
				blocks,
			}),
		});

		const result = (await response.json()) as {
			ok: boolean;
			ts?: string;
			error?: string;
		};

		if (result.ok && result.ts) {
			// 更新警示記錄
			await db
				.update(alerts)
				.set({
					slackNotified: true,
					slackChannelId: channelId,
					slackMessageTs: result.ts,
					updatedAt: new Date(),
				})
				.where(eq(alerts.id, alert.id));

			return true;
		}
		console.error("Slack notification failed:", result.error);
		return false;
	} catch (error) {
		console.error("Error sending Slack notification:", error);
		return false;
	}
}

/**
 * 建立 Slack Block UI
 */
function buildAlertBlocks(alert: Alert): object[] {
	const context = alert.context as {
		meddicScore?: number;
		triggerReason?: string;
		suggestedAction?: string;
	} | null;

	const webAppUrl = process.env.WEB_APP_URL || "http://localhost:3001";

	return [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: `${getAlertEmoji(alert.type)} ${alert.title}`,
				emoji: true,
			},
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: alert.message,
			},
		},
		{
			type: "section",
			fields: [
				{
					type: "mrkdwn",
					text: `*嚴重程度*\n${formatSeverity(alert.severity)}`,
				},
				{
					type: "mrkdwn",
					text: `*MEDDIC 分數*\n${context?.meddicScore ?? "N/A"}/100`,
				},
			],
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*觸發原因*\n${context?.triggerReason || "無"}`,
			},
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*建議行動*\n${context?.suggestedAction || "無"}`,
			},
		},
		{
			type: "divider",
		},
		{
			type: "actions",
			elements: [
				{
					type: "button",
					text: { type: "plain_text", text: "已確認", emoji: true },
					action_id: "acknowledge_alert",
					value: alert.id,
					style: "primary",
				},
				{
					type: "button",
					text: { type: "plain_text", text: "忽略", emoji: true },
					action_id: "dismiss_alert",
					value: alert.id,
				},
				{
					type: "button",
					text: { type: "plain_text", text: "查看詳情", emoji: true },
					action_id: "view_alert_detail",
					url: `${webAppUrl}/alerts/${alert.id}`,
				},
			],
		},
		{
			type: "context",
			elements: [
				{
					type: "mrkdwn",
					text: `警示 ID: \`${alert.id}\` | 建立時間: ${alert.createdAt.toLocaleString("zh-TW")}`,
				},
			],
		},
	];
}

function getAlertEmoji(type: string): string {
	switch (type) {
		case "close_now":
			return "🎯";
		case "missing_dm":
			return "⚠️";
		case "manager_escalation":
			return "🚨";
		default:
			return "📢";
	}
}

function formatSeverity(severity: string): string {
	switch (severity) {
		case "high":
			return "🔴 高";
		case "medium":
			return "🟡 中";
		case "low":
			return "🟢 低";
		default:
			return severity;
	}
}
