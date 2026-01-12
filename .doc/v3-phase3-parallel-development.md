# V3 Phase 3: 三平行開發任務規劃

> **建立日期**: 2026-01-11
> **前置完成**: Phase 1 (基礎建設) + Phase 2 (核心功能)
> **預估時程**: 3-4 工作日（平行執行）

---

## 目前開發進度總覽

### ✅ Phase 1: 基礎建設（完成）

| Workflow | 狀態 | 完成項目 |
|----------|------|----------|
| **A: Database Schema** | ✅ | `opportunity.ts`, `conversation.ts`, `meddic.ts`, `user-extension.ts`, `auth.ts` |
| **B: UI Components** | ✅ | 35 個元件（lead/4, conversation/3, meddic/3, common/3, ui/17） |
| **C: External Services** | ✅ | `groq-whisper.ts`, `gemini.ts`, `r2.ts`, `orchestrator.ts`, 7 個 prompts |

### ✅ Phase 2: 核心功能（完成）

| Workflow | 狀態 | 完成項目 |
|----------|------|----------|
| **D: API Routes** | ✅ | `opportunity.ts`, `conversation.ts`, `analytics.ts` |
| **E: Frontend Pages** | ✅ | 10 個路由頁面（dashboard, opportunities/3, conversations/3, login） |
| **F: Slack Bot** | ✅ | 完整指令系統（/analyze, /opportunity, /report）+ 音檔上傳處理 |

---

## Phase 3: 三平行開發任務

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                         Phase 3: 平行開發任務                                │
│                                                                             │
│   ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐        │
│   │                   │ │                   │ │                   │        │
│   │  Agent 1          │ │  Agent 2          │ │  Agent 3          │        │
│   │  Integration      │ │  Alert System     │ │  Data Migration   │        │
│   │  Testing          │ │                   │ │  Script           │        │
│   │                   │ │                   │ │                   │        │
│   │  ⏱️ 3-4 天        │ │  ⏱️ 3-4 天        │ │  ⏱️ 2-3 天        │        │
│   │                   │ │                   │ │                   │        │
│   └───────────────────┘ └───────────────────┘ └───────────────────┘        │
│            │                     │                     │                    │
│            └─────────────────────┼─────────────────────┘                    │
│                                  │                                          │
│                                  ▼                                          │
│                    ┌───────────────────────┐                                │
│                    │   Phase 4-5:          │                                │
│                    │   Production Deploy   │                                │
│                    └───────────────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent 1: Integration Testing

### 目標
驗證所有功能端對端整合，建立測試覆蓋與效能基準。

### 任務清單

- [ ] 設定測試環境與測試資料庫
- [ ] 安裝 Vitest + Playwright
- [ ] 撰寫 API 整合測試
- [ ] 撰寫 E2E 測試
- [ ] 效能基準測試

### 檔案結構

```
tests/
├── setup.ts                      # 測試環境設定
├── vitest.config.ts              # Vitest 設定
├── playwright.config.ts          # Playwright 設定
├── api/
│   ├── opportunity.test.ts       # Opportunity CRUD 測試
│   ├── conversation.test.ts      # Conversation + 上傳測試
│   └── analytics.test.ts         # Analytics API 測試
├── e2e/
│   ├── auth.spec.ts              # 登入/註冊流程
│   ├── opportunity-flow.spec.ts  # 商機管理流程
│   └── meddic-analysis.spec.ts   # MEDDIC 分析流程
└── fixtures/
    ├── test-audio.mp3            # 測試音檔
    └── mock-data.ts              # Mock 資料
```

### 測試案例

#### API 測試

```typescript
// tests/api/opportunity.test.ts
describe('Opportunity API', () => {
  test('應該成功建立商機', async () => {
    const result = await api.opportunities.create({
      customerNumber: '202601-000001',
      companyName: '測試公司',
    });
    expect(result.id).toBeDefined();
    expect(result.customerNumber).toBe('202601-000001');
  });

  test('應該列出所有商機', async () => {
    const result = await api.opportunities.list({});
    expect(result.opportunities).toBeInstanceOf(Array);
  });

  test('應該正確更新商機狀態', async () => {
    const result = await api.opportunities.updateStatus({
      opportunityId: 'test-id',
      status: 'contacted',
    });
    expect(result.status).toBe('contacted');
  });
});

// tests/api/conversation.test.ts
describe('Conversation API', () => {
  test('應該上傳音檔並建立對話', async () => {
    const audioBase64 = readFileSync('tests/fixtures/test-audio.mp3', 'base64');
    const result = await api.conversations.upload({
      opportunityId: 'test-opp-id',
      audioBase64,
      type: 'discovery_call',
    });
    expect(result.conversationId).toBeDefined();
    expect(result.caseNumber).toMatch(/^\d{6}-IC\d{3}$/);
  });

  test('應該執行 MEDDIC 分析', async () => {
    const result = await api.conversations.analyze({
      conversationId: 'test-conv-id',
    });
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });
});
```

#### E2E 測試

```typescript
// tests/e2e/meddic-analysis.spec.ts
import { test, expect } from '@playwright/test';

test.describe('MEDDIC 分析流程', () => {
  test('完整業務流程測試', async ({ page }) => {
    // 1. 登入
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // 2. 建立商機
    await page.goto('/opportunities/new');
    await page.fill('[name="customerNumber"]', '202601-000001');
    await page.fill('[name="companyName"]', '測試公司');
    await page.click('button[type="submit"]');
    await expect(page.locator('.toast-success')).toBeVisible();

    // 3. 上傳音檔
    await page.goto('/conversations/new');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('tests/fixtures/test-audio.mp3');
    await page.click('button:has-text("上傳")');
    await expect(page.locator('.status-transcribing')).toBeVisible();

    // 4. 等待分析完成
    await page.waitForSelector('.status-completed', { timeout: 120000 });

    // 5. 查看 MEDDIC 結果
    await expect(page.locator('.meddic-radar-chart')).toBeVisible();
    await expect(page.locator('.meddic-score')).toHaveText(/\d+\/100/);
  });
});
```

### 效能指標

| 指標 | 目標 | 測量方式 |
|------|------|----------|
| API 回應時間 | < 500ms (P95) | Vitest benchmark |
| 頁面載入 | < 2s (FCP) | Playwright metrics |
| 轉錄速度 | < 音檔長度 20% | 計時測試 |
| MEDDIC 分析 | < 30s | 計時測試 |

### 驗收標準

- [ ] 所有 API 測試通過（覆蓋率 > 80%）
- [ ] E2E 測試覆蓋關鍵業務流程
- [ ] 效能指標全部達標
- [ ] 測試報告產出

---

## Agent 2: Alert System（Coach Agent 警示）

### 目標
實作 V2 的即時警示功能，包含三種警示類型與 Slack 通知。

### 任務清單

- [ ] 建立 Alert 資料模型
- [ ] 實作警示規則引擎
- [ ] 實作三種警示規則
- [ ] Slack 警示通知
- [ ] 前端警示元件
- [ ] API 端點

### 檔案結構

```
packages/db/src/schema/
└── alert.ts                      # Alert 資料模型（新建）

packages/services/src/alerts/
├── index.ts                      # 主入口
├── types.ts                      # 類型定義
├── rules.ts                      # 警示規則引擎
├── evaluator.ts                  # 規則評估器
└── notifier.ts                   # 通知發送器

packages/api/src/routers/
└── alert.ts                      # Alert API（新建）

apps/slack-bot/src/alerts/
├── index.ts                      # Slack 警示入口
├── close-now.ts                  # Close Now 警示
├── missing-dm.ts                 # Missing DM 警示
└── manager-alert.ts              # Manager Escalation 警示

apps/web/src/components/alert/
├── alert-badge.tsx               # 警示徽章
├── alert-list.tsx                # 警示列表
└── alert-detail.tsx              # 警示詳情
```

### Schema 定義

```typescript
// packages/db/src/schema/alert.ts
import { pgTable, text, timestamp, integer, jsonb, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { opportunities } from './opportunity';
import { conversations } from './conversation';

export const alerts = pgTable('alerts', {
  id: text('id').primaryKey(),
  opportunityId: text('opportunity_id')
    .notNull()
    .references(() => opportunities.id),
  conversationId: text('conversation_id')
    .references(() => conversations.id),

  // 警示類型
  type: text('type').notNull(), // 'close_now' | 'missing_dm' | 'manager_escalation'
  severity: text('severity').notNull(), // 'high' | 'medium' | 'low'
  status: text('status').notNull().default('pending'), // 'pending' | 'acknowledged' | 'resolved'

  // 警示內容
  title: text('title').notNull(),
  message: text('message').notNull(),
  context: jsonb('context').$type<{
    meddicScore?: number;
    dimension?: string;
    triggerReason?: string;
    suggestedAction?: string;
  }>(),

  // 通知狀態
  slackNotified: boolean('slack_notified').default(false),
  slackChannelId: text('slack_channel_id'),
  slackMessageTs: text('slack_message_ts'),

  // 處理資訊
  acknowledgedBy: text('acknowledged_by'),
  acknowledgedAt: timestamp('acknowledged_at'),
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at'),
  resolution: text('resolution'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const alertsRelations = relations(alerts, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [alerts.opportunityId],
    references: [opportunities.id],
  }),
  conversation: one(conversations, {
    fields: [alerts.conversationId],
    references: [conversations.id],
  }),
}));

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
```

### 警示規則

```typescript
// packages/services/src/alerts/rules.ts

export interface AlertRule {
  type: AlertType;
  evaluate: (context: EvaluationContext) => AlertResult | null;
}

export const ALERT_RULES: AlertRule[] = [
  // Rule 1: Close Now - 高分且有購買訊號
  {
    type: 'close_now',
    evaluate: (ctx) => {
      const { meddicAnalysis, conversation } = ctx;

      if (
        meddicAnalysis.overallScore >= 80 &&
        meddicAnalysis.championScore >= 4 &&
        hasExplicitBuyingSignal(meddicAnalysis)
      ) {
        return {
          type: 'close_now',
          severity: 'high',
          title: '🎯 Close Now 機會！',
          message: `${ctx.opportunity.companyName} MEDDIC 分數達 ${meddicAnalysis.overallScore}，建議立即跟進！`,
          context: {
            meddicScore: meddicAnalysis.overallScore,
            triggerReason: '高分 + 明確購買訊號 + 有 Champion',
            suggestedAction: '安排簽約會議',
          },
        };
      }
      return null;
    },
  },

  // Rule 2: Missing DM - 缺少經濟決策者
  {
    type: 'missing_dm',
    evaluate: (ctx) => {
      const { meddicAnalysis, opportunity } = ctx;
      const conversationCount = opportunity.conversationCount || 0;

      if (
        meddicAnalysis.economicBuyerScore <= 2 &&
        conversationCount >= 2
      ) {
        return {
          type: 'missing_dm',
          severity: 'medium',
          title: '⚠️ 缺少經濟決策者',
          message: `${ctx.opportunity.companyName} 已進行 ${conversationCount} 次對話，但尚未接觸經濟決策者`,
          context: {
            meddicScore: meddicAnalysis.economicBuyerScore,
            dimension: 'economicBuyer',
            triggerReason: '多次對話但 Economic Buyer 分數過低',
            suggestedAction: '詢問決策流程，要求引薦決策者',
          },
        };
      }
      return null;
    },
  },

  // Rule 3: Manager Escalation - 連續低分
  {
    type: 'manager_escalation',
    evaluate: (ctx) => {
      const { recentScores, opportunity } = ctx;

      // 檢查最近 3 次分析是否都低於 40
      if (
        recentScores.length >= 3 &&
        recentScores.slice(0, 3).every(s => s < 40)
      ) {
        return {
          type: 'manager_escalation',
          severity: 'high',
          title: '🚨 需要主管關注',
          message: `${ctx.opportunity.companyName} 連續 3 次 MEDDIC 分數低於 40，建議主管介入`,
          context: {
            meddicScore: recentScores[0],
            triggerReason: '連續 3 次低分',
            suggestedAction: '主管與業務一對一檢討，調整策略',
          },
        };
      }
      return null;
    },
  },
];
```

### Slack 通知

```typescript
// apps/slack-bot/src/alerts/index.ts

export async function sendAlertNotification(
  alert: Alert,
  slackClient: SlackClient,
  channelId: string
): Promise<void> {
  const blocks = buildAlertBlocks(alert);

  const result = await slackClient.postMessage({
    channel: channelId,
    text: `${getAlertEmoji(alert.type)} ${alert.title}`,
    blocks,
  });

  // 更新警示記錄
  await db.update(alerts)
    .set({
      slackNotified: true,
      slackChannelId: channelId,
      slackMessageTs: result.ts,
    })
    .where(eq(alerts.id, alert.id));
}

function buildAlertBlocks(alert: Alert): object[] {
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
          text: `*建議行動*\n${alert.context?.suggestedAction || '無'}`,
        },
      ],
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
          text: { type: 'plain_text', text: '查看詳情', emoji: true },
          action_id: 'view_alert_detail',
          value: alert.id,
        },
      ],
    },
  ];
}
```

### 驗收標準

- [ ] Alert schema 正確建立並 migration
- [ ] 三種警示規則正確觸發
- [ ] Slack 通知正常發送
- [ ] 前端警示列表顯示正確
- [ ] 警示確認/解決流程完整

---

## Agent 3: Data Migration Script

### 目標
建立 Firestore → PostgreSQL 完整遷移腳本，包含資料驗證與 rollback 機制。

### 任務清單

- [ ] 設定 Firebase Admin SDK
- [ ] Leads 遷移腳本
- [ ] Conversations 遷移腳本
- [ ] MEDDIC Analysis 遷移腳本
- [ ] GCS → R2 音檔遷移
- [ ] 資料驗證腳本
- [ ] Rollback 機制

### 檔案結構

```
scripts/migration/
├── config.ts                     # Firebase + Neon 連接設定
├── types.ts                      # 類型定義
├── mappers/
│   ├── lead-mapper.ts            # Lead 欄位映射
│   ├── conversation-mapper.ts    # Conversation 欄位映射
│   └── meddic-mapper.ts          # MEDDIC 欄位映射
├── migrate-leads.ts              # Leads 遷移
├── migrate-conversations.ts      # Conversations 遷移
├── migrate-meddic.ts             # MEDDIC 分析遷移
├── migrate-audio.ts              # GCS → R2 音檔遷移
├── validate.ts                   # 資料驗證
├── rollback.ts                   # 回滾腳本
├── report.ts                     # 遷移報告產生
└── index.ts                      # 主入口

packages/db/src/utils/
└── firestore-mapper.ts           # Firestore 類型映射工具
```

### Schema 映射

```typescript
// scripts/migration/mappers/lead-mapper.ts

export interface FirestoreLead {
  id: string;
  email?: string;
  status?: string;
  score?: number;
  created_at?: FirebaseFirestore.Timestamp;
  updated_at?: FirebaseFirestore.Timestamp;
}

export function mapLeadToOpportunity(
  doc: FirestoreLead,
  latestConversation?: FirestoreConversation
): NewOpportunity {
  return {
    id: doc.id,
    customerNumber: generateCustomerNumber(doc.created_at),
    companyName: latestConversation?.analysis?.store_name || `Company ${doc.id.slice(0, 6)}`,
    contactEmail: doc.email || null,
    status: mapLeadStatus(doc.status),
    source: 'migration',
    createdAt: doc.created_at?.toDate() || new Date(),
    updatedAt: doc.updated_at?.toDate() || new Date(),
  };
}

function mapLeadStatus(v2Status?: string): OpportunityStatus {
  const mapping: Record<string, OpportunityStatus> = {
    'new': 'new',
    'contacted': 'contacted',
    'qualified': 'qualified',
    'converted': 'won',
  };
  return mapping[v2Status || 'new'] || 'new';
}

function generateCustomerNumber(createdAt?: FirebaseFirestore.Timestamp): string {
  const date = createdAt?.toDate() || new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const sequence = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
  return `${yearMonth}-${sequence}`;
}
```

```typescript
// scripts/migration/mappers/conversation-mapper.ts

export interface FirestoreConversation {
  id: string;
  lead_id: string;
  status?: string;
  type?: string;
  occurred_at?: FirebaseFirestore.Timestamp;
  created_at?: FirebaseFirestore.Timestamp;
  updated_at?: FirebaseFirestore.Timestamp;
  transcript?: {
    segments?: Array<{ speaker: string; text: string; start: number; end: number }>;
    full_text?: string;
    language?: string;
    duration?: number;
  };
  analysis?: {
    meddic_score?: number;
    executive_summary?: string;
    store_name?: string;
    progress_score?: number;
    coaching_notes?: string;
    urgency_level?: string;
    buyer_signals?: Record<string, unknown>;
    agent_data?: {
      context?: Record<string, unknown>;
      buyer?: Record<string, unknown>;
      seller?: Record<string, unknown>;
      summary?: Record<string, unknown>;
    };
  };
  audio_gcs_uri?: string;
}

export function mapConversation(
  doc: FirestoreConversation,
  r2AudioUrl?: string,
  caseNumber?: string
): NewConversation {
  return {
    id: doc.id,
    opportunityId: doc.lead_id,
    caseNumber: caseNumber || generateCaseNumber(doc.created_at),
    title: doc.analysis?.store_name || `對話 ${doc.id.slice(0, 8)}`,
    type: mapConversationType(doc.type),
    status: mapConversationStatus(doc.status),
    audioUrl: r2AudioUrl || null,
    transcript: doc.transcript?.full_text || null,
    transcriptSegments: doc.transcript?.segments || null,
    summary: doc.analysis?.executive_summary || null,
    duration: doc.transcript?.duration || null,
    conversationDate: doc.occurred_at?.toDate() || null,
    progressScore: doc.analysis?.progress_score || null,
    coachingNotes: doc.analysis?.coaching_notes || null,
    urgencyLevel: doc.analysis?.urgency_level || null,
    storeName: doc.analysis?.store_name || null,
    createdAt: doc.created_at?.toDate() || new Date(),
    updatedAt: doc.updated_at?.toDate() || new Date(),
  };
}
```

### 主遷移腳本

```typescript
// scripts/migration/index.ts

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { db } from '@Sales_ai_automation_v3/db';
import { opportunities, conversations, meddicAnalyses } from '@Sales_ai_automation_v3/db/schema';
import { migrateLeads } from './migrate-leads';
import { migrateConversations } from './migrate-conversations';
import { migrateMeddicAnalyses } from './migrate-meddic';
import { migrateAudioFiles } from './migrate-audio';
import { validateMigration } from './validate';
import { generateReport } from './report';

async function main() {
  console.log('🚀 Starting V2 → V3 Migration...\n');

  const startTime = Date.now();
  const stats = {
    leads: { total: 0, success: 0, failed: 0 },
    conversations: { total: 0, success: 0, failed: 0 },
    meddicAnalyses: { total: 0, success: 0, failed: 0 },
    audioFiles: { total: 0, success: 0, failed: 0 },
  };

  try {
    // Phase 1: Migrate Leads → Opportunities
    console.log('📊 Phase 1: Migrating Leads...');
    stats.leads = await migrateLeads();
    console.log(`✅ Leads: ${stats.leads.success}/${stats.leads.total} migrated\n`);

    // Phase 2: Migrate Conversations
    console.log('💬 Phase 2: Migrating Conversations...');
    stats.conversations = await migrateConversations();
    console.log(`✅ Conversations: ${stats.conversations.success}/${stats.conversations.total} migrated\n`);

    // Phase 3: Migrate MEDDIC Analyses
    console.log('📈 Phase 3: Migrating MEDDIC Analyses...');
    stats.meddicAnalyses = await migrateMeddicAnalyses();
    console.log(`✅ MEDDIC: ${stats.meddicAnalyses.success}/${stats.meddicAnalyses.total} migrated\n`);

    // Phase 4: Migrate Audio Files (GCS → R2)
    console.log('🎵 Phase 4: Migrating Audio Files...');
    stats.audioFiles = await migrateAudioFiles();
    console.log(`✅ Audio: ${stats.audioFiles.success}/${stats.audioFiles.total} migrated\n`);

    // Phase 5: Validate Migration
    console.log('🔍 Phase 5: Validating Migration...');
    const validation = await validateMigration();

    if (!validation.passed) {
      console.error('❌ Validation failed:', validation.errors);
      process.exit(1);
    }
    console.log('✅ Validation passed!\n');

    // Generate Report
    const duration = (Date.now() - startTime) / 1000;
    const report = await generateReport(stats, duration);
    console.log(report);

    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.log('\n🔄 Running rollback...');
    // Rollback logic here if needed
    process.exit(1);
  }
}

main();
```

### 驗證腳本

```typescript
// scripts/migration/validate.ts

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  errors: string[];
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  expected: number | string;
  actual: number | string;
}

export async function validateMigration(): Promise<ValidationResult> {
  const checks: ValidationCheck[] = [];
  const errors: string[] = [];

  // Check 1: Leads count
  const firestoreLeadsCount = await getFirestoreCount('leads');
  const postgresOpportunitiesCount = await getPostgresCount('opportunities');
  checks.push({
    name: 'Leads → Opportunities 筆數',
    passed: firestoreLeadsCount === postgresOpportunitiesCount,
    expected: firestoreLeadsCount,
    actual: postgresOpportunitiesCount,
  });

  // Check 2: Conversations count
  const firestoreCasesCount = await getFirestoreCount('sales_cases');
  const postgresConversationsCount = await getPostgresCount('conversations');
  checks.push({
    name: 'Sales Cases → Conversations 筆數',
    passed: firestoreCasesCount === postgresConversationsCount,
    expected: firestoreCasesCount,
    actual: postgresConversationsCount,
  });

  // Check 3: MEDDIC Analyses count
  const expectedMeddicCount = await getFirestoreMeddicCount();
  const postgresMeddicCount = await getPostgresCount('meddic_analyses');
  checks.push({
    name: 'MEDDIC Analyses 筆數',
    passed: expectedMeddicCount === postgresMeddicCount,
    expected: expectedMeddicCount,
    actual: postgresMeddicCount,
  });

  // Check 4: Foreign key integrity
  const orphanedConversations = await checkOrphanedConversations();
  checks.push({
    name: 'Foreign Key 完整性（無孤兒 Conversation）',
    passed: orphanedConversations === 0,
    expected: 0,
    actual: orphanedConversations,
  });

  // Check 5: Audio URLs accessible
  const audioUrlsValid = await checkAudioUrls();
  checks.push({
    name: '音檔 URL 可存取',
    passed: audioUrlsValid.failed === 0,
    expected: audioUrlsValid.total,
    actual: audioUrlsValid.success,
  });

  // Check 6: Sample MEDDIC score accuracy (random 10)
  const scoreAccuracy = await checkMeddicScoreAccuracy(10);
  checks.push({
    name: 'MEDDIC 分數一致性（抽樣 10 筆）',
    passed: scoreAccuracy.matchRate >= 0.9,
    expected: '90%+',
    actual: `${(scoreAccuracy.matchRate * 100).toFixed(1)}%`,
  });

  // Compile results
  const failedChecks = checks.filter(c => !c.passed);

  return {
    passed: failedChecks.length === 0,
    checks,
    errors: failedChecks.map(c => `${c.name}: expected ${c.expected}, got ${c.actual}`),
  };
}
```

### 驗收標準

- [ ] Firebase Admin SDK 連接成功
- [ ] Leads 完整遷移到 opportunities
- [ ] Conversations 完整遷移（含所有 V2 特有欄位）
- [ ] MEDDIC Analyses 完整遷移（含 agentOutputs）
- [ ] 音檔從 GCS 遷移到 R2
- [ ] 驗證腳本 6 項檢查全部通過
- [ ] Rollback 機制可正常運作

---

## 任務依賴與協作

### 依賴關係

```
Agent 1 (Integration Testing)
└── 依賴: 無（可立即開始）
└── 產出: 測試框架 + 測試案例 + 效能報告

Agent 2 (Alert System)
└── 依賴: Phase 2 完成（已滿足）
└── 產出: Alert 功能 + Slack 通知 + 前端元件

Agent 3 (Data Migration)
└── 依賴: Phase 1A Schema（已滿足）
└── 產出: 遷移腳本 + 驗證報告
```

### 協作點

1. **Agent 1 + Agent 2**: Agent 1 的測試框架可用於測試 Agent 2 的 Alert 功能
2. **Agent 1 + Agent 3**: Agent 1 的測試可驗證 Agent 3 遷移後的資料正確性
3. **Agent 2 + Agent 3**: Agent 3 遷移歷史資料後，Agent 2 可能需要為歷史資料補建 Alert

---

## 預估時程

| Agent | 任務 | 預估時間 |
|-------|------|----------|
| Agent 1 | Integration Testing | 3-4 天 |
| Agent 2 | Alert System | 3-4 天 |
| Agent 3 | Data Migration | 2-3 天 |

**總計**: 3-4 工作日（完全平行執行）

---

## 完成後下一步

完成 Phase 3 三個平行任務後，進入 **Phase 4-5: Production Deployment**：

1. **環境設定**
   - Cloudflare Pages（Frontend）
   - Cloudflare Workers（Backend + Slack Bot）
   - Neon PostgreSQL（Production DB）

2. **正式遷移**
   - 執行 Agent 3 的 Migration Script
   - 雙寫期間驗證

3. **流量切換**
   - 10% → 50% → 100%

4. **監控設定**
   - Sentry 錯誤追蹤
   - LogFlare 日誌聚合
   - UptimeRobot 服務監控
