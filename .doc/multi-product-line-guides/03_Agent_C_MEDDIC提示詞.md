# Agent C: MEDDIC 提示詞開發指南

> **角色**: Agent C 開發者
> **任務**: 重構提示詞結構,支援產品線特定分析
> **預估時間**: 10-12 小時
> **依賴**: Agent A 完成 (或使用 Mock)

---

## 📋 目錄

1. [依賴關係與環境準備](#依賴關係與環境準備)
2. [開發任務拆解](#開發任務拆解)
3. [驗收檢查點](#驗收檢查點)
4. [向後相容性驗證](#向後相容性驗證)
5. [故障排除](#故障排除)

---

## 依賴關係與環境準備

### 依賴 Agent A

**必需的產出**:
- ✅ `ProductLineConfig` interface (types.ts)
- ✅ `getProductConfig()` function (registry.ts)
- ✅ `ProductLine` type ('ichef' | 'beauty')

**如果 Agent A 尚未完成**:
```typescript
// 使用 Mock (臨時)
const MOCK_CONFIG = {
  ichef: {
    id: 'ichef' as const,
    name: 'iCHEF POS System',
    prompts: {
      metrics: ['monthlyRevenue', 'currentPOS'],
      decisionProcess: ['decisionMaker', 'decisionTimeline'],
      // ...
    }
  },
  beauty: {
    id: 'beauty' as const,
    name: 'Beauty Industry',
    prompts: {
      metrics: ['customerRetention', 'serviceCapacity'],
      decisionProcess: ['decisionMaker', 'budget'],
      // ...
    }
  }
};
```

### 環境檢查

```bash
# 1. 確認 prompts 目錄結構
ls -la packages/services/prompts/meddic/

# 2. 確認 build-prompts.ts 存在
ls -la packages/services/scripts/build-prompts.ts

# 3. 確認編譯機制
bun run packages/services/scripts/build-prompts.ts
```

---

## 開發任務拆解

### 階段 1: 重構提示詞目錄結構 (2-3h)

#### 1.1 建立新目錄結構

**目標結構**:
```
packages/services/prompts/meddic/
├── shared/              # 通用提示詞 (所有產品線共用)
│   ├── system.md
│   ├── analysis-framework.md
│   └── output-format.md
├── ichef/               # iCHEF 專屬提示詞
│   ├── metrics-focus.md
│   ├── decision-process.md
│   ├── economic-buyer.md
│   ├── decision-criteria.md
│   ├── identify-pain.md
│   └── champion.md
└── beauty/              # 美業專屬提示詞
    ├── metrics-focus.md
    ├── decision-process.md
    ├── economic-buyer.md
    ├── decision-criteria.md
    ├── identify-pain.md
    └── champion.md
```

**執行命令**:
```bash
# 建立目錄
mkdir -p packages/services/prompts/meddic/{shared,ichef,beauty}

# 移動現有檔案到 shared/
mv packages/services/prompts/meddic/*.md packages/services/prompts/meddic/shared/

# 複製 shared 到 ichef (作為初始模板)
cp packages/services/prompts/meddic/shared/*.md packages/services/prompts/meddic/ichef/
```

#### 1.2 撰寫 iCHEF 專屬提示詞

**檔案**: `packages/services/prompts/meddic/ichef/metrics-focus.md`

```markdown
# Metrics (iCHEF 專屬)

分析以下關鍵指標:

## 營收指標
- 每月營業額範圍
- 客單價趨勢
- 翻桌率

## 系統效能指標
- 目前使用的 POS 系統
- 系統當機頻率
- 結帳速度

## 痛點量化
- 人工對帳耗時 (小時/天)
- 發票開立錯誤率
- 庫存盤點耗時

請從對話中提取這些指標的具體數據。
```

**檔案**: `packages/services/prompts/meddic/ichef/decision-process.md`

```markdown
# Decision Process (iCHEF 專屬)

## 餐飲業決策流程

典型決策鏈:
1. 店長/經理 → 發現問題
2. 老闆/總經理 → 預算核准
3. IT 負責人 (如有) → 技術評估
4. 財務主管 → ROI 評估

## 關鍵決策時間點
- 新店開幕前 (最佳時機)
- 系統合約到期前 3 個月
- 稅務申報季度 (痛點最明顯)

請識別客戶目前處於決策流程的哪個階段。
```

**檔案**: `packages/services/prompts/meddic/ichef/economic-buyer.md`

```markdown
# Economic Buyer (iCHEF 專屬)

## 餐飲業經濟決策者識別

### 單店餐廳
- 預算決策者: 通常是老闆本人
- 影響者: 店長、會計

### 連鎖餐廳 (2-5 家)
- 預算決策者: 總經理/執行長
- 影響者: 各店店長、財務主管

### 大型連鎖 (5+ 家)
- 預算決策者: 董事會/財務長
- 影響者: IT 部門、營運長

## 識別問題
從對話中找出:
1. 誰有權批准 POS 系統採購?
2. 預算金額門檻是多少?
3. 是否需要多層級核准?
```

**其餘檔案**: decision-criteria.md, identify-pain.md, champion.md
(內容類似,調整為 iCHEF 餐飲業情境)

#### 1.3 撰寫美業專屬提示詞

**檔案**: `packages/services/prompts/meddic/beauty/metrics-focus.md`

```markdown
# Metrics (美業專屬)

分析以下關鍵指標:

## 客戶指標
- 月活躍客戶數
- 客戶留存率
- 回購週期

## 營運指標
- 設計師/美容師數量
- 平均服務時長
- 預約填滿率

## 系統效能指標
- 目前使用的預約系統
- 預約衝突頻率
- 客戶資料管理方式 (紙本/Excel/系統)

## 痛點量化
- 預約管理耗時 (小時/天)
- 客戶流失率
- 行銷推廣成本

請從對話中提取這些指標的具體數據。
```

**檔案**: `packages/services/prompts/meddic/beauty/decision-process.md`

```markdown
# Decision Process (美業專屬)

## 美業決策流程

典型決策鏈:
1. 店長/首席設計師 → 發現問題
2. 老闆/股東 → 預算核准
3. 行銷負責人 → 客戶管理需求

## 關鍵決策時間點
- 新店籌備期
- 客戶流失率上升時
- 競爭對手導入新系統後

## 決策考量因素
- 客戶體驗提升
- 設計師工作效率
- 行銷自動化能力

請識別客戶目前處於決策流程的哪個階段。
```

**檔案**: `packages/services/prompts/meddic/beauty/economic-buyer.md`

```markdown
# Economic Buyer (美業專屬)

## 美業經濟決策者識別

### 個人工作室
- 預算決策者: 老闆本人 (通常也是設計師)
- 影響者: 資深設計師

### 中型沙龍 (2-5 位設計師)
- 預算決策者: 老闆/合夥人
- 影響者: 店長、首席設計師

### 連鎖沙龍 (多店)
- 預算決策者: 執行長/營運長
- 影響者: 各店店長、行銷主管

## 識別問題
從對話中找出:
1. 誰有權批准系統採購?
2. 預算範圍 (美業通常較重視 ROI)
3. 是否需要總部核准?
```

**其餘檔案**: decision-criteria.md, identify-pain.md, champion.md
(內容調整為美業情境)

---

### 階段 2: 更新 build-prompts.ts 編譯腳本 (2h)

#### 2.1 修改編譯邏輯

**檔案**: `packages/services/scripts/build-prompts.ts`

**目標**: 支援巢狀目錄結構,生成產品線分類的 prompts

**修改前** (簡化範例):
```typescript
// 原始: 只掃描 prompts/meddic/*.md
const files = glob.sync('prompts/meddic/*.md');
const prompts = files.map(f => ({
  name: path.basename(f, '.md'),
  content: fs.readFileSync(f, 'utf-8')
}));
```

**修改後**:
```typescript
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

interface PromptEntry {
  name: string;
  content: string;
}

interface ProductLinePrompts {
  shared: PromptEntry[];
  ichef: PromptEntry[];
  beauty: PromptEntry[];
}

function buildPrompts() {
  const baseDir = 'packages/services/prompts/meddic';
  
  const productLinePrompts: ProductLinePrompts = {
    shared: [],
    ichef: [],
    beauty: []
  };

  // 掃描 shared
  const sharedFiles = glob.sync(`${baseDir}/shared/*.md`);
  productLinePrompts.shared = sharedFiles.map(f => ({
    name: path.basename(f, '.md'),
    content: fs.readFileSync(f, 'utf-8')
  }));

  // 掃描 ichef
  const ichefFiles = glob.sync(`${baseDir}/ichef/*.md`);
  productLinePrompts.ichef = ichefFiles.map(f => ({
    name: path.basename(f, '.md'),
    content: fs.readFileSync(f, 'utf-8')
  }));

  // 掃描 beauty
  const beautyFiles = glob.sync(`${baseDir}/beauty/*.md`);
  productLinePrompts.beauty = beautyFiles.map(f => ({
    name: path.basename(f, '.md'),
    content: fs.readFileSync(f, 'utf-8')
  }));

  // 生成 TypeScript 檔案
  const output = generateTypeScriptFile(productLinePrompts);
  fs.writeFileSync(
    'packages/services/src/llm/prompts.generated.ts',
    output,
    'utf-8'
  );

  console.log('✅ Prompts compiled successfully');
}

function generateTypeScriptFile(prompts: ProductLinePrompts): string {
  return `// Auto-generated by build-prompts.ts
// Do not edit manually

export const MEDDIC_PROMPTS = {
  shared: {
${prompts.shared.map(p => `    ${toCamelCase(p.name)}: \`${escapeBackticks(p.content)}\`,`).join('\n')}
  },
  ichef: {
${prompts.ichef.map(p => `    ${toCamelCase(p.name)}: \`${escapeBackticks(p.content)}\`,`).join('\n')}
  },
  beauty: {
${prompts.beauty.map(p => `    ${toCamelCase(p.name)}: \`${escapeBackticks(p.content)}\`,`).join('\n')}
  }
} as const;

export type ProductLine = 'ichef' | 'beauty';
`;
}

function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

function escapeBackticks(str: string): string {
  return str.replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

buildPrompts();
```

#### 2.2 測試編譯

```bash
# 執行編譯
bun run packages/services/scripts/build-prompts.ts

# 檢查生成的檔案
cat packages/services/src/llm/prompts.generated.ts
```

**預期輸出格式**:
```typescript
export const MEDDIC_PROMPTS = {
  shared: {
    system: `...`,
    analysisFramework: `...`,
    outputFormat: `...`
  },
  ichef: {
    metricsFocus: `...`,
    decisionProcess: `...`,
    economicBuyer: `...`,
    // ...
  },
  beauty: {
    metricsFocus: `...`,
    decisionProcess: `...`,
    economicBuyer: `...`,
    // ...
  }
} as const;
```

---

### 階段 3: 實作 PromptLoader (3-4h)

#### 3.1 建立 prompt-loader.ts

**檔案**: `packages/services/src/llm/prompt-loader.ts`

```typescript
import { MEDDIC_PROMPTS } from './prompts.generated';
import type { ProductLine } from '@Sales_ai_automation_v3/db';

export interface MeddicPromptSet {
  system: string;
  analysisFramework: string;
  outputFormat: string;
  metricsFocus: string;
  decisionProcess: string;
  economicBuyer: string;
  decisionCriteria: string;
  identifyPain: string;
  champion: string;
}

/**
 * 載入產品線特定的 MEDDIC 提示詞
 * 
 * @param productLine - 產品線 ID
 * @returns 完整的 MEDDIC 提示詞集合
 * 
 * @example
 * ```typescript
 * const prompts = loadMeddicPrompts('ichef');
 * console.log(prompts.metricsFocus); // iCHEF 專屬 Metrics 提示詞
 * ```
 */
export function loadMeddicPrompts(productLine: ProductLine = 'ichef'): MeddicPromptSet {
  const shared = MEDDIC_PROMPTS.shared;
  const specific = MEDDIC_PROMPTS[productLine];

  return {
    // Shared prompts (所有產品線通用)
    system: shared.system,
    analysisFramework: shared.analysisFramework,
    outputFormat: shared.outputFormat,

    // Product-specific prompts
    metricsFocus: specific.metricsFocus,
    decisionProcess: specific.decisionProcess,
    economicBuyer: specific.economicBuyer,
    decisionCriteria: specific.decisionCriteria,
    identifyPain: specific.identifyPain,
    champion: specific.champion,
  };
}

/**
 * 組合完整的 Agent 提示詞
 * 
 * @param agentType - MEDDIC Agent 類型 (metrics, decision-process, etc.)
 * @param productLine - 產品線 ID
 * @returns 完整的提示詞 (system + framework + specific)
 */
export function buildAgentPrompt(
  agentType: keyof Omit<MeddicPromptSet, 'system' | 'analysisFramework' | 'outputFormat'>,
  productLine: ProductLine = 'ichef'
): string {
  const prompts = loadMeddicPrompts(productLine);

  return `${prompts.system}

${prompts.analysisFramework}

${prompts[agentType]}

${prompts.outputFormat}`;
}

/**
 * 取得所有可用的產品線
 */
export function getAvailableProductLines(): ProductLine[] {
  return Object.keys(MEDDIC_PROMPTS).filter(k => k !== 'shared') as ProductLine[];
}
```

#### 3.2 測試 PromptLoader

**建立測試檔**: `packages/services/src/llm/__tests__/prompt-loader.test.ts`

```typescript
import { describe, it, expect } from 'bun:test';
import { loadMeddicPrompts, buildAgentPrompt, getAvailableProductLines } from '../prompt-loader';

describe('PromptLoader', () => {
  it('應該載入 iCHEF 提示詞', () => {
    const prompts = loadMeddicPrompts('ichef');
    
    expect(prompts.metricsFocus).toContain('營業額');
    expect(prompts.metricsFocus).toContain('POS');
    expect(prompts.system).toBeDefined();
  });

  it('應該載入美業提示詞', () => {
    const prompts = loadMeddicPrompts('beauty');
    
    expect(prompts.metricsFocus).toContain('客戶留存率');
    expect(prompts.metricsFocus).toContain('預約');
    expect(prompts.system).toBeDefined();
  });

  it('應該預設為 iCHEF', () => {
    const prompts = loadMeddicPrompts();
    const ichefPrompts = loadMeddicPrompts('ichef');
    
    expect(prompts.metricsFocus).toBe(ichefPrompts.metricsFocus);
  });

  it('應該正確組合 Agent 提示詞', () => {
    const prompt = buildAgentPrompt('metricsFocus', 'ichef');
    
    expect(prompt).toContain('system');
    expect(prompt).toContain('analysisFramework');
    expect(prompt).toContain('營業額'); // iCHEF specific
    expect(prompt).toContain('outputFormat');
  });

  it('應該返回所有可用產品線', () => {
    const lines = getAvailableProductLines();
    
    expect(lines).toContain('ichef');
    expect(lines).toContain('beauty');
    expect(lines).not.toContain('shared');
  });
});
```

執行測試:
```bash
bun test packages/services/src/llm/__tests__/prompt-loader.test.ts
```

---

### 階段 4: 整合到 Orchestrator (3-4h)

#### 4.1 修改 Orchestrator

**檔案**: `packages/services/src/llm/orchestrator.ts`

**修改點 1: 新增 productLine 參數**

找到現有的 `analyze()` 方法:
```typescript
// 修改前
async analyze(params: {
  leadId: string;
  conversationId: string;
  salesRep: string;
  conversationDate: Date;
  transcript: string;
}): Promise<MeddicAnalysis>
```

**修改為**:
```typescript
import { loadMeddicPrompts, buildAgentPrompt } from './prompt-loader';
import type { ProductLine } from '@Sales_ai_automation_v3/db';

async analyze(params: {
  leadId: string;
  conversationId: string;
  salesRep: string;
  conversationDate: Date;
  transcript: string;
  productLine?: ProductLine; // 新增,optional (向後相容)
}): Promise<MeddicAnalysis> {
  const productLine = params.productLine || 'ichef'; // 預設 iCHEF
  
  // 載入產品線特定提示詞
  const prompts = loadMeddicPrompts(productLine);
  
  // ... 繼續原有邏輯
}
```

**修改點 2: 更新 Agent 提示詞**

找到每個 Agent 的提示詞使用:
```typescript
// 修改前 (假設原本直接使用 MEDDIC_PROMPTS)
const metricsAgent = {
  name: 'metrics',
  prompt: MEDDIC_PROMPTS.metricsFocus, // 舊的寫法
  // ...
};
```

**修改為**:
```typescript
// 使用 buildAgentPrompt 動態載入
const metricsAgent = {
  name: 'metrics',
  prompt: buildAgentPrompt('metricsFocus', productLine),
  execute: async () => {
    // ... Agent 執行邏輯
  }
};

const decisionProcessAgent = {
  name: 'decision-process',
  prompt: buildAgentPrompt('decisionProcess', productLine),
  execute: async () => {
    // ...
  }
};

// 其餘 Agents: economicBuyer, decisionCriteria, identifyPain, champion
```

**修改點 3: 保留所有現有參數**

確保不破壞現有調用:
```typescript
// 這些調用必須繼續工作 (向後相容)
await orchestrator.analyze({
  leadId: '123',
  conversationId: '456',
  salesRep: 'John',
  conversationDate: new Date(),
  transcript: '...'
  // 不傳 productLine → 預設 'ichef'
});

// 新的調用
await orchestrator.analyze({
  leadId: '123',
  conversationId: '456',
  salesRep: 'John',
  conversationDate: new Date(),
  transcript: '...',
  productLine: 'beauty' // 明確指定
});
```

#### 4.2 更新 Orchestrator 測試

**檔案**: `packages/services/src/llm/__tests__/orchestrator.test.ts`

新增測試案例:
```typescript
describe('MeddicOrchestrator - Product Line Support', () => {
  it('應該預設使用 iCHEF 提示詞', async () => {
    const result = await orchestrator.analyze({
      leadId: 'test-lead',
      conversationId: 'test-conv',
      salesRep: 'Test Rep',
      conversationDate: new Date(),
      transcript: mockTranscript
      // 不傳 productLine
    });

    // 驗證使用了 iCHEF 提示詞
    expect(result.metrics.some(m => m.includes('POS'))).toBe(true);
  });

  it('應該使用美業提示詞', async () => {
    const result = await orchestrator.analyze({
      leadId: 'test-lead',
      conversationId: 'test-conv',
      salesRep: 'Test Rep',
      conversationDate: new Date(),
      transcript: mockBeautyTranscript,
      productLine: 'beauty'
    });

    // 驗證使用了美業提示詞
    expect(result.metrics.some(m => m.includes('客戶留存'))).toBe(true);
  });
});
```

---

## 驗收檢查點

### ✅ 檢查點 2B-1: 目錄結構正確

```bash
# 執行檢查
tree packages/services/prompts/meddic/

# 預期輸出
packages/services/prompts/meddic/
├── shared/
│   ├── system.md
│   ├── analysis-framework.md
│   └── output-format.md
├── ichef/
│   ├── metrics-focus.md
│   ├── decision-process.md
│   ├── economic-buyer.md
│   ├── decision-criteria.md
│   ├── identify-pain.md
│   └── champion.md
└── beauty/
    ├── metrics-focus.md
    ├── decision-process.md
    ├── economic-buyer.md
    ├── decision-criteria.md
    ├── identify-pain.md
    └── champion.md
```

**通過條件**: 所有檔案存在且命名正確

---

### ✅ 檢查點 2B-2: 編譯機制正常

```bash
# 執行編譯
bun run packages/services/scripts/build-prompts.ts

# 檢查生成檔案
ls -la packages/services/src/llm/prompts.generated.ts

# 驗證內容
grep -A 5 "export const MEDDIC_PROMPTS" packages/services/src/llm/prompts.generated.ts
```

**通過條件**:
- ✅ 編譯無錯誤
- ✅ 生成的檔案包含 shared, ichef, beauty 三個 section
- ✅ 每個 section 包含 6 個提示詞

---

### ✅ 檢查點 2B-3: PromptLoader 功能正確

```bash
# 執行單元測試
bun test packages/services/src/llm/__tests__/prompt-loader.test.ts
```

**通過條件**:
- ✅ 所有測試通過
- ✅ 可載入 iCHEF 提示詞
- ✅ 可載入美業提示詞
- ✅ 預設為 iCHEF
- ✅ buildAgentPrompt 正確組合提示詞

---

### ✅ 檢查點 2B-4: Orchestrator 整合成功

```bash
# 執行 Orchestrator 測試
bun test packages/services/src/llm/__tests__/orchestrator.test.ts
```

**通過條件**:
- ✅ 所有測試通過
- ✅ 不傳 productLine 時預設為 iCHEF
- ✅ 傳入 'beauty' 時使用美業提示詞
- ✅ 現有測試不受影響 (向後相容)

---

### ✅ 檢查點 2B-5: TypeScript 編譯無錯誤

```bash
# 檢查 TypeScript
cd packages/services
bun run tsc --noEmit
```

**通過條件**: 無 TypeScript 錯誤

---

## 向後相容性驗證

### 測試 1: 現有調用不受影響

**測試檔**: `packages/services/src/llm/__tests__/backward-compatibility.test.ts`

```typescript
import { describe, it, expect } from 'bun:test';
import { MeddicOrchestrator } from '../orchestrator';

describe('Backward Compatibility - Prompts', () => {
  it('不傳 productLine 應該使用 iCHEF 提示詞', async () => {
    const orchestrator = new MeddicOrchestrator(/* ... */);

    // 模擬舊的調用方式 (沒有 productLine 參數)
    const result = await orchestrator.analyze({
      leadId: 'test',
      conversationId: 'test',
      salesRep: 'Test',
      conversationDate: new Date(),
      transcript: 'mock transcript'
    });

    expect(result).toBeDefined();
    expect(result.metrics).toBeDefined();
  });

  it('iCHEF 分析品質應保持一致', async () => {
    const orchestrator = new MeddicOrchestrator(/* ... */);

    const oldStyleResult = await orchestrator.analyze({
      leadId: 'test',
      conversationId: 'test',
      salesRep: 'Test',
      conversationDate: new Date(),
      transcript: mockIchefTranscript
    });

    const newStyleResult = await orchestrator.analyze({
      leadId: 'test',
      conversationId: 'test',
      salesRep: 'Test',
      conversationDate: new Date(),
      transcript: mockIchefTranscript,
      productLine: 'ichef'
    });

    // 兩種調用方式結果應該一致
    expect(oldStyleResult.metrics).toEqual(newStyleResult.metrics);
  });
});
```

執行:
```bash
bun test packages/services/src/llm/__tests__/backward-compatibility.test.ts
```

**通過標準**: 所有測試通過,證明向後相容

---

### 測試 2: iCHEF 提示詞品質測試

**目標**: 確保重構後 iCHEF 分析品質不下降

```bash
# 準備測試資料
# 使用真實的 iCHEF 對話記錄進行測試

# 執行分析
bun run scripts/test-meddic-analysis.ts --product-line=ichef --transcript=./test-data/ichef-conversation.txt

# 比對結果
# 與重構前的分析結果比對,確保品質一致
```

**通過標準**:
- ✅ Metrics 提取準確率 > 80%
- ✅ Decision Process 識別正確
- ✅ Economic Buyer 識別準確

---

## 性能驗證

### 效能測試

```typescript
// 測試提示詞載入性能
import { performance } from 'node:perf_hooks';

const iterations = 1000;

const start = performance.now();
for (let i = 0; i < iterations; i++) {
  loadMeddicPrompts('ichef');
  loadMeddicPrompts('beauty');
}
const end = performance.now();

const avgTime = (end - start) / iterations / 2;
console.log(`平均載入時間: ${avgTime.toFixed(2)}ms`);

// 預期: < 1ms (因為是靜態 import)
```

**通過標準**: 平均載入時間 < 50ms

---

## 故障排除

### 問題 1: 編譯失敗 - 找不到檔案

**錯誤訊息**:
```
Error: ENOENT: no such file or directory, open 'packages/services/prompts/meddic/ichef/metrics-focus.md'
```

**解決方法**:
```bash
# 檢查檔案是否存在
ls -la packages/services/prompts/meddic/ichef/

# 確認檔名是否正確 (kebab-case)
# 正確: metrics-focus.md
# 錯誤: metricsFocus.md, metrics_focus.md
```

---

### 問題 2: TypeScript 錯誤 - 類型不匹配

**錯誤訊息**:
```
Type '"shared"' is not assignable to type 'ProductLine'
```

**原因**: `getAvailableProductLines()` 包含了 'shared'

**解決方法**:
```typescript
// 修正 getAvailableProductLines
export function getAvailableProductLines(): ProductLine[] {
  return Object.keys(MEDDIC_PROMPTS)
    .filter(k => k !== 'shared') as ProductLine[]; // 過濾 shared
}
```

---

### 問題 3: 提示詞內容為空

**症狀**: `loadMeddicPrompts('beauty').metricsFocus` 返回空字串

**排查步驟**:
```bash
# 1. 檢查 .md 檔案是否有內容
cat packages/services/prompts/meddic/beauty/metrics-focus.md

# 2. 重新編譯
bun run packages/services/scripts/build-prompts.ts

# 3. 檢查生成的 TypeScript 檔案
cat packages/services/src/llm/prompts.generated.ts | grep -A 10 "beauty:"
```

---

### 問題 4: Orchestrator 測試失敗

**錯誤訊息**:
```
Expected prompt to contain "POS" but received "..."
```

**可能原因**:
- Prompts 未重新編譯
- 快取問題

**解決方法**:
```bash
# 1. 清除快取
rm -rf packages/services/src/llm/prompts.generated.ts

# 2. 重新編譯
bun run packages/services/scripts/build-prompts.ts

# 3. 重新執行測試
bun test packages/services/src/llm/__tests__/orchestrator.test.ts
```

---

## 完成標準

### Agent C 任務完成清單

- [ ] ✅ 目錄結構正確 (shared, ichef, beauty)
- [ ] ✅ iCHEF 提示詞撰寫完成 (6 個檔案)
- [ ] ✅ 美業提示詞撰寫完成 (6 個檔案)
- [ ] ✅ build-prompts.ts 更新完成
- [ ] ✅ 編譯機制測試通過
- [ ] ✅ PromptLoader 實作完成
- [ ] ✅ PromptLoader 測試通過
- [ ] ✅ Orchestrator 整合完成
- [ ] ✅ Orchestrator 測試通過
- [ ] ✅ 向後相容性測試通過
- [ ] ✅ iCHEF 品質測試通過
- [ ] ✅ 性能測試通過 (< 50ms)
- [ ] ✅ TypeScript 編譯無錯誤

### 交付物

1. **Prompts 檔案**:
   - `packages/services/prompts/meddic/shared/*.md` (3 個)
   - `packages/services/prompts/meddic/ichef/*.md` (6 個)
   - `packages/services/prompts/meddic/beauty/*.md` (6 個)

2. **編譯腳本**:
   - `packages/services/scripts/build-prompts.ts` (已更新)

3. **核心程式碼**:
   - `packages/services/src/llm/prompt-loader.ts` (新增)
   - `packages/services/src/llm/orchestrator.ts` (已更新)

4. **測試檔案**:
   - `packages/services/src/llm/__tests__/prompt-loader.test.ts`
   - `packages/services/src/llm/__tests__/backward-compatibility.test.ts`

5. **生成檔案**:
   - `packages/services/src/llm/prompts.generated.ts` (編譯產出)

---

## 下一步

**完成後通知**: Agent D

**訊息內容**:
```
Agent C (MEDDIC 提示詞) 已完成!

可用 API:
- loadMeddicPrompts(productLine): 載入產品線提示詞
- buildAgentPrompt(agentType, productLine): 組合完整提示詞

Orchestrator 已更新:
- analyze() 方法新增 productLine? 參數
- 不傳參數時預設為 'ichef' (向後相容)

測試覆蓋率: 100%
所有驗收檢查點: ✅ 通過
```

---

**準備好了嗎?** 開始開發 Agent C! 🚀
