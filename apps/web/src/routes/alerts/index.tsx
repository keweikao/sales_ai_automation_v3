import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertList, AlertStats } from "@/components/alert";
import {
	useAlerts,
	useAlertStats,
	useAcknowledgeAlert,
	useDismissAlert,
} from "@/hooks/use-alerts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/alerts/")({
	component: AlertsPage,
});

function AlertsPage() {
	const navigate = useNavigate();
	const { data: statsData } = useAlertStats();
	const { data: pendingData, isLoading: pendingLoading } = useAlerts({
		status: "pending",
	});
	const { data: acknowledgedData } = useAlerts({ status: "acknowledged" });
	const { data: resolvedData } = useAlerts({ status: "resolved" });

	const acknowledgeMutation = useAcknowledgeAlert();
	const dismissMutation = useDismissAlert();

	const handleAcknowledge = (alertId: string) => {
		acknowledgeMutation.mutate(alertId);
	};

	const handleDismiss = (alertId: string) => {
		dismissMutation.mutate(alertId);
	};

	const handleViewDetail = (alertId: string) => {
		navigate({ to: "/alerts/$alertId", params: { alertId } });
	};

	return (
		<div className="container py-6 space-y-6">
			<h1 className="text-2xl font-bold">警示中心</h1>

			{statsData && (
				<AlertStats
					pending={statsData.pending}
					acknowledged={statsData.acknowledged}
					resolved={statsData.resolved}
					byType={statsData.byType}
				/>
			)}

			<Tabs defaultValue="pending">
				<TabsList>
					<TabsTrigger value="pending">
						待處理 ({pendingData?.total ?? 0})
					</TabsTrigger>
					<TabsTrigger value="acknowledged">
						已確認 ({acknowledgedData?.total ?? 0})
					</TabsTrigger>
					<TabsTrigger value="resolved">
						已解決 ({resolvedData?.total ?? 0})
					</TabsTrigger>
				</TabsList>

				<TabsContent value="pending" className="mt-4">
					{pendingLoading ? (
						<p>載入中...</p>
					) : (
						<AlertList
							alerts={pendingData?.alerts ?? []}
							onAcknowledge={handleAcknowledge}
							onDismiss={handleDismiss}
							onViewDetail={handleViewDetail}
						/>
					)}
				</TabsContent>

				<TabsContent value="acknowledged" className="mt-4">
					<AlertList
						alerts={acknowledgedData?.alerts ?? []}
						onViewDetail={handleViewDetail}
					/>
				</TabsContent>

				<TabsContent value="resolved" className="mt-4">
					<AlertList
						alerts={resolvedData?.alerts ?? []}
						onViewDetail={handleViewDetail}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}
