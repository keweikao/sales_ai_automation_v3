export type AlertType = "close_now" | "missing_dm" | "manager_escalation";
export type AlertSeverity = "high" | "medium" | "low";

export interface AlertContext {
  meddicScore?: number;
  dimensionScores?: {
    metrics: number;
    economicBuyer: number;
    decisionCriteria: number;
    decisionProcess: number;
    identifyPain: number;
    champion: number;
  };
  triggerReason: string;
  suggestedAction: string;
  relatedData?: Record<string, unknown>;
}

export interface AlertResult {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  context: AlertContext;
}

export interface EvaluationContext {
  opportunityId: string;
  opportunityName: string;
  conversationId?: string;
  userId?: string;
  meddicAnalysis: {
    overallScore: number;
    metricsScore: number | null;
    economicBuyerScore: number | null;
    decisionCriteriaScore: number | null;
    decisionProcessScore: number | null;
    identifyPainScore: number | null;
    championScore: number | null;
    keyFindings?: string[];
    agentOutputs?: Record<string, unknown>;
  };
  conversationCount: number;
  recentScores: number[]; // 最近的分析分數（最新的在前）
}

export interface AlertRule {
  type: AlertType;
  name: string;
  description: string;
  evaluate: (context: EvaluationContext) => AlertResult | null;
}
