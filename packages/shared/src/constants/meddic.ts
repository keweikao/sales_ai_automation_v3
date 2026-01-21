/**
 * MEDDIC Constants
 * 共用的 MEDDIC 相關常數定義
 */

/**
 * MEDDIC 六大維度的中文名稱對照
 * 用於 UI 顯示和報告生成
 */
export const MEDDIC_DIMENSION_NAMES = {
  metrics: "量化指標 (Metrics)",
  economicBuyer: "經濟買家 (Economic Buyer)",
  decisionCriteria: "決策標準 (Decision Criteria)",
  decisionProcess: "決策流程 (Decision Process)",
  identifyPain: "痛點識別 (Identify Pain)",
  champion: "內部支持者 (Champion)",
} as const;

/**
 * MEDDIC 維度的 key 列表
 */
export const MEDDIC_DIMENSION_KEYS = [
  "metrics",
  "economicBuyer",
  "decisionCriteria",
  "decisionProcess",
  "identifyPain",
  "champion",
] as const;

/**
 * MEDDIC 維度 key 的型別
 */
export type MeddicDimensionKey = (typeof MEDDIC_DIMENSION_KEYS)[number];
