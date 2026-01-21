/**
 * @sales_ai_automation_v3/shared
 * 共享類型、錯誤處理和 Schema
 *
 * Version: 0.2.0
 *
 * 注意: Schemas 和 Types 可能有命名衝突,建議分別導入:
 * - 使用 Types: import { ConversationStatus } from '@sales_ai_automation_v3/shared/types'
 * - 使用 Schemas: import { conversationStatusSchema } from '@sales_ai_automation_v3/shared/schemas'
 */

// 導出常數定義
export * from "./constants/meddic.js";
// 導出錯誤處理
export * from "./errors/index.js";
// 導出類型定義
export * from "./types/index.js";

// 注意: Schemas 不在此導出,請使用 '@sales_ai_automation_v3/shared/schemas' 導入
