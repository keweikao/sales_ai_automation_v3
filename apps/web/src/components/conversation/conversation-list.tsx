import {
  Calendar,
  Clock,
  FileAudio,
  MessageSquare,
  Play,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  type Conversation,
  conversationStatusOptions,
  conversationTypeOptions,
  formatDuration,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  conversations: Conversation[];
  onSelect?: (conversation: Conversation) => void;
  selectedId?: string;
  className?: string;
}

const statusColorMap: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  transcribing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  analyzing:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function getMeddicScoreColorClass(score: number): string {
  if (score >= 70) {
    return "text-green-600 dark:text-green-400";
  }
  if (score >= 40) {
    return "text-yellow-600 dark:text-yellow-400";
  }
  return "text-red-600 dark:text-red-400";
}

export function ConversationList({
  conversations,
  onSelect,
  selectedId,
  className,
}: ConversationListProps) {
  const getTypeLabel = (type: string) => {
    const option = conversationTypeOptions.find((o) => o.value === type);
    return option?.label || type;
  };

  const getStatusLabel = (status: string) => {
    const option = conversationStatusOptions.find((o) => o.value === status);
    return option?.label || status;
  };

  const formatDate = (date: Date | null) => {
    if (!date) {
      return "-";
    }
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (conversations.length === 0) {
    return (
      <div className={cn("py-12 text-center", className)}>
        <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 font-medium text-lg">沒有對話記錄</h3>
        <p className="mt-2 text-muted-foreground text-sm">
          上傳音檔開始建立新的對話記錄
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {conversations.map((conversation) => (
        <Card
          className={cn(
            "transition-all hover:shadow-md",
            onSelect && "cursor-pointer",
            selectedId === conversation.id && "ring-2 ring-primary"
          )}
          key={conversation.id}
          onClick={() => onSelect?.(conversation)}
          onKeyDown={
            onSelect
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(conversation);
                  }
                }
              : undefined
          }
          role={onSelect ? "button" : undefined}
          tabIndex={onSelect ? 0 : undefined}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              {/* Left: Icon + Content */}
              <div className="flex min-w-0 flex-1 gap-3">
                {/* Audio Icon */}
                <div className="flex-shrink-0">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      conversation.status === "completed"
                        ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    )}
                  >
                    {conversation.audioUrl ? (
                      <FileAudio className="h-5 w-5" />
                    ) : (
                      <MessageSquare className="h-5 w-5" />
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-medium">
                      {conversation.title ||
                        `對話 ${conversation.id.slice(0, 8)}`}
                    </h3>
                    <Badge className="text-xs" variant="outline">
                      {getTypeLabel(conversation.type)}
                    </Badge>
                  </div>

                  {/* Meta Info */}
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
                    {conversation.conversationDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(conversation.conversationDate)}</span>
                      </div>
                    )}
                    {conversation.duration && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formatDuration(conversation.duration)}</span>
                      </div>
                    )}
                    {conversation.storeName && (
                      <span className="truncate">{conversation.storeName}</span>
                    )}
                  </div>

                  {/* Summary */}
                  {conversation.summary && (
                    <p className="mt-2 line-clamp-2 text-muted-foreground text-sm">
                      {conversation.summary}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Status + Score */}
              <div className="flex flex-shrink-0 flex-col items-end gap-2">
                <Badge className={statusColorMap[conversation.status]}>
                  {getStatusLabel(conversation.status)}
                </Badge>

                {conversation.meddicAnalysis && (
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span
                      className={cn(
                        "font-medium text-sm",
                        getMeddicScoreColorClass(
                          conversation.meddicAnalysis.overallScore
                        )
                      )}
                    >
                      {conversation.meddicAnalysis.overallScore}
                    </span>
                  </div>
                )}

                {conversation.audioUrl &&
                  conversation.status === "completed" && (
                    <div className="flex items-center gap-1 text-primary">
                      <Play className="h-4 w-4" />
                      <span className="text-xs">播放</span>
                    </div>
                  )}
              </div>
            </div>

            {/* Participants */}
            {conversation.participants &&
              conversation.participants.length > 0 && (
                <div className="mt-3 flex items-center gap-2 border-t pt-3">
                  <span className="text-muted-foreground text-xs">參與者:</span>
                  <div className="flex flex-wrap gap-1">
                    {conversation.participants.map((p) => (
                      <Badge
                        className="text-xs"
                        key={`${p.name}-${p.role}`}
                        variant="secondary"
                      >
                        {p.name}
                        {p.role && ` (${p.role})`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
