# Phase 6: 整合測試與 Rep Performance

> **任務類型**: 整合測試與功能整合
> **預估時間**: 1-2 工作日
> **依賴條件**: Phase 5 所有 Agent 完成
> **執行方式**: 序列執行（非並行）

---

## 目標

整合 Phase 5 所有模組，驗證端對端流程，並完成 Rep Performance 分析功能。

---

## 前置條件檢查清單

### Phase 5 完成確認

- [ ] **Agent 4 (Lead Source)**: Squarespace webhook 可接收、UTM 正確追蹤
- [ ] **Agent 5 (MQL + Ops)**: MQL 評分運作、`/api/health` 回應正確
- [ ] **Agent 6 (Deal/Success)**: Onboarding 任務建立、健康度計算正確
- [ ] **Agent 7 (Workflow)**: MEDDIC workflow 執行結果與 Orchestrator 一致

### 環境確認

- [ ] 所有 Phase 5 migration 已執行
- [ ] 所有 API 路由已註冊
- [ ] 前端路由已設定

---

## Task 6.1: Rep Performance 整合

### 目標

整合所有模組數據，建立銷售代表個人表現分析系統。

### 任務清單

#### 6.1.1 建立 Rep Performance Service

```
packages/services/src/analytics/rep-performance/
├── index.ts          # 匯出
├── kpi.ts            # KPI 計算
├── ranking.ts        # 排名計算
├── trends.ts         # 趨勢分析
├── recommendations.ts # AI 改善建議
└── types.ts          # 類型定義
```

**檔案: `packages/services/src/analytics/rep-performance/types.ts`**

```typescript
export interface RepKPIs {
  // 機會指標
  totalOpportunities: number;
  wonOpportunities: number;
  lostOpportunities: number;
  activeOpportunities: number;

  // 轉換率
  conversionRate: number; // won / (won + lost)
  winRate: number;

  // MEDDIC 表現
  avgMeddicScore: number;
  meddicTrend: 'improving' | 'stable' | 'declining';

  // 效率指標
  avgDealCycledays: number; // 平均成交週期
  avgResponseTime: number; // 平均回應時間（小時）

  // 對話品質
  totalConversations: number;
  avgConversationScore: number;

  // 客戶成功（如有）
  avgCustomerHealthScore: number;
  renewalRate: number;
}

export interface RepRanking {
  repId: string;
  repName: string;
  rank: number;
  totalReps: number;
  percentile: number;
  score: number; // 綜合分數
  badges: RepBadge[];
}

export interface RepBadge {
  type: 'top_performer' | 'most_improved' | 'highest_meddic' | 'fastest_closer';
  label: string;
  earnedAt: Date;
}

export interface RepTrend {
  week: string; // YYYY-WW
  opportunities: number;
  wonDeals: number;
  avgMeddicScore: number;
  conversionRate: number;
}

export interface AIRecommendation {
  category: 'meddic' | 'conversion' | 'speed' | 'quality';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems: string[];
  basedOn: string; // 根據什麼數據
}
```

**檔案: `packages/services/src/analytics/rep-performance/kpi.ts`**

```typescript
import { and, between, count, eq, sql } from "drizzle-orm";
import type { db } from "@sales-ai/db";
import {
  conversations,
  meddicAnalyses,
  opportunities,
} from "@sales-ai/db/schema";
import type { RepKPIs } from "./types";

export async function calculateRepKPIs(
  database: typeof db,
  repId: string,
  dateRange: { start: Date; end: Date }
): Promise<RepKPIs> {
  const { start, end } = dateRange;

  // 機會統計
  const opportunityStats = await database
    .select({
      total: count(),
      won: count(
        sql`CASE WHEN ${opportunities.status} = 'won' THEN 1 END`
      ),
      lost: count(
        sql`CASE WHEN ${opportunities.status} = 'lost' THEN 1 END`
      ),
      active: count(
        sql`CASE WHEN ${opportunities.status} IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation') THEN 1 END`
      ),
    })
    .from(opportunities)
    .where(
      and(
        eq(opportunities.assignedTo, repId),
        between(opportunities.createdAt, start, end)
      )
    );

  const stats = opportunityStats[0];

  // MEDDIC 平均分數
  const meddicStats = await database
    .select({
      avgScore: sql<number>`AVG(${meddicAnalyses.overallScore})`,
    })
    .from(meddicAnalyses)
    .innerJoin(
      conversations,
      eq(meddicAnalyses.conversationId, conversations.id)
    )
    .innerJoin(
      opportunities,
      eq(conversations.opportunityId, opportunities.id)
    )
    .where(
      and(
        eq(opportunities.assignedTo, repId),
        between(meddicAnalyses.createdAt, start, end)
      )
    );

  // 對話統計
  const conversationStats = await database
    .select({
      total: count(),
      avgScore: sql<number>`AVG(${conversations.qualityScore})`,
    })
    .from(conversations)
    .innerJoin(
      opportunities,
      eq(conversations.opportunityId, opportunities.id)
    )
    .where(
      and(
        eq(opportunities.assignedTo, repId),
        between(conversations.createdAt, start, end)
      )
    );

  // 平均成交週期（僅計算已成交）
  const cycleStats = await database
    .select({
      avgCycle: sql<number>`AVG(EXTRACT(EPOCH FROM (${opportunities.actualCloseDate} - ${opportunities.createdAt})) / 86400)`,
    })
    .from(opportunities)
    .where(
      and(
        eq(opportunities.assignedTo, repId),
        eq(opportunities.status, "won"),
        between(opportunities.createdAt, start, end)
      )
    );

  const total = stats.total || 0;
  const won = stats.won || 0;
  const lost = stats.lost || 0;

  return {
    totalOpportunities: total,
    wonOpportunities: won,
    lostOpportunities: lost,
    activeOpportunities: stats.active || 0,
    conversionRate: won + lost > 0 ? won / (won + lost) : 0,
    winRate: total > 0 ? won / total : 0,
    avgMeddicScore: meddicStats[0]?.avgScore || 0,
    meddicTrend: "stable", // 需要計算趨勢
    avgDealCycledays: cycleStats[0]?.avgCycle || 0,
    avgResponseTime: 0, // 需要額外數據
    totalConversations: conversationStats[0]?.total || 0,
    avgConversationScore: conversationStats[0]?.avgScore || 0,
    avgCustomerHealthScore: 0, // 從 customer-success 模組取得
    renewalRate: 0, // 從 customer-success 模組取得
  };
}
```

**檔案: `packages/services/src/analytics/rep-performance/ranking.ts`**

```typescript
import { desc, sql } from "drizzle-orm";
import type { db } from "@sales-ai/db";
import { opportunities, users } from "@sales-ai/db/schema";
import type { RepRanking } from "./types";

export async function calculateRepRankings(
  database: typeof db,
  dateRange: { start: Date; end: Date }
): Promise<RepRanking[]> {
  const { start, end } = dateRange;

  // 計算每個 rep 的綜合分數
  const repScores = await database
    .select({
      repId: opportunities.assignedTo,
      repName: users.name,
      wonDeals: sql<number>`COUNT(CASE WHEN ${opportunities.status} = 'won' THEN 1 END)`,
      totalDeals: sql<number>`COUNT(*)`,
      totalValue: sql<number>`SUM(CASE WHEN ${opportunities.status} = 'won' THEN ${opportunities.value} ELSE 0 END)`,
    })
    .from(opportunities)
    .innerJoin(users, sql`${opportunities.assignedTo} = ${users.id}`)
    .where(sql`${opportunities.createdAt} BETWEEN ${start} AND ${end}`)
    .groupBy(opportunities.assignedTo, users.name)
    .orderBy(desc(sql`SUM(CASE WHEN ${opportunities.status} = 'won' THEN ${opportunities.value} ELSE 0 END)`));

  const totalReps = repScores.length;

  return repScores.map((rep, index) => {
    const rank = index + 1;
    const winRate = rep.totalDeals > 0 ? rep.wonDeals / rep.totalDeals : 0;

    // 綜合分數計算（可自訂權重）
    const score = winRate * 40 + (rep.wonDeals / Math.max(...repScores.map(r => r.wonDeals))) * 30 +
      (rep.totalValue / Math.max(...repScores.map(r => r.totalValue))) * 30;

    return {
      repId: rep.repId || "",
      repName: rep.repName || "Unknown",
      rank,
      totalReps,
      percentile: Math.round((1 - rank / totalReps) * 100),
      score: Math.round(score * 100) / 100,
      badges: determineBadges(rep, rank, repScores),
    };
  });
}

function determineBadges(
  rep: { wonDeals: number; totalDeals: number; totalValue: number },
  rank: number,
  allReps: Array<{ wonDeals: number; totalDeals: number; totalValue: number }>
): RepRanking["badges"] {
  const badges: RepRanking["badges"] = [];
  const now = new Date();

  if (rank === 1) {
    badges.push({
      type: "top_performer",
      label: "Top Performer",
      earnedAt: now,
    });
  }

  const maxWonDeals = Math.max(...allReps.map(r => r.wonDeals));
  if (rep.wonDeals === maxWonDeals && rep.wonDeals > 0) {
    badges.push({
      type: "fastest_closer",
      label: "Fastest Closer",
      earnedAt: now,
    });
  }

  return badges;
}
```

**檔案: `packages/services/src/analytics/rep-performance/recommendations.ts`**

```typescript
import type { AIRecommendation, RepKPIs } from "./types";

export function generateRecommendations(kpis: RepKPIs): AIRecommendation[] {
  const recommendations: AIRecommendation[] = [];

  // MEDDIC 分數建議
  if (kpis.avgMeddicScore < 60) {
    recommendations.push({
      category: "meddic",
      priority: "high",
      title: "提升 MEDDIC 評分",
      description: `目前平均 MEDDIC 分數為 ${kpis.avgMeddicScore.toFixed(1)}，低於目標 60 分`,
      actionItems: [
        "在每次對話中確認 Decision Criteria 和 Decision Process",
        "深入了解客戶的 Pain Points 並記錄",
        "識別並接觸 Economic Buyer",
        "量化解決方案的商業價值（Metrics）",
      ],
      basedOn: `過去 12 週 MEDDIC 平均分數`,
    });
  }

  // 轉換率建議
  if (kpis.conversionRate < 0.25) {
    recommendations.push({
      category: "conversion",
      priority: "high",
      title: "提升成交轉換率",
      description: `目前轉換率為 ${(kpis.conversionRate * 100).toFixed(1)}%，低於目標 25%`,
      actionItems: [
        "在 Proposal 階段加強價值主張說明",
        "及早識別並處理客戶異議",
        "確保所有利害關係人都參與決策過程",
        "使用競爭對手比較資料強化差異化",
      ],
      basedOn: `成交與失敗機會比例分析`,
    });
  }

  // 成交週期建議
  if (kpis.avgDealCycledays > 60) {
    recommendations.push({
      category: "speed",
      priority: "medium",
      title: "縮短成交週期",
      description: `平均成交週期為 ${kpis.avgDealCycledays.toFixed(0)} 天，高於目標 60 天`,
      actionItems: [
        "提前確認預算核准流程",
        "在早期階段就讓決策者參與",
        "提供限時優惠或早鳥方案",
        "減少 Proposal 到簽約的等待時間",
      ],
      basedOn: `已成交機會的平均週期`,
    });
  }

  // 對話品質建議
  if (kpis.avgConversationScore < 70) {
    recommendations.push({
      category: "quality",
      priority: "medium",
      title: "提升對話品質",
      description: `平均對話品質分數為 ${kpis.avgConversationScore.toFixed(1)}，低於目標 70 分`,
      actionItems: [
        "使用更多開放式問題引導對話",
        "增加聆聽比例，減少產品推銷",
        "確保每次對話都有明確的下一步行動",
        "記錄並追蹤客戶承諾事項",
      ],
      basedOn: `對話分析 AI 評分`,
    });
  }

  return recommendations;
}
```

**檔案: `packages/services/src/analytics/rep-performance/index.ts`**

```typescript
export * from "./types";
export { calculateRepKPIs } from "./kpi";
export { calculateRepRankings } from "./ranking";
export { generateRecommendations } from "./recommendations";
```

#### 6.1.2 擴展 Analytics API

**更新: `packages/api/src/routers/analytics.ts`**

```typescript
import { os } from "@orpc/server";
import { z } from "zod";
import {
  calculateRepKPIs,
  calculateRepRankings,
  generateRecommendations,
} from "@sales-ai/services/analytics/rep-performance";

// 新增路由
export const analyticsRouter = os.router({
  // ... 現有路由 ...

  // Rep Performance - 個人 KPIs
  getRepKPIs: os
    .route({
      method: "GET",
      path: "/analytics/rep/{repId}/kpis",
    })
    .input(
      z.object({
        repId: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .func(async ({ input, context }) => {
      const { db } = context;
      const { repId, startDate, endDate } = input;

      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000); // 預設 90 天

      const kpis = await calculateRepKPIs(db, repId, { start, end });
      const recommendations = generateRecommendations(kpis);

      return { kpis, recommendations };
    }),

  // Rep Performance - 團隊排名
  getTeamRankings: os
    .route({
      method: "GET",
      path: "/analytics/team/rankings",
    })
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .func(async ({ input, context }) => {
      const { db } = context;
      const { startDate, endDate } = input;

      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);

      const rankings = await calculateRepRankings(db, { start, end });

      return {
        rankings,
        period: { start: start.toISOString(), end: end.toISOString() },
      };
    }),

  // Rep Performance - 我的表現（當前登入用戶）
  getMyPerformance: os
    .route({
      method: "GET",
      path: "/analytics/me/performance",
    })
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .func(async ({ input, context }) => {
      const { db, user } = context;

      if (!user) {
        throw new Error("Unauthorized");
      }

      const { startDate, endDate } = input;
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);

      const [kpis, rankings] = await Promise.all([
        calculateRepKPIs(db, user.id, { start, end }),
        calculateRepRankings(db, { start, end }),
      ]);

      const myRanking = rankings.find((r) => r.repId === user.id);
      const recommendations = generateRecommendations(kpis);

      return {
        kpis,
        ranking: myRanking,
        recommendations,
        period: { start: start.toISOString(), end: end.toISOString() },
      };
    }),
});
```

#### 6.1.3 建立 Rep Performance UI

**檔案: `apps/web/src/routes/analytics/performance.tsx`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/analytics/performance")({
  component: PerformancePage,
});

function PerformancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-performance"],
    queryFn: () => orpc.analytics.getMyPerformance.call({}),
  });

  if (isLoading) {
    return <div>載入中...</div>;
  }

  if (!data) {
    return <div>無法載入數據</div>;
  }

  const { kpis, ranking, recommendations } = data;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">我的表現</h1>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="成交轉換率"
          value={`${(kpis.conversionRate * 100).toFixed(1)}%`}
          target="25%"
          progress={Math.min(kpis.conversionRate * 4, 1) * 100}
        />
        <KPICard
          title="平均 MEDDIC 分數"
          value={kpis.avgMeddicScore.toFixed(1)}
          target="60"
          progress={Math.min(kpis.avgMeddicScore / 60, 1) * 100}
        />
        <KPICard
          title="成交機會"
          value={kpis.wonOpportunities.toString()}
          subtitle={`/ ${kpis.totalOpportunities} 總機會`}
        />
        <KPICard
          title="平均成交週期"
          value={`${kpis.avgDealCycledays.toFixed(0)} 天`}
          target="60 天"
          inverse
          progress={Math.max(0, (1 - kpis.avgDealCycledays / 120)) * 100}
        />
      </div>

      {/* 排名 */}
      {ranking && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              團隊排名
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold">#{ranking.rank}</div>
              <div>
                <div className="text-sm text-muted-foreground">
                  共 {ranking.totalReps} 人
                </div>
                <div className="text-sm">
                  超越 {ranking.percentile}% 的同事
                </div>
              </div>
              <div className="flex gap-2 ml-auto">
                {ranking.badges.map((badge) => (
                  <Badge key={badge.type} variant="secondary">
                    {badge.label}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 改善建議 */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              改善建議
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className="border rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      rec.priority === "high"
                        ? "destructive"
                        : rec.priority === "medium"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {rec.priority === "high"
                      ? "高優先"
                      : rec.priority === "medium"
                        ? "中優先"
                        : "低優先"}
                  </Badge>
                  <span className="font-medium">{rec.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {rec.description}
                </p>
                <ul className="text-sm list-disc list-inside space-y-1">
                  {rec.actionItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  根據: {rec.basedOn}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KPICard({
  title,
  value,
  target,
  subtitle,
  progress,
  inverse,
}: {
  title: string;
  value: string;
  target?: string;
  subtitle?: string;
  progress?: number;
  inverse?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {target && (
          <p className="text-xs text-muted-foreground">目標: {target}</p>
        )}
        {progress !== undefined && (
          <Progress value={progress} className="mt-2 h-1" />
        )}
      </CardContent>
    </Card>
  );
}
```

### 驗收標準

- [ ] Rep KPIs API 回傳正確數據
- [ ] 團隊排名計算正確
- [ ] AI 改善建議根據 KPIs 生成
- [ ] Performance UI 正確顯示

---

## Task 6.2: 跨模組整合測試

### 目標

驗證完整銷售流程的端對端運作。

### 測試場景

#### 場景 1: Lead Source → MQL → Sales Conversation

**流程描述**:
1. Squarespace 表單提交 → 自動建立 Opportunity
2. MQL 評分觸發 → 自動評估資格
3. 業務接觸 → 建立 Conversation
4. MEDDIC 分析 → 執行 Workflow
5. Alert 觸發 → Slack 通知

**測試檔案: `tests/e2e/lead-to-meddic.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Lead Source to MEDDIC Flow", () => {
  test("should process lead from Squarespace webhook to MEDDIC analysis", async ({
    request,
  }) => {
    // Step 1: 模擬 Squarespace webhook
    const webhookPayload = {
      formId: "test-form-123",
      data: {
        name: "Test Company",
        email: "test@example.com",
        phone: "0912345678",
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "q1-2025",
      },
      submittedAt: new Date().toISOString(),
    };

    const webhookResponse = await request.post(
      "/api/webhooks/squarespace",
      {
        data: webhookPayload,
        headers: {
          "X-Squarespace-Signature": "test-signature",
        },
      }
    );

    expect(webhookResponse.status()).toBe(200);
    const { opportunityId } = await webhookResponse.json();
    expect(opportunityId).toBeDefined();

    // Step 2: 驗證 MQL 評分
    const mqlResponse = await request.get(
      `/api/mql/${opportunityId}`
    );
    expect(mqlResponse.status()).toBe(200);
    const mqlData = await mqlResponse.json();
    expect(mqlData.score).toBeGreaterThanOrEqual(0);
    expect(mqlData.qualified).toBeDefined();

    // Step 3: 建立 Conversation
    const conversationPayload = {
      opportunityId,
      title: "Initial Discovery Call",
      transcript: [
        { speaker: "rep", text: "感謝您的來電..." },
        { speaker: "customer", text: "我們在尋找 POS 解決方案..." },
      ],
    };

    const conversationResponse = await request.post(
      "/api/conversations",
      { data: conversationPayload }
    );
    expect(conversationResponse.status()).toBe(200);
    const { conversationId } = await conversationResponse.json();

    // Step 4: 執行 MEDDIC Workflow
    const workflowResponse = await request.post(
      "/api/workflows/meddic-analysis/execute",
      {
        data: { conversationId },
      }
    );
    expect(workflowResponse.status()).toBe(200);
    const workflowResult = await workflowResponse.json();
    expect(workflowResult.success).toBe(true);
    expect(workflowResult.outputs["coaching"]).toBeDefined();

    // Step 5: 檢查 MEDDIC 分析結果
    const analysisResponse = await request.get(
      `/api/conversations/${conversationId}/meddic`
    );
    expect(analysisResponse.status()).toBe(200);
    const analysis = await analysisResponse.json();
    expect(analysis.overallScore).toBeGreaterThanOrEqual(0);
    expect(analysis.metrics).toBeDefined();
    expect(analysis.economicBuyer).toBeDefined();
  });
});
```

#### 場景 2: Won Deal → Onboarding → Customer Success

**流程描述**:
1. Opportunity 狀態更新為 Won
2. 自動建立 Onboarding 流程
3. Onboarding 任務追蹤
4. 完成後轉入 Customer Success
5. 健康度評分開始追蹤

**測試檔案: `tests/e2e/won-to-success.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Won Deal to Customer Success Flow", () => {
  test("should transition won deal through onboarding to customer success", async ({
    request,
  }) => {
    // 假設已有 opportunity
    const opportunityId = "test-opportunity-123";

    // Step 1: 更新為 Won
    const updateResponse = await request.patch(
      `/api/opportunities/${opportunityId}`,
      {
        data: {
          status: "won",
          actualCloseDate: new Date().toISOString(),
          value: 50000,
        },
      }
    );
    expect(updateResponse.status()).toBe(200);

    // Step 2: 驗證 Onboarding 流程已建立
    const onboardingResponse = await request.get(
      `/api/onboarding/${opportunityId}`
    );
    expect(onboardingResponse.status()).toBe(200);
    const onboarding = await onboardingResponse.json();
    expect(onboarding.status).toBe("in_progress");
    expect(onboarding.tasks.length).toBeGreaterThan(0);

    // Step 3: 完成 Onboarding 任務
    for (const task of onboarding.tasks) {
      const taskResponse = await request.patch(
        `/api/onboarding/tasks/${task.id}`,
        {
          data: { status: "completed" },
        }
      );
      expect(taskResponse.status()).toBe(200);
    }

    // Step 4: 驗證 Onboarding 完成
    const completedOnboardingResponse = await request.get(
      `/api/onboarding/${opportunityId}`
    );
    const completedOnboarding = await completedOnboardingResponse.json();
    expect(completedOnboarding.status).toBe("completed");

    // Step 5: 驗證 Customer Health 已建立
    const healthResponse = await request.get(
      `/api/customer-success/${opportunityId}/health`
    );
    expect(healthResponse.status()).toBe(200);
    const health = await healthResponse.json();
    expect(health.healthScore).toBeGreaterThanOrEqual(0);
    expect(health.status).toBeDefined();
  });
});
```

#### 場景 3: Alert 系統完整流程

**測試檔案: `tests/e2e/alert-flow.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Alert System Flow", () => {
  test("should trigger and process alerts correctly", async ({ request }) => {
    // 建立低分對話以觸發 Alert
    const conversationPayload = {
      opportunityId: "test-opportunity",
      title: "Low Score Conversation",
      qualityScore: 25, // 低於閾值
    };

    const createResponse = await request.post("/api/conversations", {
      data: conversationPayload,
    });
    expect(createResponse.status()).toBe(200);

    // 等待 Alert 處理
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 驗證 Alert 已建立
    const alertsResponse = await request.get("/api/alerts?status=pending");
    expect(alertsResponse.status()).toBe(200);
    const alerts = await alertsResponse.json();

    const relevantAlert = alerts.find(
      (a: { relatedId: string }) =>
        a.relatedId === conversationPayload.opportunityId
    );
    expect(relevantAlert).toBeDefined();
    expect(relevantAlert.type).toBe("low_meddic_score");

    // 確認 Alert
    const acknowledgeResponse = await request.patch(
      `/api/alerts/${relevantAlert.id}`,
      {
        data: {
          status: "acknowledged",
          acknowledgedBy: "test-user",
        },
      }
    );
    expect(acknowledgeResponse.status()).toBe(200);
  });
});
```

### 測試執行

```bash
# 執行所有 E2E 測試
bun run test:e2e

# 執行特定場景
bun run test:e2e tests/e2e/lead-to-meddic.spec.ts
bun run test:e2e tests/e2e/won-to-success.spec.ts
bun run test:e2e tests/e2e/alert-flow.spec.ts
```

### 驗收標準

- [ ] 場景 1 測試通過：Lead Source → MEDDIC 完整流程
- [ ] 場景 2 測試通過：Won → Customer Success 完整流程
- [ ] 場景 3 測試通過：Alert 觸發與處理流程
- [ ] 所有 E2E 測試通過率 > 95%

---

## Task 6.3: 效能驗證

### 目標

確保所有 API 回應時間符合 SLA 要求。

### 效能指標

| API 端點 | 目標 P95 | 目標 P99 |
|----------|----------|----------|
| GET /api/opportunities | < 200ms | < 500ms |
| GET /api/conversations | < 200ms | < 500ms |
| POST /api/conversations | < 300ms | < 800ms |
| POST /api/workflows/execute | < 5000ms | < 10000ms |
| GET /api/analytics/* | < 500ms | < 1000ms |
| GET /api/health | < 100ms | < 200ms |

### 效能測試腳本

**檔案: `scripts/performance-test.ts`**

```typescript
import { performance } from "perf_hooks";

const API_BASE_URL = process.env.API_URL || "http://localhost:3000";
const ITERATIONS = 100;

interface TestResult {
  endpoint: string;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
}

async function measureEndpoint(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: unknown
): Promise<number[]> {
  const times: number[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();

    await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    const end = performance.now();
    times.push(end - start);

    // 避免過載
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return times;
}

function calculatePercentile(arr: number[], percentile: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

function analyzeResults(endpoint: string, times: number[]): TestResult {
  const sorted = [...times].sort((a, b) => a - b);

  return {
    endpoint,
    p50: calculatePercentile(times, 50),
    p95: calculatePercentile(times, 95),
    p99: calculatePercentile(times, 99),
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

async function runPerformanceTests() {
  console.log("🚀 Starting Performance Tests...\n");

  const endpoints = [
    { path: "/api/health", method: "GET" as const },
    { path: "/api/opportunities", method: "GET" as const },
    { path: "/api/conversations", method: "GET" as const },
    { path: "/api/analytics/lead-stats", method: "GET" as const },
    { path: "/api/analytics/me/performance", method: "GET" as const },
  ];

  const results: TestResult[] = [];

  for (const { path, method } of endpoints) {
    console.log(`Testing ${method} ${path}...`);
    const times = await measureEndpoint(path, method);
    const result = analyzeResults(path, times);
    results.push(result);

    console.log(`  P50: ${result.p50.toFixed(2)}ms`);
    console.log(`  P95: ${result.p95.toFixed(2)}ms`);
    console.log(`  P99: ${result.p99.toFixed(2)}ms\n`);
  }

  // 輸出報告
  console.log("\n📊 Performance Report\n");
  console.log("| Endpoint | P50 | P95 | P99 | Status |");
  console.log("|----------|-----|-----|-----|--------|");

  for (const r of results) {
    const status = r.p95 < 500 ? "✅ PASS" : "❌ FAIL";
    console.log(
      `| ${r.endpoint} | ${r.p50.toFixed(0)}ms | ${r.p95.toFixed(0)}ms | ${r.p99.toFixed(0)}ms | ${status} |`
    );
  }

  // 檢查是否全部通過
  const allPassed = results.every((r) => r.p95 < 500);
  console.log(`\n${allPassed ? "✅ All tests passed!" : "❌ Some tests failed!"}`);

  process.exit(allPassed ? 0 : 1);
}

runPerformanceTests().catch(console.error);
```

### 執行方式

```bash
# 執行效能測試
bun run scripts/performance-test.ts

# 設定環境
API_URL=https://api.your-domain.com bun run scripts/performance-test.ts
```

### 驗收標準

- [ ] 所有 GET API P95 < 500ms
- [ ] Workflow 執行 P95 < 10s
- [ ] Health Check P95 < 200ms
- [ ] 效能測試報告已保存

---

## Task 6.4: 文件與驗收

### 目標

完成所有文件更新與最終驗收。

### 任務清單

#### 6.4.1 API 文件更新

- [ ] 更新 API 端點文件（新增 Phase 5-6 端點）
- [ ] 建立 API 使用範例
- [ ] 更新 Postman/Insomnia 集合

#### 6.4.2 使用者手冊

- [ ] Lead Source 設定指南
- [ ] MQL 評分規則設定
- [ ] Onboarding 任務管理
- [ ] Rep Performance 使用說明

#### 6.4.3 系統驗收

**驗收清單**:

| 模組 | 功能 | 驗收狀態 |
|------|------|----------|
| **Lead Source** | Squarespace webhook 接收 | [ ] |
| **Lead Source** | UTM 參數正確記錄 | [ ] |
| **Lead Source** | 來源統計報表正確 | [ ] |
| **MQL** | 評分規則可配置 | [ ] |
| **MQL** | 自動評估正確執行 | [ ] |
| **Ops** | `/api/health` 回傳所有服務狀態 | [ ] |
| **Ops** | 異常 Slack 通知 | [ ] |
| **Onboarding** | 成交後自動建立任務 | [ ] |
| **Onboarding** | 進度追蹤正確 | [ ] |
| **Onboarding** | 逾期自動提醒 | [ ] |
| **Customer Success** | 健康度評分正確 | [ ] |
| **Customer Success** | 續約追蹤正常 | [ ] |
| **Workflow** | YAML 載入正確 | [ ] |
| **Workflow** | 並行執行正確 | [ ] |
| **Workflow** | 品質迴圈正確 | [ ] |
| **Rep Performance** | KPI 計算正確 | [ ] |
| **Rep Performance** | 團隊排名正確 | [ ] |
| **Rep Performance** | AI 建議生成 | [ ] |
| **E2E Tests** | 所有測試通過 | [ ] |
| **Performance** | 所有 API P95 < 500ms | [ ] |

### 驗收標準

- [ ] 所有模組功能驗收通過
- [ ] E2E 測試通過率 > 95%
- [ ] 效能測試全部通過
- [ ] 文件更新完成

---

## 產出檔案清單

### 新建檔案

```
packages/services/src/analytics/rep-performance/
├── index.ts
├── kpi.ts
├── ranking.ts
├── trends.ts
├── recommendations.ts
└── types.ts

apps/web/src/routes/analytics/
└── performance.tsx

tests/e2e/
├── lead-to-meddic.spec.ts
├── won-to-success.spec.ts
└── alert-flow.spec.ts

scripts/
└── performance-test.ts
```

### 更新檔案

```
packages/api/src/routers/analytics.ts    # 新增 Rep Performance 路由
packages/api/src/routers/index.ts        # 註冊新路由
apps/web/src/routes/__root.tsx           # 新增導航連結
```

---

## 執行時程

| 任務 | 預估時間 | 依賴 |
|------|----------|------|
| 6.1 Rep Performance 整合 | 4 小時 | Phase 5 完成 |
| 6.2 跨模組整合測試 | 4 小時 | 6.1 完成 |
| 6.3 效能驗證 | 2 小時 | 6.2 完成 |
| 6.4 文件與驗收 | 2 小時 | 6.3 完成 |

**總計**: 12 小時（1.5 工作日）

---

## 完成標誌

Phase 6 完成時，應達成以下里程碑：

1. ✅ Rep Performance 分析功能上線
2. ✅ 完整銷售流程 E2E 測試通過
3. ✅ 所有效能指標達標
4. ✅ 文件更新完成
5. ✅ 系統驗收通過

---

## 下一步

Phase 6 完成後，V3 系統進入**生產環境監控期**：

- 持續監控效能指標
- 收集用戶回饋
- 規劃後續優化（Phase 7+）
