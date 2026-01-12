# Workflow Instruction: Phase 5 Agent 7 - Workflow 執行引擎

> **任務類型**: 核心引擎開發
> **預估時間**: 3 工作日
> **依賴條件**: Phase 4 完成
> **可並行**: 與 Agent 4, 5, 6 同時開發

---

## 任務目標

建立可配置的業務流程執行引擎，支援動態 Agent 編排、條件式分支、品質迴圈，取代目前硬編碼的 MEDDIC Orchestrator。

---

## 設計目標

1. **可配置性**: 使用 YAML 定義 Workflow，無需修改程式碼
2. **靈活性**: 支援並行執行、條件分支、品質迴圈
3. **可追蹤性**: 完整的執行歷史記錄
4. **向後相容**: MEDDIC 分析結果與原 Orchestrator 一致

---

## 前置條件

- [ ] Phase 4 部署完成
- [ ] MEDDIC Orchestrator 已存在且運作正常
- [ ] 所有 6 個 AI Agent prompts 已就緒

---

## 任務清單

### Task 1: Workflow Schema

**目標**: 建立 Workflow 執行歷史記錄表

**檔案**: `packages/db/src/schema/workflow.ts`

```typescript
// packages/db/src/schema/workflow.ts

import { pgTable, text, timestamp, integer, jsonb, boolean } from 'drizzle-orm/pg-core';

/**
 * Workflow 執行記錄
 */
export const workflowExecutions = pgTable('workflow_executions', {
  id: text('id').primaryKey(),

  // Workflow 識別
  workflowName: text('workflow_name').notNull(),
  workflowVersion: text('workflow_version').notNull(),

  // 關聯
  conversationId: text('conversation_id'),
  opportunityId: text('opportunity_id'),

  // 狀態
  status: text('status').notNull().default('pending'),
  // pending, running, completed, failed, cancelled

  // 輸入/輸出
  input: jsonb('input'),
  output: jsonb('output'),
  error: text('error'),

  // 執行統計
  totalSteps: integer('total_steps').default(0),
  completedSteps: integer('completed_steps').default(0),
  failedSteps: integer('failed_steps').default(0),

  // 時間
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  duration: integer('duration'), // 毫秒

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Workflow 步驟執行記錄
 */
export const workflowStepExecutions = pgTable('workflow_step_executions', {
  id: text('id').primaryKey(),
  executionId: text('execution_id').notNull(),

  // 步驟識別
  stepId: text('step_id').notNull(),
  stepName: text('step_name'),
  agentName: text('agent_name'),

  // 狀態
  status: text('status').notNull().default('pending'),
  // pending, running, completed, failed, skipped, retrying

  // 執行資訊
  attempt: integer('attempt').default(1),
  input: jsonb('input'),
  output: jsonb('output'),
  error: text('error'),

  // 品質迴圈
  isRefinement: boolean('is_refinement').default(false),
  refinementReason: text('refinement_reason'),

  // 時間
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  duration: integer('duration'), // 毫秒

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type NewWorkflowExecution = typeof workflowExecutions.$inferInsert;
export type WorkflowStepExecution = typeof workflowStepExecutions.$inferSelect;
export type NewWorkflowStepExecution = typeof workflowStepExecutions.$inferInsert;
```

**執行**:
```bash
cd packages/db
bun run db:generate
bun run db:push
```

---

### Task 2: Workflow 結構定義

**目標**: 定義 Workflow YAML 結構和驗證 schema

**檔案**: `packages/services/src/workflow/schema.ts`

```typescript
// packages/services/src/workflow/schema.ts

import { z } from 'zod';

/**
 * 步驟條件定義
 */
const StepConditionSchema = z.object({
  expression: z.string(), // JavaScript 表達式
  // 或使用結構化條件
  field: z.string().optional(),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'exists']).optional(),
  value: z.any().optional(),
});

/**
 * 品質迴圈設定
 */
const QualityLoopSchema = z.object({
  maxAttempts: z.number().min(1).max(5).default(2),
  condition: z.string(), // 品質檢查表達式
});

/**
 * 重試設定
 */
const RetryConfigSchema = z.object({
  maxAttempts: z.number().min(1).max(5).default(3),
  backoff: z.enum(['fixed', 'exponential']).default('exponential'),
  initialDelay: z.number().default(1000), // 毫秒
});

/**
 * 步驟定義
 */
const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string().optional(),

  // Agent 設定
  agent: z.string(), // Agent 名稱
  prompt: z.string().optional(), // 覆蓋預設 prompt

  // 執行控制
  dependsOn: z.array(z.string()).optional(), // 依賴的步驟 ID
  parallelWith: z.string().optional(), // 與哪個步驟並行
  condition: z.union([z.string(), StepConditionSchema]).optional(), // 條件式執行
  optional: z.boolean().default(false), // 是否可跳過

  // 品質控制
  qualityLoop: QualityLoopSchema.optional(),

  // 重試
  retry: RetryConfigSchema.optional(),

  // 超時
  timeout: z.number().default(60000), // 毫秒
});

/**
 * 輸出組合定義
 */
const OutputCompositionSchema = z.object({
  from: z.string(), // 步驟 ID
  fields: z.array(z.string()), // 要提取的欄位
  rename: z.record(z.string()).optional(), // 欄位重命名
});

/**
 * Workflow 定義
 */
export const WorkflowDefinitionSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),

  // 全域設定
  config: z.object({
    timeout: z.number().default(300000), // 5 分鐘
    retry: RetryConfigSchema.optional(),
  }).optional(),

  // 輸入 schema
  input: z.object({
    type: z.string(),
    schema: z.any().optional(), // Zod schema 或 JSON Schema
  }).optional(),

  // 步驟定義
  steps: z.array(WorkflowStepSchema),

  // 輸出組合
  output: z.object({
    type: z.string(),
    compose: z.array(OutputCompositionSchema),
  }).optional(),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type QualityLoop = z.infer<typeof QualityLoopSchema>;
```

---

### Task 3: Workflow 載入器

**目標**: 從檔案載入和快取 Workflow 定義

**檔案**: `packages/services/src/workflow/loader.ts`

```typescript
// packages/services/src/workflow/loader.ts

import { parse as parseYaml } from 'yaml';
import { WorkflowDefinitionSchema, type WorkflowDefinition } from './schema';

// 快取
const workflowCache = new Map<string, {
  definition: WorkflowDefinition;
  loadedAt: Date;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘

/**
 * 載入 Workflow 定義
 */
export async function loadWorkflow(name: string): Promise<WorkflowDefinition> {
  // 檢查快取
  const cached = workflowCache.get(name);
  if (cached && Date.now() - cached.loadedAt.getTime() < CACHE_TTL) {
    return cached.definition;
  }

  // 載入檔案
  const filePath = `workflows/${name}.yaml`;
  let content: string;

  try {
    // 在 Cloudflare Workers 環境，需要使用不同的方式讀取
    if (typeof Bun !== 'undefined') {
      const file = Bun.file(filePath);
      content = await file.text();
    } else {
      // Workers 環境：從 KV 或 R2 讀取
      // 或使用內嵌的 workflow 定義
      content = await loadFromStorage(name);
    }
  } catch (error) {
    throw new Error(`Failed to load workflow '${name}': ${error}`);
  }

  // 解析 YAML
  const raw = parseYaml(content);

  // 驗證 schema
  const result = WorkflowDefinitionSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid workflow definition: ${result.error.message}`);
  }

  const definition = result.data;

  // 更新快取
  workflowCache.set(name, {
    definition,
    loadedAt: new Date(),
  });

  return definition;
}

/**
 * 從儲存載入（用於 Workers 環境）
 */
async function loadFromStorage(name: string): Promise<string> {
  // 內嵌的 workflow 定義
  const builtInWorkflows: Record<string, string> = {
    'meddic-analysis': MEDDIC_WORKFLOW_YAML,
  };

  if (builtInWorkflows[name]) {
    return builtInWorkflows[name];
  }

  throw new Error(`Workflow '${name}' not found`);
}

/**
 * 清除快取
 */
export function clearWorkflowCache(name?: string): void {
  if (name) {
    workflowCache.delete(name);
  } else {
    workflowCache.clear();
  }
}

/**
 * 列出所有可用的 Workflows
 */
export function listWorkflows(): string[] {
  return ['meddic-analysis']; // 可擴展
}

// MEDDIC Workflow 定義（內嵌）
const MEDDIC_WORKFLOW_YAML = `
name: meddic-analysis
version: "1.0"
description: MEDDIC 對話分析七階段流程

config:
  timeout: 300000
  retry:
    maxAttempts: 3
    backoff: exponential

steps:
  - id: context-analysis
    name: 會議背景分析
    agent: agent1-context
    parallelWith: buyer-analysis
    timeout: 60000

  - id: buyer-analysis
    name: MEDDIC 核心分析
    agent: agent2-buyer
    parallelWith: context-analysis
    qualityLoop:
      maxAttempts: 2
      condition: |
        output.needs_identified &&
        output.pain_points?.length > 0 &&
        output.meddic_scores &&
        output.trust_assessment

  - id: competitor-check
    name: 競爭對手分析
    agent: competitor-agent
    condition: |
      context.transcript.some(t =>
        ['競爭對手', 'competitor', '其他廠商'].some(kw =>
          t.text.includes(kw)
        )
      )
    optional: true
    dependsOn: [context-analysis]

  - id: seller-analysis
    name: 銷售策略評估
    agent: agent3-seller
    dependsOn: [context-analysis, buyer-analysis]

  - id: summary
    name: 客戶導向摘要
    agent: agent4-summary
    dependsOn: [seller-analysis]

  - id: crm-extraction
    name: CRM 欄位提取
    agent: agent5-crm-extractor
    dependsOn: [summary]

  - id: coaching
    name: 即時教練建議
    agent: agent6-coach
    dependsOn: [crm-extraction]

output:
  type: meddic-result
  compose:
    - from: buyer-analysis
      fields: [meddic_scores, pain_points, trust_assessment, needs_identified]
    - from: summary
      fields: [executive_summary]
    - from: crm-extraction
      fields: [salesforce_data]
    - from: coaching
      fields: [recommendations, alerts]
`;
```

---

### Task 4: Workflow 執行器（核心）

**目標**: 實作 Workflow 執行引擎

**檔案**: `packages/services/src/workflow/executor.ts`

```typescript
// packages/services/src/workflow/executor.ts

import { db } from '@sales_ai_automation_v3/db';
import { workflowExecutions, workflowStepExecutions } from '@sales_ai_automation_v3/db/schema';
import { eq } from 'drizzle-orm';
import { loadWorkflow } from './loader';
import { evaluateCondition } from './conditions';
import { runAgent } from '../llm/orchestrator';
import type { WorkflowDefinition, WorkflowStep } from './schema';

interface ExecutionContext {
  executionId: string;
  input: any;
  stepOutputs: Map<string, any>;
  transcript: any[];
  metadata: any;
}

interface ExecutionResult {
  executionId: string;
  status: 'completed' | 'failed';
  output: any;
  error?: string;
  duration: number;
}

/**
 * 執行 Workflow
 */
export async function executeWorkflow(
  workflowName: string,
  input: any
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // 1. 載入 Workflow 定義
  const workflow = await loadWorkflow(workflowName);

  // 2. 建立執行記錄
  const executionId = crypto.randomUUID();
  await db.insert(workflowExecutions).values({
    id: executionId,
    workflowName: workflow.name,
    workflowVersion: workflow.version,
    conversationId: input.conversationId,
    opportunityId: input.opportunityId,
    status: 'running',
    input,
    totalSteps: workflow.steps.length,
    startedAt: new Date(),
  });

  // 3. 建立執行上下文
  const context: ExecutionContext = {
    executionId,
    input,
    stepOutputs: new Map(),
    transcript: input.transcript || [],
    metadata: input.metadata || {},
  };

  try {
    // 4. 執行步驟
    await executeSteps(workflow, context);

    // 5. 組合輸出
    const output = composeOutput(workflow, context);

    // 6. 更新執行記錄
    const duration = Date.now() - startTime;
    await db
      .update(workflowExecutions)
      .set({
        status: 'completed',
        output,
        completedSteps: workflow.steps.length,
        completedAt: new Date(),
        duration,
      })
      .where(eq(workflowExecutions.id, executionId));

    return {
      executionId,
      status: 'completed',
      output,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    await db
      .update(workflowExecutions)
      .set({
        status: 'failed',
        error: errorMessage,
        completedAt: new Date(),
        duration,
      })
      .where(eq(workflowExecutions.id, executionId));

    return {
      executionId,
      status: 'failed',
      output: null,
      error: errorMessage,
      duration,
    };
  }
}

/**
 * 執行步驟（支援並行和依賴）
 */
async function executeSteps(
  workflow: WorkflowDefinition,
  context: ExecutionContext
): Promise<void> {
  const steps = workflow.steps;
  const completed = new Set<string>();
  const running = new Map<string, Promise<void>>();

  // 建立依賴圖
  const dependencyGraph = buildDependencyGraph(steps);

  while (completed.size < steps.length) {
    // 找出可執行的步驟（所有依賴都已完成）
    const ready = steps.filter((step) => {
      if (completed.has(step.id)) return false;
      if (running.has(step.id)) return false;

      const deps = dependencyGraph.get(step.id) || [];
      return deps.every((dep) => completed.has(dep));
    });

    if (ready.length === 0 && running.size === 0) {
      throw new Error('Workflow stuck: no ready steps and no running steps');
    }

    // 啟動可執行的步驟
    for (const step of ready) {
      const promise = executeStep(step, context, workflow)
        .then(() => {
          completed.add(step.id);
          running.delete(step.id);
        })
        .catch((error) => {
          running.delete(step.id);
          if (!step.optional) {
            throw error;
          }
          // 可選步驟失敗時標記為跳過
          completed.add(step.id);
        });

      running.set(step.id, promise);

      // 如果有並行步驟，同時啟動
      if (step.parallelWith) {
        const parallelStep = steps.find((s) => s.id === step.parallelWith);
        if (parallelStep && !completed.has(parallelStep.id) && !running.has(parallelStep.id)) {
          const parallelPromise = executeStep(parallelStep, context, workflow)
            .then(() => {
              completed.add(parallelStep.id);
              running.delete(parallelStep.id);
            });
          running.set(parallelStep.id, parallelPromise);
        }
      }
    }

    // 等待至少一個步驟完成
    if (running.size > 0) {
      await Promise.race(Array.from(running.values()));
    }
  }
}

/**
 * 執行單一步驟
 */
async function executeStep(
  step: WorkflowStep,
  context: ExecutionContext,
  workflow: WorkflowDefinition
): Promise<void> {
  const startTime = Date.now();

  // 建立步驟執行記錄
  const stepExecutionId = crypto.randomUUID();
  await db.insert(workflowStepExecutions).values({
    id: stepExecutionId,
    executionId: context.executionId,
    stepId: step.id,
    stepName: step.name,
    agentName: step.agent,
    status: 'running',
    startedAt: new Date(),
  });

  try {
    // 1. 檢查條件
    if (step.condition) {
      const shouldRun = await evaluateCondition(step.condition, {
        context,
        stepOutputs: Object.fromEntries(context.stepOutputs),
      });

      if (!shouldRun) {
        await db
          .update(workflowStepExecutions)
          .set({
            status: 'skipped',
            completedAt: new Date(),
            duration: Date.now() - startTime,
          })
          .where(eq(workflowStepExecutions.id, stepExecutionId));
        return;
      }
    }

    // 2. 準備輸入
    const stepInput = prepareStepInput(step, context);

    // 3. 執行 Agent
    let output = await runAgentWithRetry(step, stepInput, workflow.config?.retry);

    // 4. 品質迴圈
    if (step.qualityLoop) {
      let attempts = 0;
      while (attempts < step.qualityLoop.maxAttempts) {
        const passed = await evaluateCondition(step.qualityLoop.condition, {
          output,
          context,
        });

        if (passed) break;

        attempts++;
        // 記錄 refinement
        await db.insert(workflowStepExecutions).values({
          id: crypto.randomUUID(),
          executionId: context.executionId,
          stepId: step.id,
          stepName: `${step.name} (Refinement ${attempts})`,
          agentName: step.agent,
          status: 'running',
          isRefinement: true,
          refinementReason: 'Quality check failed',
          startedAt: new Date(),
        });

        output = await runAgentWithRetry(step, { ...stepInput, previousOutput: output }, workflow.config?.retry);
      }
    }

    // 5. 儲存輸出
    context.stepOutputs.set(step.id, output);

    // 6. 更新記錄
    await db
      .update(workflowStepExecutions)
      .set({
        status: 'completed',
        output,
        completedAt: new Date(),
        duration: Date.now() - startTime,
      })
      .where(eq(workflowStepExecutions.id, stepExecutionId));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await db
      .update(workflowStepExecutions)
      .set({
        status: 'failed',
        error: errorMessage,
        completedAt: new Date(),
        duration: Date.now() - startTime,
      })
      .where(eq(workflowStepExecutions.id, stepExecutionId));

    throw error;
  }
}

/**
 * 建立依賴圖
 */
function buildDependencyGraph(steps: WorkflowStep[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const step of steps) {
    const deps = step.dependsOn || [];
    graph.set(step.id, deps);
  }

  return graph;
}

/**
 * 準備步驟輸入
 */
function prepareStepInput(step: WorkflowStep, context: ExecutionContext): any {
  // 收集依賴步驟的輸出
  const dependencyOutputs: Record<string, any> = {};

  if (step.dependsOn) {
    for (const depId of step.dependsOn) {
      dependencyOutputs[depId] = context.stepOutputs.get(depId);
    }
  }

  return {
    transcript: context.transcript,
    metadata: context.metadata,
    ...context.input,
    dependencyOutputs,
  };
}

/**
 * 帶重試的 Agent 執行
 */
async function runAgentWithRetry(
  step: WorkflowStep,
  input: any,
  globalRetry?: any
): Promise<any> {
  const retryConfig = step.retry || globalRetry || { maxAttempts: 3, backoff: 'exponential' };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      return await runAgent(step.agent, input);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retryConfig.maxAttempts) {
        const delay = retryConfig.backoff === 'exponential'
          ? retryConfig.initialDelay * Math.pow(2, attempt - 1)
          : retryConfig.initialDelay;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * 組合最終輸出
 */
function composeOutput(workflow: WorkflowDefinition, context: ExecutionContext): any {
  if (!workflow.output?.compose) {
    // 返回所有步驟輸出
    return Object.fromEntries(context.stepOutputs);
  }

  const result: any = {};

  for (const composition of workflow.output.compose) {
    const stepOutput = context.stepOutputs.get(composition.from);
    if (!stepOutput) continue;

    for (const field of composition.fields) {
      const targetField = composition.rename?.[field] || field;
      result[targetField] = stepOutput[field];
    }
  }

  return result;
}
```

---

### Task 5: 條件評估器

**目標**: 安全地評估條件表達式

**檔案**: `packages/services/src/workflow/conditions.ts`

```typescript
// packages/services/src/workflow/conditions.ts

/**
 * 評估條件表達式
 */
export async function evaluateCondition(
  condition: string | { expression?: string; field?: string; operator?: string; value?: any },
  context: any
): Promise<boolean> {
  if (typeof condition === 'string') {
    return evaluateExpression(condition, context);
  }

  if (condition.expression) {
    return evaluateExpression(condition.expression, context);
  }

  if (condition.field && condition.operator) {
    return evaluateFieldCondition(condition, context);
  }

  return true;
}

/**
 * 評估 JavaScript 表達式（安全沙箱）
 */
function evaluateExpression(expression: string, context: any): boolean {
  try {
    // 建立安全的評估環境
    const safeContext = {
      output: context.output,
      context: context.context,
      stepOutputs: context.stepOutputs,
      // 安全的輔助函數
      some: (arr: any[], fn: (item: any) => boolean) => arr?.some(fn) ?? false,
      every: (arr: any[], fn: (item: any) => boolean) => arr?.every(fn) ?? false,
      includes: (arr: any[], item: any) => arr?.includes(item) ?? false,
      length: (arr: any[]) => arr?.length ?? 0,
    };

    // 使用 Function 建構子執行（比 eval 稍安全）
    const fn = new Function(
      ...Object.keys(safeContext),
      `return (${expression})`
    );

    return !!fn(...Object.values(safeContext));
  } catch (error) {
    console.error(`Failed to evaluate expression: ${expression}`, error);
    return false;
  }
}

/**
 * 評估欄位條件
 */
function evaluateFieldCondition(
  condition: { field?: string; operator?: string; value?: any },
  context: any
): boolean {
  const fieldValue = getNestedValue(context, condition.field!);

  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value;
    case 'neq':
      return fieldValue !== condition.value;
    case 'gt':
      return fieldValue > condition.value;
    case 'gte':
      return fieldValue >= condition.value;
    case 'lt':
      return fieldValue < condition.value;
    case 'lte':
      return fieldValue <= condition.value;
    case 'contains':
      return String(fieldValue).includes(condition.value);
    case 'exists':
      return fieldValue != null;
    default:
      return false;
  }
}

/**
 * 取得巢狀屬性值
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
```

---

### Task 6: 執行歷史查詢

**目標**: 提供執行歷史查詢和分析功能

**檔案**: `packages/services/src/workflow/history.ts`

```typescript
// packages/services/src/workflow/history.ts

import { db } from '@sales_ai_automation_v3/db';
import { workflowExecutions, workflowStepExecutions } from '@sales_ai_automation_v3/db/schema';
import { eq, desc, and, gte } from 'drizzle-orm';

interface ExecutionSummary {
  executionId: string;
  workflowName: string;
  status: string;
  duration: number;
  startedAt: Date;
  completedAt?: Date;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
}

interface ExecutionDetail {
  execution: any;
  steps: any[];
}

/**
 * 取得執行歷史
 */
export async function getExecutionHistory(
  options?: {
    workflowName?: string;
    conversationId?: string;
    limit?: number;
    since?: Date;
  }
): Promise<ExecutionSummary[]> {
  let query = db.select().from(workflowExecutions);

  const conditions = [];
  if (options?.workflowName) {
    conditions.push(eq(workflowExecutions.workflowName, options.workflowName));
  }
  if (options?.conversationId) {
    conditions.push(eq(workflowExecutions.conversationId, options.conversationId));
  }
  if (options?.since) {
    conditions.push(gte(workflowExecutions.startedAt, options.since));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const executions = await query
    .orderBy(desc(workflowExecutions.startedAt))
    .limit(options?.limit || 50);

  return executions.map((e) => ({
    executionId: e.id,
    workflowName: e.workflowName,
    status: e.status,
    duration: e.duration || 0,
    startedAt: e.startedAt!,
    completedAt: e.completedAt || undefined,
    totalSteps: e.totalSteps || 0,
    completedSteps: e.completedSteps || 0,
    failedSteps: e.failedSteps || 0,
  }));
}

/**
 * 取得執行詳情
 */
export async function getExecutionDetail(executionId: string): Promise<ExecutionDetail | null> {
  const execution = await db.query.workflowExecutions.findFirst({
    where: eq(workflowExecutions.id, executionId),
  });

  if (!execution) return null;

  const steps = await db
    .select()
    .from(workflowStepExecutions)
    .where(eq(workflowStepExecutions.executionId, executionId))
    .orderBy(workflowStepExecutions.startedAt);

  return { execution, steps };
}

/**
 * 取得執行統計
 */
export async function getExecutionStats(
  workflowName: string,
  since?: Date
): Promise<{
  totalExecutions: number;
  successRate: number;
  averageDuration: number;
  failureReasons: Record<string, number>;
}> {
  const conditions = [eq(workflowExecutions.workflowName, workflowName)];
  if (since) {
    conditions.push(gte(workflowExecutions.startedAt, since));
  }

  const executions = await db
    .select()
    .from(workflowExecutions)
    .where(and(...conditions));

  const total = executions.length;
  const successful = executions.filter((e) => e.status === 'completed').length;
  const totalDuration = executions.reduce((sum, e) => sum + (e.duration || 0), 0);

  // 統計失敗原因
  const failureReasons: Record<string, number> = {};
  for (const e of executions.filter((e) => e.status === 'failed')) {
    const reason = e.error || 'Unknown';
    failureReasons[reason] = (failureReasons[reason] || 0) + 1;
  }

  return {
    totalExecutions: total,
    successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
    averageDuration: total > 0 ? Math.round(totalDuration / total) : 0,
    failureReasons,
  };
}
```

---

### Task 7: API 路由

**目標**: 建立 Workflow API

**檔案**: `packages/api/src/routers/workflow.ts`

```typescript
// packages/api/src/routers/workflow.ts

import { os } from '@orpc/server';
import { z } from 'zod';
import { executeWorkflow } from '@sales_ai_automation_v3/services/workflow/executor';
import { listWorkflows, loadWorkflow } from '@sales_ai_automation_v3/services/workflow/loader';
import {
  getExecutionHistory,
  getExecutionDetail,
  getExecutionStats,
} from '@sales_ai_automation_v3/services/workflow/history';

export const workflowRouter = os.router({
  /**
   * 執行 Workflow
   * POST /api/workflows/:name/execute
   */
  execute: os
    .input(z.object({
      workflowName: z.string(),
      input: z.any(),
    }))
    .handler(async ({ input }) => {
      const result = await executeWorkflow(input.workflowName, input.input);
      return result;
    }),

  /**
   * 列出所有 Workflows
   * GET /api/workflows
   */
  list: os.handler(async () => {
    const names = listWorkflows();
    const workflows = await Promise.all(
      names.map(async (name) => {
        try {
          const def = await loadWorkflow(name);
          return {
            name: def.name,
            version: def.version,
            description: def.description,
            stepsCount: def.steps.length,
          };
        } catch {
          return { name, error: 'Failed to load' };
        }
      })
    );
    return workflows;
  }),

  /**
   * 取得 Workflow 定義
   * GET /api/workflows/:name
   */
  get: os
    .input(z.object({ name: z.string() }))
    .handler(async ({ input }) => {
      const workflow = await loadWorkflow(input.name);
      return workflow;
    }),

  /**
   * 取得執行歷史
   * GET /api/workflows/:name/history
   */
  history: os
    .input(z.object({
      workflowName: z.string().optional(),
      conversationId: z.string().optional(),
      limit: z.number().optional(),
    }).optional())
    .handler(async ({ input }) => {
      const history = await getExecutionHistory(input);
      return history;
    }),

  /**
   * 取得執行詳情
   * GET /api/workflows/executions/:id
   */
  executionDetail: os
    .input(z.object({ executionId: z.string() }))
    .handler(async ({ input }) => {
      const detail = await getExecutionDetail(input.executionId);
      return detail;
    }),

  /**
   * 取得執行統計
   * GET /api/workflows/:name/stats
   */
  stats: os
    .input(z.object({
      workflowName: z.string(),
      days: z.number().default(7),
    }))
    .handler(async ({ input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);
      const stats = await getExecutionStats(input.workflowName, since);
      return stats;
    }),
});
```

---

## 驗收標準

- [ ] Workflow YAML 正確載入和驗證
- [ ] 並行執行正確運作（context + buyer 同時執行）
- [ ] 依賴關係正確處理（seller 等待 context + buyer 完成）
- [ ] 條件式步驟正確跳過（競爭對手分析）
- [ ] 品質迴圈正確觸發（最多 2 次）
- [ ] 重試機制正常運作
- [ ] 執行歷史完整記錄
- [ ] MEDDIC 分析結果與原 Orchestrator 一致（對比測試）
- [ ] 測試覆蓋率 > 80%

---

## 產出檔案清單

```
packages/db/src/schema/
└── workflow.ts

packages/services/src/workflow/
├── index.ts
├── schema.ts        # Workflow 結構定義
├── loader.ts        # 載入器
├── executor.ts      # 執行器（核心）
├── conditions.ts    # 條件評估
├── history.ts       # 執行歷史
└── types.ts

packages/services/workflows/
├── meddic-analysis.yaml
└── README.md

packages/api/src/routers/
└── workflow.ts

tests/services/
└── workflow.test.ts
```

---

## 向後相容驗證

執行以下測試確保與原 Orchestrator 一致：

```typescript
// tests/workflow-compatibility.test.ts

import { describe, it, expect } from 'vitest';
import { executeWorkflow } from '../services/workflow/executor';
import { MeddicOrchestrator } from '../services/llm/orchestrator';

describe('Workflow Engine Compatibility', () => {
  it('should produce same results as original orchestrator', async () => {
    const testTranscript = [...]; // 使用真實對話

    // 使用原 Orchestrator
    const originalResult = await new MeddicOrchestrator().analyze({
      transcript: testTranscript,
      metadata: {},
    });

    // 使用新 Workflow 引擎
    const workflowResult = await executeWorkflow('meddic-analysis', {
      transcript: testTranscript,
      metadata: {},
    });

    // 比對結果
    expect(workflowResult.output.meddic_scores).toEqual(originalResult.meddic_scores);
    expect(workflowResult.output.executive_summary).toBeDefined();
  });
});
```

---

## 下一步

完成後：
1. 遷移現有的 MEDDIC 分析呼叫到 Workflow 引擎
2. 建立更多 Workflow（如 Lead Source → MQL → Onboarding 流程）
3. 建立 Workflow 編輯器 UI（進階功能）
4. 設定 Workflow 版本控制
