/**
 * 診斷代理人 - Phase 2
 *
 * 使用 Claude Agent SDK + PostgreSQL MCP 進行智能診斷
 *
 * 功能:
 * - 診斷 Conversation 處理失敗問題
 * - 分析系統整體健康狀態
 * - 提供具體的修復建議和自動化腳本
 *
 * @example
 * ```typescript
 * import { diagnoseConversation, diagnoseSystemHealth } from "@sales_ai_automation_v3/services/claude-agents/ops/diagnose";
 *
 * // 診斷特定對話
 * const result = await diagnoseConversation("conv-123");
 *
 * // 診斷系統健康
 * const health = await diagnoseSystemHealth();
 * ```
 */

import {
  type DiagnoseResult,
  DiagnoseResultSchema,
  executeAgent,
  getMcpServers,
} from "@sales_ai_automation_v3/claude-sdk";

// ============================================================
// Types
// ============================================================

export interface ConversationDiagnoseOptions {
  /** 是否包含相關對話的分析 */
  includeRelatedConversations?: boolean;
  /** 是否執行自動修復 */
  autoRepair?: boolean;
  /** 時間範圍（小時） */
  timeRangeHours?: number;
}

export interface SystemHealthOptions {
  /** 要檢查的組件 */
  components?: Array<
    "database" | "queue" | "transcription" | "analysis" | "storage"
  >;
  /** 是否包含效能指標 */
  includeMetrics?: boolean;
  /** 時間範圍（小時） */
  timeRangeHours?: number;
}

// ============================================================
// Prompt Builders
// ============================================================

function buildConversationDiagnosePrompt(
  conversationId: string,
  options: ConversationDiagnoseOptions
): string {
  const timeRange = options.timeRangeHours ?? 24;

  return `你是 Sales AI Automation 系統的診斷專家。請診斷以下對話的處理問題：

## 對話 ID
${conversationId}

## 診斷步驟

### 1. 查詢對話狀態
使用 PostgreSQL 查詢對話的當前狀態和處理歷史：
- 查詢 conversations 表獲取對話基本資訊
- 查詢 conversation_logs 表獲取處理日誌
- 檢查 meddic_analyses 表是否有分析結果

### 2. 識別問題點
分析可能的問題：
- 轉錄失敗：檢查 transcription_status
- 分析失敗：檢查 analysis_status
- 佇列卡住：檢查 queue_status 和 retry_count
- 資料完整性：檢查必要欄位是否為空

### 3. 查詢相關資料
${options.includeRelatedConversations ? "- 查詢同一客戶的其他對話\n- 查詢同一時段的類似錯誤" : ""}
- 查詢最近 ${timeRange} 小時的錯誤統計

### 4. 生成修復建議
根據診斷結果提供：
- 立即行動：可以馬上執行的修復步驟
- 長期修復：需要代碼變更或架構調整的建議
${options.autoRepair ? "- 自動修復指令：可以直接執行的 SQL 或 API 呼叫" : ""}

## 輸出格式
請以 JSON 格式輸出診斷結果：
\`\`\`json
{
  "status": "healthy" | "degraded" | "critical",
  "rootCause": "問題的根本原因描述",
  "affectedComponents": ["受影響的組件列表"],
  "immediateActions": [
    {
      "description": "行動描述",
      "command": "可執行的命令（如果有）",
      "risk": "low" | "medium" | "high",
      "automated": true/false
    }
  ],
  "longTermFixes": [
    {
      "description": "長期修復描述",
      "risk": "low" | "medium" | "high",
      "automated": false
    }
  ],
  "relatedConversations": ["相關對話ID"],
  "metrics": {
    "failureRate": 0.05,
    "avgProcessingTime": 120,
    "queueDepth": 5
  }
}
\`\`\`
`;
}

function buildSystemHealthPrompt(options: SystemHealthOptions): string {
  const components = options.components ?? [
    "database",
    "queue",
    "transcription",
    "analysis",
    "storage",
  ];
  const timeRange = options.timeRangeHours ?? 24;

  return `你是 Sales AI Automation 系統的診斷專家。請進行系統健康檢查。

## 檢查範圍
${components.map((c) => `- ${c}`).join("\n")}

## 診斷步驟

### 1. 資料庫健康檢查
${
  components.includes("database")
    ? `- 查詢最近 ${timeRange} 小時的對話處理統計
- 檢查是否有卡住的記錄（status = 'processing' 超過 30 分鐘）
- 檢查孤兒記錄（有 conversation 但沒有 audio 或 transcript）
- 檢查錯誤率趨勢`
    : "跳過"
}

### 2. 佇列健康檢查
${
  components.includes("queue")
    ? `- 查詢待處理任務數量
- 檢查重試次數過高的任務
- 檢查死信佇列狀態`
    : "跳過"
}

### 3. 轉錄服務檢查
${
  components.includes("transcription")
    ? `- 查詢轉錄成功率
- 檢查平均轉錄時間
- 檢查失敗的轉錄任務`
    : "跳過"
}

### 4. 分析服務檢查
${
  components.includes("analysis")
    ? `- 查詢 MEDDIC 分析完成率
- 檢查平均分析時間
- 檢查分析失敗的模式`
    : "跳過"
}

### 5. 儲存服務檢查
${
  components.includes("storage")
    ? `- 檢查 R2 儲存使用量
- 檢查是否有損壞的檔案參考`
    : "跳過"
}

${
  options.includeMetrics
    ? `### 6. 效能指標
- 計算各階段的平均處理時間
- 計算成功率和失敗率
- 識別效能瓶頸`
    : ""
}

## 輸出格式
請以 JSON 格式輸出系統健康報告：
\`\`\`json
{
  "status": "healthy" | "degraded" | "critical",
  "rootCause": "如果有問題，描述主要原因",
  "affectedComponents": ["受影響的組件"],
  "immediateActions": [...],
  "longTermFixes": [...],
  "metrics": {
    "failureRate": 0.02,
    "avgProcessingTime": 90,
    "queueDepth": 3
  }
}
\`\`\`
`;
}

// ============================================================
// Result Parsers
// ============================================================

function parseDiagnoseResult(content: string): DiagnoseResult {
  // 嘗試從內容中提取 JSON
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  // 嘗試找到 JSON 物件
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return {
      status: "degraded",
      rootCause: "無法解析診斷結果",
      affectedComponents: ["unknown"],
      immediateActions: [
        {
          description: "請手動檢查系統狀態",
          risk: "low",
          automated: false,
        },
      ],
      longTermFixes: [],
    };
  }

  try {
    const parsed = JSON.parse(objectMatch[0]);
    return DiagnoseResultSchema.parse(parsed);
  } catch {
    return {
      status: "degraded",
      rootCause: content.slice(0, 500),
      affectedComponents: ["parsing"],
      immediateActions: [],
      longTermFixes: [],
    };
  }
}

// ============================================================
// Main Functions
// ============================================================

/**
 * 診斷特定對話的處理問題
 *
 * @param conversationId - 對話 ID
 * @param options - 診斷選項
 * @returns 診斷結果
 *
 * @example
 * ```typescript
 * const result = await diagnoseConversation("conv-abc123", {
 *   includeRelatedConversations: true,
 *   autoRepair: false,
 * });
 *
 * console.log(result.status); // "degraded"
 * console.log(result.rootCause); // "轉錄服務 API 超時"
 * ```
 */
export async function diagnoseConversation(
  conversationId: string,
  options: ConversationDiagnoseOptions = {}
): Promise<DiagnoseResult> {
  const prompt = buildConversationDiagnosePrompt(conversationId, options);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Glob", "Grep", "Bash"],
    mcpServers: getMcpServers(["postgres"]),
    permissionMode: "default",
    maxTurns: 20,
  });

  if (!result.success) {
    throw new Error(`對話診斷失敗: ${result.error}`);
  }

  return parseDiagnoseResult(result.content);
}

/**
 * 診斷系統整體健康狀態
 *
 * @param options - 診斷選項
 * @returns 系統健康診斷結果
 *
 * @example
 * ```typescript
 * const health = await diagnoseSystemHealth({
 *   components: ["database", "queue"],
 *   includeMetrics: true,
 * });
 *
 * if (health.status === "critical") {
 *   console.error("系統狀態嚴重！");
 *   health.immediateActions.forEach(action => {
 *     console.log(`執行: ${action.description}`);
 *   });
 * }
 * ```
 */
export async function diagnoseSystemHealth(
  options: SystemHealthOptions = {}
): Promise<DiagnoseResult> {
  const prompt = buildSystemHealthPrompt(options);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Glob", "Grep", "Bash"],
    mcpServers: getMcpServers(["postgres"]),
    permissionMode: "default",
    maxTurns: 30,
  });

  if (!result.success) {
    throw new Error(`系統診斷失敗: ${result.error}`);
  }

  return parseDiagnoseResult(result.content);
}

/**
 * 格式化診斷結果為 Markdown
 *
 * @param result - 診斷結果
 * @param title - 報告標題
 * @returns Markdown 格式的報告
 */
export function formatDiagnoseAsMarkdown(
  result: DiagnoseResult,
  title = "系統診斷報告"
): string {
  const statusEmoji =
    result.status === "healthy"
      ? "✅"
      : result.status === "degraded"
        ? "⚠️"
        : "🔴";

  let markdown = `## ${statusEmoji} ${title}\n\n`;
  markdown += `**狀態**: ${result.status.toUpperCase()}\n\n`;
  markdown += `### 根本原因\n${result.rootCause}\n\n`;

  if (result.affectedComponents.length > 0) {
    markdown += "### 受影響的組件\n";
    for (const component of result.affectedComponents) {
      markdown += `- ${component}\n`;
    }
    markdown += "\n";
  }

  if (result.immediateActions.length > 0) {
    markdown += "### 🚨 立即行動\n\n";
    for (const action of result.immediateActions) {
      const riskBadge =
        action.risk === "high" ? "🔴" : action.risk === "medium" ? "🟡" : "🟢";
      markdown += `${riskBadge} **${action.description}**\n`;
      if (action.command) {
        markdown += `\`\`\`bash\n${action.command}\n\`\`\`\n`;
      }
      markdown += `- 風險: ${action.risk}\n`;
      markdown += `- 可自動化: ${action.automated ? "是" : "否"}\n\n`;
    }
  }

  if (result.longTermFixes.length > 0) {
    markdown += "### 📋 長期修復建議\n\n";
    for (const fix of result.longTermFixes) {
      markdown += `- **${fix.description}** (風險: ${fix.risk})\n`;
    }
    markdown += "\n";
  }

  if (result.metrics) {
    markdown += "### 📊 指標\n\n";
    markdown += "| 指標 | 值 |\n";
    markdown += "|------|----|\n";
    markdown += `| 失敗率 | ${(result.metrics.failureRate * 100).toFixed(2)}% |\n`;
    markdown += `| 平均處理時間 | ${result.metrics.avgProcessingTime}s |\n`;
    markdown += `| 佇列深度 | ${result.metrics.queueDepth} |\n`;
  }

  return markdown;
}
