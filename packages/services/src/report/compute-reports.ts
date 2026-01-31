/**
 * Report Computation Functions
 * 報告預計算函數
 */

import type { NeonQueryFunction } from "@neondatabase/serverless";

import {
  type AttentionNeededData,
  type CloseCaseData,
  ERROR_STAGE_MAP,
  type MtdUploadsData,
  type SystemHealthData,
  type TodoStatsData,
  type WeeklyRepPerformance,
} from "./types";

// ============================================================
// 1. computeSystemHealth
// ============================================================

export async function computeSystemHealth(
  sql: NeonQueryFunction<false, false>
): Promise<SystemHealthData> {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const oneHourAgo = new Date(now);
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  // 本週開始 (週日)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // 上週開始
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  // 1. 基本統計 (過去 24 小時)
  const stats = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
      COUNT(*) FILTER (WHERE status IN ('pending', 'transcribing', 'analyzing')) as in_progress_count,
      AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) FILTER (WHERE status = 'completed') as avg_processing_time
    FROM conversations
    WHERE created_at >= ${yesterday.toISOString()}
      AND status != 'archived'
  `;

  // 2. 失敗案件詳情 (按錯誤代碼分類)
  const failedCases = await sql`
    SELECT
      c.case_number,
      c.error_details->>'code' as error_code,
      c.error_message,
      o.company_name
    FROM conversations c
    LEFT JOIN opportunities o ON c.opportunity_id = o.id
    WHERE c.created_at >= ${yesterday.toISOString()}
      AND c.status = 'failed'
    ORDER BY c.created_at DESC
  `;

  // 3. 卡住的案件
  const stuckCases = await sql`
    SELECT
      c.case_number,
      c.status,
      o.company_name,
      EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 3600 as hours_stuck
    FROM conversations c
    LEFT JOIN opportunities o ON c.opportunity_id = o.id
    WHERE c.created_at < ${oneHourAgo.toISOString()}
      AND c.status IN ('pending', 'transcribing', 'analyzing')
    ORDER BY c.created_at ASC
    LIMIT 20
  `;

  // 4. 週比較統計
  const weeklyStats = await sql`
    SELECT
      COUNT(*) FILTER (WHERE c.created_at >= ${weekStart.toISOString()} AND c.status = 'completed') as this_week_uploads,
      COUNT(*) FILTER (WHERE c.created_at >= ${lastWeekStart.toISOString()} AND c.created_at < ${weekStart.toISOString()} AND c.status = 'completed') as last_week_uploads,
      AVG(m.overall_score) FILTER (WHERE c.created_at >= ${weekStart.toISOString()}) as this_week_avg_meddic,
      AVG(m.overall_score) FILTER (WHERE c.created_at >= ${lastWeekStart.toISOString()} AND c.created_at < ${weekStart.toISOString()}) as last_week_avg_meddic
    FROM conversations c
    LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
    WHERE c.created_at >= ${lastWeekStart.toISOString()}
      AND c.status NOT IN ('archived', 'failed')
  `;

  // 組裝結果
  const result = stats[0] || {};
  const weeklyResult = weeklyStats[0] || {};

  const thisWeekUploads = Number(weeklyResult.this_week_uploads) || 0;
  const lastWeekUploads = Number(weeklyResult.last_week_uploads) || 0;
  const thisWeekMeddic = Number(weeklyResult.this_week_avg_meddic) || 0;
  const lastWeekMeddic = Number(weeklyResult.last_week_avg_meddic) || 0;

  const uploadsPercent =
    lastWeekUploads > 0
      ? Math.round(
          ((thisWeekUploads - lastWeekUploads) / lastWeekUploads) * 100
        )
      : 0;

  // 按錯誤代碼分組
  const errorsByCode: SystemHealthData["processing"]["errorsByCode"] = {};
  for (const c of failedCases as any[]) {
    const code = c.error_code || "UNKNOWN_ERROR";
    if (!errorsByCode[code]) {
      errorsByCode[code] = {
        count: 0,
        stage: ERROR_STAGE_MAP[code] || "database",
        cases: [],
      };
    }
    errorsByCode[code].count++;
    if (errorsByCode[code].cases.length < 5) {
      errorsByCode[code].cases.push({
        caseNumber: c.case_number || "N/A",
        companyName: c.company_name || "未知",
        errorMessage: c.error_message,
      });
    }
  }

  return {
    generatedAt: now.toISOString(),
    processing: {
      last24h: {
        completed: Number(result.completed_count) || 0,
        failed: Number(result.failed_count) || 0,
        inProgress: Number(result.in_progress_count) || 0,
        avgProcessingTime: Math.round(Number(result.avg_processing_time) || 0),
      },
      errorsByCode,
      stuckCases: (stuckCases as any[]).map((c) => ({
        caseNumber: c.case_number || "N/A",
        companyName: c.company_name || "未知",
        status: c.status,
        hoursStuck: Number(c.hours_stuck) || 0,
      })),
    },
    weeklyComparison: {
      thisWeek: {
        uploads: thisWeekUploads,
        avgMeddic: Math.round(thisWeekMeddic),
      },
      lastWeek: {
        uploads: lastWeekUploads,
        avgMeddic: Math.round(lastWeekMeddic),
      },
      change: {
        uploadsPercent,
        meddicDiff: Math.round(thisWeekMeddic - lastWeekMeddic),
      },
    },
  };
}

// ============================================================
// 2. computeCloseCases
// ============================================================

export async function computeCloseCases(
  sql: NeonQueryFunction<false, false>
): Promise<CloseCaseData> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // MTD 開始日期
  const mtdStart = new Date(year, month, 1);

  // 本週開始 (週日)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // 本週 Close Case 詳情
  const closedCasesThisWeek = await sql`
    SELECT
      o.customer_number,
      o.company_name,
      o.status,
      o.rejection_reason,
      o.selected_competitor,
      o.won_at,
      o.lost_at,
      u.name as user_name
    FROM opportunities o
    JOIN "user" u ON o.user_id = u.id
    WHERE (o.won_at >= ${weekStart.toISOString()} OR o.lost_at >= ${weekStart.toISOString()})
    ORDER BY COALESCE(o.won_at, o.lost_at) DESC
    LIMIT 20
  `;

  // MTD 統計
  const mtdStats = await sql`
    SELECT
      COUNT(*) FILTER (WHERE o.won_at >= ${mtdStart.toISOString()}) as mtd_won,
      COUNT(*) FILTER (WHERE o.lost_at >= ${mtdStart.toISOString()}) as mtd_lost
    FROM opportunities o
    WHERE (o.won_at >= ${mtdStart.toISOString()} OR o.lost_at >= ${mtdStart.toISOString()})
  `;

  const wonCases = (closedCasesThisWeek as any[]).filter(
    (c) => c.status === "won"
  );
  const lostCases = (closedCasesThisWeek as any[]).filter(
    (c) => c.status === "lost"
  );

  const thisWeekWon = wonCases.length;
  const thisWeekLost = lostCases.length;
  const thisWeekWinRate =
    thisWeekWon + thisWeekLost > 0
      ? Math.round((thisWeekWon / (thisWeekWon + thisWeekLost)) * 100)
      : 0;

  const mtdResult = mtdStats[0] || {};
  const mtdWon = Number(mtdResult.mtd_won) || 0;
  const mtdLost = Number(mtdResult.mtd_lost) || 0;
  const mtdWinRate =
    mtdWon + mtdLost > 0 ? Math.round((mtdWon / (mtdWon + mtdLost)) * 100) : 0;

  return {
    generatedAt: now.toISOString(),
    thisWeek: {
      won: wonCases.map((c) => ({
        customerNumber: c.customer_number,
        companyName: c.company_name,
        userName: c.user_name,
        wonAt: c.won_at,
      })),
      lost: lostCases.map((c) => ({
        customerNumber: c.customer_number,
        companyName: c.company_name,
        userName: c.user_name,
        lostAt: c.lost_at,
        rejectionReason: c.rejection_reason,
        selectedCompetitor: c.selected_competitor,
      })),
      wonCount: thisWeekWon,
      lostCount: thisWeekLost,
      winRate: thisWeekWinRate,
    },
    mtd: {
      wonCount: mtdWon,
      lostCount: mtdLost,
      winRate: mtdWinRate,
    },
  };
}

// ============================================================
// 3. computeAttentionNeeded
// ============================================================

export async function computeAttentionNeeded(
  sql: NeonQueryFunction<false, false>
): Promise<AttentionNeededData> {
  const now = new Date();

  // 7 天前
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // 本週開始 (週日)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // 1. 高分但超過 7 天未跟進的機會
  const staleHighScoreOpps = await sql`
    SELECT
      o.customer_number,
      o.company_name,
      m.overall_score,
      u.name as user_name,
      EXTRACT(DAY FROM NOW() - o.last_contacted_at) as days_since_contact
    FROM opportunities o
    JOIN "user" u ON o.user_id = u.id
    JOIN meddic_analyses m ON m.opportunity_id = o.id
    WHERE o.status NOT IN ('won', 'lost')
      AND m.overall_score >= 70
      AND (o.last_contacted_at IS NULL OR o.last_contacted_at < ${sevenDaysAgo.toISOString()})
    ORDER BY m.overall_score DESC
    LIMIT 10
  `;

  // 2. 未成交/未拒絕且無待辦的機會
  const oppsWithoutTodos = await sql`
    SELECT
      o.customer_number,
      o.company_name,
      u.name as user_name,
      EXTRACT(DAY FROM NOW() - o.created_at) as days_since_created
    FROM opportunities o
    JOIN "user" u ON o.user_id = u.id
    WHERE o.status NOT IN ('won', 'lost')
      AND NOT EXISTS (
        SELECT 1 FROM sales_todos st
        WHERE st.opportunity_id = o.id
          AND st.status = 'pending'
      )
      AND o.created_at < ${sevenDaysAgo.toISOString()}
    ORDER BY o.created_at ASC
    LIMIT 10
  `;

  // 3. 本週未上傳的業務
  const inactiveReps = await sql`
    SELECT u.id as user_id, u.name as user_name
    FROM "user" u
    WHERE EXISTS (
      SELECT 1 FROM conversations c WHERE c.created_by = u.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM conversations c2
      WHERE c2.created_by = u.id
        AND c2.created_at >= ${weekStart.toISOString()}
        AND c2.status NOT IN ('archived', 'failed')
    )
  `;

  return {
    generatedAt: now.toISOString(),
    staleHighScore: (staleHighScoreOpps as any[]).map((o) => ({
      customerNumber: o.customer_number,
      companyName: o.company_name,
      userName: o.user_name,
      meddicScore: Number(o.overall_score) || 0,
      daysSinceContact: Math.round(Number(o.days_since_contact) || 0),
    })),
    noTodos: (oppsWithoutTodos as any[]).map((o) => ({
      customerNumber: o.customer_number,
      companyName: o.company_name,
      userName: o.user_name,
      daysSinceCreated: Math.round(Number(o.days_since_created) || 0),
    })),
    inactiveReps: (inactiveReps as any[]).map((r) => ({
      userId: r.user_id,
      userName: r.user_name,
    })),
  };
}

// ============================================================
// 4. computeTodoStats
// ============================================================

export async function computeTodoStats(
  sql: NeonQueryFunction<false, false>
): Promise<TodoStatsData> {
  const now = new Date();

  // 今日開始
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // 今日結束
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // 1. 逾期待辦統計 (按業務)
  const overdueTodos = await sql`
    SELECT
      u.id as user_id,
      u.name as user_name,
      COUNT(*) as overdue_count
    FROM sales_todos st
    JOIN "user" u ON st.user_id = u.id
    WHERE st.status = 'pending'
      AND st.due_date < ${now.toISOString()}
    GROUP BY u.id, u.name
    ORDER BY overdue_count DESC
  `;

  // 2. 今日待辦詳情
  const todayTodos = await sql`
    SELECT
      st.id,
      st.user_id,
      st.title,
      st.due_date,
      st.opportunity_id,
      o.company_name,
      o.customer_number,
      u.name as user_name
    FROM sales_todos st
    JOIN "user" u ON st.user_id = u.id
    LEFT JOIN opportunities o ON st.opportunity_id = o.id
    WHERE st.status = 'pending'
      AND st.due_date >= ${todayStart.toISOString()}
      AND st.due_date <= ${todayEnd.toISOString()}
    ORDER BY st.due_date ASC
  `;

  // 3. 待跟進 (今日)
  const pendingFollowUps = await sql`
    SELECT
      f.id,
      f.opportunity_id,
      f.user_id,
      f.scheduled_date,
      f.purpose,
      o.company_name,
      o.customer_number,
      u.name as user_name,
      up.slack_user_id
    FROM follow_ups f
    JOIN "user" u ON f.user_id = u.id
    JOIN opportunities o ON f.opportunity_id = o.id
    LEFT JOIN user_profiles up ON f.user_id = up.user_id
    WHERE f.status = 'pending'
      AND f.scheduled_date >= ${todayStart.toISOString()}
      AND f.scheduled_date <= ${todayEnd.toISOString()}
    ORDER BY f.scheduled_date ASC
  `;

  // 組裝逾期待辦
  const overdueByUser: TodoStatsData["overdue"]["byUser"] = {};
  let overdueTotal = 0;
  for (const t of overdueTodos as any[]) {
    overdueByUser[t.user_id] = {
      count: Number(t.overdue_count),
      userName: t.user_name,
    };
    overdueTotal += Number(t.overdue_count);
  }

  // 組裝今日待辦
  const dueTodayByUser: TodoStatsData["dueToday"]["byUser"] = {};
  for (const t of todayTodos as any[]) {
    if (!dueTodayByUser[t.user_id]) {
      dueTodayByUser[t.user_id] = [];
    }
    dueTodayByUser[t.user_id]!.push({
      id: t.id,
      title: t.title,
      dueDate: t.due_date,
      opportunityId: t.opportunity_id,
      companyName: t.company_name,
      customerNumber: t.customer_number,
    });
  }

  return {
    generatedAt: now.toISOString(),
    overdue: {
      total: overdueTotal,
      byUser: overdueByUser,
    },
    dueToday: {
      total: (todayTodos as any[]).length,
      byUser: dueTodayByUser,
    },
    pendingFollowUps: (pendingFollowUps as any[]).map((f) => ({
      id: f.id,
      opportunityId: f.opportunity_id,
      companyName: f.company_name,
      customerNumber: f.customer_number,
      userId: f.user_id,
      userName: f.user_name,
      slackUserId: f.slack_user_id,
      scheduledDate: f.scheduled_date,
      purpose: f.purpose,
    })),
  };
}

// ============================================================
// 5. computeWeeklyTeamPerformance
// ============================================================

export async function computeWeeklyTeamPerformance(
  sql: NeonQueryFunction<false, false>
): Promise<WeeklyRepPerformance[]> {
  const now = new Date();

  // 本週開始 (週日)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const repPerformance = await sql`
    SELECT
      u.id as user_id,
      u.name as user_name,
      COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= ${weekStart.toISOString()} AND c.status = 'completed') as week_uploads,
      ROUND(AVG(m.overall_score) FILTER (WHERE c.created_at >= ${weekStart.toISOString()})) as avg_meddic,
      COUNT(DISTINCT o2.id) FILTER (WHERE o2.won_at >= ${weekStart.toISOString()}) as week_won
    FROM "user" u
    LEFT JOIN conversations c ON c.created_by = u.id AND c.status NOT IN ('archived', 'failed')
    LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
    LEFT JOIN opportunities o2 ON o2.user_id = u.id
    WHERE EXISTS (
      SELECT 1 FROM conversations c2 WHERE c2.created_by = u.id
    )
    GROUP BY u.id, u.name
    ORDER BY week_uploads DESC, avg_meddic DESC NULLS LAST
  `;

  return (repPerformance as any[]).map((r) => ({
    userId: r.user_id,
    userName: r.user_name,
    weekUploads: Number(r.week_uploads) || 0,
    avgMeddic: r.avg_meddic ? Number(r.avg_meddic) : null,
    weekWon: Number(r.week_won) || 0,
  }));
}

// ============================================================
// 6. computeMtdUploads
// ============================================================

export async function computeMtdUploads(
  sql: NeonQueryFunction<false, false>,
  year: number,
  month: number
): Promise<MtdUploadsData> {
  const now = new Date();

  // MTD 開始日期
  const mtdStart = new Date(year, month - 1, 1);
  const mtdEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const uploads = await sql`
    SELECT
      c.id,
      c.case_number,
      c.status,
      c.created_at,
      c.created_by as user_id,
      o.customer_number,
      o.company_name,
      u.name as user_name,
      m.overall_score as meddic_score
    FROM conversations c
    JOIN "user" u ON c.created_by = u.id
    LEFT JOIN opportunities o ON c.opportunity_id = o.id
    LEFT JOIN meddic_analyses m ON c.id = m.conversation_id
    WHERE c.created_at >= ${mtdStart.toISOString()}
      AND c.created_at <= ${mtdEnd.toISOString()}
      AND c.status NOT IN ('archived')
    ORDER BY c.created_at DESC
  `;

  // 計算摘要
  const byUser: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const u of uploads as any[]) {
    byUser[u.user_id] = (byUser[u.user_id] || 0) + 1;
    byStatus[u.status] = (byStatus[u.status] || 0) + 1;
  }

  return {
    generatedAt: now.toISOString(),
    year,
    month,
    uploads: (uploads as any[]).map((u) => ({
      id: u.id,
      caseNumber: u.case_number,
      customerNumber: u.customer_number || "",
      companyName: u.company_name || "未知",
      userName: u.user_name,
      userId: u.user_id,
      status: u.status,
      createdAt: u.created_at,
      meddicScore: u.meddic_score ? Number(u.meddic_score) : undefined,
    })),
    summary: {
      total: (uploads as any[]).length,
      byUser,
      byStatus,
    },
  };
}
