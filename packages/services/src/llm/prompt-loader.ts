/**
 * MEDDIC Prompt Loader
 * 載入產品線特定的 MEDDIC 提示詞
 */

import type { ProductLine } from "@sales_ai_automation_v3/shared/product-configs";
import { MEDDIC_PROMPTS } from "./prompts.generated.js";

/**
 * MEDDIC 提示詞集合
 * 包含 shared（通用）和產品線特定提示詞
 */
export interface MeddicPromptSet {
  // Shared prompts (所有產品線通用)
  system: string;
  analysisFramework: string;
  outputFormat: string;

  // Product-specific prompts (產品線特定)
  metricsFocus: string;
  decisionProcess: string;
  economicBuyer: string;
  decisionCriteria: string;
  identifyPain: string;
  champion: string;
}

/**
 * 載入產品線特定的 MEDDIC 提示詞
 *
 * @param productLine - 產品線 ID ('ichef' | 'beauty')
 * @returns 完整的 MEDDIC 提示詞集合
 *
 * @example
 * ```typescript
 * // 載入 iCHEF 提示詞
 * const prompts = loadMeddicPrompts('ichef');
 * console.log(prompts.metricsFocus); // iCHEF 專屬 Metrics 提示詞
 *
 * // 載入美業提示詞
 * const beautyPrompts = loadMeddicPrompts('beauty');
 * console.log(beautyPrompts.metricsFocus); // 美業專屬 Metrics 提示詞
 *
 * // 預設為 iCHEF
 * const defaultPrompts = loadMeddicPrompts();
 * ```
 */
export function loadMeddicPrompts(
  productLine: ProductLine = "ichef"
): MeddicPromptSet {
  const shared = MEDDIC_PROMPTS.shared;
  const specific = MEDDIC_PROMPTS[productLine];

  return {
    // Shared prompts (所有產品線通用)
    system: shared.system,
    analysisFramework: shared.analysisFramework,
    outputFormat: shared.outputFormat,

    // Product-specific prompts
    metricsFocus: specific.metricsFocus,
    decisionProcess: specific.decisionProcess,
    economicBuyer: specific.economicBuyer,
    decisionCriteria: specific.decisionCriteria,
    identifyPain: specific.identifyPain,
    champion: specific.champion,
  };
}

/**
 * MEDDIC Agent 類型
 */
export type MeddicAgentType =
  | "metricsFocus"
  | "decisionProcess"
  | "economicBuyer"
  | "decisionCriteria"
  | "identifyPain"
  | "champion";

/**
 * 組合完整的 Agent 提示詞
 *
 * 組合順序：system + analysisFramework + specific + outputFormat
 *
 * @param agentType - MEDDIC Agent 類型
 * @param productLine - 產品線 ID
 * @returns 完整的提示詞（包含系統提示詞、分析框架、特定提示詞、輸出格式）
 *
 * @example
 * ```typescript
 * // 組合 iCHEF Metrics Agent 提示詞
 * const prompt = buildAgentPrompt('metricsFocus', 'ichef');
 *
 * // 組合美業 Decision Process Agent 提示詞
 * const dpPrompt = buildAgentPrompt('decisionProcess', 'beauty');
 * ```
 */
export function buildAgentPrompt(
  agentType: MeddicAgentType,
  productLine: ProductLine = "ichef"
): string {
  const prompts = loadMeddicPrompts(productLine);

  return `${prompts.system}

${prompts.analysisFramework}

${prompts[agentType]}

${prompts.outputFormat}`;
}

/**
 * 取得所有可用的產品線
 *
 * @returns 產品線 ID 陣列
 *
 * @example
 * ```typescript
 * const lines = getAvailableProductLines();
 * console.log(lines); // ['ichef', 'beauty']
 * ```
 */
export function getAvailableProductLines(): ProductLine[] {
  return Object.keys(MEDDIC_PROMPTS).filter(
    (k) => k !== "shared"
  ) as ProductLine[];
}

/**
 * 檢查產品線是否支援
 *
 * @param productLine - 產品線 ID
 * @returns 是否支援
 *
 * @example
 * ```typescript
 * isProductLineSupported('ichef'); // true
 * isProductLineSupported('beauty'); // true
 * isProductLineSupported('unknown'); // false
 * ```
 */
export function isProductLineSupported(productLine: string): boolean {
  return getAvailableProductLines().includes(productLine as ProductLine);
}
