# 2026-01-31 KV Cache Report 整合實作

**日期**: 2026-01-31
**類型**: 效能優化
**狀態**: ✅ 已完成並部署

---

## 概述

將報告系統的資料查詢從即時 SQL 查詢改為 KV Cache 預計算模式，以提升查詢效能並減少資料庫負載。

### 目標

1. **減少資料庫負載**: Daily/Weekly Report 不再每次執行大量 SQL 查詢
2. **提升回應速度**: KV Cache 讀取比 SQL 查詢快 10-100 倍
3. **統一資料來源**: 所有報告使用相同的預計算資料
4. **保持向後兼容**: KV Cache miss 時自動 fallback 到 SQL

---

## 架構設計

```
┌─────────────────────────────────────────────────────────────────┐
│                    Server (每 15 分鐘)                           │
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │ precomputeReports │ ──▶ │   Cloudflare KV   │                  │
│  │   - SQL 查詢      │     │   Cache Storage   │                  │
│  │   - 資料聚合      │     │                   │                  │
│  └──────────────────┘     └────────┬──────────┘                  │
│                                    │                             │
└────────────────────────────────────┼─────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Queue Worker (定時報告)                       │
│                                                                  │
│  ┌──────────────────────┐     ┌──────────────────┐              │
│  │ handleDailyHealthReport │ ◀── │   讀取 KV Cache   │              │
│  │ handleWeeklyReport      │     │   (優先)         │              │
│  └──────────────────────┘     └────────┬──────────┘              │
│                                        │                         │
│                                        ▼                         │
│                               ┌──────────────────┐              │
│                               │  SQL Fallback    │              │
│                               │  (KV miss 時)    │              │
│                               └──────────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## KV Cache 資料結構

### 1. SystemHealthData

**KV Key**: `report:system-health`
**更新頻率**: 每 15 分鐘
**TTL**: 1 小時

```typescript
interface SystemHealthData {
  generatedAt: string; // ISO timestamp

  processing: {
    last24h: {
      completed: number;
      failed: number;
      inProgress: number;
      avgProcessingTime: number; // seconds
    };
    errorsByCode: Record<string, {
      count: number;
      stage: "audio" | "download" | "transcription" | "analysis" | "database";
      cases: CaseInfo[];
    }>;
    stuckCases: Array<{
      caseNumber: string;
      companyName: string;
      status: string;
      hoursStuck: number;
    }>;
  };

  weeklyComparison: {
    thisWeek: { uploads: number; avgMeddic: number; };
    lastWeek: { uploads: number; avgMeddic: number; };
    change: { uploadsPercent: number; meddicDiff: number; };
  };
}
```

### 2. CloseCaseData

**KV Key**: `report:close-cases`
**更新頻率**: 資料變更時
**TTL**: 24 小時

```typescript
interface CloseCaseData {
  generatedAt: string;

  thisWeek: {
    won: CloseCaseWon[];
    lost: CloseCaseLost[];
    wonCount: number;
    lostCount: number;
    winRate: number; // 0-100
  };

  mtd: {
    wonCount: number;
    lostCount: number;
    winRate: number;
  };
}
```

### 3. AttentionNeededData

**KV Key**: `report:attention-needed`
**更新頻率**: 每 15 分鐘
**TTL**: 1 小時

```typescript
interface AttentionNeededData {
  generatedAt: string;

  // 高分但 > 7 天未跟進的機會
  staleHighScore: StaleHighScoreOpportunity[];

  // 無待辦的進行中機會 (建立 > 7 天)
  noTodos: NoTodoOpportunity[];

  // 本週未上傳的業務
  inactiveReps: InactiveRep[];
}
```

### 4. TodoStatsData

**KV Key**: `report:todo-stats`
**更新頻率**: 每 15 分鐘
**TTL**: 1 小時

```typescript
interface TodoStatsData {
  generatedAt: string;

  overdue: {
    total: number;
    byUser: Record<string, { count: number; userName: string; }>;
  };

  dueToday: {
    total: number;
    byUser: Record<string, TodoInfo[]>;
  };

  pendingFollowUps: FollowUpInfo[];
}
```

### 5. TeamPerformanceExtended

**KV Key**: `report:team:{dept}` (預設為 `report:team:default`)
**更新頻率**: 每 15 分鐘
**TTL**: 1 小時

```typescript
interface TeamPerformanceExtended {
  generatedAt: string;
  weeklyPerformance: WeeklyRepPerformance[];
}

interface WeeklyRepPerformance {
  userId: string;
  userName: string;
  weekUploads: number;
  avgMeddic: number | null;
  weekWon: number;
}
```

---

## 實作檔案

### 新增檔案

| 檔案 | 用途 |
|------|------|
| `packages/services/src/report/types.ts` | KV Cache 資料型別定義 |
| `packages/services/src/report/compute-reports.ts` | 報告預計算邏輯 |
| `packages/services/src/report/precompute.ts` | 預計算主函數 |
| `packages/services/src/report/index.ts` | 模組匯出 |

### 修改檔案

| 檔案 | 變更內容 |
|------|---------|
| `apps/server/src/index.ts` | 新增 `precomputeReports()` 在 scheduled handler |
| `apps/queue-worker/src/index.ts` | 修改報告函數優先讀取 KV Cache |
| `packages/services/src/index.ts` | 匯出 report 模組 |

---

## Server 預計算邏輯

### Cron Schedule

```toml
# wrangler.toml
[triggers]
crons = [
  "*/15 * * * *",  # 每 15 分鐘：報表預計算
  "0 19 * * *",    # 每天 19:00 UTC (03:00 UTC+8)
]
```

### 預計算函數

```typescript
// apps/server/src/index.ts
async function precomputeReports(env: Env, sql: NeonQueryFunction<false, false>) {
  const db = drizzle(sql, { schema });

  // 1. 計算各報告資料
  const [systemHealth, closeCases, attentionNeeded, todoStats, teamPerformance] =
    await Promise.all([
      computeSystemHealth(db, sql),
      computeCloseCases(db),
      computeAttentionNeeded(db),
      computeTodoStats(db),
      computeTeamPerformance(db),
    ]);

  // 2. 寫入 KV Cache
  await Promise.all([
    env.CACHE_KV.put(KV_KEYS.SYSTEM_HEALTH, JSON.stringify(systemHealth), {
      expirationTtl: KV_TTL.SYSTEM_HEALTH,
    }),
    env.CACHE_KV.put(KV_KEYS.CLOSE_CASES, JSON.stringify(closeCases), {
      expirationTtl: KV_TTL.CLOSE_CASES,
    }),
    // ... 其他 KV 寫入
  ]);
}
```

---

## Queue Worker 讀取邏輯

### handleDailyHealthReport

```typescript
async function handleDailyHealthReport(env: Env): Promise<void> {
  // 1. 嘗試從 KV Cache 讀取
  const cached = await env.CACHE_KV.get<SystemHealthData>(
    KV_KEYS.SYSTEM_HEALTH,
    "json"
  );

  let healthData: SystemHealthData;

  if (cached) {
    console.log("[Scheduled] Using cached SystemHealthData");
    healthData = cached;
  } else {
    // 2. Fallback: SQL 查詢
    console.log("[Scheduled] KV cache miss, falling back to SQL");
    const sql = neon(env.DATABASE_URL);
    // ... 執行原有 SQL 查詢邏輯
  }

  // 3. 使用 healthData 產生報告
}
```

### handleWeeklyReport

```typescript
async function handleWeeklyReport(env: Env): Promise<void> {
  // 1. 並行讀取多個 KV Cache
  const [cachedSystemHealth, cachedCloseCases, cachedAttention, cachedTodoStats] =
    await Promise.all([
      env.CACHE_KV.get<SystemHealthData>(KV_KEYS.SYSTEM_HEALTH, "json"),
      env.CACHE_KV.get<CloseCaseData>(KV_KEYS.CLOSE_CASES, "json"),
      env.CACHE_KV.get<AttentionNeededData>(KV_KEYS.ATTENTION_NEEDED, "json"),
      env.CACHE_KV.get<TodoStatsData>(KV_KEYS.TODO_STATS, "json"),
    ]);

  const hasCache = cachedSystemHealth && cachedCloseCases && cachedAttention;
  const sql = hasCache ? null : neon(env.DATABASE_URL);

  if (hasCache) {
    console.log("[Scheduled] Using cached report data for weekly report");
    // 使用 cached 資料
  } else {
    console.log("[Scheduled] KV cache miss, falling back to SQL");
    // Fallback 到 SQL 查詢
  }
}
```

---

## KV Key 常數

```typescript
// packages/services/src/report/types.ts
export const KV_KEYS = {
  SYSTEM_HEALTH: "report:system-health",
  CLOSE_CASES: "report:close-cases",
  ATTENTION_NEEDED: "report:attention-needed",
  TODO_STATS: "report:todo-stats",
  TEAM_PERFORMANCE: (dept: string) => `report:team:${dept}`,
  MTD_UPLOADS: (year: number, month: number) =>
    `report:mtd-uploads:${year}-${String(month).padStart(2, "0")}`,
  REP_REPORT: (userId: string) => `report:rep:${userId}`,
  UPLOAD_RANKING_WEEKLY: "report:upload-ranking:weekly",
  UPLOAD_RANKING_MONTHLY: "report:upload-ranking:monthly",
} as const;

export const KV_TTL = {
  SYSTEM_HEALTH: 3600,    // 1 小時
  CLOSE_CASES: 86_400,    // 24 小時
  ATTENTION_NEEDED: 3600, // 1 小時
  TODO_STATS: 3600,       // 1 小時
  TEAM_PERFORMANCE: 3600, // 1 小時
  MTD_UPLOADS: 86_400,    // 24 小時
  REP_REPORT: 3600,       // 1 小時
} as const;
```

---

## 部署資訊

### 部署時間

2026-01-31 21:42 (UTC+8)

### 部署版本

| 服務 | Version ID |
|------|------------|
| `sales-ai-server` | `4099956a-29d8-4524-ac59-cfbe1e06ac58` |
| `sales-ai-queue-worker` | `fe298599-7db3-48b5-a199-2df7efa24fa1` |

### 健康檢查

- **Staging**: ✅ healthy
- **Production**: ✅ healthy (latency: 44ms)

---

## 效能預期

| 指標 | 改善前 | 改善後 |
|------|--------|--------|
| Daily Report 查詢時間 | ~2-5 秒 | ~50-100ms |
| Weekly Report 查詢時間 | ~5-10 秒 | ~100-200ms |
| 資料庫查詢次數 | 每次報告 10+ 次 | 預計算時 10+ 次，報告時 0 次 |
| CPU 時間消耗 | 高 | 低 |

---

## 監控與除錯

### 檢查 KV Cache 狀態

```bash
# 查看 KV 內容
wrangler kv:key get --namespace-id=066c8705db6f4f39955d7050ac12fe03 "report:system-health"
```

### 日誌關鍵字

- `[Scheduled] Using cached SystemHealthData` - KV 命中
- `[Scheduled] KV cache miss, falling back to SQL` - KV 未命中
- `[Scheduled] Report precomputation completed` - 預計算完成

---

## 未來擴展

1. **Dashboard API 整合**: 前端 Dashboard 可直接讀取 KV Cache
2. **即時更新**: 資料變更時觸發增量更新
3. **多租戶支援**: 按部門/產品線分離 KV Key
4. **歷史資料**: 保留歷史快照供趨勢分析
