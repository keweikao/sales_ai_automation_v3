/**
 * Opportunities 列表頁面
 * Precision Dashboard Design System
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Plus,
  Search,
  TrendingUp,
  UserCircle,
} from "lucide-react";
import { useState } from "react";
import { ProgressBar } from "@/components/dashboard";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TermTooltip } from "@/components/ui/term-tooltip";
import { cn } from "@/lib/utils";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/opportunities/")({
  component: OpportunitiesPage,
});

function getScoreColor(score: number): "emerald" | "amber" | "rose" {
  if (score >= 70) {
    return "emerald";
  }
  if (score >= 40) {
    return "amber";
  }
  return "rose";
}

function getScoreBadgeClass(score: number): string {
  if (score >= 70) {
    return "bg-emerald-500/20 text-emerald-400 ring-emerald-500/40";
  }
  if (score >= 40) {
    return "bg-amber-500/20 text-amber-400 ring-amber-500/40";
  }
  return "bg-rose-500/20 text-rose-400 ring-rose-500/40";
}

interface OpportunityCardProps {
  opportunity: {
    id: string;
    companyName: string;
    customerNumber: string;
    latestCaseNumber: string | null;
    salesRepName: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    meddicScore: { overall: number } | null;
    spinScore: number | null;
    updatedAt: Date;
    wonAt: Date | null;
    lostAt: Date | null;
  };
}

function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const navigate = useNavigate();

  const handleView = (id: string) => {
    navigate({ to: "/opportunities/$id", params: { id } });
  };

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-lg hover:shadow-teal-500/10"
      onClick={() => handleView(opportunity.id)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="truncate font-display font-semibold text-lg">
            {opportunity.companyName}
          </CardTitle>
          {opportunity.latestCaseNumber && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--ds-accent)]/20 px-2.5 py-0.5 font-data font-medium text-[var(--ds-accent)] text-xs ring-1 ring-[var(--ds-accent)]/30">
              {opportunity.latestCaseNumber}
            </span>
          )}
        </div>
        <CardDescription className="font-data">
          客戶編號: {opportunity.customerNumber}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 業務代表 */}
        <div className="flex items-center gap-2 text-sm">
          <UserCircle className="h-4 w-4 text-[var(--ds-accent)]" />
          <span className="font-data text-muted-foreground">
            {opportunity.salesRepName || "未指派"}
          </span>
        </div>

        {/* 聯絡人資訊 */}
        <div className="space-y-2">
          {opportunity.contactName && (
            <div className="font-medium text-sm">{opportunity.contactName}</div>
          )}
          {opportunity.contactEmail && (
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Mail className="h-3 w-3" />
              <span className="font-data">{opportunity.contactEmail}</span>
            </div>
          )}
          {opportunity.contactPhone && (
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Phone className="h-3 w-3" />
              <span className="font-data">{opportunity.contactPhone}</span>
            </div>
          )}
        </div>

        {/* PDCM & SPIN 分數 */}
        <div className="grid grid-cols-2 gap-4">
          {/* PDCM Score */}
          <div className="flex flex-col items-center justify-center rounded-lg bg-muted/50 p-4">
            <div className="mb-2 font-data text-muted-foreground text-xs uppercase">
              PDCM
            </div>
            {opportunity.meddicScore ? (
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-full font-bold font-data text-sm ring-1",
                    getScoreBadgeClass(opportunity.meddicScore.overall)
                  )}
                >
                  P
                </span>
                <span className="font-data font-semibold text-lg">
                  {opportunity.meddicScore.overall}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">-</span>
            )}
          </div>

          {/* SPIN Score */}
          <div className="flex flex-col items-center justify-center rounded-lg bg-muted/50 p-4">
            <div className="mb-2 font-data text-muted-foreground text-xs uppercase">
              SPIN
            </div>
            {opportunity.spinScore !== null ? (
              <div className="flex w-full flex-col items-center gap-2">
                <div className="w-full">
                  <ProgressBar
                    animated={false}
                    color={getScoreColor(opportunity.spinScore)}
                    size="sm"
                    value={opportunity.spinScore}
                  />
                </div>
                <span className="font-data font-semibold text-[var(--ds-accent)] text-sm">
                  {opportunity.spinScore}%
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">-</span>
            )}
          </div>
        </div>

        {/* 更新時間 */}
        <div className="border-border/50 border-t pt-3 text-center">
          <span className="font-data text-muted-foreground text-xs">
            {opportunity.wonAt
              ? `成交於 ${new Intl.DateTimeFormat("zh-TW", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }).format(new Date(opportunity.wonAt))}`
              : opportunity.lostAt
                ? `拒絕於 ${new Intl.DateTimeFormat("zh-TW", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  }).format(new Date(opportunity.lostAt))}`
                : `更新於 ${new Intl.DateTimeFormat("zh-TW", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  }).format(new Date(opportunity.updatedAt))}`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function OpportunitiesPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState<"active" | "won" | "lost">(
    "active"
  );
  const pageSize = 20;

  const opportunitiesQuery = useQuery({
    queryKey: [
      "opportunities",
      "list",
      {
        status:
          activeTab === "won"
            ? "won"
            : activeTab === "lost"
              ? "lost"
              : undefined,
        search: search || undefined,
        limit: pageSize,
        offset: page * pageSize,
      },
    ],
    queryFn: async () => {
      const result = await client.opportunities.list({
        status:
          activeTab === "won"
            ? "won"
            : activeTab === "lost"
              ? "lost"
              : undefined,
        search: search || undefined,
        limit: pageSize,
        offset: page * pageSize,
      });
      return result;
    },
  });

  const opportunities = opportunitiesQuery.data?.opportunities ?? [];
  const isLoading = opportunitiesQuery.isLoading;
  const totalCount = opportunitiesQuery.data?.total ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleView = (id: string) => {
    navigate({ to: "/opportunities/$id", params: { id } });
  };

  return (
    <main className="ds-page">
      <div className="ds-page-content">
        {/* Page Header */}
        <PageHeader
          className="animate-fade-in-up opacity-0"
          style={{ animationDelay: "0ms", animationFillMode: "forwards" }}
          subtitle="管理所有銷售機會和客戶資料"
          title="機會管理"
        >
          <Button
            className="bg-[var(--ds-accent)] text-white shadow-lg shadow-teal-500/20 transition-all hover:bg-[var(--ds-accent-dark)] hover:shadow-teal-500/30"
            onClick={() => navigate({ to: "/opportunities/new" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            新增機會
          </Button>
        </PageHeader>

        {/* Search Bar */}
        <div
          className="animate-fade-in-up opacity-0"
          style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
        >
          <div className="relative max-w-md">
            <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 rounded-full border-transparent bg-muted/50 pl-11 transition-all focus:border-[var(--ds-accent)] focus:ring-2 focus:ring-[var(--ds-accent-glow)]"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="搜尋公司、聯絡人..."
              value={search}
            />
          </div>
        </div>

        {/* Tabs */}
        <div
          className="animate-fade-in-up opacity-0"
          style={{ animationDelay: "150ms", animationFillMode: "forwards" }}
        >
          <Tabs
            onValueChange={(v) => {
              setActiveTab(v as "active" | "won" | "lost");
              setPage(0);
            }}
            value={activeTab}
          >
            <TabsList className="h-auto w-full justify-start rounded-none border-border border-b bg-transparent p-0">
              <TabsTrigger
                className="rounded-none border-transparent border-b-2 bg-transparent px-6 py-4 font-data text-sm uppercase tracking-wider transition-all duration-300 data-[state=active]:border-[var(--ds-accent)] data-[state=active]:text-[var(--ds-accent)]"
                value="active"
              >
                進行中
              </TabsTrigger>
              <TabsTrigger
                className="rounded-none border-transparent border-b-2 bg-transparent px-6 py-4 font-data text-sm uppercase tracking-wider transition-all duration-300 data-[state=active]:border-[var(--ds-accent)] data-[state=active]:text-[var(--ds-accent)]"
                value="won"
              >
                已成交
              </TabsTrigger>
              <TabsTrigger
                className="rounded-none border-transparent border-b-2 bg-transparent px-6 py-4 font-data text-sm uppercase tracking-wider transition-all duration-300 data-[state=active]:border-[var(--ds-accent)] data-[state=active]:text-[var(--ds-accent)]"
                value="lost"
              >
                已拒絕
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Table - Desktop View */}
        <div
          className="ds-card hidden animate-fade-in-up opacity-0 lg:block"
          style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
        >
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="font-data font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[var(--ds-accent)]" />
                    公司名稱
                  </div>
                </TableHead>
                <TableHead className="font-data font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  業務
                </TableHead>
                <TableHead className="font-data font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  案件編號
                </TableHead>
                <TableHead className="font-data font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  客戶編號
                </TableHead>
                <TableHead className="font-data font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  聯絡人
                </TableHead>
                <TableHead className="font-data font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  <TermTooltip termKey="pdcmScore">PDCM</TermTooltip>
                </TableHead>
                <TableHead className="font-data font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[var(--ds-accent)]" />
                    <TermTooltip termKey="spinScore">SPIN</TermTooltip>
                  </div>
                </TableHead>
                <TableHead className="font-data font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  上次更新
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow className="border-border/30" key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  </TableRow>
                ))
              ) : opportunities.length > 0 ? (
                opportunities.map((opportunity, index) => (
                  <TableRow
                    className={cn(
                      "border-border/30 transition-all duration-200",
                      index % 2 === 0 ? "bg-transparent" : "bg-muted/30"
                    )}
                    key={opportunity.id}
                  >
                    <TableCell className="font-display font-medium">
                      <button
                        className="cursor-pointer text-left hover:text-[var(--ds-accent)] hover:underline"
                        onClick={() => handleView(opportunity.id)}
                      >
                        {opportunity.companyName}
                      </button>
                    </TableCell>
                    <TableCell className="font-data text-muted-foreground text-sm">
                      {opportunity.salesRepName || "-"}
                    </TableCell>
                    <TableCell className="font-data text-muted-foreground text-sm">
                      {opportunity.latestCaseNumber || "-"}
                    </TableCell>
                    <TableCell className="font-data text-muted-foreground text-sm">
                      {opportunity.customerNumber}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {opportunity.contactName || "-"}
                        </div>
                        {opportunity.contactEmail && (
                          <div className="flex items-center gap-1 text-muted-foreground text-xs">
                            <Mail className="h-3 w-3" />
                            <span className="font-data">
                              {opportunity.contactEmail}
                            </span>
                          </div>
                        )}
                        {opportunity.contactPhone && (
                          <div className="flex items-center gap-1 text-muted-foreground text-xs">
                            <Phone className="h-3 w-3" />
                            <span className="font-data">
                              {opportunity.contactPhone}
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {opportunity.meddicScore ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex h-7 w-7 items-center justify-center rounded-full font-bold font-data text-xs ring-1",
                              getScoreBadgeClass(
                                opportunity.meddicScore.overall
                              )
                            )}
                          >
                            P
                          </span>
                          <span className="font-data font-semibold">
                            {opportunity.meddicScore.overall}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {opportunity.spinScore !== null ? (
                        <div className="flex items-center gap-3">
                          <div className="w-16">
                            <ProgressBar
                              animated={false}
                              color={getScoreColor(opportunity.spinScore)}
                              size="sm"
                              value={opportunity.spinScore}
                            />
                          </div>
                          <span className="font-data font-semibold text-[var(--ds-accent)] text-sm">
                            {opportunity.spinScore}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-data text-muted-foreground text-sm">
                      {opportunity.wonAt
                        ? `成交於 ${new Intl.DateTimeFormat("zh-TW", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }).format(new Date(opportunity.wonAt))}`
                        : opportunity.lostAt
                          ? `拒絕於 ${new Intl.DateTimeFormat("zh-TW", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }).format(new Date(opportunity.lostAt))}`
                          : `更新於 ${new Intl.DateTimeFormat("zh-TW", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }).format(new Date(opportunity.updatedAt))}`}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="h-32 text-center" colSpan={8}>
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Building2 className="h-10 w-10 opacity-30" />
                      <p className="font-display">沒有找到資料</p>
                      <p className="text-sm">嘗試調整搜尋條件</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Card View - Mobile/Tablet */}
        <div
          className="animate-fade-in-up space-y-4 opacity-0 lg:hidden"
          style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
        >
          {isLoading && (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <div className="grid grid-cols-2 gap-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}

          {!isLoading && opportunities.length > 0 && (
            <>
              {opportunities.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                />
              ))}
            </>
          )}

          {!isLoading && opportunities.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="mb-4 h-12 w-12 text-muted-foreground opacity-30" />
                <p className="font-display text-lg">沒有找到資料</p>
                <p className="text-muted-foreground text-sm">
                  嘗試調整搜尋條件
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Pagination */}
        <div
          className="flex animate-fade-in-up items-center justify-between opacity-0"
          style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
        >
          <div className="font-data text-muted-foreground text-sm">
            共{" "}
            <span className="font-semibold text-foreground">{totalCount}</span>{" "}
            筆資料
          </div>
          <div className="flex items-center gap-3">
            <Button
              className="rounded-full px-4 disabled:opacity-30"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              size="sm"
              variant="outline"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              上一頁
            </Button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                const pageNum =
                  Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                if (pageNum >= totalPages) {
                  return null;
                }
                return (
                  <button
                    className={cn(
                      "h-8 w-8 rounded-full font-data text-sm transition-all",
                      pageNum === page
                        ? "bg-[var(--ds-accent)] text-white shadow-lg shadow-teal-500/30"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
            </div>
            <Button
              className="rounded-full px-4 disabled:opacity-30"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              size="sm"
              variant="outline"
            >
              下一頁
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
