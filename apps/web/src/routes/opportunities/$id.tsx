/**
 * Opportunity 詳情頁面
 * 顯示機會詳細資訊、嵌入對話內容、PDCM+SPIN 分析
 * Precision Dashboard Design System
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  HandMetal,
  Lightbulb,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Target,
  TrendingUp,
  Trophy,
  User,
} from "lucide-react";
import { useRef, useState } from "react";

import { LeadStatusBadge } from "@/components/lead/lead-status-badge";
import {
  type CompetitorAnalysis,
  CompetitorAnalysisCard,
} from "@/components/meddic/competitor-analysis-card";
import { PdcmScoreCard } from "@/components/meddic/pdcm-score-card";
import {
  PdcmSpinAlerts,
  type PdcmSpinAlertsData,
} from "@/components/meddic/pdcm-spin-alerts";
import { SpinProgressCard } from "@/components/meddic/spin-progress-card";
import {
  type TacticalSuggestion,
  TacticalSuggestions,
} from "@/components/meddic/tactical-suggestions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/opportunities/$id")({
  component: OpportunityDetailPage,
});

function getConversationTypeLabel(type: string): string {
  const types: Record<string, string> = {
    discovery_call: "需求訪談",
    demo: "產品展示",
    follow_up: "跟進電話",
    negotiation: "議價討論",
    closing: "成交會議",
    support: "客服支援",
  };
  return types[type] || type;
}

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; textColor: string }
> = {
  pending: {
    label: "待處理",
    color: "bg-slate-500",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-400",
  },
  transcribing: {
    label: "轉錄中",
    color: "bg-purple-500",
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-400",
  },
  transcribed: {
    label: "已轉錄",
    color: "bg-amber-500",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-400",
  },
  analyzing: {
    label: "分析中",
    color: "bg-purple-500",
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-400",
  },
  completed: {
    label: "已完成",
    color: "bg-emerald-500",
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-400",
  },
  failed: {
    label: "失敗",
    color: "bg-red-500",
    bgColor: "bg-red-500/10",
    textColor: "text-red-400",
  },
};

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

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Timeline event types
type TimelineEventType =
  | "todo_created"
  | "todo_completed"
  | "todo_postponed"
  | "todo_won"
  | "todo_lost"
  | "conversation_uploaded"
  | "conversation_analyzed"
  | "opportunity_created"
  | "opportunity_updated";

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  timestamp: Date;
  actionVia?: string;
  metadata?: Record<string, unknown>;
}

function buildTimeline(opportunity: {
  createdAt: Date;
  updatedAt: Date;
  conversations?: Array<{
    id: string;
    title: string | null;
    type: string;
    status: string;
    conversationDate: Date | null;
    createdAt: Date;
    latestAnalysis?: { createdAt: Date } | null;
  }>;
  salesTodos?: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: Date;
    completionRecord?: { completedAt: string; result: string } | null;
    wonRecord?: { wonAt: string; note?: string } | null;
    lostRecord?: { lostAt: string; reason: string } | null;
  }>;
  todoLogs?: Array<{
    id: string;
    todoId: string;
    action: string;
    actionVia: string;
    changes: Record<string, unknown>;
    note?: string | null;
    createdAt: Date;
  }>;
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Add opportunity creation event
  events.push({
    id: "opp-created",
    type: "opportunity_created",
    title: "商機建立",
    timestamp: new Date(opportunity.createdAt),
  });

  // Add conversation events
  for (const conv of opportunity.conversations ?? []) {
    events.push({
      id: `conv-${conv.id}`,
      type: "conversation_uploaded",
      title: conv.title || "對話記錄",
      description: `類型: ${conv.type}`,
      timestamp: new Date(conv.conversationDate ?? conv.createdAt),
    });

    if (conv.latestAnalysis && conv.status === "completed") {
      events.push({
        id: `analysis-${conv.id}`,
        type: "conversation_analyzed",
        title: "分析完成",
        description: conv.title || "對話記錄",
        timestamp: new Date(conv.latestAnalysis.createdAt),
      });
    }
  }

  // Add todo log events
  for (const log of opportunity.todoLogs ?? []) {
    const todo = opportunity.salesTodos?.find((t) => t.id === log.todoId);
    const todoTitle = todo?.title || "待辦事項";

    switch (log.action) {
      case "create":
        events.push({
          id: `log-${log.id}`,
          type: "todo_created",
          title: `建立待辦: ${todoTitle}`,
          timestamp: new Date(log.createdAt),
          actionVia: log.actionVia,
        });
        break;
      case "complete":
        events.push({
          id: `log-${log.id}`,
          type: "todo_completed",
          title: `完成待辦: ${todoTitle}`,
          description: log.note || undefined,
          timestamp: new Date(log.createdAt),
          actionVia: log.actionVia,
        });
        break;
      case "postpone":
        events.push({
          id: `log-${log.id}`,
          type: "todo_postponed",
          title: `改期待辦: ${todoTitle}`,
          description: log.note || undefined,
          timestamp: new Date(log.createdAt),
          actionVia: log.actionVia,
          metadata: log.changes,
        });
        break;
      case "won":
        events.push({
          id: `log-${log.id}`,
          type: "todo_won",
          title: `成交: ${todoTitle}`,
          description: log.note || undefined,
          timestamp: new Date(log.createdAt),
          actionVia: log.actionVia,
        });
        break;
      case "lost": {
        // 從 changes 中取得 lostRecord
        const lostRecord = log.changes?.lostRecord as
          | { reason?: string; competitor?: string }
          | undefined;
        const lostReason = lostRecord?.reason;
        const competitor = lostRecord?.competitor;

        events.push({
          id: `log-${log.id}`,
          type: "todo_lost",
          title: `結案: ${todoTitle}`,
          description: lostReason
            ? `原因: ${lostReason}${competitor ? ` | 競品: ${competitor}` : ""}`
            : log.note || undefined,
          timestamp: new Date(log.createdAt),
          actionVia: log.actionVia,
        });
        break;
      }
    }
  }

  // Sort by timestamp descending (most recent first)
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return events;
}

function getTimelineEventIcon(type: TimelineEventType) {
  switch (type) {
    case "todo_created":
      return <FileText className="h-4 w-4" />;
    case "todo_completed":
      return <Check className="h-4 w-4" />;
    case "todo_postponed":
      return <CalendarClock className="h-4 w-4" />;
    case "todo_won":
      return <Trophy className="h-4 w-4" />;
    case "todo_lost":
      return <HandMetal className="h-4 w-4" />;
    case "conversation_uploaded":
      return <MessageSquare className="h-4 w-4" />;
    case "conversation_analyzed":
      return <TrendingUp className="h-4 w-4" />;
    case "opportunity_created":
    case "opportunity_updated":
      return <Calendar className="h-4 w-4" />;
    default:
      return <Calendar className="h-4 w-4" />;
  }
}

function getTimelineEventColor(type: TimelineEventType): string {
  switch (type) {
    case "todo_created":
      return "border-l-purple-500";
    case "todo_completed":
      return "border-l-emerald-500";
    case "todo_postponed":
      return "border-l-amber-400";
    case "todo_won":
      return "border-l-yellow-500";
    case "todo_lost":
      return "border-l-slate-500";
    case "conversation_uploaded":
      return "border-l-blue-500";
    case "conversation_analyzed":
      return "border-l-violet-500";
    case "opportunity_created":
    case "opportunity_updated":
      return "border-l-slate-400";
    default:
      return "border-l-slate-400";
  }
}

function getTimelineEventTextColor(type: TimelineEventType): string {
  switch (type) {
    case "todo_created":
      return "text-purple-500";
    case "todo_completed":
      return "text-emerald-500";
    case "todo_postponed":
      return "text-amber-400";
    case "todo_won":
      return "text-yellow-500";
    case "todo_lost":
      return "text-slate-500";
    case "conversation_uploaded":
      return "text-blue-500";
    case "conversation_analyzed":
      return "text-violet-500";
    case "opportunity_created":
    case "opportunity_updated":
      return "text-slate-400";
    default:
      return "text-slate-400";
  }
}

function OpportunityDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isAddTodoOpen, setIsAddTodoOpen] = useState(false);
  const [todoTitle, setTodoTitle] = useState("");
  const [todoDescription, setTodoDescription] = useState("");
  const [todoDays, setTodoDays] = useState(7);

  // Reject opportunity state
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  // Win opportunity state
  const [isWinDialogOpen, setIsWinDialogOpen] = useState(false);

  // Audio player ref for segment click
  const audioRef = useRef<HTMLAudioElement>(null);

  // Handle transcript segment click - seek to specific time
  const handleSegmentClick = (startTime: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = startTime;
      audioRef.current.play();
    }
  };

  // Create todo mutation
  const createTodoMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      dueDate: string;
      opportunityId: string;
      source: string;
    }) => {
      return await client.salesTodo.create(data);
    },
    onSuccess: () => {
      // Reset form and close modal
      setTodoTitle("");
      setTodoDescription("");
      setTodoDays(7);
      setIsAddTodoOpen(false);
      // Refetch opportunity data to update timeline
      queryClient.invalidateQueries({
        queryKey: ["opportunities", "get", { opportunityId: id }],
      });
    },
  });

  // Reject opportunity mutation
  const rejectMutation = useMutation({
    mutationFn: async (data: {
      opportunityId: string;
      rejectionReason: string;
      competitor?: string;
      note?: string;
    }) => {
      return await client.opportunities.reject(data);
    },
    onSuccess: () => {
      // Reset form and close modal
      setRejectReason("");
      setCompetitor("");
      setRejectNote("");
      setIsRejectDialogOpen(false);
      // Refetch opportunity data to update status and timeline
      queryClient.invalidateQueries({
        queryKey: ["opportunities", "get", { opportunityId: id }],
      });
      alert("已成功標記為拒絕");
    },
    onError: (error) => {
      alert(`操作失敗：${error.message}`);
    },
  });

  // Handle reject form submission
  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!rejectReason.trim()) {
      alert("請輸入拒絕原因");
      return;
    }

    rejectMutation.mutate({
      opportunityId: id,
      rejectionReason: rejectReason.trim(),
      competitor: competitor.trim() || undefined,
      note: rejectNote.trim() || undefined,
    });
  };

  // Win opportunity mutation
  const winMutation = useMutation({
    mutationFn: async (data: { opportunityId: string }) => {
      return await client.opportunities.win(data);
    },
    onSuccess: () => {
      setIsWinDialogOpen(false);
      // Refetch opportunity data to update status and timeline
      queryClient.invalidateQueries({
        queryKey: ["opportunities", "get", { opportunityId: id }],
      });
      alert("已成功標記為成交");
    },
    onError: (error) => {
      alert(`操作失敗：${error.message}`);
    },
  });

  const opportunityQuery = useQuery({
    queryKey: ["opportunities", "get", { opportunityId: id }],
    queryFn: async () => {
      const result = await client.opportunities.get({ opportunityId: id });
      return result;
    },
  });

  const opportunity = opportunityQuery.data;
  const isLoading = opportunityQuery.isLoading;

  // 取得第一個對話的 ID（每個客戶只會有一個音檔/對話）
  const firstConversationId = opportunity?.conversations?.[0]?.id;

  // 獲取對話詳情（包含 agentOutputs）
  const conversationQuery = useQuery({
    queryKey: ["conversations", "detail", firstConversationId],
    queryFn: () =>
      client.conversations.get({ conversationId: firstConversationId! }),
    enabled: !!firstConversationId,
  });

  const conversation = conversationQuery.data;

  if (isLoading) {
    return (
      <main className="ds-page">
        <div className="ds-page-content">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </main>
    );
  }

  if (!opportunity) {
    return (
      <main className="ds-page">
        <div className="ds-page-content">
          <Card className="ds-card">
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground">找不到此機會</p>
              <Link
                className="mt-4 inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 font-data text-sm transition-all duration-300 hover:bg-muted"
                to="/opportunities"
              >
                返回機會列表
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // 對話狀態資訊
  const conversationStatus = conversation?.status || "pending";
  const statusInfo = statusConfig[conversationStatus] || statusConfig.pending;

  return (
    <main className="ds-page">
      <div className="ds-page-content">
        {/* Page Header */}
        <div className="animate-fade-in-up">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-1 items-start gap-4">
              <Button
                className="h-10 w-10 shrink-0 border-border transition-all duration-300 hover:border-[var(--ds-accent)] hover:text-[var(--ds-accent)]"
                onClick={() => navigate({ to: "/opportunities" })}
                size="icon"
                variant="outline"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <h1 className="truncate font-bold font-display text-2xl tracking-tight sm:text-3xl">
                    {opportunity.companyName}
                  </h1>
                  <LeadStatusBadge status={opportunity.status} />
                </div>
                <p className="font-data text-muted-foreground text-sm tracking-wide">
                  {opportunity.customerNumber}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                className="inline-flex h-8 items-center justify-center rounded-md bg-emerald-600 px-3 font-data text-sm text-white shadow-emerald-500/20 shadow-lg transition-all duration-300 hover:bg-emerald-700"
                onClick={() => setIsWinDialogOpen(true)}
              >
                <Trophy className="mr-2 h-4 w-4" />
                標記為成交
              </Button>
              <Button
                className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--ds-accent)] px-3 font-data text-sm text-white shadow-lg shadow-teal-500/20 transition-all duration-300 hover:bg-[var(--ds-accent-dark)]"
                onClick={() => setIsAddTodoOpen(true)}
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                增加待辦
              </Button>
              <Button
                className="inline-flex h-8 items-center justify-center rounded-md px-3 font-data text-sm shadow-lg transition-all duration-300"
                onClick={() => setIsRejectDialogOpen(true)}
                variant="destructive"
              >
                <HandMetal className="mr-2 h-4 w-4" />
                標記為拒絕
              </Button>
            </div>
            {/* 暫時停用新增對話功能
            <Link
              className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--ds-accent)] px-3 font-data text-sm text-white shadow-lg shadow-teal-500/20 transition-all duration-300 hover:bg-[var(--ds-accent-dark)]"
              search={{ opportunityId: opportunity.id }}
              to="/conversations/new"
            >
              <Plus className="mr-2 h-4 w-4" />
              新增對話
            </Link>
            */}
          </div>
        </div>

        <div className="stagger-1 grid animate-fade-in-up gap-6 lg:grid-cols-[1fr_400px]">
          {/* Main Content */}
          <div className="flex flex-col gap-6">
            {/* Basic Info Card */}
            <Card className="ds-card stagger-2 animate-fade-in-up">
              <div className="border-border border-b p-6">
                <h2 className="font-bold font-display text-xl">基本資訊</h2>
              </div>
              <CardContent className="p-6">
                {(() => {
                  // 解析備註內容為結構化資料
                  const parseNotes = (notes: string | null | undefined) => {
                    if (!notes) {
                      return {};
                    }
                    const result: Record<string, string> = {};
                    const lines = notes.split("\n");
                    for (const line of lines) {
                      const match = line.match(/^(.+?):\s*(.+)$/);
                      if (match) {
                        result[match[1].trim()] = match[2].trim();
                      }
                    }
                    return result;
                  };
                  const parsedNotes = parseNotes(opportunity.notes);
                  const hasStructuredNotes =
                    Object.keys(parsedNotes).length > 0;

                  return (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <InfoItem
                        icon={Building2}
                        label="公司名稱"
                        value={opportunity.companyName}
                      />
                      {opportunity.contactName && (
                        <InfoItem
                          icon={User}
                          label="聯絡人"
                          value={opportunity.contactName}
                        />
                      )}
                      {opportunity.contactPhone && (
                        <InfoItem
                          icon={Phone}
                          label="聯絡電話"
                          value={opportunity.contactPhone}
                        />
                      )}
                      {opportunity.contactEmail && (
                        <InfoItem
                          icon={Mail}
                          label="聯絡信箱"
                          value={opportunity.contactEmail}
                        />
                      )}
                      {hasStructuredNotes ? (
                        <>
                          {parsedNotes.店型 && (
                            <InfoItem
                              icon={Target}
                              label="店型"
                              value={parsedNotes.店型}
                            />
                          )}
                          {parsedNotes.營運型態 && (
                            <InfoItem
                              icon={BarChart3}
                              label="營運型態"
                              value={parsedNotes.營運型態}
                            />
                          )}
                          {parsedNotes["現有 POS"] && (
                            <InfoItem
                              icon={MessageSquare}
                              label="現有 POS"
                              value={parsedNotes["現有 POS"]}
                            />
                          )}
                          {parsedNotes.決策者在場 && (
                            <InfoItem
                              icon={User}
                              label="決策者在場"
                              value={parsedNotes.決策者在場}
                            />
                          )}
                          {parsedNotes.來源 && (
                            <InfoItem
                              icon={FileText}
                              label="來源"
                              value={parsedNotes.來源}
                            />
                          )}
                        </>
                      ) : opportunity.notes ? (
                        <div className="col-span-full">
                          <InfoItem
                            icon={FileText}
                            label="備註"
                            value={opportunity.notes}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Conversation Content */}
            {opportunity.conversations &&
            opportunity.conversations.length > 0 ? (
              <>
                {/* Tabs */}
                <Tabs
                  className="ds-card stagger-3 animate-fade-in-up"
                  defaultValue="analysis"
                >
                  <TabsList className="h-auto w-full justify-start rounded-none border-border border-b bg-transparent p-0">
                    <TabsTrigger
                      className="rounded-none border-transparent border-b-2 bg-transparent px-6 py-4 font-data text-sm uppercase tracking-wider transition-all duration-300 data-[state=active]:border-[var(--ds-accent)] data-[state=active]:text-[var(--ds-accent)]"
                      disabled={!conversation?.analysis}
                      value="analysis"
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      銷售分析
                    </TabsTrigger>
                    <TabsTrigger
                      className="rounded-none border-transparent border-b-2 bg-transparent px-6 py-4 font-data text-sm uppercase tracking-wider transition-all duration-300 data-[state=active]:border-[var(--ds-accent)] data-[state=active]:text-[var(--ds-accent)]"
                      value="transcript"
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      轉錄文字
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent className="mt-6 px-6 pb-6" value="transcript">
                    {conversation?.transcript?.segments &&
                    conversation.transcript.segments.length > 0 ? (
                      <div className="space-y-4">
                        {conversation.transcript.segments.map(
                          (segment, idx) => (
                            <button
                              className="flex w-full cursor-pointer gap-4 rounded-lg border border-border bg-muted/30 p-4 text-left transition-all duration-300 hover:bg-muted/50 hover:ring-2 hover:ring-primary/50"
                              key={idx}
                              onClick={() => handleSegmentClick(segment.start)}
                              title="點擊跳轉至此段落"
                              type="button"
                            >
                              <div className="shrink-0">
                                <Badge
                                  className="px-2.5 py-1 font-data text-xs"
                                  variant="outline"
                                >
                                  <User className="mr-1.5 h-3 w-3" />
                                  {segment.speaker || "說話者"}
                                </Badge>
                                <p className="mt-2 font-data text-[0.7rem] text-muted-foreground">
                                  {formatTime(segment.start)}
                                </p>
                              </div>
                              <p className="flex-1 text-foreground/80 leading-relaxed">
                                {segment.text}
                              </p>
                            </button>
                          )
                        )}
                      </div>
                    ) : conversation?.transcript?.fullText ? (
                      <p className="whitespace-pre-wrap text-foreground/80 leading-relaxed">
                        {conversation.transcript.fullText}
                      </p>
                    ) : (
                      <EmptyState icon={MessageSquare} message="尚無轉錄文字" />
                    )}
                  </TabsContent>

                  <TabsContent className="mt-6 px-6 pb-6" value="analysis">
                    {conversation?.analysis ? (
                      <div className="space-y-6">
                        {/* PDCM+SPIN Analysis Section */}
                        {conversation.analysis.agentOutputs && (
                          <>
                            {/* Two Column Layout */}
                            <div className="grid gap-6 md:grid-cols-2">
                              {/* PDCM Detailed Analysis */}
                              {conversation.analysis.agentOutputs.agent2
                                ?.pdcm_scores && (
                                <Card className="ds-card border-purple-600/20">
                                  <CardContent className="space-y-4 p-4">
                                    <h3 className="flex items-center gap-2 font-display font-semibold text-lg">
                                      <BarChart3 className="h-5 w-5 text-purple-400" />
                                      PDCM 詳細分析
                                    </h3>
                                    {(() => {
                                      const pdcmScores = conversation.analysis
                                        ?.agentOutputs?.agent2?.pdcm_scores as
                                        | Record<string, unknown>
                                        | undefined;
                                      if (!pdcmScores) {
                                        return null;
                                      }

                                      const dimensions = [
                                        { key: "pain", label: "P (痛點)" },
                                        { key: "decision", label: "D (決策)" },
                                        { key: "champion", label: "C (支持)" },
                                        { key: "metrics", label: "M (量化)" },
                                      ];

                                      return dimensions.map(
                                        ({ key, label }) => {
                                          const data = pdcmScores[key] as
                                            | {
                                                score?: number;
                                                evidence?: string[];
                                              }
                                            | undefined;
                                          if (!data) {
                                            return null;
                                          }
                                          const score = data.score ?? 0;
                                          const evidence = data.evidence?.[0];

                                          return (
                                            <div
                                              className="rounded-lg border border-border bg-muted/30 p-3"
                                              key={key}
                                            >
                                              <div className="mb-1 flex items-center justify-between">
                                                <span className="font-data font-semibold text-sm">
                                                  {label}
                                                </span>
                                                <span
                                                  className={`font-bold font-data ${
                                                    score >= 60
                                                      ? "text-[var(--ds-success)]"
                                                      : score >= 30
                                                        ? "text-[var(--ds-warning)]"
                                                        : "text-[var(--ds-danger)]"
                                                  }`}
                                                >
                                                  {score}分
                                                </span>
                                              </div>
                                              {evidence && (
                                                <p className="font-data text-muted-foreground text-xs leading-relaxed">
                                                  {evidence}
                                                </p>
                                              )}
                                            </div>
                                          );
                                        }
                                      );
                                    })()}
                                  </CardContent>
                                </Card>
                              )}

                              {/* SPIN Detailed Analysis */}
                              {conversation.analysis.agentOutputs.agent3
                                ?.spin_analysis && (
                                <Card className="ds-card border-cyan-600/20">
                                  <CardContent className="space-y-3 p-4">
                                    <h3 className="flex items-center gap-2 font-display font-semibold text-lg">
                                      <TrendingUp className="h-5 w-5 text-cyan-400" />
                                      SPIN 銷售技巧
                                    </h3>
                                    {(() => {
                                      const spinAnalysis = conversation.analysis
                                        ?.agentOutputs?.agent3?.spin_analysis as
                                        | Record<string, unknown>
                                        | undefined;
                                      if (!spinAnalysis) {
                                        return null;
                                      }

                                      const stages = [
                                        { key: "situation", label: "S 情境" },
                                        { key: "problem", label: "P 問題" },
                                        { key: "implication", label: "I 影響" },
                                        { key: "need_payoff", label: "N 需求" },
                                      ];

                                      return (
                                        <>
                                          {stages.map(({ key, label }) => {
                                            const data = spinAnalysis[key] as
                                              | {
                                                  score?: number;
                                                  achieved?: boolean;
                                                }
                                              | undefined;
                                            if (!data) {
                                              return null;
                                            }
                                            const score = data.score ?? 0;
                                            const achieved =
                                              data.achieved ?? false;

                                            return (
                                              <div
                                                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-2.5"
                                                key={key}
                                              >
                                                <div className="flex items-center gap-2">
                                                  <span
                                                    className={
                                                      achieved && score >= 60
                                                        ? "text-[var(--ds-success)]"
                                                        : score >= 30
                                                          ? "text-[var(--ds-warning)]"
                                                          : "text-[var(--ds-danger)]"
                                                    }
                                                  >
                                                    {achieved && score >= 60
                                                      ? "✅"
                                                      : score >= 30
                                                        ? "⚠️"
                                                        : "❌"}
                                                  </span>
                                                  <span className="font-data text-sm">
                                                    {label}
                                                  </span>
                                                </div>
                                                <span
                                                  className={`font-bold font-data text-sm ${
                                                    score >= 60
                                                      ? "text-[var(--ds-success)]"
                                                      : score >= 30
                                                        ? "text-[var(--ds-warning)]"
                                                        : "text-[var(--ds-danger)]"
                                                  }`}
                                                >
                                                  {score}分
                                                </span>
                                              </div>
                                            );
                                          })}
                                          {spinAnalysis.spin_completion_rate !==
                                            undefined && (
                                            <div className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-center">
                                              <p className="font-data text-muted-foreground text-xs">
                                                達成率
                                              </p>
                                              <p className="font-bold font-data text-2xl text-cyan-400">
                                                {Math.round(
                                                  (spinAnalysis.spin_completion_rate as number) *
                                                    100
                                                )}
                                                %
                                              </p>
                                            </div>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </CardContent>
                                </Card>
                              )}
                            </div>

                            {/* Tactical Suggestions */}
                            <TacticalSuggestions
                              suggestions={
                                (conversation.analysis.agentOutputs.agent6
                                  ?.tactical_suggestions as
                                  | TacticalSuggestion[]
                                  | undefined) ?? null
                              }
                            />

                            {/* PDCM+SPIN Alerts */}
                            <PdcmSpinAlerts
                              alerts={
                                (conversation.analysis.agentOutputs.agent6
                                  ?.pdcm_spin_alerts as
                                  | PdcmSpinAlertsData
                                  | undefined) ?? null
                              }
                            />

                            {/* Competitor Analysis */}
                            <CompetitorAnalysisCard
                              analysis={
                                (conversation.analysis.competitorAnalysis as
                                  | CompetitorAnalysis
                                  | undefined) ?? null
                              }
                            />
                          </>
                        )}

                        {/* Key Findings */}
                        {conversation.analysis.keyFindings &&
                          conversation.analysis.keyFindings.length > 0 && (
                            <Card className="ds-card border-purple-600/20">
                              <CardContent className="p-4">
                                <h3 className="mb-3 flex items-center gap-2 font-display font-semibold text-lg">
                                  <Lightbulb className="h-5 w-5 text-purple-400" />
                                  關鍵發現
                                </h3>
                                <ul className="space-y-2.5">
                                  {conversation.analysis.keyFindings.map(
                                    (finding, idx) => (
                                      <li
                                        className="relative pl-6 text-foreground/80 leading-relaxed before:absolute before:left-0 before:font-bold before:text-[var(--ds-accent)] before:content-['▸']"
                                        key={idx}
                                      >
                                        {finding}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </CardContent>
                            </Card>
                          )}

                        {/* Next Steps */}
                        {conversation.analysis.nextSteps &&
                          conversation.analysis.nextSteps.length > 0 && (
                            <Card className="ds-card border-purple-500/20">
                              <CardContent className="p-4">
                                <h3 className="mb-3 flex items-center gap-2 font-display font-semibold text-lg">
                                  <TrendingUp className="h-5 w-5 text-purple-400" />
                                  下一步行動
                                </h3>
                                <div className="space-y-3">
                                  {conversation.analysis.nextSteps.map(
                                    (step, idx) => (
                                      <div
                                        className="rounded-lg border border-border bg-muted/30 p-4 transition-all duration-300 hover:translate-x-1"
                                        key={idx}
                                      >
                                        <div className="flex items-start gap-3">
                                          <Badge
                                            className={`font-data font-semibold text-[0.7rem] ${
                                              step.priority === "high"
                                                ? "bg-gradient-to-r from-red-500 to-red-600 text-white"
                                                : step.priority === "medium"
                                                  ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white"
                                                  : "bg-gradient-to-r from-slate-500 to-slate-600 text-white"
                                            }`}
                                          >
                                            {step.priority === "high"
                                              ? "HIGH"
                                              : step.priority === "medium"
                                                ? "MED"
                                                : "LOW"}
                                          </Badge>
                                          <div className="flex-1">
                                            <p className="leading-relaxed">
                                              {step.action}
                                            </p>
                                            {step.owner && (
                                              <p className="mt-1.5 font-data text-muted-foreground text-sm">
                                                負責人: {step.owner}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                        {/* Risks */}
                        {conversation.analysis.risks &&
                          conversation.analysis.risks.length > 0 && (
                            <Card className="ds-card border-red-500/20">
                              <CardContent className="p-4">
                                <h3 className="mb-3 flex items-center gap-2 font-display font-semibold text-lg">
                                  <AlertTriangle className="h-5 w-5 text-red-400" />
                                  風險警示
                                </h3>
                                <div className="space-y-3">
                                  {conversation.analysis.risks.map(
                                    (risk, idx) => (
                                      <div
                                        className="rounded-lg border border-red-900/30 bg-red-500/5 p-4 transition-all duration-300 hover:border-red-500/50"
                                        key={idx}
                                      >
                                        <div className="flex items-center gap-2.5">
                                          <Badge
                                            className={`font-data font-semibold text-[0.7rem] ${
                                              risk.severity === "high"
                                                ? "bg-gradient-to-r from-red-500 to-red-600 text-white"
                                                : "bg-gradient-to-r from-purple-500 to-purple-600 text-white"
                                            }`}
                                          >
                                            {risk.severity === "high"
                                              ? "高風險"
                                              : risk.severity === "medium"
                                                ? "中風險"
                                                : "低風險"}
                                          </Badge>
                                          <p className="font-semibold text-red-400">
                                            {risk.risk}
                                          </p>
                                        </div>
                                        {risk.mitigation && (
                                          <p className="mt-2.5 font-data text-muted-foreground text-sm leading-relaxed">
                                            建議: {risk.mitigation}
                                          </p>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                      </div>
                    ) : (
                      <EmptyState icon={BarChart3} message="尚無分析結果" />
                    )}
                  </TabsContent>
                </Tabs>

                {/* Meeting Summary */}
                {conversation?.summary && (
                  <Collapsible
                    className="ds-card stagger-4 animate-fade-in-up"
                    onOpenChange={setIsSummaryOpen}
                    open={isSummaryOpen}
                  >
                    <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between p-6 transition-all duration-300 hover:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-[var(--ds-accent)]" />
                        <h2 className="font-bold font-display text-lg">
                          會議摘要
                        </h2>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${
                          isSummaryOpen ? "rotate-180" : ""
                        }`}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-6 pb-6">
                        <p className="whitespace-pre-wrap font-data text-foreground/80 text-sm leading-relaxed">
                          {conversation.summary}
                        </p>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </>
            ) : (
              /* No conversation state */
              <Card className="ds-card stagger-3 animate-fade-in-up">
                <div className="border-border border-b p-6">
                  <h2 className="font-bold font-display text-xl">對話記錄</h2>
                </div>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="mb-4 font-data text-muted-foreground">
                      尚未上傳對話
                    </p>
                    <Link
                      className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--ds-accent)] px-3 font-data text-sm text-white shadow-lg shadow-teal-500/20 transition-all duration-300 hover:bg-[var(--ds-accent-dark)]"
                      search={{ opportunityId: opportunity.id }}
                      to="/conversations/new"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      上傳錄音
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-6">
            {/* PDCM Score */}
            <div className="stagger-3 animate-fade-in-up">
              <PdcmScoreCard
                pdcmScores={
                  (conversation?.analysis?.agentOutputs?.agent2?.pdcm_scores as
                    | {
                        pain: {
                          score: number;
                          level?: string;
                          urgency?: string;
                          evidence?: string[];
                        };
                        decision: {
                          score: number;
                          level?: string;
                          evidence?: string[];
                        };
                        champion: {
                          score: number;
                          level?: string;
                          evidence?: string[];
                        };
                        metrics: {
                          score: number;
                          level?: string;
                          evidence?: string[];
                        };
                        total_score?: number;
                      }
                    | undefined) ?? null
                }
              />
            </div>

            {/* SPIN Progress */}
            <div className="stagger-4 animate-fade-in-up">
              <SpinProgressCard
                spinAnalysis={
                  (conversation?.analysis?.agentOutputs?.agent3
                    ?.spin_analysis as
                    | {
                        situation: { score: number; achieved: boolean };
                        problem: { score: number; achieved: boolean };
                        implication: {
                          score: number;
                          achieved: boolean;
                          gap?: string;
                        };
                        need_payoff: { score: number; achieved: boolean };
                        overall_spin_score?: number;
                        spin_completion_rate?: number;
                        key_gap?: string;
                        improvement_suggestion?: string;
                      }
                    | undefined) ?? null
                }
              />
            </div>

            {/* Audio Player */}
            {conversation?.audioUrl && (
              <Card className="ds-card stagger-5 animate-fade-in-up">
                <div className="border-border border-b p-4">
                  <h2 className="font-bold font-display text-lg">音檔</h2>
                </div>
                <CardContent className="p-4">
                  <audio
                    className="w-full rounded-lg"
                    controls
                    ref={audioRef}
                    src={conversation.audioUrl}
                  >
                    <track kind="captions" />
                    您的瀏覽器不支援音檔播放
                  </audio>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Card className="ds-card stagger-5 animate-fade-in-up">
              <div className="border-border border-b p-4">
                <h2 className="font-bold font-display text-lg">客戶歷程</h2>
                <p className="mt-1 font-data text-muted-foreground text-sm">
                  Sales Pipeline 時間軸
                </p>
              </div>
              <CardContent className="p-4">
                <div className="flex max-h-[500px] flex-col gap-3 overflow-y-auto">
                  {(() => {
                    const timelineEvents = buildTimeline(
                      opportunity as Parameters<typeof buildTimeline>[0]
                    );
                    if (timelineEvents.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <p className="font-data text-muted-foreground">
                            尚無歷程記錄
                          </p>
                        </div>
                      );
                    }
                    return timelineEvents.map((event) => (
                      <div
                        className={`rounded-lg border border-border border-l-4 bg-muted/30 p-4 transition-all duration-300 hover:translate-x-1 hover:bg-muted/50 ${getTimelineEventColor(event.type)}`}
                        key={event.id}
                      >
                        <div
                          className={`flex items-center gap-2 ${getTimelineEventTextColor(event.type)}`}
                        >
                          {getTimelineEventIcon(event.type)}
                          <span className="font-data font-semibold text-xs uppercase tracking-wider">
                            {event.type === "todo_created" && "建立待辦"}
                            {event.type === "todo_completed" && "完成待辦"}
                            {event.type === "todo_postponed" && "改期"}
                            {event.type === "todo_won" && "成交"}
                            {event.type === "todo_lost" && "拒絕"}
                            {event.type === "conversation_uploaded" && "對話"}
                            {event.type === "conversation_analyzed" && "分析"}
                            {event.type === "opportunity_created" && "建立"}
                            {event.type === "opportunity_updated" && "更新"}
                          </span>
                          {event.actionVia && (
                            <span className="rounded bg-muted px-1.5 py-0.5 font-data text-[0.625rem] text-muted-foreground">
                              via {event.actionVia}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-data font-medium text-sm">
                          {event.title}
                        </p>
                        {event.description && (
                          <p className="mt-0.5 font-data text-muted-foreground text-xs">
                            {event.description}
                          </p>
                        )}
                        <p className="mt-1 font-data text-[0.6875rem] text-muted-foreground">
                          {new Date(event.timestamp).toLocaleString("zh-TW", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Quick Info */}
            <Card className="ds-card stagger-6 animate-fade-in-up">
              <div className="border-border border-b p-4">
                <h2 className="font-bold font-display text-lg">基本時間</h2>
              </div>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4">
                  <TimelineInfoItem
                    icon={Calendar}
                    label="建立時間"
                    value={new Date(opportunity.createdAt).toLocaleDateString(
                      "zh-TW",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  />
                  <TimelineInfoItem
                    icon={Calendar}
                    label="最後更新"
                    value={new Date(opportunity.updatedAt).toLocaleDateString(
                      "zh-TW",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  />
                  {opportunity.lastContactedAt && (
                    <TimelineInfoItem
                      icon={Target}
                      label="上次聯繫"
                      value={new Date(
                        opportunity.lastContactedAt
                      ).toLocaleDateString("zh-TW", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Todo Modal */}
      <Dialog onOpenChange={setIsAddTodoOpen} open={isAddTodoOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-display">新增待辦事項</DialogTitle>
          </DialogHeader>
          {/* 顯示綁定的機會資訊 */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="font-data text-muted-foreground text-xs">綁定機會</p>
            <p className="font-data font-medium text-sm">
              {opportunity.companyName}
              <span className="ml-2 text-muted-foreground">
                ({opportunity.customerNumber})
              </span>
            </p>
          </div>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!todoTitle.trim()) {
                return;
              }

              const dueDate = new Date();
              dueDate.setDate(dueDate.getDate() + todoDays);

              createTodoMutation.mutate({
                title: todoTitle,
                description: todoDescription || undefined,
                dueDate: dueDate.toISOString(),
                opportunityId: opportunity.id,
                source: "web",
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="todo-title">待辦事項 *</Label>
              <Input
                id="todo-title"
                onChange={(e) => setTodoTitle(e.target.value)}
                placeholder="例：跟進客戶需求"
                required
                value={todoTitle}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="todo-description">備註說明</Label>
              <Textarea
                id="todo-description"
                onChange={(e) => setTodoDescription(e.target.value)}
                placeholder="補充說明..."
                rows={3}
                value={todoDescription}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="todo-days">幾天後到期</Label>
              <div className="flex gap-2">
                {[1, 3, 7, 14, 30].map((days) => (
                  <Button
                    className={todoDays === days ? "bg-[var(--ds-accent)]" : ""}
                    key={days}
                    onClick={() => setTodoDays(days)}
                    size="sm"
                    type="button"
                    variant={todoDays === days ? "default" : "outline"}
                  >
                    {days} 天
                  </Button>
                ))}
              </div>
              <p className="font-data text-muted-foreground text-xs">
                到期日：
                {new Date(
                  Date.now() + todoDays * 24 * 60 * 60 * 1000
                ).toLocaleDateString("zh-TW")}
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                onClick={() => setIsAddTodoOpen(false)}
                type="button"
                variant="outline"
              >
                取消
              </Button>
              <Button
                className="bg-[var(--ds-accent)] hover:bg-[var(--ds-accent-dark)]"
                disabled={!todoTitle.trim() || createTodoMutation.isPending}
                type="submit"
              >
                {createTodoMutation.isPending ? "建立中..." : "建立待辦"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject Opportunity Dialog */}
      <Dialog onOpenChange={setIsRejectDialogOpen} open={isRejectDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-display text-destructive">
              標記機會為拒絕
            </DialogTitle>
          </DialogHeader>

          {/* 機會資訊顯示 */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="font-data text-muted-foreground text-xs">
              將標記為拒絕
            </p>
            <p className="font-data font-medium text-sm">
              {opportunity.companyName}
              <span className="ml-2 text-muted-foreground">
                ({opportunity.customerNumber})
              </span>
            </p>
          </div>

          {/* 警告提示 */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="text-sm">
              <p className="font-semibold text-amber-600">注意</p>
              <p className="text-muted-foreground">
                此操作將建立一筆「客戶拒絕」記錄並結案，此操作無法撤銷。
              </p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleRejectSubmit}>
            {/* 拒絕原因（必填） */}
            <div className="space-y-2">
              <Label htmlFor="reject-reason">
                拒絕原因 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reject-reason"
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="請說明客戶拒絕的原因..."
                required
                rows={3}
                value={rejectReason}
              />
            </div>

            {/* 競品資訊（選填） */}
            <div className="space-y-2">
              <Label htmlFor="competitor">競品資訊</Label>
              <Input
                id="competitor"
                onChange={(e) => setCompetitor(e.target.value)}
                placeholder="客戶選擇的競品（選填）"
                value={competitor}
              />
            </div>

            {/* 備註說明（選填） */}
            <div className="space-y-2">
              <Label htmlFor="reject-note">備註說明</Label>
              <Textarea
                id="reject-note"
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="其他補充說明..."
                rows={2}
                value={rejectNote}
              />
            </div>

            {/* 按鈕區 */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                onClick={() => setIsRejectDialogOpen(false)}
                type="button"
                variant="outline"
              >
                取消
              </Button>
              <Button
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                type="submit"
                variant="destructive"
              >
                {rejectMutation.isPending ? "處理中..." : "確認拒絕"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Win Opportunity Dialog */}
      <Dialog onOpenChange={setIsWinDialogOpen} open={isWinDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-emerald-600">
              <Trophy className="h-5 w-5" />
              標記機會為成交
            </DialogTitle>
          </DialogHeader>

          {/* 機會資訊顯示 */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="font-data text-muted-foreground text-xs">
              將標記為成交
            </p>
            <p className="font-data font-medium text-sm">
              {opportunity.companyName}
              <span className="ml-2 text-muted-foreground">
                ({opportunity.customerNumber})
              </span>
            </p>
          </div>

          {/* 確認提示 */}
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div className="text-sm">
              <p className="font-semibold text-emerald-600">恭喜成交！</p>
              <p className="text-muted-foreground">
                此操作將機會狀態更新為「已成交」，並記錄成交時間。
              </p>
            </div>
          </div>

          {/* 按鈕區 */}
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => setIsWinDialogOpen(false)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={winMutation.isPending}
              onClick={() => winMutation.mutate({ opportunityId: id })}
            >
              {winMutation.isPending ? "處理中..." : "確認成交"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

// Helper Components

interface InfoItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function InfoItem({ icon: Icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 transition-all duration-300 hover:translate-x-1 hover:bg-muted/50">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ds-accent)]" />
      <div>
        <p className="mb-1 font-data font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          {label}
        </p>
        <p className="font-data text-sm">{value}</p>
      </div>
    </div>
  );
}

interface TimelineInfoItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function TimelineInfoItem({ icon: Icon, label, value }: TimelineInfoItemProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 transition-all duration-300 hover:translate-x-1 hover:bg-muted/50">
      <Icon className="h-5 w-5 shrink-0 text-[var(--ds-accent)]" />
      <div>
        <p className="mb-1 font-data font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          {label}
        </p>
        <p className="font-data text-sm">{value}</p>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
}

function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="mb-4 h-12 w-12 text-muted-foreground/50" />
      <p className="font-data text-muted-foreground">{message}</p>
    </div>
  );
}
