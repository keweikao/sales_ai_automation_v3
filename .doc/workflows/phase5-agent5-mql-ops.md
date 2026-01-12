# Workflow Instruction: Phase 5 Agent 5 - MQL 資格審查 + Ops Automation

> **任務類型**: 模組開發
> **預估時間**: 2 工作日
> **依賴條件**: Phase 4 完成
> **可並行**: 與 Agent 4, 6, 7 同時開發

---

## 任務目標

建立 MQL（Marketing Qualified Lead）評分系統和營運自動化模組，包含健康檢查 API、服務監控與異常通知。

---

## 前置條件

- [ ] Phase 4 部署完成
- [ ] Opportunity schema 已存在
- [ ] Alert 系統已建立（Phase 3）
- [ ] Slack Bot 已部署

---

## 任務清單

### Task 1: MQL Schema

**目標**: 建立 MQL 評估相關資料表

**檔案**: `packages/db/src/schema/mql.ts`

```typescript
// packages/db/src/schema/mql.ts

import { pgTable, text, timestamp, integer, jsonb, boolean } from 'drizzle-orm/pg-core';

/**
 * MQL 評估結果
 */
export const mqlEvaluations = pgTable('mql_evaluations', {
  id: text('id').primaryKey(),
  opportunityId: text('opportunity_id').notNull(),

  // 評分結果
  score: integer('score').notNull(),          // 0-100
  status: text('status').notNull(),           // qualified, not_qualified, needs_review
  threshold: integer('threshold').notNull(),  // 評估時的門檻值

  // 評分細項
  scoreBreakdown: jsonb('score_breakdown'),   // { criteria: score, ... }

  // 觸發來源
  triggeredBy: text('triggered_by'),          // auto, manual, webhook

  // 時間
  evaluatedAt: timestamp('evaluated_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),         // 評估有效期限
});

/**
 * MQL 評分規則
 */
export const mqlRules = pgTable('mql_rules', {
  id: text('id').primaryKey(),

  // 規則定義
  name: text('name').notNull(),
  description: text('description'),
  criteria: text('criteria').notNull(),       // company_size, industry, engagement, etc.

  // 評分
  weight: integer('weight').notNull(),        // 權重 1-10
  maxScore: integer('max_score').notNull(),   // 該規則最高分數

  // 條件
  condition: jsonb('condition'),              // { operator: 'gte', value: 100 }

  // 狀態
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(0),

  // 時間
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type MqlEvaluation = typeof mqlEvaluations.$inferSelect;
export type NewMqlEvaluation = typeof mqlEvaluations.$inferInsert;
export type MqlRule = typeof mqlRules.$inferSelect;
export type NewMqlRule = typeof mqlRules.$inferInsert;
```

**執行**:
```bash
cd packages/db
bun run db:generate
bun run db:push
```

**驗證**:
- [ ] 表已建立
- [ ] 類型正確匯出

---

### Task 2: MQL 評分引擎

**目標**: 建立可配置的 MQL 評分系統

**檔案結構**:
```
packages/services/src/mql/
├── index.ts
├── types.ts
├── scoring.ts      # 評分計算邏輯
├── rules.ts        # 規則管理
└── evaluator.ts    # 評估執行器
```

**核心邏輯 - `scoring.ts`**:

```typescript
// packages/services/src/mql/scoring.ts

import { db } from '@sales_ai_automation_v3/db';
import { mqlRules, opportunities } from '@sales_ai_automation_v3/db/schema';
import { eq } from 'drizzle-orm';
import type { MqlRule } from '@sales_ai_automation_v3/db/schema';

interface ScoreResult {
  totalScore: number;
  maxPossibleScore: number;
  breakdown: Record<string, { score: number; maxScore: number; weight: number }>;
  qualificationStatus: 'qualified' | 'not_qualified' | 'needs_review';
}

/**
 * 計算 MQL 分數
 */
export async function calculateMqlScore(opportunityId: string): Promise<ScoreResult> {
  // 1. 取得 Opportunity
  const opportunity = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, opportunityId),
  });

  if (!opportunity) {
    throw new Error(`Opportunity ${opportunityId} not found`);
  }

  // 2. 取得所有啟用的規則
  const rules = await db.query.mqlRules.findMany({
    where: eq(mqlRules.isActive, true),
    orderBy: (rules, { desc }) => [desc(rules.priority)],
  });

  // 3. 評估每個規則
  const breakdown: ScoreResult['breakdown'] = {};
  let totalScore = 0;
  let maxPossibleScore = 0;

  for (const rule of rules) {
    const ruleScore = evaluateRule(rule, opportunity);
    breakdown[rule.criteria] = {
      score: ruleScore,
      maxScore: rule.maxScore,
      weight: rule.weight,
    };
    totalScore += ruleScore * rule.weight;
    maxPossibleScore += rule.maxScore * rule.weight;
  }

  // 4. 計算百分比分數
  const percentScore = maxPossibleScore > 0
    ? Math.round((totalScore / maxPossibleScore) * 100)
    : 0;

  // 5. 判斷資格狀態
  const qualificationStatus = determineStatus(percentScore);

  return {
    totalScore: percentScore,
    maxPossibleScore: 100,
    breakdown,
    qualificationStatus,
  };
}

/**
 * 評估單一規則
 */
function evaluateRule(rule: MqlRule, opportunity: any): number {
  const condition = rule.condition as { operator: string; value: any; field?: string } | null;
  if (!condition) return 0;

  const fieldValue = getFieldValue(opportunity, rule.criteria, condition.field);

  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value ? rule.maxScore : 0;
    case 'neq':
      return fieldValue !== condition.value ? rule.maxScore : 0;
    case 'gte':
      return fieldValue >= condition.value ? rule.maxScore : 0;
    case 'lte':
      return fieldValue <= condition.value ? rule.maxScore : 0;
    case 'contains':
      return String(fieldValue).includes(condition.value) ? rule.maxScore : 0;
    case 'exists':
      return fieldValue != null ? rule.maxScore : 0;
    default:
      return 0;
  }
}

/**
 * 取得欄位值
 */
function getFieldValue(opportunity: any, criteria: string, field?: string): any {
  switch (criteria) {
    case 'has_email':
      return opportunity.contactEmail != null;
    case 'has_company':
      return opportunity.companyName != null;
    case 'has_phone':
      return opportunity.contactPhone != null;
    case 'source':
      return opportunity.source;
    case 'utm_campaign':
      return opportunity.utmCampaign;
    case 'custom':
      return field ? opportunity[field] : null;
    default:
      return opportunity[criteria];
  }
}

/**
 * 決定資格狀態
 */
function determineStatus(score: number): 'qualified' | 'not_qualified' | 'needs_review' {
  if (score >= 70) return 'qualified';
  if (score >= 40) return 'needs_review';
  return 'not_qualified';
}
```

**核心邏輯 - `evaluator.ts`**:

```typescript
// packages/services/src/mql/evaluator.ts

import { db } from '@sales_ai_automation_v3/db';
import { mqlEvaluations, opportunities } from '@sales_ai_automation_v3/db/schema';
import { eq } from 'drizzle-orm';
import { calculateMqlScore } from './scoring';

interface EvaluationResult {
  evaluationId: string;
  opportunityId: string;
  score: number;
  status: string;
  isNewlyQualified: boolean;
}

/**
 * 執行 MQL 評估
 */
export async function evaluateMql(
  opportunityId: string,
  triggeredBy: 'auto' | 'manual' | 'webhook' = 'auto'
): Promise<EvaluationResult> {
  // 1. 計算分數
  const scoreResult = await calculateMqlScore(opportunityId);

  // 2. 檢查是否有之前的評估
  const previousEval = await db.query.mqlEvaluations.findFirst({
    where: eq(mqlEvaluations.opportunityId, opportunityId),
    orderBy: (evals, { desc }) => [desc(evals.evaluatedAt)],
  });

  // 3. 儲存評估結果
  const evaluationId = crypto.randomUUID();
  const threshold = 70; // 可配置

  await db.insert(mqlEvaluations).values({
    id: evaluationId,
    opportunityId,
    score: scoreResult.totalScore,
    status: scoreResult.qualificationStatus,
    threshold,
    scoreBreakdown: scoreResult.breakdown,
    triggeredBy,
  });

  // 4. 判斷是否新晉升為 Qualified
  const isNewlyQualified =
    scoreResult.qualificationStatus === 'qualified' &&
    (!previousEval || previousEval.status !== 'qualified');

  // 5. 如果新晉升，觸發通知
  if (isNewlyQualified) {
    await notifyNewMql(opportunityId, scoreResult.totalScore);
  }

  return {
    evaluationId,
    opportunityId,
    score: scoreResult.totalScore,
    status: scoreResult.qualificationStatus,
    isNewlyQualified,
  };
}

/**
 * 通知新 MQL
 */
async function notifyNewMql(opportunityId: string, score: number): Promise<void> {
  // 整合 Alert 系統
  // TODO: 呼叫 Alert service
  console.log(`[MQL] New qualified lead: ${opportunityId} (score: ${score})`);
}

/**
 * 批次評估所有未評估的 Opportunities
 */
export async function evaluateAllPending(): Promise<{
  evaluated: number;
  qualified: number;
  failed: number;
}> {
  // 找出所有沒有評估記錄的 opportunities
  const pending = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .leftJoin(mqlEvaluations, eq(opportunities.id, mqlEvaluations.opportunityId))
    .where(eq(mqlEvaluations.id, null as any));

  let evaluated = 0;
  let qualified = 0;
  let failed = 0;

  for (const opp of pending) {
    try {
      const result = await evaluateMql(opp.id, 'auto');
      evaluated++;
      if (result.status === 'qualified') qualified++;
    } catch (error) {
      console.error(`Failed to evaluate ${opp.id}:`, error);
      failed++;
    }
  }

  return { evaluated, qualified, failed };
}
```

**驗證**:
- [ ] 評分計算正確
- [ ] 規則條件評估正確
- [ ] 狀態判斷正確

---

### Task 3: MQL API 路由

**目標**: 建立 MQL 相關 API

**檔案**: `packages/api/src/routers/mql.ts`

```typescript
// packages/api/src/routers/mql.ts

import { os } from '@orpc/server';
import { z } from 'zod';
import { db } from '@sales_ai_automation_v3/db';
import { mqlEvaluations, mqlRules } from '@sales_ai_automation_v3/db/schema';
import { eq, desc } from 'drizzle-orm';
import { evaluateMql, evaluateAllPending } from '@sales_ai_automation_v3/services/mql/evaluator';
import { calculateMqlScore } from '@sales_ai_automation_v3/services/mql/scoring';

export const mqlRouter = os.router({
  /**
   * 評估單一 Opportunity
   * POST /api/mql/evaluate
   */
  evaluate: os
    .input(z.object({
      opportunityId: z.string(),
    }))
    .handler(async ({ input }) => {
      const result = await evaluateMql(input.opportunityId, 'manual');
      return result;
    }),

  /**
   * 預覽評分（不儲存）
   * POST /api/mql/preview
   */
  preview: os
    .input(z.object({
      opportunityId: z.string(),
    }))
    .handler(async ({ input }) => {
      const result = await calculateMqlScore(input.opportunityId);
      return result;
    }),

  /**
   * 取得評估結果
   * GET /api/mql/:opportunityId
   */
  getByOpportunity: os
    .input(z.object({
      opportunityId: z.string(),
    }))
    .handler(async ({ input }) => {
      const evaluations = await db
        .select()
        .from(mqlEvaluations)
        .where(eq(mqlEvaluations.opportunityId, input.opportunityId))
        .orderBy(desc(mqlEvaluations.evaluatedAt));

      return {
        latest: evaluations[0] || null,
        history: evaluations,
      };
    }),

  /**
   * 批次評估
   * POST /api/mql/evaluate-all
   */
  evaluateAll: os.handler(async () => {
    const result = await evaluateAllPending();
    return result;
  }),

  /**
   * 取得所有規則
   * GET /api/mql/rules
   */
  listRules: os.handler(async () => {
    const rules = await db.select().from(mqlRules);
    return rules;
  }),

  /**
   * 新增規則
   * POST /api/mql/rules
   */
  createRule: os
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      criteria: z.string(),
      weight: z.number().min(1).max(10),
      maxScore: z.number().min(1).max(100),
      condition: z.object({
        operator: z.enum(['eq', 'neq', 'gte', 'lte', 'contains', 'exists']),
        value: z.any(),
        field: z.string().optional(),
      }),
      priority: z.number().optional(),
    }))
    .handler(async ({ input }) => {
      const id = crypto.randomUUID();
      await db.insert(mqlRules).values({
        id,
        ...input,
      });
      return { id };
    }),

  /**
   * 更新規則
   * PUT /api/mql/rules/:id
   */
  updateRule: os
    .input(z.object({
      id: z.string(),
      isActive: z.boolean().optional(),
      weight: z.number().optional(),
      condition: z.any().optional(),
    }))
    .handler(async ({ input }) => {
      const { id, ...updates } = input;
      await db
        .update(mqlRules)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(mqlRules.id, id));
      return { success: true };
    }),
});
```

**驗證**:
- [ ] 評估 API 正常
- [ ] 規則 CRUD 正常
- [ ] 批次評估正常

---

### Task 4: 健康檢查 API

**目標**: 建立系統健康檢查端點

**檔案**: `packages/api/src/routers/health.ts`

```typescript
// packages/api/src/routers/health.ts

import { os } from '@orpc/server';
import { db } from '@sales_ai_automation_v3/db';
import { sql } from 'drizzle-orm';

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  lastChecked: string;
}

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  services: {
    database: ServiceHealth;
    gemini: ServiceHealth;
    groq: ServiceHealth;
    r2: ServiceHealth;
    slack: ServiceHealth;
  };
}

async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return {
      status: 'healthy',
      latency: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkGemini(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    // 簡單的 API 驗證
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${process.env.GEMINI_API_KEY}`
    );
    return {
      status: response.ok ? 'healthy' : 'degraded',
      latency: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkGroq(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
    });
    return {
      status: response.ok ? 'healthy' : 'degraded',
      latency: Date.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkR2(): Promise<ServiceHealth> {
  // R2 健康檢查需要透過 S3 API
  // 簡化版：檢查環境變數是否存在
  const hasConfig = !!(
    process.env.CLOUDFLARE_R2_ACCESS_KEY &&
    process.env.CLOUDFLARE_R2_SECRET_KEY
  );
  return {
    status: hasConfig ? 'healthy' : 'unhealthy',
    error: hasConfig ? undefined : 'R2 credentials not configured',
    lastChecked: new Date().toISOString(),
  };
}

async function checkSlack(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    return {
      status: data.ok ? 'healthy' : 'degraded',
      latency: Date.now() - start,
      error: data.ok ? undefined : data.error,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

const startTime = Date.now();

export const healthRouter = os.router({
  /**
   * 完整健康檢查
   * GET /api/health
   */
  check: os.handler(async (): Promise<HealthCheckResult> => {
    const [database, gemini, groq, r2, slack] = await Promise.all([
      checkDatabase(),
      checkGemini(),
      checkGroq(),
      checkR2(),
      checkSlack(),
    ]);

    const services = { database, gemini, groq, r2, slack };

    // 決定整體狀態
    const statuses = Object.values(services).map((s) => s.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (statuses.some((s) => s === 'unhealthy')) {
      // 如果核心服務（database）不健康，整體為 unhealthy
      overallStatus = database.status === 'unhealthy' ? 'unhealthy' : 'degraded';
    } else if (statuses.some((s) => s === 'degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      version: process.env.APP_VERSION || '3.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      services,
    };
  }),

  /**
   * 簡易存活檢查
   * GET /api/health/live
   */
  live: os.handler(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  /**
   * 就緒檢查（資料庫連線）
   * GET /api/health/ready
   */
  ready: os.handler(async () => {
    const database = await checkDatabase();
    return {
      ready: database.status === 'healthy',
      database: database.status,
    };
  }),
});
```

**驗證**:
- [ ] `/api/health` 回傳所有服務狀態
- [ ] `/api/health/live` 回傳 ok
- [ ] `/api/health/ready` 回傳資料庫狀態

---

### Task 5: Ops 監控服務

**目標**: 建立營運監控與異常通知

**檔案結構**:
```
packages/services/src/ops/
├── index.ts
├── types.ts
├── health-check.ts   # 健康檢查排程
└── monitoring.ts     # 監控與告警
```

**核心邏輯 - `monitoring.ts`**:

```typescript
// packages/services/src/ops/monitoring.ts

interface AlertConfig {
  slackWebhook?: string;
  emailRecipients?: string[];
  thresholds: {
    errorRatePercent: number;
    responseTimeMs: number;
    queueBacklog: number;
  };
}

interface MonitoringMetrics {
  timestamp: Date;
  errorRate: number;
  avgResponseTime: number;
  activeConnections: number;
  pendingAnalyses: number;
}

/**
 * 收集監控指標
 */
export async function collectMetrics(): Promise<MonitoringMetrics> {
  // TODO: 實作指標收集
  return {
    timestamp: new Date(),
    errorRate: 0,
    avgResponseTime: 0,
    activeConnections: 0,
    pendingAnalyses: 0,
  };
}

/**
 * 檢查並發送告警
 */
export async function checkAndAlert(
  metrics: MonitoringMetrics,
  config: AlertConfig
): Promise<void> {
  const alerts: string[] = [];

  if (metrics.errorRate > config.thresholds.errorRatePercent) {
    alerts.push(`Error rate ${metrics.errorRate}% exceeds threshold ${config.thresholds.errorRatePercent}%`);
  }

  if (metrics.avgResponseTime > config.thresholds.responseTimeMs) {
    alerts.push(`Response time ${metrics.avgResponseTime}ms exceeds threshold ${config.thresholds.responseTimeMs}ms`);
  }

  if (metrics.pendingAnalyses > config.thresholds.queueBacklog) {
    alerts.push(`Queue backlog ${metrics.pendingAnalyses} exceeds threshold ${config.thresholds.queueBacklog}`);
  }

  if (alerts.length > 0 && config.slackWebhook) {
    await sendSlackAlert(config.slackWebhook, alerts);
  }
}

/**
 * 發送 Slack 告警
 */
async function sendSlackAlert(webhookUrl: string, alerts: string[]): Promise<void> {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: ':warning: *Sales AI Automation Alert*',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: alerts.map((a) => `• ${a}`).join('\n'),
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Triggered at ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    }),
  });
}
```

**驗證**:
- [ ] 指標收集正常
- [ ] 告警條件判斷正確
- [ ] Slack 通知發送成功

---

## 驗收標準

- [ ] MQL 評分規則可配置
- [ ] 自動評估正確執行
- [ ] `/api/health` 回傳所有服務狀態
- [ ] 異常時 Slack 通知發送
- [ ] 健康檢查延遲 < 2 秒
- [ ] 測試覆蓋率 > 80%

---

## 產出檔案清單

```
packages/db/src/schema/
└── mql.ts

packages/services/src/mql/
├── index.ts
├── types.ts
├── scoring.ts
├── rules.ts
└── evaluator.ts

packages/services/src/ops/
├── index.ts
├── types.ts
├── health-check.ts
└── monitoring.ts

packages/api/src/routers/
├── mql.ts
└── health.ts

tests/services/
├── mql.test.ts
└── health.test.ts
```

---

## 預設 MQL 規則

建議預設以下規則：

| 規則 | 權重 | 條件 | 最高分 |
|------|------|------|--------|
| 有公司名稱 | 3 | exists | 10 |
| 有聯絡 Email | 5 | exists | 10 |
| 有電話 | 2 | exists | 10 |
| 來自 Squarespace | 3 | source = squarespace | 10 |
| 有 UTM Campaign | 2 | utm_campaign exists | 10 |
| 有 MEDDIC 分析 | 5 | meddic_score >= 50 | 20 |

---

## 下一步

完成後：
1. 設定 Slack Webhook 用於告警
2. 與 Agent 4 (Lead Source) 整合，新 Lead 自動評估
3. 設定定時健康檢查（如使用 Cloudflare Cron Triggers）
