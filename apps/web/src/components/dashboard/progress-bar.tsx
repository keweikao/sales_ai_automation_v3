/**
 * ProgressBar - 進度條組件
 * Precision Dashboard Design System
 */

import { cn } from "@/lib/utils";

const PROGRESS_COLORS = {
  teal: {
    bar: "bg-gradient-to-r from-teal-400 to-teal-500",
    glow: "shadow-[0_0_10px_rgba(45,212,191,0.4)]",
  },
  emerald: {
    bar: "bg-gradient-to-r from-emerald-400 to-emerald-500",
    glow: "shadow-[0_0_10px_rgba(52,211,153,0.4)]",
  },
  rose: {
    bar: "bg-gradient-to-r from-rose-400 to-rose-500",
    glow: "shadow-[0_0_10px_rgba(251,113,133,0.4)]",
  },
  amber: {
    bar: "bg-gradient-to-r from-amber-400 to-amber-500",
    glow: "shadow-[0_0_10px_rgba(251,191,36,0.4)]",
  },
  purple: {
    bar: "bg-gradient-to-r from-purple-400 to-purple-500",
    glow: "shadow-[0_0_10px_rgba(192,132,252,0.4)]",
  },
  sky: {
    bar: "bg-gradient-to-r from-sky-400 to-sky-500",
    glow: "shadow-[0_0_10px_rgba(56,189,248,0.4)]",
  },
  violet: {
    bar: "bg-gradient-to-r from-violet-400 to-violet-500",
    glow: "shadow-[0_0_10px_rgba(167,139,250,0.4)]",
  },
} as const;

const SIZES = {
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
} as const;

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: keyof typeof PROGRESS_COLORS;
  showValue?: boolean;
  animated?: boolean;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  size?: keyof typeof SIZES;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  color = "teal",
  showValue = false,
  animated = true,
  label,
  sublabel,
  size = "md",
  className,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const colorConfig = PROGRESS_COLORS[color];

  return (
    <div className={cn("space-y-2", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="font-data text-foreground text-sm">{label}</span>
          )}
          {showValue && (
            <span className="font-data font-semibold text-[var(--ds-accent)] text-sm">
              {value}
              {max !== 100 && `/${max}`}
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-slate-700/50",
          SIZES[size]
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            colorConfig.bar,
            colorConfig.glow,
            animated && "animate-progress-fill"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {sublabel && (
        <p className="font-data text-muted-foreground text-xs">{sublabel}</p>
      )}
    </div>
  );
}

export type { ProgressBarProps };
