/**
 * 分析結果 Slack Block UI
 *
 * Agent 1-3 合併報告 + Agent 4 Summary 單獨顯示
 */

export interface AnalysisResultData {
  conversationId: string;
  caseNumber: string;
  companyName: string;

  // Agent 2: PDCM 評分
  overallScore: number;
  status: "strong" | "medium" | "weak" | "at_risk";
  pdcmScores?: {
    pain: number;
    decision: number;
    champion: number;
    metrics: number;
    totalScore: number;
    dealProbability: "high" | "medium" | "low";
  };
  // Legacy: MEDDIC 六維度 (向下相容)
  dimensions?: {
    metrics: number;
    economicBuyer: number;
    decisionCriteria: number;
    decisionProcess: number;
    identifyPain: number;
    champion: number;
  };

  // Agent 2 + 3: 關鍵發現和建議
  keyFindings: string[];
  risks: string[];
  recommendedActions: string[];

  // Agent 4: Summary
  executiveSummary: string;
  nextSteps: Array<{
    action: string;
    owner?: string;
    deadline?: string;
  }>;

  // Agent 6: 競品相關
  competitorMentions?: Array<{
    competitorName: string;
    mentionCount: number;
    customerAttitude: "positive" | "negative" | "neutral";
    quotes: string[];
  }>;
  competitorThreatLevel?: "high" | "medium" | "low" | "none";
  competitorHandlingEvaluation?: Array<{
    competitorName: string;
    customerQuote: string;
    repResponse: string;
    score: number;
    evaluation: {
      strengths: string[];
      weaknesses: string[];
    };
    recommendedResponse: string;
    improvementTips: string[];
  }>;
}

/**
 * 建構 Agent 1-3 合併分析報告 Block
 */
export function buildAnalysisResultBlocks(data: AnalysisResultData): object[] {
  const statusEmoji = getStatusEmoji(data.status);
  const scoreColor = getScoreColor(data.overallScore);

  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "PDCM+SPIN 分析完成",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${data.companyName}* | 案件編號: \`${data.caseNumber}\``,
      },
    },
    {
      type: "divider",
    },
    // 總分
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${statusEmoji} *總分: ${data.overallScore}/100* ${scoreColor}`,
      },
    },
  ];

  // PDCM 四維度 (優先使用)
  if (data.pdcmScores) {
    const probabilityEmoji =
      data.pdcmScores.dealProbability === "high"
        ? "🔥"
        : data.pdcmScores.dealProbability === "medium"
          ? "🤔"
          : "❄️";
    const probabilityText =
      data.pdcmScores.dealProbability === "high"
        ? "高"
        : data.pdcmScores.dealProbability === "medium"
          ? "中"
          : "低";

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${probabilityEmoji} *成交機率: ${probabilityText}*`,
      },
    });
    blocks.push({
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*P* 痛點\n${getScoreBar(data.pdcmScores.pain / 20)} ${data.pdcmScores.pain}/100`,
        },
        {
          type: "mrkdwn",
          text: `*D* 決策\n${getScoreBar(data.pdcmScores.decision / 20)} ${data.pdcmScores.decision}/100`,
        },
        {
          type: "mrkdwn",
          text: `*C* 支持\n${getScoreBar(data.pdcmScores.champion / 20)} ${data.pdcmScores.champion}/100`,
        },
        {
          type: "mrkdwn",
          text: `*M* 量化\n${getScoreBar(data.pdcmScores.metrics / 20)} ${data.pdcmScores.metrics}/100`,
        },
      ],
    });
  } else if (data.dimensions) {
    // Legacy: MEDDIC 六維度 (向下相容)
    blocks.push({
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*M* Metrics\n${getScoreBar(data.dimensions.metrics)} ${data.dimensions.metrics}/5`,
        },
        {
          type: "mrkdwn",
          text: `*E* Economic Buyer\n${getScoreBar(data.dimensions.economicBuyer)} ${data.dimensions.economicBuyer}/5`,
        },
        {
          type: "mrkdwn",
          text: `*D* Decision Criteria\n${getScoreBar(data.dimensions.decisionCriteria)} ${data.dimensions.decisionCriteria}/5`,
        },
        {
          type: "mrkdwn",
          text: `*D* Decision Process\n${getScoreBar(data.dimensions.decisionProcess)} ${data.dimensions.decisionProcess}/5`,
        },
        {
          type: "mrkdwn",
          text: `*I* Identify Pain\n${getScoreBar(data.dimensions.identifyPain)} ${data.dimensions.identifyPain}/5`,
        },
        {
          type: "mrkdwn",
          text: `*C* Champion\n${getScoreBar(data.dimensions.champion)} ${data.dimensions.champion}/5`,
        },
      ],
    });
  }

  blocks.push({
    type: "divider",
  });

  // 關鍵發現
  if (data.keyFindings.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🎯 關鍵發現*\n${data.keyFindings
          .slice(0, 3)
          .map((f) => `• ${f}`)
          .join("\n")}`,
      },
    });
  }

  // 風險
  if (data.risks.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*⚠️ 潛在風險*\n${data.risks
          .slice(0, 3)
          .map((r) => `• ${r}`)
          .join("\n")}`,
      },
    });
  }

  // 建議行動
  if (data.recommendedActions.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*💡 建議行動*\n${data.recommendedActions
          .slice(0, 3)
          .map((a) => `• ${a}`)
          .join("\n")}`,
      },
    });
  }

  // Footer
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `對話 ID: \`${data.conversationId}\` | 由 Sales AI 自動生成`,
      },
    ],
  });

  return blocks;
}

/**
 * 建構 Agent 4 Summary Block（含編輯按鈕）
 */
export function buildSummaryBlocks(
  conversationId: string,
  summary: string,
  nextSteps: Array<{ action: string; owner?: string; deadline?: string }>
): object[] {
  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "會議摘要",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: summary,
      },
    },
  ];

  // 下一步行動
  if (nextSteps.length > 0) {
    const nextStepText = nextSteps
      .slice(0, 3)
      .map((step) => {
        let text = `• ${step.action}`;
        if (step.owner) {
          text += ` (${step.owner})`;
        }
        if (step.deadline) {
          text += ` - ${step.deadline}`;
        }
        return text;
      })
      .join("\n");

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*📋 下一步行動*\n${nextStepText}`,
      },
    });
  }

  blocks.push({ type: "divider" });

  // 編輯按鈕
  const buttonValue = JSON.stringify({
    conversationId,
    summary,
  });

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "📝 編輯摘要",
          emoji: true,
        },
        action_id: "edit_summary",
        value: buttonValue,
      },
    ],
  });

  return blocks;
}

// Helper functions
function getStatusEmoji(status: string): string {
  switch (status.toLowerCase()) {
    case "strong":
      return "🟢";
    case "medium":
      return "🟡";
    case "weak":
      return "🟠";
    case "at_risk":
    case "at risk":
      return "🔴";
    default:
      return "⚪";
  }
}

function getScoreColor(score: number): string {
  if (score >= 70) {
    return "🟢";
  }
  if (score >= 40) {
    return "🟡";
  }
  return "🔴";
}

function getScoreBar(score: number): string {
  const filled = Math.round(score);
  const empty = 5 - filled;
  return "▓".repeat(filled) + "░".repeat(empty);
}

/**
 * 建構競品分析 Block (使用新的 competitorAnalysis 資料結構)
 */
export function buildCompetitorAnalysisBlocks(competitorAnalysis: {
  detectedCompetitors: Array<{
    name: string;
    customerQuote: string;
    attitude: "positive" | "negative" | "neutral";
    threatLevel: "high" | "medium" | "low";
    ourAdvantages: string[];
    suggestedTalkTracks: string[];
  }>;
  overallThreatLevel: "high" | "medium" | "low" | "none";
  handlingScore?: number;
}): object[] {
  const blocks: object[] = [];

  // 如果沒有偵測到競品，返回空陣列
  if (
    !competitorAnalysis.detectedCompetitors ||
    competitorAnalysis.detectedCompetitors.length === 0
  ) {
    return blocks;
  }

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "🎯 競品分析",
      emoji: true,
    },
  });

  // 整體威脅等級
  const threatEmoji = getThreatEmoji(competitorAnalysis.overallThreatLevel);
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*整體威脅等級*: ${threatEmoji} ${getThreatLabel(competitorAnalysis.overallThreatLevel)}`,
    },
  });

  // 業務應對評分
  if (competitorAnalysis.handlingScore !== undefined) {
    const scoreStars = getScoreStars(competitorAnalysis.handlingScore);
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*業務應對評分*: ${scoreStars} (${competitorAnalysis.handlingScore}/5)`,
      },
    });
  }

  blocks.push({ type: "divider" });

  // 偵測到的競品詳細資訊
  for (const competitor of competitorAnalysis.detectedCompetitors) {
    const attitudeEmoji = getAttitudeEmoji(competitor.attitude);
    const competitorThreatEmoji = getThreatEmoji(competitor.threatLevel);

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${competitor.name}* | ${attitudeEmoji} ${getAttitudeLabel(competitor.attitude)} | ${competitorThreatEmoji} ${getThreatLabel(competitor.threatLevel)}`,
      },
    });

    // 客戶原話
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*客戶原話*:\n> 「${competitor.customerQuote}」`,
      },
    });

    // 我方優勢
    if (competitor.ourAdvantages.length > 0) {
      const advantagesText = competitor.ourAdvantages
        .slice(0, 3)
        .map((adv) => `✅ ${adv}`)
        .join("\n");
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*我方優勢*:\n${advantagesText}`,
        },
      });
    }

    // 建議話術
    if (competitor.suggestedTalkTracks.length > 0) {
      const trackText = competitor.suggestedTalkTracks
        .slice(0, 2)
        .map((track, idx) => `${idx + 1}. ${track}`)
        .join("\n");
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*💡 建議話術*:\n${trackText}`,
        },
      });
    }

    blocks.push({ type: "divider" });
  }

  return blocks;
}

/**
 * 建構競品提及與應對評估 Block (Legacy - 保留向後相容)
 */
export function buildCompetitorBlocks(data: AnalysisResultData): object[] {
  const blocks: object[] = [];

  // 如果沒有競品提及，返回空陣列
  if (!data.competitorMentions || data.competitorMentions.length === 0) {
    return blocks;
  }

  // 競品提及區塊
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "🏷️ 競品提及",
      emoji: true,
    },
  });

  // 競品威脅程度
  const threatEmoji = getThreatEmoji(data.competitorThreatLevel);
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*競品威脅程度*: ${threatEmoji} ${getThreatLabel(data.competitorThreatLevel)}`,
    },
  });

  // 競品列表
  for (const competitor of data.competitorMentions) {
    const attitudeEmoji = getAttitudeEmoji(competitor.customerAttitude);
    const quotesText =
      competitor.quotes.length > 0
        ? competitor.quotes
            .slice(0, 2)
            .map((q) => `「${q}」`)
            .join(" ")
        : "無具體引用";

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${competitor.competitorName}* | 提及 ${competitor.mentionCount} 次 | ${attitudeEmoji} ${getAttitudeLabel(competitor.customerAttitude)}\n${quotesText}`,
      },
    });
  }

  blocks.push({ type: "divider" });

  // 競品應對評估區塊
  if (
    data.competitorHandlingEvaluation &&
    data.competitorHandlingEvaluation.length > 0
  ) {
    blocks.push({
      type: "header",
      text: {
        type: "plain_text",
        text: "🎯 競品應對評估",
        emoji: true,
      },
    });

    for (const evaluation of data.competitorHandlingEvaluation) {
      const scoreStars = getScoreStars(evaluation.score);

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${evaluation.competitorName}* | 回應評分: ${scoreStars} (${evaluation.score}/5)`,
        },
      });

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*客戶原話*:\n> ${evaluation.customerQuote}\n\n*業務回應*:\n> ${evaluation.repResponse}`,
        },
      });

      // 評估結果
      const strengthsText =
        evaluation.evaluation.strengths.length > 0
          ? evaluation.evaluation.strengths.map((s) => `✅ ${s}`).join("\n")
          : "無";
      const weaknessesText =
        evaluation.evaluation.weaknesses.length > 0
          ? evaluation.evaluation.weaknesses.map((w) => `⚠️ ${w}`).join("\n")
          : "無";

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*評估*:\n${strengthsText}\n${weaknessesText}`,
        },
      });

      // 建議回應
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*💡 建議回應*:\n> ${evaluation.recommendedResponse}`,
        },
      });

      // 改進重點
      if (evaluation.improvementTips.length > 0) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*改進重點*:\n${evaluation.improvementTips.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
          },
        });
      }

      blocks.push({ type: "divider" });
    }
  }

  return blocks;
}

function getThreatEmoji(level?: string): string {
  switch (level) {
    case "high":
      return "🔴";
    case "medium":
      return "🟡";
    case "low":
      return "🟢";
    default:
      return "⚪";
  }
}

function getThreatLabel(level?: string): string {
  switch (level) {
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
      return "低";
    default:
      return "無";
  }
}

function getAttitudeEmoji(attitude: string): string {
  switch (attitude) {
    case "positive":
      return "👍";
    case "negative":
      return "👎";
    default:
      return "😐";
  }
}

function getAttitudeLabel(attitude: string): string {
  switch (attitude) {
    case "positive":
      return "正面";
    case "negative":
      return "負面";
    default:
      return "中立";
  }
}

function getScoreStars(score: number): string {
  const fullStars = Math.floor(score);
  const emptyStars = 5 - fullStars;
  return "⭐".repeat(fullStars) + "☆".repeat(emptyStars);
}
