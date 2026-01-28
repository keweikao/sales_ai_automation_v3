/**
 * PDCM Score Card Component
 * 顯示 PDCM (Pain, Decision, Champion, Metrics) 4 維度分數
 */

import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TermTooltip } from "@/components/ui/term-tooltip";
import {
  calculatePdcmTotal,
  type MetricsLevel,
  metricsLevels,
  type PdcmDimension,
  pdcmDimensionLabels,
  pdcmWeights,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface PdcmScore {
  score: number;
  level?: string;
  urgency?: string;
  evidence?: string[];
}

interface PdcmScores {
  pain: PdcmScore;
  decision: PdcmScore;
  champion: PdcmScore;
  metrics: PdcmScore;
  total_score?: number;
}

interface PdcmScoreCardProps {
  pdcmScores: PdcmScores | null;
  className?: string;
  previousScore?: number;
}

// ============================================================
// Helper Functions
// ============================================================

function getScoreColor(score: number): string {
  if (score >= 70) {
    return "text-green-500";
  }
  if (score >= 40) {
    return "text-yellow-500";
  }
  if (score >= 20) {
    return "text-orange-500";
  }
  return "text-red-500";
}

function getProgressBarColor(score: number): string {
  if (score >= 70) {
    return "bg-green-500";
  }
  if (score >= 40) {
    return "bg-yellow-500";
  }
  if (score >= 20) {
    return "bg-orange-500";
  }
  return "bg-red-500";
}

function getMetricsLevelInfo(level: string | undefined): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (!level) {
    return {
      label: "未知",
      color: "text-slate-400",
      bgColor: "bg-slate-500/20",
    };
  }

  const levelInfo = metricsLevels[level as MetricsLevel];
  if (!levelInfo) {
    return {
      label: level,
      color: "text-slate-400",
      bgColor: "bg-slate-500/20",
    };
  }

  const colorMap: Record<string, { color: string; bgColor: string }> = {
    green: { color: "text-green-400", bgColor: "bg-green-500/20" },
    yellow: { color: "text-yellow-400", bgColor: "bg-yellow-500/20" },
    orange: { color: "text-orange-400", bgColor: "bg-orange-500/20" },
    red: { color: "text-red-400", bgColor: "bg-red-500/20" },
  };

  return {
    label: levelInfo.label,
    ...colorMap[levelInfo.color],
  };
}

function getUrgencyBadge(urgency: string | undefined): {
  label: string;
  color: string;
  bgColor: string;
} | null {
  if (!urgency) {
    return null;
  }

  const urgencyMap: Record<
    string,
    { label: string; color: string; bgColor: string }
  > = {
    高: { label: "急迫", color: "text-red-400", bgColor: "bg-red-500/20" },
    中: {
      label: "中等",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/20",
    },
    低: { label: "低", color: "text-slate-400", bgColor: "bg-slate-500/20" },
  };

  return urgencyMap[urgency] || null;
}

// ============================================================
// Component
// ============================================================

export function PdcmScoreCard({
  pdcmScores,
  className,
  previousScore,
}: PdcmScoreCardProps) {
  if (!pdcmScores) {
    return (
      <Card
        className={cn(
          "border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900",
          className
        )}
      >
        <CardHeader className="pb-3">
          <CardTitle className="font-semibold text-lg text-slate-200">
            PDCM 評分
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-slate-600" />
            <p className="mt-3 text-slate-400 text-sm">尚無 PDCM 分析資料</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate total score
  const scores: Record<PdcmDimension, number> = {
    pain: pdcmScores.pain.score,
    decision: pdcmScores.decision.score,
    champion: pdcmScores.champion.score,
    metrics: pdcmScores.metrics.score,
  };
  const totalScore = pdcmScores.total_score ?? calculatePdcmTotal(scores);
  const scoreDiff =
    previousScore !== undefined ? totalScore - previousScore : null;

  // Get metrics level badge
  const metricsLevelInfo = getMetricsLevelInfo(pdcmScores.metrics.level);
  const painUrgency = getUrgencyBadge(pdcmScores.pain.urgency);

  return (
    <Card
      className={cn(
        "border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900",
        className
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="font-semibold text-lg text-slate-200">
          PDCM 評分
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Score Circle */}
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center">
            <svg className="h-32 w-32" viewBox="0 0 100 100">
              <title>PDCM 總分</title>
              {/* Background circle */}
              <circle
                className="text-slate-700/30"
                cx="50"
                cy="50"
                fill="none"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                className={getScoreColor(totalScore)}
                cx="50"
                cy="50"
                fill="none"
                r="45"
                stroke="currentColor"
                strokeDasharray={`${(totalScore / 100) * 283} 283`}
                strokeLinecap="round"
                strokeWidth="8"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={cn("font-bold text-3xl", getScoreColor(totalScore))}
              >
                {totalScore}
              </span>
              <span className="text-slate-500 text-xs">/ 100</span>
            </div>
          </div>

          {/* Score diff */}
          {scoreDiff !== null && (
            <div className="mt-2 flex items-center justify-center gap-1">
              {scoreDiff > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-400" />
              ) : scoreDiff < 0 ? (
                <TrendingDown className="h-4 w-4 text-red-400" />
              ) : null}
              <span
                className={cn(
                  "text-sm",
                  scoreDiff > 0
                    ? "text-green-400"
                    : scoreDiff < 0
                      ? "text-red-400"
                      : "text-slate-400"
                )}
              >
                {scoreDiff > 0 ? "+" : ""}
                {scoreDiff}
              </span>
            </div>
          )}
        </div>

        {/* Dimension Scores */}
        <div className="space-y-4">
          {(Object.keys(pdcmDimensionLabels) as PdcmDimension[]).map(
            (dimension) => {
              const dimensionScore = pdcmScores[dimension];
              const weight = pdcmWeights[dimension];

              return (
                <div className="space-y-1.5" key={dimension}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TermTooltip termKey={dimension}>
                        <span className="font-medium text-slate-300 text-sm">
                          {pdcmDimensionLabels[dimension]}
                        </span>
                      </TermTooltip>
                      {/* Show badges for special dimensions */}
                      {dimension === "metrics" && (
                        <Badge
                          className={cn(
                            "font-mono text-xs",
                            metricsLevelInfo.bgColor,
                            metricsLevelInfo.color
                          )}
                          variant="outline"
                        >
                          {metricsLevelInfo.label}
                        </Badge>
                      )}
                      {dimension === "pain" && painUrgency && (
                        <Badge
                          className={cn(
                            "font-mono text-xs",
                            painUrgency.bgColor,
                            painUrgency.color
                          )}
                          variant="outline"
                        >
                          {painUrgency.label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-bold text-sm",
                          getScoreColor(dimensionScore.score)
                        )}
                      >
                        {dimensionScore.score}
                      </span>
                      <span className="text-slate-500 text-xs">
                        ({weight}%)
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="relative h-2 w-full overflow-hidden rounded-sm bg-slate-700/30">
                    <div
                      className={cn(
                        "h-full transition-all duration-500",
                        getProgressBarColor(dimensionScore.score)
                      )}
                      style={{ width: `${dimensionScore.score}%` }}
                    />
                  </div>

                  {/* Evidence (if available, show first one) */}
                  {dimensionScore.evidence &&
                    dimensionScore.evidence.length > 0 && (
                      <p className="truncate text-slate-500 text-xs">
                        {dimensionScore.evidence[0]}
                      </p>
                    )}
                </div>
              );
            }
          )}
        </div>

        {/* Score Explanation */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 text-slate-400 text-xs">
          <p className="mb-1 font-semibold text-slate-300">評分說明</p>
          <ul className="list-inside list-disc space-y-0.5">
            <li>
              <span className="text-green-400">70+</span> 強勢 - 高機率成交
            </li>
            <li>
              <span className="text-yellow-400">40-69</span> 中等 - 需加強跟進
            </li>
            <li>
              <span className="text-orange-400">20-39</span> 弱勢 - 需重新評估
            </li>
            <li>
              <span className="text-red-400">&lt;20</span> 風險 - 考慮放棄
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
