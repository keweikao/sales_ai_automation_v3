/**
 * MEDDIC Zod Schemas
 * 統一的 MEDDIC 分析相關驗證邏輯
 */

import { z } from "zod";

// ============================================================
// MEDDIC Scores
// ============================================================

export const meddicScoresSchema = z.object({
  metrics: z.number().min(1).max(100),
  economicBuyer: z.number().min(1).max(100),
  decisionCriteria: z.number().min(1).max(100),
  decisionProcess: z.number().min(1).max(100),
  identifyPain: z.number().min(1).max(100),
  champion: z.number().min(1).max(100),
});

export type MeddicScores = z.infer<typeof meddicScoresSchema>;

// ============================================================
// Qualification Status
// ============================================================

export const qualificationStatusSchema = z.enum([
  "qualified",
  "partially-qualified",
  "unqualified",
  "needs-nurturing",
  "Strong",
  "Medium",
  "Weak",
  "At Risk",
]);

export type QualificationStatus = z.infer<typeof qualificationStatusSchema>;

// ============================================================
// Dimension Analysis
// ============================================================

export const dimensionAnalysisSchema = z.object({
  name: z.string(),
  score: z.number().min(1).max(100),
  evidence: z.array(z.string()),
  gaps: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type DimensionAnalysis = z.infer<typeof dimensionAnalysisSchema>;

// ============================================================
// Next Steps
// ============================================================

export const nextStepSchema = z.object({
  action: z.string(),
  priority: z.enum(["High", "Medium", "Low"]),
  owner: z.string(),
  deadline: z.string().optional(),
});

export type NextStep = z.infer<typeof nextStepSchema>;

// ============================================================
// Risk
// ============================================================

export const riskSchema = z.object({
  risk: z.string(),
  severity: z.enum(["High", "Medium", "Low"]),
  mitigation: z.string().optional(),
});

export type Risk = z.infer<typeof riskSchema>;

// ============================================================
// MEDDIC Analysis Result
// ============================================================

export const meddicAnalysisResultSchema = z.object({
  overallScore: z.number().min(1).max(100),
  qualificationStatus: qualificationStatusSchema,
  meddicScores: meddicScoresSchema.optional(),
  dimensions: z.record(z.string(), dimensionAnalysisSchema),
  keyFindings: z.array(z.string()),
  nextSteps: z.array(nextStepSchema),
  risks: z.array(riskSchema),
  // 【新增】競品分析
  competitorAnalysis: z
    .object({
      detectedCompetitors: z.array(
        z.object({
          name: z.string(),
          customerQuote: z.string(),
          attitude: z.enum(["positive", "negative", "neutral"]),
          threatLevel: z.enum(["high", "medium", "low"]),
          ourAdvantages: z.array(z.string()),
          suggestedTalkTracks: z.array(z.string()),
        })
      ),
      overallThreatLevel: z.enum(["high", "medium", "low", "none"]),
      handlingScore: z.number().min(1).max(5).optional(),
    })
    .optional(),
  agentOutputs: z
    .object({
      agent1: z.record(z.string(), z.unknown()).optional(),
      agent2: z.record(z.string(), z.unknown()).optional(),
      agent3: z.record(z.string(), z.unknown()).optional(),
      agent4: z.record(z.string(), z.unknown()).optional(),
      agent5: z.record(z.string(), z.unknown()).optional(),
      agent6: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

export type MEDDICAnalysisResult = z.infer<typeof meddicAnalysisResultSchema>;

// ============================================================
// Talk Track
// ============================================================

export const talkTrackSchema = z.object({
  id: z.string(),
  category: z.string(),
  scenario: z.string(),
  content: z.string(),
  tips: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  relatedDimensions: z.array(z.string()).optional(),
});

export type TalkTrack = z.infer<typeof talkTrackSchema>;

// ============================================================
// Talk Track Request
// ============================================================

export const getTalkTrackSchema = z.object({
  conversationId: z.string(),
  dimension: z.string().optional(),
  scenario: z.string().optional(),
});

export type GetTalkTrackRequest = z.infer<typeof getTalkTrackSchema>;
