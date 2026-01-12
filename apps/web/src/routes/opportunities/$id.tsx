/**
 * Opportunity 詳情頁面
 * 顯示商機詳細資訊、對話記錄、MEDDIC 分析
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Edit,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  TrendingUp,
  User,
} from "lucide-react";

import { LeadStatusBadge } from "@/components/lead/lead-status-badge";
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
import { orpc } from "@/utils/orpc";

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

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    completed: "bg-green-500",
    analyzing: "bg-blue-500",
    transcribing: "bg-yellow-500",
    pending: "bg-gray-500",
    failed: "bg-red-500",
  };
  return colors[status] || "bg-gray-500";
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

function OpportunityDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const opportunityQuery = useQuery(
    orpc.opportunities.get.queryOptions({ opportunityId: id })
  );

  const opportunity = opportunityQuery.data;
  const isLoading = opportunityQuery.isLoading;

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

  if (!opportunity) {
    return (
      <main className="container mx-auto p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">找不到此商機</p>
            <Button asChild className="mt-4" variant="outline">
              <Link to="/opportunities">返回商機列表</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate({ to: "/opportunities" })}
            size="icon"
            variant="ghost"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-bold text-3xl tracking-tight">
                {opportunity.companyName}
              </h1>
              <LeadStatusBadge status={opportunity.status} />
            </div>
            <p className="text-muted-foreground">
              {opportunity.customerNumber}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link params={{ id: opportunity.id }} to="/opportunities/$id/edit">
              <Edit className="mr-2 h-4 w-4" />
              編輯
            </Link>
          </Button>
          <Button asChild>
            <Link
              search={{ opportunityId: opportunity.id }}
              to="/conversations/new"
            >
              <Plus className="mr-2 h-4 w-4" />
              新增對話
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Basic Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>基本資訊</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">公司名稱</p>
                    <p className="text-muted-foreground">
                      {opportunity.companyName}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">聯絡人</p>
                    <p className="text-muted-foreground">
                      {opportunity.contactName || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Email</p>
                    <p className="text-muted-foreground">
                      {opportunity.contactEmail || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">電話</p>
                    <p className="text-muted-foreground">
                      {opportunity.contactPhone || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">產業</p>
                    <p className="text-muted-foreground">
                      {opportunity.industry || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">公司規模</p>
                    <p className="text-muted-foreground">
                      {opportunity.companySize || "-"}
                    </p>
                  </div>
                </div>
              </div>
              {opportunity.notes && (
                <div className="mt-4 border-t pt-4">
                  <p className="font-medium text-sm">備註</p>
                  <p className="mt-1 text-muted-foreground">
                    {opportunity.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversations */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>對話記錄</CardTitle>
                <CardDescription>
                  共 {opportunity.conversations?.length ?? 0} 筆對話
                </CardDescription>
              </div>
              <Button asChild size="sm">
                <Link
                  search={{ opportunityId: opportunity.id }}
                  to="/conversations/new"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  上傳對話
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {opportunity.conversations &&
              opportunity.conversations.length > 0 ? (
                <div className="space-y-4">
                  {opportunity.conversations.map((conv) => (
                    <div
                      className="flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                      key={conv.id}
                      onClick={() =>
                        navigate({
                          to: "/conversations/$id",
                          params: { id: conv.id },
                        })
                      }
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`h-10 w-10 rounded-full ${getStatusColor(conv.status)} flex items-center justify-center`}
                        >
                          <MessageSquare className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">{conv.title}</p>
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Badge variant="outline">
                              {getConversationTypeLabel(conv.type)}
                            </Badge>
                            <span>•</span>
                            <span>{formatDuration(conv.duration)}</span>
                            {conv.conversationDate && (
                              <>
                                <span>•</span>
                                <span>
                                  {new Date(
                                    conv.conversationDate
                                  ).toLocaleDateString("zh-TW")}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {conv.latestAnalysis && (
                        <div className="text-right">
                          <Badge
                            className={
                              conv.latestAnalysis.overallScore
                                ? conv.latestAnalysis.overallScore >= 70
                                  ? "bg-green-500"
                                  : conv.latestAnalysis.overallScore >= 40
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                                : "bg-gray-500"
                            }
                          >
                            MEDDIC {conv.latestAnalysis.overallScore ?? "-"}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  尚無對話記錄
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* MEDDIC Score */}
          {opportunity.meddicScore ? (
            <MeddicScoreCard
              dimensions={opportunity.meddicScore.dimensions}
              overallScore={opportunity.meddicScore.overall}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>MEDDIC 評分</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="py-8 text-center text-muted-foreground">
                  尚無 MEDDIC 分析
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
                      {new Date(opportunity.createdAt).toLocaleDateString(
                        "zh-TW",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">最後更新</p>
                    <p className="text-muted-foreground text-sm">
                      {new Date(opportunity.updatedAt).toLocaleDateString(
                        "zh-TW",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </p>
                  </div>
                </div>
                {opportunity.lastContactedAt && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">上次聯繫</p>
                      <p className="text-muted-foreground text-sm">
                        {new Date(
                          opportunity.lastContactedAt
                        ).toLocaleDateString("zh-TW", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
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
