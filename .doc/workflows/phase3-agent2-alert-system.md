# Workflow Instruction: Phase 3 Agent 2 - Alert System

> **任務類型**: 功能開發
> **預估時間**: 3-4 工作日
> **依賴條件**: Phase 2 完成（已滿足）

---

## 任務目標

實作 V2 的即時警示功能，包含三種警示類型（Close Now、Missing DM、Manager Alert），整合 Slack 通知與前端顯示。

---

## 前置條件

確認以下項目已完成：
- [x] MEDDIC Analysis schema 已建立
- [x] Conversation API 已建立
- [x] Slack Bot 框架已建立
- [x] Coach Agent Prompt 已建立

---

## 任務清單

### Task 1: Alert Schema 建立

**目標**: 建立 Alert 資料模型

**步驟**:

1. 建立 `packages/db/src/schema/alert.ts`：

```typescript
// packages/db/src/schema/alert.ts
import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { opportunities } from './opportunity';
import { conversations } from './conversation';
import { users } from './auth';

// Alert 類型
export type AlertType = 'close_now' | 'missing_dm' | 'manager_escalation';
export type AlertSeverity = 'high' | 'medium' | 'low';
export type AlertStatus = 'pending' | 'acknowledged' | 'resolved' | 'dismissed';

export const alerts = pgTable('alerts', {
  id: text('id').primaryKey(),
  opportunityId: text('opportunity_id')
    .notNull()
    .references(() => opportunities.id),
  conversationId: text('conversation_id')
    .references(() => conversations.id),
  userId: text('user_id')
    .references(() => users.id),

  // 警示資訊
  type: text('type').$type<AlertType>().notNull(),
  severity: text('severity').$type<AlertSeverity>().notNull(),
  status: text('status').$type<AlertStatus>().notNull().default('pending'),

  // 警示內容
  title: text('title').notNull(),
  message: text('message').notNull(),
  context: jsonb('context').$type<{
    meddicScore?: number;
    dimensionScores?: Record<string, number>;
    triggerReason: string;
    suggestedAction: string;
    relatedData?: Record<string, unknown>;
  }>(),

  // Slack 通知狀態
  slackNotified: boolean('slack_notified').default(false),
  slackChannelId: text('slack_channel_id'),
  slackMessageTs: text('slack_message_ts'),

  // 處理資訊
  acknowledgedBy: text('acknowledged_by'),
  acknowledgedAt: timestamp('acknowledged_at'),
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at'),
  resolution: text('resolution'),

  // 時間戳
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const alertsRelations = relations(alerts, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [alerts.opportunityId],
    references: [opportunities.id],
  }),
  conversation: one(conversations, {
    fields: [alerts.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [alerts.userId],
    references: [users.id],
  }),
}));

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
```

2. 更新 `packages/db/src/schema/index.ts`：

```typescript
// 在現有 export 後添加
export * from './alert';
```

3. 執行 migration：

```bash
cd packages/db && bun run db:generate && bun run db:push
```

**產出檔案**:
- `packages/db/src/schema/alert.ts`
- 更新 `packages/db/src/schema/index.ts`

---

### Task 2: Alert Services 建立

**目標**: 建立警示規則引擎和通知服務

**步驟**:

1. 建立 `packages/services/src/alerts/types.ts`：

```typescript
// packages/services/src/alerts/types.ts

export type AlertType = 'close_now' | 'missing_dm' | 'manager_escalation';
export type AlertSeverity = 'high' | 'medium' | 'low';

export interface AlertContext {
  meddicScore?: number;
  dimensionScores?: {
    metrics: number;
    economicBuyer: number;
    decisionCriteria: number;
    decisionProcess: number;
    identifyPain: number;
    champion: number;
  };
  triggerReason: string;
  suggestedAction: string;
  relatedData?: Record<string, unknown>;
}

export interface AlertResult {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  context: AlertContext;
}

export interface EvaluationContext {
  opportunityId: string;
  opportunityName: string;
  conversationId?: string;
  userId?: string;
  meddicAnalysis: {
    overallScore: number;
    metricsScore: number | null;
    economicBuyerScore: number | null;
    decisionCriteriaScore: number | null;
    decisionProcessScore: number | null;
    identifyPainScore: number | null;
    championScore: number | null;
    keyFindings?: string[];
    agentOutputs?: Record<string, unknown>;
  };
  conversationCount: number;
  recentScores: number[]; // 最近的分析分數（最新的在前）
}

export interface AlertRule {
  type: AlertType;
  name: string;
  description: string;
  evaluate: (context: EvaluationContext) => AlertResult | null;
}
```

2. 建立 `packages/services/src/alerts/rules.ts`：

```typescript
// packages/services/src/alerts/rules.ts

import type { AlertRule, EvaluationContext, AlertResult } from './types';

/**
 * 檢查是否有明確的購買訊號
 */
function hasExplicitBuyingSignal(analysis: EvaluationContext['meddicAnalysis']): boolean {
  const keyFindings = analysis.keyFindings || [];
  const buyingKeywords = [
    '預算', 'budget', '採購', '購買', '簽約', '合約',
    '時程', '時間表', 'timeline', '導入', '實施',
  ];

  return keyFindings.some(finding =>
    buyingKeywords.some(keyword => finding.toLowerCase().includes(keyword))
  );
}

/**
 * Close Now 規則
 * 觸發條件：MEDDIC >= 80 且有 Champion 且有明確購買訊號
 */
const closeNowRule: AlertRule = {
  type: 'close_now',
  name: 'Close Now 機會',
  description: '高分商機，建議立即跟進成交',
  evaluate: (ctx: EvaluationContext): AlertResult | null => {
    const { meddicAnalysis, opportunityName } = ctx;

    const hasHighScore = meddicAnalysis.overallScore >= 80;
    const hasChampion = (meddicAnalysis.championScore ?? 0) >= 4;
    const hasBuyingSignal = hasExplicitBuyingSignal(meddicAnalysis);

    if (hasHighScore && hasChampion && hasBuyingSignal) {
      return {
        type: 'close_now',
        severity: 'high',
        title: '🎯 Close Now 機會！',
        message: `${opportunityName} MEDDIC 分數達 ${meddicAnalysis.overallScore}，有明確購買訊號，建議立即安排成交會議！`,
        context: {
          meddicScore: meddicAnalysis.overallScore,
          dimensionScores: {
            metrics: meddicAnalysis.metricsScore ?? 0,
            economicBuyer: meddicAnalysis.economicBuyerScore ?? 0,
            decisionCriteria: meddicAnalysis.decisionCriteriaScore ?? 0,
            decisionProcess: meddicAnalysis.decisionProcessScore ?? 0,
            identifyPain: meddicAnalysis.identifyPainScore ?? 0,
            champion: meddicAnalysis.championScore ?? 0,
          },
          triggerReason: '高分 + Champion + 明確購買訊號',
          suggestedAction: '立即安排簽約/成交會議',
        },
      };
    }

    return null;
  },
};

/**
 * Missing DM 規則
 * 觸發條件：Economic Buyer 分數 <= 2 且已有 2 次以上對話
 */
const missingDmRule: AlertRule = {
  type: 'missing_dm',
  name: '缺少決策者',
  description: '多次對話但尚未接觸經濟決策者',
  evaluate: (ctx: EvaluationContext): AlertResult | null => {
    const { meddicAnalysis, opportunityName, conversationCount } = ctx;

    const lowEconomicBuyer = (meddicAnalysis.economicBuyerScore ?? 0) <= 2;
    const hasMultipleConversations = conversationCount >= 2;

    if (lowEconomicBuyer && hasMultipleConversations) {
      return {
        type: 'missing_dm',
        severity: 'medium',
        title: '⚠️ 缺少經濟決策者',
        message: `${opportunityName} 已進行 ${conversationCount} 次對話，但尚未有效接觸經濟決策者（分數: ${meddicAnalysis.economicBuyerScore}/5）`,
        context: {
          meddicScore: meddicAnalysis.overallScore,
          dimensionScores: {
            metrics: meddicAnalysis.metricsScore ?? 0,
            economicBuyer: meddicAnalysis.economicBuyerScore ?? 0,
            decisionCriteria: meddicAnalysis.decisionCriteriaScore ?? 0,
            decisionProcess: meddicAnalysis.decisionProcessScore ?? 0,
            identifyPain: meddicAnalysis.identifyPainScore ?? 0,
            champion: meddicAnalysis.championScore ?? 0,
          },
          triggerReason: `多次對話(${conversationCount})但 Economic Buyer 分數過低(${meddicAnalysis.economicBuyerScore}/5)`,
          suggestedAction: '詢問決策流程，要求內部支持者引薦決策者',
          relatedData: {
            conversationCount,
          },
        },
      };
    }

    return null;
  },
};

/**
 * Manager Escalation 規則
 * 觸發條件：連續 3 次 MEDDIC 分數 < 40
 */
const managerAlertRule: AlertRule = {
  type: 'manager_escalation',
  name: '主管關注',
  description: '連續低分，需要主管介入',
  evaluate: (ctx: EvaluationContext): AlertResult | null => {
    const { recentScores, opportunityName, meddicAnalysis } = ctx;

    // 檢查最近 3 次分數是否都低於 40
    const last3Scores = recentScores.slice(0, 3);
    const allLowScores = last3Scores.length >= 3 && last3Scores.every(s => s < 40);

    if (allLowScores) {
      return {
        type: 'manager_escalation',
        severity: 'high',
        title: '🚨 需要主管關注',
        message: `${opportunityName} 連續 3 次 MEDDIC 分數低於 40（最近分數: ${last3Scores.join(', ')}），建議主管介入檢討`,
        context: {
          meddicScore: meddicAnalysis.overallScore,
          dimensionScores: {
            metrics: meddicAnalysis.metricsScore ?? 0,
            economicBuyer: meddicAnalysis.economicBuyerScore ?? 0,
            decisionCriteria: meddicAnalysis.decisionCriteriaScore ?? 0,
            decisionProcess: meddicAnalysis.decisionProcessScore ?? 0,
            identifyPain: meddicAnalysis.identifyPainScore ?? 0,
            champion: meddicAnalysis.championScore ?? 0,
          },
          triggerReason: `連續 3 次低分: ${last3Scores.join(', ')}`,
          suggestedAction: '主管與業務一對一檢討，調整銷售策略或考慮放棄',
          relatedData: {
            recentScores: last3Scores,
          },
        },
      };
    }

    return null;
  },
};

// 導出所有規則
export const ALERT_RULES: AlertRule[] = [
  closeNowRule,
  missingDmRule,
  managerAlertRule,
];

export { closeNowRule, missingDmRule, managerAlertRule };
```

3. 建立 `packages/services/src/alerts/evaluator.ts`：

```typescript
// packages/services/src/alerts/evaluator.ts

import { db } from '@sales_ai_automation_v3/db';
import { alerts, meddicAnalyses, conversations, opportunities } from '@sales_ai_automation_v3/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { ALERT_RULES } from './rules';
import type { EvaluationContext, AlertResult } from './types';

/**
 * 評估並建立警示
 */
export async function evaluateAndCreateAlerts(
  opportunityId: string,
  conversationId: string,
  userId?: string
): Promise<AlertResult[]> {
  // 取得評估所需的資料
  const context = await buildEvaluationContext(opportunityId, conversationId, userId);

  if (!context) {
    console.log('Cannot build evaluation context for', opportunityId);
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
          eq(alerts.status, 'pending')
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
          status: 'pending',
          title: result.title,
          message: result.message,
          context: result.context,
        });

        triggeredAlerts.push(result);
        console.log(`Alert created: ${result.type} for opportunity ${opportunityId}`);
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
  userId?: string
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
    .map(a => a.overallScore)
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
      agentOutputs: latestAnalysis.agentOutputs as Record<string, unknown> | undefined,
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
  acknowledgedBy: string
): Promise<void> {
  await db.update(alerts)
    .set({
      status: 'acknowledged',
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
  resolution: string
): Promise<void> {
  await db.update(alerts)
    .set({
      status: 'resolved',
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
  await db.update(alerts)
    .set({
      status: 'dismissed',
      updatedAt: new Date(),
    })
    .where(eq(alerts.id, alertId));
}
```

4. 建立 `packages/services/src/alerts/notifier.ts`：

```typescript
// packages/services/src/alerts/notifier.ts

import { db } from '@sales_ai_automation_v3/db';
import { alerts } from '@sales_ai_automation_v3/db/schema';
import { eq } from 'drizzle-orm';
import type { Alert } from '@sales_ai_automation_v3/db/schema';

export interface SlackNotificationConfig {
  botToken: string;
  defaultChannelId: string;
}

/**
 * 發送 Slack 警示通知
 */
export async function sendSlackAlertNotification(
  alert: Alert,
  config: SlackNotificationConfig
): Promise<boolean> {
  const { botToken, defaultChannelId } = config;
  const channelId = alert.slackChannelId || defaultChannelId;

  try {
    const blocks = buildAlertBlocks(alert);

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        text: `${getAlertEmoji(alert.type)} ${alert.title}`,
        blocks,
      }),
    });

    const result = await response.json() as { ok: boolean; ts?: string; error?: string };

    if (result.ok && result.ts) {
      // 更新警示記錄
      await db.update(alerts)
        .set({
          slackNotified: true,
          slackChannelId: channelId,
          slackMessageTs: result.ts,
          updatedAt: new Date(),
        })
        .where(eq(alerts.id, alert.id));

      return true;
    } else {
      console.error('Slack notification failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error);
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

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: alert.title,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: alert.message,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*嚴重程度*\n${formatSeverity(alert.severity)}`,
        },
        {
          type: 'mrkdwn',
          text: `*MEDDIC 分數*\n${context?.meddicScore ?? 'N/A'}/100`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*觸發原因*\n${context?.triggerReason || '無'}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*建議行動*\n${context?.suggestedAction || '無'}`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '✓ 已確認', emoji: true },
          action_id: 'acknowledge_alert',
          value: alert.id,
          style: 'primary',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '✗ 忽略', emoji: true },
          action_id: 'dismiss_alert',
          value: alert.id,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '📋 查看詳情', emoji: true },
          action_id: 'view_alert_detail',
          url: `${process.env.WEB_APP_URL || 'http://localhost:3001'}/alerts/${alert.id}`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `警示 ID: \`${alert.id}\` | 建立時間: ${alert.createdAt.toLocaleString('zh-TW')}`,
        },
      ],
    },
  ];
}

function getAlertEmoji(type: string): string {
  switch (type) {
    case 'close_now':
      return '🎯';
    case 'missing_dm':
      return '⚠️';
    case 'manager_escalation':
      return '🚨';
    default:
      return '📢';
  }
}

function formatSeverity(severity: string): string {
  switch (severity) {
    case 'high':
      return '🔴 高';
    case 'medium':
      return '🟡 中';
    case 'low':
      return '🟢 低';
    default:
      return severity;
  }
}
```

5. 建立 `packages/services/src/alerts/index.ts`：

```typescript
// packages/services/src/alerts/index.ts

export * from './types';
export * from './rules';
export * from './evaluator';
export * from './notifier';
```

6. 更新 `packages/services/src/index.ts`：

```typescript
// 在現有 export 後添加
export * from './alerts';
```

**產出檔案**:
- `packages/services/src/alerts/types.ts`
- `packages/services/src/alerts/rules.ts`
- `packages/services/src/alerts/evaluator.ts`
- `packages/services/src/alerts/notifier.ts`
- `packages/services/src/alerts/index.ts`

---

### Task 3: Alert API Router

**目標**: 建立 Alert API 端點

**步驟**:

1. 建立 `packages/api/src/routers/alert.ts`：

```typescript
// packages/api/src/routers/alert.ts

import { db } from '@sales_ai_automation_v3/db';
import { alerts, opportunities } from '@sales_ai_automation_v3/db/schema';
import { ORPCError } from '@orpc/server';
import { and, eq, desc, inArray, count } from 'drizzle-orm';
import { z } from 'zod';
import { protectedProcedure } from '../index';
import {
  acknowledgeAlert,
  resolveAlert,
  dismissAlert,
} from '@sales_ai_automation_v3/services';

// ============================================================
// Schemas
// ============================================================

const listAlertsSchema = z.object({
  status: z.enum(['pending', 'acknowledged', 'resolved', 'dismissed']).optional(),
  type: z.enum(['close_now', 'missing_dm', 'manager_escalation']).optional(),
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
      throw new ORPCError('UNAUTHORIZED');
    }

    const { status, type, opportunityId, limit, offset } = input;

    // 建立查詢條件
    const conditions = [];

    // 只顯示使用者有權限的商機的警示
    const userOpportunities = await db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(eq(opportunities.userId, userId));

    const opportunityIds = userOpportunities.map(o => o.id);

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
      throw new ORPCError('UNAUTHORIZED');
    }

    const alert = await db.query.alerts.findFirst({
      where: eq(alerts.id, alertId),
      with: {
        opportunity: true,
        conversation: true,
      },
    });

    if (!alert) {
      throw new ORPCError('NOT_FOUND');
    }

    // 驗證權限
    if (alert.opportunity?.userId !== userId) {
      throw new ORPCError('FORBIDDEN');
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
      throw new ORPCError('UNAUTHORIZED');
    }

    // 驗證警示存在且有權限
    const alert = await db.query.alerts.findFirst({
      where: eq(alerts.id, alertId),
      with: { opportunity: true },
    });

    if (!alert) {
      throw new ORPCError('NOT_FOUND');
    }

    if (alert.opportunity?.userId !== userId) {
      throw new ORPCError('FORBIDDEN');
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
      throw new ORPCError('UNAUTHORIZED');
    }

    // 驗證警示存在且有權限
    const alert = await db.query.alerts.findFirst({
      where: eq(alerts.id, alertId),
      with: { opportunity: true },
    });

    if (!alert) {
      throw new ORPCError('NOT_FOUND');
    }

    if (alert.opportunity?.userId !== userId) {
      throw new ORPCError('FORBIDDEN');
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
      throw new ORPCError('UNAUTHORIZED');
    }

    // 驗證警示存在且有權限
    const alert = await db.query.alerts.findFirst({
      where: eq(alerts.id, alertId),
      with: { opportunity: true },
    });

    if (!alert) {
      throw new ORPCError('NOT_FOUND');
    }

    if (alert.opportunity?.userId !== userId) {
      throw new ORPCError('FORBIDDEN');
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
    throw new ORPCError('UNAUTHORIZED');
  }

  // 取得使用者的商機
  const userOpportunities = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(eq(opportunities.userId, userId));

  const opportunityIds = userOpportunities.map(o => o.id);

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
    .where(and(inArray(alerts.opportunityId, opportunityIds), eq(alerts.status, 'pending')));

  const acknowledgedCount = await db
    .select({ count: count() })
    .from(alerts)
    .where(and(inArray(alerts.opportunityId, opportunityIds), eq(alerts.status, 'acknowledged')));

  const resolvedCount = await db
    .select({ count: count() })
    .from(alerts)
    .where(and(inArray(alerts.opportunityId, opportunityIds), eq(alerts.status, 'resolved')));

  // 按類型統計（僅 pending）
  const closeNowCount = await db
    .select({ count: count() })
    .from(alerts)
    .where(
      and(
        inArray(alerts.opportunityId, opportunityIds),
        eq(alerts.status, 'pending'),
        eq(alerts.type, 'close_now')
      )
    );

  const missingDmCount = await db
    .select({ count: count() })
    .from(alerts)
    .where(
      and(
        inArray(alerts.opportunityId, opportunityIds),
        eq(alerts.status, 'pending'),
        eq(alerts.type, 'missing_dm')
      )
    );

  const managerCount = await db
    .select({ count: count() })
    .from(alerts)
    .where(
      and(
        inArray(alerts.opportunityId, opportunityIds),
        eq(alerts.status, 'pending'),
        eq(alerts.type, 'manager_escalation')
      )
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
```

2. 更新 `packages/api/src/routers/index.ts`：

```typescript
// 添加 import
import { alertRouter } from './alert';

// 在 router 定義中添加
export const router = {
  // ... 現有 routers
  alert: alertRouter,
};
```

**產出檔案**:
- `packages/api/src/routers/alert.ts`
- 更新 `packages/api/src/routers/index.ts`

---

### Task 4: Slack Bot Alert 處理

**目標**: 在 Slack Bot 中處理警示互動

**步驟**:

1. 建立 `apps/slack-bot/src/alerts/index.ts`：

```typescript
// apps/slack-bot/src/alerts/index.ts

import type { Env } from '../types';
import { ApiClient } from '../api-client';

/**
 * 處理警示確認按鈕
 */
export async function handleAcknowledgeAlert(
  alertId: string,
  userId: string,
  env: Env
): Promise<{ success: boolean; message: string }> {
  const apiClient = new ApiClient(env.API_BASE_URL, env.API_TOKEN);

  try {
    await apiClient.acknowledgeAlert(alertId);
    return {
      success: true,
      message: `警示已確認 (${alertId})`,
    };
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return {
      success: false,
      message: `確認警示失敗: ${error instanceof Error ? error.message : '未知錯誤'}`,
    };
  }
}

/**
 * 處理警示忽略按鈕
 */
export async function handleDismissAlert(
  alertId: string,
  env: Env
): Promise<{ success: boolean; message: string }> {
  const apiClient = new ApiClient(env.API_BASE_URL, env.API_TOKEN);

  try {
    await apiClient.dismissAlert(alertId);
    return {
      success: true,
      message: `警示已忽略 (${alertId})`,
    };
  } catch (error) {
    console.error('Error dismissing alert:', error);
    return {
      success: false,
      message: `忽略警示失敗: ${error instanceof Error ? error.message : '未知錯誤'}`,
    };
  }
}
```

2. 更新 `apps/slack-bot/src/api-client.ts`，添加 Alert 相關方法：

```typescript
// 在 ApiClient class 中添加

// Alert 相關 API
async acknowledgeAlert(alertId: string): Promise<void> {
  await this.request('/api/alert.acknowledge', {
    method: 'POST',
    body: JSON.stringify({ alertId }),
  });
}

async dismissAlert(alertId: string): Promise<void> {
  await this.request('/api/alert.dismiss', {
    method: 'POST',
    body: JSON.stringify({ alertId }),
  });
}

async resolveAlert(alertId: string, resolution: string): Promise<void> {
  await this.request('/api/alert.resolve', {
    method: 'POST',
    body: JSON.stringify({ alertId, resolution }),
  });
}

async getAlerts(params?: {
  status?: string;
  type?: string;
  opportunityId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ alerts: AlertResponse[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.opportunityId) searchParams.set('opportunityId', params.opportunityId);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));

  const query = searchParams.toString();
  return this.request(`/api/alert.list${query ? `?${query}` : ''}`);
}

async getAlertStats(): Promise<AlertStatsResponse> {
  return this.request<AlertStatsResponse>('/api/alert.stats');
}
```

3. 更新 `apps/slack-bot/src/types.ts`，添加 Alert 相關類型和更新 Env：

```typescript
// 更新 Env 介面，添加 SLACK_ALERT_CHANNEL
export interface Env {
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  SLACK_ALERT_CHANNEL?: string;  // 預設警示通知頻道
  API_BASE_URL: string;
  API_TOKEN?: string;
  ENVIRONMENT: string;
}

// 在檔案末尾添加 Alert 相關類型
export interface AlertResponse {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  opportunityId: string;
  conversationId?: string;
  context: AlertContext;
  slackNotified: boolean;
  createdAt: string;
}

export type AlertType = 'close_now' | 'missing_dm' | 'manager_escalation';
export type AlertSeverity = 'high' | 'medium' | 'low';
export type AlertStatus = 'pending' | 'acknowledged' | 'resolved' | 'dismissed';

export interface AlertContext {
  meddicScore?: number;
  triggerReason: string;
  suggestedAction: string;
}

export interface AlertStatsResponse {
  pending: number;
  acknowledged: number;
  resolved: number;
  byType: {
    close_now: number;
    missing_dm: number;
    manager_escalation: number;
  };
}
```

4. 更新 `apps/slack-bot/src/index.ts` 的 interactions handler：

```typescript
// 在 /slack/interactions handler 中更新

import { handleAcknowledgeAlert, handleDismissAlert } from './alerts';

// 在 block_actions 處理中添加
if (payload.type === 'block_actions') {
  const action = payload.actions?.[0];
  if (action) {
    const actionId = action.action_id;
    const value = action.value;

    switch (actionId) {
      case 'acknowledge_alert':
        const ackResult = await handleAcknowledgeAlert(value, payload.user.id, env);
        // 更新訊息顯示結果
        if (ackResult.success) {
          await fetch(payload.response_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `✅ ${ackResult.message}`,
              replace_original: false,
            }),
          });
        }
        break;

      case 'dismiss_alert':
        const dismissResult = await handleDismissAlert(value, env);
        if (dismissResult.success) {
          await fetch(payload.response_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `✗ ${dismissResult.message}`,
              replace_original: false,
            }),
          });
        }
        break;

      // ... 其他 action 處理
    }
  }
}
```

**產出檔案**:
- `apps/slack-bot/src/alerts/index.ts`
- 更新 `apps/slack-bot/src/api-client.ts`
- 更新 `apps/slack-bot/src/types.ts`
- 更新 `apps/slack-bot/src/index.ts`

---

### Task 5: 前端 Alert 元件

**目標**: 建立前端警示顯示元件

**步驟**:

1. 建立 `apps/web/src/components/alert/alert-badge.tsx`：

```tsx
// apps/web/src/components/alert/alert-badge.tsx

import { Badge } from '@/components/ui/badge';

interface AlertBadgeProps {
  type: 'close_now' | 'missing_dm' | 'manager_escalation';
  severity: 'high' | 'medium' | 'low';
}

export function AlertBadge({ type, severity }: AlertBadgeProps) {
  const typeLabels: Record<string, string> = {
    close_now: 'Close Now',
    missing_dm: '缺少 DM',
    manager_escalation: '需主管關注',
  };

  const severityVariants: Record<string, 'destructive' | 'secondary' | 'outline'> = {
    high: 'destructive',
    medium: 'secondary',
    low: 'outline',
  };

  return (
    <Badge variant={severityVariants[severity]}>
      {typeLabels[type] || type}
    </Badge>
  );
}
```

2. 建立 `apps/web/src/components/alert/alert-list.tsx`：

```tsx
// apps/web/src/components/alert/alert-list.tsx

import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { AlertBadge } from './alert-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Alert {
  id: string;
  type: 'close_now' | 'missing_dm' | 'manager_escalation';
  severity: 'high' | 'medium' | 'low';
  status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  title: string;
  message: string;
  createdAt: string;
  opportunityName?: string;
}

interface AlertListProps {
  alerts: Alert[];
  onAcknowledge?: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
  onViewDetail?: (alertId: string) => void;
}

export function AlertList({ alerts, onAcknowledge, onDismiss, onViewDetail }: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          目前沒有待處理的警示
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {alerts.map(alert => (
        <Card key={alert.id} className={alert.severity === 'high' ? 'border-destructive' : ''}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{alert.title}</CardTitle>
              <AlertBadge type={alert.type} severity={alert.severity} />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>

            {alert.opportunityName && (
              <p className="text-sm">
                <span className="font-medium">商機：</span>
                {alert.opportunityName}
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-2">
              {formatDistanceToNow(new Date(alert.createdAt), {
                addSuffix: true,
                locale: zhTW,
              })}
            </p>

            {alert.status === 'pending' && (
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  onClick={() => onAcknowledge?.(alert.id)}
                >
                  確認
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDismiss?.(alert.id)}
                >
                  忽略
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onViewDetail?.(alert.id)}
                >
                  查看詳情
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

3. 建立 `apps/web/src/components/alert/alert-stats.tsx`：

```tsx
// apps/web/src/components/alert/alert-stats.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Clock, Target } from 'lucide-react';

interface AlertStatsProps {
  pending: number;
  acknowledged: number;
  resolved: number;
  byType: {
    close_now: number;
    missing_dm: number;
    manager_escalation: number;
  };
}

export function AlertStats({ pending, acknowledged, resolved, byType }: AlertStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">待處理</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pending}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">已確認</CardTitle>
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{acknowledged}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">已解決</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{resolved}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Close Now 機會</CardTitle>
          <Target className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{byType.close_now}</div>
        </CardContent>
      </Card>
    </div>
  );
}
```

4. 建立 `apps/web/src/components/alert/index.ts`（barrel export）：

```typescript
// apps/web/src/components/alert/index.ts

export * from './alert-badge';
export * from './alert-list';
export * from './alert-stats';
```

**產出檔案**:
- `apps/web/src/components/alert/index.ts`
- `apps/web/src/components/alert/alert-badge.tsx`
- `apps/web/src/components/alert/alert-list.tsx`
- `apps/web/src/components/alert/alert-stats.tsx`

---

### Task 6: 前端 Alert Hooks 與路由

**目標**: 建立 Alert API hooks 和頁面路由

**前置作業**: 安裝 date-fns 依賴

```bash
cd apps/web && bun add date-fns
```

**步驟**:

1. 建立 `apps/web/src/hooks/use-alerts.ts`：

```typescript
// apps/web/src/hooks/use-alerts.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpc } from '@/utils/orpc';

export function useAlerts(params?: {
  status?: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  type?: 'close_now' | 'missing_dm' | 'manager_escalation';
  opportunityId?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['alerts', params],
    queryFn: () => orpc.alert.list.call(params ?? {}),
  });
}

export function useAlert(alertId: string) {
  return useQuery({
    queryKey: ['alert', alertId],
    queryFn: () => orpc.alert.get.call({ alertId }),
    enabled: !!alertId,
  });
}

export function useAlertStats() {
  return useQuery({
    queryKey: ['alertStats'],
    queryFn: () => orpc.alert.stats.call({}),
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: string) => orpc.alert.acknowledge.call({ alertId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alertStats'] });
    },
  });
}

export function useDismissAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: string) => orpc.alert.dismiss.call({ alertId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alertStats'] });
    },
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ alertId, resolution }: { alertId: string; resolution: string }) =>
      orpc.alert.resolve.call({ alertId, resolution }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alertStats'] });
    },
  });
}
```

2. 建立 `apps/web/src/routes/alerts/index.tsx`（警示列表頁面）：

```tsx
// apps/web/src/routes/alerts/index.tsx

import { createFileRoute } from '@tanstack/react-router';
import { AlertList, AlertStats } from '@/components/alert';
import { useAlerts, useAlertStats, useAcknowledgeAlert, useDismissAlert } from '@/hooks/use-alerts';
import { useNavigate } from '@tanstack/react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const Route = createFileRoute('/alerts/')({
  component: AlertsPage,
});

function AlertsPage() {
  const navigate = useNavigate();
  const { data: statsData } = useAlertStats();
  const { data: pendingData, isLoading: pendingLoading } = useAlerts({ status: 'pending' });
  const { data: acknowledgedData } = useAlerts({ status: 'acknowledged' });
  const { data: resolvedData } = useAlerts({ status: 'resolved' });

  const acknowledgeMutation = useAcknowledgeAlert();
  const dismissMutation = useDismissAlert();

  const handleAcknowledge = (alertId: string) => {
    acknowledgeMutation.mutate(alertId);
  };

  const handleDismiss = (alertId: string) => {
    dismissMutation.mutate(alertId);
  };

  const handleViewDetail = (alertId: string) => {
    navigate({ to: '/alerts/$alertId', params: { alertId } });
  };

  return (
    <div className="container py-6 space-y-6">
      <h1 className="text-2xl font-bold">警示中心</h1>

      {statsData && (
        <AlertStats
          pending={statsData.pending}
          acknowledged={statsData.acknowledged}
          resolved={statsData.resolved}
          byType={statsData.byType}
        />
      )}

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            待處理 ({pendingData?.total ?? 0})
          </TabsTrigger>
          <TabsTrigger value="acknowledged">
            已確認 ({acknowledgedData?.total ?? 0})
          </TabsTrigger>
          <TabsTrigger value="resolved">
            已解決 ({resolvedData?.total ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pendingLoading ? (
            <p>載入中...</p>
          ) : (
            <AlertList
              alerts={pendingData?.alerts ?? []}
              onAcknowledge={handleAcknowledge}
              onDismiss={handleDismiss}
              onViewDetail={handleViewDetail}
            />
          )}
        </TabsContent>

        <TabsContent value="acknowledged" className="mt-4">
          <AlertList
            alerts={acknowledgedData?.alerts ?? []}
            onViewDetail={handleViewDetail}
          />
        </TabsContent>

        <TabsContent value="resolved" className="mt-4">
          <AlertList
            alerts={resolvedData?.alerts ?? []}
            onViewDetail={handleViewDetail}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

3. 建立 `apps/web/src/routes/alerts/$alertId.tsx`（警示詳情頁面）：

```tsx
// apps/web/src/routes/alerts/$alertId.tsx

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAlert, useAcknowledgeAlert, useResolveAlert, useDismissAlert } from '@/hooks/use-alerts';
import { AlertBadge } from '@/components/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

export const Route = createFileRoute('/alerts/$alertId')({
  component: AlertDetailPage,
});

function AlertDetailPage() {
  const { alertId } = Route.useParams();
  const navigate = useNavigate();
  const { data: alert, isLoading } = useAlert(alertId);
  const [resolution, setResolution] = useState('');

  const acknowledgeMutation = useAcknowledgeAlert();
  const resolveMutation = useResolveAlert();
  const dismissMutation = useDismissAlert();

  if (isLoading) {
    return <div className="container py-6">載入中...</div>;
  }

  if (!alert) {
    return <div className="container py-6">找不到警示</div>;
  }

  const context = alert.context as {
    meddicScore?: number;
    triggerReason?: string;
    suggestedAction?: string;
    dimensionScores?: Record<string, number>;
  } | null;

  return (
    <div className="container py-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate({ to: '/alerts' })}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回警示列表
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{alert.title}</CardTitle>
            <AlertBadge type={alert.type} severity={alert.severity} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>{alert.message}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">MEDDIC 分數</p>
              <p className="text-2xl font-bold">{context?.meddicScore ?? 'N/A'}/100</p>
            </div>
            <div>
              <p className="text-sm font-medium">狀態</p>
              <p className="text-lg">{alert.status}</p>
            </div>
          </div>

          {context?.triggerReason && (
            <div>
              <p className="text-sm font-medium">觸發原因</p>
              <p className="text-muted-foreground">{context.triggerReason}</p>
            </div>
          )}

          {context?.suggestedAction && (
            <div>
              <p className="text-sm font-medium">建議行動</p>
              <p className="text-muted-foreground">{context.suggestedAction}</p>
            </div>
          )}

          {alert.status === 'pending' && (
            <div className="flex gap-2 pt-4">
              <Button onClick={() => acknowledgeMutation.mutate(alertId)}>
                確認警示
              </Button>
              <Button variant="outline" onClick={() => dismissMutation.mutate(alertId)}>
                忽略
              </Button>
            </div>
          )}

          {alert.status === 'acknowledged' && (
            <div className="space-y-4 pt-4">
              <Textarea
                placeholder="輸入解決方案..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
              <Button
                onClick={() => resolveMutation.mutate({ alertId, resolution })}
                disabled={!resolution.trim()}
              >
                標記為已解決
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**產出檔案**:
- `apps/web/src/hooks/use-alerts.ts`
- `apps/web/src/routes/alerts/index.tsx`
- `apps/web/src/routes/alerts/$alertId.tsx`

---

## 驗收標準

- [ ] Alert schema 正確建立且 migration 成功
- [ ] 三種警示規則正確觸發
- [ ] Alert API 端點正常運作
- [ ] Slack 通知發送成功
- [ ] Slack 按鈕互動正常
- [ ] 前端警示列表顯示正確
- [ ] 警示確認/忽略/解決流程完整
- [ ] 前端 Alert 頁面路由正確運作
- [ ] React Query hooks 正確呼叫 API
- [ ] date-fns 依賴已安裝
- [ ] Slack Bot types 已更新（包含 Alert 類型和 SLACK_ALERT_CHANNEL）

---

## 整合測試

在 MEDDIC 分析完成後自動觸發警示評估，在 `packages/api/src/routers/conversation.ts` 的 `analyze` handler 最後添加：

```typescript
import { evaluateAndCreateAlerts, sendSlackAlertNotification } from '@sales_ai_automation_v3/services';

// 在分析完成後
const triggeredAlerts = await evaluateAndCreateAlerts(
  conversation.opportunityId,
  conversationId,
  userId
);

// 發送 Slack 通知
for (const alertResult of triggeredAlerts) {
  const alert = await db.query.alerts.findFirst({
    where: and(
      eq(alerts.opportunityId, conversation.opportunityId),
      eq(alerts.type, alertResult.type),
      eq(alerts.status, 'pending')
    ),
    orderBy: desc(alerts.createdAt),
  });

  if (alert && process.env.SLACK_BOT_TOKEN && process.env.SLACK_ALERT_CHANNEL) {
    await sendSlackAlertNotification(alert, {
      botToken: process.env.SLACK_BOT_TOKEN,
      defaultChannelId: process.env.SLACK_ALERT_CHANNEL,
    });
  }
}
```

---

## 產出檔案總覽

```
packages/db/src/schema/
└── alert.ts

packages/services/src/alerts/
├── index.ts
├── types.ts
├── rules.ts
├── evaluator.ts
└── notifier.ts

packages/api/src/routers/
└── alert.ts

apps/slack-bot/src/
├── alerts/
│   └── index.ts
├── api-client.ts (更新)
└── types.ts (更新)

apps/web/src/
├── components/alert/
│   ├── index.ts
│   ├── alert-badge.tsx
│   ├── alert-list.tsx
│   └── alert-stats.tsx
├── hooks/
│   └── use-alerts.ts
└── routes/alerts/
    ├── index.tsx
    └── $alertId.tsx
```
