# Workflow Instruction: Phase 3 Agent 3 - Data Migration Script

> **任務類型**: 資料遷移
> **預估時間**: 2-3 工作日
> **依賴條件**: Phase 1A Schema 完成（已滿足）

---

## 任務目標

建立 Firestore → PostgreSQL 完整遷移腳本，包含 Leads、Conversations、MEDDIC Analyses 遷移，以及 GCS → R2 音檔遷移，並提供資料驗證與 Rollback 機制。

---

## 前置條件

確認以下項目已完成：
- [x] PostgreSQL Schema 已建立（opportunities, conversations, meddic_analyses）
- [x] Cloudflare R2 已設定
- [ ] Firebase Admin SDK 憑證已取得
- [ ] V2 Firestore 存取權限已確認
- [ ] Drizzle ORM query relations 已設定（用於 validate.ts）

---

## 任務清單

### Task 1: 遷移環境設定

**目標**: 設定 Firebase 和資料庫連接

**步驟**:

1. 安裝依賴：

```bash
bun add firebase-admin @google-cloud/storage @aws-sdk/client-s3
```

2. 建立 `scripts/migration/config.ts`：

```typescript
// scripts/migration/config.ts

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Storage } from '@google-cloud/storage';
import { db } from '@sales_ai_automation_v3/db';

// Firebase 設定
const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID!,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')!,
};

// 初始化 Firebase Admin
const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

export const firestore = getFirestore(firebaseApp);

// Google Cloud Storage 客戶端
export const gcsStorage = new Storage({
  projectId: process.env.FIREBASE_PROJECT_ID,
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// R2 設定
export const r2Config = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
  secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
  bucket: process.env.CLOUDFLARE_R2_BUCKET!,
  // S3 API endpoint（用於上傳）
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  // 公開存取 URL（需要在 R2 設定 custom domain 或開啟 public access）
  publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL || `https://pub-${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.dev`,
};

// PostgreSQL 資料庫
export { db };

// 遷移設定
export const migrationConfig = {
  batchSize: 100, // 每批處理數量
  retryAttempts: 3, // 重試次數
  retryDelay: 1000, // 重試延遲（毫秒）
  audioConcurrency: 5, // 音檔並行遷移數量
  dryRun: process.env.DRY_RUN === 'true', // 乾跑模式（不實際寫入）
  verbose: process.env.VERBOSE === 'true', // 詳細輸出
};

/**
 * 帶重試的執行函數
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= migrationConfig.retryAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < migrationConfig.retryAttempts) {
        console.warn(`[${context}] Attempt ${attempt} failed, retrying in ${migrationConfig.retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, migrationConfig.retryDelay));
      }
    }
  }

  throw lastError;
}
```

3. 建立 `scripts/migration/types.ts`：

```typescript
// scripts/migration/types.ts

import type { Timestamp } from 'firebase-admin/firestore';

// V2 Firestore 類型
export interface FirestoreLead {
  id?: string;
  email?: string;
  status?: string;
  score?: number;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export interface FirestoreConversation {
  id?: string;
  lead_id?: string;
  sales_rep?: string;
  status?: string;
  type?: string;
  occurred_at?: Timestamp;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  audio_gcs_uri?: string;
  transcript?: {
    segments?: Array<{
      speaker: string;
      text: string;
      start: number;
      end: number;
    }>;
    full_text?: string;
    language?: string;
    duration?: number;
  };
  analysis?: {
    meddic_score?: number;
    progress_score?: number;
    executive_summary?: string;
    coaching_notes?: string;
    urgency_level?: string;
    store_name?: string;
    qualification_status?: string;
    buyer_signals?: Record<string, unknown>;
    agent_data?: {
      context?: Record<string, unknown>;
      buyer?: Record<string, unknown>;
      seller?: Record<string, unknown>;
      summary?: Record<string, unknown>;
      crm?: Record<string, unknown>;
      coach?: Record<string, unknown>;
    };
  };
}

// 遷移統計
export interface MigrationStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ id: string; error: string }>;
}

// 遷移結果
export interface MigrationResult {
  leads: MigrationStats;
  conversations: MigrationStats;
  meddicAnalyses: MigrationStats;
  audioFiles: MigrationStats;
  duration: number;
  startedAt: Date;
  completedAt: Date;
}

// 遷移進度（用於斷點續傳）
export interface MigrationProgress {
  lastProcessedLeadId?: string;
  lastProcessedConversationId?: string;
  lastProcessedMeddicId?: string;
  completedPhases: ('leads' | 'conversations' | 'meddic' | 'audio')[];
  updatedAt: Date;
}
```

**產出檔案**:
- `scripts/migration/config.ts`
- `scripts/migration/types.ts`

---

### Task 2: Schema 映射工具

**目標**: 建立 V2 → V3 欄位映射邏輯

**步驟**:

1. 建立 `scripts/migration/mappers/lead-mapper.ts`：

```typescript
// scripts/migration/mappers/lead-mapper.ts

import type { FirestoreLead, FirestoreConversation } from '../types';
import type { NewOpportunity } from '@sales_ai_automation_v3/db/schema';
import type { Timestamp } from 'firebase-admin/firestore';

/**
 * V2 Lead Status → V3 Opportunity Status 映射
 */
export function mapLeadStatus(v2Status?: string): NewOpportunity['status'] {
  const mapping: Record<string, NewOpportunity['status']> = {
    'new': 'new',
    'contacted': 'contacted',
    'qualified': 'qualified',
    'converted': 'won',
    'lost': 'lost',
  };
  return mapping[v2Status || 'new'] || 'new';
}

/**
 * 生成客戶編號
 * 格式: YYYYMM-XXXXXX
 */
export function generateCustomerNumber(createdAt?: Timestamp): string {
  const date = createdAt?.toDate() || new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const sequence = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
  return `${yearMonth}-${sequence}`;
}

/**
 * 從最新對話中提取公司名稱
 */
export function extractCompanyName(
  lead: FirestoreLead,
  latestConversation?: FirestoreConversation
): string {
  // 優先使用對話中的 store_name
  if (latestConversation?.analysis?.store_name) {
    return latestConversation.analysis.store_name;
  }

  // 使用 email 域名
  if (lead.email) {
    const domain = lead.email.split('@')[1];
    if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com'].includes(domain)) {
      return domain.split('.')[0].toUpperCase();
    }
  }

  // 使用 ID 前綴
  return `Company_${lead.id?.slice(0, 8) || 'Unknown'}`;
}

/**
 * 將 Firestore Lead 映射為 V3 Opportunity
 */
export function mapLeadToOpportunity(
  docId: string,
  lead: FirestoreLead,
  latestConversation?: FirestoreConversation
): NewOpportunity {
  return {
    id: docId,
    customerNumber: generateCustomerNumber(lead.created_at),
    companyName: extractCompanyName(lead, latestConversation),
    contactEmail: lead.email || null,
    status: mapLeadStatus(lead.status),
    source: 'migration',
    createdAt: lead.created_at?.toDate() || new Date(),
    updatedAt: lead.updated_at?.toDate() || new Date(),
  };
}
```

2. 建立 `scripts/migration/mappers/conversation-mapper.ts`：

```typescript
// scripts/migration/mappers/conversation-mapper.ts

import type { FirestoreConversation } from '../types';
import type { NewConversation } from '@sales_ai_automation_v3/db/schema';
import type { Timestamp } from 'firebase-admin/firestore';

/**
 * V2 Conversation Status → V3 Status 映射
 */
export function mapConversationStatus(v2Status?: string): NewConversation['status'] {
  const mapping: Record<string, NewConversation['status']> = {
    'pending': 'pending',
    'processing': 'transcribing',
    'transcribed': 'transcribed',
    'analyzed': 'completed',
    'completed': 'completed',
    'failed': 'failed',
  };
  return mapping[v2Status || 'pending'] || 'pending';
}

/**
 * V2 Conversation Type → V3 Type 映射
 */
export function mapConversationType(v2Type?: string): NewConversation['type'] {
  const mapping: Record<string, NewConversation['type']> = {
    'discovery': 'discovery_call',
    'discovery_call': 'discovery_call',
    'demo': 'demo',
    'follow_up': 'follow_up',
    'followup': 'follow_up',
    'negotiation': 'negotiation',
    'closing': 'closing',
    'support': 'support',
  };
  return mapping[v2Type || 'discovery_call'] || 'discovery_call';
}

/**
 * 生成案件編號
 * 格式: YYYYMM-IC{序號}
 */
export function generateCaseNumber(createdAt?: Timestamp, sequence?: number): string {
  const date = createdAt?.toDate() || new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const seq = sequence || Math.floor(Math.random() * 999);
  return `${yearMonth}-IC${String(seq).padStart(3, '0')}`;
}

/**
 * 將 Firestore Conversation 映射為 V3 Conversation
 */
export function mapConversation(
  docId: string,
  conv: FirestoreConversation,
  r2AudioUrl?: string,
  caseNumber?: string
): NewConversation {
  return {
    id: docId,
    opportunityId: conv.lead_id || '',
    caseNumber: caseNumber || generateCaseNumber(conv.created_at),
    title: conv.analysis?.store_name || `對話 ${docId.slice(0, 8)}`,
    type: mapConversationType(conv.type),
    status: mapConversationStatus(conv.status),

    // 音檔和轉錄
    audioUrl: r2AudioUrl || null,
    transcript: conv.transcript?.full_text || null,
    transcriptSegments: conv.transcript?.segments
      ? JSON.stringify(conv.transcript.segments)
      : null,
    summary: conv.analysis?.executive_summary || null,
    duration: conv.transcript?.duration || null,

    // V2 特有欄位
    progressScore: conv.analysis?.progress_score || null,
    coachingNotes: conv.analysis?.coaching_notes || null,
    urgencyLevel: conv.analysis?.urgency_level || null,
    storeName: conv.analysis?.store_name || null,

    // 時間
    conversationDate: conv.occurred_at?.toDate() || null,
    createdAt: conv.created_at?.toDate() || new Date(),
    updatedAt: conv.updated_at?.toDate() || new Date(),
  };
}
```

3. 建立 `scripts/migration/mappers/meddic-mapper.ts`：

```typescript
// scripts/migration/mappers/meddic-mapper.ts

import type { FirestoreConversation } from '../types';
import type { NewMeddicAnalysis } from '@sales_ai_automation_v3/db/schema';

/**
 * V2 Qualification Status → V3 Status 映射
 */
export function mapMeddicStatus(v2Status?: string): NewMeddicAnalysis['status'] {
  const mapping: Record<string, string> = {
    'Qualified': 'Strong',
    'Partially Qualified': 'Medium',
    'Not Qualified': 'Weak',
    'At Risk': 'At Risk',
  };
  return mapping[v2Status || ''] || null;
}

/**
 * 從 V2 agent_data.buyer 提取 MEDDIC 維度分數
 */
export function extractMeddicScores(conv: FirestoreConversation): {
  metricsScore: number | null;
  economicBuyerScore: number | null;
  decisionCriteriaScore: number | null;
  decisionProcessScore: number | null;
  identifyPainScore: number | null;
  championScore: number | null;
} {
  const buyerData = conv.analysis?.agent_data?.buyer as Record<string, unknown> | undefined;

  if (!buyerData) {
    return {
      metricsScore: null,
      economicBuyerScore: null,
      decisionCriteriaScore: null,
      decisionProcessScore: null,
      identifyPainScore: null,
      championScore: null,
    };
  }

  // V2 的 meddic_scores 結構
  const scores = buyerData.meddic_scores as Record<string, number> | undefined;

  return {
    metricsScore: scores?.metrics ?? null,
    economicBuyerScore: scores?.economic_buyer ?? null,
    decisionCriteriaScore: scores?.decision_criteria ?? null,
    decisionProcessScore: scores?.decision_process ?? null,
    identifyPainScore: scores?.identify_pain ?? null,
    championScore: scores?.champion ?? null,
  };
}

/**
 * 提取 Key Findings
 */
export function extractKeyFindings(conv: FirestoreConversation): string[] {
  const summaryData = conv.analysis?.agent_data?.summary as Record<string, unknown> | undefined;

  if (summaryData?.key_findings && Array.isArray(summaryData.key_findings)) {
    return summaryData.key_findings as string[];
  }

  // 嘗試從 buyer_signals 提取
  const buyerSignals = conv.analysis?.buyer_signals as Record<string, unknown> | undefined;
  if (buyerSignals?.key_insights && Array.isArray(buyerSignals.key_insights)) {
    return buyerSignals.key_insights as string[];
  }

  return [];
}

/**
 * 提取 Next Steps
 */
export function extractNextSteps(conv: FirestoreConversation): Array<{
  action: string;
  priority: string;
  owner?: string;
}> {
  const coachData = conv.analysis?.agent_data?.coach as Record<string, unknown> | undefined;

  if (coachData?.next_steps && Array.isArray(coachData.next_steps)) {
    return (coachData.next_steps as Array<Record<string, unknown>>).map((step) => ({
      action: String(step.action || step.description || ''),
      priority: String(step.priority || 'medium'),
      owner: step.owner ? String(step.owner) : undefined,
    }));
  }

  return [];
}

/**
 * 提取 Risks
 */
export function extractRisks(conv: FirestoreConversation): Array<{
  risk: string;
  severity: string;
  mitigation?: string;
}> {
  const sellerData = conv.analysis?.agent_data?.seller as Record<string, unknown> | undefined;

  if (sellerData?.risks && Array.isArray(sellerData.risks)) {
    return (sellerData.risks as Array<Record<string, unknown>>).map((risk) => ({
      risk: String(risk.description || risk.risk || ''),
      severity: String(risk.severity || 'medium'),
      mitigation: risk.mitigation ? String(risk.mitigation) : undefined,
    }));
  }

  return [];
}

/**
 * 將 Firestore Conversation 中的分析映射為 V3 MEDDIC Analysis
 */
export function mapMeddicAnalysis(
  docId: string,
  conv: FirestoreConversation,
  opportunityId: string
): NewMeddicAnalysis | null {
  const analysis = conv.analysis;

  // 如果沒有分析資料，跳過
  if (!analysis || analysis.meddic_score === undefined) {
    return null;
  }

  const scores = extractMeddicScores(conv);

  return {
    id: `meddic_${docId}_${Date.now()}`,
    conversationId: docId,
    opportunityId,

    // 維度分數
    ...scores,

    // 整體評分
    overallScore: analysis.meddic_score,
    status: mapMeddicStatus(analysis.qualification_status),

    // 詳細分析
    dimensions: analysis.buyer_signals || null,
    keyFindings: extractKeyFindings(conv),
    nextSteps: extractNextSteps(conv),
    risks: extractRisks(conv),

    // V2 Agent 輸出
    agentOutputs: analysis.agent_data || null,

    createdAt: conv.updated_at?.toDate() || new Date(),
  };
}
```

4. 建立 `scripts/migration/mappers/index.ts`：

```typescript
// scripts/migration/mappers/index.ts

export * from './lead-mapper';
export * from './conversation-mapper';
export * from './meddic-mapper';
```

**產出檔案**:
- `scripts/migration/mappers/lead-mapper.ts`
- `scripts/migration/mappers/conversation-mapper.ts`
- `scripts/migration/mappers/meddic-mapper.ts`
- `scripts/migration/mappers/index.ts`

---

### Task 3: 遷移腳本

**目標**: 建立各資料類型的遷移腳本

**步驟**:

1. 建立 `scripts/migration/migrate-leads.ts`：

```typescript
// scripts/migration/migrate-leads.ts

import { firestore, db, migrationConfig } from './config';
import { opportunities } from '@sales_ai_automation_v3/db/schema';
import { mapLeadToOpportunity } from './mappers';
import type { FirestoreLead, FirestoreConversation, MigrationStats } from './types';

/**
 * 遷移 Leads → Opportunities
 */
export async function migrateLeads(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  console.log('📊 Starting Leads migration...');

  // 取得所有 leads
  const leadsSnapshot = await firestore.collection('leads').get();
  stats.total = leadsSnapshot.size;

  console.log(`Found ${stats.total} leads to migrate`);

  // 分批處理
  const docs = leadsSnapshot.docs;
  for (let i = 0; i < docs.length; i += migrationConfig.batchSize) {
    const batch = docs.slice(i, i + migrationConfig.batchSize);

    for (const doc of batch) {
      const docId = doc.id;
      const leadData = doc.data() as FirestoreLead;

      try {
        // 取得該 lead 的最新對話（用於提取 company_name）
        const conversationsSnapshot = await firestore
          .collection('sales_cases')
          .where('lead_id', '==', docId)
          .orderBy('created_at', 'desc')
          .limit(1)
          .get();

        const latestConversation = conversationsSnapshot.docs[0]?.data() as FirestoreConversation | undefined;

        // 映射資料
        const opportunity = mapLeadToOpportunity(docId, leadData, latestConversation);

        if (migrationConfig.verbose) {
          console.log(`Migrating lead ${docId} → opportunity ${opportunity.customerNumber}`);
        }

        // 寫入資料庫
        if (!migrationConfig.dryRun) {
          await db.insert(opportunities).values(opportunity).onConflictDoNothing();
        }

        stats.success++;
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          id: docId,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`Failed to migrate lead ${docId}:`, error);
      }
    }

    // 顯示進度
    const progress = Math.min(i + migrationConfig.batchSize, stats.total);
    console.log(`Progress: ${progress}/${stats.total} (${Math.round(progress / stats.total * 100)}%)`);
  }

  console.log(`✅ Leads migration complete: ${stats.success} success, ${stats.failed} failed`);
  return stats;
}
```

2. 建立 `scripts/migration/migrate-conversations.ts`：

```typescript
// scripts/migration/migrate-conversations.ts

import { firestore, db, migrationConfig } from './config';
import { conversations } from '@sales_ai_automation_v3/db/schema';
import { mapConversation, generateCaseNumber } from './mappers';
import { migrateAudioFile } from './migrate-audio';
import type { FirestoreConversation, MigrationStats } from './types';

// 用於追蹤案件編號序列
const caseNumberSequence: Map<string, number> = new Map();

function getNextCaseNumber(yearMonth: string): string {
  const current = caseNumberSequence.get(yearMonth) || 0;
  const next = current + 1;
  caseNumberSequence.set(yearMonth, next);
  return `${yearMonth}-IC${String(next).padStart(3, '0')}`;
}

/**
 * 遷移 Sales Cases → Conversations
 */
export async function migrateConversations(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  console.log('💬 Starting Conversations migration...');

  // 取得所有 sales_cases
  const casesSnapshot = await firestore
    .collection('sales_cases')
    .orderBy('created_at', 'asc') // 按時間排序以正確生成案件編號
    .get();

  stats.total = casesSnapshot.size;
  console.log(`Found ${stats.total} conversations to migrate`);

  // 分批處理
  const docs = casesSnapshot.docs;
  for (let i = 0; i < docs.length; i += migrationConfig.batchSize) {
    const batch = docs.slice(i, i + migrationConfig.batchSize);

    for (const doc of batch) {
      const docId = doc.id;
      const convData = doc.data() as FirestoreConversation;

      try {
        // 檢查 lead_id 是否存在
        if (!convData.lead_id) {
          stats.skipped++;
          console.warn(`Skipping conversation ${docId}: no lead_id`);
          continue;
        }

        // 遷移音檔（如果有）
        let r2AudioUrl: string | undefined;
        if (convData.audio_gcs_uri && !migrationConfig.dryRun) {
          try {
            r2AudioUrl = await migrateAudioFile(convData.audio_gcs_uri, docId);
          } catch (audioError) {
            console.warn(`Failed to migrate audio for ${docId}:`, audioError);
            // 音檔遷移失敗不阻止對話遷移
          }
        }

        // 生成案件編號
        const createdAt = convData.created_at?.toDate() || new Date();
        const yearMonth = `${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
        const caseNumber = getNextCaseNumber(yearMonth);

        // 映射資料
        const conversation = mapConversation(docId, convData, r2AudioUrl, caseNumber);

        if (migrationConfig.verbose) {
          console.log(`Migrating conversation ${docId} → ${caseNumber}`);
        }

        // 寫入資料庫
        if (!migrationConfig.dryRun) {
          await db.insert(conversations).values(conversation).onConflictDoNothing();
        }

        stats.success++;
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          id: docId,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`Failed to migrate conversation ${docId}:`, error);
      }
    }

    // 顯示進度
    const progress = Math.min(i + migrationConfig.batchSize, stats.total);
    console.log(`Progress: ${progress}/${stats.total} (${Math.round(progress / stats.total * 100)}%)`);
  }

  console.log(`✅ Conversations migration complete: ${stats.success} success, ${stats.failed} failed, ${stats.skipped} skipped`);
  return stats;
}
```

3. 建立 `scripts/migration/migrate-meddic.ts`：

```typescript
// scripts/migration/migrate-meddic.ts

import { firestore, db, migrationConfig } from './config';
import { meddicAnalyses } from '@sales_ai_automation_v3/db/schema';
import { mapMeddicAnalysis } from './mappers';
import type { FirestoreConversation, MigrationStats } from './types';

/**
 * 遷移 MEDDIC Analyses
 */
export async function migrateMeddicAnalyses(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  console.log('📈 Starting MEDDIC Analyses migration...');

  // 取得所有有分析結果的 sales_cases
  const casesSnapshot = await firestore.collection('sales_cases').get();

  // 過濾有 meddic_score 的
  const docsWithAnalysis = casesSnapshot.docs.filter((doc) => {
    const data = doc.data() as FirestoreConversation;
    return data.analysis?.meddic_score !== undefined;
  });

  stats.total = docsWithAnalysis.length;
  console.log(`Found ${stats.total} MEDDIC analyses to migrate`);

  // 分批處理
  for (let i = 0; i < docsWithAnalysis.length; i += migrationConfig.batchSize) {
    const batch = docsWithAnalysis.slice(i, i + migrationConfig.batchSize);

    for (const doc of batch) {
      const docId = doc.id;
      const convData = doc.data() as FirestoreConversation;

      try {
        // 檢查 lead_id
        if (!convData.lead_id) {
          stats.skipped++;
          continue;
        }

        // 映射資料
        const meddicAnalysis = mapMeddicAnalysis(docId, convData, convData.lead_id);

        if (!meddicAnalysis) {
          stats.skipped++;
          continue;
        }

        if (migrationConfig.verbose) {
          console.log(`Migrating MEDDIC analysis for ${docId}, score: ${meddicAnalysis.overallScore}`);
        }

        // 寫入資料庫
        if (!migrationConfig.dryRun) {
          await db.insert(meddicAnalyses).values(meddicAnalysis).onConflictDoNothing();
        }

        stats.success++;
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          id: docId,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`Failed to migrate MEDDIC analysis ${docId}:`, error);
      }
    }

    // 顯示進度
    const progress = Math.min(i + migrationConfig.batchSize, stats.total);
    console.log(`Progress: ${progress}/${stats.total} (${Math.round(progress / stats.total * 100)}%)`);
  }

  console.log(`✅ MEDDIC migration complete: ${stats.success} success, ${stats.failed} failed, ${stats.skipped} skipped`);
  return stats;
}
```

4. 建立 `scripts/migration/migrate-audio.ts`：

```typescript
// scripts/migration/migrate-audio.ts

import { gcsStorage, r2Config, migrationConfig } from './config';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import type { MigrationStats } from './types';

// R2 客戶端
const r2Client = new S3Client({
  region: 'auto',
  endpoint: r2Config.endpoint,
  credentials: {
    accessKeyId: r2Config.accessKeyId,
    secretAccessKey: r2Config.secretAccessKey,
  },
});

/**
 * 從 GCS URI 提取 bucket 和 path
 */
function parseGcsUri(gcsUri: string): { bucket: string; path: string } | null {
  // 格式: gs://bucket-name/path/to/file.mp3
  const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], path: match[2] };
}

/**
 * 檢查 R2 檔案是否已存在
 */
async function r2FileExists(key: string): Promise<boolean> {
  try {
    await r2Client.send(
      new HeadObjectCommand({
        Bucket: r2Config.bucket,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * 遷移單個音檔 GCS → R2
 */
export async function migrateAudioFile(gcsUri: string, conversationId: string): Promise<string> {
  const parsed = parseGcsUri(gcsUri);
  if (!parsed) {
    throw new Error(`Invalid GCS URI: ${gcsUri}`);
  }

  const r2Key = `audio/${conversationId}.mp3`;

  // 檢查是否已存在
  if (await r2FileExists(r2Key)) {
    console.log(`Audio file already exists in R2: ${r2Key}`);
    return `${r2Config.publicUrl}/${r2Key}`;
  }

  // 從 GCS 下載
  const bucket = gcsStorage.bucket(parsed.bucket);
  const file = bucket.file(parsed.path);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`GCS file not found: ${gcsUri}`);
  }

  const [buffer] = await file.download();

  // 上傳到 R2
  await r2Client.send(
    new PutObjectCommand({
      Bucket: r2Config.bucket,
      Key: r2Key,
      Body: buffer,
      ContentType: 'audio/mpeg',
    })
  );

  const r2Url = `${r2Config.publicUrl}/${r2Key}`;
  console.log(`Migrated audio: ${gcsUri} → ${r2Url}`);

  return r2Url;
}

/**
 * 批次遷移所有音檔（並行處理）
 */
export async function migrateAllAudioFiles(
  audioMappings: Array<{ gcsUri: string; conversationId: string }>
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: audioMappings.length,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  console.log('🎵 Starting Audio files migration...');
  console.log(`Found ${stats.total} audio files to migrate`);
  console.log(`Concurrency: ${migrationConfig.audioConcurrency}`);

  // 並行處理音檔
  const concurrency = migrationConfig.audioConcurrency;
  for (let i = 0; i < audioMappings.length; i += concurrency) {
    const batch = audioMappings.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map(async ({ gcsUri, conversationId }) => {
        if (migrationConfig.dryRun) {
          console.log(`[DRY RUN] Would migrate: ${gcsUri}`);
          return { success: true, conversationId };
        }

        await migrateAudioFile(gcsUri, conversationId);
        return { success: true, conversationId };
      })
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const { conversationId } = batch[j];

      if (result.status === 'fulfilled') {
        stats.success++;
      } else {
        stats.failed++;
        stats.errors.push({
          id: conversationId,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }

    // 顯示進度
    const progress = Math.min(i + concurrency, stats.total);
    console.log(`Audio Progress: ${progress}/${stats.total} (${Math.round(progress / stats.total * 100)}%)`);
  }

  console.log(`✅ Audio migration complete: ${stats.success} success, ${stats.failed} failed`);
  return stats;
}
```

**產出檔案**:
- `scripts/migration/migrate-leads.ts`
- `scripts/migration/migrate-conversations.ts`
- `scripts/migration/migrate-meddic.ts`
- `scripts/migration/migrate-audio.ts`

---

### Task 4: 驗證腳本

**目標**: 建立資料遷移驗證腳本

**步驟**:

1. 建立 `scripts/migration/validate.ts`：

```typescript
// scripts/migration/validate.ts

import { firestore, db } from './config';
import { opportunities, conversations, meddicAnalyses } from '@sales_ai_automation_v3/db/schema';
import { count, eq, isNull } from 'drizzle-orm';
import type { FirestoreConversation } from './types';

export interface ValidationCheck {
  name: string;
  passed: boolean;
  expected: number | string;
  actual: number | string;
  details?: string;
}

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  errors: string[];
  warnings: string[];
}

/**
 * 執行完整的遷移驗證
 */
export async function validateMigration(): Promise<ValidationResult> {
  const checks: ValidationCheck[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('🔍 Starting migration validation...\n');

  // Check 1: Leads/Opportunities 筆數
  const firestoreLeadsCount = (await firestore.collection('leads').count().get()).data().count;
  const [pgOpportunitiesCount] = await db.select({ count: count() }).from(opportunities);

  checks.push({
    name: 'Leads → Opportunities 筆數',
    passed: firestoreLeadsCount === pgOpportunitiesCount.count,
    expected: firestoreLeadsCount,
    actual: pgOpportunitiesCount.count,
  });

  // Check 2: Conversations 筆數
  const firestoreCasesCount = (await firestore.collection('sales_cases').count().get()).data().count;
  const [pgConversationsCount] = await db.select({ count: count() }).from(conversations);

  checks.push({
    name: 'Sales Cases → Conversations 筆數',
    passed: firestoreCasesCount === pgConversationsCount.count,
    expected: firestoreCasesCount,
    actual: pgConversationsCount.count,
  });

  // Check 3: MEDDIC Analyses 筆數
  const casesSnapshot = await firestore.collection('sales_cases').get();
  const expectedMeddicCount = casesSnapshot.docs.filter((doc) => {
    const data = doc.data() as FirestoreConversation;
    return data.analysis?.meddic_score !== undefined;
  }).length;

  const [pgMeddicCount] = await db.select({ count: count() }).from(meddicAnalyses);

  checks.push({
    name: 'MEDDIC Analyses 筆數',
    passed: expectedMeddicCount === pgMeddicCount.count,
    expected: expectedMeddicCount,
    actual: pgMeddicCount.count,
  });

  // Check 4: Orphaned Conversations（沒有對應 Opportunity 的 Conversation）
  const orphanedConversations = await db
    .select({ count: count() })
    .from(conversations)
    .leftJoin(opportunities, eq(conversations.opportunityId, opportunities.id))
    .where(isNull(opportunities.id));

  const orphanedCount = orphanedConversations[0]?.count ?? 0;

  checks.push({
    name: 'Orphaned Conversations（無對應商機）',
    passed: orphanedCount === 0,
    expected: 0,
    actual: orphanedCount,
    details: orphanedCount > 0 ? '有對話沒有對應的商機，請檢查外鍵關聯' : undefined,
  });

  // Check 5: 抽樣檢查 MEDDIC 分數一致性
  const sampleSize = 10;
  let scoreMatchCount = 0;
  let scoreMismatchDetails: string[] = [];

  const sampleCases = casesSnapshot.docs
    .filter((doc) => (doc.data() as FirestoreConversation).analysis?.meddic_score !== undefined)
    .slice(0, sampleSize);

  for (const doc of sampleCases) {
    const firestoreScore = (doc.data() as FirestoreConversation).analysis?.meddic_score;
    const pgAnalysis = await db.query.meddicAnalyses.findFirst({
      where: eq(meddicAnalyses.conversationId, doc.id),
    });

    if (pgAnalysis && pgAnalysis.overallScore === firestoreScore) {
      scoreMatchCount++;
    } else {
      scoreMismatchDetails.push(
        `${doc.id}: Firestore=${firestoreScore}, PG=${pgAnalysis?.overallScore ?? 'null'}`
      );
    }
  }

  const matchRate = sampleCases.length > 0 ? scoreMatchCount / sampleCases.length : 1;

  checks.push({
    name: `MEDDIC 分數一致性（抽樣 ${sampleSize} 筆）`,
    passed: matchRate >= 0.9,
    expected: '90%+',
    actual: `${(matchRate * 100).toFixed(1)}%`,
    details: scoreMismatchDetails.length > 0 ? scoreMismatchDetails.join(', ') : undefined,
  });

  // Check 6: 必填欄位檢查
  const [missingCustomerNumber] = await db
    .select({ count: count() })
    .from(opportunities)
    .where(isNull(opportunities.customerNumber));

  checks.push({
    name: '商機缺少 customerNumber',
    passed: (missingCustomerNumber?.count ?? 0) === 0,
    expected: 0,
    actual: missingCustomerNumber?.count ?? 0,
  });

  const [missingCaseNumber] = await db
    .select({ count: count() })
    .from(conversations)
    .where(isNull(conversations.caseNumber));

  checks.push({
    name: '對話缺少 caseNumber',
    passed: (missingCaseNumber?.count ?? 0) === 0,
    expected: 0,
    actual: missingCaseNumber?.count ?? 0,
  });

  // 輸出結果
  console.log('\n📋 Validation Results:\n');
  for (const check of checks) {
    const status = check.passed ? '✅' : '❌';
    console.log(`${status} ${check.name}`);
    console.log(`   Expected: ${check.expected}, Actual: ${check.actual}`);
    if (check.details) {
      console.log(`   Details: ${check.details}`);
    }
    if (!check.passed) {
      errors.push(`${check.name}: expected ${check.expected}, got ${check.actual}`);
    }
  }

  const passed = errors.length === 0;
  console.log(`\n${passed ? '✅ All checks passed!' : '❌ Some checks failed!'}\n`);

  return {
    passed,
    checks,
    errors,
    warnings,
  };
}
```

**產出檔案**:
- `scripts/migration/validate.ts`

---

### Task 5: 主入口和報告

**目標**: 建立遷移主入口和報告生成

**步驟**:

1. 建立 `scripts/migration/report.ts`：

```typescript
// scripts/migration/report.ts

import type { MigrationResult, MigrationStats } from './types';

/**
 * 生成遷移報告
 */
export function generateReport(result: MigrationResult): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                    V2 → V3 Migration Report                    ');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Started:   ${result.startedAt.toISOString()}`);
  lines.push(`Completed: ${result.completedAt.toISOString()}`);
  lines.push(`Duration:  ${result.duration.toFixed(2)} seconds`);
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('                         Summary                                ');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('');

  lines.push(formatStats('Leads → Opportunities', result.leads));
  lines.push(formatStats('Conversations', result.conversations));
  lines.push(formatStats('MEDDIC Analyses', result.meddicAnalyses));
  lines.push(formatStats('Audio Files', result.audioFiles));

  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('                         Errors                                 ');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('');

  const allErrors = [
    ...result.leads.errors.map((e) => `[Lead] ${e.id}: ${e.error}`),
    ...result.conversations.errors.map((e) => `[Conversation] ${e.id}: ${e.error}`),
    ...result.meddicAnalyses.errors.map((e) => `[MEDDIC] ${e.id}: ${e.error}`),
    ...result.audioFiles.errors.map((e) => `[Audio] ${e.id}: ${e.error}`),
  ];

  if (allErrors.length === 0) {
    lines.push('No errors!');
  } else {
    for (const error of allErrors.slice(0, 50)) {
      lines.push(`  • ${error}`);
    }
    if (allErrors.length > 50) {
      lines.push(`  ... and ${allErrors.length - 50} more errors`);
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

function formatStats(name: string, stats: MigrationStats): string {
  const successRate =
    stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : '100.0';

  return [
    `${name}:`,
    `  Total:   ${stats.total}`,
    `  Success: ${stats.success} (${successRate}%)`,
    `  Failed:  ${stats.failed}`,
    `  Skipped: ${stats.skipped}`,
    '',
  ].join('\n');
}
```

2. 建立 `scripts/migration/index.ts`：

```typescript
// scripts/migration/index.ts

import { migrateLeads } from './migrate-leads';
import { migrateConversations } from './migrate-conversations';
import { migrateMeddicAnalyses } from './migrate-meddic';
import { validateMigration } from './validate';
import { generateReport } from './report';
import type { MigrationResult, MigrationStats } from './types';

const emptyStats: MigrationStats = {
  total: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  errors: [],
};

async function main() {
  console.log('🚀 Starting V2 → V3 Migration...\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const startedAt = new Date();
  const startTime = Date.now();

  const result: MigrationResult = {
    leads: emptyStats,
    conversations: emptyStats,
    meddicAnalyses: emptyStats,
    audioFiles: emptyStats,
    duration: 0,
    startedAt,
    completedAt: new Date(),
  };

  try {
    // Phase 1: Migrate Leads → Opportunities
    console.log('\n📊 Phase 1: Migrating Leads...\n');
    result.leads = await migrateLeads();

    // Phase 2: Migrate Conversations (includes audio)
    console.log('\n💬 Phase 2: Migrating Conversations...\n');
    result.conversations = await migrateConversations();

    // Phase 3: Migrate MEDDIC Analyses
    console.log('\n📈 Phase 3: Migrating MEDDIC Analyses...\n');
    result.meddicAnalyses = await migrateMeddicAnalyses();

    // Phase 4: Validate Migration
    console.log('\n🔍 Phase 4: Validating Migration...\n');
    const validation = await validateMigration();

    if (!validation.passed) {
      console.error('\n❌ Validation failed!');
      console.error('Errors:', validation.errors);
      process.exitCode = 1;
    }

    // Generate Report
    result.completedAt = new Date();
    result.duration = (Date.now() - startTime) / 1000;

    const report = generateReport(result);
    console.log('\n' + report);

    // Save report to file
    const reportPath = `migration-report-${startedAt.toISOString().replace(/[:.]/g, '-')}.txt`;
    await Bun.write(reportPath, report);
    console.log(`\n📄 Report saved to: ${reportPath}`);

    if (validation.passed) {
      console.log('\n🎉 Migration completed successfully!\n');
    }
  } catch (error) {
    console.error('\n❌ Migration failed with error:', error);
    process.exitCode = 1;
  }
}

main();
```

3. 建立 `scripts/migration/rollback.ts`：

```typescript
// scripts/migration/rollback.ts

import { db } from './config';
import { opportunities, conversations, meddicAnalyses } from '@sales_ai_automation_v3/db/schema';
import { eq } from 'drizzle-orm';

/**
 * 回滾遷移資料（僅刪除 source='migration' 的資料）
 */
async function rollback() {
  console.log('🔄 Starting migration rollback...\n');
  console.log('⚠️  WARNING: This will delete all migrated data!\n');

  // 確認
  const confirmEnv = process.env.CONFIRM_ROLLBACK;
  if (confirmEnv !== 'yes') {
    console.log('To proceed, set CONFIRM_ROLLBACK=yes');
    process.exit(1);
  }

  try {
    // 1. 刪除 MEDDIC Analyses（先刪除，因為有 FK）
    console.log('Deleting MEDDIC analyses...');
    const meddicResult = await db.delete(meddicAnalyses);
    console.log(`Deleted MEDDIC analyses`);

    // 2. 刪除 Conversations
    console.log('Deleting conversations...');
    const convResult = await db.delete(conversations);
    console.log(`Deleted conversations`);

    // 3. 刪除 Opportunities（source='migration'）
    console.log('Deleting migrated opportunities...');
    const oppResult = await db
      .delete(opportunities)
      .where(eq(opportunities.source, 'migration'));
    console.log(`Deleted migrated opportunities`);

    console.log('\n✅ Rollback completed successfully!');
  } catch (error) {
    console.error('\n❌ Rollback failed:', error);
    process.exit(1);
  }
}

rollback();
```

**產出檔案**:
- `scripts/migration/report.ts`
- `scripts/migration/index.ts`
- `scripts/migration/rollback.ts`

---

### Task 6: 遷移進度管理（斷點續傳）

**目標**: 建立遷移進度持久化機制，支援中斷後繼續遷移

**步驟**:

1. 建立 `scripts/migration/progress.ts`：

```typescript
// scripts/migration/progress.ts

import type { MigrationProgress } from './types';

const PROGRESS_FILE = 'migration-progress.json';

/**
 * 讀取遷移進度
 */
export async function loadProgress(): Promise<MigrationProgress | null> {
  try {
    const file = Bun.file(PROGRESS_FILE);
    if (await file.exists()) {
      const content = await file.text();
      return JSON.parse(content) as MigrationProgress;
    }
  } catch (error) {
    console.warn('Failed to load migration progress:', error);
  }
  return null;
}

/**
 * 儲存遷移進度
 */
export async function saveProgress(progress: MigrationProgress): Promise<void> {
  progress.updatedAt = new Date();
  await Bun.write(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * 清除遷移進度
 */
export async function clearProgress(): Promise<void> {
  try {
    const file = Bun.file(PROGRESS_FILE);
    if (await file.exists()) {
      await Bun.write(PROGRESS_FILE, '');
    }
  } catch (error) {
    console.warn('Failed to clear migration progress:', error);
  }
}

/**
 * 建立新的遷移進度
 */
export function createProgress(): MigrationProgress {
  return {
    completedPhases: [],
    updatedAt: new Date(),
  };
}
```

2. 在 `migrate-leads.ts` 加入進度追蹤：

```typescript
// 在 migrateLeads 函數開頭加入
import { loadProgress, saveProgress } from './progress';

export async function migrateLeads(resumeFromId?: string): Promise<MigrationStats> {
  // ... 原有邏輯 ...

  // 在成功處理每筆後更新進度
  const progress = await loadProgress() || createProgress();
  progress.lastProcessedLeadId = docId;
  await saveProgress(progress);

  // ... 繼續處理 ...
}
```

**產出檔案**:
- `scripts/migration/progress.ts`

---

### Task 7: package.json scripts 設定

**目標**: 新增 migration 相關的 npm scripts

**步驟**:

在根目錄 `package.json` 加入：

```json
{
  "scripts": {
    "migration:dry-run": "DRY_RUN=true bun run scripts/migration/index.ts",
    "migration:run": "bun run scripts/migration/index.ts",
    "migration:verbose": "VERBOSE=true bun run scripts/migration/index.ts",
    "migration:validate": "bun run scripts/migration/validate.ts",
    "migration:rollback": "bun run scripts/migration/rollback.ts"
  }
}
```

**產出檔案**:
- 更新 `package.json`

---

## 驗收標準

- [ ] Firebase Admin SDK 連接成功
- [ ] Leads 完整遷移到 opportunities
- [ ] Conversations 完整遷移（含所有 V2 特有欄位）
- [ ] MEDDIC Analyses 完整遷移（含 agentOutputs）
- [ ] 音檔從 GCS 遷移到 R2（並行處理）
- [ ] 驗證腳本 7 項檢查全部通過
- [ ] Rollback 機制可正常運作
- [ ] 遷移報告正確生成
- [ ] 斷點續傳機制可正常運作
- [ ] package.json scripts 可正常執行

---

## 執行指令

```bash
# 乾跑模式（不實際寫入）
DRY_RUN=true bun run scripts/migration/index.ts

# 正式執行（詳細輸出）
VERBOSE=true bun run scripts/migration/index.ts

# 正式執行
bun run scripts/migration/index.ts

# 驗證
bun run scripts/migration/validate.ts

# 回滾
CONFIRM_ROLLBACK=yes bun run scripts/migration/rollback.ts
```

---

## 環境變數

```env
# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY=your-access-key
CLOUDFLARE_R2_SECRET_KEY=your-secret-key
CLOUDFLARE_R2_BUCKET=sales-ai-audio
CLOUDFLARE_R2_PUBLIC_URL=https://your-custom-domain.com  # 或使用 R2.dev public URL

# PostgreSQL (already configured)
DATABASE_URL=postgresql://...

# Migration options
DRY_RUN=false
VERBOSE=false
```

---

## 產出檔案總覽

```
scripts/migration/
├── config.ts          # 環境設定、重試機制
├── types.ts           # 型別定義（含 MigrationProgress）
├── progress.ts        # 遷移進度管理（斷點續傳）
├── mappers/
│   ├── index.ts
│   ├── lead-mapper.ts
│   ├── conversation-mapper.ts
│   └── meddic-mapper.ts
├── migrate-leads.ts
├── migrate-conversations.ts
├── migrate-meddic.ts
├── migrate-audio.ts   # 含並行處理
├── validate.ts
├── report.ts
├── rollback.ts
└── index.ts
```

---

## 注意事項

### Drizzle ORM Query Relations
`validate.ts` 使用 `db.query.meddicAnalyses.findFirst()`，需確認 Drizzle 已設定 query relations。如未設定，請在 `packages/db/src/index.ts` 加入：

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export const db = drizzle(pool, { schema });
```

### R2 Public Access
音檔 URL 需要可公開存取，請確認：
1. 在 Cloudflare R2 Dashboard 開啟 bucket 的 public access，或
2. 設定自訂網域 (Custom Domain)

### 型別匯出
確認 `@sales_ai_automation_v3/db/schema` 有匯出以下型別：
- `NewOpportunity`
- `NewConversation`
- `NewMeddicAnalysis`
