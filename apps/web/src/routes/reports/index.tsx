/**
 * 報告頁面
 * 顯示業務個人報告和經理團隊報告
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
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/reports/")({
  component: ReportsPage,
});

// Trend icon component
function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") {
    return <ArrowUp className="h-4 w-4 text-green-500" />;
  }
  if (trend === "down") {
    return <ArrowDown className="h-4 w-4 text-red-500" />;
  }
  return <Minus className="h-4 w-4 text-gray-500" />;
}

// Score change badge
function ScoreChangeBadge({ change }: { change: number }) {
  if (change > 0) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        +{change}
      </Badge>
    );
  }
  if (change < 0) {
    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        {change}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      {change}
    </Badge>
  );
}

// Stat card for summary
function StatCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
  change,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  change?: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-sm">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-bold text-2xl">{value}</span>
            {change !== undefined && <ScoreChangeBadge change={change} />}
          </div>
        )}
        {description && (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// Dimension score bar
function DimensionScoreBar({
  label,
  score,
  trend,
  gap,
}: {
  label: string;
  score: number;
  trend: "up" | "down" | "stable";
  gap?: string;
}) {
  const getScoreColor = (s: number) => {
    if (s >= 4) return "bg-green-500";
    if (s >= 3) return "bg-yellow-500";
    if (s >= 2) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{label}</span>
          <TrendIcon trend={trend} />
        </div>
        <span className="font-medium text-sm">{score.toFixed(1)}/5</span>
      </div>
      <Progress
        className="h-2"
        value={(score / 5) * 100}
      />
      {gap && (
        <p className="text-muted-foreground text-xs">{gap}</p>
      )}
    </div>
  );
}

// Rep Performance Report Component
function RepPerformanceReport() {
  const reportQuery = useQuery(
    orpc.analytics.repPerformance.queryOptions({})
  );

  const report = reportQuery.data;
  const isLoading = reportQuery.isLoading;

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

  if (!report) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        無法載入報告資料
      </div>
    );
  }

  const dimensionLabels: Record<string, string> = {
    metrics: "量化指標 (M)",
    economicBuyer: "經濟決策者 (E)",
    decisionCriteria: "決策標準 (D)",
    decisionProcess: "決策流程 (D)",
    identifyPain: "痛點識別 (I)",
    champion: "內部支持者 (C)",
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          description="所有商機"
          icon={Building2}
          title="商機總數"
          value={report.summary.totalOpportunities}
        />
        <StatCard
          description="所有對話"
          icon={MessageSquare}
          title="對話數"
          value={report.summary.totalConversations}
        />
        <StatCard
          description="已完成分析"
          icon={BarChart3}
          title="分析數"
          value={report.summary.totalAnalyses}
        />
        <StatCard
          change={report.summary.scoreChange}
          description="MEDDIC 平均"
          icon={TrendingUp}
          title="平均分數"
          value={report.summary.averageScore}
        />
        <StatCard
          description="在團隊中的排名"
          icon={Trophy}
          title="團隊百分位"
          value={`${report.teamComparison.overallPercentile}%`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* MEDDIC Dimensions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              MEDDIC 六維度分析
            </CardTitle>
            <CardDescription>
              各維度平均分數與趨勢
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(report.dimensionAnalysis).map(([key, dim]) => (
              <DimensionScoreBar
                gap={dim.gap}
                key={key}
                label={dimensionLabels[key] || key}
                score={dim.score}
                trend={dim.trend}
              />
            ))}
          </CardContent>
        </Card>

        {/* Strengths & Weaknesses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Medal className="h-5 w-5" />
              強項與弱項
            </CardTitle>
            <CardDescription>
              基於 MEDDIC 分數自動識別
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Strengths */}
            <div>
              <h4 className="mb-2 flex items-center gap-2 font-medium text-green-600 dark:text-green-400">
                <ArrowUp className="h-4 w-4" />
                強項 (≥4 分)
              </h4>
              {report.strengths.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {report.strengths.map((s) => (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" key={s}>
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">尚無強項維度</p>
              )}
            </div>

            {/* Weaknesses */}
            <div>
              <h4 className="mb-2 flex items-center gap-2 font-medium text-red-600 dark:text-red-400">
                <ArrowDown className="h-4 w-4" />
                弱項 (≤2 分)
              </h4>
              {report.weaknesses.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {report.weaknesses.map((w) => (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" key={w}>
                      {w}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">無弱項維度，繼續保持！</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coaching Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            個人化教練建議
          </CardTitle>
          <CardDescription>
            基於 AI 分析的改善建議
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recurring Patterns */}
          {report.coachingInsights.recurringPatterns.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium">重複出現的問題</h4>
              <div className="flex flex-wrap gap-2">
                {report.coachingInsights.recurringPatterns.map((p) => (
                  <Badge key={p} variant="outline">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Improvement Plan */}
          {report.coachingInsights.improvementPlan.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium">改善計畫</h4>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
                {report.coachingInsights.improvementPlan.map((plan, i) => (
                  <li key={i}>{plan}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent Feedback */}
          {report.coachingInsights.recentFeedback.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium">最近的教練回饋</h4>
              <div className="space-y-2">
                {report.coachingInsights.recentFeedback.slice(0, 3).map((feedback, i) => (
                  <p className="rounded-lg bg-muted p-3 text-sm" key={i}>
                    {feedback}
                  </p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            進步追蹤
          </CardTitle>
          <CardDescription>
            不同時間區間的表現變化
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="font-medium">最近 30 天</h4>
              <div className="mt-2 flex items-center gap-2">
                <span className="font-bold text-2xl">
                  {report.progressTracking.last30Days.avgScore}
                </span>
                <ScoreChangeBadge change={report.progressTracking.last30Days.change} />
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="font-medium">最近 90 天</h4>
              <div className="mt-2 flex items-center gap-2">
                <span className="font-bold text-2xl">
                  {report.progressTracking.last90Days.avgScore}
                </span>
                <ScoreChangeBadge change={report.progressTracking.last90Days.change} />
              </div>
            </div>
          </div>

          {/* Milestones */}
          {report.progressTracking.milestones.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-2 font-medium">達成里程碑</h4>
              <div className="space-y-2">
                {report.progressTracking.milestones.map((m, i) => (
                  <div
                    className="flex items-center gap-2 rounded-lg bg-green-100 p-2 text-green-800 dark:bg-green-900 dark:text-green-200"
                    key={i}
                  >
                    <Trophy className="h-4 w-4" />
                    <span className="text-sm">{m.achievement}</span>
                    <span className="text-muted-foreground text-xs">({m.date})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Team Performance Report Component
function TeamPerformanceReport() {
  const reportQuery = useQuery(
    orpc.analytics.teamPerformance.queryOptions({})
  );

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
        <Users className="mx-auto mb-4 h-12 w-12" />
        <p>您目前沒有管理任何團隊成員</p>
        <p className="text-sm">請聯繫管理員設定團隊關係</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          description="團隊人數"
          icon={Users}
          title="團隊規模"
          value={report.teamSummary.teamSize}
        />
        <StatCard
          description="團隊總商機"
          icon={Building2}
          title="商機總數"
          value={report.teamSummary.totalOpportunities}
        />
        <StatCard
          description="團隊總對話"
          icon={MessageSquare}
          title="對話數"
          value={report.teamSummary.totalConversations}
        />
        <StatCard
          change={report.teamSummary.scoreChange}
          description="團隊 MEDDIC 平均"
          icon={TrendingUp}
          title="團隊平均分數"
          value={report.teamSummary.teamAverageScore}
        />
        <StatCard
          description="需要關注"
          icon={Target}
          title="風險商機"
          value={report.attentionNeeded.length}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Member Rankings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              團隊成員排名
            </CardTitle>
            <CardDescription>
              依 MEDDIC 平均分數排序
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.memberRankings.map((member, index) => (
                <div
                  className={cn(
                    "flex items-center justify-between rounded-lg p-3",
                    member.needsAttention
                      ? "bg-red-50 dark:bg-red-950"
                      : "bg-muted/50"
                  )}
                  key={member.userId}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full font-medium text-xs",
                        index === 0 && "bg-yellow-400 text-yellow-900",
                        index === 1 && "bg-gray-300 text-gray-900",
                        index === 2 && "bg-orange-400 text-orange-900",
                        index > 2 && "bg-muted text-muted-foreground"
                      )}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-sm">{member.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {member.opportunityCount} 商機 · {member.conversationCount} 對話
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendIcon trend={member.trend} />
                    <span className="font-bold">{member.averageScore}</span>
                    {member.needsAttention && (
                      <Badge variant="destructive">需關注</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Team Dimension Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              團隊維度分析
            </CardTitle>
            <CardDescription>
              各維度團隊平均與最佳/最差表現
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.teamDimensionAnalysis && (
              <div className="space-y-4">
                {Object.entries(report.teamDimensionAnalysis).map(([key, dim]) => {
                  const labels: Record<string, string> = {
                    metrics: "量化指標",
                    economicBuyer: "經濟決策者",
                    decisionCriteria: "決策標準",
                    decisionProcess: "決策流程",
                    identifyPain: "痛點識別",
                    champion: "內部支持者",
                  };
                  return (
                    <div className="space-y-1" key={key}>
                      <div className="flex items-center justify-between text-sm">
                        <span>{labels[key] || key}</span>
                        <span className="font-medium">{dim.teamAvg}/5</span>
                      </div>
                      <Progress
                        className="h-2"
                        value={(dim.teamAvg / 5) * 100}
                      />
                      <div className="flex justify-between text-muted-foreground text-xs">
                        <span>最佳: {dim.topPerformer}</span>
                        <span>需加強: {dim.bottomPerformer}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attention Needed */}
      {report.attentionNeeded.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Target className="h-5 w-5" />
              需要關注的商機
            </CardTitle>
            <CardDescription>
              分數低於 50 分的商機，需要經理介入
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.attentionNeeded.map((opp) => (
                <div
                  className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950"
                  key={opp.opportunityId}
                >
                  <div>
                    <p className="font-medium">{opp.companyName}</p>
                    <p className="text-muted-foreground text-sm">
                      負責人: {opp.assignedTo}
                    </p>
                    <p className="text-red-600 text-sm dark:text-red-400">
                      風險: {opp.risk}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive">{opp.score} 分</Badge>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {opp.suggestedAction}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            團隊趨勢
          </CardTitle>
          <CardDescription>
            過去 8 週團隊平均分數變化
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer height={200} width="100%">
            <LineChart data={report.teamTrends.weeklyScores}>
              <XAxis
                dataKey="week"
                stroke="#888888"
                fontSize={12}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelFormatter={(value) => `週起始: ${value}`}
              />
              <Line
                dataKey="avgScore"
                name="平均分數"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Coaching Priority */}
      {report.coachingPriority.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              教練優先級
            </CardTitle>
            <CardDescription>
              優先需要輔導的團隊成員
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.coachingPriority.map((member) => (
                <div
                  className="rounded-lg border bg-muted/50 p-4"
                  key={member.userId}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{member.name}</p>
                    <Badge variant="outline">{member.reason}</Badge>
                  </div>
                  <div className="mt-2">
                    <p className="text-muted-foreground text-sm">建議關注維度:</p>
                    <div className="mt-1 flex gap-2">
                      {member.suggestedFocus.map((focus) => (
                        <Badge key={focus} variant="secondary">
                          {focus}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Main Reports Page
function ReportsPage() {
  return (
    <main className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">績效報告</h1>
          <p className="text-muted-foreground">
            業務個人報告與經理團隊報告
          </p>
        </div>
      </div>

      <Tabs defaultValue="personal">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger className="gap-2" value="personal">
            <UserCircle className="h-4 w-4" />
            個人報告
          </TabsTrigger>
          <TabsTrigger className="gap-2" value="team">
            <Users className="h-4 w-4" />
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
    </main>
  );
}
