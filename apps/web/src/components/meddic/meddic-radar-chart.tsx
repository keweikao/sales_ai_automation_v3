import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { meddicDimensionLabels } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function getScoreDotColor(score: number): string {
  if (score >= 4) {
    return "bg-green-500";
  }
  if (score >= 3) {
    return "bg-yellow-500";
  }
  if (score >= 2) {
    return "bg-orange-500";
  }
  return "bg-red-500";
}

interface MeddicScores {
  metrics: number;
  economicBuyer: number;
  decisionCriteria: number;
  decisionProcess: number;
  identifyPain: number;
  champion: number;
}

interface MeddicRadarChartProps {
  scores: MeddicScores;
  className?: string;
  showLabels?: boolean;
  height?: number;
}

export function MeddicRadarChart({
  scores,
  className,
  showLabels = true,
  height = 300,
}: MeddicRadarChartProps) {
  const data = [
    {
      dimension: meddicDimensionLabels.metrics,
      score: scores.metrics,
      fullMark: 5,
    },
    {
      dimension: meddicDimensionLabels.economicBuyer,
      score: scores.economicBuyer,
      fullMark: 5,
    },
    {
      dimension: meddicDimensionLabels.decisionCriteria,
      score: scores.decisionCriteria,
      fullMark: 5,
    },
    {
      dimension: meddicDimensionLabels.decisionProcess,
      score: scores.decisionProcess,
      fullMark: 5,
    },
    {
      dimension: meddicDimensionLabels.identifyPain,
      score: scores.identifyPain,
      fullMark: 5,
    },
    {
      dimension: meddicDimensionLabels.champion,
      score: scores.champion,
      fullMark: 5,
    },
  ];

  // Calculate average score for color
  const avgScore =
    (scores.metrics +
      scores.economicBuyer +
      scores.decisionCriteria +
      scores.decisionProcess +
      scores.identifyPain +
      scores.champion) /
    6;

  const getColor = (score: number) => {
    if (score >= 4) {
      return { fill: "#22c55e", stroke: "#16a34a" }; // green
    }
    if (score >= 3) {
      return { fill: "#eab308", stroke: "#ca8a04" }; // yellow
    }
    if (score >= 2) {
      return { fill: "#f97316", stroke: "#ea580c" }; // orange
    }
    return { fill: "#ef4444", stroke: "#dc2626" }; // red
  };

  const colors = getColor(avgScore);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">MEDDIC 雷達圖</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer height={height} width="100%">
          <RadarChart cx="50%" cy="50%" data={data} outerRadius="80%">
            <PolarGrid
              className="text-muted-foreground/30"
              stroke="currentColor"
            />
            <PolarAngleAxis
              dataKey="dimension"
              tick={
                showLabels
                  ? {
                      fill: "currentColor",
                      fontSize: 11,
                      className: "text-muted-foreground",
                    }
                  : false
              }
              tickLine={false}
            />
            <PolarRadiusAxis
              angle={30}
              axisLine={false}
              domain={[0, 5]}
              tick={{
                fill: "currentColor",
                fontSize: 10,
                className: "text-muted-foreground",
              }}
              tickCount={6}
            />
            <Radar
              dataKey="score"
              fill={colors.fill}
              fillOpacity={0.4}
              name="MEDDIC Score"
              stroke={colors.stroke}
              strokeWidth={2}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!(active && payload?.length)) {
                  return null;
                }
                const data = payload[0].payload;
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-md">
                    <p className="font-medium text-sm">{data.dimension}</p>
                    <p className="text-muted-foreground text-sm">
                      分數: {data.score} / 5
                    </p>
                  </div>
                );
              }}
            />
          </RadarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          {data.map((item) => (
            <div className="flex items-center gap-2" key={item.dimension}>
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  getScoreDotColor(item.score)
                )}
              />
              <span className="truncate text-muted-foreground">
                {item.dimension}: {item.score}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
