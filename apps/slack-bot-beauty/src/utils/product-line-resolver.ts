/**
 * Product Line Resolver
 * 根據 Slack Channel ID 解析產品線
 */

import type { ProductLine } from "@Sales_ai_automation_v3/shared/product-configs";
import type { Env } from "../types";

/**
 * 從環境變數解析產品線配置
 *
 * 環境變數格式: PRODUCT_LINE_CHANNELS='{"C12345":"ichef","C67890":"beauty"}'
 *
 * @param channelId - Slack Channel ID
 * @param env - Environment variables
 * @returns ProductLine ('ichef' | 'beauty')
 */
export function resolveProductLine(channelId: string, env: Env): ProductLine {
  try {
    // 讀取環境變數
    const configJson = env.PRODUCT_LINE_CHANNELS;

    // 如果未設定環境變數,預設為 'ichef' (向後相容)
    if (!configJson) {
      console.log(
        "[ProductLineResolver] No PRODUCT_LINE_CHANNELS configured, defaulting to ichef"
      );
      return "ichef";
    }

    // 解析 JSON
    const channelMap: Record<string, ProductLine> = JSON.parse(configJson);

    // 查找 Channel 對應的產品線
    const productLine = channelMap[channelId];

    if (productLine) {
      console.log(
        `[ProductLineResolver] Channel ${channelId} -> ${productLine}`
      );
      return productLine;
    }

    // 如果 Channel 未配置,預設為 'ichef' (向後相容)
    console.log(
      `[ProductLineResolver] Channel ${channelId} not configured, defaulting to ichef`
    );
    return "ichef";
  } catch (error) {
    // 解析錯誤時預設為 'ichef' (安全降級)
    console.error(
      "[ProductLineResolver] Failed to parse PRODUCT_LINE_CHANNELS:",
      error
    );
    console.log("[ProductLineResolver] Defaulting to ichef due to error");
    return "ichef";
  }
}

/**
 * 驗證環境變數配置是否正確
 *
 * @param env - Environment variables
 * @returns 驗證結果
 */
export function validateProductLineConfig(env: Env): {
  valid: boolean;
  error?: string;
  channelCount?: number;
} {
  try {
    const configJson = env.PRODUCT_LINE_CHANNELS;

    if (!configJson) {
      return {
        valid: true,
        channelCount: 0,
      };
    }

    const channelMap = JSON.parse(configJson);

    // 檢查是否為物件
    if (typeof channelMap !== "object" || Array.isArray(channelMap)) {
      return {
        valid: false,
        error: "PRODUCT_LINE_CHANNELS must be a JSON object",
      };
    }

    // 檢查每個值是否為有效的 ProductLine
    const validProductLines: ProductLine[] = ["ichef", "beauty"];
    for (const [channel, productLine] of Object.entries(channelMap)) {
      if (!validProductLines.includes(productLine as ProductLine)) {
        return {
          valid: false,
          error: `Invalid product line "${productLine}" for channel ${channel}`,
        };
      }
    }

    return {
      valid: true,
      channelCount: Object.keys(channelMap).length,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
