/**
 * Analytics Router Utility Functions
 * 共用的工具函數
 */

import {
  meddicAnalyses,
  opportunities,
} from "@Sales_ai_automation_v3/db/schema";
import { eq, gte, inArray, lte, type SQL } from "drizzle-orm";

/**
 * 分數四捨五入工具函數
 * @param score - 原始分數
 * @param decimals - 小數位數（預設 1）
 * @returns 四捨五入後的分數
 */
export function roundScore(
  score: number | null | undefined,
  decimals = 1
): number {
  if (score == null) {
    return 0;
  }
  const multiplier = 10 ** decimals;
  return Math.round(Number(score) * multiplier) / multiplier;
}

/**
 * 建立日期過濾條件
 * @param dateFrom - 起始日期（可選）
 * @param dateTo - 結束日期（可選）
 * @returns Drizzle ORM 過濾條件陣列
 */
export function buildDateConditions(
  dateFrom?: string,
  dateTo?: string
): SQL<unknown>[] {
  const conditions: SQL<unknown>[] = [];
  if (dateFrom) {
    conditions.push(gte(meddicAnalyses.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(meddicAnalyses.createdAt, new Date(dateTo)));
  }
  return conditions;
}

/**
 * 建立用戶過濾條件
 * @param targetUserIds - 目標用戶 ID 陣列
 * @returns Drizzle ORM 過濾條件，如果陣列為空則返回 undefined（不過濾）
 */
export function buildUserCondition(
  targetUserIds: string[]
): SQL<unknown> | undefined {
  if (targetUserIds.length === 0) {
    return undefined; // 不過濾
  }
  if (targetUserIds.length === 1) {
    return eq(opportunities.userId, targetUserIds[0]!);
  }
  return inArray(opportunities.userId, targetUserIds);
}

/**
 * 計算趨勢方向
 * @param current - 當前分數
 * @param previous - 上期分數
 * @param threshold - 變化閾值（預設 0.3）
 * @returns 趨勢方向：'up' | 'down' | 'stable'
 */
export function calculateTrend(
  current: number,
  previous: number,
  threshold = 0.3
): "up" | "down" | "stable" {
  if (previous === 0) {
    return "stable";
  }
  const change = current - previous;
  if (change > threshold) {
    return "up";
  }
  if (change < -threshold) {
    return "down";
  }
  return "stable";
}

/**
 * 時間區間範圍
 */
export interface PeriodRange {
  start: Date;
  end: Date;
}

/**
 * 計算時間區間範圍
 * @param dateFrom - 起始日期（可選，預設 30 天前）
 * @param dateTo - 結束日期（可選，預設今天）
 * @returns 當期和上期的時間範圍
 */
export function getPeriodRanges(
  dateFrom?: string,
  dateTo?: string
): {
  current: PeriodRange;
  previous: PeriodRange;
} {
  const currentPeriodStart = dateFrom
    ? new Date(dateFrom)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const currentPeriodEnd = dateTo ? new Date(dateTo) : new Date();

  // 計算上一期間（用於比較）
  const periodLength =
    currentPeriodEnd.getTime() - currentPeriodStart.getTime();
  const previousPeriodStart = new Date(
    currentPeriodStart.getTime() - periodLength
  );
  const previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);

  return {
    current: {
      start: currentPeriodStart,
      end: currentPeriodEnd,
    },
    previous: {
      start: previousPeriodStart,
      end: previousPeriodEnd,
    },
  };
}

/**
 * 取得今天的日期字串 (YYYY-MM-DD 格式)
 */
export function getTodayDateString(): string {
  return (
    new Date().toISOString().split("T")[0] ??
    new Date().toISOString().slice(0, 10)
  );
}
