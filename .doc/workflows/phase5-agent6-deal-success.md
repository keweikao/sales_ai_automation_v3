# Workflow Instruction: Phase 5 Agent 6 - Deal Onboarding + Customer Success

> **任務類型**: 模組開發
> **預估時間**: 2-3 工作日
> **依賴條件**: Phase 4 完成
> **可並行**: 與 Agent 4, 5, 7 同時開發

---

## 任務目標

建立成交後客戶導入（Onboarding）流程管理和客戶成功（Customer Success）模組，包含任務追蹤、健康度評分和續約管理。

---

## 前置條件

- [ ] Phase 4 部署完成
- [ ] Opportunity schema 已存在（含 `won` 狀態）
- [ ] Alert 系統已建立（Phase 3）
- [ ] Slack Bot 已部署

---

## 任務清單

### Task 1: Onboarding Schema

**目標**: 建立客戶導入任務管理表

**檔案**: `packages/db/src/schema/onboarding.ts`

```typescript
// packages/db/src/schema/onboarding.ts

import { pgTable, text, timestamp, integer, jsonb, boolean } from 'drizzle-orm/pg-core';

/**
 * Onboarding 流程
 */
export const onboardingProcesses = pgTable('onboarding_processes', {
  id: text('id').primaryKey(),
  opportunityId: text('opportunity_id').notNull(),

  // 狀態
  status: text('status').notNull().default('pending'),
  // pending, in_progress, completed, cancelled

  // 進度
  totalTasks: integer('total_tasks').default(0),
  completedTasks: integer('completed_tasks').default(0),
  progress: integer('progress').default(0), // 百分比

  // 負責人
  assignedTo: text('assigned_to'),

  // 時間
  startDate: timestamp('start_date'),
  targetDate: timestamp('target_date'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Onboarding 任務
 */
export const onboardingTasks = pgTable('onboarding_tasks', {
  id: text('id').primaryKey(),
  processId: text('process_id').notNull(),

  // 任務資訊
  title: text('title').notNull(),
  description: text('description'),
  category: text('category'), // setup, training, integration, verification

  // 狀態
  status: text('status').notNull().default('pending'),
  // pending, in_progress, completed, skipped, blocked

  // 排序與依賴
  order: integer('order').default(0),
  dependsOn: jsonb('depends_on'), // 依賴的任務 ID 列表

  // 負責人
  assignedTo: text('assigned_to'),

  // 時間
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),

  // 備註
  notes: text('notes'),
});

/**
 * Onboarding 任務範本
 */
export const onboardingTemplates = pgTable('onboarding_templates', {
  id: text('id').primaryKey(),

  // 範本資訊
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'), // standard, enterprise, quick-start

  // 任務清單
  tasks: jsonb('tasks'), // Array of task definitions

  // 設定
  isDefault: boolean('is_default').default(false),
  estimatedDays: integer('estimated_days'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type OnboardingProcess = typeof onboardingProcesses.$inferSelect;
export type NewOnboardingProcess = typeof onboardingProcesses.$inferInsert;
export type OnboardingTask = typeof onboardingTasks.$inferSelect;
export type NewOnboardingTask = typeof onboardingTasks.$inferInsert;
export type OnboardingTemplate = typeof onboardingTemplates.$inferSelect;
```

**執行**:
```bash
cd packages/db
bun run db:generate
bun run db:push
```

---

### Task 2: Customer Success Schema

**目標**: 建立客戶成功管理表

**檔案**: `packages/db/src/schema/customer-success.ts`

```typescript
// packages/db/src/schema/customer-success.ts

import { pgTable, text, timestamp, integer, jsonb, boolean } from 'drizzle-orm/pg-core';

/**
 * 客戶健康度
 */
export const customerHealth = pgTable('customer_health', {
  id: text('id').primaryKey(),
  opportunityId: text('opportunity_id').notNull(),

  // 健康度評分
  overallScore: integer('overall_score'), // 0-100
  status: text('status'), // healthy, at_risk, critical

  // 評分細項
  usageScore: integer('usage_score'),        // 使用頻率
  engagementScore: integer('engagement_score'), // 互動程度
  supportScore: integer('support_score'),    // 支援工單情況
  paymentScore: integer('payment_score'),    // 付款狀況

  // 風險因子
  riskFactors: jsonb('risk_factors'), // Array of risk descriptions

  // 時間
  evaluatedAt: timestamp('evaluated_at').defaultNow().notNull(),
  nextEvaluationAt: timestamp('next_evaluation_at'),
});

/**
 * 續約追蹤
 */
export const renewals = pgTable('renewals', {
  id: text('id').primaryKey(),
  opportunityId: text('opportunity_id').notNull(),

  // 合約資訊
  contractStartDate: timestamp('contract_start_date'),
  contractEndDate: timestamp('contract_end_date'),
  contractValue: integer('contract_value'), // 金額（分為單位）

  // 續約狀態
  status: text('status').notNull().default('pending'),
  // pending, in_negotiation, renewed, churned, expanded

  // 續約資訊
  renewalDate: timestamp('renewal_date'),
  renewalValue: integer('renewal_value'),
  expansionValue: integer('expansion_value'), // 加購金額

  // 負責人
  assignedTo: text('assigned_to'),

  // 時間
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),

  // 備註
  notes: text('notes'),
});

/**
 * 客戶互動記錄
 */
export const customerInteractions = pgTable('customer_interactions', {
  id: text('id').primaryKey(),
  opportunityId: text('opportunity_id').notNull(),

  // 互動資訊
  type: text('type').notNull(), // meeting, email, call, support_ticket
  subject: text('subject'),
  summary: text('summary'),

  // 情緒分析
  sentiment: text('sentiment'), // positive, neutral, negative

  // 時間
  occurredAt: timestamp('occurred_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),

  // 關聯
  createdBy: text('created_by'),
});

export type CustomerHealth = typeof customerHealth.$inferSelect;
export type NewCustomerHealth = typeof customerHealth.$inferInsert;
export type Renewal = typeof renewals.$inferSelect;
export type NewRenewal = typeof renewals.$inferInsert;
export type CustomerInteraction = typeof customerInteractions.$inferSelect;
```

---

### Task 3: Onboarding 服務

**目標**: 建立客戶導入流程管理服務

**檔案結構**:
```
packages/services/src/deal-onboarding/
├── index.ts
├── types.ts
├── tasks.ts        # 任務管理
├── tracker.ts      # 進度追蹤
├── reminder.ts     # 自動提醒
└── templates.ts    # 任務範本
```

**核心邏輯 - `tasks.ts`**:

```typescript
// packages/services/src/deal-onboarding/tasks.ts

import { db } from '@sales_ai_automation_v3/db';
import {
  onboardingProcesses,
  onboardingTasks,
  onboardingTemplates,
  opportunities,
} from '@sales_ai_automation_v3/db/schema';
import { eq } from 'drizzle-orm';

interface TaskDefinition {
  title: string;
  description?: string;
  category: string;
  order: number;
  dependsOn?: string[];
  estimatedDays?: number;
}

/**
 * 為成交的 Opportunity 建立 Onboarding 流程
 */
export async function createOnboardingProcess(
  opportunityId: string,
  templateId?: string
): Promise<string> {
  // 1. 取得範本
  let template;
  if (templateId) {
    template = await db.query.onboardingTemplates.findFirst({
      where: eq(onboardingTemplates.id, templateId),
    });
  } else {
    // 使用預設範本
    template = await db.query.onboardingTemplates.findFirst({
      where: eq(onboardingTemplates.isDefault, true),
    });
  }

  const taskDefs = (template?.tasks as TaskDefinition[]) || getDefaultTasks();

  // 2. 建立流程
  const processId = crypto.randomUUID();
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + (template?.estimatedDays || 14));

  await db.insert(onboardingProcesses).values({
    id: processId,
    opportunityId,
    status: 'pending',
    totalTasks: taskDefs.length,
    completedTasks: 0,
    progress: 0,
    startDate: new Date(),
    targetDate,
  });

  // 3. 建立任務
  for (const taskDef of taskDefs) {
    await db.insert(onboardingTasks).values({
      id: crypto.randomUUID(),
      processId,
      title: taskDef.title,
      description: taskDef.description,
      category: taskDef.category,
      order: taskDef.order,
      dependsOn: taskDef.dependsOn,
      status: 'pending',
    });
  }

  return processId;
}

/**
 * 更新任務狀態
 */
export async function updateTaskStatus(
  taskId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked'
): Promise<void> {
  const task = await db.query.onboardingTasks.findFirst({
    where: eq(onboardingTasks.id, taskId),
  });

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  // 更新任務
  await db
    .update(onboardingTasks)
    .set({
      status,
      completedAt: status === 'completed' ? new Date() : null,
    })
    .where(eq(onboardingTasks.id, taskId));

  // 更新流程進度
  await updateProcessProgress(task.processId);
}

/**
 * 更新流程進度
 */
async function updateProcessProgress(processId: string): Promise<void> {
  const tasks = await db
    .select()
    .from(onboardingTasks)
    .where(eq(onboardingTasks.processId, processId));

  const completedCount = tasks.filter(
    (t) => t.status === 'completed' || t.status === 'skipped'
  ).length;

  const progress = Math.round((completedCount / tasks.length) * 100);

  await db
    .update(onboardingProcesses)
    .set({
      completedTasks: completedCount,
      progress,
      status: progress === 100 ? 'completed' : 'in_progress',
      completedAt: progress === 100 ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(onboardingProcesses.id, processId));
}

/**
 * 預設任務清單
 */
function getDefaultTasks(): TaskDefinition[] {
  return [
    { title: '歡迎郵件發送', category: 'setup', order: 1 },
    { title: '帳號設定', category: 'setup', order: 2 },
    { title: '初始資料匯入', category: 'setup', order: 3 },
    { title: '系統培訓安排', category: 'training', order: 4 },
    { title: '基礎功能培訓', category: 'training', order: 5, dependsOn: ['4'] },
    { title: '進階功能培訓', category: 'training', order: 6, dependsOn: ['5'] },
    { title: '整合設定', category: 'integration', order: 7 },
    { title: '驗收測試', category: 'verification', order: 8 },
    { title: '正式上線', category: 'verification', order: 9 },
  ];
}
```

**核心邏輯 - `reminder.ts`**:

```typescript
// packages/services/src/deal-onboarding/reminder.ts

import { db } from '@sales_ai_automation_v3/db';
import { onboardingTasks, onboardingProcesses, opportunities } from '@sales_ai_automation_v3/db/schema';
import { eq, and, lte, isNull } from 'drizzle-orm';

interface OverdueTask {
  taskId: string;
  taskTitle: string;
  processId: string;
  opportunityId: string;
  companyName: string;
  dueDate: Date;
  daysOverdue: number;
}

/**
 * 取得逾期任務
 */
export async function getOverdueTasks(): Promise<OverdueTask[]> {
  const now = new Date();

  const overdue = await db
    .select({
      taskId: onboardingTasks.id,
      taskTitle: onboardingTasks.title,
      processId: onboardingTasks.processId,
      dueDate: onboardingTasks.dueDate,
      opportunityId: onboardingProcesses.opportunityId,
      companyName: opportunities.companyName,
    })
    .from(onboardingTasks)
    .innerJoin(
      onboardingProcesses,
      eq(onboardingTasks.processId, onboardingProcesses.id)
    )
    .innerJoin(
      opportunities,
      eq(onboardingProcesses.opportunityId, opportunities.id)
    )
    .where(
      and(
        eq(onboardingTasks.status, 'pending'),
        lte(onboardingTasks.dueDate, now),
        isNull(onboardingTasks.completedAt)
      )
    );

  return overdue.map((t) => ({
    ...t,
    companyName: t.companyName || 'Unknown',
    dueDate: t.dueDate!,
    daysOverdue: Math.ceil((now.getTime() - t.dueDate!.getTime()) / (1000 * 60 * 60 * 24)),
  }));
}

/**
 * 發送逾期提醒（Slack）
 */
export async function sendOverdueReminders(): Promise<number> {
  const overdueTasks = await getOverdueTasks();

  if (overdueTasks.length === 0) {
    return 0;
  }

  // 依負責人分組
  const byAssignee = overdueTasks.reduce((acc, task) => {
    // TODO: 取得任務負責人
    const assignee = 'default';
    if (!acc[assignee]) acc[assignee] = [];
    acc[assignee].push(task);
    return acc;
  }, {} as Record<string, OverdueTask[]>);

  // 發送提醒
  for (const [assignee, tasks] of Object.entries(byAssignee)) {
    await sendSlackReminder(assignee, tasks);
  }

  return overdueTasks.length;
}

async function sendSlackReminder(assignee: string, tasks: OverdueTask[]): Promise<void> {
  // TODO: 整合 Slack 通知
  console.log(`[Onboarding] Sending reminder to ${assignee} for ${tasks.length} overdue tasks`);
}
```

---

### Task 4: Customer Success 服務

**目標**: 建立客戶健康度評估和續約管理

**檔案結構**:
```
packages/services/src/customer-success/
├── index.ts
├── types.ts
├── health-score.ts   # 健康度計算
├── renewal.ts        # 續約管理
└── interactions.ts   # 互動記錄
```

**核心邏輯 - `health-score.ts`**:

```typescript
// packages/services/src/customer-success/health-score.ts

import { db } from '@sales_ai_automation_v3/db';
import {
  customerHealth,
  opportunities,
  conversations,
  customerInteractions,
} from '@sales_ai_automation_v3/db/schema';
import { eq, desc, gte } from 'drizzle-orm';

interface HealthScoreResult {
  overallScore: number;
  status: 'healthy' | 'at_risk' | 'critical';
  usageScore: number;
  engagementScore: number;
  supportScore: number;
  paymentScore: number;
  riskFactors: string[];
}

/**
 * 計算客戶健康度
 */
export async function calculateHealthScore(
  opportunityId: string
): Promise<HealthScoreResult> {
  // 1. 取得客戶資料
  const opportunity = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, opportunityId),
  });

  if (!opportunity) {
    throw new Error(`Opportunity ${opportunityId} not found`);
  }

  // 2. 計算各維度分數
  const usageScore = await calculateUsageScore(opportunityId);
  const engagementScore = await calculateEngagementScore(opportunityId);
  const supportScore = await calculateSupportScore(opportunityId);
  const paymentScore = 100; // TODO: 整合付款系統

  // 3. 計算總分（加權平均）
  const weights = {
    usage: 0.3,
    engagement: 0.3,
    support: 0.2,
    payment: 0.2,
  };

  const overallScore = Math.round(
    usageScore * weights.usage +
    engagementScore * weights.engagement +
    supportScore * weights.support +
    paymentScore * weights.payment
  );

  // 4. 判斷狀態
  let status: 'healthy' | 'at_risk' | 'critical';
  if (overallScore >= 70) status = 'healthy';
  else if (overallScore >= 40) status = 'at_risk';
  else status = 'critical';

  // 5. 識別風險因子
  const riskFactors: string[] = [];
  if (usageScore < 50) riskFactors.push('低使用頻率');
  if (engagementScore < 50) riskFactors.push('互動減少');
  if (supportScore < 50) riskFactors.push('支援問題較多');

  return {
    overallScore,
    status,
    usageScore,
    engagementScore,
    supportScore,
    paymentScore,
    riskFactors,
  };
}

/**
 * 計算使用頻率分數
 */
async function calculateUsageScore(opportunityId: string): Promise<number> {
  // 基於最近 30 天的對話數量
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentConversations = await db
    .select()
    .from(conversations)
    .where(
      eq(conversations.opportunityId, opportunityId)
    );

  const recentCount = recentConversations.filter(
    (c) => c.createdAt && c.createdAt >= thirtyDaysAgo
  ).length;

  // 評分邏輯：0-2 次 = 低，3-5 次 = 中，6+ 次 = 高
  if (recentCount >= 6) return 100;
  if (recentCount >= 3) return 70;
  if (recentCount >= 1) return 40;
  return 20;
}

/**
 * 計算互動程度分數
 */
async function calculateEngagementScore(opportunityId: string): Promise<number> {
  // 基於最近 30 天的互動記錄
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentInteractions = await db
    .select()
    .from(customerInteractions)
    .where(
      eq(customerInteractions.opportunityId, opportunityId)
    );

  const recentCount = recentInteractions.filter(
    (i) => i.occurredAt >= thirtyDaysAgo
  ).length;

  // 檢查互動情緒
  const positiveCount = recentInteractions.filter(
    (i) => i.sentiment === 'positive'
  ).length;

  const sentimentBonus = recentCount > 0
    ? Math.round((positiveCount / recentCount) * 20)
    : 0;

  // 基礎分數
  let baseScore = 50;
  if (recentCount >= 5) baseScore = 80;
  else if (recentCount >= 2) baseScore = 60;
  else if (recentCount === 0) baseScore = 30;

  return Math.min(100, baseScore + sentimentBonus);
}

/**
 * 計算支援分數
 */
async function calculateSupportScore(opportunityId: string): Promise<number> {
  // TODO: 整合支援工單系統
  // 暫時返回預設分數
  return 80;
}

/**
 * 儲存健康度評估
 */
export async function saveHealthEvaluation(
  opportunityId: string,
  result: HealthScoreResult
): Promise<string> {
  const id = crypto.randomUUID();
  const nextEvaluation = new Date();
  nextEvaluation.setDate(nextEvaluation.getDate() + 7); // 每 7 天重新評估

  await db.insert(customerHealth).values({
    id,
    opportunityId,
    overallScore: result.overallScore,
    status: result.status,
    usageScore: result.usageScore,
    engagementScore: result.engagementScore,
    supportScore: result.supportScore,
    paymentScore: result.paymentScore,
    riskFactors: result.riskFactors,
    nextEvaluationAt: nextEvaluation,
  });

  return id;
}
```

**核心邏輯 - `renewal.ts`**:

```typescript
// packages/services/src/customer-success/renewal.ts

import { db } from '@sales_ai_automation_v3/db';
import { renewals, opportunities } from '@sales_ai_automation_v3/db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';

interface UpcomingRenewal {
  renewalId: string;
  opportunityId: string;
  companyName: string;
  contractEndDate: Date;
  daysUntilExpiry: number;
  contractValue: number;
  status: string;
}

/**
 * 取得即將到期的續約
 */
export async function getUpcomingRenewals(daysAhead: number = 30): Promise<UpcomingRenewal[]> {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const upcoming = await db
    .select({
      renewalId: renewals.id,
      opportunityId: renewals.opportunityId,
      contractEndDate: renewals.contractEndDate,
      contractValue: renewals.contractValue,
      status: renewals.status,
      companyName: opportunities.companyName,
    })
    .from(renewals)
    .innerJoin(opportunities, eq(renewals.opportunityId, opportunities.id))
    .where(
      and(
        gte(renewals.contractEndDate, now),
        lte(renewals.contractEndDate, futureDate),
        eq(renewals.status, 'pending')
      )
    );

  return upcoming.map((r) => ({
    ...r,
    companyName: r.companyName || 'Unknown',
    contractEndDate: r.contractEndDate!,
    contractValue: r.contractValue || 0,
    daysUntilExpiry: Math.ceil(
      (r.contractEndDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));
}

/**
 * 建立續約記錄
 */
export async function createRenewal(
  opportunityId: string,
  contractStartDate: Date,
  contractEndDate: Date,
  contractValue: number
): Promise<string> {
  const id = crypto.randomUUID();

  await db.insert(renewals).values({
    id,
    opportunityId,
    contractStartDate,
    contractEndDate,
    contractValue,
    status: 'pending',
  });

  return id;
}

/**
 * 更新續約狀態
 */
export async function updateRenewalStatus(
  renewalId: string,
  status: 'renewed' | 'churned' | 'expanded',
  renewalValue?: number,
  expansionValue?: number
): Promise<void> {
  await db
    .update(renewals)
    .set({
      status,
      renewalDate: new Date(),
      renewalValue,
      expansionValue,
      updatedAt: new Date(),
    })
    .where(eq(renewals.id, renewalId));
}
```

---

### Task 5: API 路由

**目標**: 建立 Onboarding 和 Customer Success API

**檔案**: `packages/api/src/routers/onboarding.ts`

```typescript
// packages/api/src/routers/onboarding.ts

import { os } from '@orpc/server';
import { z } from 'zod';
import { db } from '@sales_ai_automation_v3/db';
import { onboardingProcesses, onboardingTasks } from '@sales_ai_automation_v3/db/schema';
import { eq, desc } from 'drizzle-orm';
import {
  createOnboardingProcess,
  updateTaskStatus,
} from '@sales_ai_automation_v3/services/deal-onboarding/tasks';

export const onboardingRouter = os.router({
  /**
   * 建立 Onboarding 流程
   */
  create: os
    .input(z.object({
      opportunityId: z.string(),
      templateId: z.string().optional(),
    }))
    .handler(async ({ input }) => {
      const processId = await createOnboardingProcess(
        input.opportunityId,
        input.templateId
      );
      return { processId };
    }),

  /**
   * 取得流程詳情
   */
  getProcess: os
    .input(z.object({ processId: z.string() }))
    .handler(async ({ input }) => {
      const process = await db.query.onboardingProcesses.findFirst({
        where: eq(onboardingProcesses.id, input.processId),
      });

      const tasks = await db
        .select()
        .from(onboardingTasks)
        .where(eq(onboardingTasks.processId, input.processId))
        .orderBy(onboardingTasks.order);

      return { process, tasks };
    }),

  /**
   * 取得 Opportunity 的 Onboarding
   */
  getByOpportunity: os
    .input(z.object({ opportunityId: z.string() }))
    .handler(async ({ input }) => {
      const process = await db.query.onboardingProcesses.findFirst({
        where: eq(onboardingProcesses.opportunityId, input.opportunityId),
        orderBy: desc(onboardingProcesses.createdAt),
      });

      if (!process) return null;

      const tasks = await db
        .select()
        .from(onboardingTasks)
        .where(eq(onboardingTasks.processId, process.id))
        .orderBy(onboardingTasks.order);

      return { process, tasks };
    }),

  /**
   * 更新任務狀態
   */
  updateTask: os
    .input(z.object({
      taskId: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed', 'skipped', 'blocked']),
    }))
    .handler(async ({ input }) => {
      await updateTaskStatus(input.taskId, input.status);
      return { success: true };
    }),

  /**
   * 列出所有進行中的 Onboarding
   */
  listActive: os.handler(async () => {
    const active = await db
      .select()
      .from(onboardingProcesses)
      .where(eq(onboardingProcesses.status, 'in_progress'));

    return active;
  }),
});
```

**檔案**: `packages/api/src/routers/customer-success.ts`

```typescript
// packages/api/src/routers/customer-success.ts

import { os } from '@orpc/server';
import { z } from 'zod';
import { db } from '@sales_ai_automation_v3/db';
import { customerHealth, renewals } from '@sales_ai_automation_v3/db/schema';
import { eq, desc } from 'drizzle-orm';
import {
  calculateHealthScore,
  saveHealthEvaluation,
} from '@sales_ai_automation_v3/services/customer-success/health-score';
import {
  getUpcomingRenewals,
  updateRenewalStatus,
} from '@sales_ai_automation_v3/services/customer-success/renewal';

export const customerSuccessRouter = os.router({
  /**
   * 計算並儲存健康度
   */
  evaluateHealth: os
    .input(z.object({ opportunityId: z.string() }))
    .handler(async ({ input }) => {
      const result = await calculateHealthScore(input.opportunityId);
      const healthId = await saveHealthEvaluation(input.opportunityId, result);
      return { healthId, ...result };
    }),

  /**
   * 取得健康度歷史
   */
  getHealthHistory: os
    .input(z.object({ opportunityId: z.string() }))
    .handler(async ({ input }) => {
      const history = await db
        .select()
        .from(customerHealth)
        .where(eq(customerHealth.opportunityId, input.opportunityId))
        .orderBy(desc(customerHealth.evaluatedAt))
        .limit(10);

      return history;
    }),

  /**
   * 取得即將到期的續約
   */
  upcomingRenewals: os
    .input(z.object({
      daysAhead: z.number().default(30),
    }).optional())
    .handler(async ({ input }) => {
      const renewals = await getUpcomingRenewals(input?.daysAhead || 30);
      return renewals;
    }),

  /**
   * 更新續約狀態
   */
  updateRenewal: os
    .input(z.object({
      renewalId: z.string(),
      status: z.enum(['renewed', 'churned', 'expanded']),
      renewalValue: z.number().optional(),
      expansionValue: z.number().optional(),
    }))
    .handler(async ({ input }) => {
      await updateRenewalStatus(
        input.renewalId,
        input.status,
        input.renewalValue,
        input.expansionValue
      );
      return { success: true };
    }),

  /**
   * 取得 at-risk 客戶列表
   */
  atRiskCustomers: os.handler(async () => {
    const atRisk = await db
      .select()
      .from(customerHealth)
      .where(eq(customerHealth.status, 'at_risk'))
      .orderBy(desc(customerHealth.evaluatedAt));

    // 去重，只保留每個客戶最新的評估
    const latestByOpportunity = new Map();
    for (const h of atRisk) {
      if (!latestByOpportunity.has(h.opportunityId)) {
        latestByOpportunity.set(h.opportunityId, h);
      }
    }

    return Array.from(latestByOpportunity.values());
  }),
});
```

---

### Task 6: 前端頁面

**目標**: 建立 Onboarding 和 Customer Success UI

**檔案結構**:
```
apps/web/src/routes/
├── onboarding/
│   └── index.tsx       # Onboarding 任務列表
└── customer-success/
    └── index.tsx       # 客戶健康度 Dashboard
```

**Onboarding 頁面重點**:
- 任務清單（拖曳排序）
- 進度條顯示
- 任務狀態切換
- 逾期任務高亮

**Customer Success 頁面重點**:
- 健康度儀表板
- At-risk 客戶列表
- 即將續約客戶
- 健康度趨勢圖

---

## 驗收標準

- [ ] 成交後自動建立 Onboarding 任務
- [ ] 任務進度正確追蹤
- [ ] 逾期任務自動提醒（Slack）
- [ ] 健康度評分正確計算
- [ ] 續約追蹤正常運作
- [ ] At-risk 客戶列表正確
- [ ] 測試覆蓋率 > 80%

---

## 產出檔案清單

```
packages/db/src/schema/
├── onboarding.ts
└── customer-success.ts

packages/services/src/deal-onboarding/
├── index.ts
├── types.ts
├── tasks.ts
├── tracker.ts
├── reminder.ts
└── templates.ts

packages/services/src/customer-success/
├── index.ts
├── types.ts
├── health-score.ts
├── renewal.ts
└── interactions.ts

packages/api/src/routers/
├── onboarding.ts
└── customer-success.ts

apps/web/src/routes/
├── onboarding/
│   └── index.tsx
└── customer-success/
    └── index.tsx

tests/services/
├── onboarding.test.ts
└── customer-success.test.ts
```

---

## 自動化觸發點

| 觸發事件 | 動作 |
|----------|------|
| Opportunity 狀態變為 `won` | 自動建立 Onboarding 流程 |
| Onboarding 完成 | 建立續約記錄 |
| 任務逾期 | 發送 Slack 提醒 |
| 健康度低於 40 | 發送 Alert |
| 續約到期前 30 天 | 發送提醒 |

---

## 下一步

完成後：
1. 設定自動觸發（Opportunity → Onboarding）
2. 設定排程任務（健康度定期評估）
3. 與 Alert 系統整合
4. 設定 Slack 提醒頻道
