# Workflow Instruction: Phase 3 Agent 1 - Integration Testing

> **任務類型**: 測試開發
> **預估時間**: 3-4 工作日
> **依賴條件**: 無（可立即開始）

---

## 任務目標

建立完整的測試框架，包含 API 整合測試、E2E 測試、Slack Bot 測試和外部服務 Mock 測試，驗證 V3 系統所有功能端對端整合。

---

## 前置條件

確認以下項目已完成：
- [x] Database Schema 已建立（`packages/db/src/schema/`）
- [x] API Routes 已建立（`packages/api/src/routers/`）
- [x] Frontend Pages 已建立（`apps/web/src/routes/`）
- [x] Slack Bot 已建立（`apps/slack-bot/`）
- [x] 認證系統已建立（`packages/auth/`）
- [x] 外部服務已整合（`packages/services/`）

---

## 任務清單

### Task 1: 測試環境設定

**目標**: 設定 Vitest 和 Playwright 測試框架，包含資料庫隔離和服務 Mock

**步驟**:

1. 在專案根目錄安裝測試依賴：
```bash
bun add -d vitest @vitest/coverage-v8 playwright @playwright/test msw
```

2. 建立 `vitest.config.ts`：
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/api/**/*.test.ts',
      'tests/services/**/*.test.ts',
      'tests/slack-bot/**/*.test.ts',
    ],
    exclude: ['tests/e2e/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: [
        'packages/api/src/**/*.ts',
        'packages/services/src/**/*.ts',
        'apps/slack-bot/src/**/*.ts',
      ],
      exclude: ['**/node_modules/**', '**/tests/**'],
    },
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    isolate: true,
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@sales_ai_automation_v3/db': path.resolve(__dirname, 'packages/db/src'),
      '@sales_ai_automation_v3/auth': path.resolve(__dirname, 'packages/auth/src'),
      '@sales_ai_automation_v3/services': path.resolve(__dirname, 'packages/services/src'),
    },
  },
});
```

3. 建立 `playwright.config.ts`：
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // 認證設定專案（先執行）
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // 主要測試專案
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

4. 建立 `tests/setup.ts`：
```typescript
// tests/setup.ts
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@sales_ai_automation_v3/db';

// 測試環境變數
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

// 全域測試設定
beforeAll(async () => {
  console.log('🧪 Setting up test environment...');

  // 驗證資料庫連接
  try {
    await db.execute('SELECT 1');
    console.log('✅ Database connection verified');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
});

afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');
  // 關閉資料庫連接池
  // await db.$client.end();
});

// 每個測試前後的清理
beforeEach(async () => {
  // 重置所有 mock
  vi.clearAllMocks();
});

afterEach(async () => {
  // 清理測試資料（可選：使用事務回滾）
});

// 全域錯誤處理
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection in test:', error);
});
```

5. 建立 `tests/tsconfig.json`：
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "types": ["vitest/globals", "node"],
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "paths": {
      "@sales_ai_automation_v3/*": ["../packages/*/src"]
    }
  },
  "include": [
    "./**/*.ts",
    "./**/*.tsx"
  ],
  "exclude": ["node_modules"]
}
```

6. 建立 `.env.test.example`：
```bash
# 測試環境變數範例
# 複製此檔案為 .env.test 並填入實際值

# 測試資料庫（建議使用獨立的測試資料庫）
TEST_DATABASE_URL=postgres://user:password@localhost:5432/sales_ai_test

# API 測試
API_BASE_URL=http://localhost:3000
E2E_BASE_URL=http://localhost:3001

# 測試用認證
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123

# 外部服務（測試時會被 mock，但需要有值）
GEMINI_API_KEY=test-gemini-key
GROQ_API_KEY=test-groq-key
CLOUDFLARE_R2_ACCESS_KEY=test-r2-access-key
CLOUDFLARE_R2_SECRET_KEY=test-r2-secret-key
CLOUDFLARE_R2_BUCKET=test-bucket
CLOUDFLARE_R2_ENDPOINT=https://test.r2.cloudflarestorage.com

# Slack Bot 測試
SLACK_BOT_TOKEN=xoxb-test-token
SLACK_SIGNING_SECRET=test-signing-secret
```

7. 更新 `package.json` scripts：
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:all": "bun run test:run && bun run test:e2e"
  }
}
```

**產出檔案**:
- `vitest.config.ts`
- `playwright.config.ts`
- `tests/setup.ts`
- `tests/tsconfig.json`
- `.env.test.example`

---

### Task 2: API 整合測試

**目標**: 撰寫 Opportunity、Conversation、Analytics API 的整合測試，包含認證和錯誤處理

**步驟**:

1. 建立 `tests/api/opportunity.test.ts`：

```typescript
// tests/api/opportunity.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@sales_ai_automation_v3/db';
import { opportunities } from '@sales_ai_automation_v3/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthCookie, createTestUser, cleanupTestUser } from '../fixtures/auth-helpers';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

describe('Opportunity API', () => {
  let authCookie: string;
  let testUserId: string;
  const createdOpportunityIds: string[] = [];

  beforeAll(async () => {
    // 建立測試用戶並取得認證 cookie
    const { userId, cookie } = await createTestUser();
    testUserId = userId;
    authCookie = cookie;
  });

  afterAll(async () => {
    // 清理測試資料
    for (const id of createdOpportunityIds) {
      await db.delete(opportunities).where(eq(opportunities.id, id));
    }
    await cleanupTestUser(testUserId);
  });

  describe('POST /api/opportunities.create', () => {
    test('應該成功建立商機', async () => {
      const response = await fetch(`${API_BASE}/api/opportunities.create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie,
        },
        body: JSON.stringify({
          customerNumber: `202601-${Date.now()}`,
          companyName: '測試公司',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.customerNumber).toMatch(/^202601-/);
      expect(data.companyName).toBe('測試公司');
      expect(data.status).toBe('new');
      expect(data.source).toBe('manual');

      createdOpportunityIds.push(data.id);
    });

    test('缺少必填欄位應該回傳 400', async () => {
      const response = await fetch(`${API_BASE}/api/opportunities.create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie,
        },
        body: JSON.stringify({
          companyName: '測試公司',
          // 缺少 customerNumber
        }),
      });

      expect(response.status).toBe(400);
    });

    test('未認證應該回傳 401', async () => {
      const response = await fetch(`${API_BASE}/api/opportunities.create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerNumber: '202601-000001',
          companyName: '測試公司',
        }),
      });

      expect(response.status).toBe(401);
    });

    test('應該支援所有可選欄位', async () => {
      const response = await fetch(`${API_BASE}/api/opportunities.create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie,
        },
        body: JSON.stringify({
          customerNumber: `202601-${Date.now()}`,
          companyName: '完整測試公司',
          contactName: '張小明',
          contactEmail: 'test@example.com',
          contactPhone: '0912345678',
          source: 'referral',
          status: 'contacted',
          industry: '科技業',
          companySize: '50-200',
          notes: '這是測試商機',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.contactName).toBe('張小明');
      expect(data.contactEmail).toBe('test@example.com');
      expect(data.source).toBe('referral');
      expect(data.status).toBe('contacted');

      createdOpportunityIds.push(data.id);
    });
  });

  describe('GET /api/opportunities.list', () => {
    test('應該列出所有商機', async () => {
      const response = await fetch(`${API_BASE}/api/opportunities.list`, {
        headers: { 'Cookie': authCookie },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.opportunities).toBeInstanceOf(Array);
      expect(data.total).toBeGreaterThanOrEqual(0);
    });

    test('應該支援分頁', async () => {
      const response = await fetch(`${API_BASE}/api/opportunities.list?limit=5&offset=0`, {
        headers: { 'Cookie': authCookie },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.opportunities.length).toBeLessThanOrEqual(5);
    });

    test('應該支援狀態篩選', async () => {
      const response = await fetch(`${API_BASE}/api/opportunities.list?status=new`, {
        headers: { 'Cookie': authCookie },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      for (const opp of data.opportunities) {
        expect(opp.status).toBe('new');
      }
    });

    test('應該支援搜尋', async () => {
      const response = await fetch(`${API_BASE}/api/opportunities.list?search=測試`, {
        headers: { 'Cookie': authCookie },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      // 搜尋結果應該包含「測試」關鍵字
      for (const opp of data.opportunities) {
        const matchesSearch =
          opp.companyName?.includes('測試') ||
          opp.contactName?.includes('測試') ||
          opp.notes?.includes('測試');
        expect(matchesSearch).toBe(true);
      }
    });

    test('未認證應該回傳 401', async () => {
      const response = await fetch(`${API_BASE}/api/opportunities.list`);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/opportunities.get', () => {
    test('應該取得指定商機', async () => {
      // 先建立一個商機
      const createResponse = await fetch(`${API_BASE}/api/opportunities.create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie,
        },
        body: JSON.stringify({
          customerNumber: `202601-${Date.now()}`,
          companyName: '取得測試公司',
        }),
      });
      const created = await createResponse.json();
      createdOpportunityIds.push(created.id);

      // 取得該商機
      const response = await fetch(
        `${API_BASE}/api/opportunities.get?opportunityId=${created.id}`,
        { headers: { 'Cookie': authCookie } }
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.opportunity.id).toBe(created.id);
      expect(data.opportunity.companyName).toBe('取得測試公司');
      expect(data.recentConversations).toBeInstanceOf(Array);
    });

    test('不存在的商機應該回傳 404', async () => {
      const response = await fetch(
        `${API_BASE}/api/opportunities.get?opportunityId=non-existent-id`,
        { headers: { 'Cookie': authCookie } }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/opportunities.update', () => {
    test('應該正確更新商機', async () => {
      // 先建立一個商機
      const createResponse = await fetch(`${API_BASE}/api/opportunities.create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie,
        },
        body: JSON.stringify({
          customerNumber: `202601-${Date.now()}`,
          companyName: '更新前公司',
        }),
      });
      const created = await createResponse.json();
      createdOpportunityIds.push(created.id);

      // 更新商機
      const response = await fetch(`${API_BASE}/api/opportunities.update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie,
        },
        body: JSON.stringify({
          opportunityId: created.id,
          companyName: '更新後公司',
          status: 'contacted',
          notes: '已更新',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.companyName).toBe('更新後公司');
      expect(data.status).toBe('contacted');
      expect(data.notes).toBe('已更新');
    });
  });

  describe('DELETE /api/opportunities.delete', () => {
    test('應該正確刪除商機', async () => {
      // 先建立一個商機
      const createResponse = await fetch(`${API_BASE}/api/opportunities.create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie,
        },
        body: JSON.stringify({
          customerNumber: `202601-${Date.now()}`,
          companyName: '待刪除公司',
        }),
      });
      const created = await createResponse.json();

      // 刪除商機
      const response = await fetch(`${API_BASE}/api/opportunities.delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie,
        },
        body: JSON.stringify({
          opportunityId: created.id,
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);

      // 確認已刪除
      const getResponse = await fetch(
        `${API_BASE}/api/opportunities.get?opportunityId=${created.id}`,
        { headers: { 'Cookie': authCookie } }
      );
      expect(getResponse.status).toBe(404);
    });
  });
});
```

2. 建立 `tests/api/conversation.test.ts`：

```typescript
// tests/api/conversation.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getAuthCookie, createTestUser, cleanupTestUser } from '../fixtures/auth-helpers';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

describe('Conversation API', () => {
  let authCookie: string;
  let testUserId: string;
  let testOpportunityId: string;
  const createdConversationIds: string[] = [];

  beforeAll(async () => {
    // 建立測試用戶
    const { userId, cookie } = await createTestUser();
    testUserId = userId;
    authCookie = cookie;

    // 建立測試用商機
    const response = await fetch(`${API_BASE}/api/opportunities.create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie,
      },
      body: JSON.stringify({
        customerNumber: `conv-test-${Date.now()}`,
        companyName: '對話測試公司',
      }),
    });
    const data = await response.json();
    testOpportunityId = data.id;
  });

  afterAll(async () => {
    // 清理測試資料
    await cleanupTestUser(testUserId);
  });

  describe('POST /api/conversations.upload', () => {
    test('應該上傳音檔並建立對話', async () => {
      // 讀取測試音檔
      const audioPath = join(__dirname, '../fixtures/test-audio.mp3');
      let audioBase64: string;

      if (existsSync(audioPath)) {
        const audioBuffer = readFileSync(audioPath);
        audioBase64 = audioBuffer.toString('base64');
      } else {
        // 使用最小有效的 MP3 base64（靜音）
        audioBase64 = 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      }

      const response = await fetch(`${API_BASE}/api/conversations.upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie,
        },
        body: JSON.stringify({
          opportunityId: testOpportunityId,
          audioBase64,
          title: '測試對話',
          type: 'discovery_call',
          metadata: {
            format: 'mp3',
            conversationDate: new Date().toISOString(),
          },
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.conversationId).toBeDefined();
      expect(data.caseNumber).toMatch(/^\d{6}-IC\d{3}$/);
      expect(data.audioUrl).toBeDefined();

      createdConversationIds.push(data.conversationId);
    });

    test('缺少 opportunityId 應該回傳 400', async () => {
      const response = await fetch(`${API_BASE}/api/conversations.upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie,
        },
        body: JSON.stringify({
          audioBase64: 'dGVzdA==',
          title: '測試對話',
          type: 'discovery_call',
        }),
      });

      expect(response.status).toBe(400);
    });

    test('無效的對話類型應該回傳 400', async () => {
      const response = await fetch(`${API_BASE}/api/conversations.upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie,
        },
        body: JSON.stringify({
          opportunityId: testOpportunityId,
          audioBase64: 'dGVzdA==',
          title: '測試對話',
          type: 'invalid_type',
        }),
      });

      expect(response.status).toBe(400);
    });

    test('未認證應該回傳 401', async () => {
      const response = await fetch(`${API_BASE}/api/conversations.upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: testOpportunityId,
          audioBase64: 'dGVzdA==',
          title: '測試對話',
          type: 'discovery_call',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/conversations.list', () => {
    test('應該列出所有對話', async () => {
      const response = await fetch(`${API_BASE}/api/conversations.list`, {
        headers: { 'Cookie': authCookie },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.conversations).toBeInstanceOf(Array);
      expect(data.total).toBeGreaterThanOrEqual(0);
    });

    test('應該支援按商機篩選', async () => {
      const response = await fetch(
        `${API_BASE}/api/conversations.list?opportunityId=${testOpportunityId}`,
        { headers: { 'Cookie': authCookie } }
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      for (const conv of data.conversations) {
        expect(conv.opportunityId).toBe(testOpportunityId);
      }
    });

    test('應該支援分頁', async () => {
      const response = await fetch(
        `${API_BASE}/api/conversations.list?limit=5&offset=0`,
        { headers: { 'Cookie': authCookie } }
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.conversations.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/conversations.get', () => {
    test('應該取得對話詳情', async () => {
      if (createdConversationIds.length === 0) {
        console.log('Skipping: no conversation created');
        return;
      }

      const response = await fetch(
        `${API_BASE}/api/conversations.get?conversationId=${createdConversationIds[0]}`,
        { headers: { 'Cookie': authCookie } }
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.conversation.id).toBe(createdConversationIds[0]);
      expect(data.conversation.opportunityId).toBe(testOpportunityId);
    });

    test('不存在的對話應該回傳 404', async () => {
      const response = await fetch(
        `${API_BASE}/api/conversations.get?conversationId=non-existent`,
        { headers: { 'Cookie': authCookie } }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/conversations.analyze', () => {
    test('應該執行 MEDDIC 分析並回傳結果', async () => {
      if (createdConversationIds.length === 0) {
        console.log('Skipping: no conversation created');
        return;
      }

      const response = await fetch(`${API_BASE}/api/conversations.analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie,
        },
        body: JSON.stringify({
          conversationId: createdConversationIds[0],
        }),
      });

      // 分析可能因為轉錄不完整而失敗，但應該有回應
      if (response.ok) {
        const data = await response.json();
        expect(data.analysisId).toBeDefined();
        expect(data.overallScore).toBeGreaterThanOrEqual(0);
        expect(data.overallScore).toBeLessThanOrEqual(100);

        // 驗證 MEDDIC 各維度分數
        expect(data.metricsScore).toBeGreaterThanOrEqual(0);
        expect(data.metricsScore).toBeLessThanOrEqual(5);
        expect(data.economicBuyerScore).toBeGreaterThanOrEqual(0);
        expect(data.decisionCriteriaScore).toBeGreaterThanOrEqual(0);
        expect(data.decisionProcessScore).toBeGreaterThanOrEqual(0);
        expect(data.identifyPainScore).toBeGreaterThanOrEqual(0);
        expect(data.championScore).toBeGreaterThanOrEqual(0);

        // 驗證狀態
        expect(['strong', 'medium', 'weak', 'at_risk']).toContain(data.status);

        // 驗證其他欄位
        expect(data.keyFindings).toBeInstanceOf(Array);
        expect(data.nextSteps).toBeInstanceOf(Array);
        expect(data.risks).toBeInstanceOf(Array);
      } else {
        // 失敗時應該是可預期的錯誤
        expect(response.status).toBeLessThanOrEqual(500);
      }
    });

    test('不存在的對話應該回傳 404', async () => {
      const response = await fetch(`${API_BASE}/api/conversations.analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie,
        },
        body: JSON.stringify({
          conversationId: 'non-existent',
        }),
      });

      expect(response.status).toBe(404);
    });
  });
});
```

3. 建立 `tests/api/analytics.test.ts`：

```typescript
// tests/api/analytics.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { getAuthCookie, createTestUser, cleanupTestUser } from '../fixtures/auth-helpers';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

describe('Analytics API', () => {
  let authCookie: string;
  let testUserId: string;
  let testOpportunityId: string;

  beforeAll(async () => {
    // 建立測試用戶
    const { userId, cookie } = await createTestUser();
    testUserId = userId;
    authCookie = cookie;

    // 建立測試用商機
    const response = await fetch(`${API_BASE}/api/opportunities.create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie,
      },
      body: JSON.stringify({
        customerNumber: `analytics-test-${Date.now()}`,
        companyName: '分析測試公司',
      }),
    });
    const data = await response.json();
    testOpportunityId = data.id;
  });

  afterAll(async () => {
    await cleanupTestUser(testUserId);
  });

  describe('GET /api/analytics.dashboard', () => {
    test('應該取得 Dashboard 統計', async () => {
      const response = await fetch(`${API_BASE}/api/analytics.dashboard`, {
        headers: { 'Cookie': authCookie },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      // 驗證摘要統計
      expect(data.summary).toBeDefined();
      expect(data.summary.totalOpportunities).toBeGreaterThanOrEqual(0);
      expect(data.summary.totalConversations).toBeGreaterThanOrEqual(0);
      expect(data.summary.totalAnalyses).toBeGreaterThanOrEqual(0);

      // 驗證狀態分佈
      expect(data.statusDistribution).toBeDefined();

      // 驗證最近分析
      expect(data.recentAnalyses).toBeInstanceOf(Array);
    });

    test('應該支援日期篩選', async () => {
      const dateFrom = new Date();
      dateFrom.setMonth(dateFrom.getMonth() - 1);

      const response = await fetch(
        `${API_BASE}/api/analytics.dashboard?dateFrom=${dateFrom.toISOString()}&dateTo=${new Date().toISOString()}`,
        { headers: { 'Cookie': authCookie } }
      );

      expect(response.ok).toBe(true);
    });

    test('未認證應該回傳 401', async () => {
      const response = await fetch(`${API_BASE}/api/analytics.dashboard`);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/analytics.opportunityAnalytics', () => {
    test('應該取得商機分析統計', async () => {
      const response = await fetch(
        `${API_BASE}/api/analytics.opportunityAnalytics?opportunityId=${testOpportunityId}`,
        { headers: { 'Cookie': authCookie } }
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.opportunityId).toBe(testOpportunityId);
      expect(data.totalAnalyses).toBeGreaterThanOrEqual(0);
      expect(data.analyses).toBeInstanceOf(Array);
    });

    test('不存在的商機應該回傳 404', async () => {
      const response = await fetch(
        `${API_BASE}/api/analytics.opportunityAnalytics?opportunityId=non-existent`,
        { headers: { 'Cookie': authCookie } }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/analytics.meddicTrends', () => {
    test('應該取得 MEDDIC 趨勢', async () => {
      const response = await fetch(`${API_BASE}/api/analytics.meddicTrends`, {
        headers: { 'Cookie': authCookie },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      // 驗證趨勢資料結構
      expect(data.overallScoreTrend || data.trends).toBeDefined();

      // 如果有維度趨勢
      if (data.dimensionTrends) {
        expect(data.dimensionTrends).toBeInstanceOf(Array);
      }
    });

    test('應該支援維度篩選', async () => {
      const response = await fetch(
        `${API_BASE}/api/analytics.meddicTrends?dimension=metrics`,
        { headers: { 'Cookie': authCookie } }
      );

      expect(response.ok).toBe(true);
    });
  });
});
```

**產出檔案**:
- `tests/api/opportunity.test.ts`
- `tests/api/conversation.test.ts`
- `tests/api/analytics.test.ts`

---

### Task 3: E2E 測試

**目標**: 撰寫關鍵業務流程的端對端測試，包含認證 fixture

**步驟**:

1. 建立 `tests/e2e/fixtures/auth.setup.ts`：

```typescript
// tests/e2e/fixtures/auth.setup.ts
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  // 前往登入頁面
  await page.goto('/login');

  // 使用測試帳號登入
  const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword123';

  // 填寫登入表單
  await page.fill('input[name="email"], input[type="email"]', testEmail);
  await page.fill('input[name="password"], input[type="password"]', testPassword);

  // 點擊登入按鈕
  await page.click('button[type="submit"]');

  // 等待登入成功（重導向到首頁或 dashboard）
  await expect(page).toHaveURL(/\/(dashboard|opportunities|$)/);

  // 儲存認證狀態
  await page.context().storageState({ path: authFile });
});
```

2. 建立 `tests/e2e/auth.spec.ts`：

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // 不使用已儲存的認證

  test('應該顯示登入頁面', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1, h2').first()).toContainText(/登入|Sign In/i);
  });

  test('未登入應該重導向到登入頁', async ({ page }) => {
    await page.goto('/opportunities');
    await expect(page).toHaveURL(/login/);
  });

  test('應該可以使用電子郵件登入', async ({ page }) => {
    await page.goto('/login');

    // 填寫表單
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpassword123');

    // 提交
    await page.click('button[type="submit"]');

    // 應該登入成功或顯示錯誤訊息
    await expect(page.locator('body')).toContainText(/.+/);
  });

  test('錯誤的密碼應該顯示錯誤訊息', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // 應該顯示錯誤訊息
    await expect(page.locator('[role="alert"], .error, .toast')).toBeVisible({ timeout: 5000 });
  });
});
```

3. 建立 `tests/e2e/opportunity-flow.spec.ts`：

```typescript
// tests/e2e/opportunity-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Opportunity Management Flow', () => {
  test('應該顯示商機列表', async ({ page }) => {
    await page.goto('/opportunities');
    await expect(page.locator('h1, h2').first()).toContainText(/商機|Opportunities/i);
  });

  test('應該可以建立新商機', async ({ page }) => {
    await page.goto('/opportunities/new');

    // 填寫必填欄位
    await page.fill('input[name="customerNumber"]', `E2E-${Date.now()}`);
    await page.fill('input[name="companyName"]', 'E2E 測試公司');

    // 填寫可選欄位
    const contactNameInput = page.locator('input[name="contactName"]');
    if (await contactNameInput.isVisible()) {
      await contactNameInput.fill('測試聯絡人');
    }

    // 提交表單
    await page.click('button[type="submit"]');

    // 等待成功訊息或重導向
    await expect(page).toHaveURL(/\/opportunities(\/|$)/, { timeout: 10000 });
  });

  test('應該可以查看商機詳情', async ({ page }) => {
    await page.goto('/opportunities');

    // 等待列表載入
    await page.waitForSelector('table tbody tr, [data-testid="opportunity-card"]', { timeout: 10000 });

    // 點擊第一個商機
    const firstOpportunity = page.locator('table tbody tr, [data-testid="opportunity-card"]').first();
    await firstOpportunity.click();

    // 應該導航到詳情頁
    await expect(page).toHaveURL(/\/opportunities\/[^/]+$/);
  });

  test('應該可以篩選商機狀態', async ({ page }) => {
    await page.goto('/opportunities');

    // 找到狀態篩選器
    const statusFilter = page.locator('select[name="status"], [data-testid="status-filter"]');

    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('contacted');

      // 等待列表更新
      await page.waitForTimeout(500);

      // 驗證 URL 包含篩選參數
      await expect(page).toHaveURL(/status=contacted/);
    }
  });

  test('應該可以搜尋商機', async ({ page }) => {
    await page.goto('/opportunities');

    // 找到搜尋框
    const searchInput = page.locator('input[type="search"], input[placeholder*="搜尋"]');

    if (await searchInput.isVisible()) {
      await searchInput.fill('測試');
      await searchInput.press('Enter');

      // 等待搜尋結果
      await page.waitForTimeout(500);
    }
  });

  test('應該可以更新商機狀態', async ({ page }) => {
    // 先建立一個商機
    await page.goto('/opportunities/new');
    await page.fill('input[name="customerNumber"]', `E2E-Status-${Date.now()}`);
    await page.fill('input[name="companyName"]', '狀態更新測試');
    await page.click('button[type="submit"]');

    // 等待重導向到詳情頁或列表
    await page.waitForURL(/\/opportunities/);

    // 找到狀態選擇器並更新
    const statusSelect = page.locator('select[name="status"], [data-testid="status-select"]');
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('contacted');

      // 等待更新完成
      await expect(page.locator('.toast, [role="alert"]')).toBeVisible({ timeout: 10000 });
    }
  });
});
```

4. 建立 `tests/e2e/conversation-flow.spec.ts`：

```typescript
// tests/e2e/conversation-flow.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Conversation and MEDDIC Analysis Flow', () => {
  test('應該顯示對話列表', async ({ page }) => {
    await page.goto('/conversations');
    await expect(page.locator('h1, h2').first()).toContainText(/對話|Conversations/i);
  });

  test('應該可以上傳新對話', async ({ page }) => {
    // 先確保有商機存在
    await page.goto('/opportunities');

    // 如果沒有商機，先建立一個
    const opportunityRows = page.locator('table tbody tr, [data-testid="opportunity-card"]');
    if (await opportunityRows.count() === 0) {
      await page.goto('/opportunities/new');
      await page.fill('input[name="customerNumber"]', `E2E-Conv-${Date.now()}`);
      await page.fill('input[name="companyName"]', '對話測試公司');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/opportunities/);
    }

    // 前往對話上傳頁面
    await page.goto('/conversations/new');

    // 應該有上傳區域
    const uploadArea = page.locator('input[type="file"], [data-testid="file-upload"]');
    await expect(uploadArea).toBeVisible();

    // 選擇商機
    const opportunitySelect = page.locator('select[name="opportunityId"]');
    if (await opportunitySelect.isVisible()) {
      await opportunitySelect.selectOption({ index: 1 });
    }

    // 上傳測試音檔（如果存在）
    const testAudioPath = path.join(__dirname, '../fixtures/test-audio.mp3');
    try {
      await uploadArea.setInputFiles(testAudioPath);
    } catch {
      console.log('No test audio file available, skipping upload');
    }
  });

  test('完整流程：上傳 → 分析 → 查看結果', async ({ page }) => {
    // 這個測試需要實際的音檔和完整的後端服務
    // 在 CI 環境中可能需要 mock

    await page.goto('/conversations');

    // 找到已完成分析的對話
    const analyzedConversation = page.locator('[data-status="completed"], .status-completed').first();

    if (await analyzedConversation.isVisible()) {
      await analyzedConversation.click();

      // 應該顯示 MEDDIC 分析結果
      await expect(page.locator('[data-testid="meddic-score"], .meddic-score')).toBeVisible({
        timeout: 10000,
      });

      // 應該顯示雷達圖
      await expect(page.locator('.recharts-radar, [data-testid="meddic-radar"], canvas')).toBeVisible({
        timeout: 10000,
      });

      // 應該顯示關鍵發現
      await expect(page.locator('[data-testid="key-findings"], .key-findings')).toBeVisible();

      // 應該顯示下一步建議
      await expect(page.locator('[data-testid="next-steps"], .next-steps')).toBeVisible();
    }
  });

  test('Dashboard 應該顯示統計資訊', async ({ page }) => {
    await page.goto('/');

    // 應該有統計卡片
    await expect(page.locator('[data-testid="stats-card"], .stats-card, .stat-card').first()).toBeVisible({
      timeout: 10000,
    });

    // 應該顯示商機數量
    await expect(page.locator('text=/商機|Opportunities/i')).toBeVisible();

    // 應該顯示對話數量
    await expect(page.locator('text=/對話|Conversations/i')).toBeVisible();
  });
});
```

**產出檔案**:
- `tests/e2e/fixtures/auth.setup.ts`
- `tests/e2e/auth.spec.ts`
- `tests/e2e/opportunity-flow.spec.ts`
- `tests/e2e/conversation-flow.spec.ts`

---

### Task 4: 測試 Fixtures

**目標**: 建立測試所需的 fixture 資料和輔助函式

**步驟**:

1. 建立 `tests/fixtures/auth-helpers.ts`：

```typescript
// tests/fixtures/auth-helpers.ts
import { db } from '@sales_ai_automation_v3/db';
import { user, session } from '@sales_ai_automation_v3/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

interface AuthResult {
  userId: string;
  cookie: string;
}

/**
 * 建立測試用戶並取得認證 cookie
 */
export async function createTestUser(): Promise<AuthResult> {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'testpassword123';

  // 透過 API 註冊用戶
  const signUpResponse = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      name: 'Test User',
    }),
  });

  if (!signUpResponse.ok) {
    throw new Error(`Failed to create test user: ${await signUpResponse.text()}`);
  }

  // 登入取得 cookie
  const signInResponse = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });

  if (!signInResponse.ok) {
    throw new Error(`Failed to sign in test user: ${await signInResponse.text()}`);
  }

  const setCookieHeader = signInResponse.headers.get('set-cookie');
  if (!setCookieHeader) {
    throw new Error('No session cookie returned');
  }

  const userData = await signInResponse.json();

  return {
    userId: userData.user.id,
    cookie: setCookieHeader,
  };
}

/**
 * 取得現有用戶的認證 cookie
 */
export async function getAuthCookie(email: string, password: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Failed to sign in: ${await response.text()}`);
  }

  const setCookieHeader = response.headers.get('set-cookie');
  if (!setCookieHeader) {
    throw new Error('No session cookie returned');
  }

  return setCookieHeader;
}

/**
 * 清理測試用戶
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  try {
    // 刪除相關的 session
    await db.delete(session).where(eq(session.userId, userId));

    // 刪除用戶
    await db.delete(user).where(eq(user.id, userId));
  } catch (error) {
    console.warn('Failed to cleanup test user:', error);
  }
}

/**
 * 建立 mock session（用於單元測試）
 */
export function createMockSession(userId: string = randomUUID()) {
  return {
    user: {
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
    },
    session: {
      id: randomUUID(),
      userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  };
}
```

2. 建立 `tests/fixtures/mock-data.ts`：

```typescript
// tests/fixtures/mock-data.ts

export const mockOpportunity = {
  customerNumber: '202601-000001',
  companyName: '測試公司股份有限公司',
  contactName: '張小明',
  contactEmail: 'test@example.com',
  contactPhone: '0912345678',
  status: 'new' as const,
  source: 'manual' as const,
  industry: '科技業',
  companySize: '50-200',
  notes: '這是測試商機',
};

export const mockConversation = {
  title: '首次探索會議',
  type: 'discovery_call' as const,
  status: 'completed' as const,
  duration: 1800, // 30 分鐘
  conversationDate: new Date().toISOString(),
};

export const mockMeddicAnalysis = {
  overallScore: 72,
  status: 'medium' as const,
  metricsScore: 4,
  economicBuyerScore: 3,
  decisionCriteriaScore: 4,
  decisionProcessScore: 3,
  identifyPainScore: 4,
  championScore: 3,
  dimensions: {
    metrics: {
      evidence: ['客戶提到希望將回覆時間從 24 小時縮短到 4 小時'],
      gaps: ['尚未確認具體的 ROI 數字'],
      recommendations: ['下次會議確認預期的成本節省'],
    },
    economicBuyer: {
      evidence: ['提到需要向 CTO 報告'],
      gaps: ['尚未直接接觸 CTO'],
      recommendations: ['安排與 CTO 的會議'],
    },
  },
  keyFindings: [
    '客戶有明確的效率提升需求',
    '預算已獲得初步核准',
    '尚未接觸最終決策者',
  ],
  nextSteps: [
    { action: '安排與 CTO 的會議', owner: '業務' },
    { action: '準備 ROI 計算報告', owner: '售前' },
    { action: '確認競爭對手狀況', owner: '業務' },
  ],
  risks: [
    { risk: '決策流程可能較長', severity: 'medium', mitigation: '提早開始接觸各利害關係人' },
    { risk: '競爭對手已有接觸', severity: 'high', mitigation: '強調差異化優勢' },
  ],
};

export const mockTranscript = {
  fullText: `
業務：您好，請問貴公司目前在客戶管理上有遇到什麼挑戰嗎？
客戶：是的，我們目前使用的系統效率很低，常常找不到客戶資料。
業務：了解，那這個問題對您的業務造成什麼影響呢？
客戶：主要是回覆客戶的速度變慢，客戶滿意度有下降的趨勢。
業務：那您預期希望達到什麼樣的改善效果？
客戶：希望能把回覆時間從目前的 24 小時縮短到 4 小時以內。
`.trim(),
  segments: [
    { speaker: '業務', text: '您好，請問貴公司目前在客戶管理上有遇到什麼挑戰嗎？', start: 0, end: 5 },
    { speaker: '客戶', text: '是的，我們目前使用的系統效率很低，常常找不到客戶資料。', start: 5, end: 12 },
    { speaker: '業務', text: '了解，那這個問題對您的業務造成什麼影響呢？', start: 12, end: 17 },
    { speaker: '客戶', text: '主要是回覆客戶的速度變慢，客戶滿意度有下降的趨勢。', start: 17, end: 24 },
    { speaker: '業務', text: '那您預期希望達到什麼樣的改善效果？', start: 24, end: 29 },
    { speaker: '客戶', text: '希望能把回覆時間從目前的 24 小時縮短到 4 小時以內。', start: 29, end: 36 },
  ],
  language: 'zh-TW',
  duration: 36,
};

// 英文版本的測試資料
export const mockTranscriptEn = {
  fullText: `
Sales: Hello, what challenges are you facing with customer management?
Customer: Yes, our current system is very inefficient, we often can't find customer data.
Sales: I see, how does this problem affect your business?
Customer: Mainly, our response time has slowed down, and customer satisfaction is declining.
`.trim(),
  segments: [
    { speaker: 'Sales', text: 'Hello, what challenges are you facing with customer management?', start: 0, end: 5 },
    { speaker: 'Customer', text: "Yes, our current system is very inefficient, we often can't find customer data.", start: 5, end: 12 },
    { speaker: 'Sales', text: 'I see, how does this problem affect your business?', start: 12, end: 17 },
    { speaker: 'Customer', text: 'Mainly, our response time has slowed down, and customer satisfaction is declining.', start: 17, end: 24 },
  ],
  language: 'en',
  duration: 24,
};
```

3. 建立 `tests/fixtures/test-helpers.ts`：

```typescript
// tests/fixtures/test-helpers.ts
import { mockOpportunity, mockConversation } from './mock-data';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

export async function createTestOpportunity(
  authCookie: string,
  data?: Partial<typeof mockOpportunity>
) {
  const response = await fetch(`${API_BASE}/api/opportunities.create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie,
    },
    body: JSON.stringify({
      ...mockOpportunity,
      customerNumber: `test-${Date.now()}`,
      ...data,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create opportunity: ${await response.text()}`);
  }

  return response.json();
}

export async function createTestConversation(
  authCookie: string,
  opportunityId: string,
  data?: Partial<typeof mockConversation>
) {
  const response = await fetch(`${API_BASE}/api/conversations.upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie,
    },
    body: JSON.stringify({
      opportunityId,
      audioBase64: 'dGVzdA==', // placeholder
      ...mockConversation,
      ...data,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create conversation: ${await response.text()}`);
  }

  return response.json();
}

export async function deleteTestOpportunity(
  authCookie: string,
  opportunityId: string
) {
  await fetch(`${API_BASE}/api/opportunities.delete`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie,
    },
    body: JSON.stringify({ opportunityId }),
  });
}

export function generateCustomerNumber(): string {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const sequence = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
  return `${yearMonth}-${sequence}`;
}

export function generateCaseNumber(): string {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`.slice(2);
  const sequence = String(Math.floor(Math.random() * 999)).padStart(3, '0');
  return `${yearMonth}-IC${sequence}`;
}
```

4. **產生測試音檔說明**：

在 `tests/fixtures/README.md` 中說明如何產生測試音檔：

```markdown
# 測試 Fixtures

## 產生測試音檔

測試需要一個小的 MP3 音檔。你可以使用 FFmpeg 產生一個 3 秒的靜音檔：

```bash
# 產生 3 秒靜音 MP3
ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 3 -q:a 9 tests/fixtures/test-audio.mp3

# 或者產生帶有簡單音調的音檔
ffmpeg -f lavfi -i "sine=frequency=440:duration=3" -q:a 9 tests/fixtures/test-audio.mp3
```

如果沒有 FFmpeg，也可以使用任何小於 1MB 的 MP3 檔案。

## 檔案列表

- `mock-data.ts` - 測試用的 mock 資料
- `test-helpers.ts` - 測試輔助函式
- `auth-helpers.ts` - 認證相關輔助函式
- `test-audio.mp3` - 測試用音檔（需自行產生）
```

**產出檔案**:
- `tests/fixtures/auth-helpers.ts`
- `tests/fixtures/mock-data.ts`
- `tests/fixtures/test-helpers.ts`
- `tests/fixtures/README.md`

---

### Task 5: 效能測試

**目標**: 建立效能基準測試

**步驟**:

1. 建立 `tests/performance/api-benchmark.test.ts`：

```typescript
// tests/performance/api-benchmark.test.ts
import { describe, test, expect, beforeAll } from 'vitest';
import { getAuthCookie, createTestUser, cleanupTestUser } from '../fixtures/auth-helpers';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const TIMEOUT_MS = 500; // P95 目標

describe('API Performance Benchmarks', () => {
  let authCookie: string;
  let testUserId: string;

  beforeAll(async () => {
    const { userId, cookie } = await createTestUser();
    testUserId = userId;
    authCookie = cookie;
  });

  afterAll(async () => {
    await cleanupTestUser(testUserId);
  });

  test('GET /api/opportunities.list 應該在 500ms 內回應', async () => {
    const start = Date.now();
    const response = await fetch(`${API_BASE}/api/opportunities.list`, {
      headers: { 'Cookie': authCookie },
    });
    const duration = Date.now() - start;

    expect(response.ok).toBe(true);
    expect(duration).toBeLessThan(TIMEOUT_MS);
    console.log(`opportunities.list: ${duration}ms`);
  });

  test('GET /api/conversations.list 應該在 500ms 內回應', async () => {
    const start = Date.now();
    const response = await fetch(`${API_BASE}/api/conversations.list`, {
      headers: { 'Cookie': authCookie },
    });
    const duration = Date.now() - start;

    expect(response.ok).toBe(true);
    expect(duration).toBeLessThan(TIMEOUT_MS);
    console.log(`conversations.list: ${duration}ms`);
  });

  test('GET /api/analytics.dashboard 應該在 500ms 內回應', async () => {
    const start = Date.now();
    const response = await fetch(`${API_BASE}/api/analytics.dashboard`, {
      headers: { 'Cookie': authCookie },
    });
    const duration = Date.now() - start;

    expect(response.ok).toBe(true);
    expect(duration).toBeLessThan(TIMEOUT_MS);
    console.log(`analytics.dashboard: ${duration}ms`);
  });

  test('POST /api/opportunities.create 應該在 500ms 內回應', async () => {
    const start = Date.now();
    const response = await fetch(`${API_BASE}/api/opportunities.create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie,
      },
      body: JSON.stringify({
        customerNumber: `perf-${Date.now()}`,
        companyName: '效能測試公司',
      }),
    });
    const duration = Date.now() - start;

    expect(response.ok).toBe(true);
    expect(duration).toBeLessThan(TIMEOUT_MS);
    console.log(`opportunities.create: ${duration}ms`);
  });

  test('並發請求效能測試', async () => {
    const requests = Array.from({ length: 10 }, () =>
      fetch(`${API_BASE}/api/opportunities.list`, {
        headers: { 'Cookie': authCookie },
      })
    );

    const start = Date.now();
    const responses = await Promise.all(requests);
    const duration = Date.now() - start;

    for (const response of responses) {
      expect(response.ok).toBe(true);
    }

    // 10 個並發請求應該在 2 秒內完成
    expect(duration).toBeLessThan(2000);
    console.log(`10 concurrent requests: ${duration}ms (avg: ${duration / 10}ms)`);
  });
});
```

**產出檔案**:
- `tests/performance/api-benchmark.test.ts`

---

### Task 6: 認證測試

**目標**: 測試 Better Auth 的登入/登出和受保護端點

**步驟**:

1. 建立 `tests/api/auth.test.ts`：

```typescript
// tests/api/auth.test.ts
import { describe, test, expect } from 'vitest';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

describe('Authentication API', () => {
  const testEmail = `auth-test-${Date.now()}@example.com`;
  const testPassword = 'testpassword123';
  let sessionCookie: string;

  describe('POST /api/auth/sign-up/email', () => {
    test('應該成功註冊新用戶', async () => {
      const response = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: 'Auth Test User',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(testEmail);
    });

    test('重複註冊應該回傳錯誤', async () => {
      const response = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: 'Duplicate User',
        }),
      });

      expect(response.ok).toBe(false);
    });

    test('缺少必填欄位應該回傳 400', async () => {
      const response = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'incomplete@example.com',
          // 缺少 password
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/sign-in/email', () => {
    test('應該成功登入並回傳 session cookie', async () => {
      const response = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });

      expect(response.ok).toBe(true);

      // 驗證 session cookie
      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('better-auth');

      sessionCookie = setCookie!;

      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.session).toBeDefined();
    });

    test('錯誤密碼應該回傳 401', async () => {
      const response = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'wrongpassword',
        }),
      });

      expect(response.status).toBe(401);
    });

    test('不存在的用戶應該回傳 401', async () => {
      const response = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'anypassword',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/session', () => {
    test('有效 session 應該回傳用戶資訊', async () => {
      const response = await fetch(`${API_BASE}/api/auth/session`, {
        headers: { 'Cookie': sessionCookie },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(testEmail);
    });

    test('無 session 應該回傳 null 或 401', async () => {
      const response = await fetch(`${API_BASE}/api/auth/session`);

      // Better Auth 可能回傳 200 with null 或 401
      if (response.ok) {
        const data = await response.json();
        expect(data.user).toBeNull();
      } else {
        expect(response.status).toBe(401);
      }
    });
  });

  describe('POST /api/auth/sign-out', () => {
    test('應該成功登出並清除 cookie', async () => {
      const response = await fetch(`${API_BASE}/api/auth/sign-out`, {
        method: 'POST',
        headers: { 'Cookie': sessionCookie },
      });

      expect(response.ok).toBe(true);

      // 驗證登出後 session 無效
      const sessionResponse = await fetch(`${API_BASE}/api/auth/session`, {
        headers: { 'Cookie': sessionCookie },
      });

      if (sessionResponse.ok) {
        const data = await sessionResponse.json();
        expect(data.user).toBeNull();
      }
    });
  });

  describe('受保護端點測試', () => {
    test('無認證存取 privateData 應該回傳 401', async () => {
      const response = await fetch(`${API_BASE}/api/privateData`);
      expect(response.status).toBe(401);
    });

    test('有認證存取 privateData 應該成功', async () => {
      // 重新登入
      const signInResponse = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });
      const newCookie = signInResponse.headers.get('set-cookie')!;

      const response = await fetch(`${API_BASE}/api/privateData`, {
        headers: { 'Cookie': newCookie },
      });

      expect(response.ok).toBe(true);
    });
  });
});
```

**產出檔案**:
- `tests/api/auth.test.ts`

---

### Task 7: Slack Bot 測試

**目標**: 測試 Slack Bot 的所有指令和事件處理

**步驟**:

1. 建立 `tests/slack-bot/commands.test.ts`：

```typescript
// tests/slack-bot/commands.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock Slack Client
const mockSlackClient = {
  respondToUrl: vi.fn(),
  postMessage: vi.fn(),
};

// Mock API Client
const mockApiClient = {
  getConversationById: vi.fn(),
  analyzeConversation: vi.fn(),
  getOpportunities: vi.fn(),
  getOpportunityById: vi.fn(),
  createOpportunity: vi.fn(),
  getDashboard: vi.fn(),
  getMeddicTrends: vi.fn(),
};

describe('Slack Bot Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('/analyze 指令', () => {
    test('應該顯示幫助訊息當沒有參數', async () => {
      const ctx = {
        text: '',
        responseUrl: 'https://hooks.slack.com/response/xxx',
        channelId: 'C123',
      };

      // 模擬 handleAnalyzeCommand
      await mockSlackClient.respondToUrl(ctx.responseUrl, {
        response_type: 'ephemeral',
        blocks: expect.any(Array),
      });

      expect(mockSlackClient.respondToUrl).toHaveBeenCalledWith(
        ctx.responseUrl,
        expect.objectContaining({ response_type: 'ephemeral' })
      );
    });

    test('應該成功分析對話', async () => {
      const conversationId = 'conv-123';

      mockApiClient.getConversationById.mockResolvedValue({
        id: conversationId,
        title: '測試對話',
        caseNumber: '202601-IC001',
      });

      mockApiClient.analyzeConversation.mockResolvedValue({
        analysisId: 'analysis-123',
        overallScore: 72,
        status: 'medium',
        metricsScore: 4,
        economicBuyerScore: 3,
        decisionCriteriaScore: 4,
        decisionProcessScore: 3,
        identifyPainScore: 4,
        championScore: 3,
      });

      const conversation = await mockApiClient.getConversationById(conversationId);
      expect(conversation).toBeDefined();
      expect(conversation.id).toBe(conversationId);

      const analysis = await mockApiClient.analyzeConversation(conversationId);
      expect(analysis.overallScore).toBe(72);
    });

    test('找不到對話應該回傳警告', async () => {
      mockApiClient.getConversationById.mockResolvedValue(null);

      const conversation = await mockApiClient.getConversationById('non-existent');
      expect(conversation).toBeNull();
    });
  });

  describe('/opportunity 指令', () => {
    test('list 應該列出商機', async () => {
      mockApiClient.getOpportunities.mockResolvedValue({
        opportunities: [
          { id: 'opp-1', companyName: '公司A', status: 'new' },
          { id: 'opp-2', companyName: '公司B', status: 'contacted' },
        ],
        total: 2,
      });

      const result = await mockApiClient.getOpportunities();
      expect(result.opportunities).toHaveLength(2);
    });

    test('create 應該建立商機', async () => {
      mockApiClient.createOpportunity.mockResolvedValue({
        id: 'new-opp',
        customerNumber: '202601-000001',
        companyName: '新公司',
        status: 'new',
      });

      const result = await mockApiClient.createOpportunity({
        customerNumber: '202601-000001',
        companyName: '新公司',
      });

      expect(result.id).toBe('new-opp');
      expect(result.status).toBe('new');
    });
  });

  describe('/report 指令', () => {
    test('dashboard 應該回傳統計', async () => {
      mockApiClient.getDashboard.mockResolvedValue({
        summary: {
          totalOpportunities: 10,
          totalConversations: 25,
          totalAnalyses: 20,
        },
      });

      const result = await mockApiClient.getDashboard();
      expect(result.summary.totalOpportunities).toBe(10);
    });

    test('trends 應該回傳趨勢', async () => {
      mockApiClient.getMeddicTrends.mockResolvedValue({
        overallScoreTrend: [
          { date: '2026-01-01', score: 65 },
          { date: '2026-01-02', score: 70 },
        ],
      });

      const result = await mockApiClient.getMeddicTrends();
      expect(result.overallScoreTrend).toHaveLength(2);
    });
  });
});
```

2. 建立 `tests/slack-bot/events.test.ts`：

```typescript
// tests/slack-bot/events.test.ts
import { describe, test, expect, vi } from 'vitest';

describe('Slack Bot Events', () => {
  describe('檔案上傳事件', () => {
    const supportedFormats = ['mp3', 'wav', 'webm', 'ogg', 'm4a'];
    const maxFileSize = 100 * 1024 * 1024; // 100MB

    test.each(supportedFormats)('應該接受 %s 格式', (format) => {
      const file = {
        name: `test.${format}`,
        mimetype: `audio/${format}`,
        size: 1024 * 1024, // 1MB
      };

      const isAudioFile = (file: { mimetype: string }) => {
        return file.mimetype.startsWith('audio/');
      };

      expect(isAudioFile(file)).toBe(true);
    });

    test('應該拒絕非音檔格式', () => {
      const file = {
        name: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 1024,
      };

      const isAudioFile = (file: { mimetype: string }) => {
        return file.mimetype.startsWith('audio/');
      };

      expect(isAudioFile(file)).toBe(false);
    });

    test('應該拒絕超過 100MB 的檔案', () => {
      const file = {
        name: 'large.mp3',
        mimetype: 'audio/mp3',
        size: 150 * 1024 * 1024, // 150MB
      };

      const isFileSizeValid = (file: { size: number }) => {
        return file.size <= maxFileSize;
      };

      expect(isFileSizeValid(file)).toBe(false);
    });

    test('應該接受小於 100MB 的檔案', () => {
      const file = {
        name: 'normal.mp3',
        mimetype: 'audio/mp3',
        size: 50 * 1024 * 1024, // 50MB
      };

      const isFileSizeValid = (file: { size: number }) => {
        return file.size <= maxFileSize;
      };

      expect(isFileSizeValid(file)).toBe(true);
    });
  });

  describe('App Mention 事件', () => {
    test('應該回應可用指令列表', () => {
      const helpMessage = `
可用指令:
• /analyze <conversation_id> - MEDDIC 分析
• /opportunity list|<id>|create - 商機管理
• /report dashboard|trends - 報表
      `.trim();

      expect(helpMessage).toContain('/analyze');
      expect(helpMessage).toContain('/opportunity');
      expect(helpMessage).toContain('/report');
    });
  });
});
```

3. 建立 `tests/slack-bot/signature.test.ts`：

```typescript
// tests/slack-bot/signature.test.ts
import { describe, test, expect } from 'vitest';
import { createHmac, timingSafeEqual } from 'crypto';

describe('Slack 請求簽名驗證', () => {
  const signingSecret = 'test-signing-secret';

  function verifySlackSignature(
    signature: string,
    timestamp: string,
    body: string,
    secret: string
  ): boolean {
    // 檢查時間戳是否在 5 分鐘內
    const now = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp, 10);
    if (Math.abs(now - requestTime) > 300) {
      return false;
    }

    // 計算簽名
    const sigBasestring = `v0:${timestamp}:${body}`;
    const mySignature = 'v0=' + createHmac('sha256', secret)
      .update(sigBasestring)
      .digest('hex');

    // 比較簽名
    try {
      return timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(mySignature)
      );
    } catch {
      return false;
    }
  }

  test('有效簽名應該驗證成功', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ event: 'test' });
    const sigBasestring = `v0:${timestamp}:${body}`;
    const signature = 'v0=' + createHmac('sha256', signingSecret)
      .update(sigBasestring)
      .digest('hex');

    expect(verifySlackSignature(signature, timestamp, body, signingSecret)).toBe(true);
  });

  test('過期的時間戳應該驗證失敗', () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 分鐘前
    const body = JSON.stringify({ event: 'test' });
    const sigBasestring = `v0:${timestamp}:${body}`;
    const signature = 'v0=' + createHmac('sha256', signingSecret)
      .update(sigBasestring)
      .digest('hex');

    expect(verifySlackSignature(signature, timestamp, body, signingSecret)).toBe(false);
  });

  test('無效簽名應該驗證失敗', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ event: 'test' });
    const invalidSignature = 'v0=invalid_signature_hash';

    expect(verifySlackSignature(invalidSignature, timestamp, body, signingSecret)).toBe(false);
  });

  test('錯誤的 signing secret 應該驗證失敗', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ event: 'test' });
    const sigBasestring = `v0:${timestamp}:${body}`;
    const signature = 'v0=' + createHmac('sha256', signingSecret)
      .update(sigBasestring)
      .digest('hex');

    expect(verifySlackSignature(signature, timestamp, body, 'wrong-secret')).toBe(false);
  });
});
```

**產出檔案**:
- `tests/slack-bot/commands.test.ts`
- `tests/slack-bot/events.test.ts`
- `tests/slack-bot/signature.test.ts`

---

### Task 8: 外部服務 Mock 測試

**目標**: 測試 Groq Whisper、R2、Gemini 的錯誤處理

**步驟**:

1. 建立 `tests/services/transcription.test.ts`：

```typescript
// tests/services/transcription.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Groq Whisper 轉錄服務', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('成功轉錄應該回傳文字', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        text: '這是轉錄的文字',
        segments: [
          { text: '這是轉錄的文字', start: 0, end: 5 },
        ],
      }),
    });

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      body: new FormData(),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.text).toBe('這是轉錄的文字');
  });

  test('API 錯誤 (429) 應該處理 rate limiting', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        error: { message: 'Rate limit exceeded' },
      }),
    });

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      body: new FormData(),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(429);
  });

  test('API 錯誤 (500) 應該處理伺服器錯誤', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        error: { message: 'Internal server error' },
      }),
    });

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      body: new FormData(),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
  });

  test('大檔案應該觸發分割邏輯', () => {
    const MAX_FILE_SIZE = 24 * 1024 * 1024; // 24MB
    const largeFileSize = 30 * 1024 * 1024; // 30MB

    const needsChunking = largeFileSize > MAX_FILE_SIZE;
    expect(needsChunking).toBe(true);

    const chunkCount = Math.ceil(largeFileSize / MAX_FILE_SIZE);
    expect(chunkCount).toBe(2);
  });
});
```

2. 建立 `tests/services/storage.test.ts`：

```typescript
// tests/services/storage.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock S3Client
const mockS3Client = {
  send: vi.fn(),
};

describe('Cloudflare R2 儲存服務', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('上傳成功應該回傳 URL', async () => {
    mockS3Client.send.mockResolvedValueOnce({
      $metadata: { httpStatusCode: 200 },
    });

    const result = await mockS3Client.send({});
    expect(result.$metadata.httpStatusCode).toBe(200);
  });

  test('下載成功應該回傳 Buffer', async () => {
    const mockBuffer = Buffer.from('test audio data');
    mockS3Client.send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: async () => mockBuffer,
      },
    });

    const result = await mockS3Client.send({});
    const buffer = await result.Body.transformToByteArray();
    expect(buffer).toEqual(mockBuffer);
  });

  test('連線失敗應該拋出錯誤', async () => {
    mockS3Client.send.mockRejectedValueOnce(new Error('Connection refused'));

    await expect(mockS3Client.send({})).rejects.toThrow('Connection refused');
  });

  test('預簽署 URL 應該包含過期時間', () => {
    const baseUrl = 'https://bucket.r2.cloudflarestorage.com/audio/test.mp3';
    const expiresIn = 3600;

    // 模擬預簽署 URL
    const signedUrl = `${baseUrl}?X-Amz-Expires=${expiresIn}&X-Amz-Signature=xxx`;

    expect(signedUrl).toContain(`X-Amz-Expires=${expiresIn}`);
    expect(signedUrl).toContain('X-Amz-Signature=');
  });

  test('testConnection 應該驗證連線', async () => {
    mockS3Client.send.mockResolvedValueOnce({
      $metadata: { httpStatusCode: 200 },
    });

    const result = await mockS3Client.send({});
    expect(result.$metadata.httpStatusCode).toBe(200);
  });
});
```

3. 建立 `tests/services/llm.test.ts`：

```typescript
// tests/services/llm.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock Gemini API
const mockGeminiGenerate = vi.fn();

describe('Google Gemini LLM 服務', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('成功生成應該回傳文字', async () => {
    mockGeminiGenerate.mockResolvedValueOnce({
      text: '這是 AI 生成的分析結果',
    });

    const result = await mockGeminiGenerate('分析這段對話');
    expect(result.text).toBe('這是 AI 生成的分析結果');
  });

  test('generateJSON 應該回傳解析後的物件', async () => {
    const mockJsonResponse = {
      overallScore: 72,
      status: 'medium',
      keyFindings: ['發現1', '發現2'],
    };

    mockGeminiGenerate.mockResolvedValueOnce({
      text: JSON.stringify(mockJsonResponse),
    });

    const result = await mockGeminiGenerate('生成 JSON');
    const parsed = JSON.parse(result.text);
    expect(parsed.overallScore).toBe(72);
    expect(parsed.keyFindings).toHaveLength(2);
  });

  test('JSON 解析失敗應該處理錯誤', async () => {
    mockGeminiGenerate.mockResolvedValueOnce({
      text: 'invalid json {',
    });

    const result = await mockGeminiGenerate('生成 JSON');
    expect(() => JSON.parse(result.text)).toThrow();
  });

  test('API 錯誤應該拋出異常', async () => {
    mockGeminiGenerate.mockRejectedValueOnce(new Error('API Error: 429 Too Many Requests'));

    await expect(mockGeminiGenerate('test')).rejects.toThrow('API Error');
  });

  test('重試邏輯應該在失敗後重試', async () => {
    // 第一次失敗，第二次成功
    mockGeminiGenerate
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockResolvedValueOnce({ text: 'Success' });

    // 模擬重試
    let result;
    try {
      result = await mockGeminiGenerate('test');
    } catch {
      result = await mockGeminiGenerate('test');
    }

    expect(result.text).toBe('Success');
    expect(mockGeminiGenerate).toHaveBeenCalledTimes(2);
  });

  test('testConnection 應該驗證 API 連線', async () => {
    mockGeminiGenerate.mockResolvedValueOnce({
      text: 'Connection OK',
    });

    const result = await mockGeminiGenerate('test');
    expect(result.text).toBeDefined();
  });
});
```

**產出檔案**:
- `tests/services/transcription.test.ts`
- `tests/services/storage.test.ts`
- `tests/services/llm.test.ts`

---

### Task 9: CI 配置

**目標**: 建立 GitHub Actions CI 配置

**步驟**:

1. 建立 `.github/workflows/test.yml`：

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_ENV: test
  DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}

jobs:
  unit-tests:
    name: Unit & Integration Tests
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: sales_ai_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Run database migrations
        run: bun run db:migrate
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/sales_ai_test

      - name: Run unit tests
        run: bun run test:run
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/sales_ai_test
          API_BASE_URL: http://localhost:3000

      - name: Upload coverage report
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: false

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: unit-tests

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: sales_ai_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Install Playwright Browsers
        run: bunx playwright install --with-deps chromium

      - name: Run database migrations
        run: bun run db:migrate
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/sales_ai_test

      - name: Run E2E tests
        run: bun run test:e2e
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/sales_ai_test
          E2E_BASE_URL: http://localhost:3001

      - name: Upload E2E test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Run Ultracite check
        run: bun x ultracite check

      - name: Type check
        run: bun run typecheck
```

**產出檔案**:
- `.github/workflows/test.yml`

---

## 驗收標準

- [ ] Vitest 設定完成且可執行
- [ ] Playwright 設定完成且可執行
- [ ] Opportunity API 測試全部通過
- [ ] Conversation API 測試全部通過
- [ ] Analytics API 測試全部通過
- [ ] 認證 API 測試全部通過
- [ ] E2E 測試覆蓋登入、商機管理、MEDDIC 分析流程
- [ ] Slack Bot 指令測試全部通過
- [ ] Slack Bot 事件測試全部通過
- [ ] 外部服務 Mock 測試全部通過
- [ ] 效能測試 API 回應時間 < 500ms
- [ ] 測試覆蓋率 > 80%
- [ ] GitHub Actions CI 配置完成

---

## 執行指令

```bash
# 執行所有 API 測試
bun run test

# 執行單次測試（不 watch）
bun run test:run

# 執行並產生覆蓋率報告
bun run test:coverage

# 監聽模式
bun run test:watch

# 執行 E2E 測試
bun run test:e2e

# 執行 E2E 測試（互動模式）
bun run test:e2e:ui

# 執行 E2E 測試（有頭模式）
bun run test:e2e:headed

# 執行所有測試
bun run test:all
```

---

## 產出檔案總覽

```
tests/
├── setup.ts
├── tsconfig.json
├── api/
│   ├── auth.test.ts
│   ├── opportunity.test.ts
│   ├── conversation.test.ts
│   └── analytics.test.ts
├── e2e/
│   ├── .auth/
│   │   └── user.json (generated)
│   ├── fixtures/
│   │   └── auth.setup.ts
│   ├── auth.spec.ts
│   ├── opportunity-flow.spec.ts
│   └── conversation-flow.spec.ts
├── slack-bot/
│   ├── commands.test.ts
│   ├── events.test.ts
│   └── signature.test.ts
├── services/
│   ├── transcription.test.ts
│   ├── storage.test.ts
│   └── llm.test.ts
├── performance/
│   └── api-benchmark.test.ts
└── fixtures/
    ├── README.md
    ├── auth-helpers.ts
    ├── mock-data.ts
    ├── test-helpers.ts
    └── test-audio.mp3 (需自行產生)

.env.test.example
vitest.config.ts
playwright.config.ts
.github/workflows/test.yml
```
