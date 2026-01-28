/**
 * RankingList - 排名列表組件
 * Precision Dashboard Design System
 */

import { ArrowDown, ArrowUp, Medal, Minus, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RankingItem {
  id: string;
  name: string;
  value: number;
  subtext?: string;
  trend?: "up" | "down" | "stable";
  needsAttention?: boolean;
}

interface RankingListProps {
  items: RankingItem[];
  valueLabel?: string;
  valueSuffix?: string;
  onItemClick?: (item: RankingItem) => void;
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") {
    return <ArrowUp className="h-4 w-4 text-emerald-400" />;
  }
  if (trend === "down") {
    return <ArrowDown className="h-4 w-4 text-rose-400" />;
  }
  return <Minus className="h-4 w-4 text-slate-400" />;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 font-bold font-data text-amber-900 text-sm">
        <Trophy className="h-4 w-4" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gray-300 to-gray-400 font-bold font-data text-gray-800 text-sm">
        <Medal className="h-4 w-4" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-500 font-bold font-data text-orange-900 text-sm">
        <Medal className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted font-data font-semibold text-muted-foreground text-sm">
      {rank}
    </div>
  );
}

function RankingItemRow({
  item,
  rank,
  valueSuffix,
  onClick,
}: {
  item: RankingItem;
  rank: number;
  valueSuffix?: string;
  onClick?: () => void;
}) {
  const isTopThree = rank <= 3;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg p-3 transition-all duration-200",
        "hover:translate-x-1 hover:bg-muted/50",
        isTopThree && rank === 1 && "bg-yellow-500/10",
        isTopThree && rank === 2 && "bg-gray-500/10",
        isTopThree && rank === 3 && "bg-orange-500/10",
        item.needsAttention &&
          "border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-center gap-3">
        <RankBadge rank={rank} />
        <div>
          <p className="font-data font-semibold text-sm">{item.name}</p>
          {item.subtext && (
            <p className="font-data text-muted-foreground text-xs">
              {item.subtext}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {item.trend && <TrendIcon trend={item.trend} />}
        <span className="font-bold font-data text-[var(--ds-accent)] text-lg">
          {item.value}
          {valueSuffix && (
            <span className="text-muted-foreground text-sm">{valueSuffix}</span>
          )}
        </span>
        {item.needsAttention && (
          <Badge className="bg-rose-500/20 text-rose-400" variant="outline">
            需關注
          </Badge>
        )}
      </div>
    </div>
  );
}

export function RankingList({
  items,
  valueLabel,
  valueSuffix,
  onItemClick,
}: RankingListProps) {
  return (
    <div className="space-y-2">
      {valueLabel && (
        <p className="font-data text-muted-foreground text-xs uppercase tracking-wider">
          {valueLabel}
        </p>
      )}
      <div className="space-y-2">
        {items.map((item, index) => (
          <RankingItemRow
            item={item}
            key={item.id}
            onClick={onItemClick ? () => onItemClick(item) : undefined}
            rank={index + 1}
            valueSuffix={valueSuffix}
          />
        ))}
      </div>
    </div>
  );
}

export type { RankingItem, RankingListProps };
