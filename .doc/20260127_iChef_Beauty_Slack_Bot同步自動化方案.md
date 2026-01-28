# iChef 與 Beauty Slack Bot 自動同步方案

> 撰寫日期：2026-01-27
> 狀態：待實作

## 問題背景

目前 `apps/slack-bot` (iChef) 和 `apps/slack-bot-beauty` (Beauty) 是完全獨立的應用程式。當在 iChef 這邊新增或調整功能時，需要手動複製到 Beauty，這個流程容易遺漏且維護成本高。

### 現有架構

```
apps/
├── slack-bot/              # iChef Slack Bot (主要開發)
│   ├── src/
│   │   ├── index.ts        # 1302 行 (完整功能)
│   │   ├── api-client.ts   # 347 行 (含 Todo API)
│   │   ├── blocks/         # 10 個 UI 元件
│   │   └── ...
│   └── wrangler.toml
│
└── slack-bot-beauty/       # Beauty Slack Bot (功能較少)
    ├── src/
    │   ├── index.ts        # 638 行 (精簡版)
    │   ├── api-client.ts   # 269 行 (無 Todo API)
    │   ├── blocks/         # 7 個 UI 元件
    │   └── ...
    └── wrangler.toml
```

### 功能差異分析

**iChef 有但 Beauty 缺少的功能：**

| 檔案 | 功能 | 影響 |
|------|------|------|
| `blocks/follow-up-modal.ts` | Follow-up 待辦建立 Modal | Beauty 無法建立後續追蹤待辦 |
| `blocks/todo-reminder.ts` | 每日待辦提醒訊息 | Beauty 無法收到每日提醒 |
| `blocks/todo-action-modals.ts` | 成交/拒絕/完成確認 Modal | Beauty 無法記錄成交或拒絕 |
| `index.ts` Todo handlers | Todo 相關互動處理 | 整個待辦流程缺失 |
| `api-client.ts` Todo API | 待辦事項 API 呼叫 | 無法與後端 Todo 系統互動 |

---

## 解決方案

### 推薦方案：建立 `packages/slack-bot-core` 共享套件

將兩個 Slack Bot 的共同邏輯抽取到一個共享套件，讓兩個應用都導入這個套件。新功能只需在 core 開發一次，兩邊自動獲得。

### 新架構設計

```
packages/
└── slack-bot-core/              # 新增：共享邏輯套件
    ├── src/
    │   ├── blocks/              # 所有 Slack Block UI 元件
    │   │   ├── index.ts
    │   │   ├── follow-up-modal.ts
    │   │   ├── todo-reminder.ts
    │   │   ├── todo-action-modals.ts
    │   │   ├── edit-summary-modal.ts
    │   │   ├── meddic-summary.ts
    │   │   ├── opportunity-card.ts
    │   │   └── analysis-result.ts
    │   │
    │   ├── services/            # 共享服務
    │   │   ├── index.ts
    │   │   ├── api-client.ts    # 統一的 API 客戶端
    │   │   ├── notification.ts  # 通知服務
    │   │   └── slack-client.ts  # Slack API 封裝
    │   │
    │   ├── handlers/            # 統一處理器
    │   │   ├── index.ts
    │   │   ├── interactions.ts  # Interaction 處理
    │   │   ├── events.ts        # Event 處理
    │   │   └── commands.ts      # Command 處理
    │   │
    │   ├── utils/               # 工具函數
    │   │   ├── form-builder.ts  # 動態表單建構
    │   │   └── verify.ts        # Slack 簽名驗證
    │   │
    │   ├── types.ts             # 共享類型定義
    │   └── index.ts             # 主要導出
    │
    ├── package.json
    └── tsconfig.json

apps/
├── slack-bot/                   # 精簡後的 iChef Bot
│   ├── src/
│   │   └── index.ts             # ~100 行，導入 core 並設定 productLine='ichef'
│   └── wrangler.toml
│
└── slack-bot-beauty/            # 精簡後的 Beauty Bot
    ├── src/
    │   └── index.ts             # ~100 行，導入 core 並設定 productLine='beauty'
    └── wrangler.toml
```

---

## 詳細實作步驟

### Phase 1：建立 Package 結構

**1.1 建立目錄結構**
```bash
mkdir -p packages/slack-bot-core/src/{blocks,services,handlers,utils}
```

**1.2 建立 `package.json`**
```json
{
  "name": "@sales_ai_automation_v3/slack-bot-core",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "hono": "^4.x",
    "@sales_ai_automation_v3/shared": "workspace:*"
  }
}
```

**1.3 建立 `tsconfig.json`**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

### Phase 2：移動 Blocks 模組

**需要移動的檔案：**

| 來源 | 目標 |
|------|------|
| `apps/slack-bot/src/blocks/follow-up-modal.ts` | `packages/slack-bot-core/src/blocks/` |
| `apps/slack-bot/src/blocks/todo-reminder.ts` | `packages/slack-bot-core/src/blocks/` |
| `apps/slack-bot/src/blocks/todo-action-modals.ts` | `packages/slack-bot-core/src/blocks/` |
| `apps/slack-bot/src/blocks/edit-summary-modal.ts` | `packages/slack-bot-core/src/blocks/` |
| `apps/slack-bot/src/blocks/meddic-summary.ts` | `packages/slack-bot-core/src/blocks/` |
| `apps/slack-bot/src/blocks/opportunity-card.ts` | `packages/slack-bot-core/src/blocks/` |
| `apps/slack-bot/src/blocks/analysis-result.ts` | `packages/slack-bot-core/src/blocks/` |
| `apps/slack-bot/src/blocks/index.ts` | `packages/slack-bot-core/src/blocks/` |

**重要修改：確保所有函數支援 `productLine` 參數**
```typescript
// 修改前
export function buildFollowUpModal(opportunity: Opportunity) { ... }

// 修改後
export function buildFollowUpModal(
  opportunity: Opportunity,
  productLine: ProductLine = 'ichef'
) { ... }
```

### Phase 3：移動 Services 模組

**3.1 合併 `api-client.ts`**
- 以 iChef 版本為基礎（347 行，包含完整 Todo API）
- 確保所有 API 呼叫支援 `productLine` 參數

**3.2 移動其他服務**
- `notification.ts` → `packages/slack-bot-core/src/services/`
- `slack-client.ts` → `packages/slack-bot-core/src/services/`

### Phase 4：建立 Handlers 工廠

**設計統一的處理器工廠：**

```typescript
// packages/slack-bot-core/src/handlers/interactions.ts
import type { ProductLine } from '@sales_ai_automation_v3/shared';

export function createInteractionHandlers(productLine: ProductLine) {
  return {
    // 共用 handlers
    handleAudioUploadSubmit: (payload, env) => { ... },
    handleEditSummarySubmit: (payload, env) => { ... },
    handleMeddicButtonClick: (payload, env) => { ... },

    // 產品線共用的 Todo handlers
    handleFollowUpSubmit: (payload, env) => { ... },
    handleTodoCompleteSubmit: (payload, env) => { ... },
    handleTodoDealSubmit: (payload, env) => { ... },
    handleTodoRejectSubmit: (payload, env) => { ... },
  };
}
```

### Phase 5：建立統一入口點

**`packages/slack-bot-core/src/index.ts`**

```typescript
import { Hono } from 'hono';
import type { ProductLine } from '@sales_ai_automation_v3/shared';
import { createInteractionHandlers } from './handlers/interactions';
import { createEventHandlers } from './handlers/events';
import { createCommandHandlers } from './handlers/commands';
import { verifySlackRequest } from './utils/verify';

export interface SlackBotConfig {
  productLine: ProductLine;
}

export function createSlackBotApp(config: SlackBotConfig) {
  const { productLine } = config;
  const app = new Hono<{ Bindings: Env }>();

  const interactionHandlers = createInteractionHandlers(productLine);
  const eventHandlers = createEventHandlers(productLine);
  const commandHandlers = createCommandHandlers(productLine);

  // Slack Events endpoint
  app.post('/slack/events', async (c) => {
    // 驗證簽名
    // 處理事件
  });

  // Slack Interactions endpoint
  app.post('/slack/interactions', async (c) => {
    // 驗證簽名
    // 路由到對應 handler
  });

  // Slack Commands endpoint
  app.post('/slack/commands', async (c) => {
    // 驗證簽名
    // 路由到對應 handler
  });

  return app;
}

// 導出所有模組
export * from './blocks';
export * from './services';
export * from './handlers';
export type * from './types';
```

### Phase 6：更新 Apps 入口

**`apps/slack-bot/src/index.ts` (精簡版)**

```typescript
import { createSlackBotApp } from '@sales_ai_automation_v3/slack-bot-core';
import type { Env } from './types';

const app = createSlackBotApp({ productLine: 'ichef' });

export default {
  fetch: app.fetch,

  // Scheduled tasks (如每日提醒)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // 使用 slack-bot-core 的服務
  },
};
```

**`apps/slack-bot-beauty/src/index.ts` (精簡版)**

```typescript
import { createSlackBotApp } from '@sales_ai_automation_v3/slack-bot-core';
import type { Env } from './types';

const app = createSlackBotApp({ productLine: 'beauty' });

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // 使用相同的 slack-bot-core 服務
  },
};
```

---

## 預期效果

### 開發流程改善

**改善前：**
```
1. 在 iChef 開發新功能 (例如新增一個 Modal)
2. 測試 iChef 功能
3. 手動複製代碼到 Beauty
4. 調整 Beauty 特定的內容
5. 測試 Beauty 功能
6. 分別部署兩個 Bot
```

**改善後：**
```
1. 在 slack-bot-core 開發新功能
2. 測試 (兩邊自動共用)
3. 分別部署兩個 Bot
```

### 量化效益

| 指標 | 改善前 | 改善後 |
|------|--------|--------|
| 重複代碼行數 | ~2000 行 | ~100 行 |
| 新功能開發時間 | 2x (需複製) | 1x |
| 同步遺漏風險 | 高 | 無 |
| 維護成本 | 高 | 低 |

---

## 驗證方式

### 1. 單元測試

```bash
# 在 packages/slack-bot-core 執行測試
cd packages/slack-bot-core
bun test
```

### 2. 功能測試清單

**iChef Bot 測試：**
- [ ] 上傳音檔 → 顯示表單 Modal
- [ ] 填寫表單 → 開始分析
- [ ] MEDDIC 分析完成 → 顯示結果卡片
- [ ] 點擊「建立待辦」→ Follow-up Modal
- [ ] 提交待辦 → 成功建立
- [ ] 每日提醒 → 收到待辦清單

**Beauty Bot 測試：**
- [ ] 上傳音檔 → 顯示表單 Modal (含 staffCount)
- [ ] 填寫表單 → 開始分析
- [ ] MEDDIC 分析完成 → 顯示結果卡片
- [ ] 點擊「建立待辦」→ Follow-up Modal (**新功能**)
- [ ] 提交待辦 → 成功建立 (**新功能**)
- [ ] 每日提醒 → 收到待辦清單 (**新功能**)

### 3. 部署流程

```bash
# 1. 部署到 staging
cd apps/slack-bot
bunx wrangler deploy --env staging

cd apps/slack-bot-beauty
bunx wrangler deploy --env staging

# 2. 在 staging 測試
# 3. 確認無誤後部署 production
bunx wrangler deploy
```

---

## 風險與注意事項

### 1. Slack Token 分離
兩個 Bot 使用不同的 Slack App，必須保持：
- `SLACK_BOT_TOKEN` 分開設定
- `SLACK_SIGNING_SECRET` 分開設定
- 部署到不同的 Cloudflare Worker

### 2. 產品線特定邏輯
某些邏輯可能只適用於特定產品線，需要在 handler 中加入判斷：
```typescript
if (productLine === 'ichef') {
  // iChef 特定邏輯
}
```

### 3. 漸進式遷移
建議分階段遷移：
1. 先移動 blocks（風險最低）
2. 再移動 services
3. 最後移動 handlers（風險最高）

---

## 相關檔案參考

- 現有產品線配置：`packages/shared/src/product-configs/`
- iChef Slack Bot：`apps/slack-bot/`
- Beauty Slack Bot：`apps/slack-bot-beauty/`
- 共享類型定義：`packages/shared/src/product-configs/types.ts`
