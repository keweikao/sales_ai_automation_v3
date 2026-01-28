/**
 * PageHeader - 頁面標題組件
 * Precision Dashboard Design System
 */

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function PageHeader({
  title,
  subtitle,
  children,
  className,
  style,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      style={style}
    >
      <div>
        <h1 className="font-bold font-display text-3xl tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="font-data text-muted-foreground text-sm">{subtitle}</p>
        )}
      </div>
      {children && <div className="mt-4 sm:mt-0">{children}</div>}
    </div>
  );
}

export type { PageHeaderProps };
