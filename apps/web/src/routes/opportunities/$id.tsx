/**
 * Opportunity 詳情頁面
 * 顯示商機詳細資訊、對話記錄、MEDDIC 分析
 * Precision Analytics Industrial Design
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { client } from "@/utils/orpc";

// Import Playfair Display and JetBrains Mono
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/700.css";

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
    analyzing: "bg-purple-500",
    transcribing: "bg-yellow-500",
    pending: "bg-gray-500",
    failed: "bg-red-500",
  };
  return colors[status] || "bg-gray-500";
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

function OpportunityDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const opportunityQuery = useQuery({
    queryKey: ["opportunities", "get", { opportunityId: id }],
    queryFn: async () => {
      const result = await client.opportunities.get({ opportunityId: id });
      return result;
    },
  });

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
    <main className="opportunity-detail-container">
      <style>
        {`
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
            0% { left: -100%; }
            100% { left: 200%; }
          }

          @keyframes pulse-ring {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(99, 94, 246, 0.4);
            }
            50% {
              box-shadow: 0 0 0 8px rgba(99, 94, 246, 0);
            }
          }

          @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          .opportunity-detail-container {
            min-height: 100vh;
            background: linear-gradient(135deg, rgb(2 6 23) 0%, rgb(15 23 42) 50%, rgb(30 41 59) 100%);
            position: relative;
            padding: 2rem;
          }

          .opportunity-detail-container::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image:
              linear-gradient(to right, rgb(71 85 105 / 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgb(71 85 105 / 0.1) 1px, transparent 1px);
            background-size: 40px 40px;
            pointer-events: none;
          }

          .detail-content {
            max-width: 1400px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
          }

          .page-header {
            margin-bottom: 2.5rem;
            animation: fadeInUp 0.6s ease-out backwards;
          }

          .back-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 2.5rem;
            height: 2.5rem;
            border-radius: 0.5rem;
            background: linear-gradient(135deg, rgb(30 41 59) 0%, rgb(15 23 42) 100%);
            border: 1px solid rgb(71 85 105);
            color: rgb(148 163 184);
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .back-button:hover {
            background: linear-gradient(135deg, rgb(51 65 85) 0%, rgb(30 41 59) 100%);
            border-color: rgb(99 94 246);
            color: rgb(99 94 246);
            transform: translateX(-4px);
            box-shadow: 0 0 20px rgba(99, 94, 246, 0.3);
          }

          .company-header {
            font-family: 'Playfair Display', serif;
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, rgb(226 232 240) 0%, rgb(148 163 184) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: -0.02em;
            line-height: 1.2;
          }

          .customer-number {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            font-weight: 500;
            color: rgb(148 163 184);
            letter-spacing: 0.05em;
            margin-top: 0.5rem;
          }

          .action-buttons {
            display: flex;
            gap: 0.75rem;
          }

          .action-button {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.625rem 1.25rem;
            border-radius: 0.5rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            text-decoration: none;
          }

          .action-button-outline {
            background: linear-gradient(135deg, rgb(30 41 59) 0%, rgb(15 23 42) 100%);
            border: 1px solid rgb(71 85 105);
            color: rgb(226 232 240);
          }

          .action-button-outline:hover {
            background: linear-gradient(135deg, rgb(51 65 85) 0%, rgb(30 41 59) 100%);
            border-color: rgb(99 94 246);
            color: rgb(99 94 246);
            box-shadow: 0 0 20px rgba(99, 94, 246, 0.2);
          }

          .action-button-primary {
            background: linear-gradient(135deg, rgb(99 94 246) 0%, rgb(139 92 246) 100%);
            border: 1px solid rgb(99 94 246);
            color: rgb(2 6 23);
          }

          .action-button-primary:hover {
            background: linear-gradient(135deg, rgb(124 58 237) 0%, rgb(109 40 217) 100%);
            box-shadow: 0 0 30px rgba(99, 94, 246, 0.5);
            transform: translateY(-2px);
          }

          .detail-grid {
            display: grid;
            grid-template-columns: 1fr 400px;
            gap: 2rem;
            animation: fadeInUp 0.6s ease-out backwards;
            animation-delay: 0.1s;
          }

          @media (max-width: 1024px) {
            .detail-grid {
              grid-template-columns: 1fr;
            }
          }

          .main-column {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
          }

          .sidebar-column {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
          }

          .detail-card {
            border-radius: 0.75rem;
            background: linear-gradient(135deg, rgb(15 23 42) 0%, rgb(30 41 59) 100%);
            border: 1px solid rgb(51 65 85);
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .detail-card:hover {
            border-color: rgb(71 85 105);
            box-shadow: 0 0 30px rgba(99, 94, 246, 0.1);
          }

          .card-header {
            padding: 1.5rem;
            border-bottom: 1px solid rgb(51 65 85);
          }

          .card-title {
            font-family: 'Playfair Display', serif;
            font-size: 1.5rem;
            font-weight: 700;
            color: rgb(226 232 240);
            letter-spacing: -0.01em;
          }

          .card-description {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            color: rgb(148 163 184);
            margin-top: 0.25rem;
          }

          .card-content {
            padding: 1.5rem;
          }

          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1.5rem;
          }

          @media (max-width: 640px) {
            .info-grid {
              grid-template-columns: 1fr;
            }
          }

          .info-item {
            display: flex;
            align-items: flex-start;
            gap: 0.75rem;
            padding: 1rem;
            border-radius: 0.5rem;
            background: rgb(2 6 23 / 0.5);
            border: 1px solid rgb(30 41 59);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .info-item:hover {
            background: rgb(30 41 59 / 0.5);
            border-color: rgb(51 65 85);
            transform: translateX(4px);
          }

          .info-icon {
            flex-shrink: 0;
            margin-top: 0.125rem;
            color: rgb(99 94 246);
          }

          .info-label {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: rgb(148 163 184);
            margin-bottom: 0.25rem;
          }

          .info-value {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9375rem;
            font-weight: 500;
            color: rgb(226 232 240);
          }

          .notes-section {
            margin-top: 1.5rem;
            padding-top: 1.5rem;
            border-top: 1px solid rgb(51 65 85);
          }

          .conversation-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1.25rem;
            border-radius: 0.5rem;
            background: rgb(2 6 23 / 0.5);
            border: 1px solid rgb(30 41 59);
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .conversation-item:hover {
            background: rgb(30 41 59 / 0.5);
            border-color: rgb(99 94 246);
            transform: translateX(4px);
            box-shadow: 0 0 20px rgba(99, 94, 246, 0.1);
          }

          .conversation-status-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 2.5rem;
            height: 2.5rem;
            border-radius: 50%;
            flex-shrink: 0;
            position: relative;
          }

          .conversation-status-icon.status-completed {
            background: linear-gradient(135deg, rgb(16 185 129) 0%, rgb(5 150 105) 100%);
          }

          .conversation-status-icon.status-analyzing {
            background: linear-gradient(135deg, rgb(139 92 246) 0%, rgb(109 40 217) 100%);
            animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }

          .conversation-status-icon.status-transcribing {
            background: linear-gradient(135deg, rgb(251 191 36) 0%, rgb(245 158 11) 100%);
            animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }

          .conversation-status-icon.status-pending {
            background: linear-gradient(135deg, rgb(107 114 128) 0%, rgb(75 85 99) 100%);
          }

          .conversation-status-icon.status-failed {
            background: linear-gradient(135deg, rgb(239 68 68) 0%, rgb(220 38 38) 100%);
          }

          .conversation-title {
            font-family: 'JetBrains Mono', monospace;
            font-size: 1rem;
            font-weight: 600;
            color: rgb(226 232 240);
            margin-bottom: 0.5rem;
          }

          .conversation-meta {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex-wrap: wrap;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8125rem;
            color: rgb(148 163 184);
          }

          .conversation-badge {
            padding: 0.25rem 0.625rem;
            border-radius: 0.25rem;
            background: rgb(30 41 59);
            border: 1px solid rgb(51 65 85);
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            font-weight: 500;
            color: rgb(148 163 184);
          }

          .meddic-badge {
            padding: 0.375rem 0.75rem;
            border-radius: 0.375rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8125rem;
            font-weight: 700;
            color: white;
            background: linear-gradient(135deg, rgb(16 185 129) 0%, rgb(5 150 105) 100%);
          }

          .meddic-badge.score-medium {
            background: linear-gradient(135deg, rgb(251 191 36) 0%, rgb(245 158 11) 100%);
          }

          .meddic-badge.score-low {
            background: linear-gradient(135deg, rgb(239 68 68) 0%, rgb(220 38 38) 100%);
          }

          .timeline-item {
            display: flex;
            align-items: flex-start;
            gap: 1rem;
            padding: 1rem;
            border-radius: 0.5rem;
            background: rgb(2 6 23 / 0.5);
            border: 1px solid rgb(30 41 59);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .timeline-item:hover {
            background: rgb(30 41 59 / 0.5);
            border-color: rgb(51 65 85);
            transform: translateX(4px);
          }

          .timeline-icon {
            flex-shrink: 0;
            color: rgb(99 94 246);
          }

          .timeline-label {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: rgb(148 163 184);
            margin-bottom: 0.25rem;
          }

          .timeline-value {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            font-weight: 500;
            color: rgb(226 232 240);
          }

          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3rem 1.5rem;
            text-align: center;
            color: rgb(148 163 184);
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9375rem;
          }
        `}
      </style>

      <div className="detail-content">
        {/* Page Header */}
        <div className="page-header">
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "2rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "1rem",
                flex: 1,
              }}
            >
              <button
                className="back-button"
                onClick={() => navigate({ to: "/opportunities" })}
                type="button"
              >
                <ArrowLeft style={{ width: "1.25rem", height: "1.25rem" }} />
              </button>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <h1 className="company-header">{opportunity.companyName}</h1>
                  <LeadStatusBadge status={opportunity.status} />
                </div>
                <p className="customer-number">{opportunity.customerNumber}</p>
              </div>
            </div>
            <div className="action-buttons">
              <Link
                className="action-button action-button-outline"
                params={{ id: opportunity.id }}
                to="/opportunities/$id/edit"
              >
                <Edit style={{ width: "1rem", height: "1rem" }} />
                編輯
              </Link>
              <Link
                className="action-button action-button-primary"
                search={{ opportunityId: opportunity.id }}
                to="/conversations/new"
              >
                <Plus style={{ width: "1rem", height: "1rem" }} />
                新增對話
              </Link>
            </div>
          </div>
        </div>

        <div className="detail-grid">
          {/* Main Content */}
          <div className="main-column">
            {/* Basic Info Card */}
            <div className="detail-card" style={{ animationDelay: "0.15s" }}>
              <div className="card-header">
                <h2 className="card-title">基本資訊</h2>
              </div>
              <div className="card-content">
                <div className="info-grid">
                  <div className="info-item">
                    <Building2
                      className="info-icon"
                      style={{ width: "1.25rem", height: "1.25rem" }}
                    />
                    <div>
                      <p className="info-label">公司名稱</p>
                      <p className="info-value">{opportunity.companyName}</p>
                    </div>
                  </div>
                  <div className="info-item">
                    <User
                      className="info-icon"
                      style={{ width: "1.25rem", height: "1.25rem" }}
                    />
                    <div>
                      <p className="info-label">聯絡人</p>
                      <p className="info-value">
                        {opportunity.contactName || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="info-item">
                    <Mail
                      className="info-icon"
                      style={{ width: "1.25rem", height: "1.25rem" }}
                    />
                    <div>
                      <p className="info-label">Email</p>
                      <p className="info-value">
                        {opportunity.contactEmail || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="info-item">
                    <Phone
                      className="info-icon"
                      style={{ width: "1.25rem", height: "1.25rem" }}
                    />
                    <div>
                      <p className="info-label">電話</p>
                      <p className="info-value">
                        {opportunity.contactPhone || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="info-item">
                    <TrendingUp
                      className="info-icon"
                      style={{ width: "1.25rem", height: "1.25rem" }}
                    />
                    <div>
                      <p className="info-label">產業</p>
                      <p className="info-value">
                        {opportunity.industry || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="info-item">
                    <Building2
                      className="info-icon"
                      style={{ width: "1.25rem", height: "1.25rem" }}
                    />
                    <div>
                      <p className="info-label">公司規模</p>
                      <p className="info-value">
                        {opportunity.companySize || "-"}
                      </p>
                    </div>
                  </div>
                </div>
                {opportunity.notes && (
                  <div className="notes-section">
                    <p className="info-label">備註</p>
                    <p className="info-value" style={{ marginTop: "0.5rem" }}>
                      {opportunity.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Conversations */}
            <div className="detail-card" style={{ animationDelay: "0.2s" }}>
              <div
                className="card-header"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h2 className="card-title">對話記錄</h2>
                  <p className="card-description">
                    共 {opportunity.conversations?.length ?? 0} 筆對話
                  </p>
                </div>
                <Link
                  className="action-button action-button-primary"
                  search={{ opportunityId: opportunity.id }}
                  style={{ padding: "0.5rem 1rem", fontSize: "0.8125rem" }}
                  to="/conversations/new"
                >
                  <Plus style={{ width: "0.875rem", height: "0.875rem" }} />
                  上傳對話
                </Link>
              </div>
              <div className="card-content">
                {opportunity.conversations &&
                opportunity.conversations.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    {opportunity.conversations.map((conv, idx) => (
                      <div
                        className="conversation-item"
                        key={conv.id}
                        onClick={() =>
                          navigate({
                            to: "/conversations/$id",
                            params: { id: conv.id },
                          })
                        }
                        style={{ animationDelay: `${0.05 * idx}s` }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "1rem",
                          }}
                        >
                          <div
                            className={`conversation-status-icon status-${conv.status}`}
                          >
                            <MessageSquare
                              style={{
                                width: "1.25rem",
                                height: "1.25rem",
                                color: "white",
                              }}
                            />
                          </div>
                          <div>
                            <p className="conversation-title">{conv.title}</p>
                            <div className="conversation-meta">
                              <span className="conversation-badge">
                                {getConversationTypeLabel(conv.type)}
                              </span>
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
                          <div>
                            <span
                              className={`meddic-badge ${
                                conv.latestAnalysis.overallScore
                                  ? conv.latestAnalysis.overallScore >= 70
                                    ? ""
                                    : conv.latestAnalysis.overallScore >= 40
                                      ? "score-medium"
                                      : "score-low"
                                  : "score-low"
                              }`}
                            >
                              MEDDIC {conv.latestAnalysis.overallScore ?? "-"}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">尚無對話記錄</div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="sidebar-column">
            {/* MEDDIC Score */}
            {opportunity.meddicScore ? (
              <div className="detail-card" style={{ animationDelay: "0.25s" }}>
                <MeddicScoreCard
                  dimensions={opportunity.meddicScore.dimensions}
                  overallScore={opportunity.meddicScore.overall}
                />
              </div>
            ) : (
              <div className="detail-card" style={{ animationDelay: "0.25s" }}>
                <div className="card-header">
                  <h2 className="card-title">MEDDIC 評分</h2>
                </div>
                <div className="card-content">
                  <div className="empty-state">尚無 MEDDIC 分析</div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="detail-card" style={{ animationDelay: "0.3s" }}>
              <div className="card-header">
                <h2 className="card-title">時間軸</h2>
              </div>
              <div className="card-content">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  <div className="timeline-item">
                    <Calendar
                      className="timeline-icon"
                      style={{ width: "1.25rem", height: "1.25rem" }}
                    />
                    <div>
                      <p className="timeline-label">建立時間</p>
                      <p className="timeline-value">
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
                  <div className="timeline-item">
                    <Calendar
                      className="timeline-icon"
                      style={{ width: "1.25rem", height: "1.25rem" }}
                    />
                    <div>
                      <p className="timeline-label">最後更新</p>
                      <p className="timeline-value">
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
                    <div className="timeline-item">
                      <Phone
                        className="timeline-icon"
                        style={{ width: "1.25rem", height: "1.25rem" }}
                      />
                      <div>
                        <p className="timeline-label">上次聯繫</p>
                        <p className="timeline-value">
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
