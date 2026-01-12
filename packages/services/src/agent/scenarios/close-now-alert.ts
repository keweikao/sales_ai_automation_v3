import { db } from "@Sales_ai_automation_v3/db";
import type {
  AlertSeverity,
  AlertType,
} from "@Sales_ai_automation_v3/db/schema";
import {
  alerts,
  conversations,
  meddicAnalyses,
  opportunities,
  teamMembers,
  user,
} from "@Sales_ai_automation_v3/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";

/**
 * Close Now Alert 場景
 *
 * 當偵測到高成交機率時，自動發送 Close Now 警示給業務和主管
 *
 * 觸發條件：
 * 1. MEDDIC 分數 >= 80
 * 2. Champion 分數 >= 4
 * 3. 有明確購買訊號（關鍵字匹配）
 *
 * 警示動作：
 * 1. 建立警示記錄
 * 2. 通知業務本人
 * 3. 通知直屬主管
 * 4. 提供建議的成交行動
 */

// ============================================================
// Types
// ============================================================

export interface CloseNowContext {
  opportunityId: string;
  conversationId: string;
  userId?: string;
}

export interface CloseNowResult {
  triggered: boolean;
  alertId?: string;
  reason?: string;
  suggestedActions?: string[];
  notifiedUsers?: string[];
}

interface MeddicData {
  overallScore: number;
  championScore: number | null;
  keyFindings: string[] | null;
  economicBuyerScore: number | null;
  decisionProcessScore: number | null;
}

// ============================================================
// Constants
// ============================================================

/**
 * 購買訊號關鍵字
 */
const BUYING_SIGNAL_KEYWORDS = [
  // 預算相關
  "預算",
  "budget",
  "經費",
  "投資",
  // 採購相關
  "採購",
  "購買",
  "訂購",
  "下單",
  // 合約相關
  "簽約",
  "合約",
  "contract",
  "agreement",
  // 時程相關
  "時程",
  "時間表",
  "timeline",
  "schedule",
  "何時開始",
  "什麼時候",
  // 導入相關
  "導入",
  "實施",
  "implementation",
  "上線",
  "部署",
  // 決策相關
  "決定",
  "選擇",
  "確定",
  "同意",
];

/**
 * Close Now 閾值設定
 */
const CLOSE_NOW_THRESHOLDS = {
  minMeddicScore: 80,
  minChampionScore: 4,
  minEconomicBuyerScore: 3,
} as const;

// ============================================================
// Helper Functions
// ============================================================

/**
 * 產生唯一的 Alert ID
 */
function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 檢查是否有購買訊號
 */
function hasBuyingSignal(keyFindings: string[] | null): boolean {
  if (!keyFindings || keyFindings.length === 0) {
    return false;
  }

  return keyFindings.some((finding) =>
    BUYING_SIGNAL_KEYWORDS.some((keyword) =>
      finding.toLowerCase().includes(keyword.toLowerCase())
    )
  );
}

/**
 * 計算緊急程度
 */
function calculateUrgency(meddic: MeddicData): AlertSeverity {
  const score = meddic.overallScore;
  const hasStrongChampion = (meddic.championScore ?? 0) >= 5;
  const hasEconomicBuyer = (meddic.economicBuyerScore ?? 0) >= 4;

  if (score >= 90 && hasStrongChampion && hasEconomicBuyer) {
    return "high";
  }
  if (score >= 85 || (hasStrongChampion && hasEconomicBuyer)) {
    return "high";
  }
  return "medium";
}

/**
 * 產生建議行動
 */
function generateSuggestedActions(meddic: MeddicData): string[] {
  const actions: string[] = [];

  // 基本建議
  actions.push("立即安排簽約/成交會議");
  actions.push("準備合約與報價單");

  // 根據 Economic Buyer 分數
  if ((meddic.economicBuyerScore ?? 0) < 5) {
    actions.push("確認經濟決策者的最終認可");
  }

  // 根據 Decision Process 分數
  if ((meddic.decisionProcessScore ?? 0) < 4) {
    actions.push("確認內部決策流程是否完成");
  }

  // 時效性建議
  actions.push("趁熱打鐵，48小時內安排後續行動");

  return actions;
}

/**
 * 取得通知對象
 */
async function getNotificationRecipients(
  userId: string | undefined
): Promise<{ id: string; name: string; email: string }[]> {
  const recipients: { id: string; name: string; email: string }[] = [];

  if (!userId) {
    return recipients;
  }

  // 取得業務本人
  const rep = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });

  if (rep) {
    recipients.push({
      id: rep.id,
      name: rep.name,
      email: rep.email,
    });
  }

  // 取得主管
  const managers = await db.query.teamMembers.findMany({
    where: eq(teamMembers.memberId, userId),
    with: {
      manager: true,
    },
  });

  for (const relation of managers) {
    if (relation.manager) {
      recipients.push({
        id: relation.manager.id,
        name: relation.manager.name,
        email: relation.manager.email,
      });
    }
  }

  return recipients;
}

// ============================================================
// Main Functions
// ============================================================

/**
 * 評估是否應觸發 Close Now 警示
 */
export async function evaluateCloseNow(
  context: CloseNowContext
): Promise<CloseNowResult> {
  const { opportunityId, conversationId, userId } = context;

  // 取得最新的 MEDDIC 分析
  const latestAnalysis = await db.query.meddicAnalyses.findFirst({
    where: eq(meddicAnalyses.conversationId, conversationId),
    orderBy: desc(meddicAnalyses.createdAt),
  });

  if (!latestAnalysis) {
    return {
      triggered: false,
      reason: "無 MEDDIC 分析資料",
    };
  }

  const meddicData: MeddicData = {
    overallScore: latestAnalysis.overallScore ?? 0,
    championScore: latestAnalysis.championScore,
    keyFindings: latestAnalysis.keyFindings as string[] | null,
    economicBuyerScore: latestAnalysis.economicBuyerScore,
    decisionProcessScore: latestAnalysis.decisionProcessScore,
  };

  // 檢查觸發條件
  const hasHighScore =
    meddicData.overallScore >= CLOSE_NOW_THRESHOLDS.minMeddicScore;
  const hasChampion =
    (meddicData.championScore ?? 0) >= CLOSE_NOW_THRESHOLDS.minChampionScore;
  const hasBuyingSignalFlag = hasBuyingSignal(meddicData.keyFindings);

  if (!(hasHighScore && hasChampion && hasBuyingSignalFlag)) {
    const reasons: string[] = [];
    if (!hasHighScore) {
      reasons.push(
        `MEDDIC 分數 ${meddicData.overallScore} < ${CLOSE_NOW_THRESHOLDS.minMeddicScore}`
      );
    }
    if (!hasChampion) {
      reasons.push("Champion 分數不足");
    }
    if (!hasBuyingSignalFlag) {
      reasons.push("無明確購買訊號");
    }

    return {
      triggered: false,
      reason: reasons.join("; "),
    };
  }

  // 檢查是否已有相同的未處理警示
  const existingAlert = await db.query.alerts.findFirst({
    where: and(
      eq(alerts.opportunityId, opportunityId),
      eq(alerts.type, "close_now"),
      eq(alerts.status, "pending")
    ),
  });

  if (existingAlert) {
    return {
      triggered: false,
      reason: "已存在未處理的 Close Now 警示",
      alertId: existingAlert.id,
    };
  }

  // 取得商機名稱
  const opportunity = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, opportunityId),
  });

  const opportunityName = opportunity?.companyName ?? "未知商機";

  // 建立警示
  const alertId = generateAlertId();
  const severity = calculateUrgency(meddicData);
  const suggestedActions = generateSuggestedActions(meddicData);

  await db.insert(alerts).values({
    id: alertId,
    opportunityId,
    conversationId,
    userId: userId ?? null,
    type: "close_now" as AlertType,
    severity,
    status: "pending",
    title: "Close Now 機會！",
    message: `${opportunityName} MEDDIC 分數達 ${meddicData.overallScore}，有明確購買訊號，建議立即安排成交會議！`,
    context: {
      meddicScore: meddicData.overallScore,
      dimensionScores: {
        metrics: 0, // 需要從 latestAnalysis 取得
        economicBuyer: meddicData.economicBuyerScore ?? 0,
        decisionCriteria: 0,
        decisionProcess: meddicData.decisionProcessScore ?? 0,
        identifyPain: 0,
        champion: meddicData.championScore ?? 0,
      },
      triggerReason: "高分 + Champion + 明確購買訊號",
      suggestedAction: suggestedActions[0] ?? "立即安排成交會議",
      relatedData: {
        allSuggestedActions: suggestedActions,
        keyFindings: meddicData.keyFindings,
      },
    },
  });

  // 取得通知對象
  const recipients = await getNotificationRecipients(userId);
  const notifiedUsers = recipients.map((r) => r.email);

  // TODO: 實際發送通知（整合 Slack、Email 等）
  console.log(`[Close Now Alert] ${alertId} created for ${opportunityName}`);
  console.log(`[Close Now Alert] Notified: ${notifiedUsers.join(", ")}`);

  return {
    triggered: true,
    alertId,
    reason: "符合所有 Close Now 條件",
    suggestedActions,
    notifiedUsers,
  };
}

/**
 * 批次檢查所有高分商機
 * 用於定期掃描，自動觸發警示
 */
export async function scanHighPotentialOpportunities(): Promise<
  CloseNowResult[]
> {
  const results: CloseNowResult[] = [];

  // 取得最近 7 天內高分的 MEDDIC 分析
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const highScoreAnalyses = await db
    .select({
      conversationId: meddicAnalyses.conversationId,
      opportunityId: meddicAnalyses.opportunityId,
      overallScore: meddicAnalyses.overallScore,
    })
    .from(meddicAnalyses)
    .where(
      and(
        gte(meddicAnalyses.overallScore, CLOSE_NOW_THRESHOLDS.minMeddicScore),
        gte(meddicAnalyses.createdAt, sevenDaysAgo)
      )
    )
    .orderBy(desc(meddicAnalyses.createdAt));

  // 對每個高分分析進行評估
  for (const analysis of highScoreAnalyses) {
    if (!(analysis.opportunityId && analysis.conversationId)) {
      continue;
    }

    // 取得對話的 userId
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, analysis.conversationId),
    });

    const result = await evaluateCloseNow({
      opportunityId: analysis.opportunityId,
      conversationId: analysis.conversationId,
      userId: conversation?.userId ?? undefined,
    });

    results.push(result);
  }

  return results;
}
