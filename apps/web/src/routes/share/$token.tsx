import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, XCircle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    retry: false, // Token 無效就不重試
  });

  const conversation = conversationQuery.data;
  const isLoading = conversationQuery.isLoading;
  const isError = conversationQuery.isError;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 p-8">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto max-w-4xl p-8">
        <Card className="border-red-200">
          <CardContent className="p-8 text-center">
            <XCircle className="mx-auto mb-4 h-16 w-16 text-red-500" />
            <h2 className="mb-2 font-bold text-2xl">連結無效或已過期</h2>
            <p className="text-muted-foreground">
              {conversationQuery.error?.message ||
                "此分享連結不存在或已失效，請聯繫您的業務專員。"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!conversation) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="mb-2 font-bold text-3xl">
          {conversation.companyName} - 會議記錄
        </h1>
        <p className="text-muted-foreground">
          案件編號: {conversation.caseNumber}
        </p>
      </div>

      {/* Agent 4 會議摘要 */}
      {conversation.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              會議摘要
            </CardTitle>
            <CardDescription>iCHEF 業務為您整理的重點摘要</CardDescription>
          </CardHeader>
          <CardContent>
            {/* 案件資訊 */}
            <div className="mb-4 rounded-lg bg-muted p-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="font-medium text-muted-foreground">
                    客戶編號
                  </dt>
                  <dd className="mt-1">
                    {conversation.opportunity?.customerNumber || "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">
                    案件編號
                  </dt>
                  <dd className="mt-1">{conversation.caseNumber}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">店名</dt>
                  <dd className="mt-1">{conversation.companyName}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">
                    專屬業務
                  </dt>
                  <dd className="mt-1">
                    {conversation.slackUser?.slackUsername || "iCHEF 業務"}
                    {conversation.slackUser?.slackEmail && (
                      <div className="text-muted-foreground text-xs">
                        {conversation.slackUser.slackEmail}
                      </div>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Summary 內容 */}
            <div className="prose prose-sm max-w-none">
              {conversation.summary.split("\n").map((line, i) => (
                <p className="text-muted-foreground" key={i}>
                  {line}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center text-muted-foreground text-sm">
        <p>此報告由 iCHEF Sales AI 系統自動生成</p>
        <p>如有疑問，請聯繫您的業務專員</p>
      </div>
    </div>
  );
}
