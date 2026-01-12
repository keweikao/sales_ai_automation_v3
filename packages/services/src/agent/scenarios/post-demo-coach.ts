/**
 * Post-Demo Coach Scenario
 * Demo 後教練場景 - 針對產品展示後的專屬輔導策略
 */

import { randomUUID } from "node:crypto";
import type {
  Alert,
  FollowUp,
  Recommendation,
  SalesCoachOutput,
  ScenarioContext,
  ScenarioHandler,
} from "../types.js";

// ============================================================
// Post-Demo Scenario Constants
// ============================================================

const POST_DEMO_CRITICAL_SIGNALS = {
  positive: [
    "什麼時候可以開始",
    "多久可以上線",
    "怎麼付款",
    "可以簽約",
    "很有興趣",
    "正是我們需要的",
    "比想像中好",
  ],
  negative: [
    "要再考慮",
    "跟老闆討論",
    "比較其他",
    "預算有限",
    "不太確定",
    "再研究看看",
    "回去評估",
  ],
  urgent: ["急著用", "下週開幕", "月底前", "趕快", "來不及"],
};

const POST_DEMO_BEST_PRACTICES = {
  immediateFollowUp: "Demo 結束後 24 小時內發送感謝訊息和會議摘要",
  proposalTiming: "在客戶熱度最高時（48小時內）提供正式報價",
  objectionHandling: "記錄所有異議點，在跟進時逐一解答",
  socialProof: "分享與客戶類似的成功案例",
  trialOffer: "對猶豫的客戶提供限時試用方案",
};

// ============================================================
// Post-Demo Coach Handler
// ============================================================

export const postDemoCoachHandler: ScenarioHandler = {
  type: "post_demo",
  name: "Demo 後教練",
  description: "針對產品展示後的銷售輔導，提供立即跟進策略和異議處理建議",

  /**
   * Detect if this scenario applies
   */
  detect(input): boolean {
    // Check if conversation type is demo
    if (input.metadata.conversationType === "demo") {
      return true;
    }

    // Check for demo-related keywords in transcript
    const fullText = input.transcript.map((t) => t.text).join(" ");
    const demoKeywords = ["展示", "Demo", "操作給你看", "示範", "功能介紹"];

    return demoKeywords.some((keyword) => fullText.includes(keyword));
  },

  /**
   * Enhance output with post-demo specific coaching
   */
  enhance(
    output: SalesCoachOutput,
    context: ScenarioContext
  ): SalesCoachOutput {
    const enhanced = { ...output };

    // Analyze demo outcome signals
    const demoOutcome = analyzeDemoOutcome(output);

    // Add scenario-specific recommendations
    const postDemoRecommendations = generatePostDemoRecommendations(
      demoOutcome,
      context
    );
    enhanced.recommendations = [
      ...postDemoRecommendations,
      ...enhanced.recommendations,
    ].slice(0, 7); // Keep top 7

    // Add scenario-specific alerts
    const postDemoAlerts = generatePostDemoAlerts(demoOutcome, output);
    enhanced.alerts = [...postDemoAlerts, ...enhanced.alerts];

    // Add scenario-specific follow-ups
    const postDemoFollowUps = generatePostDemoFollowUps(demoOutcome, context);
    enhanced.followUps = [...postDemoFollowUps, ...enhanced.followUps];

    // Update summary with demo-specific insights
    enhanced.summary = enhanceSummaryForPostDemo(enhanced.summary, demoOutcome);

    return enhanced;
  },
};

// ============================================================
// Helper Types
// ============================================================

interface DemoOutcome {
  sentiment: "hot" | "warm" | "cold";
  buyingSignals: string[];
  objections: string[];
  urgencyLevel: "high" | "medium" | "low";
  closeReadiness: number; // 0-100
  needsManagerDecision: boolean;
  competitorConcern: boolean;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Analyze demo outcome from coaching output
 */
function analyzeDemoOutcome(output: SalesCoachOutput): DemoOutcome {
  const outcome: DemoOutcome = {
    sentiment: "warm",
    buyingSignals: [],
    objections: [],
    urgencyLevel: "medium",
    closeReadiness: 50,
    needsManagerDecision: false,
    competitorConcern: false,
  };

  // Determine sentiment from analysis
  if (output.analysis.overallScore >= 70) {
    outcome.sentiment = "hot";
    outcome.closeReadiness = 80;
  } else if (output.analysis.overallScore >= 50) {
    outcome.sentiment = "warm";
    outcome.closeReadiness = 50;
  } else {
    outcome.sentiment = "cold";
    outcome.closeReadiness = 25;
  }

  // Check customer sentiment from summary
  if (output.summary.customerSentiment === "positive") {
    outcome.closeReadiness += 15;
    outcome.sentiment = outcome.closeReadiness >= 70 ? "hot" : "warm";
  } else if (output.summary.customerSentiment === "negative") {
    outcome.closeReadiness -= 20;
    outcome.sentiment = "cold";
  }

  // Extract buying signals from key wins
  outcome.buyingSignals = output.summary.keyWins.filter(
    (win) =>
      win.includes("興趣") ||
      win.includes("喜歡") ||
      win.includes("認同") ||
      win.includes("需要")
  );

  // Extract objections from areas for improvement
  outcome.objections = output.summary.areasForImprovement.filter(
    (area) =>
      area.includes("異議") ||
      area.includes("顧慮") ||
      area.includes("擔心") ||
      area.includes("問題")
  );

  // Check for decision maker involvement
  if (output.analysis.scores.economicBuyer < 3) {
    outcome.needsManagerDecision = true;
  }

  // Check for competitor concerns
  const hasCompetitorAlert = output.alerts.some(
    (a) => a.message.includes("競爭") || a.message.includes("其他系統")
  );
  if (hasCompetitorAlert) {
    outcome.competitorConcern = true;
  }

  // Determine urgency from alerts
  const hasUrgentAlert = output.alerts.some((a) => a.severity === "critical");
  if (hasUrgentAlert) {
    outcome.urgencyLevel = "high";
  }

  return outcome;
}

/**
 * Generate post-demo specific recommendations
 */
function generatePostDemoRecommendations(
  demoOutcome: DemoOutcome,
  context: ScenarioContext
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Hot lead - push for close
  if (demoOutcome.sentiment === "hot") {
    recommendations.push({
      id: `rec-postdemo-${nanoid(8)}`,
      type: "immediate_action",
      priority: "critical",
      title: "立即推進成交",
      description:
        "客戶展現強烈購買意願，建議在 24 小時內提供正式報價並安排簽約流程。",
      rationale: `成交準備度達 ${demoOutcome.closeReadiness}%，趁熱度高時推進。`,
      suggestedTiming: "24 小時內",
    });

    if (demoOutcome.buyingSignals.length > 0) {
      recommendations.push({
        id: `rec-signals-${nanoid(8)}`,
        type: "strategy",
        priority: "high",
        title: "強化購買信號",
        description: `客戶已表達：${demoOutcome.buyingSignals.slice(0, 2).join("、")}。在後續溝通中持續強調這些認同點。`,
        rationale: "利用客戶已認同的價值點加速決策。",
      });
    }
  }

  // Warm lead - nurture and address objections
  if (demoOutcome.sentiment === "warm") {
    recommendations.push({
      id: `rec-postdemo-${nanoid(8)}`,
      type: "follow_up",
      priority: "high",
      title: "48 小時內跟進",
      description: "客戶有興趣但仍在評估中，48 小時內跟進並解答任何疑問。",
      rationale: POST_DEMO_BEST_PRACTICES.proposalTiming,
      suggestedTiming: "48 小時內",
    });

    if (demoOutcome.objections.length > 0) {
      recommendations.push({
        id: `rec-objections-${nanoid(8)}`,
        type: "strategy",
        priority: "high",
        title: "處理客戶異議",
        description: `識別到的異議：${demoOutcome.objections.slice(0, 2).join("、")}。準備針對性回應。`,
        rationale: POST_DEMO_BEST_PRACTICES.objectionHandling,
      });
    }
  }

  // Cold lead - re-engage strategy
  if (demoOutcome.sentiment === "cold") {
    recommendations.push({
      id: `rec-postdemo-${nanoid(8)}`,
      type: "strategy",
      priority: "medium",
      title: "調整銷售策略",
      description:
        "Demo 反應較冷淡，建議重新評估客戶需求，考慮提供試用方案或重新安排與決策者會面。",
      rationale: "低溫客戶需要不同的接觸策略，避免過度推銷造成反效果。",
      suggestedTiming: "3-5 天後",
    });

    recommendations.push({
      id: `rec-trial-${nanoid(8)}`,
      type: "strategy",
      priority: "medium",
      title: "提供試用方案",
      description: "考慮提供 7-14 天免費試用，讓客戶親身體驗產品價值。",
      rationale: POST_DEMO_BEST_PRACTICES.trialOffer,
    });
  }

  // Decision maker not present
  if (demoOutcome.needsManagerDecision) {
    recommendations.push({
      id: `rec-dm-${nanoid(8)}`,
      type: "immediate_action",
      priority: "high",
      title: "接觸決策者",
      description: "經濟買家尚未參與，主動提議與老闆/主管進行簡短說明會議。",
      rationale: "沒有接觸到真正決策者的交易成功率顯著較低。",
    });
  }

  // Competitor concern
  if (demoOutcome.competitorConcern) {
    recommendations.push({
      id: `rec-competitor-${nanoid(8)}`,
      type: "strategy",
      priority: "high",
      title: "競品差異化說明",
      description: "準備競品比較資料，著重我們的獨特優勢而非批評競爭對手。",
      rationale: "正面強調差異化價值比負面攻擊競品更有效。",
    });
  }

  return recommendations;
}

/**
 * Generate post-demo specific alerts
 */
function generatePostDemoAlerts(
  demoOutcome: DemoOutcome,
  output: SalesCoachOutput
): Alert[] {
  const alerts: Alert[] = [];

  // Close now alert for hot leads
  if (demoOutcome.sentiment === "hot" && demoOutcome.closeReadiness >= 75) {
    alerts.push({
      id: `alert-close-${nanoid(8)}`,
      type: "close_now",
      severity: "critical",
      message: "客戶購買意願高！建議立即進入簽約流程。",
      suggestedAction: "24 小時內發送正式報價，安排簽約時間。",
      notifyManager: true,
    });
  }

  // Risk alert for cold leads
  if (demoOutcome.sentiment === "cold") {
    alerts.push({
      id: `alert-risk-${nanoid(8)}`,
      type: "risk",
      severity: "high",
      message: "Demo 後客戶反應冷淡，商機可能流失。",
      suggestedAction: "重新評估客戶痛點是否正確識別，調整銷售策略。",
      notifyManager: output.analysis.overallScore < 30,
    });
  }

  // Missing decision maker alert
  if (demoOutcome.needsManagerDecision) {
    alerts.push({
      id: `alert-dm-${nanoid(8)}`,
      type: "missing_decision_maker",
      severity: "high",
      message: "尚未接觸到經濟買家，需要向上推進。",
      suggestedAction: "主動提議與決策者進行簡短會議。",
      notifyManager: false,
    });
  }

  // Opportunity alert for high buying signals
  if (demoOutcome.buyingSignals.length >= 2) {
    alerts.push({
      id: `alert-opp-${nanoid(8)}`,
      type: "opportunity",
      severity: "medium",
      message: `偵測到 ${demoOutcome.buyingSignals.length} 個正面購買信號！`,
      suggestedAction: "利用這些信號推進對話，嘗試試探成交。",
      notifyManager: false,
    });
  }

  return alerts;
}

/**
 * Generate post-demo specific follow-ups
 */
function generatePostDemoFollowUps(
  demoOutcome: DemoOutcome,
  context: ScenarioContext
): FollowUp[] {
  const followUps: FollowUp[] = [];
  const now = new Date();

  // Thank you message - always
  followUps.push({
    id: `fu-thanks-${nanoid(8)}`,
    action: "發送 Demo 感謝訊息和會議摘要",
    owner: "rep",
    deadline: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
    priority: "high",
    status: "pending",
    context: POST_DEMO_BEST_PRACTICES.immediateFollowUp,
  });

  // Quote/Proposal based on temperature
  if (demoOutcome.sentiment === "hot") {
    followUps.push({
      id: `fu-quote-${nanoid(8)}`,
      action: "發送正式報價單",
      owner: "rep",
      deadline: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      priority: "high",
      status: "pending",
      context: "客戶購買意願高，快速提供報價",
    });
  } else if (demoOutcome.sentiment === "warm") {
    followUps.push({
      id: `fu-quote-${nanoid(8)}`,
      action: "準備客製化方案和報價",
      owner: "rep",
      deadline: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      priority: "high",
      status: "pending",
      context: POST_DEMO_BEST_PRACTICES.proposalTiming,
    });
  }

  // Case study sharing
  followUps.push({
    id: `fu-case-${nanoid(8)}`,
    action: "分享相似客戶成功案例",
    owner: "rep",
    deadline: new Date(now.getTime() + 48 * 60 * 60 * 1000),
    priority: "medium",
    status: "pending",
    context: POST_DEMO_BEST_PRACTICES.socialProof,
  });

  // Decision maker follow-up
  if (demoOutcome.needsManagerDecision) {
    followUps.push({
      id: `fu-dm-${nanoid(8)}`,
      action: "安排與決策者會議",
      owner: "rep",
      deadline: new Date(now.getTime() + 72 * 60 * 60 * 1000),
      priority: "high",
      status: "pending",
      context: "需要接觸真正的決策者才能推進交易",
    });
  }

  // Cold lead re-engagement
  if (demoOutcome.sentiment === "cold") {
    followUps.push({
      id: `fu-reengage-${nanoid(8)}`,
      action: "準備替代方案或試用提案",
      owner: "rep",
      deadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      priority: "medium",
      status: "pending",
      context: "客戶需要更多時間評估，準備低風險入門方案",
    });
  }

  return followUps;
}

/**
 * Enhance summary with post-demo specific insights
 */
function enhanceSummaryForPostDemo(
  summary: SalesCoachOutput["summary"],
  demoOutcome: DemoOutcome
): SalesCoachOutput["summary"] {
  const enhanced = { ...summary };

  // Add demo outcome context to executive summary
  const outcomeText = {
    hot: "Demo 反應非常正面，客戶展現強烈購買意願。",
    warm: "Demo 反應良好，客戶有興趣但仍在評估階段。",
    cold: "Demo 反應較為保守，需要調整後續接觸策略。",
  };

  enhanced.executiveSummary = `${outcomeText[demoOutcome.sentiment]} ${enhanced.executiveSummary}`;

  // Add post-demo best actions
  const postDemoActions = [];
  if (demoOutcome.sentiment === "hot") {
    postDemoActions.push("立即發送報價並安排簽約流程");
  } else {
    postDemoActions.push("24 小時內發送感謝訊息和會議摘要");
  }

  if (demoOutcome.needsManagerDecision) {
    postDemoActions.push("主動安排與決策者會面");
  }

  enhanced.nextBestActions = [
    ...postDemoActions,
    ...enhanced.nextBestActions,
  ].slice(0, 5);

  return enhanced;
}

// ============================================================
// Factory Function
// ============================================================

export function createPostDemoCoachHandler(): ScenarioHandler {
  return postDemoCoachHandler;
}
