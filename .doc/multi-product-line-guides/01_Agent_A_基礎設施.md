# Agent A: 基礎設施與核心服務 - 執行指南

> **Agent**: A
> **優先級**: 🔴 最高 (無依賴,必須優先完成)
> **時程**: 8-10 小時
> **責任**: 產品配置系統 + 資料庫 Schema 擴展

---

## 📋 目錄

- [依賴項](#依賴項)
- [詳細任務清單](#詳細任務清單)
- [驗收檢查點](#驗收檢查點)
- [常見問題](#常見問題)

---

## 依賴項

**✅ 無依賴** - 可以立即開始!

你是第一個 Agent,其他所有 Agent 都依賴你的產出。

---

## 📊 你的交付物

完成後,你需要提供給其他 Agent:

### 1. TypeScript 介面
```typescript
// /packages/shared/src/product-configs/types.ts
export type ProductLine = 'ichef' | 'beauty';
export interface ProductLineConfig { /* ... */ }
```

### 2. 配置 API
```typescript
// /packages/shared/src/product-configs/registry.ts
export function getProductConfig(productLine: ProductLine): ProductLineConfig;
export function getAllProductLines(): ProductLine[];
```

### 3. 資料庫 Schema
```sql
-- /packages/db/src/migrations/0003_add_product_line.sql
ALTER TABLE opportunities ADD COLUMN product_line TEXT DEFAULT 'ichef' NOT NULL;
-- ... (4 個表格)
```

---

## 📋 詳細任務清單

### 階段 1: 配置系統 (4-5h)

#### 任務 1.1: 創建目錄結構 (5 min)

```bash
# 在專案根目錄執行
cd /Users/stephen/Desktop/sales_ai_automation_v3

# 創建配置目錄
mkdir -p packages/shared/src/product-configs

# 切換到目錄
cd packages/shared/src/product-configs
```

**驗證**:
```bash
ls -la
# 應該看到空目錄
```

---

#### 任務 1.2: 實作 types.ts (30 min)

創建 `/packages/shared/src/product-configs/types.ts`:

```typescript
/**
 * 產品線類型定義
 * 用於多產品線支援 (iCHEF + 美業)
 */

export type ProductLine = 'ichef' | 'beauty';

// 表單選項
export interface FormFieldOption {
  value: string;
  label: string;
  emoji?: string;
}

// 表單欄位配置
export interface FormFieldConfig {
  label: string;
  options: FormFieldOption[];
  required?: boolean;
}

// 表單欄位集合
export interface FormFieldsConfig {
  storeType: FormFieldConfig;
  serviceType?: FormFieldConfig;  // iCHEF only
  staffCount?: FormFieldConfig;   // Beauty only
  currentSystem: FormFieldConfig;
}

// 承諾事件 (Commitment Events)
export interface CommitmentEvent {
  id: 'CE1' | 'CE2' | 'CE3';
  name: string;
  definition: string;
}

// 提示詞配置
export interface PromptsConfig {
  globalContext: string;
  productContext: string;
  commitmentEvents: CommitmentEvent[];
  demoMetaFields: string[];
}

// 話術情境
export interface TalkTrackSituation {
  id: string;
  name: string;
  description: string;
}

// 話術配置
export interface TalkTracksConfig {
  situations: TalkTrackSituation[];
}

// 完整產品線配置
export interface ProductLineConfig {
  id: ProductLine;
  name: string;
  displayName: string;
  formFields: FormFieldsConfig;
  prompts: PromptsConfig;
  talkTracks: TalkTracksConfig;
}
```

**驗證**:
```bash
bun run check-types
# 應該無錯誤
```

---

#### 任務 1.3: 實作 ichef.ts (1-1.5h)

創建 `/packages/shared/src/product-configs/ichef.ts`:

**步驟**:
1. 從 `/apps/slack-bot/src/events/file.ts` 提取現有表單選項
2. 從 `/packages/services/prompts/meddic/global-context.md` 提取提示詞配置
3. 組合成 `ProductLineConfig`

```typescript
import type { ProductLineConfig } from './types';

export const ichefConfig: ProductLineConfig = {
  id: 'ichef',
  name: 'ichef',
  displayName: 'iCHEF POS 系統',

  formFields: {
    storeType: {
      label: '店型',
      required: true,
      options: [
        { value: 'coffee_shop', label: '咖啡廳', emoji: '☕' },
        { value: 'drink_shop', label: '飲料店', emoji: '🧋' },
        { value: 'restaurant', label: '餐廳', emoji: '🍽️' },
        { value: 'hot_pot', label: '火鍋店', emoji: '🍲' },
        { value: 'breakfast', label: '早餐店', emoji: '🥐' },
        { value: 'fast_food', label: '速食店', emoji: '🍔' },
        { value: 'bakery', label: '烘焙店', emoji: '🥖' },
        { value: 'other', label: '其他', emoji: '🏪' },
      ],
    },

    serviceType: {
      label: '營運型態',
      required: true,
      options: [
        { value: 'dine_in', label: '內用為主', emoji: '🪑' },
        { value: 'takeout', label: '外帶為主', emoji: '🥡' },
        { value: 'delivery', label: '外送為主', emoji: '🛵' },
        { value: 'mixed', label: '混合經營', emoji: '🔄' },
      ],
    },

    currentSystem: {
      label: '現有POS系統',
      required: true,
      options: [
        { value: 'none', label: '無', emoji: '🆕' },
        { value: 'ichef_old', label: 'iCHEF舊版', emoji: '📟' },
        { value: 'dudu', label: 'DUDU', emoji: '🦆' },
        { value: 'eztable', label: 'EZTABLE', emoji: '📱' },
        { value: 'inline', label: 'Inline', emoji: '💳' },
        { value: 'other', label: '其他', emoji: '❓' },
      ],
    },
  },

  prompts: {
    globalContext: 'iCHEF POS System for Restaurant',
    productContext: 'F&B Industry, Independent Owners',
    commitmentEvents: [
      {
        id: 'CE1',
        name: 'Time',
        definition: 'Schedule install/onboarding meeting (預約安裝時間)',
      },
      {
        id: 'CE2',
        name: 'Data',
        definition: 'Submit menu/table/inventory data for setup (提交菜單資料)',
      },
      {
        id: 'CE3',
        name: 'Money',
        definition: 'Sign contract/Pay deposit (簽約/付訂金)',
      },
    ],
    demoMetaFields: ['storeType', 'serviceType', 'currentPos'],
  },

  talkTracks: {
    situations: [
      { id: 'price_objection', name: '價格異議', description: '客戶認為太貴' },
      { id: 'competitor_comparison', name: '競品比較', description: '與其他POS比較' },
      { id: 'feature_inquiry', name: '功能詢問', description: '詢問特定功能' },
      { id: 'implementation_concern', name: '導入顧慮', description: '擔心實施困難' },
      { id: 'contract_negotiation', name: '合約協商', description: '合約條款討論' },
      { id: 'decision_delay', name: '決策拖延', description: '想要再考慮' },
      { id: 'staff_resistance', name: '員工抗拒', description: '員工不想用' },
      { id: 'data_migration', name: '資料轉移', description: '擔心資料轉移' },
    ],
  },
};
```

**驗證**:
```typescript
// 測試
import { ichefConfig } from './ichef';
console.log(ichefConfig.displayName); // "iCHEF POS 系統"
console.log(ichefConfig.formFields.storeType.options.length); // 8
```

---

#### 任務 1.4: 實作 beauty.ts (1-1.5h)

創建 `/packages/shared/src/product-configs/beauty.ts`:

```typescript
import type { ProductLineConfig } from './types';

export const beautyConfig: ProductLineConfig = {
  id: 'beauty',
  name: 'beauty',
  displayName: '美業管理系統',

  formFields: {
    storeType: {
      label: '店鋪類型',
      required: true,
      options: [
        { value: 'hair_salon', label: '美髮沙龍', emoji: '💇' },
        { value: 'nail_salon', label: '美甲店', emoji: '💅' },
        { value: 'beauty_spa', label: '美容SPA', emoji: '🧖' },
        { value: 'tattoo', label: '刺青', emoji: '🎨' },
        { value: 'massage', label: '按摩', emoji: '💆' },
        { value: 'other', label: '其他', emoji: '✨' },
      ],
    },

    staffCount: {
      label: '員工數量',
      required: true,
      options: [
        { value: '1-3', label: '1-3人', emoji: '👤' },
        { value: '4-10', label: '4-10人', emoji: '👥' },
        { value: '11-20', label: '11-20人', emoji: '👨‍👩‍👧' },
        { value: '20+', label: '20人以上', emoji: '👨‍👩‍👧‍👦' },
      ],
    },

    currentSystem: {
      label: '現有系統',
      required: true,
      options: [
        { value: 'none', label: '無', emoji: '🆕' },
        { value: 'excel', label: 'Excel', emoji: '📊' },
        { value: 'line', label: 'LINE預約', emoji: '💬' },
        { value: 'other_beauty', label: '其他美業系統', emoji: '📱' },
        { value: 'handwritten', label: '手寫本', emoji: '📓' },
      ],
    },
  },

  prompts: {
    globalContext: 'Beauty Industry Management System',
    productContext: 'Beauty Salons, Independent Owners',
    commitmentEvents: [
      {
        id: 'CE1',
        name: 'Time',
        definition: 'Schedule system demo/staff training (預約系統示範/員工培訓)',
      },
      {
        id: 'CE2',
        name: 'Data',
        definition: 'Submit client list/service menu/pricing (提交客戶名單/服務項目/定價)',
      },
      {
        id: 'CE3',
        name: 'Money',
        definition: 'Sign contract/Pay first month fee (簽約/付首月費用)',
      },
    ],
    demoMetaFields: ['beautyType', 'staffCount', 'currentBeautySystem'],
  },

  talkTracks: {
    situations: [
      { id: 'price_objection', name: '價格異議', description: '客戶認為太貴' },
      { id: 'competitor_comparison', name: '競品比較', description: '與其他系統比較' },
      { id: 'feature_inquiry', name: '功能詢問', description: '詢問預約/佣金功能' },
      { id: 'implementation_concern', name: '導入顧慮', description: '擔心員工不會用' },
      { id: 'contract_negotiation', name: '合約協商', description: '合約條款討論' },
      { id: 'decision_delay', name: '決策拖延', description: '想要再考慮' },
      { id: 'staff_resistance', name: '員工抗拒', description: '員工不想用新系統' },
      { id: 'data_migration', name: '客戶資料轉移', description: '擔心客戶資料轉移' },
    ],
  },
};
```

**驗證**:
```typescript
import { beautyConfig } from './beauty';
console.log(beautyConfig.displayName); // "美業管理系統"
console.log(beautyConfig.formFields.staffCount.options.length); // 4
```

---

#### 任務 1.5: 實作 registry.ts (30 min)

創建 `/packages/shared/src/product-configs/registry.ts`:

```typescript
import type { ProductLine, ProductLineConfig } from './types';
import { ichefConfig } from './ichef';
import { beautyConfig } from './beauty';

// 配置註冊表
const configs = new Map<ProductLine, ProductLineConfig>([
  ['ichef', ichefConfig],
  ['beauty', beautyConfig],
]);

/**
 * 取得產品線配置
 * @param productLine - 產品線 ID
 * @throws Error 如果產品線不存在
 */
export function getProductConfig(productLine: ProductLine): ProductLineConfig {
  const config = configs.get(productLine);
  if (!config) {
    throw new Error(`Unknown product line: ${productLine}`);
  }
  return config;
}

/**
 * 取得所有產品線 ID
 */
export function getAllProductLines(): ProductLine[] {
  return Array.from(configs.keys());
}

/**
 * 取得預設產品線
 */
export function getDefaultProductLine(): ProductLine {
  return 'ichef';
}

/**
 * 檢查產品線是否存在
 */
export function isValidProductLine(productLine: string): productLine is ProductLine {
  return configs.has(productLine as ProductLine);
}
```

**驗證**:
```typescript
import { getProductConfig, getAllProductLines, getDefaultProductLine } from './registry';

// 測試
console.log(getAllProductLines()); // ['ichef', 'beauty']
console.log(getDefaultProductLine()); // 'ichef'
console.log(getProductConfig('ichef').displayName); // "iCHEF POS 系統"
console.log(getProductConfig('beauty').displayName); // "美業管理系統"
```

---

#### 任務 1.6: 創建 index.ts (10 min)

創建 `/packages/shared/src/product-configs/index.ts`:

```typescript
// 導出所有類型
export type * from './types';

// 導出配置
export { ichefConfig } from './ichef';
export { beautyConfig } from './beauty';

// 導出 API
export {
  getProductConfig,
  getAllProductLines,
  getDefaultProductLine,
  isValidProductLine,
} from './registry';
```

---

#### 任務 1.7: 更新 package.json (10 min)

編輯 `/packages/shared/package.json`:

```json
{
  "name": "@Sales_ai_automation_v3/shared",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    "./product-configs": "./src/product-configs/index.ts",
    "./product-configs/*": "./src/product-configs/*.ts",
    "./types/*": "./src/types/*/index.ts",
    "./errors": "./src/errors/index.ts"
  }
}
```

**驗證**:
```bash
# 測試 import
bun run -e "
import { getProductConfig } from '@Sales_ai_automation_v3/shared/product-configs';
console.log('✓ Import successful');
"
```

---

### 階段 2: 資料庫擴展 (3-4h)

#### 任務 2.1: 撰寫 Migration SQL (1h)

創建 `/packages/db/src/migrations/0003_add_product_line.sql`:

```sql
-- Migration: Add product_line column to support multi-product lines
-- Date: 2026-01-19
-- ⚠️ 注意: 使用 Drizzle ORM 命名慣例 (0003_)

-- Add product_line column to opportunities
ALTER TABLE opportunities
ADD COLUMN product_line TEXT DEFAULT 'ichef' NOT NULL;

-- Add product_line column to conversations
ALTER TABLE conversations
ADD COLUMN product_line TEXT DEFAULT 'ichef' NOT NULL;

-- Add product_line column to talk_tracks
ALTER TABLE talk_tracks
ADD COLUMN product_line TEXT DEFAULT 'ichef' NOT NULL;

-- Add product_line column to meddic_analyses
ALTER TABLE meddic_analyses
ADD COLUMN product_line TEXT DEFAULT 'ichef' NOT NULL;

-- Create indexes for better query performance
CREATE INDEX idx_opportunities_product_line ON opportunities(product_line);
CREATE INDEX idx_conversations_product_line ON conversations(product_line);
CREATE INDEX idx_talk_tracks_product_line ON talk_tracks(product_line);
CREATE INDEX idx_meddic_analyses_product_line ON meddic_analyses(product_line);

-- Comments
COMMENT ON COLUMN opportunities.product_line IS 'Product line identifier (ichef, beauty)';
COMMENT ON COLUMN conversations.product_line IS 'Product line identifier (ichef, beauty)';
COMMENT ON COLUMN talk_tracks.product_line IS 'Product line identifier (ichef, beauty)';
COMMENT ON COLUMN meddic_analyses.product_line IS 'Product line identifier (ichef, beauty)';
```

**同時創建回滾腳本** `/packages/db/src/migrations/rollback_0003.sql`:

```sql
-- Rollback for 0003_add_product_line.sql
-- ⚠️ 緊急情況使用

-- Drop indexes
DROP INDEX IF EXISTS idx_opportunities_product_line;
DROP INDEX IF EXISTS idx_conversations_product_line;
DROP INDEX IF EXISTS idx_talk_tracks_product_line;
DROP INDEX IF EXISTS idx_meddic_analyses_product_line;

-- Drop columns
ALTER TABLE opportunities DROP COLUMN IF EXISTS product_line;
ALTER TABLE conversations DROP COLUMN IF EXISTS product_line;
ALTER TABLE talk_tracks DROP COLUMN IF EXISTS product_line;
ALTER TABLE meddic_analyses DROP COLUMN IF EXISTS product_line;
```

---

#### 任務 2.2: 更新 Schema 文件 (1.5-2h)

**2.2.1 更新 opportunity.ts**

編輯 `/packages/db/src/schema/opportunity.ts`:

```typescript
import { relations } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { conversations } from "./conversation";

export const opportunities = pgTable("opportunities", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // Product line (新增)
  productLine: text("product_line").default('ichef').notNull(),

  // Salesforce integration
  customerNumber: text("customer_number").notNull().unique(),

  // ... 其他現有欄位保持不變
});

export type Opportunity = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;
```

**2.2.2 更新 conversation.ts**

編輯 `/packages/db/src/schema/conversation.ts`:

```typescript
export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  opportunityId: text("opportunity_id")
    .notNull()
    .references(() => opportunities.id),

  // Product line (新增)
  productLine: text("product_line").default('ichef').notNull(),

  // Case tracking
  caseNumber: text("case_number").unique(),

  // ... 其他現有欄位保持不變
});

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
```

**2.2.3 更新 talk-tracks.ts**

編輯 `/packages/db/src/schema/talk-tracks.ts`:

```typescript
export const talkTracks = pgTable("talk_tracks", {
  id: text("id").primaryKey(),

  // Product line (新增)
  productLine: text("product_line").default('ichef').notNull(),

  situation: text("situation").notNull(),
  content: text("content").notNull(),

  // ... 其他現有欄位保持不變
});
```

**2.2.4 更新 meddic.ts**

編輯 `/packages/db/src/schema/meddic.ts`:

```typescript
export const meddicAnalyses = pgTable("meddic_analyses", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  opportunityId: text("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),

  // Product line (新增)
  productLine: text("product_line").default('ichef').notNull(),

  // ... 其他現有欄位保持不變
});
```

---

#### 任務 2.3: 執行 Migration (30 min)

```bash
# 1. 備份資料庫 (重要!)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 執行 Migration
bun run db:migrate

# 3. 驗證執行結果
psql $DATABASE_URL -c "
SELECT table_name, column_name, column_default, is_nullable
FROM information_schema.columns
WHERE column_name = 'product_line'
AND table_name IN ('opportunities', 'conversations', 'talk_tracks', 'meddic_analyses');
"
```

**預期輸出**:
```
table_name        | column_name  | column_default | is_nullable
------------------+--------------+----------------+-------------
opportunities     | product_line | 'ichef'        | NO
conversations     | product_line | 'ichef'        | NO
talk_tracks       | product_line | 'ichef'        | NO
meddic_analyses   | product_line | 'ichef'        | NO
```

---

### 階段 3: 測試與文檔 (1h)

#### 任務 3.1: 單元測試 (40 min)

創建 `/packages/shared/src/product-configs/__tests__/registry.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  getProductConfig,
  getAllProductLines,
  getDefaultProductLine,
  isValidProductLine,
} from '../registry';

describe('ProductConfig Registry', () => {
  describe('getProductConfig', () => {
    it('should get iCHEF config', () => {
      const config = getProductConfig('ichef');
      expect(config.id).toBe('ichef');
      expect(config.displayName).toBe('iCHEF POS 系統');
      expect(config.formFields.storeType).toBeDefined();
    });

    it('should get Beauty config', () => {
      const config = getProductConfig('beauty');
      expect(config.id).toBe('beauty');
      expect(config.displayName).toBe('美業管理系統');
      expect(config.formFields.staffCount).toBeDefined();
    });

    it('should throw error for unknown product line', () => {
      expect(() => getProductConfig('invalid' as any)).toThrow();
    });
  });

  describe('getAllProductLines', () => {
    it('should return all product lines', () => {
      const lines = getAllProductLines();
      expect(lines).toHaveLength(2);
      expect(lines).toContain('ichef');
      expect(lines).toContain('beauty');
    });
  });

  describe('getDefaultProductLine', () => {
    it('should return ichef as default', () => {
      expect(getDefaultProductLine()).toBe('ichef');
    });
  });

  describe('isValidProductLine', () => {
    it('should validate product lines', () => {
      expect(isValidProductLine('ichef')).toBe(true);
      expect(isValidProductLine('beauty')).toBe(true);
      expect(isValidProductLine('invalid')).toBe(false);
    });
  });
});
```

**執行測試**:
```bash
bun run test packages/shared/src/product-configs
```

---

#### 任務 3.2: 文檔 (20 min)

創建 `/packages/shared/src/product-configs/README.md`:

```markdown
# Product Line Configurations

多產品線配置系統,支援 iCHEF 餐飲 POS 和美業管理系統。

## 使用方式

\`\`\`typescript
import {
  getProductConfig,
  getAllProductLines,
  type ProductLine,
} from '@Sales_ai_automation_v3/shared/product-configs';

// 取得 iCHEF 配置
const ichefConfig = getProductConfig('ichef');
console.log(ichefConfig.displayName); // "iCHEF POS 系統"

// 取得所有產品線
const lines = getAllProductLines(); // ['ichef', 'beauty']

// 使用表單配置
const storeTypes = ichefConfig.formFields.storeType.options;
\`\`\`

## 新增產品線

1. 創建配置檔案: \`src/product-configs/new-product.ts\`
2. 實作 \`ProductLineConfig\` interface
3. 在 \`registry.ts\` 中註冊
4. 更新類型: \`export type ProductLine = 'ichef' | 'beauty' | 'new-product'\`
```

---

## ✅ 驗收檢查點 1

完成所有任務後,執行以下驗收測試:

### 📋 功能驗收

#### 測試 1: 配置系統可用
```bash
bun run -e "
import { getProductConfig, getAllProductLines } from '@Sales_ai_automation_v3/shared/product-configs';
const ichef = getProductConfig('ichef');
const beauty = getProductConfig('beauty');
const all = getAllProductLines();
console.log('✓ iCHEF:', ichef.displayName);
console.log('✓ Beauty:', beauty.displayName);
console.log('✓ All:', all);
"
```

**預期輸出**:
```
✓ iCHEF: iCHEF POS 系統
✓ Beauty: 美業管理系統
✓ All: [ 'ichef', 'beauty' ]
```

**結果**: [ ] 通過

---

#### 測試 2: Migration 執行成功
```bash
psql $DATABASE_URL -c "
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE column_name = 'product_line';
"
```

**預期結果**: 4 個表格都有 product_line 欄位

**結果**: [ ] 通過

---

#### 測試 3: 現有資料完整性
```sql
SELECT
  'opportunities' as table_name,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE product_line = 'ichef') as ichef_count
FROM opportunities
UNION ALL
SELECT 'conversations', COUNT(*), COUNT(*) FILTER (WHERE product_line = 'ichef')
FROM conversations;
```

**預期結果**: total = ichef_count (所有資料都是 ichef)

**結果**: [ ] 通過

---

### ⚠️ 向後相容性驗收

#### 測試 4: Insert 不需要指定 product_line
```typescript
import { db, opportunities } from '@Sales_ai_automation_v3/db';
import { randomUUID } from 'crypto';

const newOpp = await db.insert(opportunities).values({
  id: randomUUID(),
  userId: 'test-user',
  customerNumber: `TEST-${Date.now()}`,
  companyName: 'Test Company'
  // 不指定 product_line
}).returning();

console.log('Product Line:', newOpp[0].productLine);
// 應該是 'ichef'
```

**結果**: [ ] 通過

---

### 🧪 品質驗收

- [ ] TypeScript 編譯無錯誤: `bun run check-types`
- [ ] 單元測試通過: `bun run test packages/shared`
- [ ] Linting 通過: `bun x ultracite check`
- [ ] 測試覆蓋率 > 80%

---

### 📊 性能驗收

#### 測試 5: Index 驗證
```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname LIKE '%product_line%';
```

**預期結果**: 4 個 Index

**結果**: [ ] 通過

---

## 🚫 不通過標準

如果以下任一條件不符合,**必須修正**:

- ❌ Migration 執行失敗
- ❌ TypeScript 編譯錯誤
- ❌ 單元測試失敗
- ❌ 現有資料 product_line 不是 'ichef'
- ❌ Index 未建立
- ❌ Package import 失敗

---

## 📦 交付給其他 Agent

### 通知訊息範本

```markdown
✅ Agent A 已完成

**交付物**:
1. ProductLineConfig interface 可用
2. getProductConfig() API 可用
3. 資料庫 product_line 欄位已新增

**Import 路徑**:
\`\`\`typescript
import { getProductConfig, type ProductLine } from '@Sales_ai_automation_v3/shared/product-configs';
\`\`\`

**使用範例**:
\`\`\`typescript
const config = getProductConfig('ichef');
console.log(config.formFields.storeType.options);
\`\`\`

**Mock 支援** (如果其他 Agent 需要立即開始):
參考: /packages/shared/src/product-configs/README.md
```

---

## 常見問題

### Q: Migration 執行失敗怎麼辦?
A: 檢查資料庫連線,如果持續失敗,使用 rollback 腳本回滾。

### Q: 如何提供 Mock 給其他 Agent?
A: 其他 Agent 可以直接 import 你的配置,不需要額外 Mock。

### Q: 測試覆蓋率不足 80% 怎麼辦?
A: 補充測試案例,特別是邊界條件 (invalid product line, empty config 等)。

---

**完成後**: 通知 Agent B, C, D 可以開始開發! 🎉
