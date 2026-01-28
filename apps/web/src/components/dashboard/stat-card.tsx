/**
 * StatCard - 統計卡片組件
 * Precision Dashboard Design System
 */

import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ACCENT_COLORS = {
  teal: "before:bg-teal-400",
  emerald: "before:bg-emerald-400",
  rose: "before:bg-rose-400",
  amber: "before:bg-amber-400",
  purple: "before:bg-purple-400",
  sky: "before:bg-sky-400",
} as const;

const ICON_BG_COLORS = {
  teal: "bg-teal-500/10 text-teal-400",
  emerald: "bg-emerald-500/10 text-emerald-400",
  rose: "bg-rose-500/10 text-rose-400",
  amber: "bg-amber-500/10 text-amber-400",
  purple: "bg-purple-500/10 text-purple-400",
  sky: "bg-sky-500/10 text-sky-400",
} as const;

interface StatCardProps {
  title: React.ReactNode;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  change?: number;
  loading?: boolean;
  accentColor?: keyof typeof ACCENT_COLORS;
  delay?: number;
}

function ChangeBadge({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/15 px-2 py-0.5 font-data font-semibold text-emerald-400 text-xs ring-1 ring-emerald-500/30">
        <ArrowUp className="h-3 w-3" />+{change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-500/15 px-2 py-0.5 font-data font-semibold text-rose-400 text-xs ring-1 ring-rose-500/30">
        <ArrowDown className="h-3 w-3" />
        {change}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-500/15 px-2 py-0.5 font-data font-semibold text-slate-400 text-xs ring-1 ring-slate-500/30">
      <Minus className="h-3 w-3" />0
    </span>
  );
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  change,
  loading,
  accentColor = "teal",
  delay = 0,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:shadow-lg hover:shadow-teal-500/10",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        ACCENT_COLORS[accentColor],
        "animate-fade-in-up opacity-0"
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-data font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          {title}
        </CardTitle>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            ICON_BG_COLORS[accentColor]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="font-bold font-data text-3xl tracking-tight">
                {value}
              </span>
              {change !== undefined && <ChangeBadge change={change} />}
            </div>
            {description && (
              <p className="mt-1 font-data text-muted-foreground text-xs">
                {description}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export type { StatCardProps };
