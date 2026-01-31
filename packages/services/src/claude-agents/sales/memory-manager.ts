/**
 * 銷售記憶管理代理人 - Phase 6
 *
 * 使用 Claude Agent SDK + Memory MCP 進行客戶資訊記憶管理
 *
 * 功能:
 * - 儲存客戶互動記憶
 * - 檢索客戶歷史資訊
 * - 生成個人化銷售建議
 * - 追蹤客戶偏好和痛點
 *
 * @example
 * ```typescript
 * import { saveCustomerMemory, getCustomerHistory } from "@sales_ai_automation_v3/services/claude-agents/sales/memory-manager";
 *
 * // 儲存客戶記憶
 * await saveCustomerMemory("cust-123", {
 *   type: "pain_point",
 *   content: "客戶對現有系統的整合困難感到不滿",
 * });
 *
 * // 取得客戶歷史
 * const history = await getCustomerHistory("cust-123");
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

export type MemoryType =
  | "pain_point"
  | "preference"
  | "decision_maker"
  | "budget_info"
  | "timeline"
  | "competitor_mention"
  | "objection"
  | "success_criteria"
  | "relationship_note"
  | "follow_up"
  | "other";

export interface CustomerMemory {
  /** 記憶 ID */
  id: string;
  /** 記憶類型 */
  type: MemoryType;
  /** 記憶內容 */
  content: string;
  /** 來源（對話 ID 等） */
  source?: string;
  /** 信心程度 (0-1) */
  confidence: number;
  /** 建立時間 */
  createdAt: string;
  /** 最後更新時間 */
  updatedAt: string;
  /** 相關標籤 */
  tags?: string[];
}

export interface CustomerProfile {
  /** 客戶 ID */
  customerId: string;
  /** 客戶名稱 */
  name?: string;
  /** 公司名稱 */
  company?: string;
  /** 記憶列表 */
  memories: CustomerMemory[];
  /** MEDDIC 摘要 */
  meddicSummary?: {
    metrics: string[];
    economicBuyer: string[];
    decisionCriteria: string[];
    decisionProcess: string[];
    identifiedPains: string[];
    champions: string[];
  };
  /** 最後互動時間 */
  lastInteraction?: string;
  /** 互動次數 */
  interactionCount: number;
}

export interface MemoryInput {
  /** 記憶類型 */
  type: MemoryType;
  /** 記憶內容 */
  content: string;
  /** 來源 */
  source?: string;
  /** 信心程度 */
  confidence?: number;
  /** 標籤 */
  tags?: string[];
}

export interface PersonalizedInsight {
  /** 客戶 ID */
  customerId: string;
  /** 洞察類型 */
  type: "talking_point" | "warning" | "opportunity" | "recommendation";
  /** 洞察內容 */
  content: string;
  /** 基於的記憶 */
  basedOnMemories: string[];
  /** 優先級 */
  priority: "high" | "medium" | "low";
}

export interface MemorySearchOptions {
  /** 記憶類型過濾 */
  types?: MemoryType[];
  /** 時間範圍（天） */
  daysBack?: number;
  /** 最小信心程度 */
  minConfidence?: number;
  /** 標籤過濾 */
  tags?: string[];
  /** 最大結果數 */
  limit?: number;
}

// ============================================================
// Prompt Builders
// ============================================================

function buildSaveMemoryPrompt(
  customerId: string,
  memory: MemoryInput
): string {
  return `你是一位銷售記憶管理專家。請儲存以下客戶記憶。

## 客戶資訊
- 客戶 ID: ${customerId}

## 新記憶
- 類型: ${memory.type}
- 內容: ${memory.content}
- 來源: ${memory.source ?? "手動輸入"}
- 信心程度: ${memory.confidence ?? 0.8}
- 標籤: ${memory.tags?.join(", ") ?? "無"}

## 任務

### 1. 驗證記憶
確認記憶內容的有效性：
- 內容是否有意義
- 類型是否正確
- 是否需要補充標籤

### 2. 儲存記憶
使用 Memory MCP 儲存記憶：
- 生成唯一 ID
- 設定時間戳
- 關聯到客戶

### 3. 更新客戶檔案
如果有相關的 MEDDIC 資訊，更新客戶的 MEDDIC 摘要

## 輸出格式
請以 JSON 格式輸出儲存結果：
\`\`\`json
{
  "success": true,
  "memory": {
    "id": "mem-abc123",
    "type": "${memory.type}",
    "content": "${memory.content}",
    "source": "${memory.source ?? "manual"}",
    "confidence": ${memory.confidence ?? 0.8},
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z",
    "tags": ${JSON.stringify(memory.tags ?? [])}
  },
  "relatedMemoriesUpdated": 0
}
\`\`\`
`;
}

function buildGetHistoryPrompt(
  customerId: string,
  options: MemorySearchOptions
): string {
  return `你是一位銷售記憶管理專家。請檢索客戶的歷史記憶。

## 客戶 ID
${customerId}

## 搜尋條件
- 記憶類型: ${options.types?.join(", ") ?? "所有類型"}
- 時間範圍: ${options.daysBack ? `最近 ${options.daysBack} 天` : "不限"}
- 最小信心程度: ${options.minConfidence ?? 0}
- 標籤過濾: ${options.tags?.join(", ") ?? "無"}
- 最大結果數: ${options.limit ?? 50}

## 任務

### 1. 查詢記憶
使用 Memory MCP 查詢客戶的記憶：
- 按條件過濾
- 按時間排序

### 2. 整理 MEDDIC 摘要
從記憶中整理 MEDDIC 相關資訊：
- Metrics: 客戶提到的成功指標
- Economic Buyer: 識別的決策者
- Decision Criteria: 選擇標準
- Decision Process: 採購流程
- Identify Pain: 發現的痛點
- Champion: 內部支持者

### 3. 計算統計
- 總記憶數
- 各類型記憶數量
- 最後互動時間

## 輸出格式
請以 JSON 格式輸出客戶檔案：
\`\`\`json
{
  "customerId": "${customerId}",
  "name": "客戶名稱",
  "company": "公司名稱",
  "memories": [
    {
      "id": "mem-001",
      "type": "pain_point",
      "content": "記憶內容",
      "source": "conv-123",
      "confidence": 0.9,
      "createdAt": "2024-01-10T10:00:00Z",
      "updatedAt": "2024-01-10T10:00:00Z",
      "tags": ["integration", "legacy"]
    }
  ],
  "meddicSummary": {
    "metrics": ["降低 30% 成本"],
    "economicBuyer": ["王總經理"],
    "decisionCriteria": ["整合性", "ROI"],
    "decisionProcess": ["技術評估 -> 商務談判 -> 高層審批"],
    "identifiedPains": ["現有系統整合困難"],
    "champions": ["技術部李主管"]
  },
  "lastInteraction": "2024-01-14T15:30:00Z",
  "interactionCount": 8
}
\`\`\`
`;
}

function buildInsightsPrompt(customerId: string): string {
  return `你是一位銷售策略專家。請根據客戶的記憶生成個人化洞察。

## 客戶 ID
${customerId}

## 任務

### 1. 檢索客戶記憶
使用 Memory MCP 取得客戶的所有記憶

### 2. 分析記憶模式
識別以下模式：
- 重複出現的痛點
- 客戶的偏好傾向
- 潛在的異議
- 成交機會信號

### 3. 生成個人化洞察
根據分析結果生成：
- **談話要點**: 下次對話可以提及的話題
- **警示**: 需要注意的風險點
- **機會**: 可以把握的成交機會
- **建議**: 具體的行動建議

### 4. 優先級排序
根據重要性和時效性排序洞察

## 輸出格式
請以 JSON 格式輸出洞察列表：
\`\`\`json
{
  "customerId": "${customerId}",
  "insights": [
    {
      "type": "talking_point",
      "content": "客戶上次提到擔心整合問題，可以分享成功案例",
      "basedOnMemories": ["mem-001", "mem-003"],
      "priority": "high"
    },
    {
      "type": "warning",
      "content": "客戶多次提到競品 X，可能正在比價",
      "basedOnMemories": ["mem-002", "mem-005"],
      "priority": "high"
    },
    {
      "type": "opportunity",
      "content": "客戶預算週期將在 Q2 結束，適合推動成交",
      "basedOnMemories": ["mem-007"],
      "priority": "medium"
    }
  ],
  "summary": "此客戶處於評估階段，主要關注整合和 ROI",
  "recommendedNextAction": "準備整合案例研究，安排與技術團隊的 Demo"
}
\`\`\`
`;
}

function buildExtractMemoriesPrompt(
  conversationId: string,
  transcript: string
): string {
  return `你是一位銷售記憶提取專家。請從對話中提取重要的客戶資訊。

## 對話 ID
${conversationId}

## 對話內容
${transcript}

## 任務

### 1. 識別重要資訊
從對話中提取以下類型的資訊：
- **pain_point**: 客戶提到的痛點和問題
- **preference**: 客戶的偏好和需求
- **decision_maker**: 提到的決策相關人物
- **budget_info**: 預算相關資訊
- **timeline**: 時程相關資訊
- **competitor_mention**: 提到的競爭對手
- **objection**: 客戶的異議和顧慮
- **success_criteria**: 成功標準和 KPI
- **relationship_note**: 關係建立的重要時刻

### 2. 評估信心程度
對每條記憶評估信心程度（0-1）：
- 0.9-1.0: 客戶明確表述
- 0.7-0.9: 可以合理推斷
- 0.5-0.7: 可能的解讀
- < 0.5: 不確定

### 3. 添加標籤
為每條記憶添加相關標籤以便日後搜尋

## 輸出格式
請以 JSON 格式輸出提取的記憶：
\`\`\`json
{
  "conversationId": "${conversationId}",
  "extractedMemories": [
    {
      "type": "pain_point",
      "content": "客戶表示現有 CRM 系統操作複雜，業務人員抗拒使用",
      "confidence": 0.95,
      "tags": ["crm", "user-adoption", "complexity"],
      "quote": "我們現在的 CRM 太複雜了，業務都不想用"
    },
    {
      "type": "decision_maker",
      "content": "最終決策者是張總，需要他的批准",
      "confidence": 0.9,
      "tags": ["executive", "approval"],
      "quote": "這種規模的採購需要我們張總點頭"
    }
  ],
  "suggestedCustomerId": "cust-xxx",
  "totalMemoriesExtracted": 5
}
\`\`\`
`;
}

// ============================================================
// Result Parsers
// ============================================================

function parseSaveResult(content: string): {
  success: boolean;
  memory?: CustomerMemory;
} {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return { success: false };
  }

  try {
    const parsed = JSON.parse(objectMatch[0]) as {
      success: boolean;
      memory: CustomerMemory;
    };
    return parsed;
  } catch {
    return { success: false };
  }
}

function parseCustomerProfile(content: string): CustomerProfile {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return {
      customerId: "unknown",
      memories: [],
      interactionCount: 0,
    };
  }

  try {
    return JSON.parse(objectMatch[0]) as CustomerProfile;
  } catch {
    return {
      customerId: "unknown",
      memories: [],
      interactionCount: 0,
    };
  }
}

function parseInsights(content: string): {
  customerId: string;
  insights: PersonalizedInsight[];
  summary: string;
  recommendedNextAction: string;
} {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return {
      customerId: "unknown",
      insights: [],
      summary: content.slice(0, 500),
      recommendedNextAction: "",
    };
  }

  try {
    return JSON.parse(objectMatch[0]) as {
      customerId: string;
      insights: PersonalizedInsight[];
      summary: string;
      recommendedNextAction: string;
    };
  } catch {
    return {
      customerId: "unknown",
      insights: [],
      summary: content.slice(0, 500),
      recommendedNextAction: "",
    };
  }
}

function parseExtractedMemories(content: string): {
  conversationId: string;
  extractedMemories: Array<MemoryInput & { quote?: string }>;
  suggestedCustomerId?: string;
} {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return {
      conversationId: "unknown",
      extractedMemories: [],
    };
  }

  try {
    return JSON.parse(objectMatch[0]) as {
      conversationId: string;
      extractedMemories: Array<MemoryInput & { quote?: string }>;
      suggestedCustomerId?: string;
    };
  } catch {
    return {
      conversationId: "unknown",
      extractedMemories: [],
    };
  }
}

// ============================================================
// Main Functions
// ============================================================

/**
 * 儲存客戶記憶
 *
 * @param customerId - 客戶 ID
 * @param memory - 記憶內容
 * @returns 儲存結果
 *
 * @example
 * ```typescript
 * const result = await saveCustomerMemory("cust-123", {
 *   type: "pain_point",
 *   content: "客戶對現有系統的整合困難感到不滿",
 *   source: "conv-456",
 *   confidence: 0.9,
 *   tags: ["integration", "legacy-system"],
 * });
 *
 * if (result.success) {
 *   console.log(`記憶已儲存: ${result.memory.id}`);
 * }
 * ```
 */
export async function saveCustomerMemory(
  customerId: string,
  memory: MemoryInput
): Promise<{ success: boolean; memory?: CustomerMemory }> {
  if (!isMcpServerConfigured("memory")) {
    // 如果 Memory MCP 未配置，使用模擬模式
    console.warn("Memory MCP 未配置，使用模擬模式");
    return {
      success: true,
      memory: {
        id: `mem-${Date.now()}`,
        type: memory.type,
        content: memory.content,
        source: memory.source,
        confidence: memory.confidence ?? 0.8,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: memory.tags,
      },
    };
  }

  const prompt = buildSaveMemoryPrompt(customerId, memory);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Bash"],
    mcpServers: getMcpServers(["memory"]),
    permissionMode: "default",
    maxTurns: 10,
  });

  if (!result.success) {
    throw new Error(`儲存記憶失敗: ${result.error}`);
  }

  return parseSaveResult(result.content);
}

/**
 * 取得客戶歷史記憶
 *
 * @param customerId - 客戶 ID
 * @param options - 搜尋選項
 * @returns 客戶檔案
 *
 * @example
 * ```typescript
 * const profile = await getCustomerHistory("cust-123", {
 *   types: ["pain_point", "objection"],
 *   daysBack: 30,
 * });
 *
 * console.log(`客戶有 ${profile.memories.length} 條記憶`);
 * console.log(`MEDDIC 痛點: ${profile.meddicSummary?.identifiedPains.join(", ")}`);
 * ```
 */
export async function getCustomerHistory(
  customerId: string,
  options: MemorySearchOptions = {}
): Promise<CustomerProfile> {
  if (!isMcpServerConfigured("memory")) {
    console.warn("Memory MCP 未配置，返回空白檔案");
    return {
      customerId,
      memories: [],
      interactionCount: 0,
    };
  }

  const prompt = buildGetHistoryPrompt(customerId, options);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Bash"],
    mcpServers: getMcpServers(["memory"]),
    permissionMode: "default",
    maxTurns: 15,
  });

  if (!result.success) {
    throw new Error(`取得客戶歷史失敗: ${result.error}`);
  }

  return parseCustomerProfile(result.content);
}

/**
 * 生成個人化銷售洞察
 *
 * @param customerId - 客戶 ID
 * @returns 個人化洞察
 *
 * @example
 * ```typescript
 * const insights = await generatePersonalizedInsights("cust-123");
 *
 * console.log(`摘要: ${insights.summary}`);
 * console.log(`建議行動: ${insights.recommendedNextAction}`);
 *
 * insights.insights.forEach(insight => {
 *   console.log(`[${insight.priority}] ${insight.type}: ${insight.content}`);
 * });
 * ```
 */
export async function generatePersonalizedInsights(
  customerId: string
): Promise<{
  customerId: string;
  insights: PersonalizedInsight[];
  summary: string;
  recommendedNextAction: string;
}> {
  if (!isMcpServerConfigured("memory")) {
    console.warn("Memory MCP 未配置，使用基本分析");
  }

  const prompt = buildInsightsPrompt(customerId);

  const mcpServers = isMcpServerConfigured("memory")
    ? getMcpServers(["memory", "postgres"])
    : getMcpServers(["postgres"]);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Glob", "Grep"],
    mcpServers,
    permissionMode: "default",
    maxTurns: 20,
  });

  if (!result.success) {
    throw new Error(`生成洞察失敗: ${result.error}`);
  }

  return parseInsights(result.content);
}

/**
 * 從對話中提取記憶
 *
 * @param conversationId - 對話 ID
 * @param transcript - 對話內容（可選，如果不提供會自動查詢）
 * @returns 提取的記憶列表
 *
 * @example
 * ```typescript
 * const extracted = await extractMemoriesFromConversation("conv-123");
 *
 * console.log(`提取了 ${extracted.extractedMemories.length} 條記憶`);
 *
 * // 批量儲存
 * for (const mem of extracted.extractedMemories) {
 *   await saveCustomerMemory(extracted.suggestedCustomerId, mem);
 * }
 * ```
 */
export async function extractMemoriesFromConversation(
  conversationId: string,
  transcript?: string
): Promise<{
  conversationId: string;
  extractedMemories: Array<MemoryInput & { quote?: string }>;
  suggestedCustomerId?: string;
}> {
  const transcriptContent = transcript ?? "(請查詢對話內容)";
  const prompt = buildExtractMemoriesPrompt(conversationId, transcriptContent);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Glob", "Grep"],
    mcpServers: getMcpServers(["postgres"]),
    permissionMode: "default",
    maxTurns: 20,
  });

  if (!result.success) {
    throw new Error(`提取記憶失敗: ${result.error}`);
  }

  return parseExtractedMemories(result.content);
}

/**
 * 格式化客戶檔案為 Markdown
 *
 * @param profile - 客戶檔案
 * @returns Markdown 格式的報告
 */
export function formatCustomerProfileAsMarkdown(
  profile: CustomerProfile
): string {
  let markdown = "## 👤 客戶檔案\n\n";
  markdown += `**客戶 ID**: ${profile.customerId}\n`;
  if (profile.name) {
    markdown += `**名稱**: ${profile.name}\n`;
  }
  if (profile.company) {
    markdown += `**公司**: ${profile.company}\n`;
  }
  markdown += `**互動次數**: ${profile.interactionCount}\n`;
  if (profile.lastInteraction) {
    markdown += `**最後互動**: ${profile.lastInteraction}\n`;
  }
  markdown += "\n";

  if (profile.meddicSummary) {
    markdown += "### 📊 MEDDIC 摘要\n\n";
    const meddic = profile.meddicSummary;
    if (meddic.metrics.length > 0) {
      markdown += `**Metrics**: ${meddic.metrics.join("; ")}\n`;
    }
    if (meddic.economicBuyer.length > 0) {
      markdown += `**Economic Buyer**: ${meddic.economicBuyer.join("; ")}\n`;
    }
    if (meddic.decisionCriteria.length > 0) {
      markdown += `**Decision Criteria**: ${meddic.decisionCriteria.join("; ")}\n`;
    }
    if (meddic.decisionProcess.length > 0) {
      markdown += `**Decision Process**: ${meddic.decisionProcess.join("; ")}\n`;
    }
    if (meddic.identifiedPains.length > 0) {
      markdown += `**Identified Pains**: ${meddic.identifiedPains.join("; ")}\n`;
    }
    if (meddic.champions.length > 0) {
      markdown += `**Champions**: ${meddic.champions.join("; ")}\n`;
    }
    markdown += "\n";
  }

  if (profile.memories.length > 0) {
    markdown += `### 🧠 記憶 (${profile.memories.length})\n\n`;

    // 按類型分組
    const byType = new Map<MemoryType, CustomerMemory[]>();
    for (const mem of profile.memories) {
      const existing = byType.get(mem.type) ?? [];
      existing.push(mem);
      byType.set(mem.type, existing);
    }

    for (const [type, memories] of byType) {
      markdown += `#### ${type} (${memories.length})\n\n`;
      for (const mem of memories.slice(0, 5)) {
        const confidence = Math.round(mem.confidence * 100);
        markdown += `- ${mem.content} _(${confidence}% 信心)_\n`;
        if (mem.tags && mem.tags.length > 0) {
          markdown += `  Tags: ${mem.tags.join(", ")}\n`;
        }
      }
      if (memories.length > 5) {
        markdown += `  _... 還有 ${memories.length - 5} 條記憶_\n`;
      }
      markdown += "\n";
    }
  }

  return markdown;
}

/**
 * 格式化洞察為 Markdown
 *
 * @param result - 洞察結果
 * @returns Markdown 格式的報告
 */
export function formatInsightsAsMarkdown(result: {
  customerId: string;
  insights: PersonalizedInsight[];
  summary: string;
  recommendedNextAction: string;
}): string {
  let markdown = "## 💡 個人化銷售洞察\n\n";
  markdown += `**客戶 ID**: ${result.customerId}\n\n`;
  markdown += `### 摘要\n${result.summary}\n\n`;
  markdown += `### 建議行動\n${result.recommendedNextAction}\n\n`;

  if (result.insights.length > 0) {
    markdown += `### 洞察 (${result.insights.length})\n\n`;

    const typeEmoji: Record<PersonalizedInsight["type"], string> = {
      talking_point: "💬",
      warning: "⚠️",
      opportunity: "🎯",
      recommendation: "📋",
    };

    const priorityEmoji: Record<PersonalizedInsight["priority"], string> = {
      high: "🔴",
      medium: "🟡",
      low: "🟢",
    };

    for (const insight of result.insights) {
      markdown += `${typeEmoji[insight.type]} ${priorityEmoji[insight.priority]} **${insight.type}**\n`;
      markdown += `${insight.content}\n`;
      markdown += `_基於: ${insight.basedOnMemories.join(", ")}_\n\n`;
    }
  }

  return markdown;
}
