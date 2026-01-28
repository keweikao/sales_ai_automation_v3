/**
 * Dashboard 首頁
 * Precision Dashboard Design System
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  User,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({
        to: "/login",
        throw: true,
      });
    }
    return { session };
  },
});

const statusConfig: Record<
  string,
  {
    label: string;
    icon: typeof CheckCircle2;
    className: string;
  }
> = {
  completed: {
    label: "已完成",
    icon: CheckCircle2,
    className: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  },
  analyzing: {
    label: "分析中",
    icon: Loader2,
    className: "bg-purple-500/15 text-purple-400 ring-purple-500/30",
  },
  transcribing: {
    label: "轉錄中",
    icon: Loader2,
    className: "bg-sky-500/15 text-sky-400 ring-sky-500/30",
  },
  pending: {
    label: "待處理",
    icon: Clock,
    className: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  },
  failed: {
    label: "失敗",
    icon: XCircle,
    className: "bg-rose-500/15 text-rose-400 ring-rose-500/30",
  },
};

function getScoreColor(score: number): string {
  if (score >= 70) {
    return "text-emerald-400";
  }
  if (score >= 40) {
    return "text-amber-400";
  }
  return "text-rose-400";
}

function RouteComponent() {
  const { session } = Route.useRouteContext();

  const conversationsQuery = useQuery({
    queryKey: ["conversations", "list"],
    queryFn: async () => {
      const result = await client.conversations.list({
        limit: 20,
        offset: 0,
      });
      return result;
    },
  });

  const conversations = conversationsQuery.data?.items || [];
  const isLoading = conversationsQuery.isLoading;

  if (conversationsQuery.isError) {
    console.error("Conversations Query Error:", {
      error: conversationsQuery.error,
      message: conversationsQuery.error?.message,
      status: (conversationsQuery.error as unknown as { status?: number })
        ?.status,
      details: JSON.stringify(conversationsQuery.error, null, 2),
    });
  }

  return (
    <main className="ds-page">
      <div className="ds-page-content">
        {/* Page Header */}
        <PageHeader
          className="animate-fade-in-up opacity-0"
          style={{ animationDelay: "0ms", animationFillMode: "forwards" }}
          subtitle="歡迎回來，查看您的銷售活動"
          title="Dashboard"
        />

        {/* User Info Card */}
        <Card
          className="ds-card ds-card-accent animate-fade-in-up opacity-0"
          style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ds-accent)]/10">
                <User className="h-4 w-4 text-[var(--ds-accent)]" />
              </div>
              用戶資訊
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 transition-all hover:border-[var(--ds-accent)]/30 hover:bg-muted/50">
                <p className="font-data font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  姓名
                </p>
                <p className="mt-1 font-display font-medium text-lg">
                  {session.data?.user.name || "未設定"}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 transition-all hover:border-[var(--ds-accent)]/30 hover:bg-muted/50">
                <p className="font-data font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Email
                </p>
                <p className="mt-1 flex items-center gap-2 font-data text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {session.data?.user.email}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 transition-all hover:border-[var(--ds-accent)]/30 hover:bg-muted/50">
                <p className="font-data font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  User ID
                </p>
                <p className="mt-1 truncate font-data text-muted-foreground text-xs">
                  {session.data?.user.id}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conversations List */}
        <Card
          className="ds-card animate-fade-in-up opacity-0"
          style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                <MessageSquare className="h-4 w-4 text-purple-400" />
              </div>
              我的對話記錄
            </CardTitle>
            <Button
              asChild
              className="bg-[var(--ds-accent)] text-white shadow-lg shadow-teal-500/20 transition-all hover:bg-[var(--ds-accent-dark)] hover:shadow-teal-500/30"
            >
              <Link to="/conversations/new">
                <Plus className="mr-2 h-4 w-4" />
                上傳音檔
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    className="rounded-lg border border-border/50 p-4"
                    key={i}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversationsQuery.isError ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
                  <div className="flex-1">
                    <p className="font-display font-semibold text-rose-400">
                      載入失敗
                    </p>
                    <p className="mt-1 font-data text-muted-foreground text-sm">
                      {conversationsQuery.error?.message || "無法載入對話列表"}
                    </p>
                    <details className="mt-4">
                      <summary className="cursor-pointer font-data text-muted-foreground text-xs hover:text-foreground">
                        顯示詳細錯誤資訊
                      </summary>
                      <pre className="mt-2 overflow-auto rounded-lg bg-slate-900 p-3 font-data text-slate-300 text-xs">
                        {JSON.stringify(
                          {
                            message: conversationsQuery.error?.message,
                            error: conversationsQuery.error,
                            status: (
                              conversationsQuery.error as unknown as {
                                status?: number;
                              }
                            )?.status,
                            userId: session.data?.user.id,
                            email: session.data?.user.email,
                          },
                          null,
                          2
                        )}
                      </pre>
                    </details>
                    <Button
                      className="mt-4"
                      onClick={() => conversationsQuery.refetch()}
                      size="sm"
                      variant="outline"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      重試
                    </Button>
                  </div>
                </div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="mt-4 font-display text-lg text-muted-foreground">
                  尚無對話記錄
                </p>
                <p className="mt-1 text-muted-foreground/70 text-sm">
                  上傳您的第一個銷售錄音開始分析
                </p>
                <Button
                  asChild
                  className="mt-6 bg-[var(--ds-accent)] text-white shadow-lg shadow-teal-500/20 transition-all hover:bg-[var(--ds-accent-dark)] hover:shadow-teal-500/30"
                >
                  <Link to="/conversations/new">
                    <Plus className="mr-2 h-4 w-4" />
                    上傳音檔
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {conversations.map((conv, index) => {
                  const status =
                    statusConfig[conv.status] || statusConfig.pending;
                  const StatusIcon = status.icon;

                  return (
                    <Link
                      className={cn(
                        "block rounded-lg border border-border/50 p-4 transition-all duration-200",
                        "hover:translate-x-1 hover:border-[var(--ds-accent)]/30 hover:bg-muted/30",
                        index % 2 === 1 && "bg-muted/20"
                      )}
                      key={conv.id}
                      to={`/conversations/${conv.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="truncate font-display font-semibold">
                              {conv.title || "未命名對話"}
                            </h3>
                            <Badge
                              className={cn(
                                "shrink-0 font-data text-xs ring-1",
                                status.className
                              )}
                              variant="outline"
                            >
                              <StatusIcon
                                className={cn(
                                  "mr-1 h-3 w-3",
                                  (conv.status === "analyzing" ||
                                    conv.status === "transcribing") &&
                                    "animate-spin"
                                )}
                              />
                              {status.label}
                            </Badge>
                          </div>
                          <p className="mt-1 font-data text-muted-foreground text-sm">
                            {conv.caseNumber} • {conv.opportunityCompanyName}
                          </p>
                        </div>
                        {conv.meddicScore !== null && (
                          <div className="shrink-0 text-right">
                            <p className="font-data text-muted-foreground text-xs uppercase tracking-wider">
                              PDCM
                            </p>
                            <p
                              className={cn(
                                "font-bold font-data text-xl",
                                getScoreColor(conv.meddicScore)
                              )}
                            >
                              {conv.meddicScore}
                            </p>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
