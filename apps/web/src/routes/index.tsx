/**
 * Dashboard 首頁 - Precision Analytics Design
 * 數據驅動的工業風格儀表板
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  MessageSquare,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
  trend,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="stat-card group relative overflow-hidden rounded-lg border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-6 transition-all duration-300 hover:border-purple-600/50 hover:shadow-lg hover:shadow-purple-600/10">
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
            {title}
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
} {
  switch (status) {
    case "Strong":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        ring: "ring-emerald-500/30",
      };
    case "Medium":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        ring: "ring-amber-500/30",
      };
    case "Weak":
      return {
        bg: "bg-orange-500/10",
        text: "text-orange-400",
        ring: "ring-orange-500/30",
      };
    case "At Risk":
      return {
        bg: "bg-red-500/10",
        text: "text-red-400",
        ring: "ring-red-500/30",
      };
    default:
      return {
        bg: "bg-slate-500/10",
        text: "text-slate-400",
        ring: "ring-slate-500/30",
      };
  }
}

function getStatusLabel(status: string | null): string {
  switch (status) {
    case "Strong":
      return "STRONG";
    case "Medium":
      return "MEDIUM";
    case "Weak":
      return "WEAK";
    case "At Risk":
      return "AT RISK";
    default:
      return "UNKNOWN";
  }
}

function DashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ["analytics", "dashboard", {}],
    queryFn: async () => {
      return await client.analytics.dashboard({});
    },
  });

  const dashboard = dashboardQuery.data;
  const isLoading = dashboardQuery.isLoading;

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

        .quick-action-card {
          animation: fadeInUp 0.6s ease-out 0.7s backwards;
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

        .status-bar::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(99, 94, 246, 0.3), transparent);
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          100% {
            left: 100%;
          }
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
                  <h1 className="brand-title font-bold text-4xl tracking-tight lg:text-5xl">
                    Analytics Command
                  </h1>
                  <p className="data-font text-slate-400 text-sm uppercase tracking-wider">
                    Sales Intelligence • MEDDIC Framework
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                className="action-button border-slate-700 bg-slate-800/50 font-mono text-sm backdrop-blur-sm hover:border-purple-600/50 hover:bg-slate-800"
                size="lg"
                variant="outline"
              >
                <Link to="/opportunities">
                  <Building2 className="mr-2 h-4 w-4" />
                  OPPORTUNITIES
                </Link>
              </Button>
              <Button
                asChild
                className="action-button border-purple-600/50 bg-gradient-to-r from-purple-700 to-purple-600 font-mono text-sm shadow-lg shadow-purple-600/20 hover:from-purple-600 hover:to-purple-500"
                size="lg"
              >
                <Link to="/conversations">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  CONVERSATIONS
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              description="TOTAL OPPORTUNITIES"
              icon={Building2}
              loading={isLoading}
              title="Opportunities"
              trend="up"
              value={dashboard?.summary.totalOpportunities ?? 0}
            />
            <StatCard
              description="CONVERSATION RECORDS"
              icon={MessageSquare}
              loading={isLoading}
              title="Conversations"
              trend="neutral"
              value={dashboard?.summary.totalConversations ?? 0}
            />
            <StatCard
              description="MEDDIC ANALYSES"
              icon={BarChart3}
              loading={isLoading}
              title="Analyses"
              trend="up"
              value={dashboard?.summary.totalAnalyses ?? 0}
            />
            <StatCard
              description="AVERAGE MEDDIC SCORE"
              icon={TrendingUp}
              loading={isLoading}
              title="Avg Score"
              trend="up"
              value={
                dashboard?.summary.averageScore
                  ? Math.round(dashboard.summary.averageScore)
                  : "-"
              }
            />
          </div>

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
                      QUALIFICATION STATUS
                    </CardTitle>
                    <CardDescription className="data-font text-slate-500 text-xs uppercase tracking-wider">
                      MEDDIC Distribution
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
                    {dashboard.statusDistribution.map((item) => {
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
                                  className={`h-2 w-2 rounded-full ${colors.text.replace("text-", "bg-")}`}
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
                          <div className="status-bar relative h-2 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={`h-full transition-all duration-1000 ${colors.text.replace("text-", "bg-")}`}
                              style={{ width: `${percentage}%` }}
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
                      No Analysis Data
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
                      RECENT ANALYSES
                    </CardTitle>
                    <CardDescription className="data-font text-slate-500 text-xs uppercase tracking-wider">
                      Latest MEDDIC Results
                    </CardDescription>
                  </div>
                </div>
                <Button
                  asChild
                  className="data-font border-slate-700 text-purple-400 hover:border-purple-600/50 hover:bg-slate-800 hover:text-cyan-300"
                  size="sm"
                  variant="ghost"
                >
                  <Link to="/conversations">
                    VIEW ALL
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
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
                      No Recent Analyses
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="quick-action-card border-slate-800 bg-gradient-to-br from-slate-950/80 to-slate-900/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-500/10 p-2 ring-1 ring-purple-500/30">
                  <Zap className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <CardTitle className="data-font text-white">
                    QUICK ACTIONS
                  </CardTitle>
                  <CardDescription className="data-font text-slate-500 text-xs uppercase tracking-wider">
                    Rapid Access Controls
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Button
                  asChild
                  className="action-button h-auto border-slate-700 bg-slate-900/50 py-6 backdrop-blur-sm hover:border-purple-600/50 hover:bg-slate-800"
                  variant="outline"
                >
                  <Link className="flex flex-col gap-3" to="/opportunities/new">
                    <Building2 className="h-8 w-8 text-purple-400" />
                    <span className="data-font text-sm uppercase tracking-wider">
                      New Opportunity
                    </span>
                  </Link>
                </Button>
                <Button
                  asChild
                  className="action-button h-auto border-slate-700 bg-slate-900/50 py-6 backdrop-blur-sm hover:border-purple-500/50 hover:bg-slate-800"
                  variant="outline"
                >
                  <Link className="flex flex-col gap-3" to="/conversations/new">
                    <MessageSquare className="h-8 w-8 text-purple-400" />
                    <span className="data-font text-sm uppercase tracking-wider">
                      Upload Audio
                    </span>
                  </Link>
                </Button>
                <Button
                  asChild
                  className="action-button h-auto border-slate-700 bg-slate-900/50 py-6 backdrop-blur-sm hover:border-purple-500/50 hover:bg-slate-800"
                  variant="outline"
                >
                  <Link className="flex flex-col gap-3" to="/opportunities">
                    <BarChart3 className="h-8 w-8 text-purple-400" />
                    <span className="data-font text-sm uppercase tracking-wider">
                      All Opportunities
                    </span>
                  </Link>
                </Button>
                <Button
                  asChild
                  className="action-button h-auto border-slate-700 bg-slate-900/50 py-6 backdrop-blur-sm hover:border-emerald-500/50 hover:bg-slate-800"
                  variant="outline"
                >
                  <Link className="flex flex-col gap-3" to="/conversations">
                    <TrendingUp className="h-8 w-8 text-emerald-400" />
                    <span className="data-font text-sm uppercase tracking-wider">
                      All Conversations
                    </span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
