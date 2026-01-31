/**
 * Cloudflare Workers 日誌分析代理人 - Phase 2
 *
 * 使用 Claude Agent SDK + Cloudflare MCP 進行 Workers 日誌分析
 *
 * 功能:
 * - 分析 Workers 執行日誌
 * - 識別錯誤模式
 * - 提供效能洞察
 * - 分析 KV 快取效能
 *
 * @example
 * ```typescript
 * import { analyzeWorkerLogs, analyzeKVPerformance } from "@sales_ai_automation_v3/services/claude-agents/ops/cloudflare";
 *
 * const analysis = await analyzeWorkerLogs("queue-worker", { timeRangeHours: 6 });
 * console.log(analysis.errorPatterns);
 * ```
 */

import {
  executeAgent,
  getMcpServers,
  type WorkerLogAnalysis,
  WorkerLogAnalysisSchema,
} from "@sales_ai_automation_v3/claude-sdk";

// ============================================================
// Types
// ============================================================

export interface WorkerLogOptions {
  /** 時間範圍（小時） */
  timeRangeHours?: number;
  /** 只分析錯誤 */
  errorsOnly?: boolean;
  /** 包含效能分析 */
  includePerformance?: boolean;
  /** 最大日誌條數 */
  maxLogs?: number;
}

export interface KVAnalysisOptions {
  /** KV 命名空間 */
  namespace?: string;
  /** 時間範圍（小時） */
  timeRangeHours?: number;
  /** 包含熱點分析 */
  includeHotspots?: boolean;
}

export interface KVPerformanceResult {
  /** 命名空間 */
  namespace: string;
  /** 讀取操作統計 */
  reads: {
    total: number;
    hits: number;
    misses: number;
    hitRate: number;
    avgLatencyMs: number;
  };
  /** 寫入操作統計 */
  writes: {
    total: number;
    avgLatencyMs: number;
  };
  /** 熱點 key（高頻存取） */
  hotspots?: string[];
  /** 建議 */
  recommendations: string[];
}

// ============================================================
// Worker Name Mapping
// ============================================================

const WORKER_NAMES: Record<string, string> = {
  server: "sales-ai-server",
  "slack-bot": "sales-ai-slack-bot",
  "queue-worker": "sales-ai-queue-worker",
};

function resolveWorkerName(name: string): string {
  return WORKER_NAMES[name] ?? name;
}

// ============================================================
// Prompt Builders
// ============================================================

function buildWorkerLogPrompt(
  workerName: string,
  options: WorkerLogOptions
): string {
  const resolvedName = resolveWorkerName(workerName);
  const timeRange = options.timeRangeHours ?? 24;
  const maxLogs = options.maxLogs ?? 1000;

  return `你是 Cloudflare Workers 的日誌分析專家。請分析以下 Worker 的日誌。

## Worker 資訊
- Worker 名稱: ${resolvedName}
- 時間範圍: 最近 ${timeRange} 小時
- 最大日誌數: ${maxLogs}
${options.errorsOnly ? "- 只分析錯誤日誌" : "- 分析所有日誌"}

## 分析步驟

### 1. 取得 Worker 日誌
使用 Cloudflare MCP 取得 Worker 的執行日誌：
- 篩選時間範圍
- ${options.errorsOnly ? "只取錯誤狀態的請求" : "取得所有請求"}

### 2. 錯誤分析
識別錯誤模式：
- 分析錯誤類型和頻率
- 找出重複出現的錯誤
- 識別錯誤發生的時間模式
- 提取錯誤訊息的共同特徵

### 3. 效能分析
${
  options.includePerformance
    ? `分析效能指標：
- CPU 時間分佈
- 執行時間分佈
- 記憶體使用
- 子請求數量和時間`
    : "跳過效能分析"
}

### 4. 生成洞察
根據分析結果：
- 識別需要關注的問題
- 找出效能瓶頸
- 提供優化建議

## 輸出格式
請以 JSON 格式輸出分析結果：
\`\`\`json
{
  "workerName": "${resolvedName}",
  "timeRange": "最近 ${timeRange} 小時",
  "errorPatterns": [
    {
      "pattern": "錯誤模式描述",
      "count": 42,
      "firstSeen": "2024-01-15T10:00:00Z",
      "lastSeen": "2024-01-15T15:30:00Z",
      "sampleMessages": ["錯誤訊息範例1", "錯誤訊息範例2"]
    }
  ],
  "performanceInsights": [
    {
      "metric": "指標名稱",
      "value": 123.45,
      "trend": "improving" | "stable" | "degrading",
      "recommendation": "建議（如果有）"
    }
  ],
  "recommendations": [
    "建議1",
    "建議2"
  ]
}
\`\`\`
`;
}

function buildKVAnalysisPrompt(options: KVAnalysisOptions): string {
  const namespace = options.namespace ?? "CACHE";
  const timeRange = options.timeRangeHours ?? 24;

  return `你是 Cloudflare KV 的效能分析專家。請分析 KV 快取效能。

## 分析參數
- KV 命名空間: ${namespace}
- 時間範圍: 最近 ${timeRange} 小時

## 分析步驟

### 1. 取得 KV 操作統計
使用 Cloudflare MCP 取得 KV 操作的統計資料：
- 讀取操作次數和延遲
- 寫入操作次數和延遲
- 快取命中率

### 2. 識別存取模式
分析 KV 的使用模式：
${
  options.includeHotspots
    ? `- 找出高頻存取的 key（熱點）
- 分析 key 的命名模式
- 識別可能的快取穿透`
    : ""
}
- 分析讀寫比例
- 識別尖峰時段

### 3. 效能評估
評估 KV 效能：
- 快取命中率是否正常（目標 > 80%）
- 延遲是否在可接受範圍（目標 < 50ms）
- 是否有異常的操作模式

### 4. 生成建議
根據分析結果提供優化建議：
- TTL 設定建議
- 快取策略調整
- key 設計優化

## 輸出格式
請以 JSON 格式輸出分析結果：
\`\`\`json
{
  "namespace": "${namespace}",
  "reads": {
    "total": 10000,
    "hits": 8500,
    "misses": 1500,
    "hitRate": 0.85,
    "avgLatencyMs": 12.5
  },
  "writes": {
    "total": 500,
    "avgLatencyMs": 25.3
  },
  "hotspots": ["conversations:list", "opportunity:stats"],
  "recommendations": [
    "建議1",
    "建議2"
  ]
}
\`\`\`
`;
}

// ============================================================
// Result Parsers
// ============================================================

function parseWorkerLogAnalysis(content: string): WorkerLogAnalysis {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return {
      workerName: "unknown",
      timeRange: "unknown",
      errorPatterns: [],
      performanceInsights: [],
      recommendations: ["無法解析分析結果，請手動檢查日誌"],
    };
  }

  try {
    const parsed = JSON.parse(objectMatch[0]);
    return WorkerLogAnalysisSchema.parse(parsed);
  } catch {
    return {
      workerName: "unknown",
      timeRange: "unknown",
      errorPatterns: [],
      performanceInsights: [],
      recommendations: [content.slice(0, 500)],
    };
  }
}

function parseKVAnalysis(content: string): KVPerformanceResult {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return {
      namespace: "unknown",
      reads: { total: 0, hits: 0, misses: 0, hitRate: 0, avgLatencyMs: 0 },
      writes: { total: 0, avgLatencyMs: 0 },
      recommendations: ["無法解析分析結果"],
    };
  }

  try {
    return JSON.parse(objectMatch[0]) as KVPerformanceResult;
  } catch {
    return {
      namespace: "unknown",
      reads: { total: 0, hits: 0, misses: 0, hitRate: 0, avgLatencyMs: 0 },
      writes: { total: 0, avgLatencyMs: 0 },
      recommendations: [content.slice(0, 500)],
    };
  }
}

// ============================================================
// Main Functions
// ============================================================

/**
 * 分析 Cloudflare Worker 日誌
 *
 * @param workerName - Worker 名稱（可使用簡稱如 "server", "queue-worker"）
 * @param options - 分析選項
 * @returns 日誌分析結果
 *
 * @example
 * ```typescript
 * const analysis = await analyzeWorkerLogs("queue-worker", {
 *   timeRangeHours: 6,
 *   errorsOnly: true,
 *   includePerformance: true,
 * });
 *
 * if (analysis.errorPatterns.length > 0) {
 *   console.log("發現錯誤模式:");
 *   analysis.errorPatterns.forEach(p => {
 *     console.log(`- ${p.pattern}: ${p.count} 次`);
 *   });
 * }
 * ```
 */
export async function analyzeWorkerLogs(
  workerName: string,
  options: WorkerLogOptions = {}
): Promise<WorkerLogAnalysis> {
  const prompt = buildWorkerLogPrompt(workerName, options);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Bash"],
    mcpServers: getMcpServers(["cloudflare"]),
    permissionMode: "default",
    maxTurns: 20,
  });

  if (!result.success) {
    throw new Error(`Worker 日誌分析失敗: ${result.error}`);
  }

  return parseWorkerLogAnalysis(result.content);
}

/**
 * 分析 Cloudflare KV 快取效能
 *
 * @param options - 分析選項
 * @returns KV 效能分析結果
 *
 * @example
 * ```typescript
 * const kvAnalysis = await analyzeKVPerformance({
 *   namespace: "CACHE",
 *   timeRangeHours: 24,
 *   includeHotspots: true,
 * });
 *
 * console.log(`快取命中率: ${kvAnalysis.reads.hitRate * 100}%`);
 * if (kvAnalysis.reads.hitRate < 0.8) {
 *   console.log("快取命中率偏低，建議優化快取策略");
 * }
 * ```
 */
export async function analyzeKVPerformance(
  options: KVAnalysisOptions = {}
): Promise<KVPerformanceResult> {
  const prompt = buildKVAnalysisPrompt(options);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Bash"],
    mcpServers: getMcpServers(["cloudflare"]),
    permissionMode: "default",
    maxTurns: 15,
  });

  if (!result.success) {
    throw new Error(`KV 效能分析失敗: ${result.error}`);
  }

  return parseKVAnalysis(result.content);
}

/**
 * 格式化 Worker 日誌分析結果為 Markdown
 *
 * @param analysis - 分析結果
 * @returns Markdown 格式的報告
 */
export function formatWorkerLogAsMarkdown(analysis: WorkerLogAnalysis): string {
  let markdown = "## 📊 Worker 日誌分析報告\n\n";
  markdown += `**Worker**: ${analysis.workerName}\n`;
  markdown += `**時間範圍**: ${analysis.timeRange}\n\n`;

  if (analysis.errorPatterns.length > 0) {
    markdown += "### 🔴 錯誤模式\n\n";
    for (const pattern of analysis.errorPatterns) {
      markdown += `#### ${pattern.pattern}\n`;
      markdown += `- **發生次數**: ${pattern.count}\n`;
      markdown += `- **首次出現**: ${pattern.firstSeen}\n`;
      markdown += `- **最後出現**: ${pattern.lastSeen}\n`;
      if (pattern.sampleMessages.length > 0) {
        markdown += "- **範例**:\n";
        for (const msg of pattern.sampleMessages.slice(0, 3)) {
          markdown += `  > ${msg}\n`;
        }
      }
      markdown += "\n";
    }
  } else {
    markdown += "### ✅ 無錯誤模式\n\n";
  }

  if (analysis.performanceInsights.length > 0) {
    markdown += "### ⚡ 效能洞察\n\n";
    markdown += "| 指標 | 值 | 趨勢 | 建議 |\n";
    markdown += "|------|-----|------|------|\n";
    for (const insight of analysis.performanceInsights) {
      const trendEmoji =
        insight.trend === "improving"
          ? "📈"
          : insight.trend === "degrading"
            ? "📉"
            : "➡️";
      markdown += `| ${insight.metric} | ${insight.value} | ${trendEmoji} ${insight.trend} | ${insight.recommendation ?? "-"} |\n`;
    }
    markdown += "\n";
  }

  if (analysis.recommendations.length > 0) {
    markdown += "### 💡 建議\n\n";
    for (const rec of analysis.recommendations) {
      markdown += `- ${rec}\n`;
    }
  }

  return markdown;
}

/**
 * 格式化 KV 效能分析結果為 Markdown
 *
 * @param analysis - 分析結果
 * @returns Markdown 格式的報告
 */
export function formatKVAnalysisAsMarkdown(
  analysis: KVPerformanceResult
): string {
  let markdown = "## 📦 KV 快取效能報告\n\n";
  markdown += `**命名空間**: ${analysis.namespace}\n\n`;

  markdown += "### 讀取統計\n\n";
  markdown += "| 指標 | 值 |\n";
  markdown += "|------|----|\n";
  markdown += `| 總讀取次數 | ${analysis.reads.total.toLocaleString()} |\n`;
  markdown += `| 命中次數 | ${analysis.reads.hits.toLocaleString()} |\n`;
  markdown += `| 未命中次數 | ${analysis.reads.misses.toLocaleString()} |\n`;
  markdown += `| 命中率 | ${(analysis.reads.hitRate * 100).toFixed(1)}% |\n`;
  markdown += `| 平均延遲 | ${analysis.reads.avgLatencyMs.toFixed(2)}ms |\n\n`;

  markdown += "### 寫入統計\n\n";
  markdown += "| 指標 | 值 |\n";
  markdown += "|------|----|\n";
  markdown += `| 總寫入次數 | ${analysis.writes.total.toLocaleString()} |\n`;
  markdown += `| 平均延遲 | ${analysis.writes.avgLatencyMs.toFixed(2)}ms |\n\n`;

  if (analysis.hotspots && analysis.hotspots.length > 0) {
    markdown += "### 🔥 熱點 Key\n\n";
    for (const key of analysis.hotspots) {
      markdown += `- \`${key}\`\n`;
    }
    markdown += "\n";
  }

  if (analysis.recommendations.length > 0) {
    markdown += "### 💡 建議\n\n";
    for (const rec of analysis.recommendations) {
      markdown += `- ${rec}\n`;
    }
  }

  return markdown;
}
