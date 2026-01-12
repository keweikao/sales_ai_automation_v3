/**
 * Conversation 詳情頁面
 * 顯示對話詳情、轉錄文字、MEDDIC 分析結果
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Calendar,
  Clock,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

import { MeddicScoreCard } from "@/components/meddic/meddic-score-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { client, orpc } from "@/utils/orpc";

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

const statusOptions: Record<string, { label: string; color: string }> = {
  pending: { label: "待處理", color: "bg-gray-500" },
  transcribing: { label: "轉錄中", color: "bg-blue-500" },
  transcribed: { label: "已轉錄", color: "bg-yellow-500" },
  analyzing: { label: "分析中", color: "bg-purple-500" },
  completed: { label: "已完成", color: "bg-green-500" },
  failed: { label: "失敗", color: "bg-red-500" },
};

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

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function ConversationDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const conversationQuery = useQuery(
    orpc.conversations.get.queryOptions({ conversationId: id })
  );

  const analyzeMutation = useMutation({
    mutationFn: () => client.conversations.analyze({ conversationId: id }),
    onSuccess: () => {
      toast.success("分析完成！");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error) => {
      toast.error(`分析失敗: ${error.message}`);
    },
  });

  const conversation = conversationQuery.data;
  const isLoading = conversationQuery.isLoading;

  if (isLoading) {
    return (
      <main className="container mx-auto space-y-6 p-6">
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
      </main>
    );
  }

  if (!conversation) {
    return (
      <main className="container mx-auto p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">找不到此對話</p>
            <Button asChild className="mt-4" variant="outline">
              <Link to="/conversations">返回對話列表</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const statusInfo = statusOptions[conversation.status] || {
    label: conversation.status,
    color: "bg-gray-500",
  };

  const canAnalyze = conversation.status === "transcribed";

  return (
    <main className="container mx-auto space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate({ to: "/conversations" })}
            size="icon"
            variant="ghost"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-bold text-2xl tracking-tight">
                {conversation.title || "未命名對話"}
              </h1>
              <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            </div>
            <p className="text-muted-foreground">{conversation.caseNumber}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canAnalyze && (
            <Button
              disabled={analyzeMutation.isPending}
              onClick={() => analyzeMutation.mutate()}
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BarChart3 className="mr-2 h-4 w-4" />
              )}
              執行 MEDDIC 分析
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>對話資訊</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">商機</p>
                    <Link
                      className="text-muted-foreground hover:underline"
                      params={{ id: conversation.opportunityId }}
                      to="/opportunities/$id"
                    >
                      {conversation.opportunityCompanyName}
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">對話類型</p>
                    <p className="text-muted-foreground">
                      {typeOptions[conversation.type] || conversation.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">時長</p>
                    <p className="text-muted-foreground">
                      {formatDuration(conversation.duration)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">對話日期</p>
                    <p className="text-muted-foreground">
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
                <div className="mt-4 border-t pt-4">
                  <p className="font-medium text-sm">摘要</p>
                  <p className="mt-1 text-muted-foreground">
                    {conversation.summary}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs: Transcript / Analysis */}
          <Tabs defaultValue="transcript">
            <TabsList>
              <TabsTrigger value="transcript">轉錄文字</TabsTrigger>
              <TabsTrigger disabled={!conversation.analysis} value="analysis">
                MEDDIC 分析
              </TabsTrigger>
            </TabsList>

            <TabsContent className="mt-4" value="transcript">
              <Card>
                <CardHeader>
                  <CardTitle>對話轉錄</CardTitle>
                  <CardDescription>
                    {conversation.transcript?.language === "zh"
                      ? "中文"
                      : conversation.transcript?.language || "未知語言"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {conversation.transcript?.segments &&
                  conversation.transcript.segments.length > 0 ? (
                    <div className="space-y-4">
                      {conversation.transcript.segments.map((segment, idx) => (
                        <div
                          className="flex gap-4 rounded-lg p-3 hover:bg-muted/50"
                          key={idx}
                        >
                          <div className="shrink-0">
                            <Badge variant="outline">
                              {segment.speaker || "說話者"}
                            </Badge>
                            <p className="mt-1 text-muted-foreground text-xs">
                              {formatTime(segment.start)}
                            </p>
                          </div>
                          <p className="flex-1">{segment.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : conversation.transcript?.fullText ? (
                    <p className="whitespace-pre-wrap text-sm">
                      {conversation.transcript.fullText}
                    </p>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground">
                      尚無轉錄文字
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent className="mt-4" value="analysis">
              {conversation.analysis ? (
                <div className="space-y-6">
                  {/* Key Findings */}
                  {conversation.analysis.keyFindings &&
                    conversation.analysis.keyFindings.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>關鍵發現</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="list-inside list-disc space-y-2">
                            {conversation.analysis.keyFindings.map(
                              (finding, idx) => (
                                <li key={idx}>{finding}</li>
                              )
                            )}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                  {/* Next Steps */}
                  {conversation.analysis.nextSteps &&
                    conversation.analysis.nextSteps.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>下一步行動</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {conversation.analysis.nextSteps.map(
                              (step, idx) => (
                                <div
                                  className="flex items-start gap-3 rounded-lg border p-3"
                                  key={idx}
                                >
                                  <Badge
                                    variant={
                                      step.priority === "high"
                                        ? "destructive"
                                        : step.priority === "medium"
                                          ? "default"
                                          : "secondary"
                                    }
                                  >
                                    {step.priority === "high"
                                      ? "高"
                                      : step.priority === "medium"
                                        ? "中"
                                        : "低"}
                                  </Badge>
                                  <div className="flex-1">
                                    <p>{step.action}</p>
                                    {step.owner && (
                                      <p className="text-muted-foreground text-sm">
                                        負責人: {step.owner}
                                      </p>
                                    )}
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
                      <Card>
                        <CardHeader>
                          <CardTitle>風險警示</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {conversation.analysis.risks.map((risk, idx) => (
                              <div
                                className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950"
                                key={idx}
                              >
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      risk.severity === "high"
                                        ? "destructive"
                                        : "secondary"
                                    }
                                  >
                                    {risk.severity === "high"
                                      ? "高風險"
                                      : risk.severity === "medium"
                                        ? "中風險"
                                        : "低風險"}
                                  </Badge>
                                  <p className="font-medium">{risk.risk}</p>
                                </div>
                                {risk.mitigation && (
                                  <p className="mt-2 text-muted-foreground text-sm">
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
                <Card>
                  <CardContent className="py-10 text-center">
                    <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">尚無分析結果</p>
                    {canAnalyze && (
                      <Button
                        className="mt-4"
                        disabled={analyzeMutation.isPending}
                        onClick={() => analyzeMutation.mutate()}
                      >
                        執行 MEDDIC 分析
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Audio Player */}
          {conversation.audioUrl && (
            <Card>
              <CardHeader>
                <CardTitle>音檔</CardTitle>
              </CardHeader>
              <CardContent>
                <audio className="w-full" controls src={conversation.audioUrl}>
                  <track kind="captions" />
                  您的瀏覽器不支援音檔播放
                </audio>
              </CardContent>
            </Card>
          )}

          {/* MEDDIC Score */}
          {conversation.analysis ? (
            <MeddicScoreCard
              dimensions={{
                metrics: conversation.analysis.metricsScore ?? 0,
                economicBuyer: conversation.analysis.economicBuyerScore ?? 0,
                decisionCriteria:
                  conversation.analysis.decisionCriteriaScore ?? 0,
                decisionProcess:
                  conversation.analysis.decisionProcessScore ?? 0,
                identifyPain: conversation.analysis.identifyPainScore ?? 0,
                champion: conversation.analysis.championScore ?? 0,
              }}
              overallScore={conversation.analysis.overallScore ?? 0}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>MEDDIC 評分</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="py-8 text-center text-muted-foreground">
                  尚無分析
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>時間軸</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">建立時間</p>
                    <p className="text-muted-foreground text-sm">
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
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">分析完成</p>
                      <p className="text-muted-foreground text-sm">
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
    </main>
  );
}
