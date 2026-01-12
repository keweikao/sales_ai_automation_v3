import { ApiClient } from "../api-client";
import type { Env } from "../types";

/**
 * 處理警示確認按鈕
 */
export async function handleAcknowledgeAlert(
  alertId: string,
  _userId: string,
  env: Env
): Promise<{ success: boolean; message: string }> {
  const apiClient = new ApiClient(env.API_BASE_URL, env.API_TOKEN);

  try {
    await apiClient.acknowledgeAlert(alertId);
    return {
      success: true,
      message: `警示已確認 (${alertId})`,
    };
  } catch (error) {
    console.error("Error acknowledging alert:", error);
    return {
      success: false,
      message: `確認警示失敗: ${error instanceof Error ? error.message : "未知錯誤"}`,
    };
  }
}

/**
 * 處理警示忽略按鈕
 */
export async function handleDismissAlert(
  alertId: string,
  env: Env
): Promise<{ success: boolean; message: string }> {
  const apiClient = new ApiClient(env.API_BASE_URL, env.API_TOKEN);

  try {
    await apiClient.dismissAlert(alertId);
    return {
      success: true,
      message: `警示已忽略 (${alertId})`,
    };
  } catch (error) {
    console.error("Error dismissing alert:", error);
    return {
      success: false,
      message: `忽略警示失敗: ${error instanceof Error ? error.message : "未知錯誤"}`,
    };
  }
}
