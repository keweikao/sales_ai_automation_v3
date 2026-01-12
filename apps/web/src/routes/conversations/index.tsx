/**
 * Conversations 列表頁面
 * 顯示所有對話記錄
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/conversations/")({
  component: ConversationsPage,
});

const typeOptions = [
  { value: "discovery_call", label: "需求訪談" },
  { value: "demo", label: "產品展示" },
  { value: "follow_up", label: "跟進電話" },
  { value: "negotiation", label: "議價討論" },
  { value: "closing", label: "成交會議" },
  { value: "support", label: "客服支援" },
] as const;

const statusOptions = [
  { value: "pending", label: "待處理", color: "bg-gray-500" },
  { value: "transcribing", label: "轉錄中", color: "bg-blue-500" },
  { value: "transcribed", label: "已轉錄", color: "bg-yellow-500" },
  { value: "analyzing", label: "分析中", color: "bg-purple-500" },
  { value: "completed", label: "已完成", color: "bg-green-500" },
  { value: "failed", label: "失敗", color: "bg-red-500" },
] as const;

function getTypeLabel(type: string): string {
  return typeOptions.find((t) => t.value === type)?.label || type;
}

function getStatusInfo(status: string) {
  return (
    statusOptions.find((s) => s.value === status) || {
      value: status,
      label: status,
      color: "bg-gray-500",
    }
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function ConversationsPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const conversationsQuery = useQuery(
    orpc.conversations.list.queryOptions({
      limit: pageSize,
      offset: page * pageSize,
    })
  );

  const conversations = conversationsQuery.data?.conversations ?? [];
  const isLoading = conversationsQuery.isLoading;
  const totalCount = conversationsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const filteredConversations = search
    ? conversations.filter(
        (c) =>
          c.title?.toLowerCase().includes(search.toLowerCase()) ||
          c.opportunityCompanyName
            ?.toLowerCase()
            .includes(search.toLowerCase()) ||
          c.caseNumber?.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  return (
    <main className="container mx-auto space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">對話記錄</h1>
          <p className="text-muted-foreground">管理銷售對話和 MEDDIC 分析</p>
        </div>
        <Button asChild>
          <Link to="/conversations/new">
            <Plus className="mr-2 h-4 w-4" />
            上傳對話
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋對話、公司名稱..."
            value={search}
          />
        </div>
      </div>

      {/* Conversation Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card className="overflow-hidden" key={i}>
              <CardContent className="p-0">
                <div className="space-y-4 p-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredConversations.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredConversations.map((conversation) => {
            const statusInfo = getStatusInfo(conversation.status);
            return (
              <Card
                className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
                key={conversation.id}
                onClick={() =>
                  navigate({
                    to: "/conversations/$id",
                    params: { id: conversation.id },
                  })
                }
              >
                <CardContent className="p-0">
                  {/* Status Bar */}
                  <div className={`h-1 ${statusInfo.color}`} />

                  <div className="space-y-4 p-4">
                    {/* Title */}
                    <div>
                      <h3 className="line-clamp-1 font-semibold">
                        {conversation.title || "未命名對話"}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {conversation.caseNumber}
                      </p>
                    </div>

                    {/* Company Info */}
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Building2 className="h-4 w-4" />
                      <span>{conversation.opportunityCompanyName}</span>
                      <span className="text-xs">
                        ({conversation.customerNumber})
                      </span>
                    </div>

                    {/* Meta Info */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {getTypeLabel(conversation.type)}
                      </Badge>
                      <Badge className={statusInfo.color}>
                        {statusInfo.label}
                      </Badge>
                      {conversation.hasAnalysis && (
                        <Badge variant="secondary">已分析</Badge>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t pt-3 text-muted-foreground text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDuration(conversation.duration)}</span>
                      </div>
                      {conversation.conversationDate && (
                        <span>
                          {new Date(
                            conversation.conversationDate
                          ).toLocaleDateString("zh-TW")}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-semibold text-lg">尚無對話記錄</h3>
            <p className="mt-2 text-muted-foreground">
              上傳音檔開始分析銷售對話
            </p>
            <Button asChild className="mt-4">
              <Link to="/conversations/new">
                <Plus className="mr-2 h-4 w-4" />
                上傳對話
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!isLoading && totalCount > pageSize && (
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
      )}
    </main>
  );
}
