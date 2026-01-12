import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { AlertBadge } from "./alert-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
					key={alert.id}
					className={alert.severity === "high" ? "border-destructive" : ""}
				>
					<CardHeader className="pb-2">
						<div className="flex items-center justify-between">
							<CardTitle className="text-lg">{alert.title}</CardTitle>
							<AlertBadge type={alert.type} severity={alert.severity} />
						</div>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground mb-2">
							{alert.message}
						</p>

						{alert.opportunityName && (
							<p className="text-sm">
								<span className="font-medium">商機：</span>
								{alert.opportunityName}
							</p>
						)}

						<p className="text-xs text-muted-foreground mt-2">
							{formatDistanceToNow(new Date(alert.createdAt), {
								addSuffix: true,
								locale: zhTW,
							})}
						</p>

						{alert.status === "pending" && (
							<div className="flex gap-2 mt-4">
								<Button size="sm" onClick={() => onAcknowledge?.(alert.id)}>
									確認
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() => onDismiss?.(alert.id)}
								>
									忽略
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => onViewDetail?.(alert.id)}
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
