# Workflow Instruction: Phase 5 Agent 4 - Lead Source + UTM 追蹤

> **任務類型**: 模組開發
> **預估時間**: 2 工作日
> **依賴條件**: Phase 4 完成
> **可並行**: 與 Agent 5, 6, 7 同時開發

---

## 任務目標

建立潛客來源追蹤系統，整合 Squarespace 表單、UTM 參數解析，實現完整的來源歸因分析。

---

## 🔑 需要人工完成的前置作業

### 1. Squarespace Webhook 設定 `👤 人工`

**步驟**:
1. 登入 Squarespace 網站管理後台
2. 設定 → 進階 → 開發人員 API
3. 建立 Webhook，指向：`https://api.your-domain.com/api/webhooks/squarespace`
4. 選擇事件類型：`Form Submission`
5. 記錄 Webhook Secret（用於簽名驗證）

**環境變數**:
```bash
SQUARESPACE_WEBHOOK_SECRET=your-webhook-secret
```

### 2. 表單欄位對應 `👤 人工`

確認 Squarespace 表單包含以下欄位（或對應的欄位名稱）：

| 欄位用途 | 建議欄位名稱 | 是否必填 |
|----------|-------------|----------|
| 公司名稱 | company | ✅ 必填 |
| 電子郵件 | email | ✅ 必填 |
| 聯絡人姓名 | name | 選填 |
| 電話 | phone | 選填 |
| 備註 | message | 選填 |

**UTM 隱藏欄位**（建議加入表單）:
- `utm_source`
- `utm_medium`
- `utm_campaign`

---

## 前置條件檢查

- [ ] `👤` Squarespace Webhook 已設定
- [ ] `👤` Webhook Secret 已取得
- [ ] `👤` 表單欄位已確認
- [ ] `🤖` Phase 4 部署完成
- [ ] `🤖` API 服務正常運行

---

## 任務清單

### Task 1: 擴展 Opportunity Schema（UTM 欄位）

**目標**: 為 Opportunity 表添加 UTM 追蹤欄位

**檔案**: `packages/db/src/schema/opportunity.ts`

**新增欄位**:
```typescript
// 來源追蹤
source: text('source').default('manual'),
sourceId: text('source_id'),

// UTM 參數
utmSource: text('utm_source'),
utmMedium: text('utm_medium'),
utmCampaign: text('utm_campaign'),
utmTerm: text('utm_term'),
utmContent: text('utm_content'),

// 歸因數據
landingPage: text('landing_page'),
referrer: text('referrer'),
firstTouchAt: timestamp('first_touch_at'),
rawFormData: jsonb('raw_form_data'),
```

**執行**:
```bash
cd packages/db
bun run db:generate
bun run db:push
```

**驗證**:
- [ ] Migration 成功
- [ ] 新欄位存在於資料庫

---

### Task 2: Lead Source Schema

**目標**: 建立來源管理表

**檔案**: `packages/db/src/schema/lead-source.ts`

**表結構**:

| 表名 | 用途 |
|------|------|
| `lead_sources` | 潛客來源定義（Squarespace, Manual 等） |
| `utm_campaigns` | UTM 活動追蹤與統計 |

**驗證**:
- [ ] 表已建立
- [ ] TypeScript 類型正確匯出

---

### Task 3: Squarespace Webhook 服務

**目標**: 處理 Squarespace 表單提交

**檔案結構**:
```
packages/services/src/lead-source/
├── index.ts
├── types.ts
└── squarespace/
    ├── types.ts      # Squarespace payload 類型
    ├── mapper.ts     # 欄位解析與映射
    └── webhook.ts    # Webhook 處理邏輯
```

**核心邏輯**:
1. 驗證 Webhook 簽名
2. 解析表單欄位
3. 提取 UTM 參數
4. 建立 Opportunity
5. 更新來源統計

**驗證**:
- [ ] Webhook 簽名驗證正確
- [ ] 表單解析正確
- [ ] Opportunity 建立成功

---

### Task 4: UTM 追蹤服務

**目標**: UTM 參數解析與來源歸因

**檔案結構**:
```
packages/services/src/lead-source/
└── utm/
    ├── parser.ts     # UTM 參數解析
    └── tracker.ts    # Campaign 追蹤與統計
```

**功能**:
- `parseUTMFromUrl()` - 從 URL 解析 UTM
- `parseUTMFromObject()` - 從物件解析 UTM
- `trackUTMCampaign()` - 追蹤 campaign 統計
- `getSourceAttribution()` - 來源歸因分析

**驗證**:
- [ ] UTM 解析正確
- [ ] Campaign 統計更新

---

### Task 5: API 路由

**目標**: 建立 Lead Source API

**檔案**: `packages/api/src/routers/lead-source.ts`

**端點**:

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/webhooks/squarespace` | 接收表單 |
| GET | `/api/lead-sources` | 來源列表 |
| GET | `/api/lead-sources/stats` | 來源統計 |
| GET | `/api/lead-sources/utm/:campaign` | UTM 詳情 |
| POST | `/api/lead-sources` | 新增來源 |

**驗證**:
- [ ] Webhook 接收正確
- [ ] 統計 API 正常

---

### Task 6: 前端元件

**目標**: 來源顯示與分析 UI

**檔案結構**:
```
apps/web/src/components/lead-source/
├── source-badge.tsx        # 來源標籤
├── utm-details.tsx         # UTM 詳情卡片
└── source-analytics.tsx    # 來源分析圖表
```

**驗證**:
- [ ] Badge 顯示正確
- [ ] 圖表渲染正常

---

## 驗收標準

- [ ] Squarespace 表單提交 → 自動建立 Opportunity
- [ ] UTM 參數正確解析並儲存
- [ ] 來源統計報表正確顯示
- [ ] Webhook 簽名驗證正確
- [ ] 重複提交處理正確
- [ ] 測試覆蓋率 > 80%

---

## 產出檔案清單

```
packages/db/src/schema/
├── opportunity.ts          # 擴展 UTM 欄位
└── lead-source.ts          # 新增

packages/services/src/lead-source/
├── index.ts
├── types.ts
├── squarespace/
│   ├── types.ts
│   ├── mapper.ts
│   └── webhook.ts
└── utm/
    ├── parser.ts
    └── tracker.ts

packages/api/src/routers/
└── lead-source.ts

apps/web/src/components/lead-source/
├── source-badge.tsx
├── utm-details.tsx
└── source-analytics.tsx

tests/services/
└── lead-source.test.ts
```

---

## 與其他 Agent 的整合點

| 整合對象 | 整合方式 |
|----------|----------|
| Agent 5 (MQL) | 新 Lead 建立後觸發 MQL 評分 |
| Agent 6 (Onboarding) | Won 狀態觸發 Onboarding |
| Agent 7 (Workflow) | 可作為 Workflow 觸發來源 |

---

## 下一步

完成後：
1. 設定 Squarespace Webhook URL
2. 測試完整表單提交流程
3. 通知 Agent 5 可整合 MQL 評分
