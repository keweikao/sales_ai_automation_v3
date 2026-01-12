/**
 * Source Badge Component
 * 顯示潛客來源的標籤
 */

import {
  FileUp,
  Globe,
  HelpCircle,
  UserPlus,
  Users,
  Webhook,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type SourceType = "squarespace" | "manual" | "import" | "api" | "referral";

interface SourceBadgeProps {
  source: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

const SOURCE_CONFIG: Record<
  SourceType,
  {
    label: string;
    icon: typeof Globe;
    variant: "default" | "secondary" | "outline";
    className: string;
  }
> = {
  squarespace: {
    label: "Squarespace",
    icon: Globe,
    variant: "default",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  manual: {
    label: "手動輸入",
    icon: UserPlus,
    variant: "secondary",
    className: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
  },
  import: {
    label: "匯入",
    icon: FileUp,
    variant: "outline",
    className: "bg-green-500/10 text-green-700 dark:text-green-400",
  },
  api: {
    label: "API",
    icon: Webhook,
    variant: "outline",
    className: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  },
  referral: {
    label: "推薦",
    icon: Users,
    variant: "default",
    className: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  },
};

export function SourceBadge({
  source,
  showIcon = true,
  size = "md",
}: SourceBadgeProps) {
  const config = SOURCE_CONFIG[source as SourceType] || {
    label: source,
    icon: HelpCircle,
    variant: "outline" as const,
    className: "",
  };

  const Icon = config.icon;
  const sizeClasses = size === "sm" ? "text-xs py-0" : "";

  return (
    <Badge
      className={`${config.className} ${sizeClasses}`}
      variant={config.variant}
    >
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      {config.label}
    </Badge>
  );
}

export default SourceBadge;
