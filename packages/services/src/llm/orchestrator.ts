/**
 * Multi-Agent MEDDIC Orchestrator
 * Ported from V2: modules/03-sales-conversation/transcript_analyzer/orchestrator.py
 *
 * Seven-Phase Execution Flow (V2 logic - DO NOT MODIFY):
 * - Phase 1: Parallel execution (Context + Buyer)
 * - Phase 2: Quality Loop (max 2 refinements)
 * - Phase 3: Conditional competitor analysis
 * - Phase 4-7: Sequential execution (Seller → Summary → CRM → Coach)
 */

import type { GeminiClient } from "./gemini.js";
import {
  AGENT1_PROMPT,
  AGENT2_PROMPT,
  AGENT3_PROMPT,
  AGENT4_PROMPT,
  AGENT5_PROMPT,
  AGENT6_PROMPT,
  GLOBAL_CONTEXT,
} from "./prompts.js";
import type {
  Agent1Output,
  Agent2Output,
  Agent3Output,
  Agent4Output,
  Agent5Output,
  Agent6Output,
  AnalysisMetadata,
  AnalysisResult,
  AnalysisState,
  TranscriptSegment,
} from "./types.js";

export class MeddicOrchestrator {
  private readonly geminiClient: GeminiClient;
  private readonly MAX_REFINEMENTS = 2; // V2 constant
  private readonly COMPETITOR_KEYWORDS = [
    "競爭對手",
    "competitor",
    "其他廠商",
    "POS",
    "別的系統",
    "其他品牌",
  ]; // V2 keywords

  constructor(geminiClient: GeminiClient) {
    this.geminiClient = geminiClient;
  }

  /**
   * Main analysis entry point
   * Executes all 7 phases of the MEDDIC analysis
   */
  async analyze(
    transcript: TranscriptSegment[],
    metadata: AnalysisMetadata
  ): Promise<AnalysisResult> {
    const state: AnalysisState = {
      transcript,
      metadata,
      refinementCount: 0,
      maxRefinements: this.MAX_REFINEMENTS,
      hasCompetitor: false,
    };

    // ==============================================================
    // Phase 1: Parallel execution (Context + Buyer)
    // V2 logic: These agents can run independently
    // ==============================================================
    console.log(
      "[Orchestrator] Phase 1: Running Context + Buyer agents in parallel"
    );

    const [contextData, buyerData] = await Promise.all([
      this.runAgent1(state),
      this.runAgent2(state),
    ]);

    state.contextData = contextData;
    state.buyerData = buyerData;

    // ==============================================================
    // Phase 2: Quality Loop (V2 core logic)
    // If buyer analysis quality is insufficient, refine up to 2 times
    // ==============================================================
    console.log("[Orchestrator] Phase 2: Quality Loop check");

    while (
      !this.isQualityPassed(state.buyerData) &&
      state.refinementCount < state.maxRefinements
    ) {
      console.log(
        `[Orchestrator] Quality not passed. Refinement attempt ${state.refinementCount + 1}/${state.maxRefinements}`
      );

      state.buyerData = await this.refineAgent2(state);
      state.refinementCount++;
    }

    if (!this.isQualityPassed(state.buyerData)) {
      console.warn(
        "[Orchestrator] Quality check failed after max refinements. Proceeding with current analysis."
      );
    }

    // ==============================================================
    // Phase 3: Conditional competitor analysis
    // V2 logic: Detect if competitors were mentioned
    // ==============================================================
    console.log("[Orchestrator] Phase 3: Competitor detection");

    state.hasCompetitor = this.detectCompetitor(state.transcript);
    state.competitorKeywords = this.extractCompetitorKeywords(state.transcript);

    // ==============================================================
    // Phase 4-7: Sequential execution
    // V2 logic: These must run in order as they build on each other
    // ==============================================================
    console.log("[Orchestrator] Phase 4: Seller Agent");
    state.sellerData = await this.runAgent3(state);

    console.log("[Orchestrator] Phase 5: Summary Agent");
    state.summaryData = await this.runAgent4(state);

    console.log("[Orchestrator] Phase 6: CRM Extractor");
    state.crmData = await this.runAgent5(state);

    console.log("[Orchestrator] Phase 7: Coach Agent");
    state.coachData = await this.runAgent6(state);

    // ==============================================================
    // Build final result
    // ==============================================================
    return this.buildResult(state);
  }

  /**
   * Agent 1: Context Agent
   * Analyzes meeting background and constraints
   */
  private async runAgent1(state: AnalysisState): Promise<Agent1Output> {
    const transcriptText = this.formatTranscript(state.transcript);

    const prompt = `${GLOBAL_CONTEXT()}\n\n${AGENT1_PROMPT()}\n\n## Meeting Transcript:\n${transcriptText}\n\n## Metadata:\n${JSON.stringify(state.metadata, null, 2)}`;

    const response = await this.geminiClient.generateJSON<Agent1Output>(prompt);
    return response;
  }

  /**
   * Agent 2: Buyer Agent (MEDDIC Core)
   * Most important agent - analyzes six MEDDIC dimensions
   */
  private async runAgent2(state: AnalysisState): Promise<Agent2Output> {
    const transcriptText = this.formatTranscript(state.transcript);

    const prompt = `${GLOBAL_CONTEXT()}\n\n${AGENT2_PROMPT()}\n\n## Meeting Transcript:\n${transcriptText}`;

    const response = await this.geminiClient.generateJSON<Agent2Output>(prompt);
    return response;
  }

  /**
   * Refine Agent 2 output (Quality Loop)
   * V2 logic: Use feedback to improve buyer analysis
   */
  private async refineAgent2(state: AnalysisState): Promise<Agent2Output> {
    const transcriptText = this.formatTranscript(state.transcript);
    const previousAnalysis = JSON.stringify(state.buyerData, null, 2);

    const prompt =
      `${GLOBAL_CONTEXT()}\n\n${AGENT2_PROMPT()}\n\n` +
      `## Previous Analysis (needs improvement):\n${previousAnalysis}\n\n` +
      `## Meeting Transcript:\n${transcriptText}\n\n` +
      "IMPORTANT: The previous analysis was incomplete. Please provide more specific evidence, identify pain points more clearly, and ensure all MEDDIC scores are justified.";

    const response = await this.geminiClient.generateJSON<Agent2Output>(prompt);
    return response;
  }

  /**
   * Agent 3: Seller Agent
   * Analyzes sales performance and strategy
   */
  private async runAgent3(state: AnalysisState): Promise<Agent3Output> {
    const transcriptText = this.formatTranscript(state.transcript);
    const buyerInsights = JSON.stringify(state.buyerData, null, 2);

    const prompt =
      `${GLOBAL_CONTEXT()}\n\n${AGENT3_PROMPT()}\n\n` +
      `## Buyer Analysis:\n${buyerInsights}\n\n` +
      `## Meeting Transcript:\n${transcriptText}`;

    const response = await this.geminiClient.generateJSON<Agent3Output>(prompt);
    return response;
  }

  /**
   * Agent 4: Summary Agent
   * Generates customer-oriented meeting summary
   */
  private async runAgent4(state: AnalysisState): Promise<Agent4Output> {
    const transcriptText = this.formatTranscript(state.transcript);
    const contextData = JSON.stringify(state.contextData, null, 2);
    const buyerData = JSON.stringify(state.buyerData, null, 2);
    const sellerData = JSON.stringify(state.sellerData, null, 2);

    const prompt =
      `${GLOBAL_CONTEXT()}\n\n${AGENT4_PROMPT()}\n\n` +
      `## Context Analysis:\n${contextData}\n\n` +
      `## Buyer Analysis:\n${buyerData}\n\n` +
      `## Seller Analysis:\n${sellerData}\n\n` +
      `## Meeting Transcript:\n${transcriptText}`;

    const response = await this.geminiClient.generateJSON<Agent4Output>(prompt);
    return response;
  }

  /**
   * Agent 5: CRM Extractor
   * Extracts structured data for CRM/Salesforce
   */
  private async runAgent5(state: AnalysisState): Promise<Agent5Output> {
    const transcriptText = this.formatTranscript(state.transcript);
    const contextData = JSON.stringify(state.contextData, null, 2);
    const buyerData = JSON.stringify(state.buyerData, null, 2);

    const prompt =
      `${GLOBAL_CONTEXT()}\n\n${AGENT5_PROMPT()}\n\n` +
      `## Context Analysis:\n${contextData}\n\n` +
      `## Buyer Analysis:\n${buyerData}\n\n` +
      `## Meeting Transcript:\n${transcriptText}`;

    const response = await this.geminiClient.generateJSON<Agent5Output>(prompt);
    return response;
  }

  /**
   * Agent 6: Coach Agent
   * Real-time coaching and alerts
   */
  private async runAgent6(state: AnalysisState): Promise<Agent6Output> {
    const transcriptText = this.formatTranscript(state.transcript);
    const buyerData = JSON.stringify(state.buyerData, null, 2);
    const sellerData = JSON.stringify(state.sellerData, null, 2);

    const prompt =
      `${GLOBAL_CONTEXT()}\n\n${AGENT6_PROMPT()}\n\n` +
      `## Buyer Analysis:\n${buyerData}\n\n` +
      `## Seller Analysis:\n${sellerData}\n\n` +
      `## Meeting Transcript:\n${transcriptText}`;

    const response = await this.geminiClient.generateJSON<Agent6Output>(prompt);
    return response;
  }

  /**
   * V2 Quality Check Logic (DO NOT MODIFY)
   * Checks if buyer analysis meets minimum quality standards
   */
  private isQualityPassed(buyerData: Agent2Output | undefined): boolean {
    if (!buyerData) {
      return false;
    }

    return (
      buyerData.needsIdentified &&
      buyerData.painPoints &&
      buyerData.painPoints.length > 0 &&
      buyerData.meddicScores !== undefined &&
      buyerData.trustAssessment !== undefined
    );
  }

  /**
   * V2 Competitor Detection Logic
   * Returns true if any competitor keywords are found
   */
  private detectCompetitor(transcript: TranscriptSegment[]): boolean {
    const fullText = transcript.map((t) => t.text).join(" ");
    return this.COMPETITOR_KEYWORDS.some((keyword) =>
      fullText.includes(keyword)
    );
  }

  /**
   * Extract which competitor keywords were mentioned
   */
  private extractCompetitorKeywords(transcript: TranscriptSegment[]): string[] {
    const fullText = transcript.map((t) => t.text).join(" ");
    return this.COMPETITOR_KEYWORDS.filter((keyword) =>
      fullText.includes(keyword)
    );
  }

  /**
   * Format transcript for prompts
   */
  private formatTranscript(segments: TranscriptSegment[]): string {
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
   * Build final analysis result
   */
  private buildResult(state: AnalysisState): AnalysisResult {
    if (
      !(
        state.buyerData &&
        state.summaryData &&
        state.crmData &&
        state.coachData
      )
    ) {
      throw new Error("Incomplete analysis state. All agents must complete.");
    }

    return {
      // Core MEDDIC data
      meddicScores: state.buyerData.meddicScores,
      overallScore: state.buyerData.overallScore,
      qualificationStatus: state.buyerData.qualificationStatus,
      dimensions: state.buyerData.dimensions,

      // Summary
      executiveSummary: state.summaryData.executiveSummary,
      keyFindings: state.summaryData.keyFindings,
      nextSteps: state.summaryData.nextSteps,

      // Risk assessment
      risks: this.extractRisks(state),

      // Coaching
      coachingNotes: state.coachData.coachingNotes,
      alerts: state.coachData.alerts,

      // CRM data
      crmData: state.crmData,

      // V2 compatibility: preserve all raw agent outputs
      agentOutputs: {
        agent1: state.contextData,
        agent2: state.buyerData,
        agent3: state.sellerData,
        agent4: state.summaryData,
        agent5: state.crmData,
        agent6: state.coachData,
      },

      // Metadata
      analyzedAt: new Date(),
      refinementCount: state.refinementCount,
    };
  }

  /**
   * Extract risks from various agent outputs
   */
  private extractRisks(state: AnalysisState) {
    const risks: Array<{
      risk: string;
      severity: string;
      mitigation?: string;
    }> = [];

    // From buyer analysis
    if (state.buyerData) {
      if (state.buyerData.overallScore < 40) {
        risks.push({
          risk: "Low MEDDIC score indicates weak qualification",
          severity: "High",
          mitigation: "Focus on identifying economic buyer and pain points",
        });
      }

      if (
        !state.buyerData.trustAssessment ||
        state.buyerData.trustAssessment.level === "Low"
      ) {
        risks.push({
          risk: "Low trust level with prospect",
          severity: "High",
          mitigation: "Build rapport and provide social proof",
        });
      }
    }

    // From competitor detection
    if (state.hasCompetitor) {
      risks.push({
        risk: `Competitors mentioned: ${state.competitorKeywords?.join(", ")}`,
        severity: "Medium",
        mitigation:
          "Differentiate value proposition and address competitive concerns",
      });
    }

    return risks;
  }
}

/**
 * Factory function for creating orchestrator
 */
export function createOrchestrator(
  geminiClient: GeminiClient
): MeddicOrchestrator {
  return new MeddicOrchestrator(geminiClient);
}
