/**
 * Opportunities 列表頁面
 * 顯示所有商機並支援搜尋、篩選、分頁
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpDown,
  Building2,
  ChevronLeft,
  ChevronRight,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LeadStatusBadge } from "@/components/lead/lead-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/opportunities/")({
  component: OpportunitiesPage,
});

const statusOptions = [
  { value: "new", label: "新建立" },
  { value: "contacted", label: "已聯繫" },
  { value: "qualified", label: "已合格" },
  { value: "proposal", label: "報價中" },
  { value: "negotiation", label: "議價中" },
  { value: "won", label: "成交" },
  { value: "lost", label: "流失" },
] as const;

function getScoreBarColor(score: number): string {
  if (score >= 70) {
    return "bg-green-500";
  }
  if (score >= 40) {
    return "bg-yellow-500";
  }
  return "bg-red-500";
}

function OpportunitiesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const opportunitiesQuery = useQuery(
    orpc.opportunities.list.queryOptions({
      search: search || undefined,
      status:
        statusFilter !== "all"
          ? (statusFilter as
              | "new"
              | "contacted"
              | "qualified"
              | "proposal"
              | "negotiation"
              | "won"
              | "lost")
          : undefined,
      limit: pageSize,
      offset: page * pageSize,
    })
  );

  const deleteMutation = useMutation({
    mutationFn: (opportunityId: string) =>
      client.opportunities.delete({ opportunityId }),
    onSuccess: () => {
      toast.success("商機已刪除");
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: () => {
      toast.error("刪除失敗");
    },
  });

  const opportunities = opportunitiesQuery.data?.opportunities ?? [];
  const isLoading = opportunitiesQuery.isLoading;
  const totalCount = opportunitiesQuery.data?.total ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleView = (id: string) => {
    navigate({ to: "/opportunities/$id", params: { id } });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("確定要刪除這個商機嗎？")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <main className="container mx-auto space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">商機管理</h1>
          <p className="text-muted-foreground">管理所有銷售商機和客戶資料</p>
        </div>
        <Button asChild>
          <Link to="/opportunities/new">
            <Plus className="mr-2 h-4 w-4" />
            新增商機
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="搜尋公司、聯絡人..."
            value={search}
          />
        </div>
        <Select
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(0);
          }}
          value={statusFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="全部狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  公司名稱
                </div>
              </TableHead>
              <TableHead>客戶編號</TableHead>
              <TableHead>聯絡人</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  分數
                </div>
              </TableHead>
              <TableHead>MEDDIC</TableHead>
              <TableHead>上次更新</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))
            ) : opportunities.length > 0 ? (
              opportunities.map((opportunity) => (
                <TableRow
                  className="cursor-pointer"
                  key={opportunity.id}
                  onClick={() => handleView(opportunity.id)}
                >
                  <TableCell className="font-medium">
                    {opportunity.companyName}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {opportunity.customerNumber}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div>{opportunity.contactName || "-"}</div>
                      {opportunity.contactEmail && (
                        <div className="flex items-center gap-1 text-muted-foreground text-xs">
                          <Mail className="h-3 w-3" />
                          {opportunity.contactEmail}
                        </div>
                      )}
                      {opportunity.contactPhone && (
                        <div className="flex items-center gap-1 text-muted-foreground text-xs">
                          <Phone className="h-3 w-3" />
                          {opportunity.contactPhone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <LeadStatusBadge status={opportunity.status} />
                  </TableCell>
                  <TableCell>
                    {opportunity.opportunityScore !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              getScoreBarColor(opportunity.opportunityScore)
                            )}
                            style={{
                              width: `${opportunity.opportunityScore}%`,
                            }}
                          />
                        </div>
                        <span className="font-medium text-sm">
                          {opportunity.opportunityScore}
                        </span>
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {opportunity.meddicScore ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded-full font-bold text-white text-xs",
                            getScoreBarColor(opportunity.meddicScore.overall)
                          )}
                        >
                          M
                        </span>
                        <span className="font-medium">
                          {opportunity.meddicScore.overall}
                        </span>
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Intl.DateTimeFormat("zh-TW", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    }).format(new Date(opportunity.updatedAt))}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md p-0 hover:bg-muted"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="sr-only">開啟選單</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>操作</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleView(opportunity.id);
                          }}
                        >
                          查看詳情
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate({
                              to: "/opportunities/$id/edit",
                              params: { id: opportunity.id },
                            });
                          }}
                        >
                          編輯
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(opportunity.id);
                          }}
                        >
                          刪除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-24 text-center" colSpan={8}>
                  沒有找到資料
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">
          共 {totalCount} 筆資料
        </div>
        <div className="flex items-center gap-2">
          <Button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            size="sm"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
            上一頁
          </Button>
          <div className="text-sm">
            第 {page + 1} / {Math.max(1, totalPages)} 頁
          </div>
          <Button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            size="sm"
            variant="outline"
          >
            下一頁
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </main>
  );
}
