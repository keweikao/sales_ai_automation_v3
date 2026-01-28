/**
 * Multi-Agent Implementations
 * 將原 Orchestrator 中的 6 個 Agent 包裝成符合 BaseAgent 介面的類別
 */

import { getCompetitorInfo } from "../mcp/tools/get-competitor-info.js";
import type { BaseAgent } from "./base-agent.js";
import type { GeminiClient } from "./gemini.js";
import {
  AGENT1_PROMPT,
  AGENT2_PROMPT,
  AGENT3_PROMPT,
  AGENT4_PROMPT,
  AGENT5_PROMPT,
  AGENT6_PROMPT,
  GLOBAL_CONTEXT_FOR_PRODUCT_LINE,
  type ProductLine,
} from "./prompts.js";
import type {
  Agent1Output,
  Agent2Output,
  Agent3Output,
  Agent4Output,
  Agent5Output,
  Agent6Output,
  AnalysisState,
  TranscriptSegment,
} from "./types.js";

// ============================================================
// Agent Model Configuration
// 核心分析 Agent 使用 Pro 模型，輔助 Agent 使用 Flash 模型
// ============================================================

export const AGENT_MODEL_CONFIG = {
  context: { model: "gemini-2.5-flash", tier: "auxiliary" as const },
  buyer: { model: "gemini-2.5-pro", tier: "core" as const },
  quality_loop: { model: "gemini-2.5-pro", tier: "core" as const },
  seller: { model: "gemini-2.5-pro", tier: "core" as const },
  summary: { model: "gemini-2.5-flash", tier: "auxiliary" as const },
  crm: { model: "gemini-2.5-flash", tier: "auxiliary" as const },
  coach: { model: "gemini-2.5-pro", tier: "core" as const },
} as const;

export type AgentId = keyof typeof AGENT_MODEL_CONFIG;
export type AgentTier = "core" | "auxiliary";

// ============================================================
// Utilities
// ============================================================

function formatTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => {
      const timestamp = formatTime(s.start);
      const speaker = s.speaker || "Speaker";
      return `[${timestamp}] ${speaker}: ${s.text}`;
    })
    .join("\n");
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// ============================================================
// Agent 1: Context Agent
// ============================================================

export class ContextAgent implements BaseAgent {
  readonly id = "context";
  readonly description = "Analyzes meeting background and constraints";

  constructor(private readonly geminiClient: GeminiClient) {}

  async execute(state: AnalysisState): Promise<AnalysisState> {
    const transcriptText = formatTranscript(state.transcript);
    const productLine = (state.metadata?.productLine || "ichef") as ProductLine;

    const prompt = `${GLOBAL_CONTEXT_FOR_PRODUCT_LINE(productLine)}\n\n${AGENT1_PROMPT()}\n\n## Meeting Transcript:\n${transcriptText}\n\n## Metadata:\n${JSON.stringify(state.metadata, null, 2)}`;

    const response = await this.geminiClient.generateJSON<Agent1Output>(
      prompt,
      { model: AGENT_MODEL_CONFIG.context.model }
    );

    return {
      ...state,
      contextData: response,
    };
  }
}

// ============================================================
// Agent 2: Buyer Agent (MEDDIC Core)
// ============================================================

export class BuyerAgent implements BaseAgent {
  readonly id = "buyer";
  readonly description =
    "Analyzes six MEDDIC dimensions (most important agent)";

  constructor(private readonly geminiClient: GeminiClient) {}

  async execute(state: AnalysisState): Promise<AnalysisState> {
    const transcriptText = formatTranscript(state.transcript);
    const productLine = (state.metadata?.productLine || "ichef") as ProductLine;

    const prompt = `${GLOBAL_CONTEXT_FOR_PRODUCT_LINE(productLine)}\n\n${AGENT2_PROMPT()}\n\n## Meeting Transcript:\n${transcriptText}`;

    const response = await this.geminiClient.generateJSON<Agent2Output>(
      prompt,
      { model: AGENT_MODEL_CONFIG.buyer.model }
    );

    // 【新增】如果偵測到競品，查詢詳細資訊
    if (
      response.detected_competitors &&
      response.detected_competitors.length > 0
    ) {
      console.log(
        `[Agent 2] 偵測到 ${response.detected_competitors.length} 個競品，查詢詳細資訊...`
      );

      const enrichedCompetitors = await Promise.all(
        response.detected_competitors.map(async (competitor) => {
          try {
            const details = await getCompetitorInfo({
              competitorName: competitor.name,
            });

            if (details.found) {
              console.log(`[Agent 2] ✅ 找到競品資訊: ${competitor.name}`);
              return {
                ...competitor,
                details: details.competitor,
              };
            }
            console.log(
              `[Agent 2] ⚠️  資料庫中沒有競品資訊: ${competitor.name}`
            );
            return {
              ...competitor,
              details: null,
            };
          } catch (error) {
            console.error(
              `[Agent 2] ❌ 查詢競品資訊失敗: ${competitor.name}`,
              error
            );
            return {
              ...competitor,
              details: null,
            };
          }
        })
      );

      response.detected_competitors =
        enrichedCompetitors as typeof response.detected_competitors;
    }

    return {
      ...state,
      buyerData: response,
    };
  }
}

// ============================================================
// Agent 2.5: Quality Loop Refiner (Special Agent)
// ============================================================

export class QualityLoopAgent implements BaseAgent {
  readonly id = "quality_loop";
  readonly description = "Refines buyer analysis through quality feedback";

  constructor(private readonly geminiClient: GeminiClient) {}

  async execute(state: AnalysisState): Promise<AnalysisState> {
    if (!state.buyerData) {
      throw new Error("BuyerData is required for quality loop refinement");
    }

    const transcriptText = formatTranscript(state.transcript);
    const previousAnalysis = JSON.stringify(state.buyerData, null, 2);
    const productLine = (state.metadata?.productLine || "ichef") as ProductLine;

    const prompt =
      `${GLOBAL_CONTEXT_FOR_PRODUCT_LINE(productLine)}\n\n${AGENT2_PROMPT()}\n\n` +
      `## Previous Analysis (needs improvement):\n${previousAnalysis}\n\n` +
      `## Meeting Transcript:\n${transcriptText}\n\n` +
      "IMPORTANT: The previous analysis was incomplete. Please provide more specific evidence, identify pain points more clearly, and ensure all MEDDIC scores are justified.";

    const response = await this.geminiClient.generateJSON<Agent2Output>(
      prompt,
      { model: AGENT_MODEL_CONFIG.quality_loop.model }
    );

    return {
      ...state,
      buyerData: response,
      refinementCount: state.refinementCount + 1,
    };
  }
}

// ============================================================
// Agent 3: Seller Agent
// ============================================================

export class SellerAgent implements BaseAgent {
  readonly id = "seller";
  readonly description = "Analyzes sales performance and strategy";

  constructor(private readonly geminiClient: GeminiClient) {}

  async execute(state: AnalysisState): Promise<AnalysisState> {
    const transcriptText = formatTranscript(state.transcript);
    const buyerInsights = JSON.stringify(state.buyerData, null, 2);
    const productLine = (state.metadata?.productLine || "ichef") as ProductLine;

    const prompt =
      `${GLOBAL_CONTEXT_FOR_PRODUCT_LINE(productLine)}\n\n${AGENT3_PROMPT()}\n\n` +
      `## Buyer Analysis:\n${buyerInsights}\n\n` +
      `## Meeting Transcript:\n${transcriptText}`;

    const response = await this.geminiClient.generateJSON<Agent3Output>(
      prompt,
      { model: AGENT_MODEL_CONFIG.seller.model }
    );

    return {
      ...state,
      sellerData: response,
    };
  }
}

// ============================================================
// Agent 4: Summary Agent
// ============================================================

export class SummaryAgent implements BaseAgent {
  readonly id = "summary";
  readonly description = "Generates customer-oriented meeting summary";

  constructor(private readonly geminiClient: GeminiClient) {}

  async execute(state: AnalysisState): Promise<AnalysisState> {
    const transcriptText = formatTranscript(state.transcript);
    const contextData = JSON.stringify(state.contextData, null, 2);
    const buyerData = JSON.stringify(state.buyerData, null, 2);
    const sellerData = JSON.stringify(state.sellerData, null, 2);
    const productLine = (state.metadata?.productLine || "ichef") as ProductLine;

    const prompt =
      `${GLOBAL_CONTEXT_FOR_PRODUCT_LINE(productLine)}\n\n${AGENT4_PROMPT()}\n\n` +
      `## Context Analysis:\n${contextData}\n\n` +
      `## Buyer Analysis:\n${buyerData}\n\n` +
      `## Seller Analysis:\n${sellerData}\n\n` +
      `## Meeting Transcript:\n${transcriptText}`;

    const response = await this.geminiClient.generateJSON<Agent4Output>(
      prompt,
      { model: AGENT_MODEL_CONFIG.summary.model }
    );

    return {
      ...state,
      summaryData: response,
    };
  }
}

// ============================================================
// Agent 5: CRM Extractor
// ============================================================

export class CRMAgent implements BaseAgent {
  readonly id = "crm";
  readonly description = "Extracts structured data for CRM/Salesforce";

  constructor(private readonly geminiClient: GeminiClient) {}

  async execute(state: AnalysisState): Promise<AnalysisState> {
    const transcriptText = formatTranscript(state.transcript);
    const contextData = JSON.stringify(state.contextData, null, 2);
    const buyerData = JSON.stringify(state.buyerData, null, 2);
    const productLine = (state.metadata?.productLine || "ichef") as ProductLine;

    const prompt =
      `${GLOBAL_CONTEXT_FOR_PRODUCT_LINE(productLine)}\n\n${AGENT5_PROMPT()}\n\n` +
      `## Context Analysis:\n${contextData}\n\n` +
      `## Buyer Analysis:\n${buyerData}\n\n` +
      `## Meeting Transcript:\n${transcriptText}`;

    const response = await this.geminiClient.generateJSON<Agent5Output>(
      prompt,
      { model: AGENT_MODEL_CONFIG.crm.model }
    );

    return {
      ...state,
      crmData: response,
    };
  }
}

// ============================================================
// Agent 6: Coach Agent
// ============================================================

export class CoachAgent implements BaseAgent {
  readonly id = "coach";
  readonly description = "Provides real-time coaching and alerts";

  constructor(private readonly geminiClient: GeminiClient) {}

  async execute(state: AnalysisState): Promise<AnalysisState> {
    const transcriptText = formatTranscript(state.transcript);
    const buyerData = JSON.stringify(state.buyerData, null, 2);
    const sellerData = JSON.stringify(state.sellerData, null, 2);
    const productLine = (state.metadata?.productLine || "ichef") as ProductLine;

    // 【新增】檢查是否有競品資訊，並注入到 Prompt 中
    let competitorContext = "";
    const competitors = state.buyerData?.detected_competitors || [];

    if (competitors.length > 0) {
      console.log(
        `[Agent 6] 注入 ${competitors.length} 個競品的知識庫參考資訊`
      );

      competitorContext = "\n\n## 競品知識庫參考資訊\n\n";
      competitorContext +=
        "以下是競品資料庫中的資訊，請參考這些資訊來評估業務的競品應對表現：\n\n";

      for (const comp of competitors) {
        if (comp.details) {
          competitorContext += `### ${comp.name}\n\n`;
          competitorContext += `**我方優勢**（相對於 ${comp.name}）：\n`;
          comp.details.ourAdvantages.slice(0, 5).forEach((adv) => {
            competitorContext += `- ${adv}\n`;
          });

          competitorContext += `\n**建議話術**（針對 ${comp.name}）：\n`;
          comp.details.counterTalkTracks.slice(0, 3).forEach((track, idx) => {
            competitorContext += `${idx + 1}. ${track}\n`;
          });

          competitorContext += "\n";
        }
      }
    }

    const prompt =
      `${GLOBAL_CONTEXT_FOR_PRODUCT_LINE(productLine)}\n\n${AGENT6_PROMPT()}\n\n` +
      `${competitorContext}` +
      `## Buyer Analysis:\n${buyerData}\n\n` +
      `## Seller Analysis:\n${sellerData}\n\n` +
      `## Meeting Transcript:\n${transcriptText}`;

    const response = await this.geminiClient.generateJSON<Agent6Output>(
      prompt,
      { model: AGENT_MODEL_CONFIG.coach.model }
    );

    return {
      ...state,
      coachData: response,
    };
  }
}

// ============================================================
// Agent Factory Functions
// ============================================================

export function createContextAgent(geminiClient: GeminiClient): ContextAgent {
  return new ContextAgent(geminiClient);
}

export function createBuyerAgent(geminiClient: GeminiClient): BuyerAgent {
  return new BuyerAgent(geminiClient);
}

export function createQualityLoopAgent(
  geminiClient: GeminiClient
): QualityLoopAgent {
  return new QualityLoopAgent(geminiClient);
}

export function createSellerAgent(geminiClient: GeminiClient): SellerAgent {
  return new SellerAgent(geminiClient);
}

export function createSummaryAgent(geminiClient: GeminiClient): SummaryAgent {
  return new SummaryAgent(geminiClient);
}

export function createCRMAgent(geminiClient: GeminiClient): CRMAgent {
  return new CRMAgent(geminiClient);
}

export function createCoachAgent(geminiClient: GeminiClient): CoachAgent {
  return new CoachAgent(geminiClient);
}
