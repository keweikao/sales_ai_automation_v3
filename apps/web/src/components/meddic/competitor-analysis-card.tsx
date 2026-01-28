/**
 * Competitor Analysis Card Component
 * 顯示競品分析結果，包含偵測到的競品、威脅等級、我方優勢和建議話術
 */

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  MessageSquareQuote,
  Shield,
  Star,
  Target,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

export interface DetectedCompetitor {
  name: string;
  customerQuote: string;
  attitude: "positive" | "negative" | "neutral";
  threatLevel: "high" | "medium" | "low";
  ourAdvantages: string[];
  suggestedTalkTracks: string[];
}

export interface CompetitorAnalysis {
  detectedCompetitors: DetectedCompetitor[];
  overallThreatLevel: "high" | "medium" | "low" | "none";
  handlingScore?: number;
}

interface CompetitorAnalysisCardProps {
  analysis: CompetitorAnalysis | null | undefined;
  className?: string;
}

// ============================================================
// Helper Functions
// ============================================================

function getThreatLevelConfig(level: "high" | "medium" | "low" | "none") {
  const config = {
    high: {
      label: "高威脅",
      color: "text-red-400",
      bgColor: "bg-red-500/20",
      borderColor: "border-red-500/30",
    },
    medium: {
      label: "中威脅",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/20",
      borderColor: "border-yellow-500/30",
    },
    low: {
      label: "低威脅",
      color: "text-green-400",
      bgColor: "bg-green-500/20",
      borderColor: "border-green-500/30",
    },
    none: {
      label: "無威脅",
      color: "text-slate-400",
      bgColor: "bg-slate-500/20",
      borderColor: "border-slate-500/30",
    },
  };
  return config[level];
}

function getAttitudeBadge(attitude: "positive" | "negative" | "neutral") {
  const config = {
    positive: {
      label: "正面",
      color: "text-green-400",
      bgColor: "bg-green-500/20",
    },
    negative: {
      label: "負面",
      color: "text-red-400",
      bgColor: "bg-red-500/20",
    },
    neutral: {
      label: "中立",
      color: "text-slate-400",
      bgColor: "bg-slate-500/20",
    },
  };
  return config[attitude];
}

// ============================================================
// Component
// ============================================================

export function CompetitorAnalysisCard({
  analysis,
  className,
}: CompetitorAnalysisCardProps) {
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [expandedCompetitors, setExpandedCompetitors] = useState<Set<number>>(
    new Set()
  );

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(id);
      toast.success("話術已複製到剪貼簿");
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast.error("複製失敗");
    }
  };

  const toggleCompetitor = (index: number) => {
    const newExpanded = new Set(expandedCompetitors);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCompetitors(newExpanded);
  };

  if (!analysis || analysis.detectedCompetitors.length === 0) {
    return (
      <Card
        className={cn(
          "border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900",
          className
        )}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-semibold text-lg text-slate-200">
            <Target className="h-5 w-5 text-amber-400" />
            競品分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <Shield className="mx-auto h-12 w-12 text-slate-600" />
            <p className="mt-3 text-slate-400 text-sm">未偵測到競品提及</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const threatConfig = getThreatLevelConfig(analysis.overallThreatLevel);

  return (
    <Card
      className={cn(
        "border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900",
        className
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-semibold text-lg text-slate-200">
          <Target className="h-5 w-5 text-amber-400" />
          競品分析
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Threat Level */}
        <div
          className={cn(
            "flex items-center justify-between rounded-lg border p-4",
            threatConfig.borderColor,
            threatConfig.bgColor
          )}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn("h-5 w-5", threatConfig.color)} />
            <span className="font-semibold text-slate-300 text-sm">
              整體威脅等級
            </span>
          </div>
          <Badge
            className={cn(
              "font-mono text-xs",
              threatConfig.bgColor,
              threatConfig.color
            )}
            variant="outline"
          >
            {threatConfig.label}
          </Badge>
        </div>

        {/* Handling Score */}
        {analysis.handlingScore !== undefined && (
          <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold text-slate-300 text-sm">
                <Star className="h-4 w-4 text-cyan-400" />
                業務應對評分
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    className={
                      star <= analysis.handlingScore!
                        ? "text-amber-400"
                        : "text-slate-600"
                    }
                    key={star}
                  >
                    ★
                  </span>
                ))}
                <span className="ml-1 text-slate-400 text-xs">
                  ({analysis.handlingScore}/5)
                </span>
              </div>
            </div>
            <p className="text-slate-400 text-xs">
              {analysis.handlingScore >= 4
                ? "表現優異，充分利用我方優勢"
                : analysis.handlingScore >= 3
                  ? "表現良好，有改進空間"
                  : "需要加強競品應對技巧"}
            </p>
          </div>
        )}

        {/* Detected Competitors */}
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-300 text-sm">
            偵測到的競品 ({analysis.detectedCompetitors.length})
          </h3>
          {analysis.detectedCompetitors.map((competitor, index) => {
            const isExpanded = expandedCompetitors.has(index);
            const attitudeConfig = getAttitudeBadge(competitor.attitude);
            const competitorThreatConfig = getThreatLevelConfig(
              competitor.threatLevel
            );

            return (
              <Collapsible key={index} open={isExpanded}>
                <div
                  className={cn(
                    "rounded-lg border border-slate-700/50 bg-slate-800/30 transition-colors",
                    isExpanded && "border-amber-500/30"
                  )}
                >
                  {/* Competitor Header */}
                  <div className="p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="font-semibold text-amber-400">
                            {competitor.name}
                          </span>
                          <Badge
                            className={cn(
                              "text-xs",
                              attitudeConfig.bgColor,
                              attitudeConfig.color
                            )}
                            variant="outline"
                          >
                            {attitudeConfig.label}
                          </Badge>
                          <Badge
                            className={cn(
                              "text-xs",
                              competitorThreatConfig.bgColor,
                              competitorThreatConfig.color
                            )}
                            variant="outline"
                          >
                            {competitorThreatConfig.label}
                          </Badge>
                        </div>
                        {/* Customer Quote */}
                        <p className="border-amber-500/30 border-l-2 pl-3 text-slate-400 text-sm italic">
                          「{competitor.customerQuote}」
                        </p>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <Button
                      className="w-full"
                      onClick={() => toggleCompetitor(index)}
                      size="sm"
                      variant="ghost"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="mr-2 h-4 w-4" />
                          收起應對策略
                        </>
                      ) : (
                        <>
                          <ChevronDown className="mr-2 h-4 w-4" />
                          查看應對策略
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Expanded Content */}
                  <CollapsibleContent>
                    <div className="space-y-4 border-slate-700/30 border-t px-4 pt-4 pb-4">
                      {/* Our Advantages */}
                      {competitor.ourAdvantages.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-green-400" />
                            <span className="font-semibold text-green-400 text-sm">
                              我方優勢
                            </span>
                          </div>
                          <div className="space-y-2">
                            {competitor.ourAdvantages.map((advantage, idx) => (
                              <div
                                className="flex items-start gap-2 rounded border border-green-500/20 bg-green-500/5 p-2"
                                key={idx}
                              >
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                                <p className="text-slate-300 text-sm leading-relaxed">
                                  {advantage}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested Talk Tracks */}
                      {competitor.suggestedTalkTracks.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <MessageSquareQuote className="h-4 w-4 text-cyan-400" />
                            <span className="font-semibold text-cyan-400 text-sm">
                              建議話術
                            </span>
                          </div>
                          <div className="space-y-2">
                            {competitor.suggestedTalkTracks.map(
                              (track, idx) => {
                                const trackId = `${index}-${idx}`;
                                return (
                                  <button
                                    className="group w-full cursor-pointer rounded border border-cyan-500/20 bg-cyan-500/5 p-3 text-left transition-colors hover:border-cyan-500/40"
                                    key={idx}
                                    onClick={() => handleCopy(track, trackId)}
                                    type="button"
                                  >
                                    <div className="flex items-start gap-2">
                                      <span className="shrink-0 font-mono text-cyan-400 text-xs">
                                        {idx + 1}.
                                      </span>
                                      <p className="flex-1 text-cyan-100 text-sm leading-relaxed">
                                        {track}
                                      </p>
                                      <span className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-slate-700/50 group-hover:opacity-100">
                                        {copiedIndex === trackId ? (
                                          <Check className="h-4 w-4 text-cyan-400" />
                                        ) : (
                                          <Copy className="h-4 w-4 text-slate-400" />
                                        )}
                                      </span>
                                    </div>
                                  </button>
                                );
                              }
                            )}
                          </div>
                          <p className="mt-2 text-center text-slate-500 text-xs">
                            點擊話術可複製到剪貼簿
                          </p>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>

        {/* Help Text */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 text-slate-400 text-xs">
          <p className="mb-1 font-semibold text-slate-300">使用建議</p>
          <ul className="list-inside list-disc space-y-0.5">
            <li>展開競品卡片查看詳細應對策略</li>
            <li>點擊話術可快速複製使用</li>
            <li>善用我方優勢進行差異化競爭</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
