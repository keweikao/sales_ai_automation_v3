import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertBadge } from "@/components/alert";
import {
	useAlert,
	useAcknowledgeAlert,
	useDismissAlert,
	useResolveAlert,
} from "@/hooks/use-alerts";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/alerts/$alertId")({
	component: AlertDetailPage,
});

function AlertDetailPage() {
	const { alertId } = Route.useParams();
	const navigate = useNavigate();
	const { data: alert, isLoading, error } = useAlert(alertId);
	const [resolution, setResolution] = useState("");

	const acknowledgeMutation = useAcknowledgeAlert();
	const dismissMutation = useDismissAlert();
	const resolveMutation = useResolveAlert();

	const handleBack = () => {
		navigate({ to: "/alerts" });
	};

	const handleAcknowledge = () => {
		acknowledgeMutation.mutate(alertId);
	};

	const handleDismiss = () => {
		dismissMutation.mutate(alertId);
	};

	const handleResolve = () => {
		resolveMutation.mutate({ alertId, resolution });
	};

	if (isLoading) {
		return (
			<div className="container py-6">
				<p>載入中...</p>
			</div>
		);
	}

	if (error || !alert) {
		return (
			<div className="container py-6">
				<p className="text-destructive">無法載入警示資料</p>
				<Button variant="outline" onClick={handleBack} className="mt-4">
					<ArrowLeft className="mr-2 h-4 w-4" />
					返回列表
				</Button>
			</div>
		);
	}

	const isPending = alert.status === "pending";
	const isAcknowledged = alert.status === "acknowledged";

	return (
		<div className="container py-6 space-y-6">
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="icon" onClick={handleBack}>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<h1 className="text-2xl font-bold">警示詳情</h1>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				{/* 主要資訊 */}
				<Card>
					<CardHeader>
						<div className="flex items-start justify-between">
							<div className="space-y-1">
								<CardTitle>{alert.title}</CardTitle>
								<CardDescription>
									{formatDistanceToNow(new Date(alert.createdAt), {
										addSuffix: true,
										locale: zhTW,
									})}
								</CardDescription>
							</div>
							<AlertBadge type={alert.type} severity={alert.severity} />
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<h3 className="text-sm font-medium text-muted-foreground mb-1">
								訊息內容
							</h3>
							<p>{alert.message}</p>
						</div>

						<div className="flex items-center gap-2">
							<span className="text-sm font-medium text-muted-foreground">
								狀態：
							</span>
							<StatusBadge status={alert.status} />
						</div>

						{alert.slackNotified && (
							<p className="text-sm text-muted-foreground">
								✓ 已發送 Slack 通知
							</p>
						)}
					</CardContent>
				</Card>

				{/* MEDDIC 分數 & 觸發原因 */}
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">觸發詳情</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{alert.context?.meddicScore !== undefined && (
							<div>
								<h3 className="text-sm font-medium text-muted-foreground mb-1">
									MEDDIC 分數
								</h3>
								<div className="flex items-center gap-2">
									<span className="text-2xl font-bold">
										{alert.context.meddicScore}
									</span>
									<span className="text-muted-foreground">/ 100</span>
								</div>
							</div>
						)}

						<div>
							<h3 className="text-sm font-medium text-muted-foreground mb-1">
								觸發原因
							</h3>
							<p className="text-sm">{alert.context?.triggerReason}</p>
						</div>

						<div>
							<h3 className="text-sm font-medium text-muted-foreground mb-1">
								建議行動
							</h3>
							<p className="text-sm">{alert.context?.suggestedAction}</p>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* 操作區域 */}
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">操作</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{isPending && (
						<div className="flex gap-3">
							<Button
								onClick={handleAcknowledge}
								disabled={acknowledgeMutation.isPending}
							>
								<CheckCircle className="mr-2 h-4 w-4" />
								確認處理
							</Button>
							<Button
								variant="outline"
								onClick={handleDismiss}
								disabled={dismissMutation.isPending}
							>
								<XCircle className="mr-2 h-4 w-4" />
								忽略
							</Button>
						</div>
					)}

					{isAcknowledged && (
						<div className="space-y-3">
							<Textarea
								placeholder="請輸入解決方案說明..."
								value={resolution}
								onChange={(e) => setResolution(e.target.value)}
								rows={3}
							/>
							<Button
								onClick={handleResolve}
								disabled={resolveMutation.isPending || !resolution.trim()}
							>
								<CheckCircle className="mr-2 h-4 w-4" />
								標記為已解決
							</Button>
						</div>
					)}

					{alert.status === "resolved" && (
						<div className="flex items-center gap-2 text-green-600">
							<CheckCircle className="h-5 w-5" />
							<span>此警示已解決</span>
						</div>
					)}

					{alert.status === "dismissed" && (
						<div className="flex items-center gap-2 text-muted-foreground">
							<XCircle className="h-5 w-5" />
							<span>此警示已忽略</span>
						</div>
					)}
				</CardContent>
			</Card>

			{/* 相關連結 */}
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">相關資訊</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<Button
						variant="link"
						className="p-0 h-auto"
						onClick={() =>
							navigate({
								to: "/opportunities/$opportunityId",
								params: { opportunityId: alert.opportunityId },
							})
						}
					>
						查看商機詳情 →
					</Button>
					{alert.conversationId && (
						<>
							<br />
							<Button
								variant="link"
								className="p-0 h-auto"
								onClick={() =>
									navigate({
										to: "/conversations/$conversationId",
										params: { conversationId: alert.conversationId as string },
									})
								}
							>
								查看對話記錄 →
							</Button>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const statusConfig: Record<
		string,
		{ label: string; className: string; icon: React.ReactNode }
	> = {
		pending: {
			label: "待處理",
			className: "bg-yellow-100 text-yellow-800",
			icon: <AlertTriangle className="h-3 w-3" />,
		},
		acknowledged: {
			label: "已確認",
			className: "bg-blue-100 text-blue-800",
			icon: <CheckCircle className="h-3 w-3" />,
		},
		resolved: {
			label: "已解決",
			className: "bg-green-100 text-green-800",
			icon: <CheckCircle className="h-3 w-3" />,
		},
		dismissed: {
			label: "已忽略",
			className: "bg-gray-100 text-gray-800",
			icon: <XCircle className="h-3 w-3" />,
		},
	};

	const config = statusConfig[status] ?? statusConfig.pending;

	return (
		<span
			className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.className}`}
		>
			{config.icon}
			{config.label}
		</span>
	);
}
