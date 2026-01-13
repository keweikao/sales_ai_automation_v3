/**
 * Result Parser
 * 解析 LLM 輸出，提取結構化資料
 *
 * 提供統一的解析介面，將 LLM 的自然語言輸出
 * 轉換為結構化的建議、話術、警示和跟進項目
 */

import { randomUUID } from "node:crypto";

import type { Alert, FollowUp, Recommendation, TalkTrack } from "./types.js";

// ============================================================
// Types
// ============================================================

/** 解析選項 */
export interface ParserOptions {
  /** 是否嚴格模式（失敗時拋出錯誤） */
  strict?: boolean;
  /** 是否啟用日誌 */
  enableLogging?: boolean;
  /** 預設優先等級 */
  defaultPriority?: "critical" | "high" | "medium" | "low";
}

/** 解析結果 */
export interface ParseResult<T> {
  /** 是否成功 */
  success: boolean;
  /** 解析出的資料 */
  data: T[];
  /** 錯誤訊息（如有） */
  errors: string[];
  /** 原始輸出 */
  rawOutput: string;
}

// ============================================================
// JSON 解析工具
// ============================================================

/**
 * 從 LLM 輸出中提取 JSON
 * 支援 markdown code block 和純 JSON
 */
function extractJSON<T>(text: string): T | null {
  // 嘗試提取 markdown code block 中的 JSON
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch?.[1]) {
    try {
      return JSON.parse(codeBlockMatch[1]) as T;
    } catch {
      // 繼續嘗試其他方式
    }
  }

  // 嘗試直接解析整個文本
  try {
    return JSON.parse(text) as T;
  } catch {
    // 繼續嘗試其他方式
  }

  // 嘗試找到 JSON 物件
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as T;
    } catch {
      // 解析失敗
    }
  }

  // 嘗試找到 JSON 陣列
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]) as T;
    } catch {
      // 解析失敗
    }
  }

  return null;
}

// ============================================================
// Result Parser Class
// ============================================================

/**
 * Result Parser
 * 解析 LLM 輸出，提取結構化資料
 */
export class ResultParser {
  private readonly options: Required<ParserOptions>;

  constructor(options: ParserOptions = {}) {
    this.options = {
      strict: options.strict ?? false,
      enableLogging: options.enableLogging ?? false,
      defaultPriority: options.defaultPriority ?? "medium",
    };
  }

  // ============================================================
  // Recommendation Parsing
  // ============================================================

  /**
   * 解析建議
   * @param llmOutput - LLM 輸出文本
   * @returns 解析結果
   */
  parseRecommendations(llmOutput: string): ParseResult<Recommendation> {
    const errors: string[] = [];
    const recommendations: Recommendation[] = [];

    try {
      // 嘗試 JSON 解析
      const jsonData = extractJSON<{
        recommendations?: RawRecommendation[];
      }>(llmOutput);

      if (jsonData?.recommendations) {
        for (const raw of jsonData.recommendations) {
          const rec = this.transformRecommendation(raw);
          if (rec) {
            recommendations.push(rec);
          } else {
            errors.push(`Invalid recommendation: ${JSON.stringify(raw)}`);
          }
        }
      } else {
        // 嘗試文本解析
        const textRecs = this.parseRecommendationsFromText(llmOutput);
        recommendations.push(...textRecs);
      }
    } catch (error) {
      errors.push(
        `Parse error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (this.options.enableLogging) {
      console.log(
        `[ResultParser] Parsed ${recommendations.length} recommendations`
      );
    }

    return {
      success: errors.length === 0 || recommendations.length > 0,
      data: recommendations,
      errors,
      rawOutput: llmOutput,
    };
  }

  private transformRecommendation(
    raw: RawRecommendation
  ): Recommendation | null {
    if (!(raw.title && raw.description)) {
      return null;
    }

    return {
      id: `rec-${randomUUID().slice(0, 8)}`,
      type: this.normalizeRecommendationType(raw.type),
      priority: this.normalizePriority(raw.priority),
      title: raw.title,
      description: raw.description,
      rationale: raw.rationale ?? "",
      suggestedTiming: raw.suggestedTiming,
    };
  }

  private parseRecommendationsFromText(text: string): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // 使用正則表達式尋找列表項目
    const listPattern =
      /(?:^|\n)[-*]\s*(?:\[([^\]]+)\])?\s*([^:\n]+):\s*([^\n]+)/g;
    let match: RegExpExecArray | null;

    while ((match = listPattern.exec(text)) !== null) {
      recommendations.push({
        id: `rec-${randomUUID().slice(0, 8)}`,
        type: this.normalizeRecommendationType(match[1] ?? "follow_up"),
        priority: this.options.defaultPriority,
        title: match[2]?.trim() ?? "",
        description: match[3]?.trim() ?? "",
        rationale: "",
      });
    }

    return recommendations;
  }

  private normalizeRecommendationType(type?: string): Recommendation["type"] {
    const typeMap: Record<string, Recommendation["type"]> = {
      immediate: "immediate_action",
      immediate_action: "immediate_action",
      follow_up: "follow_up",
      followup: "follow_up",
      strategy: "strategy",
      skill: "skill_improvement",
      skill_improvement: "skill_improvement",
    };

    return typeMap[type?.toLowerCase() ?? ""] ?? "follow_up";
  }

  // ============================================================
  // Talk Track Parsing
  // ============================================================

  /**
   * 解析話術
   * @param llmOutput - LLM 輸出文本
   * @returns 解析結果
   */
  parseTalkTracks(llmOutput: string): ParseResult<TalkTrack> {
    const errors: string[] = [];
    const talkTracks: TalkTrack[] = [];

    try {
      const jsonData = extractJSON<{
        talkTracks?: RawTalkTrack[];
        talk_tracks?: RawTalkTrack[];
      }>(llmOutput);

      const rawTracks = jsonData?.talkTracks ?? jsonData?.talk_tracks;

      if (rawTracks) {
        for (const raw of rawTracks) {
          const track = this.transformTalkTrack(raw);
          if (track) {
            talkTracks.push(track);
          } else {
            errors.push(`Invalid talk track: ${JSON.stringify(raw)}`);
          }
        }
      } else {
        // 嘗試文本解析
        const textTracks = this.parseTalkTracksFromText(llmOutput);
        talkTracks.push(...textTracks);
      }
    } catch (error) {
      errors.push(
        `Parse error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (this.options.enableLogging) {
      console.log(`[ResultParser] Parsed ${talkTracks.length} talk tracks`);
    }

    return {
      success: errors.length === 0 || talkTracks.length > 0,
      data: talkTracks,
      errors,
      rawOutput: llmOutput,
    };
  }

  private transformTalkTrack(raw: RawTalkTrack): TalkTrack | null {
    if (!raw.content) {
      return null;
    }

    return {
      id: raw.id ?? `tt-${randomUUID().slice(0, 8)}`,
      situation: this.normalizeTalkTrackSituation(raw.situation),
      content: raw.content,
      context: raw.context ?? "",
      successRate: raw.successRate ?? 0,
      relevanceScore: raw.relevanceScore ?? 50,
    };
  }

  private parseTalkTracksFromText(text: string): TalkTrack[] {
    const talkTracks: TalkTrack[] = [];

    // 尋找引號內的對話內容
    const quotePattern = /["「]([^"」]+)["」]/g;
    let match: RegExpExecArray | null;
    let index = 0;

    while ((match = quotePattern.exec(text)) !== null && index < 5) {
      talkTracks.push({
        id: `tt-${randomUUID().slice(0, 8)}`,
        situation: "要再考慮",
        content: match[1] ?? "",
        context: "",
        successRate: 50,
        relevanceScore: 100 - index * 20,
      });
      index++;
    }

    return talkTracks;
  }

  private normalizeTalkTrackSituation(
    situation?: string
  ): TalkTrack["situation"] {
    const situationMap: Record<string, TalkTrack["situation"]> = {
      價格異議: "價格異議",
      price: "價格異議",
      需要老闆決定: "需要老闆決定",
      boss: "需要老闆決定",
      擔心轉換麻煩: "擔心轉換麻煩",
      switch: "擔心轉換麻煩",
      已有其他系統: "已有其他系統",
      competitor: "已有其他系統",
      要再考慮: "要再考慮",
      think: "要再考慮",
    };

    return situationMap[situation ?? ""] ?? "要再考慮";
  }

  // ============================================================
  // Alert Parsing
  // ============================================================

  /**
   * 解析警示
   * @param llmOutput - LLM 輸出文本
   * @returns 解析結果
   */
  parseAlerts(llmOutput: string): ParseResult<Alert> {
    const errors: string[] = [];
    const alerts: Alert[] = [];

    try {
      const jsonData = extractJSON<{
        alerts?: RawAlert[];
      }>(llmOutput);

      if (jsonData?.alerts) {
        for (const raw of jsonData.alerts) {
          const alert = this.transformAlert(raw);
          if (alert) {
            alerts.push(alert);
          } else {
            errors.push(`Invalid alert: ${JSON.stringify(raw)}`);
          }
        }
      } else {
        // 嘗試文本解析
        const textAlerts = this.parseAlertsFromText(llmOutput);
        alerts.push(...textAlerts);
      }
    } catch (error) {
      errors.push(
        `Parse error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (this.options.enableLogging) {
      console.log(`[ResultParser] Parsed ${alerts.length} alerts`);
    }

    return {
      success: errors.length === 0 || alerts.length > 0,
      data: alerts,
      errors,
      rawOutput: llmOutput,
    };
  }

  private transformAlert(raw: RawAlert): Alert | null {
    if (!raw.message) {
      return null;
    }

    return {
      id: `alert-${randomUUID().slice(0, 8)}`,
      type: this.normalizeAlertType(raw.type),
      severity: this.normalizeAlertSeverity(raw.severity),
      message: raw.message,
      suggestedAction: raw.suggestedAction,
      notifyManager: raw.notifyManager ?? false,
    };
  }

  private parseAlertsFromText(text: string): Alert[] {
    const alerts: Alert[] = [];
    const keywords = [
      { pattern: /立即成交|close now/i, type: "close_now" as const },
      {
        pattern: /缺少決策者|missing.*dm/i,
        type: "missing_decision_maker" as const,
      },
      { pattern: /風險|risk/i, type: "risk" as const },
      { pattern: /機會|opportunity/i, type: "opportunity" as const },
    ];

    for (const { pattern, type } of keywords) {
      if (pattern.test(text)) {
        // 提取包含關鍵字的句子
        const sentences = text.split(/[.。!！?？]/);
        const relevantSentence = sentences.find((s) => pattern.test(s));

        if (relevantSentence) {
          alerts.push({
            id: `alert-${randomUUID().slice(0, 8)}`,
            type,
            severity: type === "close_now" ? "critical" : "high",
            message: relevantSentence.trim(),
            notifyManager: type === "close_now",
          });
        }
      }
    }

    return alerts;
  }

  private normalizeAlertType(type?: string): Alert["type"] {
    const typeMap: Record<string, Alert["type"]> = {
      close_now: "close_now",
      missing_decision_maker: "missing_decision_maker",
      missing_dm: "missing_decision_maker",
      risk: "risk",
      opportunity: "opportunity",
      excellent_performance: "excellent_performance",
    };

    return typeMap[type?.toLowerCase() ?? ""] ?? "risk";
  }

  private normalizeAlertSeverity(severity?: string): Alert["severity"] {
    const severityMap: Record<string, Alert["severity"]> = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
    };

    return severityMap[severity?.toLowerCase() ?? ""] ?? "medium";
  }

  // ============================================================
  // Follow-up Parsing
  // ============================================================

  /**
   * 解析跟進項目
   * @param llmOutput - LLM 輸出文本
   * @returns 解析結果
   */
  parseFollowUps(llmOutput: string): ParseResult<FollowUp> {
    const errors: string[] = [];
    const followUps: FollowUp[] = [];

    try {
      const jsonData = extractJSON<{
        followUps?: RawFollowUp[];
        follow_ups?: RawFollowUp[];
      }>(llmOutput);

      const rawFollowUps = jsonData?.followUps ?? jsonData?.follow_ups;

      if (rawFollowUps) {
        for (const raw of rawFollowUps) {
          const followUp = this.transformFollowUp(raw);
          if (followUp) {
            followUps.push(followUp);
          } else {
            errors.push(`Invalid follow-up: ${JSON.stringify(raw)}`);
          }
        }
      } else {
        // 嘗試文本解析
        const textFollowUps = this.parseFollowUpsFromText(llmOutput);
        followUps.push(...textFollowUps);
      }
    } catch (error) {
      errors.push(
        `Parse error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (this.options.enableLogging) {
      console.log(`[ResultParser] Parsed ${followUps.length} follow-ups`);
    }

    return {
      success: errors.length === 0 || followUps.length > 0,
      data: followUps,
      errors,
      rawOutput: llmOutput,
    };
  }

  private transformFollowUp(raw: RawFollowUp): FollowUp | null {
    if (!raw.action) {
      return null;
    }

    return {
      id: `fu-${randomUUID().slice(0, 8)}`,
      action: raw.action,
      owner: this.normalizeOwner(raw.owner),
      deadline: raw.deadline ? new Date(raw.deadline) : undefined,
      priority: this.normalizePriority(raw.priority) as FollowUp["priority"],
      status: "pending",
      context: raw.context,
    };
  }

  private parseFollowUpsFromText(text: string): FollowUp[] {
    const followUps: FollowUp[] = [];

    // 尋找待辦事項格式
    const todoPattern = /(?:^|\n)(?:[-*□☐]|\d+\.)\s*([^\n]+)/g;
    let match: RegExpExecArray | null;

    while ((match = todoPattern.exec(text)) !== null && followUps.length < 10) {
      const action = match[1]?.trim();
      if (action && action.length > 5) {
        followUps.push({
          id: `fu-${randomUUID().slice(0, 8)}`,
          action,
          owner: "rep",
          priority: "medium",
          status: "pending",
        });
      }
    }

    return followUps;
  }

  private normalizeOwner(owner?: string): FollowUp["owner"] {
    const ownerMap: Record<string, FollowUp["owner"]> = {
      rep: "rep",
      sales: "rep",
      customer: "customer",
      client: "customer",
      manager: "manager",
    };

    return ownerMap[owner?.toLowerCase() ?? ""] ?? "rep";
  }

  private normalizePriority(
    priority?: string
  ): "critical" | "high" | "medium" | "low" {
    const priorityMap: Record<string, "critical" | "high" | "medium" | "low"> =
      {
        critical: "critical",
        high: "high",
        medium: "medium",
        low: "low",
      };

    return (
      priorityMap[priority?.toLowerCase() ?? ""] ?? this.options.defaultPriority
    );
  }

  // ============================================================
  // Batch Parsing
  // ============================================================

  /**
   * 一次解析所有類型
   * @param llmOutput - LLM 輸出文本
   * @returns 所有類型的解析結果
   */
  parseAll(llmOutput: string): {
    recommendations: ParseResult<Recommendation>;
    talkTracks: ParseResult<TalkTrack>;
    alerts: ParseResult<Alert>;
    followUps: ParseResult<FollowUp>;
  } {
    return {
      recommendations: this.parseRecommendations(llmOutput),
      talkTracks: this.parseTalkTracks(llmOutput),
      alerts: this.parseAlerts(llmOutput),
      followUps: this.parseFollowUps(llmOutput),
    };
  }
}

// ============================================================
// Raw Types (for JSON parsing)
// ============================================================

interface RawRecommendation {
  type?: string;
  priority?: string;
  title?: string;
  description?: string;
  rationale?: string;
  suggestedTiming?: string;
}

interface RawTalkTrack {
  id?: string;
  situation?: string;
  content?: string;
  context?: string;
  successRate?: number;
  relevanceScore?: number;
}

interface RawAlert {
  type?: string;
  severity?: string;
  message?: string;
  suggestedAction?: string;
  notifyManager?: boolean;
}

interface RawFollowUp {
  action?: string;
  owner?: string;
  deadline?: string;
  priority?: string;
  context?: string;
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 建立 Result Parser 實例
 * @param options - 解析選項
 * @returns ResultParser 實例
 */
export function createResultParser(options: ParserOptions = {}): ResultParser {
  return new ResultParser(options);
}
