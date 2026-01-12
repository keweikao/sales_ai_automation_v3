import { Badge } from "@/components/ui/badge";

interface AlertBadgeProps {
  type: "close_now" | "missing_dm" | "manager_escalation";
  severity: "high" | "medium" | "low";
}

export function AlertBadge({ type, severity }: AlertBadgeProps) {
  const typeLabels: Record<string, string> = {
    close_now: "Close Now",
    missing_dm: "缺少 DM",
    manager_escalation: "需主管關注",
  };

  const severityVariants: Record<
    string,
    "destructive" | "secondary" | "outline"
  > = {
    high: "destructive",
    medium: "secondary",
    low: "outline",
  };

  return (
    <Badge variant={severityVariants[severity]}>
      {typeLabels[type] || type}
    </Badge>
  );
}
