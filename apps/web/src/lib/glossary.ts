/**
 * 銷售術語詞彙表
 * 包含所有專業名詞的定義和計算方式說明
 */

export interface TermDefinition {
  /** 術語名稱 */
  term: string;
  /** 定義說明 */
  definition: string;
  /** 計算方式（選填） */
  calculation?: string;
}

export const glossary: Record<string, TermDefinition> = {
  // PDCM+SPIN 相關術語
  "PDCM+SPIN": {
    term: "PDCM+SPIN",
    definition:
      "結合 PDCM（Pain-Decision-Champion-Metrics）與 SPIN 銷售技巧的分析框架，用於評估機會成熟度和銷售技巧表現。",
    calculation:
      "PDCM 總分由四個維度加權計算：Pain（痛點 35%）、Decision（決策 25%）、Champion（支持度 25%）、Metrics（量化 15%）。SPIN 則評估 Situation、Problem、Implication、Need-Payoff 四階段的達成率。",
  },
  pdcmScore: {
    term: "PDCM 分數",
    definition: "根據 PDCM 方法論評估的機會資格分數，滿分為 100 分。",
    calculation:
      "四個維度各佔比重不同（P:35%, D:25%, C:25%, M:15%），系統根據對話內容自動分析並計算加權總分。",
  },
  pain: {
    term: "Pain（痛點）",
    definition: "客戶哪裡痛？有多急？",
    calculation: "例：「每天對帳要花 3 小時」",
  },
  decision: {
    term: "Decision（決策）",
    definition: "有跟能做主的人談嗎？",
    calculation: "例：「老闆有在場」",
  },
  champion: {
    term: "Champion（支持度）",
    definition: "有人會幫我們講話嗎？",
    calculation: "例：「店長說會跟老闆提」",
  },
  metrics: {
    term: "Metrics（量化）",
    definition: "客戶有講到具體數字嗎？",
    calculation: "例：「想省 30% 人力」",
  },

  // SPIN 相關術語
  spinScore: {
    term: "SPIN 達成率",
    definition: "評估業務在對話中運用 SPIN 銷售技巧的完整程度。",
    calculation: "計算四個階段（S-P-I-N）的達成狀況，取百分比。",
  },
  situation: {
    term: "Situation（情境）",
    definition: "有問客戶現在怎麼做嗎？",
    calculation: "例：「你們現在用什麼系統？」",
  },
  problem: {
    term: "Problem（問題）",
    definition: "有問到客戶的困擾嗎？",
    calculation: "例：「最頭痛的是什麼？」",
  },
  implication: {
    term: "Implication（影響）",
    definition: "有讓客戶想到「不處理會怎樣」嗎？",
    calculation: "例：「這樣下去會虧多少？」",
  },
  needPayoff: {
    term: "Need-Payoff（需求回報）",
    definition: "有讓客戶說出「解決了有什麼好處」嗎？",
    calculation: "例：「如果搞定了，對你有什麼幫助？」",
  },

  // 機會狀態相關
  opportunity: {
    term: "機會",
    definition: "潛在的銷售機會，代表一個可能成交的業務案件。",
  },
  lead: {
    term: "潛在客戶",
    definition: "對產品或服務表示興趣的潛在買家。",
  },
  qualificationStatus: {
    term: "資格狀態",
    definition: "機會的資格認定階段，表示機會的成熟度。",
    calculation:
      "根據 PDCM 分數自動判定：Strong（>70）、Medium（40-70）、Weak（20-40）、At Risk（<20）。",
  },
  conversionRate: {
    term: "轉換率",
    definition: "機會轉換為成交的比例。",
    calculation: "成交機會數 / 總機會數 × 100%",
  },

  // 對話相關
  conversation: {
    term: "對話",
    definition: "與客戶進行的通話或會議記錄。",
  },
  transcript: {
    term: "逐字稿",
    definition: "對話的完整文字記錄，由語音轉文字技術自動產生。",
  },
  analysis: {
    term: "分析",
    definition: "系統根據對話內容自動產生的 PDCM+SPIN 評估報告。",
  },
  processingStatus: {
    term: "處理狀態",
    definition: "對話音檔的處理進度。",
    calculation:
      "PENDING（等待中）→ PROCESSING（處理中）→ COMPLETED（已完成）或 FAILED（失敗）",
  },

  // 報告相關
  avgPdcmScore: {
    term: "平均 PDCM 分數",
    definition: "所有機會的 PDCM 分數平均值，反映整體機會品質。",
    calculation: "所有機會 PDCM 分數總和 / 機會數量",
  },
  totalOpportunities: {
    term: "機會總數",
    definition: "系統中記錄的所有機會數量。",
  },
  totalConversations: {
    term: "對話總數",
    definition: "系統中記錄的所有對話數量。",
  },
  totalAnalyses: {
    term: "分析總數",
    definition: "系統完成的 PDCM+SPIN 分析報告數量。",
  },
  trend: {
    term: "趨勢",
    definition: "指標相較於前期的變化方向。",
    calculation: "比較當期與前期數值，計算百分比變化。",
  },
  teamPerformance: {
    term: "團隊績效",
    definition: "團隊成員的整體銷售表現統計。",
  },

  // 對話類型
  discoveryCall: {
    term: "需求訪談",
    definition: "初次接觸客戶，了解其需求和痛點的對話。",
  },
  productDemo: {
    term: "產品展示",
    definition: "向客戶展示產品功能和價值的對話。",
  },
  followUp: {
    term: "跟進電話",
    definition: "持續追蹤客戶進度的對話。",
  },
  negotiation: {
    term: "議價討論",
    definition: "討論價格和合約條款的對話。",
  },
  closing: {
    term: "成交會議",
    definition: "最終確認成交細節的對話。",
  },
  support: {
    term: "客服支援",
    definition: "提供售後服務或技術支援的對話。",
  },

  // 其他
  roi: {
    term: "ROI",
    definition: "投資報酬率，衡量投資效益的指標。",
    calculation: "（收益 - 成本）/ 成本 × 100%",
  },
  pipeline: {
    term: "銷售管線",
    definition: "所有進行中機會的總覽，用於預測未來營收。",
  },
  winRate: {
    term: "勝率",
    definition: "成功成交的機會佔總機會的比例。",
    calculation: "成交機會數 / 已結案機會數 × 100%",
  },
  dealSize: {
    term: "機會金額",
    definition: "預估或實際的交易金額。",
  },
  salesCycle: {
    term: "銷售週期",
    definition: "從首次接觸到成交所需的平均時間。",
    calculation: "所有成交機會的銷售天數總和 / 成交機會數",
  },

  // 戰術建議相關
  tacticalSuggestion: {
    term: "戰術建議",
    definition: "根據對話內容分析，提供給業務的即時銷售建議和話術。",
  },
  talkTrack: {
    term: "話術",
    definition: "建議業務在特定情境下使用的標準說法或回應方式。",
  },
};

/**
 * 根據 key 取得術語定義
 */
export function getTerm(key: string): TermDefinition | undefined {
  return glossary[key];
}

/**
 * 根據術語名稱搜尋定義
 */
export function searchTerm(name: string): TermDefinition | undefined {
  return Object.values(glossary).find(
    (t) => t.term === name || t.term.toLowerCase() === name.toLowerCase()
  );
}
