/**
 * Conversation 詳情頁面 - Precision Analytics Design
 * 顯示對話詳情、轉錄文字、PDCM+SPIN 分析結果
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  Calendar,
  Clock,
  Edit,
  ExternalLink,
  Lightbulb,
  Loader2,
  MessageSquare,
  Star,
  Target,
  TrendingUp,
  User,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/conversations/$id")({
  component: ConversationDetailPage,
});

const typeOptions: Record<string, string> = {
  discovery_call: "需求訪談",
  demo: "產品展示",
  follow_up: "跟進電話",
  negotiation: "議價討論",
  closing: "成交會議",
  support: "客服支援",
};

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; textColor: string }
> = {
  pending: {
    label: "PENDING",
    color: "bg-slate-500",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-400",
  },
  transcribing: {
    label: "TRANSCRIBING",
    color: "bg-purple-500",
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-400",
  },
  transcribed: {
    label: "TRANSCRIBED",
    color: "bg-amber-500",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-400",
  },
  analyzing: {
    label: "ANALYZING",
    color: "bg-purple-500",
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-400",
  },
  completed: {
    label: "COMPLETED",
    color: "bg-emerald-500",
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-400",
  },
  failed: {
    label: "FAILED",
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

function ConversationDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditSummaryOpen, setIsEditSummaryOpen] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");

  const conversationQuery = useQuery({
    queryKey: ["conversations", "detail", id],
    queryFn: async () => {
      const result = await client.conversations.get({ conversationId: id });
      return result;
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: () => client.conversations.analyze({ conversationId: id }),
    onSuccess: () => {
      toast.success("分析完成!");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error) => {
      toast.error(`分析失敗: ${error.message}`);
    },
  });

  const updateSummaryMutation = useMutation({
    mutationFn: (summary: string) =>
      client.conversations.updateSummary({ conversationId: id, summary }),
    onSuccess: () => {
      toast.success("會議摘要已更新!");
      queryClient.invalidateQueries({
        queryKey: ["conversations", "detail", id],
      });
      setIsEditSummaryOpen(false);
    },
    onError: (error) => {
      toast.error(`更新失敗: ${error.message}`);
    },
  });

  const handleEditSummary = () => {
    setEditedSummary(conversation?.summary || "");
    setIsEditSummaryOpen(true);
  };

  const handleSaveSummary = () => {
    if (!editedSummary.trim()) {
      toast.error("摘要內容不能為空");
      return;
    }
    updateSummaryMutation.mutate(editedSummary);
  };

  const handlePreviewShare = async () => {
    try {
      console.log("[Share] Creating share token for conversation:", id);
      const tokenResult = await client.share.create({ conversationId: id });
      console.log("[Share] Token created:", tokenResult.token);
      const shareUrl = `${window.location.origin}/share/${tokenResult.token}`;
      console.log("[Share] Opening share URL:", shareUrl);
      window.open(shareUrl, "_blank");
    } catch (error) {
      console.error("[Share] Error creating share link:", error);
      const errorMessage = error instanceof Error ? error.message : "未知錯誤";
      toast.error(`無法生成預覽連結: ${errorMessage}`);
    }
  };

  const conversation = conversationQuery.data;
  const isLoading = conversationQuery.isLoading;

  if (isLoading) {
    return (
      <>
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
          `}
        </style>
        <main className="grid-pattern container mx-auto min-h-screen space-y-6 p-8">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Skeleton className="h-72 w-full rounded-lg" />
              <Skeleton className="h-96 w-full rounded-lg" />
            </div>
            <Skeleton className="h-screen w-full rounded-lg" />
          </div>
        </main>
      </>
    );
  }

  if (conversationQuery.isError) {
    return (
      <>
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
          `}
        </style>
        <main className="grid-pattern container mx-auto min-h-screen p-8">
          <Card className="error-card border-red-500/30 bg-gradient-to-br from-slate-950 to-slate-900">
            <CardContent className="py-12 text-center">
              <XCircle className="mx-auto h-16 w-16 text-red-500" />
              <p className="mt-4 mb-3 font-semibold text-2xl text-red-400">
                載入失敗
              </p>
              <p className="text-slate-400">
                {conversationQuery.error?.message || "找不到此對話"}
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button asChild className="btn-secondary" variant="outline">
                  <Link to="/conversations">返回對話列表</Link>
                </Button>
                <Button
                  className="btn-primary"
                  onClick={() => conversationQuery.refetch()}
                  variant="default"
                >
                  重試
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  if (!conversation) {
    return (
      <>
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
          `}
        </style>
        <main className="grid-pattern container mx-auto min-h-screen p-8">
          <Card className="border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900">
            <CardContent className="py-12 text-center">
              <p className="text-slate-400">找不到此對話</p>
              <Button asChild className="btn-secondary mt-6" variant="outline">
                <Link to="/conversations">返回對話列表</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const statusInfo = statusConfig[conversation.status] || {
    label: conversation.status.toUpperCase(),
    color: "bg-slate-500",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-400",
  };

  const canAnalyze = conversation.status === "transcribed";

  return (
    <>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

          .grid-pattern {
            background-color: rgb(2 6 23);
            background-image:
              linear-gradient(rgba(99, 94, 246, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(99, 94, 246, 0.05) 1px, transparent 1px);
            background-size: 24px 24px;
          }

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

          @keyframes shimmer {
            0% {
              background-position: -200% center;
            }
            100% {
              background-position: 200% center;
            }
          }

          @keyframes pulse-glow {
            0%, 100% {
              box-shadow: 0 0 20px rgba(99, 94, 246, 0.3);
            }
            50% {
              box-shadow: 0 0 30px rgba(99, 94, 246, 0.5);
            }
          }

          .detail-card {
            animation: fadeInUp 0.6s ease-out backwards;
            border: 1px solid rgb(30 41 59);
            background: linear-gradient(135deg, rgb(2 6 23) 0%, rgb(15 23 42) 100%);
            position: relative;
            overflow: hidden;
          }

          .detail-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent, rgba(99, 94, 246, 0.5), transparent);
            opacity: 0;
            transition: opacity 0.3s;
          }

          .detail-card:hover::before {
            opacity: 1;
          }

          .detail-card:hover {
            border-color: rgb(6 182 212 / 0.3);
            box-shadow: 0 8px 32px rgba(99, 94, 246, 0.1);
          }

          .status-badge {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 600;
            letter-spacing: 0.05em;
            padding: 0.375rem 0.875rem;
            border-radius: 0.375rem;
            font-size: 0.75rem;
            position: relative;
            overflow: hidden;
          }

          .status-badge::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
            animation: shimmer 2s infinite;
          }

          .page-title {
            font-family: 'Playfair Display', serif;
            font-weight: 700;
            letter-spacing: -0.02em;
            background: linear-gradient(135deg, #ffffff 0%, #94a3b8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          .section-title {
            font-family: 'Playfair Display', serif;
            font-weight: 600;
            letter-spacing: -0.01em;
          }

          .data-label {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: rgb(148 163 184);
          }

          .data-value {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 500;
            color: rgb(226 232 240);
          }

          .btn-primary {
            background: linear-gradient(135deg, rgb(99 94 246) 0%, rgb(124 58 237) 100%);
            border: 1px solid rgb(6 182 212 / 0.3);
            transition: all 0.3s;
            position: relative;
            overflow: hidden;
          }

          .btn-primary::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            transform: translate(-50%, -50%);
            transition: width 0.6s, height 0.6s;
          }

          .btn-primary:hover::before {
            width: 300px;
            height: 300px;
          }

          .btn-primary:hover {
            box-shadow: 0 0 20px rgba(99, 94, 246, 0.4);
            border-color: rgb(6 182 212 / 0.6);
          }

          .btn-secondary {
            border: 1px solid rgb(51 65 85);
            background: rgb(15 23 42);
            transition: all 0.3s;
          }

          .btn-secondary:hover {
            border-color: rgb(6 182 212 / 0.5);
            background: rgb(30 41 59);
            box-shadow: 0 0 16px rgba(99, 94, 246, 0.2);
          }

          .info-grid-item {
            display: flex;
            align-items: flex-start;
            gap: 0.875rem;
            padding: 1rem;
            border-radius: 0.5rem;
            border: 1px solid rgb(30 41 59);
            background: linear-gradient(135deg, rgb(15 23 42) 0%, rgb(30 41 59) 100%);
            transition: all 0.3s;
          }

          .info-grid-item:hover {
            border-color: rgb(6 182 212 / 0.3);
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(99, 94, 246, 0.1);
          }

          .summary-section {
            padding: 1.5rem;
            border-radius: 0.75rem;
            border: 1px solid rgb(30 41 59);
            background: linear-gradient(135deg, rgb(15 23 42) 0%, rgb(30 41 59) 100%);
            position: relative;
          }

          .summary-section::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: linear-gradient(180deg, rgb(99 94 246), rgb(139 92 246));
            border-radius: 3px 0 0 3px;
          }

          .transcript-segment {
            padding: 1rem;
            border-radius: 0.5rem;
            border: 1px solid rgb(30 41 59);
            background: rgb(15 23 42);
            transition: all 0.3s;
          }

          .transcript-segment:hover {
            border-color: rgb(6 182 212 / 0.3);
            background: rgb(30 41 59);
            box-shadow: 0 4px 12px rgba(99, 94, 246, 0.15);
          }

          .speaker-badge {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            font-weight: 600;
            padding: 0.25rem 0.625rem;
            background: rgb(30 41 59);
            border: 1px solid rgb(51 65 85);
            color: rgb(148 163 184);
          }

          .timestamp {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.7rem;
            color: rgb(100 116 139);
          }

          .priority-badge-high {
            background: linear-gradient(135deg, rgb(239 68 68) 0%, rgb(220 38 38) 100%);
            border: 1px solid rgb(239 68 68 / 0.3);
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
            font-size: 0.7rem;
            padding: 0.25rem 0.625rem;
            animation: pulse-glow 2s infinite;
          }

          .priority-badge-medium {
            background: linear-gradient(135deg, rgb(139 92 246) 0%, rgb(109 40 217) 100%);
            border: 1px solid rgb(59 130 246 / 0.3);
            font-family: 'JetBrains Mono', monospace;
            font-weight: 600;
            font-size: 0.7rem;
            padding: 0.25rem 0.625rem;
          }

          .priority-badge-low {
            background: linear-gradient(135deg, rgb(100 116 139) 0%, rgb(71 85 105) 100%);
            border: 1px solid rgb(100 116 139 / 0.3);
            font-family: 'JetBrains Mono', monospace;
            font-weight: 600;
            font-size: 0.7rem;
            padding: 0.25rem 0.625rem;
          }

          .action-card {
            padding: 1rem;
            border-radius: 0.5rem;
            border: 1px solid rgb(30 41 59);
            background: linear-gradient(135deg, rgb(15 23 42) 0%, rgb(30 41 59) 100%);
            transition: all 0.3s;
          }

          .action-card:hover {
            border-color: rgb(59 130 246 / 0.4);
            transform: translateX(4px);
            box-shadow: -4px 0 12px rgba(59, 130, 246, 0.15);
          }

          .risk-card {
            padding: 1rem;
            border-radius: 0.5rem;
            border: 1px solid rgb(127 29 29);
            background: linear-gradient(135deg, rgb(127 29 29 / 0.1) 0%, rgb(127 29 29 / 0.05) 100%);
            transition: all 0.3s;
          }

          .risk-card:hover {
            border-color: rgb(239 68 68 / 0.5);
            box-shadow: 0 4px 16px rgba(239, 68, 68, 0.2);
          }

          .finding-item {
            padding-left: 1.5rem;
            position: relative;
            color: rgb(203 213 225);
            line-height: 1.75;
          }

          .finding-item::before {
            content: '▸';
            position: absolute;
            left: 0;
            color: rgb(99 94 246);
            font-weight: 700;
          }

          .audio-player {
            width: 100%;
            border-radius: 0.5rem;
            filter: saturate(0.8) hue-rotate(-10deg);
          }

          .timeline-item {
            display: flex;
            align-items: center;
            gap: 0.875rem;
            padding: 0.875rem;
            border-radius: 0.5rem;
            border: 1px solid rgb(30 41 59);
            background: rgb(15 23 42);
            transition: all 0.3s;
          }

          .timeline-item:hover {
            border-color: rgb(6 182 212 / 0.3);
            background: rgb(30 41 59);
          }

          .custom-tabs {
            border-bottom: 1px solid rgb(30 41 59);
          }

          .custom-tab {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 600;
            font-size: 0.875rem;
            letter-spacing: 0.025em;
            text-transform: uppercase;
            padding: 0.75rem 1.5rem;
            color: rgb(148 163 184);
            border-bottom: 2px solid transparent;
            transition: all 0.3s;
          }

          .custom-tab:hover {
            color: rgb(99 94 246);
          }

          .custom-tab[data-state="active"] {
            color: rgb(99 94 246);
            border-bottom-color: rgb(99 94 246);
            background: linear-gradient(180deg, transparent 0%, rgb(6 182 212 / 0.05) 100%);
          }

          .modal-content {
            border: 1px solid rgb(30 41 59);
            background: linear-gradient(135deg, rgb(2 6 23) 0%, rgb(15 23 42) 100%);
          }

          .modal-textarea {
            font-family: 'JetBrains Mono', monospace;
            background: rgb(15 23 42);
            border: 1px solid rgb(51 65 85);
            color: rgb(226 232 240);
            line-height: 1.75;
          }

          .modal-textarea:focus {
            border-color: rgb(6 182 212 / 0.5);
            box-shadow: 0 0 0 3px rgba(99, 94, 246, 0.1);
          }

          .back-button {
            border: 1px solid rgb(51 65 85);
            background: rgb(15 23 42);
            transition: all 0.3s;
            border-radius: 0.5rem;
            padding: 0.625rem;
          }

          .back-button:hover {
            border-color: rgb(6 182 212 / 0.5);
            background: rgb(30 41 59);
            box-shadow: 0 0 16px rgba(99, 94, 246, 0.2);
          }
        `}
      </style>

      <main className="grid-pattern container mx-auto min-h-screen space-y-8 p-8">
        {/* Page Header */}
        <div
          className="detail-card flex items-center justify-between rounded-xl p-6"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="flex items-center gap-5">
            <button
              className="back-button"
              onClick={() => navigate({ to: "/conversations" })}
              type="button"
            >
              <ArrowLeft className="h-5 w-5 text-purple-400" />
            </button>
            <div>
              <div className="mb-2 flex items-center gap-3">
                <h1 className="page-title text-3xl">
                  {conversation.title || "未命名對話"}
                </h1>
                <span
                  className={`status-badge ${statusInfo.bgColor} ${statusInfo.textColor}`}
                >
                  {statusInfo.label}
                </span>
              </div>
              <p className="data-value text-sm">{conversation.caseNumber}</p>
            </div>
          </div>
          <div className="flex gap-3">
            {canAnalyze && (
              <Button
                className="btn-primary"
                disabled={analyzeMutation.isPending}
                onClick={() => analyzeMutation.mutate()}
              >
                {analyzeMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="mr-2 h-4 w-4" />
                )}
                執行 PDCM+SPIN 分析
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Basic Info Card */}
            <Card className="detail-card" style={{ animationDelay: "0.2s" }}>
              <CardHeader>
                <CardTitle className="section-title text-xl">
                  對話資訊
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="info-grid-item">
                    <Building2 className="h-5 w-5 shrink-0 text-purple-400" />
                    <div>
                      <p className="data-label mb-1">機會</p>
                      <Link
                        className="data-value hover:text-purple-400 hover:underline"
                        params={{ id: conversation.opportunityId }}
                        to="/opportunities/$id"
                      >
                        {conversation.opportunityCompanyName}
                      </Link>
                    </div>
                  </div>
                  <div className="info-grid-item">
                    <MessageSquare className="h-5 w-5 shrink-0 text-purple-400" />
                    <div>
                      <p className="data-label mb-1">對話類型</p>
                      <p className="data-value">
                        {typeOptions[conversation.type] || conversation.type}
                      </p>
                    </div>
                  </div>
                  <div className="info-grid-item">
                    <Clock className="h-5 w-5 shrink-0 text-amber-400" />
                    <div>
                      <p className="data-label mb-1">時長</p>
                      <p className="data-value">
                        {formatDuration(conversation.duration)}
                      </p>
                    </div>
                  </div>
                  <div className="info-grid-item">
                    <Calendar className="h-5 w-5 shrink-0 text-emerald-400" />
                    <div>
                      <p className="data-label mb-1">對話日期</p>
                      <p className="data-value">
                        {conversation.conversationDate
                          ? new Date(
                              conversation.conversationDate
                            ).toLocaleDateString("zh-TW")
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {conversation.summary && (
                  <div className="summary-section mt-6">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="data-label">會議摘要 (Agent 4)</p>
                      <Button
                        className="btn-secondary"
                        onClick={handleEditSummary}
                        size="sm"
                        variant="ghost"
                      >
                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                        編輯
                      </Button>
                    </div>
                    <p className="whitespace-pre-wrap text-slate-300 text-sm leading-relaxed">
                      {conversation.summary}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs
              className="detail-card"
              defaultValue={conversation.analysis ? "analysis" : "transcript"}
              style={{ animationDelay: "0.3s" }}
            >
              <TabsList className="custom-tabs w-full justify-start">
                <TabsTrigger
                  className="custom-tab"
                  disabled={!conversation.analysis}
                  value="analysis"
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  銷售分析
                </TabsTrigger>
                <TabsTrigger className="custom-tab" value="transcript">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  轉錄文字
                </TabsTrigger>
              </TabsList>

              <TabsContent className="mt-6 px-6 pb-6" value="transcript">
                {conversation.transcript?.segments &&
                conversation.transcript.segments.length > 0 ? (
                  <div className="space-y-4">
                    {conversation.transcript.segments.map((segment, idx) => (
                      <div
                        className="transcript-segment flex gap-4"
                        key={idx}
                        style={{ animationDelay: `${0.05 * idx}s` }}
                      >
                        <div className="shrink-0">
                          <Badge className="speaker-badge" variant="outline">
                            <User className="mr-1.5 h-3 w-3" />
                            {segment.speaker || "說話者"}
                          </Badge>
                          <p className="timestamp mt-2">
                            {formatTime(segment.start)}
                          </p>
                        </div>
                        <p className="flex-1 text-slate-300 leading-relaxed">
                          {segment.text}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : conversation.transcript?.fullText ? (
                  <p className="whitespace-pre-wrap text-slate-300 leading-relaxed">
                    {conversation.transcript.fullText}
                  </p>
                ) : (
                  <div className="py-12 text-center">
                    <MessageSquare className="mx-auto h-12 w-12 text-slate-600" />
                    <p className="mt-4 text-slate-400">尚無轉錄文字</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent className="mt-6 px-6 pb-6" value="analysis">
                {conversation.analysis ? (
                  <div className="space-y-6">
                    {/* PDCM+SPIN Analysis Section */}
                    {conversation.analysis.agentOutputs && (
                      <>
                        {/* Two Column Layout for PDCM and SPIN details */}
                        <div className="grid gap-6 md:grid-cols-2">
                          {/* PDCM Detailed Analysis */}
                          {conversation.analysis.agentOutputs.agent2
                            ?.pdcm_scores && (
                            <Card className="detail-card border-purple-600/20">
                              <CardHeader className="pb-3">
                                <CardTitle className="section-title flex items-center gap-2 text-lg">
                                  <BarChart3 className="h-5 w-5 text-purple-400" />
                                  PDCM 詳細分析
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                {(() => {
                                  const pdcmScores = conversation.analysis
                                    ?.agentOutputs?.agent2?.pdcm_scores as
                                    | Record<string, unknown>
                                    | undefined;
                                  if (!pdcmScores) {
                                    return null;
                                  }

                                  const dimensions = [
                                    {
                                      key: "pain",
                                      label: "P (痛點)",
                                      color: "purple",
                                    },
                                    {
                                      key: "decision",
                                      label: "D (決策)",
                                      color: "blue",
                                    },
                                    {
                                      key: "champion",
                                      label: "C (支持)",
                                      color: "emerald",
                                    },
                                    {
                                      key: "metrics",
                                      label: "M (量化)",
                                      color: "amber",
                                    },
                                  ];

                                  return dimensions.map(
                                    ({ key, label, color }) => {
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
                                          className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3"
                                          key={key}
                                        >
                                          <div className="mb-1 flex items-center justify-between">
                                            <span
                                              className={`font-semibold text-sm text-${color}-400`}
                                            >
                                              {label}
                                            </span>
                                            <span
                                              className={`font-bold ${score >= 60 ? "text-green-400" : score >= 30 ? "text-yellow-400" : "text-red-400"}`}
                                            >
                                              {score}分
                                            </span>
                                          </div>
                                          {evidence && (
                                            <p className="text-slate-400 text-xs leading-relaxed">
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
                            <Card className="detail-card border-cyan-600/20">
                              <CardHeader className="pb-3">
                                <CardTitle className="section-title flex items-center gap-2 text-lg">
                                  <TrendingUp className="h-5 w-5 text-cyan-400" />
                                  SPIN 銷售技巧
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
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
                                        const achieved = data.achieved ?? false;

                                        return (
                                          <div
                                            className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/30 p-2.5"
                                            key={key}
                                          >
                                            <div className="flex items-center gap-2">
                                              <span
                                                className={`${achieved && score >= 60 ? "text-green-400" : score >= 30 ? "text-yellow-400" : "text-red-400"}`}
                                              >
                                                {achieved && score >= 60
                                                  ? "✅"
                                                  : score >= 30
                                                    ? "⚠️"
                                                    : "❌"}
                                              </span>
                                              <span className="text-slate-300 text-sm">
                                                {label}
                                              </span>
                                            </div>
                                            <span
                                              className={`font-bold text-sm ${score >= 60 ? "text-green-400" : score >= 30 ? "text-yellow-400" : "text-red-400"}`}
                                            >
                                              {score}分
                                            </span>
                                          </div>
                                        );
                                      })}
                                      {spinAnalysis.spin_completion_rate !==
                                        undefined && (
                                        <div className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-center">
                                          <p className="text-slate-400 text-xs">
                                            達成率
                                          </p>
                                          <p className="font-bold text-2xl text-cyan-400">
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
                            conversation.analysis.agentOutputs.agent6
                              ?.tactical_suggestions as
                              | TacticalSuggestion[]
                              | null
                              | undefined
                          }
                        />

                        {/* PDCM+SPIN Alerts */}
                        <PdcmSpinAlerts
                          alerts={
                            conversation.analysis.agentOutputs.agent6
                              ?.pdcm_spin_alerts as
                              | PdcmSpinAlertsData
                              | null
                              | undefined
                          }
                        />

                        {/* Competitor Analysis Card (New) */}
                        <CompetitorAnalysisCard
                          analysis={
                            conversation.analysis.competitorAnalysis as
                              | CompetitorAnalysis
                              | null
                              | undefined
                          }
                        />

                        {/* Competitor Mentions Section (Legacy - can be removed later) */}
                        {conversation.analysis.agentOutputs.agent6
                          ?.competitor_mentions &&
                          (
                            conversation.analysis.agentOutputs.agent6
                              .competitor_mentions as Array<{
                              competitor_name: string;
                              mention_count: number;
                              customer_attitude:
                                | "positive"
                                | "negative"
                                | "neutral";
                              quotes: string[];
                            }>
                          ).length > 0 && (
                            <Card className="detail-card border-amber-600/20">
                              <CardHeader>
                                <CardTitle className="section-title flex items-center gap-2 text-lg">
                                  <Target className="h-5 w-5 text-amber-400" />
                                  競品提及
                                </CardTitle>
                                <CardDescription className="text-slate-400 text-sm">
                                  本次對話中提及的競品系統
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                {/* Threat Level */}
                                {conversation.analysis.agentOutputs.agent6
                                  ?.competitor_threat_level && (
                                  <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
                                    <span className="font-semibold text-slate-300 text-sm">
                                      競品威脅程度：
                                    </span>
                                    <Badge
                                      className={
                                        conversation.analysis.agentOutputs
                                          .agent6.competitor_threat_level ===
                                        "high"
                                          ? "priority-badge-high"
                                          : conversation.analysis.agentOutputs
                                                .agent6
                                                .competitor_threat_level ===
                                              "medium"
                                            ? "priority-badge-medium"
                                            : "priority-badge-low"
                                      }
                                    >
                                      {conversation.analysis.agentOutputs.agent6
                                        .competitor_threat_level === "high"
                                        ? "高"
                                        : conversation.analysis.agentOutputs
                                              .agent6
                                              .competitor_threat_level ===
                                            "medium"
                                          ? "中"
                                          : conversation.analysis.agentOutputs
                                                .agent6
                                                .competitor_threat_level ===
                                              "low"
                                            ? "低"
                                            : "無"}
                                    </Badge>
                                  </div>
                                )}

                                {/* Competitor List */}
                                {(
                                  conversation.analysis.agentOutputs.agent6
                                    ?.competitor_mentions as Array<{
                                    competitor_name: string;
                                    mention_count: number;
                                    customer_attitude:
                                      | "positive"
                                      | "negative"
                                      | "neutral";
                                    quotes: string[];
                                  }>
                                )?.map((competitor, idx) => (
                                  <div
                                    className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3"
                                    key={idx}
                                  >
                                    <div className="mb-2 flex items-center justify-between">
                                      <span className="font-semibold text-amber-400">
                                        {competitor.competitor_name}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-slate-400 text-xs">
                                          提及 {competitor.mention_count} 次
                                        </span>
                                        <Badge
                                          className={
                                            competitor.customer_attitude ===
                                            "positive"
                                              ? "bg-green-500/20 text-green-400"
                                              : competitor.customer_attitude ===
                                                  "negative"
                                                ? "bg-red-500/20 text-red-400"
                                                : "bg-slate-500/20 text-slate-400"
                                          }
                                        >
                                          {competitor.customer_attitude ===
                                          "positive"
                                            ? "正面"
                                            : competitor.customer_attitude ===
                                                "negative"
                                              ? "負面"
                                              : "中立"}
                                        </Badge>
                                      </div>
                                    </div>
                                    {competitor.quotes.length > 0 && (
                                      <div className="space-y-1">
                                        {competitor.quotes
                                          .slice(0, 2)
                                          .map((quote, qIdx) => (
                                            <p
                                              className="border-amber-500/30 border-l-2 pl-2 text-slate-400 text-xs italic"
                                              key={qIdx}
                                            >
                                              「{quote}」
                                            </p>
                                          ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                          )}

                        {/* Competitor Handling Evaluation Section */}
                        {conversation.analysis.agentOutputs.agent6
                          ?.competitor_handling_evaluation &&
                          (
                            conversation.analysis.agentOutputs.agent6
                              .competitor_handling_evaluation as Array<{
                              competitor_name: string;
                              customer_quote: string;
                              rep_response: string;
                              score: number;
                              evaluation: {
                                strengths: string[];
                                weaknesses: string[];
                              };
                              recommended_response: string;
                              improvement_tips: string[];
                            }>
                          ).length > 0 && (
                            <Card className="detail-card border-cyan-600/20">
                              <CardHeader>
                                <CardTitle className="section-title flex items-center gap-2 text-lg">
                                  <Star className="h-5 w-5 text-cyan-400" />
                                  競品應對評估
                                </CardTitle>
                                <CardDescription className="text-slate-400 text-sm">
                                  業務對競品提及的回應表現評估
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-6">
                                {(
                                  conversation.analysis.agentOutputs.agent6
                                    ?.competitor_handling_evaluation as Array<{
                                    competitor_name: string;
                                    customer_quote: string;
                                    rep_response: string;
                                    score: number;
                                    evaluation: {
                                      strengths: string[];
                                      weaknesses: string[];
                                    };
                                    recommended_response: string;
                                    improvement_tips: string[];
                                  }>
                                )?.map((evalItem, idx) => (
                                  <div
                                    className="space-y-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-4"
                                    key={idx}
                                  >
                                    {/* Header with competitor name and score */}
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-cyan-400">
                                        {evalItem.competitor_name}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <span
                                            className={
                                              star <= evalItem.score
                                                ? "text-amber-400"
                                                : "text-slate-600"
                                            }
                                            key={star}
                                          >
                                            ★
                                          </span>
                                        ))}
                                        <span className="ml-1 text-slate-400 text-xs">
                                          ({evalItem.score}/5)
                                        </span>
                                      </div>
                                    </div>

                                    {/* Customer quote */}
                                    <div className="rounded border border-slate-700 bg-slate-900/50 p-2">
                                      <p className="mb-1 font-semibold text-slate-400 text-xs">
                                        客戶原話
                                      </p>
                                      <p className="text-slate-300 text-sm">
                                        「{evalItem.customer_quote}」
                                      </p>
                                    </div>

                                    {/* Rep response */}
                                    <div className="rounded border border-slate-700 bg-slate-900/50 p-2">
                                      <p className="mb-1 font-semibold text-slate-400 text-xs">
                                        業務回應
                                      </p>
                                      <p className="text-slate-300 text-sm">
                                        「{evalItem.rep_response}」
                                      </p>
                                    </div>

                                    {/* Evaluation */}
                                    <div className="grid gap-2 md:grid-cols-2">
                                      {evalItem.evaluation.strengths.length >
                                        0 && (
                                        <div className="rounded border border-green-500/20 bg-green-500/5 p-2">
                                          <p className="mb-1 font-semibold text-green-400 text-xs">
                                            做得好
                                          </p>
                                          {evalItem.evaluation.strengths.map(
                                            (s, sIdx) => (
                                              <p
                                                className="text-slate-300 text-xs"
                                                key={sIdx}
                                              >
                                                ✅ {s}
                                              </p>
                                            )
                                          )}
                                        </div>
                                      )}
                                      {evalItem.evaluation.weaknesses.length >
                                        0 && (
                                        <div className="rounded border border-amber-500/20 bg-amber-500/5 p-2">
                                          <p className="mb-1 font-semibold text-amber-400 text-xs">
                                            待改進
                                          </p>
                                          {evalItem.evaluation.weaknesses.map(
                                            (w, wIdx) => (
                                              <p
                                                className="text-slate-300 text-xs"
                                                key={wIdx}
                                              >
                                                ⚠️ {w}
                                              </p>
                                            )
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Recommended response */}
                                    <div className="rounded border border-cyan-500/20 bg-cyan-500/5 p-2">
                                      <p className="mb-1 font-semibold text-cyan-400 text-xs">
                                        💡 建議回應
                                      </p>
                                      <p className="text-slate-300 text-sm leading-relaxed">
                                        {evalItem.recommended_response}
                                      </p>
                                    </div>

                                    {/* Improvement tips */}
                                    {evalItem.improvement_tips.length > 0 && (
                                      <div className="rounded border border-purple-500/20 bg-purple-500/5 p-2">
                                        <p className="mb-1 font-semibold text-purple-400 text-xs">
                                          改進重點
                                        </p>
                                        {evalItem.improvement_tips.map(
                                          (tip, tIdx) => (
                                            <p
                                              className="text-slate-300 text-xs"
                                              key={tIdx}
                                            >
                                              {tIdx + 1}. {tip}
                                            </p>
                                          )
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                          )}
                      </>
                    )}

                    {/* Key Findings */}
                    {conversation.analysis.keyFindings &&
                      conversation.analysis.keyFindings.length > 0 && (
                        <Card className="detail-card border-purple-600/20">
                          <CardHeader>
                            <CardTitle className="section-title flex items-center gap-2 text-lg">
                              <Lightbulb className="h-5 w-5 text-purple-400" />
                              關鍵發現
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2.5">
                              {conversation.analysis.keyFindings.map(
                                (finding, idx) => (
                                  <li className="finding-item" key={idx}>
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
                        <Card className="detail-card border-purple-500/20">
                          <CardHeader>
                            <CardTitle className="section-title flex items-center gap-2 text-lg">
                              <TrendingUp className="h-5 w-5 text-purple-400" />
                              下一步行動
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {conversation.analysis.nextSteps.map(
                                (step, idx) => (
                                  <div className="action-card" key={idx}>
                                    <div className="flex items-start gap-3">
                                      <Badge
                                        className={
                                          step.priority === "high"
                                            ? "priority-badge-high"
                                            : step.priority === "medium"
                                              ? "priority-badge-medium"
                                              : "priority-badge-low"
                                        }
                                      >
                                        {step.priority === "high"
                                          ? "HIGH"
                                          : step.priority === "medium"
                                            ? "MED"
                                            : "LOW"}
                                      </Badge>
                                      <div className="flex-1">
                                        <p className="text-slate-200 leading-relaxed">
                                          {step.action}
                                        </p>
                                        {step.owner && (
                                          <p className="mt-1.5 text-slate-400 text-sm">
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
                        <Card className="detail-card border-red-500/20">
                          <CardHeader>
                            <CardTitle className="section-title flex items-center gap-2 text-lg">
                              <AlertTriangle className="h-5 w-5 text-red-400" />
                              風險警示
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {conversation.analysis.risks.map((risk, idx) => (
                                <div className="risk-card" key={idx}>
                                  <div className="flex items-center gap-2.5">
                                    <Badge
                                      className={
                                        risk.severity === "high"
                                          ? "priority-badge-high"
                                          : "priority-badge-medium"
                                      }
                                    >
                                      {risk.severity === "high"
                                        ? "高風險"
                                        : risk.severity === "medium"
                                          ? "中風險"
                                          : "低風險"}
                                    </Badge>
                                    <p className="font-semibold text-red-300">
                                      {risk.risk}
                                    </p>
                                  </div>
                                  {risk.mitigation && (
                                    <p className="mt-2.5 text-slate-400 text-sm leading-relaxed">
                                      建議: {risk.mitigation}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <BarChart3 className="mx-auto h-16 w-16 text-slate-600" />
                    <p className="mt-4 text-lg text-slate-400">尚無分析結果</p>
                    {canAnalyze && (
                      <Button
                        className="btn-primary mt-6"
                        disabled={analyzeMutation.isPending}
                        onClick={() => analyzeMutation.mutate()}
                      >
                        執行 PDCM+SPIN 分析
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Share Preview */}
            <Card className="detail-card" style={{ animationDelay: "0.4s" }}>
              <CardHeader>
                <CardTitle className="section-title text-lg">
                  分享連結
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  公開分享頁面預覽
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="btn-secondary w-full"
                  onClick={handlePreviewShare}
                  variant="outline"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  預覽公開分享頁面
                </Button>
              </CardContent>
            </Card>

            {/* Audio Player */}
            {conversation.audioUrl && (
              <Card className="detail-card" style={{ animationDelay: "0.5s" }}>
                <CardHeader>
                  <CardTitle className="section-title text-lg">音檔</CardTitle>
                </CardHeader>
                <CardContent>
                  <audio
                    className="audio-player"
                    controls
                    src={conversation.audioUrl}
                  >
                    <track kind="captions" />
                    您的瀏覽器不支援音檔播放
                  </audio>
                </CardContent>
              </Card>
            )}

            {/* PDCM Score */}
            <div style={{ animationDelay: "0.6s" }}>
              <PdcmScoreCard
                pdcmScores={
                  conversation.analysis?.agentOutputs?.agent2?.pdcm_scores as
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
                    | null
                    | undefined
                }
              />
            </div>

            {/* SPIN Progress */}
            <div style={{ animationDelay: "0.65s" }}>
              <SpinProgressCard
                spinAnalysis={
                  conversation.analysis?.agentOutputs?.agent3?.spin_analysis as
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
                    | null
                    | undefined
                }
              />
            </div>

            {/* Timeline */}
            <Card className="detail-card" style={{ animationDelay: "0.7s" }}>
              <CardHeader>
                <CardTitle className="section-title text-lg">時間軸</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="timeline-item">
                    <Calendar className="h-5 w-5 shrink-0 text-slate-400" />
                    <div>
                      <p className="data-label mb-1">建立時間</p>
                      <p className="data-value text-xs">
                        {new Date(conversation.createdAt).toLocaleDateString(
                          "zh-TW",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                  </div>
                  {conversation.analyzedAt && (
                    <div className="timeline-item">
                      <BarChart3 className="h-5 w-5 shrink-0 text-purple-400" />
                      <div>
                        <p className="data-label mb-1">分析完成</p>
                        <p className="data-value text-xs">
                          {new Date(conversation.analyzedAt).toLocaleDateString(
                            "zh-TW",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Edit Summary Modal */}
        <Dialog onOpenChange={setIsEditSummaryOpen} open={isEditSummaryOpen}>
          <DialogContent className="modal-content max-w-2xl">
            <DialogHeader>
              <DialogTitle className="section-title text-xl">
                編輯會議摘要
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                修改 Agent 4 生成的會議摘要,此內容將顯示在公開分享頁面
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                className="modal-textarea min-h-[300px]"
                onChange={(e) => setEditedSummary(e.target.value)}
                placeholder="輸入會議摘要..."
                value={editedSummary}
              />
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <p className="mb-2 font-semibold text-purple-400 text-sm">
                  💡 提示:
                </p>
                <ul className="ml-4 list-disc space-y-1 text-slate-400 text-xs">
                  <li>此內容將公開給客戶查看</li>
                  <li>請確保不包含內部敏感資訊</li>
                  <li>支援換行格式</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button
                className="btn-secondary"
                onClick={() => setIsEditSummaryOpen(false)}
                variant="outline"
              >
                取消
              </Button>
              <Button
                className="btn-primary"
                disabled={
                  updateSummaryMutation.isPending || !editedSummary.trim()
                }
                onClick={handleSaveSummary}
              >
                {updateSummaryMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                儲存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
