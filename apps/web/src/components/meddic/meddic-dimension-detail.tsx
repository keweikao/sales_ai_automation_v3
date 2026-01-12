import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Target,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { meddicDimensionLabels } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface DimensionData {
  evidence: string[];
  gaps: string[];
  recommendations: string[];
}

type DimensionKey =
  | "metrics"
  | "economicBuyer"
  | "decisionCriteria"
  | "decisionProcess"
  | "identifyPain"
  | "champion";

interface MeddicDimensionDetailProps {
  dimension: DimensionKey;
  score: number;
  data: DimensionData;
  className?: string;
  defaultExpanded?: boolean;
}

export function MeddicDimensionDetail({
  dimension,
  score,
  data,
  className,
  defaultExpanded = true,
}: MeddicDimensionDetailProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const getScoreColor = (score: number) => {
    if (score >= 4) {
      return "text-green-600 dark:text-green-400";
    }
    if (score >= 3) {
      return "text-yellow-600 dark:text-yellow-400";
    }
    if (score >= 2) {
      return "text-orange-600 dark:text-orange-400";
    }
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 4) {
      return "bg-green-100 dark:bg-green-900/30";
    }
    if (score >= 3) {
      return "bg-yellow-100 dark:bg-yellow-900/30";
    }
    if (score >= 2) {
      return "bg-orange-100 dark:bg-orange-900/30";
    }
    return "bg-red-100 dark:bg-red-900/30";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 4) {
      return "優秀";
    }
    if (score >= 3) {
      return "良好";
    }
    if (score >= 2) {
      return "待改善";
    }
    return "不足";
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full font-bold text-lg",
                getScoreBg(score),
                getScoreColor(score)
              )}
            >
              {score}
            </div>
            <div>
              <CardTitle className="text-base">
                {meddicDimensionLabels[dimension]}
              </CardTitle>
              <Badge
                className={cn("mt-1", getScoreColor(score))}
                variant="outline"
              >
                {getScoreLabel(score)}
              </Badge>
            </div>
          </div>
          <Button
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "收合詳情" : "展開詳情"}
            onClick={() => setIsExpanded(!isExpanded)}
            size="sm"
            variant="ghost"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-2">
          {/* Evidence */}
          {data.evidence.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 font-medium text-green-600 text-sm dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>已確認的證據</span>
              </div>
              <ul className="space-y-1.5">
                {data.evidence.map((item, index) => (
                  <li
                    className="flex items-start gap-2 text-muted-foreground text-sm"
                    key={index}
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gaps */}
          {data.gaps.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 font-medium text-orange-600 text-sm dark:text-orange-400">
                <AlertTriangle className="h-4 w-4" />
                <span>需補足的資訊</span>
              </div>
              <ul className="space-y-1.5">
                {data.gaps.map((item, index) => (
                  <li
                    className="flex items-start gap-2 text-muted-foreground text-sm"
                    key={index}
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 font-medium text-blue-600 text-sm dark:text-blue-400">
                <Lightbulb className="h-4 w-4" />
                <span>建議行動</span>
              </div>
              <ul className="space-y-1.5">
                {data.recommendations.map((item, index) => (
                  <li
                    className="flex items-start gap-2 text-muted-foreground text-sm"
                    key={index}
                  >
                    <Target className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Empty State */}
          {data.evidence.length === 0 &&
            data.gaps.length === 0 &&
            data.recommendations.length === 0 && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <XCircle className="h-4 w-4" />
                <span>暫無詳細資料</span>
              </div>
            )}
        </CardContent>
      )}
    </Card>
  );
}

// Component to display all dimensions
interface MeddicDimensionListProps {
  dimensions: Record<DimensionKey, DimensionData>;
  scores: Record<DimensionKey, number>;
  className?: string;
}

export function MeddicDimensionList({
  dimensions,
  scores,
  className,
}: MeddicDimensionListProps) {
  const dimensionOrder: DimensionKey[] = [
    "metrics",
    "economicBuyer",
    "decisionCriteria",
    "decisionProcess",
    "identifyPain",
    "champion",
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {dimensionOrder.map((key) => (
        <MeddicDimensionDetail
          data={
            dimensions[key] || {
              evidence: [],
              gaps: [],
              recommendations: [],
            }
          }
          defaultExpanded={false}
          dimension={key}
          key={key}
          score={scores[key]}
        />
      ))}
    </div>
  );
}
