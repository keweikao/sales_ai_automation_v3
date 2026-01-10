# Sales AI Automation V3 平行開發策略

## 專案概述

這是一個從 V2 遷移到 V3 的 B2B 銷售自動化系統，核心功能是使用 MEDDIC 方法論分析銷售對話，提供 AI 驅動的銷售洞察。

**V2 → V3 遷移目標**:
- **開發效率**: TypeScript 全端類型安全，減少 runtime 錯誤（取代 Python + TypeScript 雙語言維護）
- **部署速度**: Cloudflare Workers 邊緣部署，0ms 冷啟動（取代 Google Cloud Run）
- **維護成本**: 統一技術棧，減少基礎設施複雜度（從 GCP 遷移到 Cloudflare + Neon）
- **擴展性**: Monorepo 架構，更好的程式碼重用與類型共享

**V3 技術棧**: Better-T-Stack (React + TanStack Router + Hono + oRPC + Drizzle + PostgreSQL + Cloudflare Workers)

**核心功能**:
1. Lead（潛在客戶）管理
2. 對話記錄與轉錄（音檔 → 文字，使用 Groq Whisper）
3. MEDDIC 六維度分析（使用 Google Gemini 2.0）
4. 即時 Coach Agent（規則導向警示 + Thread 對話）
5. CRM 資料自動萃取（Salesforce 整合）
6. Slack Bot 整合
7. 從 Firestore 遷移到 PostgreSQL

**V2 系統現況**:
- **生產就緒**: 已在實際環境運作，處理 ~300 cases/月
- **效能指標**: 端對端 <2 分鐘（37.5 分鐘音檔）
- **成本效率**: 月成本 ~$15 USD
- **核心技術**: Python FastAPI + Firestore + Google Cloud Run + Groq Whisper + Gemini 2.0

---

## 平行開發策略總覽

### 開發階段依賴關係

```
Phase 1: 基礎建設（3 個工作流可並行）
├── Workflow A: Database Schema
├── Workflow B: UI Components
└── Workflow C: External Services
         │
         ▼
Phase 2: 核心功能（3 個工作流可並行，依賴 Phase 1）
├── Workflow D: API Routes (依賴 A, C)
├── Workflow E: Frontend Pages (依賴 B, D)
└── Workflow F: Slack Bot (依賴 C, D)
         │
         ▼
Phase 3: 整合測試（1 個工作流）
└── Workflow G: Integration Testing
         │
         ▼
Phase 4: 資料遷移（1 個工作流）
└── Workflow H: Data Migration
         │
         ▼
Phase 5: 部署上線（1 個工作流）
└── Workflow I: Production Deployment
```

### 團隊分配建議

**3 人團隊配置**:
- **Developer A**: 負責 Workflow A + D（後端/資料庫專家）
- **Developer B**: 負責 Workflow B + E（前端/UI 專家）
- **Developer C**: 負責 Workflow C + F（整合/DevOps 專家）

**5 人團隊配置**:
- **Developer 1**: Workflow A（資料庫）
- **Developer 2**: Workflow B + E（前端）
- **Developer 3**: Workflow C（外部服務整合）
- **Developer 4**: Workflow D（API）
- **Developer 5**: Workflow F + 後續測試部署（Slack Bot + DevOps）

---

## V2 已完成功能評估與遷移策略

### V2 核心功能盤點

#### ✅ 必須保留並遷移的功能

**1. 六大 AI Agent 系統**
- ✅ Agent 1: Context Agent（會議背景分析）
- ✅ Agent 2: Buyer Agent（MEDDIC 核心分析）
- ✅ Agent 3: Seller Agent（銷售策略評估）
- ✅ Agent 4: Summary Agent（客戶導向摘要）
- ✅ Agent 5: CRM Extractor（Salesforce 欄位提取）
- ✅ Agent 6: Coach Agent（即時教練與警示）

**2. Multi-Agent Orchestrator**
- ✅ 七階段執行流程（並行 + 序列混合）
- ✅ 品質迴圈（Quality Loop）：最多 2 次 refine
- ✅ 條件式 Agent 執行（競爭對手偵測）
- ✅ 韌性機制：重試邏輯 + 指數退避

**3. MEDDIC 評分機制**
- ✅ 六維度評分（1-5 分）
- ✅ 加權總分計算（1-100）
- ✅ 資格門檻：Qualified ≥70, Partially Qualified ≥40
- ✅ 狀態分類：Strong/Medium/Weak/At Risk

**4. Groq Whisper 轉錄 Pipeline**
- ✅ 自動分塊（>24MB 或 >10 分鐘）
- ✅ 228x 實時速度
- ✅ 中文語言優化
- ✅ 時間戳標記

**5. Slack Bot 整合**
- ✅ 即時警示（Close Now, 錯失決策者, 優異表現）
- ✅ Thread 對話（情境化 Coach 回應）
- ✅ Manager 警示（連續 3 次低分）
- ✅ Slack Block UI（MEDDIC 摘要、Lead 卡片）

**6. Firestore 資料結構**
- ✅ `sales_cases` Collection（對話記錄 + 分析結果）
- ✅ `leads` Collection（潛客管理）
- ✅ Repository Pattern 資料存取層

**7. FastAPI 端點**
- ✅ Conversations CRUD（list, getById, analysis）
- ✅ Leads CRUD
- ✅ Analytics（dashboard, weekly-report, trends）

#### 🔄 需要重構的功能

**1. 轉錄服務提供者選擇**
- V2: Groq Whisper（主要）+ Gemini（備用）
- V3 計劃: Deepgram
- **建議**: 保留 Groq Whisper（成本效益更高：$0.04/hr vs Deepgram）

**2. 音檔儲存**
- V2: Google Cloud Storage
- V3 計劃: Cloudflare R2
- **遷移需求**: GCS → R2 批次遷移腳本

**3. 部署環境**
- V2: Google Cloud Run
- V3: Cloudflare Workers
- **差異**: 需要調整 CORS、環境變數、檔案上傳處理

#### ❌ 可以淘汰的功能

**1. Python 後端**
- 完全用 TypeScript Hono 取代
- 所有業務邏輯遷移到 oRPC

**2. Firestore**
- 遷移到 PostgreSQL（Neon）
- 更好的關聯查詢與交易支援

**3. Firebase Admin SDK**
- 改用 Cloudflare Workers 原生功能

### V2 → V3 資料遷移策略

#### Firestore Schema 映射到 PostgreSQL

**V2 Firestore `sales_cases` → V3 PostgreSQL**

| Firestore 欄位 | PostgreSQL 欄位 | 轉換邏輯 | 資料類型變更 |
|----------------|-----------------|----------|--------------|
| `id` (document ID) | `id` | 直接複製 | text |
| `lead_id` | `lead_id` | 直接複製 | text |
| `sales_rep` | `sales_rep` | 直接複製 | text |
| `status` | `status` | 直接複製 | text (enum) |
| `type` | `type` | 直接複製 | text (enum) |
| `occurred_at` (timestamp) | `conversation_date` | Firestore.Timestamp → Date | timestamp |
| `created_at` | `created_at` | Firestore.Timestamp → Date | timestamp |
| `updated_at` | `updated_at` | Firestore.Timestamp → Date | timestamp |
| `transcript.segments[]` | `transcript` (jsonb) | 保持 JSON 結構 | jsonb |
| `transcript.full_text` | `transcript` (jsonb) | 嵌套在 jsonb 內 | jsonb |
| `transcript.language` | `transcript` (jsonb) | 嵌套在 jsonb 內 | jsonb |
| `transcript.duration` | `duration` | 提取為獨立欄位 | integer (秒數) |
| `analysis.meddic_score` | → `meddic_analyses.overall_score` | 拆分到關聯表 | integer |
| `analysis.progress_score` | 新增欄位 `progress_score` | 加入 conversations 表 | integer |
| `analysis.executive_summary` | `summary` | 直接映射 | text |
| `analysis.buyer_signals` | → `meddic_analyses.dimensions` | 拆分到 jsonb | jsonb |
| `analysis.qualification_status` | → `meddic_analyses.status` | 拆分到關聯表 | text |
| `analysis.coaching_notes` | 新增欄位 `coaching_notes` | 加入 conversations 表 | text |
| `analysis.urgency_level` | 新增欄位 `urgency_level` | 加入 conversations 表 | text |
| `analysis.store_name` | 新增欄位 `store_name` | 加入 conversations 表 | text |
| `analysis.agent_data.buyer` | → `meddic_analyses.agent_outputs` | 合併為 jsonb | jsonb |
| `analysis.agent_data.seller` | → `meddic_analyses.agent_outputs` | 合併為 jsonb | jsonb |
| `analysis.agent_data.context` | → `meddic_analyses.agent_outputs` | 合併為 jsonb | jsonb |
| `analysis.agent_data.summary` | → `meddic_analyses.agent_outputs` | 合併為 jsonb | jsonb |
| (新增) | `audio_url` | 從 GCS 轉換為 R2 URL | text |
| (新增) | `sentiment` | 從 buyer analysis 提取 | text |

**V2 Firestore `leads` → V3 PostgreSQL**

| Firestore 欄位 | PostgreSQL 欄位 | 轉換邏輯 | 資料類型變更 |
|----------------|-----------------|----------|--------------|
| `id` | `id` | 直接複製 | text |
| `email` | `contact_email` | 欄位重新命名 | text |
| `status` | `status` | 映射到新 enum | text (enum) |
| `score` | `lead_score` | 直接複製 | integer |
| `created_at` | `created_at` | Firestore.Timestamp → Date | timestamp |
| `updated_at` | `updated_at` | Firestore.Timestamp → Date | timestamp |
| (缺失) | `company_name` | **需要補充** | text (NOT NULL) |
| (缺失) | `contact_name` | 從 conversations 推斷 | text |
| (缺失) | `source` | 預設值 "manual" | text |
| (新增) | `meddic_score` | 從最新 conversation 計算 | jsonb |

**V2 狀態映射到 V3**

```typescript
// V2 LeadStatus (Python Enum)
V2: new | contacted | qualified | converted

// V3 Lead Status
V3: new | contacted | qualified | proposal | negotiation | won | lost

// 映射邏輯
const statusMapping = {
  'new': 'new',
  'contacted': 'contacted',
  'qualified': 'qualified',
  'converted': 'won'  // V2 的 converted 視為 V3 的 won
}
```

#### Migration Script 架構

```typescript
// scripts/migrate-firestore-to-postgres.ts

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { db } from '@Sales_ai_automation_v3/db';
import { leads, conversations, meddicAnalyses } from '@Sales_ai_automation_v3/db/schema';

// Phase 1: 遷移 Leads
async function migrateLeads() {
  const snapshot = await firestore.collection('leads').get();

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // 從最新 conversation 推斷 company_name
    const latestConv = await getLatestConversation(doc.id);

    await db.insert(leads).values({
      id: doc.id,
      companyName: latestConv?.store_name || 'Unknown',
      contactEmail: data.email,
      source: 'manual',
      status: mapLeadStatus(data.status),
      leadScore: data.score,
      createdAt: data.created_at?.toDate(),
      updatedAt: data.updated_at?.toDate(),
    });
  }
}

// Phase 2: 遷移 Conversations
async function migrateConversations() {
  const snapshot = await firestore.collection('sales_cases').get();

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // 插入 conversations 表
    await db.insert(conversations).values({
      id: doc.id,
      leadId: data.lead_id,
      title: data.analysis?.store_name || `Conversation ${doc.id.slice(0, 8)}`,
      type: mapConversationType(data.type),
      status: mapConversationStatus(data.status),
      audioUrl: await migrateGcsToR2(data.audio_gcs_uri),
      transcript: {
        segments: data.transcript?.segments || [],
        full_text: data.transcript?.full_text || '',
        language: data.transcript?.language || 'zh-TW',
      },
      summary: data.analysis?.executive_summary,
      duration: data.transcript?.duration,
      conversationDate: data.occurred_at?.toDate(),
      createdAt: data.created_at?.toDate(),
      participants: extractParticipants(data.analysis?.agent_data?.context),
      // V2 特有欄位保留
      progressScore: data.analysis?.progress_score,
      coachingNotes: data.analysis?.coaching_notes,
      urgencyLevel: data.analysis?.urgency_level,
      storeName: data.analysis?.store_name,
    });

    // Phase 3: 遷移 MEDDIC Analysis（如果有分析結果）
    if (data.analysis?.meddic_score) {
      await db.insert(meddicAnalyses).values({
        id: crypto.randomUUID(),
        conversationId: doc.id,
        leadId: data.lead_id,

        // 六個維度評分（從 agent_data.buyer 提取）
        metricsScore: extractMeddicScore(data, 'metrics'),
        economicBuyerScore: extractMeddicScore(data, 'economic_buyer'),
        decisionCriteriaScore: extractMeddicScore(data, 'decision_criteria'),
        decisionProcessScore: extractMeddicScore(data, 'decision_process'),
        identifyPainScore: extractMeddicScore(data, 'identify_pain'),
        championScore: extractMeddicScore(data, 'champion'),

        overallScore: data.analysis.meddic_score,
        status: data.analysis.qualification_status,

        // 詳細分析資料
        dimensions: data.analysis.buyer_signals,
        keyFindings: extractKeyFindings(data.analysis),
        nextSteps: extractNextSteps(data.analysis),
        risks: extractRisks(data.analysis),

        // 保留原始 Agent 輸出
        agentOutputs: data.analysis.agent_data,

        createdAt: data.updated_at?.toDate(),
      });
    }
  }
}

// Helper: GCS → R2 遷移
async function migrateGcsToR2(gcsUri: string): Promise<string> {
  // 1. 從 GCS 下載檔案
  const buffer = await downloadFromGCS(gcsUri);

  // 2. 上傳到 R2
  const r2Key = `audio/${crypto.randomUUID()}.mp3`;
  await uploadToR2(buffer, r2Key);

  // 3. 返回 R2 URL
  return `https://your-r2-bucket.r2.cloudflarestorage.com/${r2Key}`;
}

// Helper: 提取 MEDDIC 分數
function extractMeddicScore(data: any, dimension: string): number | null {
  const buyerData = data.analysis?.agent_data?.buyer;
  if (!buyerData) return null;

  // V2 的 buyer agent 返回結構化 JSON
  const scores = buyerData.meddic_scores || {};
  return scores[dimension] || null;
}

// Main Migration
async function main() {
  console.log('Starting Firestore → PostgreSQL migration...');

  await migrateLeads();
  console.log('✅ Leads migrated');

  await migrateConversations();
  console.log('✅ Conversations migrated');

  // 驗證資料完整性
  await validateMigration();
  console.log('✅ Migration complete!');
}
```

#### 遷移檢查清單

**資料完整性驗證**
- [ ] Firestore `leads` 筆數 = PostgreSQL `leads` 筆數
- [ ] Firestore `sales_cases` 筆數 = PostgreSQL `conversations` 筆數
- [ ] 所有有 `analysis.meddic_score` 的 case 都有對應的 `meddic_analyses` 記錄
- [ ] 所有 `lead_id` 外鍵關聯正確
- [ ] 所有 `conversation_id` 外鍵關聯正確
- [ ] 音檔 URL 全部從 GCS 遷移到 R2

**欄位轉換驗證**
- [ ] 所有 Timestamp 正確轉換為 Date
- [ ] 所有 enum 值符合新 schema 定義
- [ ] JSONB 欄位結構正確（transcript, meddic_score, dimensions）
- [ ] 無 NULL 值在 NOT NULL 欄位

**業務邏輯驗證**
- [ ] MEDDIC 總分計算正確（加權平均）
- [ ] Lead status 映射正確
- [ ] Conversation type 映射正確
- [ ] 最新的 MEDDIC 分數正確關聯到 Lead

#### 雙寫期間策略

為了確保零停機遷移，建議使用**雙寫模式**：

**階段 1: 準備期（1 週）**
- V3 系統建置完成
- Migration script 在測試環境驗證
- V2 系統繼續運作

**階段 2: 雙寫期（2 週）**
- V2 系統繼續運作（主要）
- 新資料同步寫入 V3 PostgreSQL
- V3 系統僅供內部測試

**階段 3: 切換期（3 天）**
- 執行完整的歷史資料遷移
- 驗證 V3 系統資料完整性
- 將流量逐步切換到 V3（10% → 50% → 100%）

**階段 4: 退役期（1 個月）**
- V3 成為主系統
- V2 只讀模式（僅供查詢歷史資料）
- 1 個月後完全下線 V2

### V2 Prompt Engineering 保留策略

V2 的 Prompt 已經過生產環境驗證，**必須完整保留**：

**遷移到 V3 的位置**
```
packages/services/prompts/meddic/
├── global-context.md           # iCHEF 業務框架（三層承諾事件）
├── agent1-context.md          # 會議背景分析
├── agent2-buyer.md            # MEDDIC 方法論（核心）
├── agent3-seller.md           # 銷售策略評估
├── agent4-summary.md          # 客戶導向摘要
├── agent5-crm-extractor.md    # CRM 欄位提取（原 agent6）
└── agent6-coach.md            # 即時教練系統
```

**Prompt 加載機制**
```typescript
// packages/services/src/llm/prompts.ts
import fs from 'fs';
import path from 'path';

const PROMPTS_DIR = path.join(__dirname, '../prompts/meddic');

export function loadPrompt(agentName: string): string {
  const filePath = path.join(PROMPTS_DIR, `${agentName}.md`);
  return fs.readFileSync(filePath, 'utf-8');
}

export const GLOBAL_CONTEXT = loadPrompt('global-context');
export const AGENT1_PROMPT = loadPrompt('agent1-context');
export const AGENT2_PROMPT = loadPrompt('agent2-buyer');
export const AGENT3_PROMPT = loadPrompt('agent3-seller');
export const AGENT4_PROMPT = loadPrompt('agent4-summary');
export const AGENT5_PROMPT = loadPrompt('agent5-crm-extractor');
export const AGENT6_PROMPT = loadPrompt('agent6-coach');
```

### V2 Multi-Agent Orchestrator 遷移

V2 的 Orchestrator 邏輯**必須保留**，這是系統的核心智慧：

**遷移到 V3**
```typescript
// packages/services/src/llm/orchestrator.ts

interface AnalysisState {
  transcript: Array<{ speaker: string; text: string; start: number; end: number }>;
  metadata: {
    leadId: string;
    salesRep: string;
    conversationDate: Date;
  };

  // Agent 結果快取
  contextData?: any;
  buyerData?: any;
  sellerData?: any;
  summaryData?: any;
  crmData?: any;
  coachData?: any;

  // 品質控制
  qualityEval?: any;
  refinementCount: number;

  // 條件式執行
  hasCompetitor: boolean;
  competitorKeywords: string[];
}

export class MeddicOrchestrator {
  constructor(
    private geminiClient: GeminiClient
  ) {}

  async analyze(state: AnalysisState): Promise<AnalysisResult> {
    // Phase 1: 並行執行 Context + Buyer
    const [contextData, buyerData] = await Promise.all([
      this.runAgent1(state.transcript, state.metadata),
      this.runAgent2(state.transcript),
    ]);
    state.contextData = contextData;
    state.buyerData = buyerData;

    // Phase 2: 品質迴圈
    while (!this.isQualityPassed(state.buyerData) && state.refinementCount < 2) {
      state.buyerData = await this.refineAgent2(state);
      state.refinementCount++;
    }

    // Phase 3: 條件式競爭對手分析
    if (this.detectCompetitor(state.transcript)) {
      state.hasCompetitor = true;
      // 可擴展 competitor agent
    }

    // Phase 4-7: 序列執行
    state.sellerData = await this.runAgent3(state);
    state.summaryData = await this.runAgent4(state.transcript);
    state.crmData = await this.runAgent5(state);
    state.coachData = await this.runAgent6(state);

    return this.buildResult(state);
  }

  private isQualityPassed(buyerData: any): boolean {
    // V2 的品質檢查邏輯
    return (
      buyerData.needs_identified &&
      buyerData.pain_points?.length > 0 &&
      buyerData.meddic_scores &&
      buyerData.trust_assessment
    );
  }

  private detectCompetitor(transcript: any[]): boolean {
    const keywords = ['競爭對手', 'competitor', '其他廠商', 'POS'];
    const fullText = transcript.map(t => t.text).join(' ');
    return keywords.some(kw => fullText.includes(kw));
  }
}
```

---

## Phase 1: 基礎建設（可完全並行）

### Workflow A: Database Schema
**負責人**: Backend/Database Developer
**預估時間**: 2-3 工作日
**前置依賴**: 無

#### 任務清單
1. ✅ 檢查現有 auth schema（已由 Better-Auth 建立）
2. 建立新 schema 檔案
3. 設定 foreign key 關聯
4. ⭐ 加入 V2 特有欄位（progressScore, urgencyLevel, storeName 等）
5. 產生並推送 migration

#### 檔案清單
```
packages/db/src/schema/
├── lead.ts         # 潛在客戶表
├── conversation.ts # 對話記錄表（含 V2 特有欄位）
├── meddic.ts       # MEDDIC 分析表
├── user.ts         # 使用者擴展欄位
└── index.ts        # 更新匯出
```

#### 技術細節
- 使用 Drizzle ORM 的 `pgTable`, `text`, `timestamp`, `integer`, `jsonb`
- Lead 與 Conversation 一對多關係
- Conversation 與 MEDDIC Analysis 一對一關係
- 所有 ID 使用 `crypto.randomUUID()`
- ⭐ **V2 遷移重點**: conversation 表需包含 V2 的特有欄位

#### Schema 定義重點

**Conversation Schema（含 V2 欄位）**
```typescript
// packages/db/src/schema/conversation.ts
import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';

export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull(),

  // 基本資訊
  title: text('title'),
  type: text('type').notNull(), // discovery_call, demo, follow_up, negotiation, closing, support
  status: text('status').notNull().default('pending'), // pending, transcribing, analyzing, completed, failed

  // 內容
  audioUrl: text('audio_url'),
  transcript: jsonb('transcript'), // { segments: [], full_text: '', language: '' }
  summary: text('summary'),

  // 分析結果
  meddicAnalysis: jsonb('meddic_analysis'), // 快速存取，完整資料在 meddic_analyses 表
  extractedData: jsonb('extracted_data'), // CRM 萃取結果
  sentiment: text('sentiment'), // positive, neutral, negative

  // ⭐ V2 特有欄位（必須保留以支援 Firestore 遷移）
  progressScore: integer('progress_score'),        // V2 的進度評分（與 MEDDIC score 不同）
  coachingNotes: text('coaching_notes'),          // Coach Agent 產生的建議
  urgencyLevel: text('urgency_level'),            // high, medium, low
  storeName: text('store_name'),                  // iCHEF 客戶的店名（重要業務欄位）

  // 時間
  duration: integer('duration'), // 秒數
  conversationDate: timestamp('conversation_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  analyzedAt: timestamp('analyzed_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),

  // 關聯
  participants: jsonb('participants'), // [{ name, role, company }]
  createdBy: text('created_by'),
});

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
```

**MEDDIC Analysis Schema（含 V2 agent_outputs）**
```typescript
// packages/db/src/schema/meddic.ts
import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';

export const meddicAnalyses = pgTable('meddic_analyses', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  leadId: text('lead_id').notNull(),

  // 六個維度評分 (1-5)
  metricsScore: integer('metrics_score'),
  economicBuyerScore: integer('economic_buyer_score'),
  decisionCriteriaScore: integer('decision_criteria_score'),
  decisionProcessScore: integer('decision_process_score'),
  identifyPainScore: integer('identify_pain_score'),
  championScore: integer('champion_score'),

  // 整體評分
  overallScore: integer('overall_score'), // 1-100（加權計算）
  status: text('status'), // Strong, Medium, Weak, At Risk

  // 詳細分析（V2 buyer_signals）
  dimensions: jsonb('dimensions'), // 每個維度的 evidence, gaps, recommendations
  keyFindings: jsonb('key_findings'), // 3-5 個最重要洞察
  nextSteps: jsonb('next_steps'), // 具體可執行步驟
  risks: jsonb('risks'), // 潛在問題

  // ⭐ V2 原始 Agent 輸出（保留以支援未來分析）
  agentOutputs: jsonb('agent_outputs'), // { agent1: {...}, agent2: {...}, ...agent6: {...} }

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type MeddicAnalysis = typeof meddicAnalyses.$inferSelect;
export type NewMeddicAnalysis = typeof meddicAnalyses.$inferInsert;
```

#### 驗證標準
- `bun run db:generate` 成功產生 migration
- `bun run db:push` 無錯誤推送到 Neon
- `bun run db:studio` 可視化檢查所有表結構
- TypeScript 類型推斷正確（`Lead`, `NewLead`, `Conversation`, `MeddicAnalysis` 等）
- ⭐ V2 特有欄位（progressScore, urgencyLevel, storeName, agentOutputs）都存在

#### 交付物
- 4 個新 schema 檔案
- 更新的 `packages/db/src/schema/index.ts`
- Migration SQL 檔案

#### V2 遷移相容性
✅ **向後相容**: Schema 設計支援從 Firestore 完整遷移所有 V2 資料
✅ **向前擴展**: 可選欄位允許未來新增功能而不破壞現有資料

---

### Workflow B: UI Components
**負責人**: Frontend Developer
**預估時間**: 3-4 工作日
**前置依賴**: 無（可使用 mock data）

#### 任務清單
1. 安裝 UI 相關套件
2. 建立 Lead 相關元件（4 個）
3. 建立 Conversation 相關元件（3 個）
4. 建立 MEDDIC 視覺化元件（3 個）
5. 建立通用元件（3 個）

#### 檔案清單
```
apps/web/src/components/
├── lead/
│   ├── lead-table.tsx           # 使用 TanStack Table
│   ├── lead-card.tsx            # Card 顯示單一 Lead
│   ├── lead-form.tsx            # 新增/編輯表單
│   └── lead-status-badge.tsx   # 狀態徽章
├── conversation/
│   ├── conversation-list.tsx    # 對話列表
│   ├── conversation-player.tsx  # 音檔播放器
│   └── transcript-viewer.tsx    # 轉錄文字檢視器
├── meddic/
│   ├── meddic-radar-chart.tsx   # Recharts 雷達圖
│   ├── meddic-score-card.tsx    # 六維度評分卡
│   └── meddic-dimension-detail.tsx # 單一維度詳情
└── common/
    ├── data-table.tsx           # 通用資料表格
    ├── file-upload.tsx          # 檔案上傳元件
    └── audio-recorder.tsx       # 錄音元件
```

#### 技術細節
- 使用現有的 shadcn/ui 元件（Button, Card, Badge, Table 等）
- TanStack Table v8 用於資料表格
- Recharts 用於 MEDDIC 雷達圖
- 所有元件支援 TypeScript 嚴格模式
- 遵循 Ultracite 程式碼標準

#### 安裝指令
```bash
cd apps/web
bun add recharts @tanstack/react-table
```

#### 驗證標準
- 所有元件可獨立渲染（使用 Storybook 或 dev route）
- TypeScript 無類型錯誤
- 響應式設計（手機/平板/桌面）
- Accessibility 符合 ARIA 標準
- `bun x ultracite check` 無錯誤

#### 交付物
- 13 個 React 元件檔案
- Mock data 用於元件展示

---

### Workflow C: External Services
**負責人**: Integration/DevOps Developer
**預估時間**: 3-4 工作日
**前置依賴**: 無

#### 任務清單
1. 建立 `packages/services` 新套件
2. 整合 Google Gemini 2.0（LLM）
3. 整合 Groq Whisper（語音轉文字）⭐ **從 V2 遷移**
4. 整合 Cloudflare R2（檔案儲存）
5. 建立 MEDDIC prompts 目錄 ⭐ **從 V2 遷移**
6. 實作 Multi-Agent Orchestrator ⭐ **從 V2 遷移**

#### 檔案清單
```
packages/services/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── llm/
│   │   ├── gemini.ts           # Gemini SDK 封裝
│   │   ├── orchestrator.ts     # Multi-Agent 協作編排器 (從 V2)
│   │   ├── types.ts
│   │   └── prompts.ts          # Prompts loader
│   ├── transcription/
│   │   ├── groq-whisper.ts     # Groq Whisper Pipeline (從 V2)
│   │   └── types.ts
│   └── storage/
│       ├── r2.ts               # R2 SDK 封裝
│       └── types.ts
└── prompts/
    └── meddic/
        ├── global-context.md    # iCHEF 業務框架 (從 V2)
        ├── agent1-context.md    # 會議背景分析 (從 V2)
        ├── agent2-buyer.md      # MEDDIC 核心分析 (從 V2)
        ├── agent3-seller.md     # 銷售策略評估 (從 V2)
        ├── agent4-summary.md    # 客戶導向摘要 (從 V2)
        ├── agent5-crm-extractor.md  # CRM 欄位提取 (從 V2)
        └── agent6-coach.md      # 即時教練系統 (從 V2)
```

#### 技術細節
- 使用 `@google/generative-ai` SDK
- 使用 `groq-sdk`（取代 Deepgram，成本更低：$0.04/hr）
- 使用 `@aws-sdk/client-s3` for R2（S3 相容）
- 所有 API key 從環境變數讀取
- 實作錯誤處理與重試邏輯（從 V2 P0 韌性機制）

#### 安裝指令
```bash
cd packages/services
bun init
bun add @google/generative-ai groq-sdk @aws-sdk/client-s3
bun add -d @Sales_ai_automation_v3/env
```

#### 環境變數
```env
GEMINI_API_KEY=
GROQ_API_KEY=                    # 取代 DEEPGRAM_API_KEY
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_ENDPOINT=
```

#### Groq Whisper 實作重點（從 V2 移植）
```typescript
// packages/services/src/transcription/groq-whisper.ts

import Groq from 'groq-sdk';

export class GroqWhisperService {
  private client: Groq;

  constructor() {
    this.client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async transcribe(audioBuffer: Buffer, options?: {
    language?: string;
    chunkIfNeeded?: boolean;
  }): Promise<TranscriptResult> {
    const language = options?.language || 'zh';

    // V2 的自動分塊邏輯
    if (options?.chunkIfNeeded && this.shouldChunk(audioBuffer)) {
      return this.transcribeChunked(audioBuffer, language);
    }

    // 單檔案轉錄
    const response = await this.client.audio.transcriptions.create({
      file: new File([audioBuffer], 'audio.mp3'),
      model: 'whisper-large-v3-turbo',
      language,
      response_format: 'verbose_json',
      temperature: 0.0,
    });

    return {
      fullText: response.text,
      segments: response.segments?.map(s => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })),
      duration: response.duration,
      language: response.language,
    };
  }

  private shouldChunk(buffer: Buffer): boolean {
    // V2 邏輯：>24MB 或 >10 分鐘
    return buffer.length > 24_000_000;
  }

  private async transcribeChunked(
    audioBuffer: Buffer,
    language: string
  ): Promise<TranscriptResult> {
    // V2 的分塊處理邏輯
    // 1. 分割音檔
    // 2. 並行轉錄
    // 3. 合併結果並調整時間戳
    // ... (完整邏輯從 V2 移植)
  }
}
```

#### MEDDIC Orchestrator 實作（從 V2 移植）
```typescript
// packages/services/src/llm/orchestrator.ts

export class MeddicOrchestrator {
  async analyzeConversation(transcript: Transcript): Promise<MeddicAnalysisResult> {
    const state: AnalysisState = {
      transcript: transcript.segments,
      metadata: { /* ... */ },
      refinementCount: 0,
      hasCompetitor: false,
      competitorKeywords: [],
    };

    // Phase 1: 並行執行
    [state.contextData, state.buyerData] = await Promise.all([
      this.runAgent1(state),
      this.runAgent2(state),
    ]);

    // Phase 2: 品質迴圈（V2 核心邏輯）
    while (!this.isQualityPassed(state.buyerData) && state.refinementCount < 2) {
      state.buyerData = await this.refineAgent2(state);
      state.refinementCount++;
    }

    // Phase 3: 條件式競爭對手分析
    if (this.detectCompetitor(state.transcript)) {
      state.hasCompetitor = true;
    }

    // Phase 4-7: 序列執行
    state.sellerData = await this.runAgent3(state);
    state.summaryData = await this.runAgent4(state);
    state.crmData = await this.runAgent5(state);
    state.coachData = await this.runAgent6(state);

    return this.buildResult(state);
  }

  // V2 的品質檢查邏輯
  private isQualityPassed(buyerData: any): boolean {
    return (
      buyerData.needs_identified &&
      buyerData.pain_points?.length > 0 &&
      buyerData.meddic_scores &&
      buyerData.trust_assessment
    );
  }
}
```

#### 驗證標準
- ✅ Gemini API 可成功呼叫（測試用簡單 prompt）
- ✅ Groq Whisper 可轉錄測試音檔（228x 實時速度）
- ✅ 自動分塊功能正常（>24MB 音檔）
- ✅ R2 可上傳/下載檔案
- ✅ MEDDIC Orchestrator 七階段流程運作正常
- ✅ 品質迴圈（Quality Loop）可正確 refine
- ✅ 所有 7 個 Agent prompts 正確加載
- ✅ 所有函式有正確的 TypeScript 類型

#### 交付物
- `packages/services` 完整套件
- 7 個 MEDDIC prompt 檔案（從 V2 遷移）
- Groq Whisper 轉錄服務（從 V2 移植）
- Multi-Agent Orchestrator（從 V2 移植）
- 測試腳本驗證外部服務連線

#### V2 遷移注意事項
⚠️ **重要**: 這個 Workflow 包含大量從 V2 移植的核心邏輯
- **Prompts**: 必須逐字複製，這些是生產環境驗證過的
- **Orchestrator 邏輯**: 保留所有 7 個 Phase 的執行順序
- **品質迴圈**: 最多 2 次 refine 的邏輯必須保留
- **Groq Whisper**: 228x 實時速度，成本 $0.04/hr，遠優於 Deepgram

---

## Phase 2: 核心功能（部分並行）

### Workflow D: API Routes
**負責人**: Backend Developer
**預估時間**: 4-5 工作日
**前置依賴**: Workflow A, C 完成

#### 任務清單
1. 建立 Lead CRUD API
2. 建立 Conversation CRUD API
3. 建立 MEDDIC 分析 API
4. 建立檔案上傳 API（R2）
5. 建立 Analytics API
6. 整合 Gemini + Deepgram

#### 檔案清單
```
packages/api/src/routers/
├── lead.ts          # list, getById, create, update, updateStatus, delete
├── conversation.ts  # list, getById, create, upload, transcribe
├── meddic.ts        # analyze, getAnalysis, listByLead
├── upload.ts        # uploadAudio, getSignedUrl
├── analytics.ts     # getLeadStats, getMeddicTrends
└── index.ts         # 更新主路由
```

#### 技術細節
- 使用 oRPC `os.router()` 定義路由
- 使用 Zod schema 驗證輸入
- 使用 Drizzle ORM 查詢資料庫
- 整合 `packages/services` 的 LLM 與轉錄服務
- 實作分頁、排序、篩選
- 實作錯誤處理與驗證

#### API 範例：MEDDIC 分析流程
```typescript
// POST /api/conversations/:id/analyze
1. 從資料庫取得 conversation
2. 如果無 transcript，先呼叫 Deepgram 轉錄
3. 使用 Gemini 執行 6 個 agent 分析
4. 計算 overall score
5. 儲存到 meddic_analyses 表
6. 更新 conversation.status = 'completed'
7. 回傳分析結果
```

#### 驗證標準
- 所有 API 端點可正常回應
- OpenAPI schema 自動產生（`/api/openapi.json`）
- 使用 Postman/Thunder Client 測試 CRUD
- MEDDIC 分析流程端對端測試成功
- 錯誤處理符合 HTTP 標準（400, 404, 500）

#### 交付物
- 5 個新 router 檔案
- 更新的 `packages/api/src/routers/index.ts`
- API 測試 collection（Postman/Thunder Client）

---

### Workflow E: Frontend Pages
**負責人**: Frontend Developer
**預估時間**: 4-5 工作日
**前置依賴**: Workflow B, D 完成

#### 任務清單
1. 建立 Dashboard 首頁
2. 建立 Lead 列表與詳情頁
3. 建立 Conversation 列表與詳情頁
4. 建立 Analytics 頁面
5. 整合 API 與 TanStack Query
6. 實作檔案上傳與音檔播放

#### 檔案清單
```
apps/web/src/routes/
├── index.tsx                  # Dashboard（總覽統計）
├── leads/
│   ├── index.tsx             # Lead 列表（使用 lead-table）
│   ├── $id.tsx               # Lead 詳情（conversations + MEDDIC）
│   └── new.tsx               # 新增 Lead
├── conversations/
│   ├── index.tsx             # 對話列表
│   ├── $id.tsx               # 對話詳情（transcript + MEDDIC）
│   └── new.tsx               # 上傳音檔/新增對話
└── analytics/
    └── index.tsx             # 分析報表（統計圖表）
```

#### 技術細節
- 使用 TanStack Router 的 `createFileRoute`
- 使用 `loader` 預載資料
- 使用 `@orpc/tanstack-query` 整合 API
- 實作樂觀更新（optimistic updates）
- 實作錯誤邊界（Error Boundary）
- 實作 loading 狀態

#### Dashboard 內容
- Lead 總數（依狀態分類）
- 近期對話數量
- MEDDIC 平均分數
- 待處理分析數量
- 最近活動時間軸

#### 驗證標準
- 所有頁面可正常導航
- API 整合無錯誤
- 表單驗證與錯誤訊息顯示
- 檔案上傳與音檔播放功能正常
- 響應式設計符合預期
- TypeScript 類型安全

#### 交付物
- 8 個新 route 檔案
- 完整的前端應用程式

---

### Workflow F: Slack Bot
**負責人**: Integration Developer
**預估時間**: 3-4 工作日
**前置依賴**: Workflow C, D 完成

#### 任務清單
1. 建立 Slack Bot 應用程式（新 app）
2. 實作 `/analyze` 指令
3. 實作 `/lead` 指令
4. 監聽音檔上傳事件
5. 建立 Slack Block UI
6. 部署到 Cloudflare Workers

#### 檔案清單
```
apps/slack-bot/
├── package.json
├── wrangler.toml
├── src/
│   ├── index.ts              # Workers 入口
│   ├── app.ts                # Slack Bolt App
│   ├── commands/
│   │   ├── analyze.ts        # /analyze [conversation_id]
│   │   ├── lead.ts           # /lead list|create
│   │   └── report.ts         # /report weekly
│   ├── events/
│   │   ├── message.ts        # 訊息事件
│   │   └── file.ts           # 檔案上傳事件
│   └── blocks/
│       ├── meddic-summary.ts # MEDDIC 結果 Block UI
│       └── lead-card.ts      # Lead 資訊 Block UI
```

#### 技術細節
- 使用 `@slack/bolt` for Workers
- Webhook URL 指向 Cloudflare Worker
- 呼叫 oRPC API（需要內部認證 token）
- 使用 Slack Block Kit 建立互動式 UI

#### Slack 指令範例
```
/analyze conv_abc123
→ 觸發 MEDDIC 分析，回傳雷達圖與評分

/lead list status:qualified
→ 列出所有 qualified 狀態的 Lead

/lead create company:"ABC Corp" contact:"John Doe"
→ 建立新 Lead
```

#### 環境變數
```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-... (for Socket Mode)
INTERNAL_API_TOKEN=... (for oRPC authentication)
```

#### 驗證標準
- Slack Bot 可正確回應指令
- 音檔上傳自動觸發分析
- Block UI 顯示正常
- 錯誤訊息友善易懂
- Workers 部署成功且穩定

#### 交付物
- `apps/slack-bot` 完整應用程式
- Slack App manifest 設定檔
- Workers 部署設定

---

## Phase 3: 整合測試

### Workflow G: Integration Testing
**負責人**: 全體開發人員（輪流）
**預估時間**: 2-3 工作日
**前置依賴**: Phase 2 所有 Workflow 完成

#### 測試清單

**端對端測試流程**:
1. ✅ 使用者註冊/登入（Better-Auth）
2. ✅ 建立新 Lead（透過 UI）
3. ✅ 上傳音檔到 Conversation（透過 UI）
4. ✅ 自動轉錄（Deepgram）
5. ✅ 執行 MEDDIC 分析（Gemini）
6. ✅ 查看分析結果（雷達圖、評分）
7. ✅ 更新 Lead 狀態（依據分析結果）
8. ✅ Slack 指令觸發分析
9. ✅ 查看 Analytics 報表

**測試工具**:
- Playwright（E2E 測試）
- Vitest（單元測試）
- Postman/Thunder Client（API 測試）

#### 驗證標準
- 所有關鍵流程無錯誤
- 效能符合預期（< 3s 頁面載入）
- 音檔處理時間合理（< 30s for 10min 音檔）
- MEDDIC 分析準確性人工驗證
- 無資料一致性問題

---

## Phase 4: 資料遷移

### Workflow H: Data Migration
**負責人**: Backend Developer
**預估時間**: 2-3 工作日
**前置依賴**: Phase 3 測試通過

#### 任務清單
1. 匯出 Firestore 資料
2. 撰寫 migration script
3. 資料格式轉換（Firestore → PostgreSQL）
4. 執行 migration（先測試環境）
5. 驗證資料完整性
6. 執行正式環境 migration

#### 檔案清單
```
scripts/
├── migrate-firestore-to-postgres.ts  # 主 script
├── validate-migration.ts             # 驗證 script
└── rollback-migration.ts             # 回滾 script
```

#### Migration 步驟
```typescript
1. 從 Firestore 讀取 leads collection
2. 轉換欄位名稱（snake_case → camelCase）
3. 插入到 PostgreSQL leads 表
4. 從 Firestore 讀取 conversations collection
5. 轉換並插入到 PostgreSQL
6. 處理 MEDDIC 分析結果
7. 驗證資料數量與完整性
```

#### 驗證標準
- 資料筆數一致
- 關聯關係正確（Lead ↔ Conversation）
- 無資料遺失
- 舊系統與新系統並行運作（雙寫期間）

#### 交付物
- Migration scripts
- 驗證報告
- Rollback plan

---

## Phase 5: 部署上線

### Workflow I: Production Deployment
**負責人**: DevOps/Integration Developer
**預估時間**: 1-2 工作日
**前置依賴**: Phase 4 完成

#### 任務清單
1. 設定 Cloudflare Pages（Frontend）
2. 設定 Cloudflare Workers（Backend）
3. 設定 Neon PostgreSQL（Production DB）
4. 設定環境變數（所有服務）
5. DNS 與 SSL 設定
6. 監控與日誌設定
7. 執行部署

#### 部署指令
```bash
# 建置所有應用程式
bun run build

# 部署前端（Cloudflare Pages）
cd apps/web
npx wrangler pages deploy dist --project-name=sales-ai-web

# 部署後端（Cloudflare Workers）
cd apps/server
npx wrangler deploy

# 部署 Slack Bot（Cloudflare Workers）
cd apps/slack-bot
npx wrangler deploy
```

#### 環境變數檢查清單
```env
# Database
DATABASE_URL=postgresql://...

# Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://sales-ai.pages.dev

# Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GEMINI_API_KEY=

# Deepgram
DEEPGRAM_API_KEY=

# Slack
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=

# Cloudflare R2
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=
CLOUDFLARE_R2_BUCKET=
```

#### 監控設定
- Cloudflare Analytics（流量監控）
- Sentry（錯誤追蹤）
- LogFlare（日誌聚合）
- UptimeRobot（服務可用性監控）

#### 驗證標準
- 所有服務正常運作
- SSL 憑證有效
- API 回應時間 < 500ms (P95)
- 無 5xx 錯誤
- Slack Bot 回應正常

---

## 關鍵檔案路徑總覽

### Database Schema
- [packages/db/src/schema/lead.ts](packages/db/src/schema/lead.ts)
- [packages/db/src/schema/conversation.ts](packages/db/src/schema/conversation.ts)
- [packages/db/src/schema/meddic.ts](packages/db/src/schema/meddic.ts)

### API Routes
- [packages/api/src/routers/lead.ts](packages/api/src/routers/lead.ts)
- [packages/api/src/routers/conversation.ts](packages/api/src/routers/conversation.ts)
- [packages/api/src/routers/meddic.ts](packages/api/src/routers/meddic.ts)

### Frontend Pages
- [apps/web/src/routes/leads/index.tsx](apps/web/src/routes/leads/index.tsx)
- [apps/web/src/routes/leads/$id.tsx](apps/web/src/routes/leads/$id.tsx)
- [apps/web/src/routes/conversations/index.tsx](apps/web/src/routes/conversations/index.tsx)

### Services
- [packages/services/src/llm/gemini.ts](packages/services/src/llm/gemini.ts)
- [packages/services/src/transcription/deepgram.ts](packages/services/src/transcription/deepgram.ts)

### Slack Bot
- [apps/slack-bot/src/app.ts](apps/slack-bot/src/app.ts)

---

## 驗證與測試策略

### 端對端驗證流程

**完整業務流程測試**:
```
1. 登入系統
   → 驗證: Better-Auth 正常運作

2. 建立 Lead "ABC Corp"
   → 驗證: PostgreSQL 插入成功，UI 顯示正確

3. 上傳銷售對話音檔
   → 驗證: R2 儲存成功，conversation 記錄建立

4. 自動轉錄
   → 驗證: Deepgram API 呼叫成功，transcript 儲存

5. 執行 MEDDIC 分析
   → 驗證: Gemini API 呼叫成功，6 個維度評分生成

6. 查看雷達圖
   → 驗證: Recharts 渲染正確，資料視覺化準確

7. 更新 Lead 狀態為 "Qualified"
   → 驗證: 狀態流轉邏輯正確

8. Slack 發送 `/analyze conv_123`
   → 驗證: Block UI 顯示分析結果

9. 查看 Analytics Dashboard
   → 驗證: 統計數據正確
```

### 效能指標
- **頁面載入**: < 2s (First Contentful Paint)
- **API 回應**: < 500ms (P95)
- **音檔轉錄**: < 音檔長度的 20%（10min 音檔 < 2min 完成）
- **MEDDIC 分析**: < 30s（包含 6 個 Gemini API 呼叫）

### 安全性檢查
- ✅ 所有 API 需要認證（除了 public endpoints）
- ✅ 檔案上傳驗證檔案類型與大小
- ✅ SQL Injection 防護（Drizzle ORM）
- ✅ XSS 防護（React 自動轉義）
- ✅ CORS 設定正確
- ✅ 敏感資料加密（API keys 在環境變數）

---

## 平行開發最佳實踐

### Git 分支策略
```
main (保護分支)
├── develop (開發主分支)
    ├── feature/phase1-database-schema (Workflow A)
    ├── feature/phase1-ui-components (Workflow B)
    ├── feature/phase1-external-services (Workflow C)
    ├── feature/phase2-api-routes (Workflow D)
    ├── feature/phase2-frontend-pages (Workflow E)
    └── feature/phase2-slack-bot (Workflow F)
```

### Pull Request 流程
1. 開發者在 feature branch 完成工作
2. 執行 `bun x ultracite fix` 修正格式
3. 執行 `bun run check-types` 確保類型正確
4. 提交 PR 到 `develop` 分支
5. Code review（至少 1 人核准）
6. CI/CD 自動測試通過
7. Merge 到 `develop`
8. 定期從 `develop` merge 到 `main`

### 溝通機制
- **Daily Standup**: 每日同步進度與阻礙
- **API Contract First**: Workflow D 先定義 API schema，其他人依賴
- **Shared Types**: 使用 Turborepo cache 共享類型定義
- **Documentation**: 每個 Workflow 完成後更新 README

### Mock Data 策略
在 Workflow B, E 開發時，使用 mock data:
```typescript
// apps/web/src/lib/mock-data.ts
export const mockLeads: Lead[] = [
  {
    id: '1',
    companyName: 'ABC Corp',
    contactName: 'John Doe',
    status: 'qualified',
    // ... 其他欄位
  },
];
```

---

## 總結

這個平行開發策略將整個專案分為 **5 個 Phase**，共 **9 個 Workflow**。

**Phase 1** 的 3 個 Workflow 可以完全並行開發，無依賴關係。
**Phase 2** 的 3 個 Workflow 在 Phase 1 完成後可以並行開發。
**Phase 3-5** 為序列執行的測試、遷移、部署階段。

### 時程規劃

使用 **3 人團隊** 可在約 **4-5 週**完成整個專案（含 V2 遷移）。
使用 **5 人團隊** 可在約 **3-4 週**完成整個專案（含 V2 遷移）。

**詳細時程**:
- Phase 1: 3-4 工作日（並行）
- Phase 2: 4-5 工作日（並行）
- Phase 3: 2-3 工作日（整合測試）
- Phase 4: 2-3 工作日（資料遷移）⭐ **V2 遷移關鍵階段**
- Phase 5: 1-2 工作日（部署上線）
- **雙寫期**: 2 週（V2 + V3 並行）⭐ **零停機遷移**

### 關鍵成功因素

1. **V2 核心邏輯保留** ⭐ **最重要**
   - Multi-Agent Orchestrator 七階段流程完整移植
   - 品質迴圈（Quality Loop）邏輯保留
   - 所有 7 個 MEDDIC Prompts 逐字複製
   - Groq Whisper 轉錄 Pipeline（228x 實時速度，$0.04/hr）

2. **資料遷移策略**
   - Firestore → PostgreSQL 完整映射
   - GCS → R2 音檔批次遷移
   - 雙寫期間確保零停機
   - 完整的驗證檢查清單

3. **API Contract 先行**
   - Workflow D 的 API schema 需最早確定
   - V2 FastAPI 端點映射到 V3 oRPC
   - 維持 API 相容性（/api/v3）

4. **類型安全**
   - 充分利用 TypeScript 與 oRPC 的端對端類型安全
   - Drizzle ORM 自動類型推斷
   - 避免 runtime 錯誤

5. **測試覆蓋**
   - Phase 3 的整合測試非常關鍵
   - V2 生產環境資料作為測試基準
   - MEDDIC 分析準確性人工驗證

6. **環境變數管理**
   - 集中管理所有外部服務的 API keys
   - Groq Whisper API key（非 Deepgram）
   - Cloudflare R2（非 GCS）

### V2 遷移風險與緩解

| 風險 | 影響 | 緩解策略 |
|------|------|----------|
| Prompt 邏輯遺失 | 高 | 從 V2 逐字複製所有 .md 檔案 |
| Orchestrator 流程錯誤 | 高 | 完整移植 Python 邏輯到 TypeScript，保留所有 7 個 Phase |
| Firestore 資料不完整 | 中 | 詳細的欄位映射表 + 驗證檢查清單 |
| 音檔 GCS → R2 遷移失敗 | 中 | 批次遷移 + 重試邏輯 + Rollback plan |
| 雙寫期間資料不一致 | 低 | 測試環境先驗證 + 逐步流量切換（10% → 50% → 100%） |
| 轉錄服務切換問題 | 低 | 保留 Groq Whisper（V2 已驗證），不切換到 Deepgram |

### 技術決策變更（與原開發指南的差異）

| 項目 | 原計劃 | 變更後 | 原因 |
|------|--------|--------|------|
| 轉錄服務 | Deepgram | Groq Whisper | V2 已驗證，成本更低（$0.04/hr vs Deepgram） |
| Conversation Schema | 基礎欄位 | 加入 V2 特有欄位 | 支援 Firestore 完整遷移（progressScore, urgencyLevel, storeName） |
| MEDDIC Schema | 基礎評分 | 加入 agentOutputs | 保留 V2 原始 Agent 輸出供未來分析 |
| Services 套件 | 僅 LLM + 轉錄 + 儲存 | 加入 Orchestrator | V2 的 Multi-Agent 協作是核心智慧 |
| Prompts | 新撰寫 | 從 V2 複製 | V2 的 Prompts 已生產驗證，不需重寫 |

### 後續優化建議（Phase 6+）

完成 V2 → V3 遷移後，可考慮以下優化：

1. **智能路由**: 動態 LLM 選擇（Gemini vs Claude vs GPT-4）
2. **A/B Testing**: 不同 Agent 策略的效果比較
3. **分散式追蹤**: Cloud Trace / Jaeger 整合
4. **自動化測試**: Playwright E2E + Vitest 單元測試
5. **CI/CD Pipeline**: GitHub Actions 自動部署
6. **Feature Flags**: LaunchDarkly / Flagsmith 漸進式功能發布
7. **Advanced Analytics**: 多維度 MEDDIC 趨勢分析
8. **Webhook 整合**: Salesforce 雙向同步

---

## 附錄：重要參考資料

### V2 專案資源
- **GitHub**: https://github.com/keweikao/sales-ai-automation-V2
- **核心 Prompts**: `modules/03-sales-conversation/meddic/agents/prompts/`
- **Orchestrator**: `modules/03-sales-conversation/transcript_analyzer/orchestrator.py`
- **Groq Whisper**: `infrastructure/services/transcription/providers/whisper.py`

### V3 技術文件
- **Better-T-Stack**: https://github.com/AmanVarshney01/create-better-t-stack
- **Drizzle ORM**: https://orm.drizzle.team/
- **oRPC**: https://orpc.unnoq.com/
- **TanStack Router**: https://tanstack.com/router
- **Groq API**: https://console.groq.com/docs/
- **Gemini API**: https://ai.google.dev/gemini-api/docs

### 成本估算（月度，300 cases）
| 服務 | V2 成本 | V3 預估成本 | 變化 |
|------|---------|-------------|------|
| 轉錄（Groq Whisper） | $7.50 | $7.50 | 無變化 |
| LLM（Gemini） | $5.00 | $5.00 | 無變化 |
| 運算（Cloud Run → Workers） | $2.00 | $1.00 | ↓ 50% |
| 資料庫（Firestore → Neon） | $0.50 | $0.00 | ↓ 100%（免費方案） |
| 儲存（GCS → R2） | $0.50 | $0.00 | ↓ 100%（免費方案） |
| **總計** | **$15.50** | **$13.50** | **↓ 13%** |

⭐ **額外效益**:
- Cloudflare Workers：0ms 冷啟動（vs Cloud Run 100-500ms）
- Neon：自動擴展，更好的查詢效能
- R2：無出站流量費用

---

## Claude Code MCP Servers 與 Skills 規劃

### 推薦的 MCP Servers

為了提升 Sales AI Automation V3 的開發效率，建議整合以下 MCP servers：

#### 1. **Database MCP Server** ⭐ **高優先級**

**用途**: 直接查詢和操作 Neon PostgreSQL 資料庫

```json
// ~/.config/claude/claude_desktop_config.json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://..."]
    }
  }
}
```

**應用場景**:
- Phase 4 資料遷移時，驗證 Firestore → PostgreSQL 的資料完整性
- 快速查詢 leads, conversations, meddic_analyses 表的資料
- 驗證 foreign key 關聯是否正確
- 執行複雜的 JOIN 查詢來分析 MEDDIC 評分趨勢

**範例使用**:
```
User: 查詢所有 MEDDIC 總分 >= 80 的 conversations
Claude: [使用 postgres MCP] SELECT c.*, m.overall_score FROM conversations c JOIN meddic_analyses m ON c.id = m.conversation_id WHERE m.overall_score >= 80
```

#### 2. **Filesystem MCP Server** ⭐ **高優先級**

**用途**: 高效的檔案系統操作（特別是批次操作）

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/stephen/Desktop/sales_ai_automation_v3"]
    }
  }
}
```

**應用場景**:
- 批次建立 Workflow C 的 7 個 MEDDIC prompt 檔案（從 V2 複製）
- 搜尋整個 monorepo 的檔案結構
- 快速定位特定類型的檔案（如所有 `.ts` schema 檔案）

#### 3. **GitHub MCP Server** ⭐ **中優先級**

**用途**: 整合 GitHub API，管理 Issues、PRs、Releases

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    }
  }
}
```

**應用場景**:
- 建立 GitHub Issues 追蹤 9 個 Workflow 的進度
- 自動建立 Pull Requests（例如 Phase 1 完成後的 feature branches）
- 查看 V2 專案的 commit history 和 code reviews
- 管理 Milestone（Phase 1-5）

**範例使用**:
```
User: 為 Phase 1 的 3 個 Workflow 建立 GitHub Issues
Claude: [使用 github MCP]
- Issue #1: [Phase 1A] Database Schema - Lead, Conversation, MEDDIC tables
- Issue #2: [Phase 1B] UI Components - 13 React components
- Issue #3: [Phase 1C] External Services - Groq Whisper + Gemini + R2
```

#### 4. **Brave Search MCP Server** ⭐ **中優先級**

**用途**: 搜尋最新的技術文件和解決方案

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "BSA..."
      }
    }
  }
}
```

**應用場景**:
- 查詢 Drizzle ORM 最新的 JSONB 操作方法
- 搜尋 oRPC 的 OpenAPI 整合最佳實踐
- 查詢 Groq Whisper API 的最新文件
- 搜尋 Cloudflare Workers 的 CORS 設定範例

#### 5. **Git MCP Server** ⭐ **低優先級**

**用途**: Git 操作（但 Claude Code 內建 git 工具已足夠）

```json
{
  "mcpServers": {
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git", "--repository", "/Users/stephen/Desktop/sales_ai_automation_v3"]
    }
  }
}
```

**應用場景**:
- 查看 commit history 分析開發進度
- 檢查 feature branch 的變更
- 輔助 Code Review

### 推薦的 Custom Skills

基於專案特性，建議建立以下 Custom Skills：

#### Skill 1: `/migrate-v2-prompts` ⭐ **高優先級**

**用途**: 從 V2 專案批次複製 MEDDIC prompts

**實作位置**: `.claude/skills/migrate-v2-prompts.md`

```markdown
# Migrate V2 MEDDIC Prompts

從 V2 專案複製所有 7 個 MEDDIC prompt 檔案到 V3 的 `packages/services/prompts/meddic/` 目錄。

## Steps

1. 從 V2 GitHub repo clone 或 fetch 最新版本
2. 複製以下檔案：
   - global-context.md
   - agent1-context.md
   - agent2-buyer.md
   - agent3-seller.md
   - agent4-summary.md
   - agent5-crm-extractor.md (V2 的 agent6)
   - agent6-coach.md
3. 驗證所有檔案內容完整
4. 建立 `prompts.ts` loader

## V2 Source
https://github.com/keweikao/sales-ai-automation-V2/tree/main/modules/03-sales-conversation/meddic/agents/prompts

## Validation
- [ ] 7 個 .md 檔案都存在
- [ ] 檔案內容與 V2 完全一致（逐字複製）
- [ ] prompts.ts 可正確載入所有檔案
```

#### Skill 2: `/verify-migration` ⭐ **高優先級**

**用途**: 驗證 Firestore → PostgreSQL 資料遷移的完整性

**實作位置**: `.claude/skills/verify-migration.md`

```markdown
# Verify Data Migration

執行完整的資料遷移驗證檢查清單。

## Checks

### 資料筆數
- [ ] Firestore `leads` 筆數 = PostgreSQL `leads` 筆數
- [ ] Firestore `sales_cases` 筆數 = PostgreSQL `conversations` 筆數
- [ ] 所有有 meddic_score 的 case 都有對應的 meddic_analyses

### 關聯關係
- [ ] 所有 conversation.lead_id 都有對應的 lead
- [ ] 所有 meddic_analysis.conversation_id 都有對應的 conversation

### 欄位轉換
- [ ] Timestamp 正確轉換（抽查 10 筆）
- [ ] JSONB 結構正確（transcript, meddic_score）
- [ ] Enum 值符合新 schema

### 業務邏輯
- [ ] MEDDIC 總分計算正確（抽查 10 筆，對比 V2 計算結果）
- [ ] Lead status 映射正確

## Tools
使用 postgres MCP server 執行查詢
```

#### Skill 3: `/schema-diff` ⭐ **中優先級**

**用途**: 比較 V2 Firestore schema 與 V3 PostgreSQL schema

**實作位置**: `.claude/skills/schema-diff.md`

```markdown
# Schema Diff Tool

比較 V2 與 V3 的資料結構差異，確保沒有遺漏欄位。

## V2 Schema Sources
- Firestore collections: `sales_cases`, `leads`
- Python models: `core/database/models/`

## V3 Schema Sources
- Drizzle schema: `packages/db/src/schema/`

## Output Format
生成表格顯示：
- 欄位名稱對應
- 資料類型變更
- 新增/移除欄位
- 需要特殊處理的欄位
```

#### Skill 4: `/test-meddic-pipeline` ⭐ **高優先級**

**用途**: 測試完整的 MEDDIC 分析 pipeline

**實作位置**: `.claude/skills/test-meddic-pipeline.md`

```markdown
# Test MEDDIC Analysis Pipeline

端對端測試 MEDDIC 分析流程。

## Test Flow
1. 準備測試音檔（從 V2 取得真實案例）
2. 上傳到 R2
3. 呼叫 Groq Whisper 轉錄
4. 執行 Multi-Agent Orchestrator 七階段分析
5. 驗證 6 個 Agent 的輸出
6. 驗證 MEDDIC 總分計算
7. 比對 V2 的分析結果（確保一致性）

## Success Criteria
- 轉錄準確率 >95%
- 所有 Agent 都有輸出
- MEDDIC 總分與 V2 差異 <5 分
- 執行時間 <2 分鐘（37.5 分鐘音檔）
```

#### Skill 5: `/deploy-phase` ⭐ **中優先級**

**用途**: 自動化 Phase 部署流程

**實作位置**: `.claude/skills/deploy-phase.md`

```markdown
# Deploy Phase

自動化部署特定 Phase 的完成結果。

## Usage
`/deploy-phase 1` - 部署 Phase 1（Database + Services）
`/deploy-phase 2` - 部署 Phase 2（API + Frontend + Slack）

## Steps
1. 執行 `bun run check-types` 驗證類型
2. 執行 `bun x ultracite check` 驗證程式碼品質
3. 執行測試（如果有）
4. 建立 Git commit（使用規範的 commit message）
5. 推送到 GitHub
6. 建立 Pull Request（如果是 feature branch）
7. 更新 GitHub Issue 狀態

## Commit Message Format
```
feat(phase-1): complete database schema and external services

- Add Lead, Conversation, MEDDIC Analysis schemas
- Integrate Groq Whisper transcription service
- Add Gemini 2.0 LLM client
- Migrate 7 MEDDIC prompts from V2

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```
```

### MCP Servers 設定檔範例

**完整的 `claude_desktop_config.json`**:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://user:password@neon-host/sales_ai_automation_v3"
      ]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/stephen/Desktop/sales_ai_automation_v3"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
      }
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "BSA_your_key_here"
      }
    }
  }
}
```

### Skills 目錄結構

```
.claude/skills/
├── migrate-v2-prompts.md
├── verify-migration.md
├── schema-diff.md
├── test-meddic-pipeline.md
└── deploy-phase.md
```

### 使用時機建議

| Phase | 推薦使用的 MCP/Skills |
|-------|---------------------|
| Phase 1A (Database) | `postgres` MCP, `/schema-diff` |
| Phase 1B (UI) | `filesystem` MCP |
| Phase 1C (Services) | `/migrate-v2-prompts`, `brave-search` MCP |
| Phase 2D (API) | `postgres` MCP, `brave-search` MCP |
| Phase 2E (Frontend) | `filesystem` MCP |
| Phase 2F (Slack) | `brave-search` MCP, `github` MCP |
| Phase 3 (Testing) | `/test-meddic-pipeline`, `postgres` MCP |
| Phase 4 (Migration) | `/verify-migration`, `postgres` MCP |
| Phase 5 (Deployment) | `/deploy-phase`, `github` MCP |

### 整合到開發流程

1. **Phase 1 開始前**: 設定所有 MCP servers
2. **Workflow C 執行時**: 立即使用 `/migrate-v2-prompts`
3. **每個 Workflow 完成後**: 使用 `/deploy-phase` 自動化提交
4. **Phase 3**: 使用 `/test-meddic-pipeline` 驗證核心功能
5. **Phase 4**: 使用 `/verify-migration` 多次執行驗證
6. **持續使用**: `postgres` MCP 用於即時查詢和驗證

### 額外建議

**開發期間常用指令**:
```bash
# 快速驗證資料庫 schema
User: 使用 postgres MCP 顯示所有 tables 的結構

# 批次建立檔案
User: 使用 filesystem MCP 建立 packages/services/prompts/meddic/ 所有 prompt 檔案

# 查詢最新文件
User: 使用 brave-search MCP 查詢 "Drizzle ORM jsonb query examples"

# 建立 GitHub Issue
User: 使用 github MCP 為 Phase 2 的 3 個 Workflow 建立 Issues
```

這樣的 MCP + Skills 配置將大幅提升開發效率，特別是在資料遷移驗證和批次操作方面！
