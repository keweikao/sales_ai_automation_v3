import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Calendar, User, XCircle } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap');

        :root {
          --animate-delay: 0.1s;
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

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
          opacity: 0;
        }

        .delay-100 {
          animation-delay: 0.1s;
        }

        .delay-200 {
          animation-delay: 0.2s;
        }

        .delay-300 {
          animation-delay: 0.3s;
        }

        .delay-400 {
          animation-delay: 0.4s;
        }

        .brand-logo {
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-family: 'Cormorant Garamond', serif;
        }

        .summary-content p {
          line-height: 1.8;
          margin-bottom: 1rem;
        }

        .summary-content p:empty {
          margin-bottom: 0.5rem;
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

        .main-card {
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.9));
          backdrop-filter: blur(10px);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .main-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
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

        {/* Case Number Badge */}
        <div className="mb-8 flex animate-fade-in-up justify-center delay-200">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 shadow-sm">
            <div className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
            <span className="font-medium text-gray-700 text-sm">案件編號</span>
            <span className="font-mono font-semibold text-orange-600 text-sm">
              {conversation.caseNumber}
            </span>
          </div>
        </div>

        {/* Consultant Card */}
        <div className="consultant-card mb-8 animate-fade-in-up overflow-hidden rounded-2xl p-6 shadow-lg delay-300">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 shadow-md">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-medium text-gray-500 text-xs uppercase tracking-wider">
                您的專屬顧問
              </div>
              <div className="font-bold text-gray-900 text-lg">
                iCHEF 開發顧問
              </div>
            </div>
          </div>

          <div className="space-y-2 border-orange-200/50 border-t pt-4">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-orange-500" />
              <span className="font-medium text-gray-900">
                {conversation.slackUser?.slackUsername || "iCHEF 顧問團隊"}
              </span>
            </div>
          </div>
        </div>

        {/* Summary Content */}
        {conversation.summary && (
          <div className="main-card animate-fade-in-up overflow-hidden rounded-2xl border border-gray-200 shadow-2xl delay-400">
            <div className="border-gray-200 border-b bg-gradient-to-r from-orange-50 to-red-50 px-6 py-5 sm:px-8">
              <h2 className="font-bold font-serif text-gray-900 text-xl sm:text-2xl">
                會議摘要
              </h2>
              <p className="mt-1 text-gray-600 text-sm">
                由 AI 智能整理的重點內容
              </p>
            </div>

            <div className="px-6 py-8 sm:px-8">
              {/* Customer Info Grid */}
              {conversation.opportunity?.customerNumber && (
                <div className="mb-6 rounded-xl bg-gray-50 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="mb-1 font-medium text-gray-500 text-xs uppercase tracking-wider">
                        客戶編號
                      </dt>
                      <dd className="font-mono font-semibold text-gray-900">
                        {conversation.opportunity.customerNumber}
                      </dd>
                    </div>
                    <div>
                      <dt className="mb-1 font-medium text-gray-500 text-xs uppercase tracking-wider">
                        店家名稱
                      </dt>
                      <dd className="font-semibold text-gray-900">
                        {conversation.companyName}
                      </dd>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Text */}
              <div className="summary-content font-serif text-base text-gray-700 leading-relaxed sm:text-lg">
                {conversation.summary.split("\n").map((line, i) => (
                  <p key={i}>{line || "\u00A0"}</p>
                ))}
              </div>
            </div>
          </div>
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
