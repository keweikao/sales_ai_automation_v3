import { beautyConfig } from "./beauty";
import { ichefConfig } from "./ichef";
import type { ProductLine, ProductLineConfig } from "./types";

// 配置註冊表
const configs = new Map<ProductLine, ProductLineConfig>([
  ["ichef", ichefConfig],
  ["beauty", beautyConfig],
]);

/**
 * 取得產品線配置
 * @param productLine - 產品線 ID
 * @throws Error 如果產品線不存在
 */
export function getProductConfig(productLine: ProductLine): ProductLineConfig {
  const config = configs.get(productLine);
  if (!config) {
    throw new Error(`Unknown product line: ${productLine}`);
  }
  return config;
}

/**
 * 取得所有產品線 ID
 */
export function getAllProductLines(): ProductLine[] {
  return Array.from(configs.keys());
}

/**
 * 取得預設產品線
 */
export function getDefaultProductLine(): ProductLine {
  return "ichef";
}

/**
 * 檢查產品線是否存在
 */
export function isValidProductLine(
  productLine: string
): productLine is ProductLine {
  return configs.has(productLine as ProductLine);
}
