/**
 * Datadog 可觀測性代理人 - Phase 5
 *
 * 使用 Claude Agent SDK + Datadog MCP 進行系統監控和異常檢測
 *
 * 功能:
 * - 分析 APM 指標和追蹤
 * - 檢測異常和效能問題
 * - 生成監控報告
 * - 設定智慧告警
 *
 * @example
 * ```typescript
 * import { analyzeAPM, detectAnomalies } from "@sales_ai_automation_v3/services/claude-agents/ops/datadog";
 *
 * const apmAnalysis = await analyzeAPM({ service: "sales-ai-server" });
 * const anomalies = await detectAnomalies({ timeRangeHours: 24 });
 * ```
 */

import {
  executeAgent,
  getMcpServers,
  isMcpServerConfigured,
} from "@sales_ai_automation_v3/claude-sdk";

// ============================================================
// Types
// ============================================================

export interface APMMetrics {
  /** 服務名稱 */
  service: string;
  /** 時間範圍 */
  timeRange: string;
  /** 請求統計 */
  requests: {
    total: number;
    errorRate: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
  };
  /** 端點統計 */
  endpoints: Array<{
    name: string;
    requests: number;
    errorRate: number;
    avgLatencyMs: number;
  }>;
  /** 錯誤分析 */
  errors: Array<{
    type: string;
    count: number;
    lastOccurred: string;
    sampleMessage: string;
  }>;
  /** 資源使用 */
  resources?: {
    avgCpuPercent: number;
    avgMemoryMB: number;
    peakCpuPercent: number;
    peakMemoryMB: number;
  };
}

export interface Anomaly {
  /** 異常類型 */
  type:
    | "latency_spike"
    | "error_surge"
    | "traffic_drop"
    | "resource_exhaustion"
    | "other";
  /** 嚴重程度 */
  severity: "critical" | "warning" | "info";
  /** 受影響的服務 */
  affectedService: string;
  /** 異常描述 */
  description: string;
  /** 開始時間 */
  startedAt: string;
  /** 持續時間（分鐘） */
  durationMinutes: number;
  /** 影響範圍 */
  impact: string;
  /** 可能原因 */
  possibleCauses: string[];
  /** 建議行動 */
  suggestedActions: string[];
}

export interface AnomalyDetectionResult {
  /** 分析時間範圍 */
  timeRange: string;
  /** 整體健康狀態 */
  overallHealth: "healthy" | "degraded" | "critical";
  /** 發現的異常 */
  anomalies: Anomaly[];
  /** 關鍵指標摘要 */
  metricsSummary: {
    totalRequests: number;
    overallErrorRate: number;
    avgLatencyMs: number;
    servicesAnalyzed: number;
  };
  /** 建議 */
  recommendations: string[];
}

export interface AlertConfig {
  /** 告警名稱 */
  name: string;
  /** 告警類型 */
  type: "metric" | "log" | "apm" | "composite";
  /** 查詢 */
  query: string;
  /** 閾值 */
  thresholds: {
    warning?: number;
    critical: number;
  };
  /** 通知管道 */
  notificationChannels: string[];
  /** 告警描述 */
  description: string;
}

export interface APMAnalysisOptions {
  /** 服務名稱 */
  service?: string;
  /** 時間範圍（小時） */
  timeRangeHours?: number;
  /** 是否包含追蹤分析 */
  includeTraces?: boolean;
  /** 是否包含資源指標 */
  includeResources?: boolean;
}

export interface AnomalyDetectionOptions {
  /** 時間範圍（小時） */
  timeRangeHours?: number;
  /** 服務過濾 */
  services?: string[];
  /** 敏感度 */
  sensitivity?: "low" | "medium" | "high";
}

// ============================================================
// Service Name Mapping
// ============================================================

const SERVICE_NAMES: Record<string, string> = {
  server: "sales-ai-server",
  "slack-bot": "sales-ai-slack-bot",
  "queue-worker": "sales-ai-queue-worker",
  web: "sales-ai-web",
};

function resolveServiceName(name: string): string {
  return SERVICE_NAMES[name] ?? name;
}

// ============================================================
// Prompt Builders
// ============================================================

function buildAPMAnalysisPrompt(options: APMAnalysisOptions): string {
  const service = options.service ? resolveServiceName(options.service) : "all";
  const timeRange = options.timeRangeHours ?? 24;

  return `你是一位 APM 分析專家。請分析以下服務的效能指標。

## 分析參數
- 服務: ${service === "all" ? "所有服務" : service}
- 時間範圍: 最近 ${timeRange} 小時

## 分析步驟

### 1. 取得 APM 指標
使用 Datadog MCP 查詢服務指標：
- 請求量和錯誤率
- 延遲分佈（p50, p95, p99）
- 端點級別的統計

### 2. 追蹤分析
${
  options.includeTraces
    ? `分析請求追蹤：
- 識別慢請求
- 找出瓶頸點
- 分析依賴調用`
    : "跳過追蹤分析"
}

### 3. 錯誤分析
分析錯誤模式：
- 錯誤類型分類
- 錯誤發生頻率
- 錯誤相關性

### 4. 資源使用
${
  options.includeResources
    ? `分析資源使用：
- CPU 使用率
- 記憶體使用
- 識別資源瓶頸`
    : "跳過資源分析"
}

## 輸出格式
請以 JSON 格式輸出分析結果：
\`\`\`json
{
  "service": "${service}",
  "timeRange": "最近 ${timeRange} 小時",
  "requests": {
    "total": 100000,
    "errorRate": 0.02,
    "avgLatencyMs": 150,
    "p50LatencyMs": 100,
    "p95LatencyMs": 350,
    "p99LatencyMs": 800
  },
  "endpoints": [
    {
      "name": "/api/conversations",
      "requests": 50000,
      "errorRate": 0.01,
      "avgLatencyMs": 120
    }
  ],
  "errors": [
    {
      "type": "TimeoutError",
      "count": 150,
      "lastOccurred": "2024-01-15T14:30:00Z",
      "sampleMessage": "Request timeout after 30s"
    }
  ],
  "resources": {
    "avgCpuPercent": 45,
    "avgMemoryMB": 256,
    "peakCpuPercent": 85,
    "peakMemoryMB": 512
  }
}
\`\`\`
`;
}

function buildAnomalyDetectionPrompt(options: AnomalyDetectionOptions): string {
  const timeRange = options.timeRangeHours ?? 24;
  const sensitivity = options.sensitivity ?? "medium";
  const servicesFilter = options.services?.length
    ? options.services.map(resolveServiceName).join(", ")
    : "所有服務";

  return `你是一位異常檢測專家。請分析系統異常。

## 分析參數
- 時間範圍: 最近 ${timeRange} 小時
- 服務: ${servicesFilter}
- 敏感度: ${sensitivity}

## 異常檢測步驟

### 1. 基線建立
使用 Datadog MCP 建立正常行為基線：
- 歷史延遲分佈
- 正常錯誤率
- 流量模式

### 2. 異常識別
檢測以下類型的異常：
- **延遲尖峰**: 延遲突然增加
- **錯誤激增**: 錯誤率異常升高
- **流量下降**: 請求量異常減少
- **資源耗盡**: CPU/記憶體異常

### 3. 根因分析
對每個異常進行分析：
- 識別可能的原因
- 評估影響範圍
- 建議修復行動

### 4. 敏感度調整
根據敏感度設定調整檢測閾值：
${sensitivity === "high" ? "- 使用較低的閾值，捕獲更多潛在問題" : sensitivity === "low" ? "- 使用較高的閾值，只報告明確的異常" : "- 使用平衡的閾值"}

## 輸出格式
請以 JSON 格式輸出檢測結果：
\`\`\`json
{
  "timeRange": "最近 ${timeRange} 小時",
  "overallHealth": "degraded",
  "anomalies": [
    {
      "type": "latency_spike",
      "severity": "warning",
      "affectedService": "sales-ai-server",
      "description": "API 延遲在 14:00-14:30 期間增加 300%",
      "startedAt": "2024-01-15T14:00:00Z",
      "durationMinutes": 30,
      "impact": "約 5000 個請求受影響",
      "possibleCauses": ["資料庫查詢變慢", "外部 API 延遲"],
      "suggestedActions": ["檢查資料庫效能", "審查相關追蹤"]
    }
  ],
  "metricsSummary": {
    "totalRequests": 500000,
    "overallErrorRate": 0.03,
    "avgLatencyMs": 180,
    "servicesAnalyzed": 4
  },
  "recommendations": [
    "建議為 /api/conversations 端點添加快取",
    "考慮增加資料庫連線池大小"
  ]
}
\`\`\`
`;
}

function buildAlertConfigPrompt(
  metricType: string,
  serviceName: string
): string {
  const service = resolveServiceName(serviceName);

  return `你是一位 Datadog 告警配置專家。請為以下場景生成告警配置。

## 場景
- 指標類型: ${metricType}
- 服務: ${service}

## 配置要求

### 1. 分析現有指標
使用 Datadog MCP 查詢現有指標：
- 了解正常值範圍
- 識別適當的閾值
- 確定合適的評估窗口

### 2. 生成告警配置
根據最佳實踐配置告警：
- 設定 warning 和 critical 閾值
- 配置適當的評估週期
- 添加有意義的描述

### 3. 建議通知管道
根據嚴重程度建議通知：
- Critical: 立即通知（Slack + PagerDuty）
- Warning: 標準通知（Slack）
- Info: 低優先級通知（Email）

## 輸出格式
請以 JSON 格式輸出告警配置：
\`\`\`json
{
  "name": "${service} - ${metricType} Alert",
  "type": "metric",
  "query": "avg(last_5m):avg:trace.servlet.request.duration{service:${service}} > 500",
  "thresholds": {
    "warning": 300,
    "critical": 500
  },
  "notificationChannels": ["slack-alerts", "pagerduty-oncall"],
  "description": "當 ${service} 的平均延遲超過閾值時觸發"
}
\`\`\`
`;
}

// ============================================================
// Result Parsers
// ============================================================

function parseAPMMetrics(content: string): APMMetrics {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return {
      service: "unknown",
      timeRange: "unknown",
      requests: {
        total: 0,
        errorRate: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
      },
      endpoints: [],
      errors: [],
    };
  }

  try {
    return JSON.parse(objectMatch[0]) as APMMetrics;
  } catch {
    return {
      service: "unknown",
      timeRange: content.slice(0, 100),
      requests: {
        total: 0,
        errorRate: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
      },
      endpoints: [],
      errors: [],
    };
  }
}

function parseAnomalyDetection(content: string): AnomalyDetectionResult {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return {
      timeRange: "unknown",
      overallHealth: "degraded",
      anomalies: [],
      metricsSummary: {
        totalRequests: 0,
        overallErrorRate: 0,
        avgLatencyMs: 0,
        servicesAnalyzed: 0,
      },
      recommendations: ["無法解析異常檢測結果"],
    };
  }

  try {
    return JSON.parse(objectMatch[0]) as AnomalyDetectionResult;
  } catch {
    return {
      timeRange: "unknown",
      overallHealth: "degraded",
      anomalies: [],
      metricsSummary: {
        totalRequests: 0,
        overallErrorRate: 0,
        avgLatencyMs: 0,
        servicesAnalyzed: 0,
      },
      recommendations: [content.slice(0, 500)],
    };
  }
}

function parseAlertConfig(content: string): AlertConfig {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return {
      name: "Unknown Alert",
      type: "metric",
      query: "",
      thresholds: { critical: 0 },
      notificationChannels: [],
      description: content,
    };
  }

  try {
    return JSON.parse(objectMatch[0]) as AlertConfig;
  } catch {
    return {
      name: "Unknown Alert",
      type: "metric",
      query: "",
      thresholds: { critical: 0 },
      notificationChannels: [],
      description: content.slice(0, 500),
    };
  }
}

// ============================================================
// Main Functions
// ============================================================

/**
 * 分析 APM 指標
 *
 * @param options - 分析選項
 * @returns APM 指標分析結果
 *
 * @example
 * ```typescript
 * const metrics = await analyzeAPM({
 *   service: "server",
 *   timeRangeHours: 6,
 *   includeTraces: true,
 * });
 *
 * console.log(`錯誤率: ${metrics.requests.errorRate * 100}%`);
 * console.log(`P95 延遲: ${metrics.requests.p95LatencyMs}ms`);
 * ```
 */
export async function analyzeAPM(
  options: APMAnalysisOptions = {}
): Promise<APMMetrics> {
  // 檢查 Datadog MCP 是否已配置
  if (!isMcpServerConfigured("datadog")) {
    throw new Error(
      "Datadog MCP 未配置。請設定 DD_API_KEY 和 DD_APP_KEY 環境變數。"
    );
  }

  const prompt = buildAPMAnalysisPrompt(options);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Bash"],
    mcpServers: getMcpServers(["datadog"]),
    permissionMode: "default",
    maxTurns: 20,
  });

  if (!result.success) {
    throw new Error(`APM 分析失敗: ${result.error}`);
  }

  return parseAPMMetrics(result.content);
}

/**
 * 檢測系統異常
 *
 * @param options - 檢測選項
 * @returns 異常檢測結果
 *
 * @example
 * ```typescript
 * const result = await detectAnomalies({
 *   timeRangeHours: 24,
 *   sensitivity: "high",
 * });
 *
 * if (result.anomalies.length > 0) {
 *   console.log("發現異常:");
 *   result.anomalies.forEach(a => {
 *     console.log(`[${a.severity}] ${a.description}`);
 *   });
 * }
 * ```
 */
export async function detectAnomalies(
  options: AnomalyDetectionOptions = {}
): Promise<AnomalyDetectionResult> {
  if (!isMcpServerConfigured("datadog")) {
    throw new Error(
      "Datadog MCP 未配置。請設定 DD_API_KEY 和 DD_APP_KEY 環境變數。"
    );
  }

  const prompt = buildAnomalyDetectionPrompt(options);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Bash"],
    mcpServers: getMcpServers(["datadog"]),
    permissionMode: "default",
    maxTurns: 25,
  });

  if (!result.success) {
    throw new Error(`異常檢測失敗: ${result.error}`);
  }

  return parseAnomalyDetection(result.content);
}

/**
 * 生成告警配置
 *
 * @param metricType - 指標類型
 * @param serviceName - 服務名稱
 * @returns 告警配置
 *
 * @example
 * ```typescript
 * const config = await generateAlertConfig("latency", "server");
 * console.log(`告警查詢: ${config.query}`);
 * console.log(`Critical 閾值: ${config.thresholds.critical}`);
 * ```
 */
export async function generateAlertConfig(
  metricType: string,
  serviceName: string
): Promise<AlertConfig> {
  if (!isMcpServerConfigured("datadog")) {
    throw new Error(
      "Datadog MCP 未配置。請設定 DD_API_KEY 和 DD_APP_KEY 環境變數。"
    );
  }

  const prompt = buildAlertConfigPrompt(metricType, serviceName);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Bash"],
    mcpServers: getMcpServers(["datadog"]),
    permissionMode: "default",
    maxTurns: 15,
  });

  if (!result.success) {
    throw new Error(`告警配置生成失敗: ${result.error}`);
  }

  return parseAlertConfig(result.content);
}

/**
 * 格式化 APM 分析結果為 Markdown
 *
 * @param metrics - APM 指標
 * @returns Markdown 格式的報告
 */
export function formatAPMAsMarkdown(metrics: APMMetrics): string {
  let markdown = "## 📊 APM 分析報告\n\n";
  markdown += `**服務**: ${metrics.service}\n`;
  markdown += `**時間範圍**: ${metrics.timeRange}\n\n`;

  markdown += "### 請求統計\n\n";
  markdown += "| 指標 | 值 |\n";
  markdown += "|------|----|\n";
  markdown += `| 總請求數 | ${metrics.requests.total.toLocaleString()} |\n`;
  markdown += `| 錯誤率 | ${(metrics.requests.errorRate * 100).toFixed(2)}% |\n`;
  markdown += `| 平均延遲 | ${metrics.requests.avgLatencyMs}ms |\n`;
  markdown += `| P50 延遲 | ${metrics.requests.p50LatencyMs}ms |\n`;
  markdown += `| P95 延遲 | ${metrics.requests.p95LatencyMs}ms |\n`;
  markdown += `| P99 延遲 | ${metrics.requests.p99LatencyMs}ms |\n\n`;

  if (metrics.endpoints.length > 0) {
    markdown += "### 端點統計\n\n";
    markdown += "| 端點 | 請求數 | 錯誤率 | 平均延遲 |\n";
    markdown += "|------|--------|--------|----------|\n";
    for (const ep of metrics.endpoints) {
      markdown += `| ${ep.name} | ${ep.requests.toLocaleString()} | ${(ep.errorRate * 100).toFixed(2)}% | ${ep.avgLatencyMs}ms |\n`;
    }
    markdown += "\n";
  }

  if (metrics.errors.length > 0) {
    markdown += "### 🔴 錯誤分析\n\n";
    for (const error of metrics.errors) {
      markdown += `#### ${error.type} (${error.count} 次)\n`;
      markdown += `- 最後發生: ${error.lastOccurred}\n`;
      markdown += `- 範例: ${error.sampleMessage}\n\n`;
    }
  }

  if (metrics.resources) {
    markdown += "### 資源使用\n\n";
    markdown += "| 指標 | 平均 | 峰值 |\n";
    markdown += "|------|------|------|\n";
    markdown += `| CPU | ${metrics.resources.avgCpuPercent}% | ${metrics.resources.peakCpuPercent}% |\n`;
    markdown += `| 記憶體 | ${metrics.resources.avgMemoryMB}MB | ${metrics.resources.peakMemoryMB}MB |\n`;
  }

  return markdown;
}

/**
 * 格式化異常檢測結果為 Markdown
 *
 * @param result - 異常檢測結果
 * @returns Markdown 格式的報告
 */
export function formatAnomaliesAsMarkdown(
  result: AnomalyDetectionResult
): string {
  const healthEmoji =
    result.overallHealth === "healthy"
      ? "✅"
      : result.overallHealth === "degraded"
        ? "⚠️"
        : "🔴";

  let markdown = `## ${healthEmoji} 異常檢測報告\n\n`;
  markdown += `**時間範圍**: ${result.timeRange}\n`;
  markdown += `**整體狀態**: ${result.overallHealth.toUpperCase()}\n\n`;

  markdown += "### 指標摘要\n\n";
  markdown += "| 指標 | 值 |\n";
  markdown += "|------|----|\n";
  markdown += `| 分析的服務數 | ${result.metricsSummary.servicesAnalyzed} |\n`;
  markdown += `| 總請求數 | ${result.metricsSummary.totalRequests.toLocaleString()} |\n`;
  markdown += `| 整體錯誤率 | ${(result.metricsSummary.overallErrorRate * 100).toFixed(2)}% |\n`;
  markdown += `| 平均延遲 | ${result.metricsSummary.avgLatencyMs}ms |\n\n`;

  if (result.anomalies.length > 0) {
    markdown += `### 🚨 發現的異常 (${result.anomalies.length})\n\n`;
    for (const anomaly of result.anomalies) {
      const severityEmoji =
        anomaly.severity === "critical"
          ? "🔴"
          : anomaly.severity === "warning"
            ? "🟡"
            : "🔵";
      markdown += `#### ${severityEmoji} ${anomaly.description}\n\n`;
      markdown += `- **類型**: ${anomaly.type}\n`;
      markdown += `- **服務**: ${anomaly.affectedService}\n`;
      markdown += `- **開始時間**: ${anomaly.startedAt}\n`;
      markdown += `- **持續時間**: ${anomaly.durationMinutes} 分鐘\n`;
      markdown += `- **影響**: ${anomaly.impact}\n\n`;

      if (anomaly.possibleCauses.length > 0) {
        markdown += "**可能原因**:\n";
        for (const cause of anomaly.possibleCauses) {
          markdown += `- ${cause}\n`;
        }
        markdown += "\n";
      }

      if (anomaly.suggestedActions.length > 0) {
        markdown += "**建議行動**:\n";
        for (const action of anomaly.suggestedActions) {
          markdown += `- ${action}\n`;
        }
        markdown += "\n";
      }
    }
  } else {
    markdown += "### ✅ 未發現異常\n\n";
  }

  if (result.recommendations.length > 0) {
    markdown += "### 💡 建議\n\n";
    for (const rec of result.recommendations) {
      markdown += `- ${rec}\n`;
    }
  }

  return markdown;
}
