/**
 * Sales Coach Agent
 * 銷售教練 Agent - 整合 LLM 和 MCP Tools 提供即時銷售輔導
 */

import type { Database } from "@Sales_ai_automation_v3/db";
import type { TalkTrackSituation } from "@Sales_ai_automation_v3/db/schema";
import { randomUUID } from "node:crypto";
import type { GeminiClient } from "../llm/gemini.js";
import {
  createGetTalkTracksTool,
  type GetTalkTracksTool,
} from "../mcp/tools/get-talk-tracks.js";
import {
  createQuerySimilarCasesTool,
  type QuerySimilarCasesTool,
} from "../mcp/tools/query-similar-cases.js";
import type {
  AgentMetrics,
  Alert,
  CoachingSummary,
  FollowUp,
  MeddicAnalysis,
  Recommendation,
  SalesCoachAgentConfig,
  SalesCoachInput,
  SalesCoachOutput,
  ScenarioContext,
  ScenarioHandler,
} from "./types.js";

// ============================================================
// Prompts
// ============================================================

const SALES_COACH_SYSTEM_PROMPT = `你是一位專業的銷售教練 AI，專門協助 POS 系統銷售團隊提升業績。

你的角色：
- 分析銷售對話，識別成功模式和改進機會
- 根據 MEDDIC 框架評估商機品質
- 提供即時、可行的銷售建議
- 推薦適合的話術和策略

MEDDIC 評估維度：
- Metrics (量化指標): 客戶是否有明確的成功指標？
- Economic Buyer (經濟買家): 決策者是否已識別和接觸？
- Decision Criteria (決策標準): 了解客戶的評估標準嗎？
- Decision Process (決策流程): 清楚整個採購流程嗎？
- Identify Pain (識別痛點): 客戶的核心痛點是什麼？
- Champion (內部支持者): 有沒有客戶方的支持者？

輸出格式要求：
- 使用繁體中文回覆
- 提供具體、可執行的建議
- 優先關注最關鍵的行動項目
- 保持專業但友善的語調`;

const ANALYSIS_PROMPT = `請分析以下銷售對話並提供教練建議。

## 對話資訊
- 商機 ID: {opportunityId}
- 對話類型: {conversationType}
- 店家名稱: {storeName}
- 對話日期: {conversationDate}

## 對話內容
{transcript}

請提供以下分析（以 JSON 格式回覆）：

1. MEDDIC 分析
   - 各維度評分 (1-5)
   - 整體評分 (0-100)
   - 發現的缺口和優勢

2. 建議行動
   - 類型：immediate_action/follow_up/strategy/skill_improvement
   - 優先級：critical/high/medium/low
   - 具體內容和理由

3. 警示
   - 是否有需要立即關注的風險或機會
   - 是否需要通知主管

4. 跟進事項
   - 待辦事項清單
   - 負責人和期限

5. 總結
   - 執行摘要
   - 客戶情緒
   - 商機健康度

JSON 結構：
{
  "meddic": {
    "scores": { "metrics": 1-5, "economicBuyer": 1-5, ... },
    "overallScore": 0-100,
    "gaps": ["缺口1", "缺口2"],
    "strengths": ["優勢1", "優勢2"]
  },
  "recommendations": [
    { "type": "...", "priority": "...", "title": "...", "description": "...", "rationale": "..." }
  ],
  "alerts": [
    { "type": "...", "severity": "...", "message": "...", "notifyManager": true/false }
  ],
  "followUps": [
    { "action": "...", "owner": "rep/customer/manager", "priority": "...", "deadline": "YYYY-MM-DD" }
  ],
  "summary": {
    "executiveSummary": "...",
    "keyWins": ["...", "..."],
    "areasForImprovement": ["...", "..."],
    "nextBestActions": ["...", "..."],
    "customerSentiment": "positive/neutral/negative",
    "dealHealth": "healthy/at_risk/critical"
  }
}`;

// ============================================================
// Sales Coach Agent Class
// ============================================================

export class SalesCoachAgent {
  private readonly geminiClient: GeminiClient;
  private readonly config: Required<SalesCoachAgentConfig>;

  // MCP Tools
  private readonly querySimilarCasesTool: QuerySimilarCasesTool;
  private readonly getTalkTracksTool: GetTalkTracksTool;

  // Scenario Handlers
  private readonly scenarioHandlers: Map<string, ScenarioHandler> = new Map();

  // Metrics
  private metrics: AgentMetrics = {
    totalExecutionTime: 0,
    llmCallCount: 0,
    toolCallCount: 0,
  };

  constructor(
    geminiClient: GeminiClient,
    db: Database,
    config: SalesCoachAgentConfig = {}
  ) {
    this.geminiClient = geminiClient;
    this.db = db;
    this.config = {
      verbose: config.verbose ?? false,
      maxRecommendations: config.maxRecommendations ?? 5,
      maxTalkTracks: config.maxTalkTracks ?? 3,
      alertThreshold: config.alertThreshold ?? 40,
      enableManagerNotifications: config.enableManagerNotifications ?? true,
    };

    // Initialize tools
    this.querySimilarCasesTool = createQuerySimilarCasesTool(db);
    this.getTalkTracksTool = createGetTalkTracksTool(db);
  }

  /**
   * Register a scenario handler
   */
  registerScenarioHandler(handler: ScenarioHandler): void {
    this.scenarioHandlers.set(handler.type, handler);
    if (this.config.verbose) {
      console.log(
        `[SalesCoachAgent] Registered scenario handler: ${handler.type}`
      );
    }
  }

  /**
   * Main execution entry point
   */
  async execute(input: SalesCoachInput): Promise<SalesCoachOutput> {
    const startTime = Date.now();
    this.resetMetrics();

    if (this.config.verbose) {
      console.log(
        `[SalesCoachAgent] Starting analysis for conversation: ${input.conversationId}`
      );
    }

    try {
      // Step 1: Run LLM analysis
      const analysisResult = await this.runLLMAnalysis(input);

      // Step 2: Detect scenario and get context
      const scenarioContext = this.detectScenario(input, analysisResult);

      // Step 3: Enrich with MCP tools
      const enrichedResult = await this.enrichWithTools(
        input,
        analysisResult,
        scenarioContext
      );

      // Step 4: Apply scenario-specific enhancements
      const finalResult = this.applyScenarioEnhancements(
        enrichedResult,
        scenarioContext
      );

      // Update metrics
      this.metrics.totalExecutionTime = Date.now() - startTime;

      if (this.config.verbose) {
        console.log(
          `[SalesCoachAgent] Analysis completed in ${this.metrics.totalExecutionTime}ms`
        );
        console.log(
          `[SalesCoachAgent] LLM calls: ${this.metrics.llmCallCount}, Tool calls: ${this.metrics.toolCallCount}`
        );
      }

      return finalResult;
    } catch (error) {
      console.error("[SalesCoachAgent] Execution failed:", error);
      throw error;
    }
  }

  /**
   * Run LLM analysis on the conversation
   */
  private async runLLMAnalysis(
    input: SalesCoachInput
  ): Promise<SalesCoachOutput> {
    const transcriptText = this.formatTranscript(input.transcript);

    const prompt = ANALYSIS_PROMPT.replace(
      "{opportunityId}",
      input.metadata.opportunityId
    )
      .replace("{conversationType}", input.metadata.conversationType)
      .replace("{storeName}", input.metadata.storeName ?? "未知")
      .replace(
        "{conversationDate}",
        input.metadata.conversationDate.toISOString()
      )
      .replace("{transcript}", transcriptText);

    this.metrics.llmCallCount++;

    const response = await this.geminiClient.generateJSON<LLMAnalysisResponse>(
      `${SALES_COACH_SYSTEM_PROMPT}\n\n${prompt}`
    );

    return this.transformLLMResponse(response, input);
  }

  /**
   * Transform LLM response to SalesCoachOutput
   */
  private transformLLMResponse(
    response: LLMAnalysisResponse,
    _input: SalesCoachInput
  ): SalesCoachOutput {
    const analysis: MeddicAnalysis = {
      scores: {
        metrics: response.meddic.scores.metrics,
        economicBuyer: response.meddic.scores.economicBuyer,
        decisionCriteria: response.meddic.scores.decisionCriteria,
        decisionProcess: response.meddic.scores.decisionProcess,
        identifyPain: response.meddic.scores.identifyPain,
        champion: response.meddic.scores.champion,
      },
      overallScore: response.meddic.overallScore,
      qualificationStatus: this.getQualificationStatus(
        response.meddic.overallScore
      ),
      dimensions: this.buildDimensionsAnalysis(response.meddic),
      gaps: response.meddic.gaps,
      strengths: response.meddic.strengths,
    };

    const recommendations: Recommendation[] = response.recommendations.map(
      (r, _index) => ({
        id: `rec-${randomUUID().slice(0, 8)}`,
        type: r.type as Recommendation["type"],
        priority: r.priority as Recommendation["priority"],
        title: r.title,
        description: r.description,
        rationale: r.rationale,
        suggestedTiming: r.suggestedTiming,
      })
    );

    const alerts: Alert[] = response.alerts.map((a) => ({
      id: `alert-${randomUUID().slice(0, 8)}`,
      type: a.type as Alert["type"],
      severity: a.severity as Alert["severity"],
      message: a.message,
      suggestedAction: a.suggestedAction,
      notifyManager: a.notifyManager && this.config.enableManagerNotifications,
    }));

    const followUps: FollowUp[] = response.followUps.map((f) => ({
      id: `fu-${randomUUID().slice(0, 8)}`,
      action: f.action,
      owner: f.owner as FollowUp["owner"],
      deadline: f.deadline ? new Date(f.deadline) : undefined,
      priority: f.priority as FollowUp["priority"],
      status: "pending",
      context: f.context,
    }));

    const summary: CoachingSummary = {
      executiveSummary: response.summary.executiveSummary,
      keyWins: response.summary.keyWins,
      areasForImprovement: response.summary.areasForImprovement,
      nextBestActions: response.summary.nextBestActions,
      customerSentiment: response.summary
        .customerSentiment as CoachingSummary["customerSentiment"],
      dealHealth: response.summary.dealHealth as CoachingSummary["dealHealth"],
    };

    return {
      analysis,
      recommendations: recommendations.slice(0, this.config.maxRecommendations),
      talkTracks: [], // Will be enriched by tools
      alerts,
      followUps,
      summary,
      processedAt: new Date(),
    };
  }

  /**
   * Detect applicable scenario
   */
  private detectScenario(
    input: SalesCoachInput,
    output: SalesCoachOutput
  ): ScenarioContext {
    const context: ScenarioContext = {
      scenarioType: "post_demo", // Default
      specificConcerns: [],
      competitorMentioned: false,
      priceDiscussed: false,
      decisionMakerPresent: false,
    };

    // Analyze transcript for scenario detection
    const fullText = input.transcript.map((t) => t.text).join(" ");

    // Detect scenario type based on conversation content
    if (input.metadata.conversationType === "demo") {
      context.scenarioType = "post_demo";
    } else if (
      fullText.includes("價格") ||
      fullText.includes("費用") ||
      fullText.includes("多少錢")
    ) {
      context.scenarioType = "price_negotiation";
      context.priceDiscussed = true;
    } else if (
      fullText.includes("競爭") ||
      fullText.includes("其他系統") ||
      fullText.includes("別家")
    ) {
      context.scenarioType = "competitor_handling";
      context.competitorMentioned = true;
    } else if (
      fullText.includes("老闆") ||
      fullText.includes("主管") ||
      fullText.includes("決定")
    ) {
      context.scenarioType = "decision_maker_engagement";
    }

    // Detect customer type
    if (
      fullText.includes("馬上") ||
      fullText.includes("立刻") ||
      fullText.includes("趕快")
    ) {
      context.customerType = "衝動型";
    } else if (
      fullText.includes("計算") ||
      fullText.includes("報價") ||
      fullText.includes("比較")
    ) {
      context.customerType = "精算型";
    } else if (
      fullText.includes("考慮") ||
      fullText.includes("再看看") ||
      fullText.includes("不急")
    ) {
      context.customerType = "保守觀望型";
    }

    // Extract specific concerns from alerts and analysis
    if (output.analysis.gaps.length > 0) {
      context.specificConcerns = output.analysis.gaps.slice(0, 3);
    }

    return context;
  }

  /**
   * Enrich output with MCP tool results
   */
  private async enrichWithTools(
    input: SalesCoachInput,
    output: SalesCoachOutput,
    context: ScenarioContext
  ): Promise<SalesCoachOutput> {
    const enrichedOutput = { ...output };

    // Get similar cases if customer type is identified
    if (context.customerType && context.specificConcerns?.length) {
      try {
        this.metrics.toolCallCount++;
        const similarCases = await this.querySimilarCasesTool.execute({
          customerType: context.customerType,
          concern: context.specificConcerns[0],
          storeType: input.metadata.storeType,
        });

        // Add insights from similar cases to recommendations
        if (similarCases.cases.length > 0) {
          const wonCases = similarCases.cases.filter(
            (c) => c.outcome === "won"
          );
          if (wonCases.length > 0) {
            enrichedOutput.recommendations.push({
              id: `rec-similar-${randomUUID().slice(0, 8)}`,
              type: "strategy",
              priority: "high",
              title: "參考類似成功案例",
              description: `發現 ${wonCases.length} 個類似客戶的成功案例，成功率 ${similarCases.successRate}%`,
              rationale: `最佳案例策略：${wonCases[0].winningTactic}`,
            });
          }
        }
      } catch (error) {
        console.error(
          "[SalesCoachAgent] Failed to query similar cases:",
          error
        );
      }
    }

    // Get relevant talk tracks
    const situation = this.mapToTalkTrackSituation(context);
    if (situation) {
      try {
        this.metrics.toolCallCount++;
        const talkTracksResult = await this.getTalkTracksTool.execute({
          situation,
          customerType: context.customerType,
        });

        enrichedOutput.talkTracks = talkTracksResult.talkTracks
          .slice(0, this.config.maxTalkTracks)
          .map((t, index) => ({
            id: t.id,
            situation,
            content: t.content,
            context: t.context,
            successRate: t.successRate,
            relevanceScore: 100 - index * 10, // Simple relevance scoring
          }));

        // Add best practice to summary
        if (talkTracksResult.bestPractice) {
          enrichedOutput.summary.nextBestActions.push(
            talkTracksResult.bestPractice
          );
        }
      } catch (error) {
        console.error("[SalesCoachAgent] Failed to get talk tracks:", error);
      }
    }

    return enrichedOutput;
  }

  /**
   * Apply scenario-specific enhancements
   */
  private applyScenarioEnhancements(
    output: SalesCoachOutput,
    context: ScenarioContext
  ): SalesCoachOutput {
    const handler = this.scenarioHandlers.get(context.scenarioType);
    if (handler) {
      return handler.enhance(output, context);
    }
    return output;
  }

  /**
   * Map scenario context to talk track situation
   */
  private mapToTalkTrackSituation(
    context: ScenarioContext
  ): TalkTrackSituation | null {
    switch (context.scenarioType) {
      case "price_negotiation":
        return "價格異議";
      case "decision_maker_engagement":
        return "需要老闆決定";
      case "competitor_handling":
        return "已有其他系統";
      default:
        if (
          context.specificConcerns?.some(
            (c) => c.includes("轉換") || c.includes("麻煩")
          )
        ) {
          return "擔心轉換麻煩";
        }
        return "要再考慮";
    }
  }

  /**
   * Get qualification status from score
   */
  private getQualificationStatus(
    score: number
  ): MeddicAnalysis["qualificationStatus"] {
    if (score >= 70) {
      return "Strong";
    }
    if (score >= 50) {
      return "Medium";
    }
    if (score >= 30) {
      return "Weak";
    }
    return "At Risk";
  }

  /**
   * Build dimensions analysis from MEDDIC scores
   */
  private buildDimensionsAnalysis(meddic: LLMAnalysisResponse["meddic"]) {
    const buildDimension = (
      _score: number,
      gaps: string[],
      strengths: string[]
    ) => ({
      evidence: strengths.filter((s) => s.length > 0),
      gaps: gaps.filter((g) => g.length > 0),
      recommendations: [],
    });

    return {
      metrics: buildDimension(
        meddic.scores.metrics,
        meddic.gaps,
        meddic.strengths
      ),
      economicBuyer: buildDimension(
        meddic.scores.economicBuyer,
        meddic.gaps,
        meddic.strengths
      ),
      decisionCriteria: buildDimension(
        meddic.scores.decisionCriteria,
        meddic.gaps,
        meddic.strengths
      ),
      decisionProcess: buildDimension(
        meddic.scores.decisionProcess,
        meddic.gaps,
        meddic.strengths
      ),
      identifyPain: buildDimension(
        meddic.scores.identifyPain,
        meddic.gaps,
        meddic.strengths
      ),
      champion: buildDimension(
        meddic.scores.champion,
        meddic.gaps,
        meddic.strengths
      ),
    };
  }

  /**
   * Format transcript for prompt
   */
  private formatTranscript(segments: SalesCoachInput["transcript"]): string {
    return segments
      .map((s) => {
        const timestamp = this.formatTime(s.start);
        const speaker = s.speaker || "Speaker";
        return `[${timestamp}] ${speaker}: ${s.text}`;
      })
      .join("\n");
  }

  /**
   * Format seconds to MM:SS
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * Reset metrics for new execution
   */
  private resetMetrics(): void {
    this.metrics = {
      totalExecutionTime: 0,
      llmCallCount: 0,
      toolCallCount: 0,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }
}

// ============================================================
// LLM Response Types (internal)
// ============================================================

interface LLMAnalysisResponse {
  meddic: {
    scores: {
      metrics: number;
      economicBuyer: number;
      decisionCriteria: number;
      decisionProcess: number;
      identifyPain: number;
      champion: number;
    };
    overallScore: number;
    gaps: string[];
    strengths: string[];
  };
  recommendations: Array<{
    type: string;
    priority: string;
    title: string;
    description: string;
    rationale: string;
    suggestedTiming?: string;
  }>;
  alerts: Array<{
    type: string;
    severity: string;
    message: string;
    suggestedAction?: string;
    notifyManager: boolean;
  }>;
  followUps: Array<{
    action: string;
    owner: string;
    priority: string;
    deadline?: string;
    context?: string;
  }>;
  summary: {
    executiveSummary: string;
    keyWins: string[];
    areasForImprovement: string[];
    nextBestActions: string[];
    customerSentiment: string;
    dealHealth: string;
  };
}

// ============================================================
// Factory Function
// ============================================================

export function createSalesCoachAgent(
  geminiClient: GeminiClient,
  db: Database,
  config?: SalesCoachAgentConfig
): SalesCoachAgent {
  return new SalesCoachAgent(geminiClient, db, config);
}
