import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Lightbulb,
  Target,
  User,
  XCircle,
} from "lucide-react";

import { getConsultantDisplayName } from "@/lib/consultant-names";
import { parseSummaryMarkdown, type ParsedSummary } from "@/lib/summary-parser";
import { Skeleton } from "@/components/ui/skeleton";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/share/$token")({
  component: PublicSharePage,
});

function PublicSharePage() {
  const { token } = Route.useParams();

  const conversationQuery = useQuery({
    queryKey: ["share", "conversation", token],
    queryFn: async () => {
      return await client.share.getByToken({ token });
    },
    retry: false,
  });

  const conversation = conversationQuery.data;
  const isLoading = conversationQuery.isLoading;
  const isError = conversationQuery.isError;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6 lg:px-8">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xl">
          <XCircle className="mx-auto mb-4 h-16 w-16 text-red-500" />
          <h2 className="mb-2 font-bold font-serif text-2xl text-gray-900">
            連結無效或已過期
          </h2>
          <p className="text-gray-600">
            {conversationQuery.error?.message ||
              "此分享連結不存在或已失效，請聯繫您的業務專員。"}
          </p>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return null;
  }

  // 格式化日期
  const formattedDate = conversation.conversationDate
    ? new Date(conversation.conversationDate).toLocaleDateString("zh-TW", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // 解析摘要內容
  const parsedSummary = parseSummaryMarkdown(conversation.summary);

  // 取得顧問顯示名稱
  const consultantName = getConsultantDisplayName(
    conversation.slackUser?.slackUsername
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap');

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

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
          opacity: 0;
        }

        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
        .delay-500 { animation-delay: 0.5s; }
        .delay-600 { animation-delay: 0.6s; }

        .brand-logo {
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-family: 'Cormorant Garamond', serif;
        }

        .consultant-card {
          background: linear-gradient(135deg, rgba(251, 146, 60, 0.1) 0%, rgba(249, 115, 22, 0.05) 100%);
          border: 1px solid rgba(249, 115, 22, 0.2);
          transition: all 0.3s ease;
        }

        .consultant-card:hover {
          border-color: rgba(249, 115, 22, 0.4);
          box-shadow: 0 8px 16px rgba(249, 115, 22, 0.1);
        }

        .section-card {
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.95));
          backdrop-filter: blur(10px);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .section-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
        }

        .section-icon {
          width: 2.5rem;
          height: 2.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.75rem;
          flex-shrink: 0;
        }

        .list-item {
          position: relative;
          padding-left: 1.5rem;
        }

        .list-item::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0.625rem;
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.4;
        }
      `}</style>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* Header with Logo */}
        <div className="mb-8 animate-fade-in-up text-center">
          <div className="brand-logo mb-6 font-bold text-4xl sm:text-5xl">
            iCHEF
          </div>
          <div className="mx-auto h-1 w-20 rounded-full bg-gradient-to-r from-transparent via-orange-400 to-transparent opacity-50" />
        </div>

        {/* Main Title */}
        <div className="mb-8 animate-fade-in-up text-center delay-100">
          <h1 className="mb-3 font-bold font-serif text-3xl text-gray-900 sm:text-4xl">
            {conversation.companyName}
          </h1>
          <p className="font-serif text-gray-500 text-lg">會議記錄</p>
          {formattedDate && (
            <div className="mt-3 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
          )}
        </div>

        {/* Customer Info Badge */}
        <div className="mb-8 flex animate-fade-in-up flex-wrap justify-center gap-3 delay-200">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 shadow-sm">
            <div className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
            <span className="font-medium text-gray-700 text-sm">案件編號</span>
            <span className="font-mono font-semibold text-orange-600 text-sm">
              {conversation.caseNumber}
            </span>
          </div>
          {conversation.opportunity?.customerNumber && (
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm">
              <span className="font-medium text-gray-700 text-sm">客戶編號</span>
              <span className="font-mono font-semibold text-gray-600 text-sm">
                {conversation.opportunity.customerNumber}
              </span>
            </div>
          )}
        </div>

        {/* Consultant Card */}
        <div className="consultant-card mb-8 animate-fade-in-up overflow-hidden rounded-2xl p-5 shadow-lg delay-300">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 shadow-md">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-medium text-gray-500 text-xs uppercase tracking-wider">
                您的專屬顧問
              </div>
              <div className="font-bold text-gray-900 text-lg">
                {consultantName}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Sections */}
        {parsedSummary ? (
          <div className="space-y-6">
            {/* Greeting */}
            {parsedSummary.greeting && (
              <div className="section-card animate-fade-in-up rounded-2xl border border-gray-200 p-6 shadow-lg delay-400">
                <p className="font-serif text-gray-700 text-lg leading-relaxed">
                  {parsedSummary.greeting}
                </p>
              </div>
            )}

            {/* Challenges Section */}
            {parsedSummary.challenges.length > 0 && (
              <SummarySection
                icon={<AlertCircle className="h-5 w-5 text-amber-600" />}
                iconBg="bg-amber-100"
                title="您目前遇到的挑戰"
                items={parsedSummary.challenges}
                delay="delay-400"
              />
            )}

            {/* Solutions Section */}
            {parsedSummary.solutions.length > 0 && (
              <SummarySection
                icon={<Lightbulb className="h-5 w-5 text-blue-600" />}
                iconBg="bg-blue-100"
                title="iCHEF 如何協助您"
                items={parsedSummary.solutions}
                delay="delay-500"
              />
            )}

            {/* Agreements Section */}
            {parsedSummary.agreements.length > 0 && (
              <div className="section-card animate-fade-in-up rounded-2xl border border-gray-200 p-6 shadow-lg delay-500">
                <div className="mb-4 flex items-center gap-3">
                  <div className="section-icon bg-green-100">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg">已達成共識</h3>
                </div>
                <ul className="space-y-3">
                  {parsedSummary.agreements.map((item, index) => (
                    <li key={index} className="list-item text-gray-700 text-green-600">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Items Section */}
            {(parsedSummary.actionItems.ichef.length > 0 ||
              parsedSummary.actionItems.customer.length > 0) && (
              <div className="section-card animate-fade-in-up rounded-2xl border border-gray-200 p-6 shadow-lg delay-600">
                <div className="mb-4 flex items-center gap-3">
                  <div className="section-icon bg-purple-100">
                    <ClipboardList className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg">待辦事項</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {parsedSummary.actionItems.ichef.length > 0 && (
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 font-semibold text-gray-800 text-sm">
                        <Target className="h-4 w-4 text-orange-500" />
                        iCHEF 這邊
                      </h4>
                      <ul className="space-y-2">
                        {parsedSummary.actionItems.ichef.map((item, index) => (
                          <li
                            key={index}
                            className="list-item text-gray-600 text-orange-500 text-sm"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {parsedSummary.actionItems.customer.length > 0 && (
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 font-semibold text-gray-800 text-sm">
                        <Target className="h-4 w-4 text-blue-500" />
                        老闆您這邊
                      </h4>
                      <ul className="space-y-2">
                        {parsedSummary.actionItems.customer.map((item, index) => (
                          <li
                            key={index}
                            className="list-item text-gray-600 text-blue-500 text-sm"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Fallback: 如果解析失敗，顯示原始摘要（清理過的版本）
          conversation.summary && (
            <div className="section-card animate-fade-in-up rounded-2xl border border-gray-200 p-6 shadow-lg delay-400">
              <div className="mb-4 flex items-center gap-3">
                <div className="section-icon bg-orange-100">
                  <Target className="h-5 w-5 text-orange-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">會議摘要</h3>
              </div>
              <div className="space-y-3 text-gray-700 leading-relaxed">
                {cleanAndRenderSummary(conversation.summary)}
              </div>
            </div>
          )
        )}

        {/* Footer */}
        <div className="mt-12 space-y-2 text-center text-gray-400 text-sm">
          <p className="font-medium">由 iCHEF Sales AI 系統自動生成</p>
          <p>如有任何疑問，歡迎隨時聯繫您的專屬顧問</p>
          <div className="mx-auto mt-4 h-px w-32 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
        </div>
      </div>
    </div>
  );
}

/**
 * 摘要區塊元件
 */
function SummarySection({
  icon,
  iconBg,
  title,
  items,
  delay,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  items: Array<{ title: string; description?: string }>;
  delay: string;
}) {
  return (
    <div className={`section-card animate-fade-in-up rounded-2xl border border-gray-200 p-6 shadow-lg ${delay}`}>
      <div className="mb-4 flex items-center gap-3">
        <div className={`section-icon ${iconBg}`}>{icon}</div>
        <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
      </div>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="border-gray-100 border-l-2 pl-4">
            <h4 className="font-semibold text-gray-800">{item.title}</h4>
            {item.description && (
              <p className="mt-1 text-gray-600 text-sm">{item.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 清理並渲染原始摘要（移除 markdown 和重複內容）
 */
function cleanAndRenderSummary(summary: string): React.ReactNode[] {
  // 移除標題行
  let cleaned = summary.replace(/^#\s*[^\n]*x\s*iCHEF\s*會議記錄\s*\n*/gi, "");

  // 移除簽名區塊
  cleaned = cleaned.replace(/---[\s\S]*?(iCHEF|銷售顧問|POS)[\s\S]*$/gi, "");
  cleaned = cleaned.replace(/如有任何問題[\s\S]*$/gi, "");
  cleaned = cleaned.replace(/祝\s*生意興隆[\s\S]*$/gi, "");

  // 移除 markdown 格式
  cleaned = cleaned
    .replace(/##\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/🔍|💡|✅|📋/g, "")
    .trim();

  // 分行渲染
  const lines = cleaned.split("\n").filter((line) => line.trim());

  return lines.map((line, i) => (
    <p key={i} className="text-gray-700">
      {line.trim()}
    </p>
  ));
}
