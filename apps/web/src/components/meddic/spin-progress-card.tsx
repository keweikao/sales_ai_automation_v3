/**
 * SPIN Progress Card Component
 * 顯示 SPIN (Situation, Problem, Implication, Need-Payoff) 銷售技巧達成率
 */

import { AlertCircle, CheckCircle2, Lightbulb, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TermTooltip } from "@/components/ui/term-tooltip";
import { type SpinStage, spinStageLabels } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface SpinStageAnalysis {
  score: number;
  achieved: boolean;
  questions_asked?: string[];
  problems_identified?: string[];
  gap?: string;
  logic_chains?: Array<{
    cause: string;
    effect: string;
  }>;
}

interface SpinAnalysis {
  situation: SpinStageAnalysis;
  problem: SpinStageAnalysis;
  implication: SpinStageAnalysis;
  need_payoff: SpinStageAnalysis;
  overall_spin_score?: number;
  spin_completion_rate?: number;
  key_gap?: string;
  improvement_suggestion?: string;
}

interface SpinProgressCardProps {
  spinAnalysis: SpinAnalysis | null;
  className?: string;
}

// ============================================================
// Helper Functions
// ============================================================

function getAchievementIcon(achieved: boolean, score: number) {
  if (achieved && score >= 60) {
    return <CheckCircle2 className="h-5 w-5 text-green-400" />;
  }
  if (score >= 30) {
    return <AlertCircle className="h-5 w-5 text-yellow-400" />;
  }
  return <XCircle className="h-5 w-5 text-red-400" />;
}

function getAchievementLabel(achieved: boolean, score: number): string {
  if (achieved && score >= 60) {
    return "達成";
  }
  if (score >= 30) {
    return "部分";
  }
  return "不足";
}

function getScoreColor(score: number): string {
  if (score >= 60) {
    return "text-green-400";
  }
  if (score >= 30) {
    return "text-yellow-400";
  }
  return "text-red-400";
}

function getProgressBarColor(score: number): string {
  if (score >= 60) {
    return "bg-green-500";
  }
  if (score >= 30) {
    return "bg-yellow-500";
  }
  return "bg-red-500";
}

// ============================================================
// Component
// ============================================================

export function SpinProgressCard({
  spinAnalysis,
  className,
}: SpinProgressCardProps) {
  if (!spinAnalysis) {
    return (
      <Card
        className={cn(
          "border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900",
          className
        )}
      >
        <CardHeader className="pb-3">
          <CardTitle className="font-semibold text-lg text-slate-200">
            SPIN 銷售技巧
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <Lightbulb className="mx-auto h-12 w-12 text-slate-600" />
            <p className="mt-3 text-slate-400 text-sm">尚無 SPIN 分析資料</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Map to internal stage keys
  const stages: { key: SpinStage; data: SpinStageAnalysis }[] = [
    { key: "situation", data: spinAnalysis.situation },
    { key: "problem", data: spinAnalysis.problem },
    { key: "implication", data: spinAnalysis.implication },
    { key: "needPayoff", data: spinAnalysis.need_payoff },
  ];

  // spin_completion_rate 從後端返回的是 0-1 的小數，需要轉換為百分比
  const completionRate = (spinAnalysis.spin_completion_rate ?? 0) * 100;
  const overallScore = spinAnalysis.overall_spin_score ?? 0;

  // Find the key gap stage
  const keyGapStage = spinAnalysis.key_gap?.toLowerCase();

  return (
    <Card
      className={cn(
        "border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900",
        className
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="font-semibold text-lg text-slate-200">
          SPIN 銷售技巧
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Completion Rate Circle */}
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center">
            <svg className="h-24 w-24" viewBox="0 0 100 100">
              <title>SPIN 達成率</title>
              {/* Background circle */}
              <circle
                className="text-slate-700/30"
                cx="50"
                cy="50"
                fill="none"
                r="40"
                stroke="currentColor"
                strokeWidth="10"
              />
              {/* Progress circle */}
              <circle
                className={getScoreColor(completionRate)}
                cx="50"
                cy="50"
                fill="none"
                r="40"
                stroke="currentColor"
                strokeDasharray={`${(completionRate / 100) * 251} 251`}
                strokeLinecap="round"
                strokeWidth="10"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={cn(
                  "font-bold text-2xl",
                  getScoreColor(completionRate)
                )}
              >
                {completionRate}%
              </span>
              <span className="text-slate-500 text-xs">達成率</span>
            </div>
          </div>
        </div>

        {/* Stage Progress */}
        <div className="space-y-3">
          {stages.map(({ key, data }) => {
            const isKeyGap = keyGapStage?.includes(key.toLowerCase());

            return (
              <div
                className={cn(
                  "rounded-lg p-3 transition-colors",
                  isKeyGap
                    ? "border border-red-500/30 bg-red-500/5"
                    : "border border-transparent bg-slate-800/30"
                )}
                key={key}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getAchievementIcon(data.achieved, data.score)}
                    <TermTooltip termKey={key}>
                      <span className="font-medium text-slate-300 text-sm">
                        {spinStageLabels[key]}
                      </span>
                    </TermTooltip>
                    {isKeyGap && (
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-red-400 text-xs">
                        關鍵缺口
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-bold text-sm",
                        getScoreColor(data.score)
                      )}
                    >
                      {data.score}
                    </span>
                    <span className="text-slate-500 text-xs">
                      ({getAchievementLabel(data.achieved, data.score)})
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/30">
                  <div
                    className={cn(
                      "h-full transition-all duration-500",
                      getProgressBarColor(data.score)
                    )}
                    style={{ width: `${data.score}%` }}
                  />
                </div>

                {/* Gap info for implication */}
                {key === "implication" && data.gap && (
                  <p className="mt-1.5 text-slate-500 text-xs">{data.gap}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Improvement Suggestion */}
        {spinAnalysis.improvement_suggestion && (
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
              <div>
                <p className="mb-1 font-semibold text-purple-300 text-xs">
                  改進建議
                </p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {spinAnalysis.improvement_suggestion}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Key Gap Alert */}
        {spinAnalysis.key_gap && (
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
              <div>
                <p className="mb-1 font-semibold text-orange-300 text-xs">
                  關鍵缺口
                </p>
                <p className="text-slate-300 text-sm">{spinAnalysis.key_gap}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
