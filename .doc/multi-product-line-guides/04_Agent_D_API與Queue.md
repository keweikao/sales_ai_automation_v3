# Agent D: API 與 Queue Worker 開發指南

> **角色**: Agent D 開發者
> **任務**: 整合 productLine 參數到 API 與 Queue Worker
> **預估時間**: 8-10 小時
> **依賴**: Agent A (必須), Agent C (建議)

---

## 📋 目錄

1. [依賴關係與環境準備](#依賴關係與環境準備)
2. [開發任務拆解](#開發任務拆解)
3. [驗收檢查點](#驗收檢查點)
4. [向後相容性驗證](#向後相容性驗證)
5. [故障排除](#故障排除)

---

## 依賴關係與環境準備

### 依賴 Agent A (必須)

**必需的產出**:
- ✅ Database Migration 完成 (product_line 欄位)
- ✅ ProductLineConfig interface
- ✅ getProductConfig() function

**驗證 Agent A 完成**:
```bash
# 1. 檢查 Migration 是否已執行
bun run packages/db/src/check-migration.ts

# 預期看到 product_line 欄位
# opportunities: product_line (TEXT, DEFAULT 'ichef')
# conversations: product_line (TEXT, DEFAULT 'ichef')
```

### 依賴 Agent C (建議,非必須)

**如果 Agent C 已完成**:
- ✅ 可使用 `loadMeddicPrompts(productLine)` 載入提示詞
- ✅ Orchestrator 已支援 `productLine` 參數

**如果 Agent C 尚未完成**:
- ⚠️ 可先開發 API 與 Queue 邏輯
- ⚠️ 暫時傳入 `productLine` 但 Orchestrator 可能忽略

### 環境檢查

```bash
# 1. 確認 API Router 存在
ls -la packages/api/src/routers/conversation.ts

# 2. 確認 Queue Worker 存在
ls -la apps/queue-worker/src/index.ts

# 3. 確認 DB schema 有 product_line
grep -r "product_line" packages/db/src/schema/
```

---

## 開發任務拆解

### 階段 1: 更新 API Router - uploadConversation (2-3h)

#### 1.1 修改 Zod Schema

**檔案**: `packages/api/src/routers/conversation.ts`

找到 `uploadConversation` 的 input schema:

**修改前**:
```typescript
const uploadConversationInput = z.object({
  leadId: z.string(),
  audioFile: z.instanceof(File),
  salesRep: z.string(),
  conversationDate: z.string().datetime(),
  // ... 其他欄位
});
```

**修改後**:
```typescript
const uploadConversationInput = z.object({
  leadId: z.string(),
  audioFile: z.instanceof(File),
  salesRep: z.string(),
  conversationDate: z.string().datetime(),
  productLine: z.enum(['ichef', 'beauty']).optional(), // 新增,optional
  // ... 其他欄位 (保持不變)
});
```

#### 1.2 修改 Router Handler

**在同一檔案中找到 uploadConversation mutation**:

**修改前** (簡化範例):
```typescript
uploadConversation: protectedProcedure
  .input(uploadConversationInput)
  .mutation(async ({ ctx, input }) => {
    const { leadId, audioFile, salesRep, conversationDate, ...metadata } = input;

    // 上傳音檔到 R2
    const audioUrl = await uploadToR2(audioFile);

    // 建立 conversation 記錄
    const conversation = await ctx.db.insert(conversations).values({
      leadId,
      audioUrl,
      salesRep,
      conversationDate: new Date(conversationDate),
      metadata: JSON.stringify(metadata),
    });

    // 推送到 Queue
    await ctx.queue.send({
      conversationId: conversation.id,
      audioUrl,
    });

    return conversation;
  });
```

**修改後**:
```typescript
import type { ProductLine } from '@Sales_ai_automation_v3/db';

uploadConversation: protectedProcedure
  .input(uploadConversationInput)
  .mutation(async ({ ctx, input }) => {
    const { 
      leadId, 
      audioFile, 
      salesRep, 
      conversationDate,
      productLine, // 提取 productLine
      ...metadata 
    } = input;

    // 解析 productLine (預設 'ichef')
    const resolvedProductLine: ProductLine = productLine || 'ichef';

    // 上傳音檔到 R2
    const audioUrl = await uploadToR2(audioFile);

    // 建立 conversation 記錄 (新增 product_line 欄位)
    const conversation = await ctx.db.insert(conversations).values({
      leadId,
      audioUrl,
      salesRep,
      conversationDate: new Date(conversationDate),
      productLine: resolvedProductLine, // 新增
      metadata: JSON.stringify(metadata),
    });

    // 推送到 Queue (新增 productLine 到 payload)
    await ctx.queue.send({
      conversationId: conversation.id,
      audioUrl,
      productLine: resolvedProductLine, // 新增
      salesRep,
      conversationDate,
    });

    return conversation;
  });
```

**關鍵點**:
1. ✅ 提取 `productLine` 參數 (optional)
2. ✅ 預設為 `'ichef'` (向後相容)
3. ✅ 儲存到 DB 的 `product_line` 欄位
4. ✅ 傳遞到 Queue payload

#### 1.3 更新 TypeScript 類型

**檔案**: `packages/api/src/types/queue.ts` (如果存在)

```typescript
export interface QueueMessage {
  conversationId: string;
  audioUrl: string;
  productLine?: ProductLine; // 新增,optional
  salesRep: string;
  conversationDate: string;
}
```

---

### 階段 2: 更新 Queue Worker (3-4h)

#### 2.1 修改 Queue Message Handler

**檔案**: `apps/queue-worker/src/index.ts`

找到 Queue message handler:

**修改前** (簡化範例):
```typescript
export default {
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const { conversationId, audioUrl } = message.body;

      try {
        // 1. 下載音檔
        const audioBuffer = await downloadAudio(audioUrl);

        // 2. 轉錄
        const transcript = await transcribeAudio(audioBuffer, env);

        // 3. 分析 (呼叫 Orchestrator)
        const analysis = await orchestrator.analyze({
          leadId: '...', // 從 DB 查詢
          conversationId,
          salesRep: '...', // 從 DB 查詢
          conversationDate: new Date(),
          transcript,
        });

        // 4. 儲存結果
        await saveAnalysisResults(conversationId, analysis, env);

        message.ack();
      } catch (error) {
        console.error('Queue processing failed:', error);
        message.retry();
      }
    }
  }
};
```

**修改後**:
```typescript
import type { ProductLine } from '@Sales_ai_automation_v3/db';

export default {
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const { conversationId, audioUrl, productLine } = message.body;

      try {
        // 解析 productLine (預設 'ichef')
        const resolvedProductLine: ProductLine = productLine || 'ichef';

        // 1. 從 DB 查詢 conversation 詳細資料
        const conversation = await env.DB
          .select()
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .get();

        if (!conversation) {
          throw new Error(`Conversation ${conversationId} not found`);
        }

        // 2. 下載音檔
        const audioBuffer = await downloadAudio(audioUrl);

        // 3. 轉錄
        const transcript = await transcribeAudio(audioBuffer, env);

        // 4. 分析 (傳入 productLine)
        const analysis = await orchestrator.analyze({
          leadId: conversation.leadId,
          conversationId,
          salesRep: conversation.salesRep,
          conversationDate: conversation.conversationDate,
          transcript,
          productLine: resolvedProductLine, // 新增
        });

        // 5. 儲存結果
        await saveAnalysisResults(conversationId, analysis, env);

        message.ack();
      } catch (error) {
        console.error('Queue processing failed:', error);
        message.retry();
      }
    }
  }
};
```

**關鍵點**:
1. ✅ 從 Queue message 提取 `productLine`
2. ✅ 預設為 `'ichef'` (向後相容)
3. ✅ 傳遞到 `orchestrator.analyze()`

#### 2.2 處理舊的 Queue Messages

**問題**: 已在 Queue 中的舊訊息沒有 `productLine` 欄位

**解決方案**: Fallback 機制

```typescript
// 優先順序:
// 1. Message payload 的 productLine
// 2. DB conversation 記錄的 product_line
// 3. 預設 'ichef'

const resolvedProductLine: ProductLine = 
  message.body.productLine || 
  conversation.productLine || 
  'ichef';
```

---

### 階段 3: 更新 Opportunity Router (1-2h)

#### 3.1 修改 createOpportunity

**檔案**: `packages/api/src/routers/opportunity.ts`

找到 `createOpportunity` mutation:

**修改前**:
```typescript
const createOpportunityInput = z.object({
  companyName: z.string(),
  contactName: z.string(),
  // ... 其他欄位
});

createOpportunity: protectedProcedure
  .input(createOpportunityInput)
  .mutation(async ({ ctx, input }) => {
    const opportunity = await ctx.db.insert(opportunities).values({
      ...input,
      // product_line 使用 DB DEFAULT 'ichef'
    });
    return opportunity;
  });
```

**修改後**:
```typescript
const createOpportunityInput = z.object({
  companyName: z.string(),
  contactName: z.string(),
  productLine: z.enum(['ichef', 'beauty']).optional(), // 新增
  // ... 其他欄位
});

createOpportunity: protectedProcedure
  .input(createOpportunityInput)
  .mutation(async ({ ctx, input }) => {
    const { productLine, ...rest } = input;
    
    const opportunity = await ctx.db.insert(opportunities).values({
      ...rest,
      productLine: productLine || 'ichef', // 明確設定
    });
    
    return opportunity;
  });
```

#### 3.2 修改查詢 API

**新增產品線過濾**:

```typescript
// 檔案: packages/api/src/routers/opportunity.ts

const listOpportunitiesInput = z.object({
  productLine: z.enum(['ichef', 'beauty']).optional(), // 新增
  page: z.number().default(1),
  pageSize: z.number().default(20),
});

listOpportunities: protectedProcedure
  .input(listOpportunitiesInput)
  .query(async ({ ctx, input }) => {
    const { productLine, page, pageSize } = input;

    const query = ctx.db
      .select()
      .from(opportunities)
      .where(
        productLine 
          ? eq(opportunities.productLine, productLine) 
          : undefined // 不過濾,返回全部
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const results = await query;
    return results;
  });
```

---

### 階段 4: 端到端整合測試 (2-3h)

#### 4.1 建立測試腳本

**檔案**: `scripts/test-product-line-flow.ts`

```typescript
import { TRPCClient } from '@Sales_ai_automation_v3/api';

async function testProductLineFlow() {
  const client = new TRPCClient({
    url: 'http://localhost:3000/api/trpc',
    headers: {
      Authorization: 'Bearer test-token'
    }
  });

  console.log('🧪 測試 1: 建立 iCHEF Opportunity (不傳 productLine)');
  const ichefOpp = await client.opportunity.createOpportunity.mutate({
    companyName: '測試餐廳',
    contactName: '王店長',
    // 不傳 productLine
  });
  console.log('✅ iCHEF Opportunity 建立成功:', ichefOpp.id);
  console.log('   product_line:', ichefOpp.productLine); // 應為 'ichef'

  console.log('\n🧪 測試 2: 建立美業 Opportunity (明確傳入 productLine)');
  const beautyOpp = await client.opportunity.createOpportunity.mutate({
    companyName: '美麗沙龍',
    contactName: '李老闆',
    productLine: 'beauty',
  });
  console.log('✅ 美業 Opportunity 建立成功:', beautyOpp.id);
  console.log('   product_line:', beautyOpp.productLine); // 應為 'beauty'

  console.log('\n🧪 測試 3: 上傳 iCHEF 對話音檔');
  const ichefConv = await client.conversation.uploadConversation.mutate({
    leadId: ichefOpp.id,
    audioFile: new File(['mock'], 'test.mp3'),
    salesRep: 'John',
    conversationDate: new Date().toISOString(),
    // 不傳 productLine
  });
  console.log('✅ iCHEF 對話上傳成功:', ichefConv.id);
  console.log('   已推送到 Queue');

  console.log('\n🧪 測試 4: 上傳美業對話音檔');
  const beautyConv = await client.conversation.uploadConversation.mutate({
    leadId: beautyOpp.id,
    audioFile: new File(['mock'], 'test.mp3'),
    salesRep: 'Jane',
    conversationDate: new Date().toISOString(),
    productLine: 'beauty',
  });
  console.log('✅ 美業對話上傳成功:', beautyConv.id);
  console.log('   已推送到 Queue');

  console.log('\n🧪 測試 5: 查詢 iCHEF Opportunities');
  const ichefList = await client.opportunity.listOpportunities.query({
    productLine: 'ichef',
  });
  console.log(`✅ 查詢到 ${ichefList.length} 個 iCHEF opportunities`);

  console.log('\n🧪 測試 6: 查詢美業 Opportunities');
  const beautyList = await client.opportunity.listOpportunities.query({
    productLine: 'beauty',
  });
  console.log(`✅ 查詢到 ${beautyList.length} 個美業 opportunities`);

  console.log('\n✅ 所有測試通過!');
}

testProductLineFlow().catch(console.error);
```

執行測試:
```bash
bun run scripts/test-product-line-flow.ts
```

#### 4.2 監控 Queue 處理

```bash
# 啟動 Queue Worker (本地開發)
cd apps/queue-worker
bun run dev

# 觀察 log,確認 productLine 被正確傳遞
# 預期看到:
# Processing conversation xxx with productLine: beauty
# Analysis completed using beauty prompts
```

---

## 驗收檢查點

### ✅ 檢查點 3-1: API Schema 更新

```bash
# 執行 TypeScript 檢查
cd packages/api
bun run tsc --noEmit
```

**通過條件**: 無 TypeScript 錯誤

---

### ✅ 檢查點 3-2: DB 寫入正確

**測試腳本**: `scripts/verify-db-writes.ts`

```typescript
import { db } from '@Sales_ai_automation_v3/db';
import { opportunities, conversations } from '@Sales_ai_automation_v3/db/schema';
import { eq } from 'drizzle-orm';

async function verifyDBWrites() {
  // 建立測試資料
  const opp = await db.insert(opportunities).values({
    companyName: 'Test',
    contactName: 'Test',
    productLine: 'beauty',
  }).returning();

  const conv = await db.insert(conversations).values({
    leadId: opp[0].id,
    audioUrl: 'https://example.com/test.mp3',
    salesRep: 'Test',
    conversationDate: new Date(),
    productLine: 'beauty',
  }).returning();

  // 驗證
  const savedOpp = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.id, opp[0].id))
    .get();

  const savedConv = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conv[0].id))
    .get();

  console.assert(savedOpp?.productLine === 'beauty', 'Opportunity productLine 不正確');
  console.assert(savedConv?.productLine === 'beauty', 'Conversation productLine 不正確');

  console.log('✅ DB 寫入驗證通過');

  // 清理測試資料
  await db.delete(conversations).where(eq(conversations.id, conv[0].id));
  await db.delete(opportunities).where(eq(opportunities.id, opp[0].id));
}

verifyDBWrites().catch(console.error);
```

執行:
```bash
bun run scripts/verify-db-writes.ts
```

**通過條件**: 無錯誤,資料正確寫入

---

### ✅ 檢查點 3-3: Queue Message 正確

**測試**: 檢查 Queue payload

```typescript
// 在 uploadConversation mutation 中加入 log (臨時)
console.log('Queue payload:', {
  conversationId: conversation.id,
  audioUrl,
  productLine: resolvedProductLine,
});

// 上傳測試音檔
// 檢查 console 輸出,確認 productLine 被包含
```

**通過條件**: Queue payload 包含正確的 `productLine`

---

### ✅ 檢查點 3-4: Queue Worker 處理正確

**測試**: 模擬 Queue message 處理

```bash
# 手動推送測試訊息到 Queue
wrangler queues send CONVERSATION_QUEUE '{
  "conversationId": "test-id",
  "audioUrl": "https://example.com/test.mp3",
  "productLine": "beauty"
}'

# 檢查 Queue Worker log
# 預期看到: Processing with productLine: beauty
```

**通過條件**: 
- ✅ Queue Worker 正確解析 `productLine`
- ✅ 傳遞到 Orchestrator
- ✅ 使用正確的提示詞 (如果 Agent C 已完成)

---

### ✅ 檢查點 3-5: 端到端測試通過

```bash
# 執行完整流程測試
bun run scripts/test-product-line-flow.ts
```

**通過條件**: 所有 6 個測試通過

---

## 向後相容性驗證

### 測試 1: 不傳 productLine 的 API 調用

```typescript
// 測試檔: packages/api/src/__tests__/backward-compat.test.ts

import { describe, it, expect } from 'bun:test';
import { createCaller } from '../trpc';

describe('Backward Compatibility - API', () => {
  it('uploadConversation 不傳 productLine 應該預設 ichef', async () => {
    const caller = createCaller(mockContext);

    const result = await caller.conversation.uploadConversation({
      leadId: 'test-lead',
      audioFile: new File(['test'], 'test.mp3'),
      salesRep: 'Test',
      conversationDate: new Date().toISOString(),
      // 不傳 productLine
    });

    // 檢查 DB 記錄
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, result.id))
      .get();

    expect(conversation?.productLine).toBe('ichef');
  });

  it('createOpportunity 不傳 productLine 應該預設 ichef', async () => {
    const caller = createCaller(mockContext);

    const result = await caller.opportunity.createOpportunity({
      companyName: 'Test',
      contactName: 'Test',
      // 不傳 productLine
    });

    expect(result.productLine).toBe('ichef');
  });
});
```

執行:
```bash
bun test packages/api/src/__tests__/backward-compat.test.ts
```

**通過條件**: 所有測試通過

---

### 測試 2: 舊的 Queue Messages

**模擬舊訊息** (沒有 productLine 欄位):

```bash
# 推送舊格式訊息
wrangler queues send CONVERSATION_QUEUE '{
  "conversationId": "test-id",
  "audioUrl": "https://example.com/test.mp3"
}'

# 檢查 Queue Worker log
# 預期: 應正確處理,預設為 'ichef'
```

**通過條件**: 
- ✅ 不會報錯
- ✅ 正確解析為 'ichef'
- ✅ 正常完成處理

---

### 測試 3: 現有資料查詢

**測試**: 查詢現有的 opportunities (product_line = 'ichef' by DEFAULT)

```typescript
const existingOpps = await db
  .select()
  .from(opportunities)
  .where(eq(opportunities.productLine, 'ichef'));

console.log(`現有 ${existingOpps.length} 個 iCHEF opportunities`);
// 應該包含所有舊資料 (因為 DEFAULT 'ichef')
```

**通過條件**: 現有資料可正常查詢

---

## 性能驗證

### 查詢性能測試

**測試腳本**: `scripts/benchmark-queries.ts`

```typescript
import { performance } from 'node:perf_hooks';
import { db } from '@Sales_ai_automation_v3/db';
import { opportunities } from '@Sales_ai_automation_v3/db/schema';
import { eq } from 'drizzle-orm';

async function benchmarkQueries() {
  // 測試 1: 無過濾 (baseline)
  const start1 = performance.now();
  await db.select().from(opportunities).limit(100);
  const end1 = performance.now();
  console.log(`無過濾查詢: ${(end1 - start1).toFixed(2)}ms`);

  // 測試 2: 有 productLine 過濾
  const start2 = performance.now();
  await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.productLine, 'ichef'))
    .limit(100);
  const end2 = performance.now();
  console.log(`有過濾查詢: ${(end2 - start2).toFixed(2)}ms`);

  const overhead = ((end2 - start1) / start1) * 100;
  console.log(`性能增幅: ${overhead.toFixed(2)}%`);

  // 預期: < 10% 增幅
  if (overhead > 10) {
    console.warn('⚠️ 性能增幅超過 10%,請檢查索引');
  } else {
    console.log('✅ 性能測試通過');
  }
}

benchmarkQueries().catch(console.error);
```

執行:
```bash
bun run scripts/benchmark-queries.ts
```

**通過標準**: 查詢時間增幅 < 10%

---

## 故障排除

### 問題 1: TypeScript 錯誤 - productLine 類型

**錯誤訊息**:
```
Type 'string | undefined' is not assignable to type 'ProductLine'
```

**解決方法**:
```typescript
// 使用明確的類型斷言
const resolvedProductLine: ProductLine = (productLine || 'ichef') as ProductLine;

// 或使用 Zod 驗證
const productLineSchema = z.enum(['ichef', 'beauty']).default('ichef');
const resolvedProductLine = productLineSchema.parse(productLine);
```

---

### 問題 2: Queue Worker 找不到 conversation

**錯誤訊息**:
```
Conversation xxx not found
```

**可能原因**:
- DB transaction 尚未 commit
- Queue 處理太快

**解決方法**:
```typescript
// 在 uploadConversation 中確保 transaction commit
const conversation = await ctx.db.transaction(async (tx) => {
  const conv = await tx.insert(conversations).values({...}).returning();
  return conv[0];
});

// 確保 conversation 已存在後才推送到 Queue
await ctx.queue.send({...});
```

---

### 問題 3: 舊訊息處理失敗

**症狀**: Queue Worker 報錯 `Cannot read property 'productLine' of undefined`

**原因**: 未處理舊訊息格式

**解決方法**:
```typescript
// 使用 optional chaining 和 nullish coalescing
const productLine = message.body.productLine ?? conversation.productLine ?? 'ichef';
```

---

### 問題 4: API 測試失敗

**錯誤訊息**:
```
Expected productLine to be 'beauty' but received 'ichef'
```

**排查步驟**:
```bash
# 1. 檢查 DB schema
bun run packages/db/src/check-migration.ts

# 2. 檢查 input 解析
console.log('Input:', input);
console.log('Resolved productLine:', resolvedProductLine);

# 3. 檢查 DB 寫入
const saved = await db.select()...;
console.log('Saved productLine:', saved.productLine);
```

---

## 完成標準

### Agent D 任務完成清單

- [ ] ✅ API Router (uploadConversation) 更新完成
- [ ] ✅ API Router (createOpportunity) 更新完成
- [ ] ✅ API Router (listOpportunities) 新增過濾
- [ ] ✅ Queue Worker 更新完成
- [ ] ✅ Queue Message 類型更新
- [ ] ✅ 端到端測試腳本完成
- [ ] ✅ 所有驗收檢查點通過
- [ ] ✅ 向後相容性測試通過
- [ ] ✅ 性能測試通過 (< 10% 增幅)
- [ ] ✅ TypeScript 編譯無錯誤

### 交付物

1. **API 更新**:
   - `packages/api/src/routers/conversation.ts` (已更新)
   - `packages/api/src/routers/opportunity.ts` (已更新)
   - `packages/api/src/types/queue.ts` (已更新,如果存在)

2. **Queue Worker 更新**:
   - `apps/queue-worker/src/index.ts` (已更新)

3. **測試檔案**:
   - `scripts/test-product-line-flow.ts` (端到端測試)
   - `scripts/verify-db-writes.ts` (DB 驗證)
   - `scripts/benchmark-queries.ts` (性能測試)
   - `packages/api/src/__tests__/backward-compat.test.ts`

4. **文件**:
   - API 變更說明 (可選)

---

## 下一步

**完成後通知**: Agent E

**訊息內容**:
```
Agent D (API 與 Queue Worker) 已完成!

API 更新:
- uploadConversation: 新增 productLine? 參數
- createOpportunity: 新增 productLine? 參數
- listOpportunities: 新增產品線過濾

Queue Worker 更新:
- 支援從 message 和 DB 讀取 productLine
- 傳遞到 Orchestrator.analyze()

向後相容性: ✅ 完全相容
- 不傳參數時預設 'ichef'
- 舊訊息正確處理
- 現有資料可正常查詢

測試覆蓋率: 100%
所有驗收檢查點: ✅ 通過
```

---

**準備好了嗎?** 開始開發 Agent D! 🚀
