// 導出所有類型

// 導出配置
// biome-ignore lint/performance/noBarrelFile: Intentional barrel file for product configs module
export { beautyConfig } from "./beauty";
export { ichefConfig } from "./ichef";
// 導出 API
export {
  getAllProductLines,
  getDefaultProductLine,
  getProductConfig,
  isValidProductLine,
} from "./registry";
export type * from "./types";
