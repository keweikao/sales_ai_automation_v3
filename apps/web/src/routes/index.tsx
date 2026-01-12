/**
 * Dashboard 首頁
 * 顯示 Opportunities、Conversations、MEDDIC 分析統計
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Building2,
  MessageSquare,
  TrendingUp,
} from "lucide-react";

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
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
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
          <div className="font-bold text-2xl">{value}</div>
        )}
        {description && (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function getStatusColor(status: string | null): string {
  switch (status) {
    case "Strong":
      return "bg-green-500";
    case "Medium":
      return "bg-yellow-500";
    case "Weak":
      return "bg-orange-500";
    case "At Risk":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}

function getStatusLabel(status: string | null): string {
  switch (status) {
    case "Strong":
      return "強勢";
    case "Medium":
      return "中等";
    case "Weak":
      return "弱勢";
    case "At Risk":
      return "風險";
    default:
      return "未知";
  }
}

function DashboardPage() {
  const dashboardQuery = useQuery(orpc.analytics.dashboard.queryOptions({}));

  const dashboard = dashboardQuery.data;
  const isLoading = dashboardQuery.isLoading;

  return (
    <main className="container mx-auto space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">儀表板</h1>
          <p className="text-muted-foreground">
            Sales AI Automation - MEDDIC 分析總覽
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/opportunities">
              <Building2 className="mr-2 h-4 w-4" />
              商機管理
            </Link>
          </Button>
          <Button asChild>
            <Link to="/conversations">
              <MessageSquare className="mr-2 h-4 w-4" />
              對話分析
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          description="所有商機"
          icon={Building2}
          loading={isLoading}
          title="商機總數"
          value={dashboard?.summary.totalOpportunities ?? 0}
        />
        <StatCard
          description="所有對話記錄"
          icon={MessageSquare}
          loading={isLoading}
          title="對話數"
          value={dashboard?.summary.totalConversations ?? 0}
        />
        <StatCard
          description="MEDDIC 分析完成"
          icon={BarChart3}
          loading={isLoading}
          title="分析數"
          value={dashboard?.summary.totalAnalyses ?? 0}
        />
        <StatCard
          description="MEDDIC 平均分數"
          icon={TrendingUp}
          loading={isLoading}
          title="平均分數"
          value={
            dashboard?.summary.averageScore
              ? Math.round(dashboard.summary.averageScore)
              : "-"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>MEDDIC 狀態分佈</CardTitle>
            <CardDescription>依資格狀態分類的分析結果</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton className="h-8 w-full" key={i} />
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
                  const percentage = total > 0 ? (item.count / total) * 100 : 0;
                  return (
                    <div className="space-y-2" key={item.status}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-3 w-3 rounded-full ${getStatusColor(item.status)}`}
                          />
                          <span className="font-medium text-sm">
                            {getStatusLabel(item.status)}
                          </span>
                        </div>
                        <span className="text-muted-foreground text-sm">
                          {item.count} ({Math.round(percentage)}%)
                        </span>
                      </div>
                      <Progress className="h-2" value={percentage} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                尚無分析資料
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Analyses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>最近分析</CardTitle>
              <CardDescription>最新完成的 MEDDIC 分析</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/conversations">
                查看全部
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div className="flex items-center justify-between" key={i}>
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            ) : dashboard?.recentAnalyses &&
              dashboard.recentAnalyses.length > 0 ? (
              <div className="space-y-4">
                {dashboard.recentAnalyses.map((analysis) => (
                  <div
                    className="flex items-center justify-between"
                    key={analysis.id}
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-sm leading-none">
                        {analysis.opportunityCompanyName}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {analysis.customerNumber} •{" "}
                        {new Date(analysis.createdAt).toLocaleDateString(
                          "zh-TW"
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={getStatusColor(analysis.status)}
                        variant="secondary"
                      >
                        {analysis.overallScore ?? "-"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                尚無分析資料
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
          <CardDescription>常用功能捷徑</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Button asChild className="h-auto py-4" variant="outline">
              <Link className="flex flex-col gap-2" to="/opportunities/new">
                <Building2 className="h-6 w-6" />
                <span>新增商機</span>
              </Link>
            </Button>
            <Button asChild className="h-auto py-4" variant="outline">
              <Link className="flex flex-col gap-2" to="/conversations/new">
                <MessageSquare className="h-6 w-6" />
                <span>上傳對話</span>
              </Link>
            </Button>
            <Button asChild className="h-auto py-4" variant="outline">
              <Link className="flex flex-col gap-2" to="/opportunities">
                <BarChart3 className="h-6 w-6" />
                <span>商機列表</span>
              </Link>
            </Button>
            <Button asChild className="h-auto py-4" variant="outline">
              <Link className="flex flex-col gap-2" to="/conversations">
                <TrendingUp className="h-6 w-6" />
                <span>對話列表</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
