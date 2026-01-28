/**
 * 報告頁面
 * 顯示業務個人報告和經理團隊報告
 * Precision Dashboard Design System v2
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  Calendar,
  Medal,
  MessageSquare,
  Minus,
  Target,
  TrendingUp,
  Trophy,
  UserCircle,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ProgressBar } from "@/components/dashboard/progress-bar";
import type { RankingItem } from "@/components/dashboard/ranking-list";
import { RankingList } from "@/components/dashboard/ranking-list";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TermTooltip } from "@/components/ui/term-tooltip";
import { getDisplayNameByEmail } from "@/lib/consultant-names";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/reports/")({
  component: ReportsPage,
});

// Trend icon component
function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") {
    return <ArrowUp className="h-4 w-4 text-emerald-400" />;
  }
  if (trend === "down") {
    return <ArrowDown className="h-4 w-4 text-rose-400" />;
  }
  return <Minus className="h-4 w-4 text-slate-400" />;
}

// Score change badge
function ScoreChangeBadge({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/15 px-2 py-0.5 font-data font-semibold text-emerald-400 text-xs ring-1 ring-emerald-500/30">
        <ArrowUp className="h-3 w-3" />+{change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-500/15 px-2 py-0.5 font-data font-semibold text-rose-400 text-xs ring-1 ring-rose-500/30">
        <ArrowDown className="h-3 w-3" />
        {change}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-500/15 px-2 py-0.5 font-data font-semibold text-slate-400 text-xs ring-1 ring-slate-500/30">
      <Minus className="h-3 w-3" />0
    </span>
  );
}

// PDCM 維度權重
const PDCM_WEIGHTS = {
  pain: 35,
  decision: 25,
  champion: 25,
  metrics: 15,
};

// SPIN 階段權重
const SPIN_WEIGHTS = {
  situation: 15,
  problem: 25,
  implication: 40,
  needPayoff: 20,
};

// PDCM 維度標籤
const PDCM_LABELS: Record<string, { label: string; termKey: string }> = {
  pain: { label: "痛點 (Pain)", termKey: "pain" },
  decision: { label: "決策 (Decision)", termKey: "decision" },
  champion: { label: "支持度 (Champion)", termKey: "champion" },
  metrics: { label: "量化 (Metrics)", termKey: "metrics" },
};

// SPIN 階段標籤
const SPIN_LABELS: Record<string, { label: string; termKey: string }> = {
  situation: { label: "情境 (Situation)", termKey: "spinSituation" },
  problem: { label: "問題 (Problem)", termKey: "spinProblem" },
  implication: { label: "暗示 (Implication)", termKey: "spinImplication" },
  needPayoff: { label: "需求回報 (Need-payoff)", termKey: "spinNeedPayoff" },
};

// SPIN 階段顏色
const SPIN_COLORS: Record<string, "sky" | "violet" | "amber" | "emerald"> = {
  situation: "sky",
  problem: "violet",
  implication: "amber",
  needPayoff: "emerald",
};

// Analytics Card Component
function AnalyticsCard({
  title,
  description,
  icon: Icon,
  children,
  delay = 0,
}: {
  title: React.ReactNode;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <Card
      className="animate-fade-in-up opacity-0 transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/5"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <CardHeader className="border-border/50 border-b pb-4">
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10">
            <Icon className="h-4 w-4 text-teal-400" />
          </div>
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="font-data text-xs">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

// Rep Performance Report Component
function RepPerformanceReport() {
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();

  // 獲取可查看的用戶列表（經理/admin 才會有）
  const viewableUsersQuery = useQuery({
    queryKey: ["team", "viewableUsers"],
    queryFn: () => client.team.getViewableUsers(),
  });

  const reportQuery = useQuery({
    queryKey: ["analytics", "repPerformance", { userId: selectedUserId }],
    queryFn: async () => {
      return await client.analytics.repPerformance({
        userId: selectedUserId,
      });
    },
  });

  const report = reportQuery.data;
  const isLoading = reportQuery.isLoading;
  const canSelectUser = viewableUsersQuery.data?.canSelectUser ?? false;
  const viewableUsers = viewableUsersQuery.data?.users ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (reportQuery.error || !report) {
    return (
      <div className="py-12 text-center">
        <p className="text-rose-400">無法載入報告資料</p>
        {reportQuery.error && (
          <p className="mt-2 font-data text-muted-foreground text-sm">
            錯誤：{reportQuery.error.message}
          </p>
        )}
      </div>
    );
  }

  // 檢查是否有新版 Cache 資料（pdcmAnalysis 和 spinAnalysis）
  const hasCachedData = "pdcmAnalysis" in report && report.pdcmAnalysis;
  const hasSpinData = "spinAnalysis" in report && report.spinAnalysis;

  // 計算 PDCM 平均分數（從新版或舊版資料）
  const avgPdcmScore = hasCachedData
    ? ((report as any).summary?.averagePdcmScore ?? report.summary.averageScore)
    : report.summary.averageScore;

  // 計算進步分數（新版才有）
  const avgProgressScore =
    hasCachedData && (report as any).summary?.averageProgressScore
      ? (report as any).summary.averageProgressScore
      : null;

  // 本月上傳數（新版才有）
  const uploadCountThisMonth =
    hasCachedData && (report as any).summary?.uploadCountThisMonth
      ? (report as any).summary.uploadCountThisMonth
      : null;

  return (
    <div className="space-y-6">
      {/* 用戶選擇器（僅經理/admin 可見） */}
      {canSelectUser && (
        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-4">
          <span className="font-data text-muted-foreground text-sm">
            查看報告：
          </span>
          <Select
            onValueChange={(v) => setSelectedUserId(v || undefined)}
            value={selectedUserId || ""}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="自己" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">自己</SelectItem>
              {viewableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {getDisplayNameByEmail(u.email, u.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <StatCard
          accentColor="teal"
          delay={0}
          description="所有機會"
          icon={Building2}
          title={
            <TermTooltip termKey="totalOpportunities">機會總數</TermTooltip>
          }
          value={report.summary.totalOpportunities}
        />
        <StatCard
          accentColor="purple"
          delay={100}
          description="所有對話"
          icon={MessageSquare}
          title={<TermTooltip termKey="totalConversations">對話數</TermTooltip>}
          value={report.summary.totalConversations}
        />
        <StatCard
          accentColor="sky"
          delay={200}
          description="已完成分析"
          icon={BarChart3}
          title={<TermTooltip termKey="totalAnalyses">分析數</TermTooltip>}
          value={report.summary.totalAnalyses}
        />
        <StatCard
          accentColor="emerald"
          change={report.summary.scoreChange}
          delay={300}
          description="PDCM 平均"
          icon={TrendingUp}
          title={<TermTooltip termKey="avgPdcmScore">PDCM 分數</TermTooltip>}
          value={avgPdcmScore}
        />
        {avgProgressScore !== null && (
          <StatCard
            accentColor="amber"
            delay={400}
            description="成交推進力"
            icon={Target}
            title={<TermTooltip termKey="progressScore">推進力</TermTooltip>}
            value={avgProgressScore}
          />
        )}
        {uploadCountThisMonth !== null ? (
          <StatCard
            accentColor="rose"
            delay={500}
            description="本月上傳音檔"
            icon={MessageSquare}
            title="本月上傳"
            value={uploadCountThisMonth}
          />
        ) : (
          <StatCard
            accentColor="amber"
            delay={500}
            description="在團隊中的排名"
            icon={Trophy}
            title={
              <TermTooltip termKey="teamPerformance">團隊百分位</TermTooltip>
            }
            value={`${report.teamComparison.overallPercentile}%`}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* PDCM 四維度分析 */}
        <AnalyticsCard
          delay={400}
          description="Pain 35% · Decision 25% · Champion 25% · Metrics 15%"
          icon={Target}
          title={<TermTooltip termKey="pdcmScore">PDCM 四維度分析</TermTooltip>}
        >
          <div className="space-y-5">
            {hasCachedData
              ? Object.entries((report as any).pdcmAnalysis || {}).map(
                  ([key, dim]: [string, any]) => {
                    const labelInfo = PDCM_LABELS[key];
                    if (!labelInfo) {
                      return null;
                    }
                    return (
                      <div className="space-y-2" key={key}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TermTooltip termKey={labelInfo.termKey}>
                              <span className="font-data text-sm">
                                {labelInfo.label}
                              </span>
                            </TermTooltip>
                            <Badge
                              className="font-data text-xs"
                              variant="outline"
                            >
                              權重{" "}
                              {PDCM_WEIGHTS[key as keyof typeof PDCM_WEIGHTS]}%
                            </Badge>
                            <TrendIcon trend={dim.trend} />
                          </div>
                          <span className="font-data font-semibold text-sm text-teal-400">
                            {dim.score.toFixed(0)}/100
                          </span>
                        </div>
                        <ProgressBar animated value={dim.score} />
                      </div>
                    );
                  }
                )
              : // 舊版：從 dimensionAnalysis 讀取
                ["pain", "decision", "champion", "metrics"].map((key) => {
                  const labelInfo = PDCM_LABELS[key];
                  const dimKey =
                    key === "pain"
                      ? "identifyPain"
                      : key === "decision"
                        ? "decisionProcess"
                        : key;
                  const dim = (report.dimensionAnalysis as any)?.[dimKey];
                  if (!dim) {
                    return null;
                  }
                  return (
                    <div className="space-y-2" key={key}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TermTooltip termKey={labelInfo.termKey}>
                            <span className="font-data text-sm">
                              {labelInfo.label}
                            </span>
                          </TermTooltip>
                          <TrendIcon trend={dim.trend ?? "stable"} />
                        </div>
                        <span className="font-data font-semibold text-sm">
                          {dim.score?.toFixed(1)}/5
                        </span>
                      </div>
                      <ProgressBar animated max={5} value={dim.score ?? 0} />
                      {dim.gap && (
                        <p className="font-data text-muted-foreground text-xs">
                          {dim.gap}
                        </p>
                      )}
                    </div>
                  );
                })}
          </div>
        </AnalyticsCard>

        {/* SPIN 四階段分析（僅新版有） */}
        {hasSpinData ? (
          <AnalyticsCard
            delay={500}
            description="Situation 15% · Problem 25% · Implication 40% · Need-payoff 20%"
            icon={BarChart3}
            title={
              <TermTooltip termKey="spinAnalysis">SPIN 銷售階段</TermTooltip>
            }
          >
            <div className="space-y-5">
              {Object.entries((report as any).spinAnalysis || {})
                .filter(([key]) => key !== "averageCompletionRate")
                .map(([key, dim]: [string, any]) => {
                  const labelInfo = SPIN_LABELS[key];
                  if (!labelInfo) {
                    return null;
                  }
                  return (
                    <div className="space-y-2" key={key}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TermTooltip termKey={labelInfo.termKey}>
                            <span className="font-data text-sm">
                              {labelInfo.label}
                            </span>
                          </TermTooltip>
                          <Badge
                            className="font-data text-xs"
                            variant="outline"
                          >
                            權重{" "}
                            {SPIN_WEIGHTS[key as keyof typeof SPIN_WEIGHTS]}%
                          </Badge>
                        </div>
                        <span className="font-data font-semibold text-sm text-teal-400">
                          {dim.score.toFixed(0)}/100
                        </span>
                      </div>
                      <ProgressBar
                        animated
                        color={SPIN_COLORS[key]}
                        value={dim.score}
                      />
                    </div>
                  );
                })}
              {(report as any).spinAnalysis?.averageCompletionRate !==
                undefined && (
                <div className="mt-4 rounded-lg border border-border/50 bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-data font-medium text-sm">
                      SPIN 完成率
                    </span>
                    <span className="font-bold font-data text-teal-400 text-xl">
                      {(
                        (report as any).spinAnalysis.averageCompletionRate * 100
                      ).toFixed(0)}
                      %
                    </span>
                  </div>
                </div>
              )}
            </div>
          </AnalyticsCard>
        ) : (
          // 舊版：強項與弱項
          <AnalyticsCard
            delay={500}
            description="基於 PDCM 分數自動識別"
            icon={Medal}
            title="強項與弱項"
          >
            <div className="space-y-6">
              <div>
                <h4 className="mb-3 flex items-center gap-2 font-data font-semibold text-emerald-400 text-sm">
                  <ArrowUp className="h-4 w-4" />
                  強項 (≥4 分)
                </h4>
                {report.strengths.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {report.strengths.map((s) => (
                      <span
                        className="inline-flex rounded-md bg-emerald-500/15 px-3 py-1 font-data font-semibold text-emerald-400 text-xs ring-1 ring-emerald-500/30"
                        key={s}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="font-data text-muted-foreground text-sm">
                    尚無強項維度
                  </p>
                )}
              </div>
              <div>
                <h4 className="mb-3 flex items-center gap-2 font-data font-semibold text-rose-400 text-sm">
                  <ArrowDown className="h-4 w-4" />
                  弱項 (≤2 分)
                </h4>
                {report.weaknesses.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {report.weaknesses.map((w) => (
                      <span
                        className="inline-flex rounded-md bg-rose-500/15 px-3 py-1 font-data font-semibold text-rose-400 text-xs ring-1 ring-rose-500/30"
                        key={w}
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="font-data text-muted-foreground text-sm">
                    無弱項維度，繼續保持！
                  </p>
                )}
              </div>
            </div>
          </AnalyticsCard>
        )}
      </div>

      {/* 強項與弱項（新版也顯示） */}
      {hasSpinData &&
        (report.strengths.length > 0 || report.weaknesses.length > 0) && (
          <AnalyticsCard
            delay={600}
            description="基於 PDCM 分數自動識別"
            icon={Medal}
            title="強項與弱項"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-3 flex items-center gap-2 font-data font-semibold text-emerald-400 text-sm">
                  <ArrowUp className="h-4 w-4" />
                  強項
                </h4>
                {report.strengths.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {report.strengths.map((s) => (
                      <span
                        className="inline-flex rounded-md bg-emerald-500/15 px-3 py-1 font-data font-semibold text-emerald-400 text-xs ring-1 ring-emerald-500/30"
                        key={s}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="font-data text-muted-foreground text-sm">
                    尚無強項維度
                  </p>
                )}
              </div>
              <div>
                <h4 className="mb-3 flex items-center gap-2 font-data font-semibold text-rose-400 text-sm">
                  <ArrowDown className="h-4 w-4" />
                  弱項
                </h4>
                {report.weaknesses.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {report.weaknesses.map((w) => (
                      <span
                        className="inline-flex rounded-md bg-rose-500/15 px-3 py-1 font-data font-semibold text-rose-400 text-xs ring-1 ring-rose-500/30"
                        key={w}
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="font-data text-muted-foreground text-sm">
                    無弱項維度，繼續保持！
                  </p>
                )}
              </div>
            </div>
          </AnalyticsCard>
        )}

      {/* Coaching Insights */}
      <AnalyticsCard
        delay={700}
        description="基於 AI 分析的改善建議"
        icon={UserCircle}
        title="個人化教練建議"
      >
        <div className="space-y-6">
          {/* Recurring Patterns */}
          {report.coachingInsights.recurringPatterns.length > 0 && (
            <div>
              <h4 className="mb-3 font-data font-medium text-sm">
                重複出現的問題
              </h4>
              <div className="flex flex-wrap gap-2">
                {report.coachingInsights.recurringPatterns.map((p) => (
                  <Badge className="font-data" key={p} variant="outline">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Improvement Plan */}
          {report.coachingInsights.improvementPlan.length > 0 && (
            <div>
              <h4 className="mb-3 font-data font-medium text-sm">改善計畫</h4>
              <ul className="list-inside list-disc space-y-2 font-data text-muted-foreground text-sm">
                {report.coachingInsights.improvementPlan.map((plan, i) => (
                  <li key={i}>{plan}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent Feedback */}
          {report.coachingInsights.recentFeedback.length > 0 && (
            <div>
              <h4 className="mb-3 font-data font-medium text-sm">
                最近的教練回饋
              </h4>
              <div className="space-y-2">
                {report.coachingInsights.recentFeedback
                  .slice(0, 3)
                  .map((feedback, i) => (
                    <p
                      className="rounded-lg border border-border/50 bg-muted/30 p-3 font-data text-sm"
                      key={i}
                    >
                      {feedback}
                    </p>
                  ))}
              </div>
            </div>
          )}

          {/* 如果沒有任何建議 */}
          {report.coachingInsights.recurringPatterns.length === 0 &&
            report.coachingInsights.improvementPlan.length === 0 &&
            report.coachingInsights.recentFeedback.length === 0 && (
              <p className="font-data text-muted-foreground text-sm">
                目前沒有教練建議，請持續上傳音檔以獲得更多分析。
              </p>
            )}
        </div>
      </AnalyticsCard>

      {/* Progress Tracking */}
      <AnalyticsCard
        delay={800}
        description="不同時間區間的表現變化"
        icon={Calendar}
        title="進步追蹤"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
            <h4 className="font-data font-medium text-sm">最近 30 天</h4>
            <div className="mt-2 flex items-center gap-3">
              <span className="font-bold font-data text-3xl">
                {(report.progressTracking.last30Days as any).avgPdcmScore ??
                  report.progressTracking.last30Days.avgScore}
              </span>
              <ScoreChangeBadge
                change={report.progressTracking.last30Days.change}
              />
            </div>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
            <h4 className="font-data font-medium text-sm">最近 90 天</h4>
            <div className="mt-2 flex items-center gap-3">
              <span className="font-bold font-data text-3xl">
                {(report.progressTracking.last90Days as any).avgPdcmScore ??
                  report.progressTracking.last90Days.avgScore}
              </span>
              <ScoreChangeBadge
                change={report.progressTracking.last90Days.change}
              />
            </div>
          </div>
        </div>

        {/* Milestones */}
        {report.progressTracking.milestones &&
          report.progressTracking.milestones.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-3 font-data font-medium text-sm">達成里程碑</h4>
              <div className="space-y-2">
                {report.progressTracking.milestones.map((m, i) => (
                  <div
                    className="flex items-center gap-3 rounded-lg bg-emerald-500/10 p-3 ring-1 ring-emerald-500/30"
                    key={i}
                  >
                    <Trophy className="h-4 w-4 text-emerald-400" />
                    <span className="font-data text-emerald-400 text-sm">
                      {m.achievement}
                    </span>
                    <span className="font-data text-muted-foreground text-xs">
                      ({m.date})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </AnalyticsCard>
    </div>
  );
}

// Upload Ranking Icon
function UploadRankingIcon({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Trophy className="h-4 w-4 text-yellow-400" />;
  }
  if (rank === 2) {
    return <Medal className="h-4 w-4 text-gray-400" />;
  }
  if (rank === 3) {
    return <Medal className="h-4 w-4 text-orange-400" />;
  }
  return null;
}

// Team Performance Report Component
function TeamPerformanceReport() {
  const [department, setDepartment] = useState<"all" | "beauty" | "ichef">(
    "all"
  );
  const [uploadRankingPeriod, setUploadRankingPeriod] = useState<
    "weekly" | "monthly"
  >("monthly");

  const reportQuery = useQuery({
    queryKey: ["analytics", "teamPerformance", { department }],
    queryFn: async () => {
      return await client.analytics.teamPerformance({ department });
    },
  });

  const report = reportQuery.data;
  const isLoading = reportQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        無法載入報告資料（需要經理權限）
      </div>
    );
  }

  if (report.teamSummary.teamSize === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>您目前沒有管理任何團隊成員</p>
        <p className="font-data text-sm">請聯繫管理員設定團隊關係</p>
      </div>
    );
  }

  // 檢查是否有新版 Cache 資料
  const cachedData = (report as any).cachedData;
  const hasCachedData = !!cachedData;

  // 上傳排名資料
  const uploadRankings = hasCachedData
    ? uploadRankingPeriod === "weekly"
      ? cachedData.uploadRankingsWeekly || []
      : cachedData.uploadRankingsMonthly || []
    : [];

  // 轉換為 RankingItem 格式
  const memberRankingItems: RankingItem[] = (
    cachedData?.memberRankings || report.memberRankings
  ).map((member: any) => ({
    id: member.userId,
    name: member.name,
    value: member.averagePdcmScore ?? member.averageScore,
    subtext:
      member.uploadCountThisMonth !== undefined
        ? `本月上傳 ${member.uploadCountThisMonth} 件`
        : `${member.opportunityCount} 機會 · ${member.conversationCount} 對話`,
    trend: member.trend,
    needsAttention: (member.averagePdcmScore ?? member.averageScore) < 50,
  }));

  const uploadRankingItems: RankingItem[] = uploadRankings.map(
    (member: any) => ({
      id: member.userId,
      name: member.name,
      value: member.uploadCount,
      trend: undefined,
    })
  );

  return (
    <div className="space-y-6">
      {/* 部門篩選器 */}
      <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-4">
        <span className="font-data text-muted-foreground text-sm">
          篩選部門：
        </span>
        <Select
          onValueChange={(v) => setDepartment(v as "all" | "beauty" | "ichef")}
          value={department}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="全部" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="beauty">Beauty</SelectItem>
            <SelectItem value="ichef">iCHEF</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Team Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          accentColor="teal"
          delay={0}
          description="團隊人數"
          icon={Users}
          title="團隊規模"
          value={report.teamSummary.teamSize}
        />
        <StatCard
          accentColor="purple"
          delay={100}
          description="團隊總機會"
          icon={Building2}
          title="機會總數"
          value={report.teamSummary.totalOpportunities}
        />
        <StatCard
          accentColor="sky"
          delay={200}
          description="團隊總對話"
          icon={MessageSquare}
          title="對話數"
          value={report.teamSummary.totalConversations}
        />
        <StatCard
          accentColor="emerald"
          change={report.teamSummary.scoreChange}
          delay={300}
          description="團隊 PDCM 平均"
          icon={TrendingUp}
          title="團隊平均分數"
          value={report.teamSummary.teamAverageScore}
        />
        <StatCard
          accentColor="rose"
          delay={400}
          description="需要關注"
          icon={Target}
          title="風險機會"
          value={report.attentionNeeded.length}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Rankings（新版才有） */}
        {hasCachedData && uploadRankings.length > 0 ? (
          <AnalyticsCard
            delay={500}
            description={`${uploadRankingPeriod === "weekly" ? "本週" : "本月"}上傳音檔數量`}
            icon={MessageSquare}
            title={
              <div className="flex items-center justify-between">
                <span>音檔上傳排名</span>
                <Select
                  onValueChange={(v) =>
                    setUploadRankingPeriod(v as "weekly" | "monthly")
                  }
                  value={uploadRankingPeriod}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">本週</SelectItem>
                    <SelectItem value="monthly">本月</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          >
            <RankingList items={uploadRankingItems} valueSuffix=" 件" />
          </AnalyticsCard>
        ) : (
          // 舊版：Member Rankings
          <AnalyticsCard
            delay={500}
            description="依 PDCM 平均分數排序"
            icon={Trophy}
            title="團隊成員排名"
          >
            <RankingList items={memberRankingItems} valueSuffix=" 分" />
          </AnalyticsCard>
        )}

        {/* PDCM Score Rankings（新版顯示 member rankings） */}
        {hasCachedData ? (
          <AnalyticsCard
            delay={600}
            description="依 PDCM 平均分數排序"
            icon={Trophy}
            title="PDCM 分數排名"
          >
            <RankingList items={memberRankingItems} valueSuffix=" 分" />
          </AnalyticsCard>
        ) : (
          // 舊版：Team Dimension Analysis
          <AnalyticsCard
            delay={600}
            description="各維度團隊平均與最佳/最差表現"
            icon={BarChart3}
            title="團隊維度分析"
          >
            {report.teamDimensionAnalysis && (
              <div className="space-y-5">
                {Object.entries(report.teamDimensionAnalysis).map(
                  ([key, dim]) => {
                    const labels: Record<string, string> = {
                      pain: "痛點",
                      decision: "決策",
                      champion: "支持度",
                      metrics: "量化",
                    };
                    return (
                      <div className="space-y-2" key={key}>
                        <div className="flex items-center justify-between">
                          <span className="font-data text-sm">
                            {labels[key] || key}
                          </span>
                          <span className="font-data font-semibold text-sm">
                            {dim.teamAvg}/5
                          </span>
                        </div>
                        <ProgressBar max={5} value={dim.teamAvg} />
                        <div className="flex justify-between font-data text-muted-foreground text-xs">
                          <span>最佳: {dim.topPerformer}</span>
                          <span>需加強: {dim.bottomPerformer}</span>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </AnalyticsCard>
        )}
      </div>

      {/* PDCM 維度分析（新版 Cache 資料） */}
      {hasCachedData && cachedData.pdcmAnalysis && (
        <AnalyticsCard
          delay={700}
          description="各維度團隊平均分數"
          icon={BarChart3}
          title="團隊 PDCM 維度分析"
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(cachedData.pdcmAnalysis).map(
              ([key, dim]: [string, any]) => {
                const labelInfo = PDCM_LABELS[key];
                if (!labelInfo) {
                  return null;
                }
                return (
                  <div
                    className="rounded-lg border border-border/50 bg-muted/30 p-4 text-center"
                    key={key}
                  >
                    <p className="font-data text-muted-foreground text-sm">
                      {labelInfo.label}
                    </p>
                    <p className="mt-1 font-bold font-data text-3xl text-teal-400">
                      {dim.teamAvg}
                    </p>
                    <Badge className="mt-2 font-data text-xs" variant="outline">
                      權重 {PDCM_WEIGHTS[key as keyof typeof PDCM_WEIGHTS]}%
                    </Badge>
                  </div>
                );
              }
            )}
          </div>
        </AnalyticsCard>
      )}

      {/* Attention Needed */}
      {report.attentionNeeded.length > 0 && (
        <AnalyticsCard
          delay={800}
          description="分數低於 50 分的機會，需要經理介入"
          icon={Target}
          title={
            <span className="text-rose-400">
              需要關注的機會 ({report.attentionNeeded.length})
            </span>
          }
        >
          <div className="space-y-3">
            {report.attentionNeeded.map((opp) => (
              <div
                className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-4"
                key={opp.opportunityId}
              >
                <div>
                  <p className="font-data font-semibold text-sm">
                    {opp.companyName}
                  </p>
                  <p className="font-data text-muted-foreground text-xs">
                    負責人: {opp.assignedTo}
                  </p>
                  <p className="font-data text-rose-400 text-xs">
                    風險: {opp.risk}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-flex rounded-md bg-rose-500/20 px-2 py-1 font-bold font-data text-rose-400 text-sm ring-1 ring-rose-500/30">
                    {opp.score} 分
                  </span>
                  <p className="mt-1 font-data text-muted-foreground text-xs">
                    {opp.suggestedAction}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </AnalyticsCard>
      )}

      {/* Team Trends（舊版才有） */}
      {!hasCachedData && report.teamTrends.weeklyScores.length > 0 && (
        <AnalyticsCard
          delay={900}
          description="過去 8 週團隊平均分數變化"
          icon={TrendingUp}
          title="團隊趨勢"
        >
          <ResponsiveContainer height={200} width="100%">
            <LineChart data={report.teamTrends.weeklyScores}>
              <XAxis
                dataKey="week"
                fontSize={12}
                stroke="#64748b"
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis domain={[0, 100]} fontSize={12} stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontFamily: "IBM Plex Mono, monospace",
                }}
                labelFormatter={(value) => `週起始: ${value}`}
              />
              <Line
                dataKey="avgScore"
                dot={{ fill: "#2dd4bf", strokeWidth: 0 }}
                name="平均分數"
                stroke="#2dd4bf"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </AnalyticsCard>
      )}

      {/* Coaching Priority（舊版才有） */}
      {!hasCachedData && report.coachingPriority.length > 0 && (
        <AnalyticsCard
          delay={1000}
          description="優先需要輔導的團隊成員"
          icon={UserCircle}
          title="教練優先級"
        >
          <div className="space-y-3">
            {report.coachingPriority.map((member) => (
              <div
                className="rounded-lg border border-border/50 bg-muted/30 p-4"
                key={member.userId}
              >
                <div className="flex items-center justify-between">
                  <p className="font-data font-semibold text-sm">
                    {member.name}
                  </p>
                  <Badge className="font-data" variant="outline">
                    {member.reason}
                  </Badge>
                </div>
                <div className="mt-3">
                  <p className="font-data text-muted-foreground text-xs">
                    建議關注維度:
                  </p>
                  <div className="mt-2 flex gap-2">
                    {member.suggestedFocus.map((focus) => (
                      <Badge
                        className="font-data"
                        key={focus}
                        variant="secondary"
                      >
                        {focus}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AnalyticsCard>
      )}
    </div>
  );
}

// Main Reports Page
function ReportsPage() {
  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page Header */}
        <div
          className="animate-fade-in-up opacity-0"
          style={{ animationFillMode: "forwards" }}
        >
          <h1 className="font-bold font-display text-3xl tracking-tight">
            績效報告
          </h1>
          <p className="font-data text-muted-foreground text-sm">
            業務個人報告與經理團隊報告
          </p>
        </div>

        {/* Tabs */}
        <Tabs
          className="animate-fade-in-up opacity-0"
          defaultValue="personal"
          style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
        >
          <TabsList className="inline-flex gap-1 rounded-full bg-muted p-1">
            <TabsTrigger
              className="rounded-full px-4 py-2 font-data font-medium text-sm transition-all data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_15px_rgba(45,212,191,0.3)]"
              value="personal"
            >
              <UserCircle className="mr-2 h-4 w-4" />
              個人報告
            </TabsTrigger>
            <TabsTrigger
              className="rounded-full px-4 py-2 font-data font-medium text-sm transition-all data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_15px_rgba(45,212,191,0.3)]"
              value="team"
            >
              <Users className="mr-2 h-4 w-4" />
              團隊報告
            </TabsTrigger>
          </TabsList>

          <TabsContent className="mt-6" value="personal">
            <RepPerformanceReport />
          </TabsContent>

          <TabsContent className="mt-6" value="team">
            <TeamPerformanceReport />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
