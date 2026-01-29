/**
 * Analytics Router Cache Helper
 * KV 快取相關功能
 */

import {
  createKVCacheService,
  type KVCacheService,
} from "@Sales_ai_automation_v3/services";

/**
 * Hono Context 中的環境變數型別
 */
interface HonoEnv {
  CACHE_KV?: KVNamespace;
}

/**
 * Procedure Context 型別
 */
interface ProcedureContext {
  honoContext?: {
    env?: HonoEnv;
  };
}

/**
 * 從 context 取得 KV Cache 服務
 * @param context - Procedure context
 * @returns KVCacheService 實例，如果 KV 不可用則返回 null
 */
export function getKVCacheService(
  context: ProcedureContext
): KVCacheService | null {
  const honoEnv = context.honoContext?.env;
  if (!honoEnv?.CACHE_KV) {
    return null;
  }
  return createKVCacheService(honoEnv.CACHE_KV);
}

/**
 * 預設 TTL 常數（秒）
 */
export const CACHE_TTL = {
  /** Dashboard 快取時間：5 分鐘 */
  DASHBOARD: 300,
  /** 統計資料快取時間：5 分鐘 */
  STATS: 300,
  /** 報告資料快取時間：5 分鐘 */
  REPORT: 300,
} as const;

/**
 * 產生 cache key
 */
export const CacheKeys = {
  /** 全域商機統計 */
  opportunityStats: () => "stats:opportunity:global",

  /** Dashboard（依範圍和用戶）*/
  dashboard: (scopeLabel: string, userId: string, role: string) =>
    `dashboard:${scopeLabel}:${role === "sales_rep" ? userId : scopeLabel}`,

  /** 業務個人報告 */
  repReport: (userId: string) => `report:rep:${userId}`,

  /** 團隊報告 */
  teamReport: (department: string) => `report:team:${department}`,
} as const;
