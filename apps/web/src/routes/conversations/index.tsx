/**
 * Conversations 列表頁面 - Precision Analytics Design
 * 工業風格的對話記錄管理介面
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { client } from "@/utils/orpc";

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
  {
    value: "pending",
    label: "PENDING",
    color: "bg-slate-500",
    textColor: "text-slate-400",
    icon: Clock,
  },
  {
    value: "transcribing",
    label: "TRANSCRIBING",
    color: "bg-purple-500",
    textColor: "text-purple-400",
    icon: Loader2,
  },
  {
    value: "transcribed",
    label: "TRANSCRIBED",
    color: "bg-yellow-500",
    textColor: "text-yellow-400",
    icon: CheckCircle2,
  },
  {
    value: "analyzing",
    label: "ANALYZING",
    color: "bg-purple-500",
    textColor: "text-purple-400",
    icon: BarChart3,
  },
  {
    value: "completed",
    label: "COMPLETED",
    color: "bg-emerald-500",
    textColor: "text-emerald-400",
    icon: CheckCircle2,
  },
  {
    value: "failed",
    label: "FAILED",
    color: "bg-red-500",
    textColor: "text-red-400",
    icon: AlertCircle,
  },
] as const;

function getTypeLabel(type: string): string {
  return typeOptions.find((t) => t.value === type)?.label || type;
}

function getStatusInfo(status: string) {
  return (
    statusOptions.find((s) => s.value === status) || {
      value: status,
      label: status.toUpperCase(),
      color: "bg-gray-500",
      textColor: "text-gray-400",
      icon: Clock,
    }
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds) {
    return "-";
  }
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

  const conversationsQuery = useQuery({
    queryKey: [
      "conversations",
      "list",
      { limit: pageSize, offset: page * pageSize },
    ],
    queryFn: async () => {
      const result = await client.conversations.list({
        limit: pageSize,
        offset: page * pageSize,
      });
      return result;
    },
  });

  const conversations = conversationsQuery.data?.items ?? [];
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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        .grid-pattern {
          background-image:
            linear-gradient(rgba(99, 94, 246, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99, 94, 246, 0.05) 1px, transparent 1px);
          background-size: 20px 20px;
        }

        .conversation-card {
          animation: fadeInUp 0.4s ease-out backwards;
        }

        .conversation-card:nth-child(1) { animation-delay: 0.05s; }
        .conversation-card:nth-child(2) { animation-delay: 0.1s; }
        .conversation-card:nth-child(3) { animation-delay: 0.15s; }
        .conversation-card:nth-child(4) { animation-delay: 0.2s; }
        .conversation-card:nth-child(5) { animation-delay: 0.25s; }
        .conversation-card:nth-child(6) { animation-delay: 0.3s; }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
        }

        .status-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .data-font {
          font-family: 'JetBrains Mono', monospace;
        }

        .title-font {
          font-family: 'Playfair Display', serif;
        }

        .search-glow {
          box-shadow: 0 0 0 0 rgba(99, 94, 246, 0.4);
          transition: box-shadow 0.3s ease;
        }

        .search-glow:focus-within {
          box-shadow: 0 0 0 3px rgba(99, 94, 246, 0.2);
        }
      `}</style>

      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Background decorative elements */}
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute top-0 right-0 h-96 w-96 bg-purple-600/5 blur-[120px]" />
          <div className="absolute bottom-0 left-0 h-96 w-96 bg-purple-500/5 blur-[120px]" />
        </div>

        <div className="container relative mx-auto space-y-6 p-6">
          {/* Page Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-purple-600 shadow-lg shadow-purple-600/20">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="title-font bg-gradient-to-r from-purple-400 to-purple-400 bg-clip-text font-bold text-3xl text-transparent tracking-tight">
                    Conversations
                  </h1>
                  <p className="data-font text-slate-500 text-xs uppercase tracking-wider">
                    Sales Call Records & Analysis
                  </p>
                </div>
              </div>
            </div>
            <Button
              asChild
              className="border-purple-600/50 bg-gradient-to-r from-purple-700 to-purple-600 font-mono text-sm shadow-lg shadow-purple-600/20 hover:from-purple-600 hover:to-purple-500"
              size="lg"
            >
              <Link to="/conversations/new">
                <Plus className="mr-2 h-4 w-4" />
                UPLOAD
              </Link>
            </Button>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="search-glow relative flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-purple-400" />
              <Input
                className="data-font h-12 border-slate-700 bg-slate-900/50 pl-11 text-white placeholder:text-slate-500 focus:border-purple-600/50 focus:ring-purple-600/20"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations, companies..."
                value={search}
              />
            </div>
            <div className="data-font flex items-center gap-2 text-slate-400 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-800/50 ring-1 ring-slate-700">
                <BarChart3 className="h-4 w-4 text-purple-400" />
              </div>
              <span className="uppercase tracking-wider">
                {totalCount} RECORDS
              </span>
            </div>
          </div>

          {/* Conversation Cards */}
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/50 p-4"
                  key={i}
                >
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-3/4 bg-slate-800" />
                    <Skeleton className="h-4 w-1/2 bg-slate-800" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-20 bg-slate-800" />
                      <Skeleton className="h-6 w-16 bg-slate-800" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredConversations.map((conversation) => {
                const statusInfo = getStatusInfo(conversation.status);
                const StatusIcon = statusInfo.icon;
                return (
                  <div
                    className="conversation-card group relative cursor-pointer overflow-hidden rounded-lg border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 transition-all duration-300 hover:border-purple-600/50 hover:shadow-lg hover:shadow-purple-600/10"
                    key={conversation.id}
                    onClick={() =>
                      navigate({
                        to: "/conversations/$id",
                        params: { id: conversation.id },
                      })
                    }
                  >
                    {/* Background pattern */}
                    <div className="pointer-events-none absolute inset-0 opacity-5">
                      <div className="grid-pattern h-full w-full" />
                    </div>

                    {/* Status indicator line */}
                    <div
                      className={`absolute top-0 left-0 h-1 w-full ${statusInfo.color}`}
                    />

                    <CardContent className="relative space-y-4 p-4">
                      {/* Header with Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 font-semibold text-white leading-tight">
                            {conversation.title || "Untitled Conversation"}
                          </h3>
                          <p className="data-font mt-1 text-slate-500 text-xs">
                            {conversation.caseNumber}
                          </p>
                        </div>
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${statusInfo.color}/20 ring-1 ring-${statusInfo.color}/30`}
                        >
                          <StatusIcon
                            className={`h-4 w-4 ${statusInfo.textColor} ${conversation.status === "transcribing" || conversation.status === "analyzing" ? "animate-spin" : ""}`}
                          />
                        </div>
                      </div>

                      {/* Company Info */}
                      <div className="flex items-center gap-2 rounded bg-slate-800/30 px-3 py-2 ring-1 ring-slate-700/50">
                        <Building2 className="h-4 w-4 shrink-0 text-purple-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-white">
                            {conversation.opportunityCompanyName}
                          </p>
                          <p className="data-font text-slate-500 text-xs">
                            {conversation.customerNumber}
                          </p>
                        </div>
                      </div>

                      {/* Meta Tags */}
                      <div className="flex flex-wrap gap-2">
                        <div className="data-font rounded bg-slate-800/50 px-2 py-1 text-slate-400 text-xs uppercase tracking-wider ring-1 ring-slate-700/50">
                          {getTypeLabel(conversation.type)}
                        </div>
                        <div
                          className={`data-font rounded px-2 py-1 text-xs uppercase tracking-wider ${statusInfo.color}/20 ${statusInfo.textColor} ring-1 ring-${statusInfo.color}/30`}
                        >
                          {statusInfo.label}
                        </div>
                        {conversation.hasAnalysis && (
                          <div className="data-font rounded bg-emerald-500/20 px-2 py-1 text-emerald-400 text-xs uppercase tracking-wider ring-1 ring-emerald-500/30">
                            ANALYZED
                          </div>
                        )}
                      </div>

                      {/* Footer Info */}
                      <div className="flex items-center justify-between border-slate-800 border-t pt-3">
                        <div className="data-font flex items-center gap-1.5 text-slate-500 text-xs">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatDuration(conversation.duration)}</span>
                        </div>
                        {conversation.conversationDate && (
                          <span className="data-font text-slate-500 text-xs">
                            {new Date(
                              conversation.conversationDate
                            ).toLocaleDateString("zh-TW", {
                              month: "2-digit",
                              day: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="border-slate-800 bg-slate-950/50">
              <CardContent className="py-16 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-800/50 ring-1 ring-slate-700">
                  <MessageSquare className="h-10 w-10 text-slate-600" />
                </div>
                <h3 className="title-font mb-2 font-semibold text-white text-xl">
                  No Conversations Yet
                </h3>
                <p className="data-font mb-6 text-slate-500 text-sm uppercase tracking-wider">
                  Upload audio to begin analysis
                </p>
                <Button
                  asChild
                  className="border-purple-600/50 bg-gradient-to-r from-purple-700 to-purple-600 font-mono shadow-lg shadow-purple-600/20 hover:from-purple-600 hover:to-purple-500"
                  size="lg"
                >
                  <Link to="/conversations/new">
                    <Plus className="mr-2 h-4 w-4" />
                    UPLOAD CONVERSATION
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {!isLoading && totalCount > pageSize && (
            <div className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="data-font text-slate-400 text-sm uppercase tracking-wider">
                Total: {totalCount} Records
              </div>
              <div className="flex items-center gap-3">
                <Button
                  className="data-font border-slate-700 bg-slate-900/50 text-slate-300 hover:border-purple-600/50 hover:bg-slate-800 hover:text-white"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  size="sm"
                  variant="outline"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  PREV
                </Button>
                <div className="data-font flex h-9 items-center rounded border border-slate-700 bg-slate-900/50 px-4 text-sm text-white">
                  <span className="text-purple-400">{page + 1}</span>
                  <span className="mx-2 text-slate-600">/</span>
                  <span>{Math.max(1, totalPages)}</span>
                </div>
                <Button
                  className="data-font border-slate-700 bg-slate-900/50 text-slate-300 hover:border-purple-600/50 hover:bg-slate-800 hover:text-white"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  size="sm"
                  variant="outline"
                >
                  NEXT
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
