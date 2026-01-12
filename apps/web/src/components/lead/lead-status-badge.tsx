import { getLeadStatusInfo } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface LeadStatusBadgeProps {
  status: string;
  className?: string;
}

const statusColorMap: Record<string, string> = {
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  yellow:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  orange:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  emerald:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const statusInfo = getLeadStatusInfo(status);
  const colorClass = statusColorMap[statusInfo.color] || statusColorMap.gray;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs",
        colorClass,
        className
      )}
    >
      {statusInfo.label}
    </span>
  );
}
