/**
 * Dashboard 首頁 - Precision Analytics Design
 * 數據驅動的工業風格儀表板
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle,
  Clock,
  ListTodo,
  MessageSquare,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TermTooltip } from "@/components/ui/term-tooltip";
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/")({
  component: DashboardPage,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }
  },
});

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
  trend,
  termKey,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  trend?: "up" | "down" | "neutral";
  termKey?: string;
}) {
  return (
    <div className="stat-card group relative rounded-lg border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-6 transition-all duration-300 hover:border-purple-600/50 hover:shadow-lg hover:shadow-purple-600/10">
      {/* Background pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-5">
        <div className="grid-pattern h-full w-full" />
      </div>

      {/* Accent line */}
      <div className="absolute top-0 left-0 h-1 w-0 bg-gradient-to-r from-purple-600 to-purple-500 transition-all duration-500 group-hover:w-full" />

      <div className="relative">
        <div className="mb-4 flex items-start justify-between">
          <div className="rounded-lg bg-slate-800/50 p-2.5 ring-1 ring-purple-600/20">
            <Icon className="h-5 w-5 text-purple-400" />
          </div>
          {trend && (
            <div
              className={`flex items-center gap-1 text-xs ${
                trend === "up"
                  ? "text-emerald-400"
                  : trend === "down"
                    ? "text-red-400"
                    : "text-slate-400"
              }`}
            >
              <Activity className="h-3 w-3" />
              <span className="font-mono">
                {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="font-medium text-slate-400 text-sm uppercase tracking-wider">
            {termKey ? (
              <TermTooltip termKey={termKey}>{title}</TermTooltip>
            ) : (
              title
            )}
          </h3>
          {loading ? (
            <Skeleton className="h-10 w-24" />
          ) : (
            <div className="font-bold font-mono text-4xl text-white tracking-tight">
              {value}
            </div>
          )}
          {description && (
            <p className="font-mono text-slate-500 text-xs">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: string | null): {
  bg: string;
  text: string;
  ring: string;
  barColor: string;
  dotColor: string;
} {
  switch (status) {
    case "Strong":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        ring: "ring-emerald-500/30",
        barColor: "#34d399", // emerald-400
        dotColor: "#34d399",
      };
    case "Medium":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        ring: "ring-amber-500/30",
        barColor: "#fbbf24", // amber-400
        dotColor: "#fbbf24",
      };
    case "Weak":
      return {
        bg: "bg-orange-500/10",
        text: "text-orange-400",
        ring: "ring-orange-500/30",
        barColor: "#fb923c", // orange-400
        dotColor: "#fb923c",
      };
    case "At Risk":
      return {
        bg: "bg-red-500/10",
        text: "text-red-400",
        ring: "ring-red-500/30",
        barColor: "#f87171", // red-400
        dotColor: "#f87171",
      };
    default:
      return {
        bg: "bg-slate-500/10",
        text: "text-slate-400",
        ring: "ring-slate-500/30",
        barColor: "#94a3b8", // slate-400
        dotColor: "#94a3b8",
      };
  }
}

function getStatusLabel(status: string | null): string {
  switch (status) {
    case "Strong":
      return "強";
    case "Medium":
      return "中";
    case "Weak":
      return "弱";
    case "At Risk":
      return "風險";
    default:
      return "未知";
  }
}

function DashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ["analytics", "dashboard", {}],
    queryFn: async () => {
      return await client.analytics.dashboard({});
    },
  });

  // 今日待辦（含過期）
  const todosQuery = useQuery({
    queryKey: ["salesTodo", "todaysTodos", { includeOverdue: true }],
    queryFn: async () => {
      return await client.salesTodo.getTodaysTodos({ includeOverdue: true });
    },
  });

  const dashboard = dashboardQuery.data;
  const isLoading = dashboardQuery.isLoading;

  // 將 todosByUser 轉換為扁平陣列
  const todosData = todosQuery.data;
  const todos = todosData?.todosByUser
    ? Object.values(todosData.todosByUser).flat()
    : [];
  const todosLoading = todosQuery.isLoading;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        .grid-pattern {
          background-image:
            linear-gradient(rgba(99, 94, 246, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99, 94, 246, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }

        .stat-card {
          animation: fadeInUp 0.6s ease-out backwards;
        }

        .stat-card:nth-child(1) { animation-delay: 0.1s; }
        .stat-card:nth-child(2) { animation-delay: 0.2s; }
        .stat-card:nth-child(3) { animation-delay: 0.3s; }
        .stat-card:nth-child(4) { animation-delay: 0.4s; }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .section-card {
          animation: slideInLeft 0.6s ease-out 0.5s backwards;
        }

        .section-card:nth-child(2) {
          animation: slideInRight 0.6s ease-out 0.5s backwards;
        }

        .metric-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .brand-title {
          font-family: 'Playfair Display', serif;
          background: linear-gradient(135deg, #635EF6 0%, #8b5cf6 50%, #8b5cf6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .data-font {
          font-family: 'JetBrains Mono', monospace;
        }

        .status-bar {
          position: relative;
          overflow: hidden;
        }

        .action-button {
          position: relative;
          overflow: hidden;
        }

        .action-button::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(99, 94, 246, 0.3);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }

        .action-button:hover::before {
          width: 300px;
          height: 300px;
        }
      `}</style>

      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Background decorative elements */}
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute top-0 right-0 h-96 w-96 bg-purple-600/5 blur-[120px]" />
          <div className="absolute bottom-0 left-0 h-96 w-96 bg-purple-500/5 blur-[120px]" />
        </div>

        <div className="container relative mx-auto space-y-8 p-6 lg:p-8">
          {/* Page Header */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-purple-600 shadow-lg shadow-purple-600/20">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="brand-title font-bold text-4xl tracking-tight lg:text-5xl">
                      分析儀表板
                    </h1>
                    {dashboard?.scope && (
                      <span className="rounded-full bg-purple-600/20 px-3 py-1 font-mono text-purple-400 text-sm ring-1 ring-purple-600/30">
                        {dashboard.scope}
                      </span>
                    )}
                  </div>
                  <p className="data-font text-slate-400 text-sm uppercase tracking-wider">
                    銷售智慧 •{" "}
                    <TermTooltip termKey="PDCM+SPIN">
                      PDCM+SPIN 框架
                    </TermTooltip>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              description="所有銷售機會"
              icon={Building2}
              loading={isLoading}
              termKey="totalOpportunities"
              title="機會總數"
              trend="up"
              value={dashboard?.summary.totalOpportunities ?? 0}
            />
            <StatCard
              description="通話與會議記錄"
              icon={MessageSquare}
              loading={isLoading}
              termKey="totalConversations"
              title="對話總數"
              trend="neutral"
              value={dashboard?.summary.totalConversations ?? 0}
            />
            <StatCard
              description="已完成分析報告"
              icon={BarChart3}
              loading={isLoading}
              termKey="totalAnalyses"
              title="分析總數"
              trend="up"
              value={dashboard?.summary.totalAnalyses ?? 0}
            />
            <StatCard
              description="所有機會的平均分數"
              icon={TrendingUp}
              loading={isLoading}
              termKey="avgPdcmScore"
              title="平均 PDCM 分數"
              trend="up"
              value={
                dashboard?.summary.averageScore
                  ? Math.round(dashboard.summary.averageScore)
                  : "-"
              }
            />
          </div>

          {/* Today's Todos Section */}
          <Card className="section-card border-slate-800 bg-slate-950/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2 ring-1 ring-amber-500/30">
                  <ListTodo className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <CardTitle className="data-font text-white">
                    今日待辦
                  </CardTitle>
                  <CardDescription className="data-font text-slate-500 text-xs uppercase tracking-wider">
                    需要跟進的客戶
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {todosLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton className="h-16 w-full" key={i} />
                  ))}
                </div>
              ) : todos && todos.length > 0 ? (
                <div className="space-y-3">
                  {todos.slice(0, 5).map((todo) => {
                    const isOverdue =
                      new Date(todo.dueDate) <
                      new Date(new Date().setHours(0, 0, 0, 0));
                    return (
                      <Link
                        className="group block rounded-lg border border-slate-800 bg-slate-900/50 p-4 transition-all hover:border-amber-600/30 hover:bg-slate-900"
                        key={todo.id}
                        to="/todos"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              {isOverdue ? (
                                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                              ) : (
                                <Clock className="h-4 w-4 shrink-0 text-amber-400" />
                              )}
                              <p className="truncate font-semibold text-white">
                                {todo.title}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {todo.opportunity?.companyName && (
                                <>
                                  <span className="data-font text-slate-400">
                                    {todo.opportunity.companyName}
                                  </span>
                                  <span className="text-slate-700">•</span>
                                </>
                              )}
                              <span
                                className={`data-font ${isOverdue ? "text-red-400" : "text-slate-500"}`}
                              >
                                {isOverdue ? "逾期 " : ""}
                                {new Date(todo.dueDate).toLocaleDateString(
                                  "zh-TW",
                                  {
                                    month: "short",
                                    day: "numeric",
                                  }
                                )}
                              </span>
                            </div>
                          </div>
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              isOverdue
                                ? "bg-red-500/10 ring-1 ring-red-500/30"
                                : "bg-amber-500/10 ring-1 ring-amber-500/30"
                            }`}
                          >
                            {isOverdue ? (
                              <AlertCircle className="h-4 w-4 text-red-400" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-amber-400" />
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  {todos.length > 5 && (
                    <p className="pt-2 text-center text-slate-500 text-sm">
                      還有 {todos.length - 5} 項待辦...
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-slate-800/50 p-4">
                    <CheckCircle className="h-full w-full text-green-500" />
                  </div>
                  <p className="data-font text-slate-400 text-sm">
                    太棒了！今日沒有待辦事項
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Status Distribution */}
            <Card className="section-card border-slate-800 bg-slate-950/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-600/10 p-2 ring-1 ring-purple-600/30">
                    <Activity className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="data-font text-white">
                      <TermTooltip termKey="qualificationStatus">
                        資格認定狀態
                      </TermTooltip>
                    </CardTitle>
                    <CardDescription className="data-font text-slate-500 text-xs uppercase tracking-wider">
                      PDCM 分佈
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton className="h-12 w-full" key={i} />
                    ))}
                  </div>
                ) : dashboard?.statusDistribution &&
                  dashboard.statusDistribution.length > 0 ? (
                  <div className="space-y-4">
                    {/* 按照 強→中→弱→風險 排序 */}
                    {[...dashboard.statusDistribution]
                      .sort((a, b) => {
                        const order: Record<string, number> = {
                          Strong: 0,
                          Medium: 1,
                          Weak: 2,
                          "At Risk": 3,
                        };
                        return (
                          (order[a.status ?? ""] ?? 99) -
                          (order[b.status ?? ""] ?? 99)
                        );
                      })
                      .map((item) => {
                        const total = dashboard.statusDistribution.reduce(
                          (sum, s) => sum + s.count,
                          0
                        );
                        const percentage =
                          total > 0 ? (item.count / total) * 100 : 0;
                        const colors = getStatusColor(item.status);
                        return (
                          <div className="space-y-2" key={item.status}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-8 w-8 items-center justify-center rounded ${colors.bg} ring-1 ${colors.ring}`}
                                >
                                  <div
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: colors.dotColor }}
                                  />
                                </div>
                                <span
                                  className={`data-font font-semibold text-sm uppercase tracking-wider ${colors.text}`}
                                >
                                  {getStatusLabel(item.status)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="data-font font-bold text-white">
                                  {item.count}
                                </span>
                                <span className="data-font text-slate-500 text-sm">
                                  {Math.round(percentage)}%
                                </span>
                              </div>
                            </div>
                            <div className="status-bar h-2 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full transition-all duration-1000"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: colors.barColor,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-slate-800/50 p-4">
                      <BarChart3 className="h-full w-full text-slate-600" />
                    </div>
                    <p className="data-font text-slate-500 text-sm uppercase tracking-wider">
                      尚無分析資料
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Analyses */}
            <Card className="section-card border-slate-800 bg-slate-950/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-500/10 p-2 ring-1 ring-purple-500/30">
                    <Zap className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="data-font text-white">
                      <TermTooltip termKey="analysis">最近分析</TermTooltip>
                    </CardTitle>
                    <CardDescription className="data-font text-slate-500 text-xs uppercase tracking-wider">
                      最新 PDCM 結果
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton className="h-16 w-full" key={i} />
                    ))}
                  </div>
                ) : dashboard?.recentAnalyses &&
                  dashboard.recentAnalyses.length > 0 ? (
                  <div className="space-y-3">
                    {dashboard.recentAnalyses.map((analysis) => {
                      const colors = getStatusColor(analysis.status);
                      return (
                        <div
                          className="group rounded-lg border border-slate-800 bg-slate-900/50 p-4 transition-all hover:border-purple-600/30 hover:bg-slate-900"
                          key={analysis.id}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1 space-y-2">
                              <p className="truncate font-semibold text-white">
                                {analysis.opportunityCompanyName}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="data-font text-slate-500">
                                  {analysis.customerNumber}
                                </span>
                                <span className="text-slate-700">•</span>
                                <span className="data-font text-slate-500">
                                  {new Date(
                                    analysis.createdAt
                                  ).toLocaleDateString("zh-TW")}
                                </span>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <div
                                className={`data-font flex h-12 w-12 items-center justify-center rounded-lg ${colors.bg} font-bold text-xl ring-1 ${colors.ring} ${colors.text}`}
                              >
                                {analysis.overallScore ?? "-"}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-slate-800/50 p-4">
                      <MessageSquare className="h-full w-full text-slate-600" />
                    </div>
                    <p className="data-font text-slate-500 text-sm uppercase tracking-wider">
                      尚無分析記錄
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
