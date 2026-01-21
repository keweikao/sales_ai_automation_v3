/**
 * Multi-Agent Implementations
 * 將原 Orchestrator 中的 6 個 Agent 包裝成符合 BaseAgent 介面的類別
 */

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

    const response = await this.geminiClient.generateJSON<Agent1Output>(prompt);

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

    const response = await this.geminiClient.generateJSON<Agent2Output>(prompt);

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

    const response = await this.geminiClient.generateJSON<Agent2Output>(prompt);

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

    const response = await this.geminiClient.generateJSON<Agent3Output>(prompt);

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

    const response = await this.geminiClient.generateJSON<Agent4Output>(prompt);

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

    const response = await this.geminiClient.generateJSON<Agent5Output>(prompt);

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

    const prompt =
      `${GLOBAL_CONTEXT_FOR_PRODUCT_LINE(productLine)}\n\n${AGENT6_PROMPT()}\n\n` +
      `## Buyer Analysis:\n${buyerData}\n\n` +
      `## Seller Analysis:\n${sellerData}\n\n` +
      `## Meeting Transcript:\n${transcriptText}`;

    const response = await this.geminiClient.generateJSON<Agent6Output>(prompt);

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
