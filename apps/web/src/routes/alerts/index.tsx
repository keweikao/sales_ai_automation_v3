import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertList, AlertStats } from "@/components/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAcknowledgeAlert,
  useAlertStats,
  useAlerts,
  useDismissAlert,
} from "@/hooks/use-alerts";

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
    <div className="container space-y-6 py-6">
      <h1 className="font-bold text-2xl">警示中心</h1>

      {statsData && (
        <AlertStats
          acknowledged={statsData.acknowledged}
          byType={statsData.byType}
          pending={statsData.pending}
          resolved={statsData.resolved}
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

        <TabsContent className="mt-4" value="pending">
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

        <TabsContent className="mt-4" value="acknowledged">
          <AlertList
            alerts={acknowledgedData?.alerts ?? []}
            onViewDetail={handleViewDetail}
          />
        </TabsContent>

        <TabsContent className="mt-4" value="resolved">
          <AlertList
            alerts={resolvedData?.alerts ?? []}
            onViewDetail={handleViewDetail}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
