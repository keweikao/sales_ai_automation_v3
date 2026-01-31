/**
 * 增強版銷售教練代理人 - Phase 4
 *
 * 使用 Claude Agent SDK + Google Workspace MCP 提供互動式銷售教練
 *
 * 功能:
 * - 分析對話並提供個人化銷售建議
 * - 回答針對對話的問題
 * - 推薦適合的話術
 * - 排程跟進提醒（整合 Google Calendar）
 *
 * @example
 * ```typescript
 * import { analyzeWithCoach, askCoach } from "@sales_ai_automation_v3/services/claude-agents/sales/coach-enhanced";
 *
 * // 分析對話
 * const coaching = await analyzeWithCoach(conversationId);
 *
 * // 提問
 * const answer = await askCoach(conversationId, "客戶的主要痛點是什麼？");
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

export interface CoachingAction {
  /** 行動類型 */
  type: "call" | "email" | "meeting" | "follow_up" | "proposal" | "other";
  /** 行動描述 */
  description: string;
  /** 優先級 */
  priority: "high" | "medium" | "low";
  /** 建議的話術 */
  suggestedScript?: string;
  /** 建議的時機 */
  timing?: string;
}

export interface CoachingResult {
  /** 對話 ID */
  conversationId: string;
  /** MEDDIC 摘要 */
  meddicSummary: {
    metrics: { score: number; insight: string };
    economicBuyer: { score: number; insight: string };
    decisionCriteria: { score: number; insight: string };
    decisionProcess: { score: number; insight: string };
    identifyPain: { score: number; insight: string };
    champion: { score: number; insight: string };
  };
  /** 建議行動 */
  actions: CoachingAction[];
  /** 警示（需要注意的事項） */
  warnings: string[];
  /** 機會洞察 */
  insights: string[];
  /** 下一步建議 */
  nextSteps: string[];
}

export interface AskCoachResult {
  /** 問題 */
  question: string;
  /** 答案 */
  answer: string;
  /** 相關的 MEDDIC 維度 */
  relatedDimensions: string[];
  /** 建議的行動 */
  suggestedActions?: CoachingAction[];
}

export interface TalkTrack {
  /** 話術 ID */
  id: string;
  /** 分類 */
  category: string;
  /** 標題 */
  title: string;
  /** 情境描述 */
  scenario: string;
  /** 話術內容 */
  script: string;
  /** 使用提示 */
  tips: string[];
}

export interface FollowUpSchedule {
  /** 商機 ID */
  opportunityId: string;
  /** 排程時間 */
  scheduledTime: Date;
  /** 提醒標題 */
  title: string;
  /** 提醒內容 */
  description: string;
  /** 是否已建立日曆事件 */
  calendarEventCreated: boolean;
  /** 日曆事件 ID（如果有） */
  calendarEventId?: string;
}

export type TalkTrackCategory =
  | "objection_handling"
  | "discovery"
  | "closing"
  | "follow_up"
  | "value_prop"
  | "all";

export type FollowUpTiming = "2h" | "tomorrow" | "3d" | "1w";

// ============================================================
// Prompt Builders
// ============================================================

function buildAnalyzePrompt(conversationId: string): string {
  return `你是一位經驗豐富的 B2B 銷售教練，專精 MEDDIC 銷售方法論。請分析以下對話並提供個人化的銷售建議。

## 對話 ID
${conversationId}

## 分析步驟

### 1. 取得對話資料
使用 PostgreSQL 查詢對話詳情：
- 查詢 conversations 表取得對話內容
- 查詢 meddic_analyses 表取得 MEDDIC 分析結果
- 查詢 opportunities 表取得商機資訊

### 2. MEDDIC 深度分析
針對每個維度提供洞察：
- **Metrics**: 客戶是否有明確的成功指標？
- **Economic Buyer**: 是否已識別決策者？
- **Decision Criteria**: 是否了解客戶的選擇標準？
- **Decision Process**: 是否清楚採購流程？
- **Identify Pain**: 是否挖掘出核心痛點？
- **Champion**: 是否建立內部擁護者？

### 3. 行動建議
根據分析結果，提供具體、可執行的行動：
- 每個行動要有明確的話術建議
- 考慮時機和優先級
- 針對弱點維度提供改善策略

### 4. 識別警示
找出可能影響成交的風險：
- 競爭對手介入
- 決策延遲信號
- 預算疑慮
- 溝通斷層

## 輸出格式
請以 JSON 格式輸出分析結果：
\`\`\`json
{
  "conversationId": "${conversationId}",
  "meddicSummary": {
    "metrics": { "score": 3, "insight": "客戶提到要降低 30% 成本" },
    "economicBuyer": { "score": 2, "insight": "尚未接觸到真正決策者" },
    "decisionCriteria": { "score": 4, "insight": "重視整合性和 ROI" },
    "decisionProcess": { "score": 2, "insight": "採購流程不明確" },
    "identifyPain": { "score": 5, "insight": "核心痛點是效率低下" },
    "champion": { "score": 3, "insight": "技術主管有意支持" }
  },
  "actions": [
    {
      "type": "call",
      "description": "聯繫技術主管安排高層會議",
      "priority": "high",
      "suggestedScript": "王主管，您好！上次您提到...",
      "timing": "今天下午"
    }
  ],
  "warnings": ["競爭對手 X 公司可能已介入"],
  "insights": ["客戶對 ROI 特別敏感，建議準備詳細的投資回報分析"],
  "nextSteps": ["1. 確認決策流程", "2. 安排高層會議", "3. 準備 ROI 報告"]
}
\`\`\`
`;
}

function buildAskPrompt(conversationId: string, question: string): string {
  return `你是一位經驗豐富的 B2B 銷售教練。請回答以下關於對話的問題。

## 對話 ID
${conversationId}

## 問題
${question}

## 分析步驟

### 1. 取得對話資料
使用 PostgreSQL 查詢對話詳情和 MEDDIC 分析結果

### 2. 分析問題
- 理解問題的核心意圖
- 識別相關的 MEDDIC 維度
- 從對話中找出相關資訊

### 3. 提供建議
- 直接回答問題
- 提供實用的建議
- 如果適用，建議具體的話術或行動

## 輸出格式
請以 JSON 格式輸出回答：
\`\`\`json
{
  "question": "${question}",
  "answer": "詳細的回答...",
  "relatedDimensions": ["Identify Pain", "Champion"],
  "suggestedActions": [
    {
      "type": "call",
      "description": "建議的行動",
      "priority": "medium"
    }
  ]
}
\`\`\`
`;
}

function buildTalkTracksPrompt(category: TalkTrackCategory): string {
  const categoryName =
    category === "all"
      ? "所有分類"
      : {
          objection_handling: "異議處理",
          discovery: "需求探索",
          closing: "成交話術",
          follow_up: "跟進話術",
          value_prop: "價值主張",
        }[category];

  return `你是一位 B2B 銷售話術專家。請提供 ${categoryName} 的話術範本。

## 分類
${category === "all" ? "所有分類" : category}

## 要求
- 提供 3-5 個實用的話術範本
- 每個話術要有清晰的使用情境
- 包含具體的開場白和對話範例
- 提供使用提示

## 話術分類說明
- **objection_handling**: 處理價格異議、競品比較、時機不對等
- **discovery**: 探索需求、挖掘痛點、了解決策流程
- **closing**: 試探成交、處理猶豫、最終收尾
- **follow_up**: 會後跟進、報價後跟進、長期培養
- **value_prop**: 價值陳述、ROI 說明、差異化優勢

## 輸出格式
請以 JSON 格式輸出話術列表：
\`\`\`json
{
  "category": "${category}",
  "tracks": [
    {
      "id": "obj-001",
      "category": "objection_handling",
      "title": "價格太高的回應",
      "scenario": "當客戶說「你們的價格比競品高」時",
      "script": "我理解您的考量。讓我們來看看總體擁有成本...",
      "tips": ["先認同客戶感受", "轉移到價值討論", "準備 ROI 數據"]
    }
  ]
}
\`\`\`
`;
}

function buildFollowUpPrompt(
  opportunityId: string,
  timing: FollowUpTiming,
  useCalendar: boolean
): string {
  const timingMap: Record<FollowUpTiming, string> = {
    "2h": "2 小時後",
    tomorrow: "明天早上 9 點",
    "3d": "3 天後",
    "1w": "1 週後",
  };

  return `你是一位銷售助理，負責排程跟進提醒。

## 商機 ID
${opportunityId}

## 跟進時間
${timingMap[timing]}

## 任務

### 1. 查詢商機資訊
使用 PostgreSQL 查詢商機詳情：
- 客戶名稱
- 聯絡人
- 商機階段
- 最近的對話內容

### 2. 生成提醒內容
根據商機狀態生成適當的跟進提醒：
- 標題要簡潔明瞭
- 內容包含關鍵背景資訊
- 提供建議的話術

${
  useCalendar
    ? `### 3. 建立日曆事件
使用 Google Calendar MCP 建立提醒事件：
- 設定適當的時間
- 添加詳細描述
- 設定提醒通知`
    : ""
}

## 輸出格式
請以 JSON 格式輸出排程結果：
\`\`\`json
{
  "opportunityId": "${opportunityId}",
  "scheduledTime": "2024-01-15T14:00:00+08:00",
  "title": "跟進: ABC 公司 - 報價確認",
  "description": "上次會議後的跟進...",
  "calendarEventCreated": ${useCalendar},
  "calendarEventId": "abc123"
}
\`\`\`
`;
}

// ============================================================
// Result Parsers
// ============================================================

function parseCoachingResult(content: string): CoachingResult {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return {
      conversationId: "unknown",
      meddicSummary: {
        metrics: { score: 0, insight: "無法解析" },
        economicBuyer: { score: 0, insight: "無法解析" },
        decisionCriteria: { score: 0, insight: "無法解析" },
        decisionProcess: { score: 0, insight: "無法解析" },
        identifyPain: { score: 0, insight: "無法解析" },
        champion: { score: 0, insight: "無法解析" },
      },
      actions: [],
      warnings: ["無法解析分析結果"],
      insights: [],
      nextSteps: ["請手動檢查對話"],
    };
  }

  try {
    return JSON.parse(objectMatch[0]) as CoachingResult;
  } catch {
    return {
      conversationId: "unknown",
      meddicSummary: {
        metrics: { score: 0, insight: content.slice(0, 100) },
        economicBuyer: { score: 0, insight: "" },
        decisionCriteria: { score: 0, insight: "" },
        decisionProcess: { score: 0, insight: "" },
        identifyPain: { score: 0, insight: "" },
        champion: { score: 0, insight: "" },
      },
      actions: [],
      warnings: [],
      insights: [],
      nextSteps: [],
    };
  }
}

function parseAskResult(content: string): AskCoachResult {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return {
      question: "unknown",
      answer: content,
      relatedDimensions: [],
    };
  }

  try {
    return JSON.parse(objectMatch[0]) as AskCoachResult;
  } catch {
    return {
      question: "unknown",
      answer: content,
      relatedDimensions: [],
    };
  }
}

function parseTalkTracks(content: string): {
  category: string;
  tracks: TalkTrack[];
} {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return { category: "unknown", tracks: [] };
  }

  try {
    return JSON.parse(objectMatch[0]) as {
      category: string;
      tracks: TalkTrack[];
    };
  } catch {
    return { category: "unknown", tracks: [] };
  }
}

function parseFollowUpResult(content: string): FollowUpSchedule {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return {
      opportunityId: "unknown",
      scheduledTime: new Date(),
      title: "跟進提醒",
      description: content,
      calendarEventCreated: false,
    };
  }

  try {
    const parsed = JSON.parse(objectMatch[0]) as FollowUpSchedule;
    return {
      ...parsed,
      scheduledTime: new Date(parsed.scheduledTime),
    };
  } catch {
    return {
      opportunityId: "unknown",
      scheduledTime: new Date(),
      title: "跟進提醒",
      description: content,
      calendarEventCreated: false,
    };
  }
}

// ============================================================
// Main Functions
// ============================================================

/**
 * 分析對話並提供銷售教練建議
 *
 * @param conversationId - 對話 ID
 * @returns 教練分析結果
 *
 * @example
 * ```typescript
 * const coaching = await analyzeWithCoach("conv-abc123");
 *
 * console.log("MEDDIC 分數:");
 * Object.entries(coaching.meddicSummary).forEach(([dim, data]) => {
 *   console.log(`${dim}: ${data.score}/5 - ${data.insight}`);
 * });
 *
 * console.log("\n建議行動:");
 * coaching.actions.forEach(action => {
 *   console.log(`[${action.priority}] ${action.description}`);
 * });
 * ```
 */
export async function analyzeWithCoach(
  conversationId: string
): Promise<CoachingResult> {
  const prompt = buildAnalyzePrompt(conversationId);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Glob", "Grep"],
    mcpServers: getMcpServers(["postgres"]),
    permissionMode: "default",
    maxTurns: 25,
  });

  if (!result.success) {
    throw new Error(`教練分析失敗: ${result.error}`);
  }

  return parseCoachingResult(result.content);
}

/**
 * 針對對話提問並獲得銷售建議
 *
 * @param conversationId - 對話 ID
 * @param question - 問題
 * @returns 回答結果
 *
 * @example
 * ```typescript
 * const answer = await askCoach("conv-abc123", "客戶的主要痛點是什麼？");
 * console.log(answer.answer);
 *
 * if (answer.suggestedActions) {
 *   console.log("建議行動:");
 *   answer.suggestedActions.forEach(a => console.log(`- ${a.description}`));
 * }
 * ```
 */
export async function askCoach(
  conversationId: string,
  question: string
): Promise<AskCoachResult> {
  const prompt = buildAskPrompt(conversationId, question);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Glob", "Grep"],
    mcpServers: getMcpServers(["postgres"]),
    permissionMode: "default",
    maxTurns: 15,
  });

  if (!result.success) {
    throw new Error(`教練問答失敗: ${result.error}`);
  }

  return parseAskResult(result.content);
}

/**
 * 取得話術範本
 *
 * @param category - 話術分類
 * @returns 話術列表
 *
 * @example
 * ```typescript
 * const { tracks } = await getTalkTracks("objection_handling");
 *
 * tracks.forEach(track => {
 *   console.log(`\n${track.title}`);
 *   console.log(`情境: ${track.scenario}`);
 *   console.log(`話術: ${track.script}`);
 * });
 * ```
 */
export async function getTalkTracks(
  category: TalkTrackCategory = "all"
): Promise<{ category: string; tracks: TalkTrack[] }> {
  const prompt = buildTalkTracksPrompt(category);

  const result = await executeAgent({
    prompt,
    tools: [],
    maxTurns: 5,
  });

  if (!result.success) {
    throw new Error(`取得話術失敗: ${result.error}`);
  }

  return parseTalkTracks(result.content);
}

/**
 * 排程跟進提醒
 *
 * @param opportunityId - 商機 ID
 * @param timing - 跟進時間
 * @returns 排程結果
 *
 * @example
 * ```typescript
 * const schedule = await scheduleFollowUp("opp-123", "tomorrow");
 *
 * console.log(`已排程: ${schedule.title}`);
 * console.log(`時間: ${schedule.scheduledTime}`);
 * if (schedule.calendarEventCreated) {
 *   console.log(`日曆事件 ID: ${schedule.calendarEventId}`);
 * }
 * ```
 */
export async function scheduleFollowUp(
  opportunityId: string,
  timing: FollowUpTiming
): Promise<FollowUpSchedule> {
  // 檢查 Google Workspace MCP 是否已配置
  const useCalendar = isMcpServerConfigured("googleWorkspace");

  const prompt = buildFollowUpPrompt(opportunityId, timing, useCalendar);

  const mcpServers = useCalendar
    ? getMcpServers(["postgres", "googleWorkspace"])
    : getMcpServers(["postgres"]);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Glob", "Grep"],
    mcpServers,
    permissionMode: "default",
    maxTurns: 15,
  });

  if (!result.success) {
    throw new Error(`排程跟進失敗: ${result.error}`);
  }

  return parseFollowUpResult(result.content);
}

/**
 * 格式化教練結果為 Markdown
 *
 * @param result - 教練分析結果
 * @returns Markdown 格式的報告
 */
export function formatCoachingAsMarkdown(result: CoachingResult): string {
  let markdown = "## 🎯 Sales Coach 分析結果\n\n";
  markdown += `**對話 ID**: ${result.conversationId}\n\n`;

  // MEDDIC 摘要
  markdown += "### 📊 MEDDIC 評估\n\n";
  markdown += "| 維度 | 分數 | 洞察 |\n";
  markdown += "|------|------|------|\n";

  const dimensions = [
    { key: "metrics", label: "Metrics (指標)" },
    { key: "economicBuyer", label: "Economic Buyer (經濟買家)" },
    { key: "decisionCriteria", label: "Decision Criteria (決策標準)" },
    { key: "decisionProcess", label: "Decision Process (決策流程)" },
    { key: "identifyPain", label: "Identify Pain (識別痛點)" },
    { key: "champion", label: "Champion (內部擁護者)" },
  ] as const;

  for (const dim of dimensions) {
    const data = result.meddicSummary[dim.key];
    const scoreBar = "●".repeat(data.score) + "○".repeat(5 - data.score);
    markdown += `| ${dim.label} | ${scoreBar} ${data.score}/5 | ${data.insight} |\n`;
  }
  markdown += "\n";

  // 行動建議
  if (result.actions.length > 0) {
    markdown += "### 🚀 建議行動\n\n";
    for (const action of result.actions) {
      const priorityEmoji =
        action.priority === "high"
          ? "🔴"
          : action.priority === "medium"
            ? "🟡"
            : "🟢";
      markdown += `${priorityEmoji} **${action.description}**\n`;
      if (action.timing) {
        markdown += `- ⏰ 時機: ${action.timing}\n`;
      }
      if (action.suggestedScript) {
        markdown += `- 💬 話術: "${action.suggestedScript}"\n`;
      }
      markdown += "\n";
    }
  }

  // 警示
  if (result.warnings.length > 0) {
    markdown += "### ⚠️ 警示\n\n";
    for (const warning of result.warnings) {
      markdown += `- ${warning}\n`;
    }
    markdown += "\n";
  }

  // 洞察
  if (result.insights.length > 0) {
    markdown += "### 💡 洞察\n\n";
    for (const insight of result.insights) {
      markdown += `- ${insight}\n`;
    }
    markdown += "\n";
  }

  // 下一步
  if (result.nextSteps.length > 0) {
    markdown += "### 📋 下一步\n\n";
    for (const step of result.nextSteps) {
      markdown += `- [ ] ${step}\n`;
    }
  }

  return markdown;
}
