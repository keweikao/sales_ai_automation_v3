import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useAlerts(params?: {
  status?: "pending" | "acknowledged" | "resolved" | "dismissed";
  type?: "close_now" | "missing_dm" | "manager_escalation";
  opportunityId?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["alerts", params],
    queryFn: () => orpc.alert.list.call(params ?? {}),
  });
}

export function useAlert(alertId: string) {
  return useQuery({
    queryKey: ["alert", alertId],
    queryFn: () => orpc.alert.get.call({ alertId }),
    enabled: !!alertId,
  });
}

export function useAlertStats() {
  return useQuery({
    queryKey: ["alertStats"],
    queryFn: () => orpc.alert.stats.call({}),
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: string) => orpc.alert.acknowledge.call({ alertId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alertStats"] });
    },
  });
}

export function useDismissAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: string) => orpc.alert.dismiss.call({ alertId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alertStats"] });
    },
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      alertId,
      resolution,
    }: {
      alertId: string;
      resolution: string;
    }) => orpc.alert.resolve.call({ alertId, resolution }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alertStats"] });
    },
  });
}
