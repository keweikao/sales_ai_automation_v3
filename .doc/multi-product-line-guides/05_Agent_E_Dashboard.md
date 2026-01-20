# Agent E: Dashboard 與話術資料開發指南

> **角色**: Agent E 開發者
> **任務**: Dashboard 產品線過濾 + 美業話術資料
> **預估時間**: 6-8 小時
> **依賴**: Agent A (必須), Agent D (建議)

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
- ✅ ProductLineConfig interface
- ✅ getProductConfig() function
- ✅ Database schema 有 product_line 欄位

### 依賴 Agent D (建議,非必須)

**如果 Agent D 已完成**:
- ✅ API 已支援 `productLine` 過濾
- ✅ 可直接調用 `listOpportunities({ productLine: 'beauty' })`

**如果 Agent D 尚未完成**:
- ⚠️ 可先開發 UI 邏輯
- ⚠️ 暫時使用 client-side 過濾 (效率較低)

### 環境檢查

```bash
# 1. 確認 Dashboard 專案存在
ls -la apps/dashboard/

# 2. 確認話術資料目錄
ls -la packages/db/src/seed/

# 3. 如果沒有 seed 目錄,建立它
mkdir -p packages/db/src/seed/
```

---

## 開發任務拆解

### 階段 1: Dashboard UI - 產品線選擇器 (2-3h)

#### 1.1 建立 ProductLineSelector 元件

**檔案**: `apps/dashboard/src/components/ProductLineSelector.tsx`

```typescript
import { useState } from 'react';
import type { ProductLine } from '@Sales_ai_automation_v3/db';
import { getProductConfig, getAllProductLines } from '@Sales_ai_automation_v3/config';

interface ProductLineSelectorProps {
  value: ProductLine | 'all';
  onChange: (productLine: ProductLine | 'all') => void;
}

export function ProductLineSelector({ value, onChange }: ProductLineSelectorProps) {
  const productLines = getAllProductLines();

  return (
    <div className="flex gap-2">
      <button
        className={`px-4 py-2 rounded ${value === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        onClick={() => onChange('all')}
      >
        全部產品線
      </button>

      {productLines.map((line) => {
        const config = getProductConfig(line);
        return (
          <button
            key={line}
            className={`px-4 py-2 rounded ${value === line ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => onChange(line)}
          >
            {config.displayName}
          </button>
        );
      })}
    </div>
  );
}
```

#### 1.2 整合到 Dashboard 頁面

**檔案**: `apps/dashboard/src/pages/opportunities.tsx` (或類似的檔案)

```typescript
import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { ProductLineSelector } from '../components/ProductLineSelector';
import type { ProductLine } from '@Sales_ai_automation_v3/db';

export default function OpportunitiesPage() {
  const [selectedProductLine, setSelectedProductLine] = useState<ProductLine | 'all'>('all');

  // 使用 TRPC 查詢 (如果 Agent D 已完成)
  const { data: opportunities, isLoading } = trpc.opportunity.listOpportunities.useQuery({
    productLine: selectedProductLine === 'all' ? undefined : selectedProductLine,
  });

  // 如果 Agent D 尚未完成,使用 client-side 過濾
  // const allOpportunities = trpc.opportunity.listOpportunities.useQuery({});
  // const opportunities = selectedProductLine === 'all'
  //   ? allOpportunities.data
  //   : allOpportunities.data?.filter(o => o.productLine === selectedProductLine);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">商機管理</h1>

      {/* 產品線選擇器 */}
      <div className="mb-6">
        <ProductLineSelector
          value={selectedProductLine}
          onChange={setSelectedProductLine}
        />
      </div>

      {/* 商機列表 */}
      {isLoading ? (
        <div>載入中...</div>
      ) : (
        <div className="grid gap-4">
          {opportunities?.map((opp) => (
            <div key={opp.id} className="border p-4 rounded">
              <div className="flex justify-between">
                <div>
                  <h3 className="font-bold">{opp.companyName}</h3>
                  <p className="text-gray-600">{opp.contactName}</p>
                </div>
                <div>
                  <span className={`px-2 py-1 rounded text-sm ${
                    opp.productLine === 'ichef' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {opp.productLine === 'ichef' ? 'iCHEF' : '美業'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### 1.3 新增產品線標籤顯示

**建立可重用的 Badge 元件**:

**檔案**: `apps/dashboard/src/components/ProductLineBadge.tsx`

```typescript
import type { ProductLine } from '@Sales_ai_automation_v3/db';
import { getProductConfig } from '@Sales_ai_automation_v3/config';

interface ProductLineBadgeProps {
  productLine: ProductLine;
}

export function ProductLineBadge({ productLine }: ProductLineBadgeProps) {
  const config = getProductConfig(productLine);

  const colors = {
    ichef: 'bg-blue-100 text-blue-800 border-blue-300',
    beauty: 'bg-purple-100 text-purple-800 border-purple-300',
  };

  return (
    <span className={`px-2 py-1 rounded border text-sm font-medium ${colors[productLine]}`}>
      {config.displayName}
    </span>
  );
}
```

**使用範例**:
```typescript
import { ProductLineBadge } from '../components/ProductLineBadge';

// 在 Opportunity 卡片中
<ProductLineBadge productLine={opp.productLine} />
```

---

### 階段 2: 話術系統產品線過濾 (1-2h)

#### 2.1 更新話術查詢 API

**檔案**: `packages/api/src/routers/talk-track.ts` (假設存在)

找到 `listTalkTracks` query:

**修改前**:
```typescript
listTalkTracks: publicProcedure
  .input(z.object({
    stage: z.enum(['metrics', 'decision-process', 'economic-buyer']).optional(),
  }))
  .query(async ({ ctx, input }) => {
    const query = ctx.db
      .select()
      .from(talkTracks)
      .where(input.stage ? eq(talkTracks.stage, input.stage) : undefined);

    return await query;
  });
```

**修改後**:
```typescript
listTalkTracks: publicProcedure
  .input(z.object({
    stage: z.enum(['metrics', 'decision-process', 'economic-buyer']).optional(),
    productLine: z.enum(['ichef', 'beauty']).optional(), // 新增
  }))
  .query(async ({ ctx, input }) => {
    const { stage, productLine } = input;

    const conditions = [];
    if (stage) conditions.push(eq(talkTracks.stage, stage));
    if (productLine) conditions.push(eq(talkTracks.productLine, productLine));

    const query = ctx.db
      .select()
      .from(talkTracks)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return await query;
  });
```

#### 2.2 更新 Dashboard 話術頁面

**檔案**: `apps/dashboard/src/pages/talk-tracks.tsx`

```typescript
import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { ProductLineSelector } from '../components/ProductLineSelector';
import type { ProductLine } from '@Sales_ai_automation_v3/db';

export default function TalkTracksPage() {
  const [selectedProductLine, setSelectedProductLine] = useState<ProductLine | 'all'>('all');
  const [selectedStage, setSelectedStage] = useState<string | 'all'>('all');

  const { data: talkTracks } = trpc.talkTrack.listTalkTracks.useQuery({
    productLine: selectedProductLine === 'all' ? undefined : selectedProductLine,
    stage: selectedStage === 'all' ? undefined : selectedStage as any,
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">銷售話術庫</h1>

      {/* 過濾器 */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">產品線</label>
          <ProductLineSelector
            value={selectedProductLine}
            onChange={setSelectedProductLine}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">階段</label>
          <select
            className="border rounded px-3 py-2"
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
          >
            <option value="all">全部階段</option>
            <option value="metrics">Metrics</option>
            <option value="decision-process">Decision Process</option>
            <option value="economic-buyer">Economic Buyer</option>
            <option value="decision-criteria">Decision Criteria</option>
            <option value="identify-pain">Identify Pain</option>
            <option value="champion">Champion</option>
          </select>
        </div>
      </div>

      {/* 話術列表 */}
      <div className="grid gap-4">
        {talkTracks?.map((track) => (
          <div key={track.id} className="border p-4 rounded">
            <div className="flex justify-between mb-2">
              <h3 className="font-bold">{track.title}</h3>
              <ProductLineBadge productLine={track.productLine} />
            </div>
            <p className="text-gray-600 mb-2">{track.content}</p>
            <div className="text-sm text-gray-500">
              階段: {track.stage}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 階段 3: 美業話術資料 Seed (3-4h)

#### 3.1 建立話術資料結構

**檔案**: `packages/db/src/seed/talk-tracks-beauty.ts`

```typescript
import type { ProductLine } from '../schema';

export interface TalkTrackSeed {
  productLine: ProductLine;
  stage: string;
  title: string;
  content: string;
  tips?: string;
}

export const beautyTalkTracks: TalkTrackSeed[] = [
  // Metrics 階段
  {
    productLine: 'beauty',
    stage: 'metrics',
    title: '客戶留存率探詢',
    content: '請問目前店裡的客戶回購率大約是多少？平均多久會再次光顧？',
    tips: '美業的客戶留存率是關鍵指標,正常應在 60-70% 以上'
  },
  {
    productLine: 'beauty',
    stage: 'metrics',
    title: '預約填滿率了解',
    content: '目前的預約系統使用起來方便嗎？平均一天的預約填滿率大概多少？',
    tips: '了解預約管理痛點,為系統推薦鋪路'
  },
  {
    productLine: 'beauty',
    stage: 'metrics',
    title: '設計師產能分析',
    content: '店裡有幾位設計師？每位設計師平均一天服務幾位客人？',
    tips: '計算人均產能,找出效率提升空間'
  },
  {
    productLine: 'beauty',
    stage: 'metrics',
    title: '客戶資料管理現況',
    content: '目前客戶資料是怎麼記錄的？用紙本、Excel 還是有其他系統？',
    tips: '很多美業還在用紙本或 Excel,這是痛點'
  },

  // Decision Process 階段
  {
    productLine: 'beauty',
    stage: 'decision-process',
    title: '決策者識別',
    content: '如果要導入新的系統,需要跟誰討論比較合適？老闆還是店長？',
    tips: '美業通常是老闆或合夥人決策'
  },
  {
    productLine: 'beauty',
    stage: 'decision-process',
    title: '決策時機探詢',
    content: '有考慮過導入客戶管理系統嗎？大概什麼時候會開始評估？',
    tips: '了解購買時程,新店籌備或客戶流失時是最佳時機'
  },
  {
    productLine: 'beauty',
    stage: 'decision-process',
    title: '競品了解',
    content: '之前有看過或試用過其他的預約管理系統嗎？覺得如何？',
    tips: '了解競品使用經驗,找出差異化優勢'
  },

  // Economic Buyer 階段
  {
    productLine: 'beauty',
    stage: 'economic-buyer',
    title: '預算權限確認',
    content: '如果覺得系統合適,預算方面需要跟其他人討論嗎？',
    tips: '確認是否為最終決策者'
  },
  {
    productLine: 'beauty',
    stage: 'economic-buyer',
    title: 'ROI 期待了解',
    content: '導入系統的話,最希望在哪方面看到改善？節省時間、增加業績還是提升客戶滿意度？',
    tips: '了解 ROI 期待,調整提案重點'
  },
  {
    productLine: 'beauty',
    stage: 'economic-buyer',
    title: '投資考量因素',
    content: '在評估系統時,價格、功能、易用性,您最重視哪一個？',
    tips: '了解決策權重,調整提案策略'
  },

  // Decision Criteria 階段
  {
    productLine: 'beauty',
    stage: 'decision-criteria',
    title: '核心需求探詢',
    content: '目前在客戶管理或預約管理上,最大的困擾是什麼？',
    tips: '找出核心痛點,對症下藥'
  },
  {
    productLine: 'beauty',
    stage: 'decision-criteria',
    title: '必要功能確認',
    content: '如果要導入系統,哪些功能是一定要有的？線上預約、客戶資料、行銷推廣？',
    tips: '確認 Must-have 功能,避免提案方向錯誤'
  },
  {
    productLine: 'beauty',
    stage: 'decision-criteria',
    title: '整合需求了解',
    content: '目前有在用 LINE、Facebook 或 Instagram 嗎？希望系統能整合這些嗎？',
    tips: '美業很重視社群整合,這是加分項'
  },

  // Identify Pain 階段
  {
    productLine: 'beauty',
    stage: 'identify-pain',
    title: '預約衝突痛點',
    content: '有沒有發生過預約衝突或漏接預約的情況？',
    tips: '預約管理是美業最大痛點之一'
  },
  {
    productLine: 'beauty',
    stage: 'identify-pain',
    title: '客戶流失問題',
    content: '有沒有客戶來過一次就沒再回來？知道原因嗎？',
    tips: '客戶流失是美業的隱藏成本'
  },
  {
    productLine: 'beauty',
    stage: 'identify-pain',
    title: '行銷效率低落',
    content: '目前怎麼聯繫舊客戶？一個一個傳訊息嗎？',
    tips: '手動行銷耗時,自動化是解方'
  },
  {
    productLine: 'beauty',
    stage: 'identify-pain',
    title: '設計師離職風險',
    content: '設計師離職的話,客戶資料會不會跟著流失？',
    tips: '客戶資料留在設計師手機是常見痛點'
  },

  // Champion 階段
  {
    productLine: 'beauty',
    stage: 'champion',
    title: '內部推廣意願',
    content: '如果系統不錯,您會願意推薦給設計師使用嗎？',
    tips: '識別潛在 Champion'
  },
  {
    productLine: 'beauty',
    stage: 'champion',
    title: '成功案例分享',
    content: '我們有其他沙龍使用後,客戶回購率提升 20%,您有興趣了解嗎？',
    tips: '用案例建立信任,培養 Champion'
  },
  {
    productLine: 'beauty',
    stage: 'champion',
    title: '試用意願確認',
    content: '我們可以先安排一個簡短的 Demo,看看系統是否符合您的需求,方便嗎？',
    tips: '邀約 Demo 是培養 Champion 的關鍵步驟'
  },
];
```

#### 3.2 建立 Seed 執行腳本

**檔案**: `packages/db/src/seed/seed-talk-tracks.ts`

```typescript
import { db } from '../index';
import { talkTracks } from '../schema';
import { beautyTalkTracks } from './talk-tracks-beauty';

async function seedTalkTracks() {
  console.log('🌱 開始 Seed 美業話術資料...');

  // 檢查是否已有美業話術
  const existingBeautyTracks = await db
    .select()
    .from(talkTracks)
    .where(eq(talkTracks.productLine, 'beauty'));

  if (existingBeautyTracks.length > 0) {
    console.log(`⚠️ 已存在 ${existingBeautyTracks.length} 筆美業話術,跳過 Seed`);
    return;
  }

  // 插入美業話術
  for (const track of beautyTalkTracks) {
    await db.insert(talkTracks).values({
      productLine: track.productLine,
      stage: track.stage,
      title: track.title,
      content: track.content,
      tips: track.tips,
    });
  }

  console.log(`✅ 成功 Seed ${beautyTalkTracks.length} 筆美業話術`);

  // 驗證
  const allBeautyTracks = await db
    .select()
    .from(talkTracks)
    .where(eq(talkTracks.productLine, 'beauty'));

  console.log(`📊 目前美業話術總數: ${allBeautyTracks.length}`);

  // 按階段統計
  const stages = ['metrics', 'decision-process', 'economic-buyer', 'decision-criteria', 'identify-pain', 'champion'];
  for (const stage of stages) {
    const count = allBeautyTracks.filter(t => t.stage === stage).length;
    console.log(`   - ${stage}: ${count} 筆`);
  }
}

seedTalkTracks()
  .catch((error) => {
    console.error('❌ Seed 失敗:', error);
    process.exit(1);
  })
  .then(() => {
    console.log('✅ Seed 完成');
    process.exit(0);
  });
```

#### 3.3 執行 Seed

```bash
# 執行 Seed 腳本
bun run packages/db/src/seed/seed-talk-tracks.ts

# 預期輸出:
# 🌱 開始 Seed 美業話術資料...
# ✅ 成功 Seed 20 筆美業話術
# 📊 目前美業話術總數: 20
#    - metrics: 4 筆
#    - decision-process: 3 筆
#    - economic-buyer: 3 筆
#    - decision-criteria: 3 筆
#    - identify-pain: 4 筆
#    - champion: 3 筆
```

---

## 驗收檢查點

### ✅ 檢查點 4-1: UI 元件正常運作

```bash
# 啟動 Dashboard
cd apps/dashboard
bun run dev

# 手動測試:
# 1. 開啟 /opportunities 頁面
# 2. 點擊產品線選擇器 (全部 / iCHEF / 美業)
# 3. 確認列表正確過濾
# 4. 確認 Badge 顏色正確 (藍色=iCHEF, 紫色=美業)
```

**通過條件**:
- ✅ 選擇器可正常切換
- ✅ 列表正確過濾
- ✅ Badge 顯示正確

---

### ✅ 檢查點 4-2: 話術系統過濾正常

```bash
# 開啟 /talk-tracks 頁面
# 測試:
# 1. 選擇 "iCHEF" → 只顯示 iCHEF 話術
# 2. 選擇 "美業" → 只顯示美業話術
# 3. 選擇 "全部" → 顯示所有話術
# 4. 組合過濾: 美業 + Metrics 階段
```

**通過條件**:
- ✅ 產品線過濾正確
- ✅ 階段過濾正確
- ✅ 組合過濾正確

---

### ✅ 檢查點 4-3: 美業話術資料完整

```bash
# 查詢 DB
bun run packages/db/src/check-talk-tracks.ts

# 或手動查詢
# SELECT stage, COUNT(*) FROM talk_tracks WHERE product_line = 'beauty' GROUP BY stage;
```

**預期結果**:
```
metrics: 4 筆
decision-process: 3 筆
economic-buyer: 3 筆
decision-criteria: 3 筆
identify-pain: 4 筆
champion: 3 筆
總計: 20 筆
```

**通過條件**: 所有階段都有話術資料

---

### ✅ 檢查點 4-4: TypeScript 編譯無錯誤

```bash
# 檢查 Dashboard
cd apps/dashboard
bun run tsc --noEmit

# 檢查 DB Seed
cd packages/db
bun run tsc --noEmit
```

**通過條件**: 無 TypeScript 錯誤

---

## 向後相容性驗證

### 測試 1: 不選擇產品線時顯示全部

```typescript
// 測試: 預設狀態 (selectedProductLine = 'all')
// 應該顯示所有 Opportunities (包含 iCHEF 和美業)

const { data } = trpc.opportunity.listOpportunities.useQuery({
  productLine: undefined, // 不過濾
});

// 驗證: data 應包含所有產品線
expect(data?.some(o => o.productLine === 'ichef')).toBe(true);
expect(data?.some(o => o.productLine === 'beauty')).toBe(true);
```

**通過條件**: 可正常顯示所有資料

---

### 測試 2: 現有 iCHEF 話術不受影響

```bash
# 查詢 iCHEF 話術
SELECT COUNT(*) FROM talk_tracks WHERE product_line = 'ichef';

# 確認數量與之前一致 (沒有被刪除或修改)
```

**通過條件**: iCHEF 話術數量不變

---

## 性能驗證

### UI 渲染性能

**測試腳本**: 使用 React DevTools Profiler

```typescript
// 在 ProductLineSelector 包裹 Profiler
import { Profiler } from 'react';

<Profiler id="ProductLineSelector" onRender={onRenderCallback}>
  <ProductLineSelector value={value} onChange={onChange} />
</Profiler>

function onRenderCallback(
  id, phase, actualDuration, baseDuration, startTime, commitTime
) {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
}
```

**通過標準**: 
- ✅ 初始渲染 < 50ms
- ✅ 切換產品線 < 20ms

---

## 故障排除

### 問題 1: ProductLineSelector 未顯示

**可能原因**:
- `getAllProductLines()` import 錯誤
- Config 未正確載入

**解決方法**:
```typescript
// 檢查 import
import { getAllProductLines } from '@Sales_ai_automation_v3/config';

// 檢查返回值
console.log('Product lines:', getAllProductLines());
// 預期: ['ichef', 'beauty']
```

---

### 問題 2: Badge 顏色不正確

**症狀**: 所有 Badge 都顯示同樣顏色

**原因**: Tailwind CSS 類名動態生成問題

**解決方法**:
```typescript
// ❌ 錯誤: 動態字串會被 Tailwind purge
const color = `bg-${productLine === 'ichef' ? 'blue' : 'purple'}-100`;

// ✅ 正確: 使用完整類名
const colors = {
  ichef: 'bg-blue-100 text-blue-800',
  beauty: 'bg-purple-100 text-purple-800',
};
const color = colors[productLine];
```

---

### 問題 3: Seed 執行失敗

**錯誤訊息**:
```
Error: duplicate key value violates unique constraint
```

**原因**: 已經 Seed 過,重複執行

**解決方法**:
```typescript
// 在 Seed 腳本中加入檢查
const existing = await db.select().from(talkTracks).where(eq(talkTracks.productLine, 'beauty'));
if (existing.length > 0) {
  console.log('已存在,跳過');
  return;
}
```

---

### 問題 4: 話術查詢沒有資料

**症狀**: listTalkTracks 返回空陣列

**排查步驟**:
```bash
# 1. 檢查 DB 是否有資料
sqlite3 database.db "SELECT COUNT(*) FROM talk_tracks WHERE product_line = 'beauty';"

# 2. 檢查 API query 參數
console.log('Query params:', { productLine, stage });

# 3. 檢查 where 條件
console.log('Where conditions:', conditions);
```

---

## 完成標準

### Agent E 任務完成清單

- [ ] ✅ ProductLineSelector 元件完成
- [ ] ✅ Dashboard Opportunities 頁面整合完成
- [ ] ✅ ProductLineBadge 元件完成
- [ ] ✅ 話術查詢 API 新增產品線過濾
- [ ] ✅ Dashboard 話術頁面整合完成
- [ ] ✅ 美業話術資料完成 (20 筆)
- [ ] ✅ Seed 腳本完成並執行成功
- [ ] ✅ 所有驗收檢查點通過
- [ ] ✅ 向後相容性測試通過
- [ ] ✅ UI 性能測試通過
- [ ] ✅ TypeScript 編譯無錯誤

### 交付物

1. **UI 元件**:
   - `apps/dashboard/src/components/ProductLineSelector.tsx`
   - `apps/dashboard/src/components/ProductLineBadge.tsx`

2. **頁面更新**:
   - `apps/dashboard/src/pages/opportunities.tsx` (已更新)
   - `apps/dashboard/src/pages/talk-tracks.tsx` (已更新)

3. **話術資料**:
   - `packages/db/src/seed/talk-tracks-beauty.ts` (20 筆話術)
   - `packages/db/src/seed/seed-talk-tracks.ts` (Seed 腳本)

4. **API 更新**:
   - `packages/api/src/routers/talk-track.ts` (已新增 productLine 過濾)

---

## 美業話術品質標準

### 內容要求

1. **真實性**: 基於真實美業場景
2. **實用性**: 銷售人員可直接使用
3. **具體性**: 避免空泛問題,要有具體指向
4. **階段性**: 符合 MEDDIC 各階段目標

### 覆蓋度要求

- ✅ Metrics: 至少 4 筆 (營收、客戶、產能、系統)
- ✅ Decision Process: 至少 3 筆 (決策者、時機、競品)
- ✅ Economic Buyer: 至少 3 筆 (預算、ROI、權限)
- ✅ Decision Criteria: 至少 3 筆 (需求、功能、整合)
- ✅ Identify Pain: 至少 4 筆 (核心痛點)
- ✅ Champion: 至少 3 筆 (培養內部支持者)

---

## 下一步

**完成後通知**: 整合測試團隊

**訊息內容**:
```
Agent E (Dashboard 與話術資料) 已完成!

Dashboard 更新:
- ProductLineSelector 元件可用
- Opportunities 頁面支援產品線過濾
- 話術頁面支援產品線過濾
- ProductLineBadge 元件可用

美業話術資料:
- 總計 20 筆話術
- 覆蓋 MEDDIC 6 個階段
- 已通過品質檢查

所有驗收檢查點: ✅ 通過
UI 性能: ✅ 達標
```

---

**準備好了嗎?** 開始開發 Agent E! 🚀
