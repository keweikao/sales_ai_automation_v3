import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMeddicStatusInfo, meddicDimensionLabels } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function getOverallScoreColor(score: number): string {
  if (score >= 70) {
    return "text-green-500";
  }
  if (score >= 40) {
    return "text-yellow-500";
  }
  return "text-red-500";
}

function getDiffColor(diff: number): string {
  if (diff > 0) {
    return "text-green-600 dark:text-green-400";
  }
  if (diff < 0) {
    return "text-red-600 dark:text-red-400";
  }
  return "text-muted-foreground";
}

function DiffIcon({ diff }: { diff: number }) {
  if (diff > 0) {
    return <TrendingUp className="h-4 w-4" />;
  }
  if (diff < 0) {
    return <TrendingDown className="h-4 w-4" />;
  }
  return null;
}

interface MeddicScores {
  metrics: number;
  economicBuyer: number;
  decisionCriteria: number;
  decisionProcess: number;
  identifyPain: number;
  champion: number;
}

interface MeddicScoreCardProps {
  overallScore: number;
  dimensions: MeddicScores;
  previousScore?: number;
  className?: string;
  onDimensionClick?: (dimension: keyof MeddicScores) => void;
}

const dimensionWeights: Record<keyof MeddicScores, number> = {
  metrics: 15,
  economicBuyer: 20,
  decisionCriteria: 15,
  decisionProcess: 15,
  identifyPain: 20,
  champion: 15,
};

export function MeddicScoreCard({
  overallScore,
  dimensions,
  previousScore,
  className,
  onDimensionClick,
}: MeddicScoreCardProps) {
  const statusInfo = getMeddicStatusInfo(overallScore);
  const scoreDiff =
    previousScore !== undefined ? overallScore - previousScore : null;

  const getScoreColor = (score: number, maxScore = 5) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) {
      return "bg-green-500";
    }
    if (percentage >= 60) {
      return "bg-yellow-500";
    }
    if (percentage >= 40) {
      return "bg-orange-500";
    }
    return "bg-red-500";
  };

  const statusColors: Record<string, string> = {
    green: "text-green-600 dark:text-green-400",
    yellow: "text-yellow-600 dark:text-yellow-400",
    orange: "text-orange-600 dark:text-orange-400",
    red: "text-red-600 dark:text-red-400",
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">MEDDIC 評分</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center">
            <svg className="h-32 w-32" viewBox="0 0 100 100">
              <title>MEDDIC 分數圖表</title>
              {/* Background circle */}
              <circle
                className="text-muted/20"
                cx="50"
                cy="50"
                fill="none"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                className={getOverallScoreColor(overallScore)}
                cx="50"
                cy="50"
                fill="none"
                r="45"
                stroke="currentColor"
                strokeDasharray={`${(overallScore / 100) * 283} 283`}
                strokeLinecap="round"
                strokeWidth="8"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-bold text-3xl">{overallScore}</span>
              <span className="text-muted-foreground text-xs">/ 100</span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-center gap-2">
            <span className={cn("font-medium", statusColors[statusInfo.color])}>
              {statusInfo.label}
            </span>
            {scoreDiff !== null && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-sm",
                  getDiffColor(scoreDiff)
                )}
              >
                <DiffIcon diff={scoreDiff} />
                {scoreDiff > 0 ? "+" : ""}
                {scoreDiff}
              </span>
            )}
          </div>
        </div>

        {/* Dimension Scores */}
        <div className="space-y-3">
          {(Object.entries(dimensions) as [keyof MeddicScores, number][]).map(
            ([key, score]) => (
              <div
                className={cn(
                  "space-y-1",
                  onDimensionClick && "cursor-pointer hover:opacity-80"
                )}
                key={key}
                onClick={() => onDimensionClick?.(key)}
                onKeyDown={
                  onDimensionClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onDimensionClick(key);
                        }
                      }
                    : undefined
                }
                role={onDimensionClick ? "button" : undefined}
                tabIndex={onDimensionClick ? 0 : undefined}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {meddicDimensionLabels[key]}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{score}/5</span>
                    <span className="text-muted-foreground text-xs">
                      ({dimensionWeights[key]}%)
                    </span>
                  </div>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-none bg-muted">
                  <div
                    className={cn(
                      "h-full transition-all",
                      getScoreColor(score)
                    )}
                    style={{ width: `${(score / 5) * 100}%` }}
                  />
                </div>
              </div>
            )
          )}
        </div>

        {/* Score Explanation */}
        <div className="rounded-lg bg-muted/50 p-3 text-muted-foreground text-xs">
          <p>
            <strong>評分說明：</strong>
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>70+ 強勢 (Strong) - 高機率成交</li>
            <li>40-69 中等 (Medium) - 需加強跟進</li>
            <li>20-39 弱勢 (Weak) - 需重新評估</li>
            <li>&lt;20 風險 (At Risk) - 考慮放棄</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
