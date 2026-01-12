import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertBadge } from "./alert-badge";

interface Alert {
  id: string;
  type: "close_now" | "missing_dm" | "manager_escalation";
  severity: "high" | "medium" | "low";
  status: "pending" | "acknowledged" | "resolved" | "dismissed";
  title: string;
  message: string;
  createdAt: string;
  opportunityName?: string;
}

interface AlertListProps {
  alerts: Alert[];
  onAcknowledge?: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
  onViewDetail?: (alertId: string) => void;
}

export function AlertList({
  alerts,
  onAcknowledge,
  onDismiss,
  onViewDetail,
}: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          目前沒有待處理的警示
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <Card
          className={alert.severity === "high" ? "border-destructive" : ""}
          key={alert.id}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{alert.title}</CardTitle>
              <AlertBadge severity={alert.severity} type={alert.type} />
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-muted-foreground text-sm">
              {alert.message}
            </p>

            {alert.opportunityName && (
              <p className="text-sm">
                <span className="font-medium">商機：</span>
                {alert.opportunityName}
              </p>
            )}

            <p className="mt-2 text-muted-foreground text-xs">
              {formatDistanceToNow(new Date(alert.createdAt), {
                addSuffix: true,
                locale: zhTW,
              })}
            </p>

            {alert.status === "pending" && (
              <div className="mt-4 flex gap-2">
                <Button onClick={() => onAcknowledge?.(alert.id)} size="sm">
                  確認
                </Button>
                <Button
                  onClick={() => onDismiss?.(alert.id)}
                  size="sm"
                  variant="outline"
                >
                  忽略
                </Button>
                <Button
                  onClick={() => onViewDetail?.(alert.id)}
                  size="sm"
                  variant="ghost"
                >
                  查看詳情
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
