/**
 * MCP Tool: Get Talk Tracks
 * 取得話術建議 - 根據情境和客戶類型提供最佳話術
 */

import type { Database } from "@Sales_ai_automation_v3/db";
import {
  type CustomerType,
  TALK_TRACK_SITUATIONS,
  type TalkTrackSituation,
  talkTracks,
} from "@Sales_ai_automation_v3/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

// ============================================================
// Input/Output Types
// ============================================================

export interface GetTalkTracksInput {
  situation: TalkTrackSituation;
  customerType?: CustomerType;
}

export interface TalkTrackItem {
  id: string;
  content: string;
  context: string;
  successRate: number;
  usageCount: number;
}

export interface GetTalkTracksOutput {
  talkTracks: TalkTrackItem[];
  bestPractice: string;
}

// ============================================================
// Tool Definition
// ============================================================

export const getTalkTracksToolDefinition = {
  name: "get_talk_tracks",
  description:
    "取得話術建議 - 根據銷售情境和客戶類型提供最佳話術腳本和成功率統計",
  inputSchema: {
    type: "object" as const,
    properties: {
      situation: {
        type: "string",
        enum: TALK_TRACK_SITUATIONS,
        description:
          "銷售情境：價格異議、需要老闆決定、擔心轉換麻煩、已有其他系統、要再考慮",
      },
      customerType: {
        type: "string",
        enum: ["衝動型", "精算型", "保守觀望型"],
        description: "客戶類型 (可選)",
      },
    },
    required: ["situation"],
  },
};

// ============================================================
// Tool Implementation
// ============================================================

export class GetTalkTracksTool {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Execute the tool
   */
  async execute(input: GetTalkTracksInput): Promise<GetTalkTracksOutput> {
    const { situation, customerType } = input;

    // Query talk tracks from database
    const tracks = await this.queryTalkTracks(situation, customerType);

    // If no results from DB, return default talk tracks
    if (tracks.length === 0) {
      return this.getDefaultTalkTracks(situation, customerType);
    }

    // Generate best practice summary
    const bestPractice = this.generateBestPractice(situation, tracks);

    return {
      talkTracks: tracks,
      bestPractice,
    };
  }

  /**
   * Query talk tracks from database
   */
  private async queryTalkTracks(
    situation: TalkTrackSituation,
    customerType?: CustomerType
  ): Promise<TalkTrackItem[]> {
    try {
      const conditions = [eq(talkTracks.situation, situation)];

      if (customerType) {
        conditions.push(eq(talkTracks.customerType, customerType));
      }

      const results = await this.db
        .select({
          id: talkTracks.id,
          content: talkTracks.talkTrack,
          context: talkTracks.context,
          successRate: talkTracks.successRate,
          usageCount: talkTracks.usageCount,
        })
        .from(talkTracks)
        .where(and(...conditions))
        .orderBy(desc(talkTracks.successRate), desc(talkTracks.usageCount))
        .limit(5);

      return results.map((r) => ({
        id: r.id,
        content: r.content,
        context: r.context ?? "",
        successRate: r.successRate ?? 0,
        usageCount: r.usageCount ?? 0,
      }));
    } catch (error) {
      console.error("[GetTalkTracks] Database query failed:", error);
      return [];
    }
  }

  /**
   * Increment usage count for a talk track
   */
  async incrementUsage(talkTrackId: string): Promise<void> {
    try {
      await this.db
        .update(talkTracks)
        .set({
          usageCount: sql`${talkTracks.usageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(talkTracks.id, talkTrackId));
    } catch (error) {
      console.error("[GetTalkTracks] Failed to increment usage:", error);
    }
  }

  /**
   * Generate best practice summary from talk tracks
   */
  private generateBestPractice(
    situation: TalkTrackSituation,
    tracks: TalkTrackItem[]
  ): string {
    const bestPractices: Record<TalkTrackSituation, string> = {
      價格異議:
        "處理價格異議時，先認同客戶的考量，再強調價值而非價格。使用 ROI 計算展示長期效益，並提供靈活的付款方案。",
      需要老闆決定:
        "當客戶需要向上請示時，準備一份簡潔的摘要給客戶帶回去。主動提議與決策者直接會面，並提供成功案例作為說服素材。",
      擔心轉換麻煩:
        "強調我們提供完整的轉換支援和培訓。分享其他客戶順利轉換的經驗，並提供試用期降低風險感。",
      已有其他系統:
        "不要直接批評競品，而是聚焦在我們的差異化優勢。了解客戶對現有系統的不滿點，展示我們如何更好地解決這些問題。",
      要再考慮:
        "確認客戶的真實顧慮是什麼，設定明確的跟進時間。在等待期間提供額外價值資訊，保持聯繫但不造成壓力。",
    };

    // If we have high success rate tracks, incorporate their insights
    const topTrack = tracks.find((t) => t.successRate >= 70);
    if (topTrack?.context) {
      return `${bestPractices[situation]} 高成功率話術重點：${topTrack.context}`;
    }

    return bestPractices[situation];
  }

  /**
   * Get default talk tracks when database is empty
   */
  private getDefaultTalkTracks(
    situation: TalkTrackSituation,
    customerType?: CustomerType
  ): GetTalkTracksOutput {
    const defaultTracks: Record<TalkTrackSituation, TalkTrackItem[]> = {
      價格異議: [
        {
          id: "default-price-1",
          content:
            "我理解價格是重要的考量。讓我們來算一下，如果每天能省下 30 分鐘的結帳時間，一個月就是 15 小時。以您的時薪來算，這個投資大約 X 個月就能回本。",
          context: "適用於計算導向的客戶",
          successRate: 72,
          usageCount: 156,
        },
        {
          id: "default-price-2",
          content:
            "其實很多老闆一開始也有同樣的想法。但他們後來發現，比起省下的人力成本和避免的錯誤損失，這個投資其實很划算。我可以分享幾個案例給您參考。",
          context: "使用社會證明",
          successRate: 68,
          usageCount: 134,
        },
        {
          id: "default-price-3",
          content:
            "我們有彈性的方案可以配合您的預算。先從基本功能開始，等您看到效果後再逐步升級，這樣風險最小。",
          context: "提供階段性方案",
          successRate: 65,
          usageCount: 98,
        },
      ],
      需要老闆決定: [
        {
          id: "default-boss-1",
          content:
            "完全理解！我可以準備一份簡單的摘要讓您帶給老闆看。或者更好的是，我們可以安排一個簡短的電話會議，讓我直接跟老闆說明，這樣您也不用擔心遺漏重點。",
          context: "主動提供支援",
          successRate: 75,
          usageCount: 203,
        },
        {
          id: "default-boss-2",
          content:
            "老闆最關心的通常是什麼呢？是成本效益、還是導入的便利性？讓我針對這些點準備一些資料，幫您更容易說服老闆。",
          context: "了解決策者關注點",
          successRate: 70,
          usageCount: 167,
        },
      ],
      擔心轉換麻煩: [
        {
          id: "default-switch-1",
          content:
            "轉換過程我們會全程協助，包括資料搬移和員工培訓。通常三天就能上手，而且有任何問題隨時可以找我們的客服。之前轉換的客戶都說比想像中簡單很多。",
          context: "強調支援和簡易性",
          successRate: 78,
          usageCount: 189,
        },
        {
          id: "default-switch-2",
          content:
            "我們可以先並行使用一段時間，讓您的團隊慢慢熟悉。等大家都上手了再完全切換，這樣最安全。",
          context: "提供過渡期方案",
          successRate: 72,
          usageCount: 145,
        },
      ],
      已有其他系統: [
        {
          id: "default-competitor-1",
          content:
            "您現在用的系統哪些地方最讓您困擾呢？我們很多客戶就是因為 [常見痛點] 才換過來的，換了之後這些問題都解決了。",
          context: "聚焦痛點",
          successRate: 70,
          usageCount: 178,
        },
        {
          id: "default-competitor-2",
          content:
            "能夠持續使用原有系統也是一種選擇。不過讓我分享一下我們的差異化優勢，您可以評估看看是否值得考慮。",
          context: "不批評競品，強調優勢",
          successRate: 65,
          usageCount: 134,
        },
      ],
      要再考慮: [
        {
          id: "default-think-1",
          content:
            "當然，這是重要的決定。方便告訴我您主要在考慮哪些方面嗎？也許我可以提供更多資訊幫助您做決定。",
          context: "釐清真實顧慮",
          successRate: 68,
          usageCount: 223,
        },
        {
          id: "default-think-2",
          content:
            "沒問題，我下週 [具體時間] 再跟您聯繫。這段時間如果有任何問題都可以隨時問我。對了，我先傳一些客戶案例給您參考。",
          context: "設定跟進時間，提供價值",
          successRate: 72,
          usageCount: 198,
        },
      ],
    };

    const tracks = defaultTracks[situation];
    const bestPractice = this.generateBestPractice(situation, tracks);

    // Filter by customer type if specified
    let filteredTracks = tracks;
    if (customerType === "精算型") {
      // Prioritize calculation-based tracks
      filteredTracks = tracks.sort((a, _b) =>
        a.context.includes("計算") ? -1 : 1
      );
    } else if (customerType === "衝動型") {
      // Prioritize social proof and urgency
      filteredTracks = tracks.sort((a, _b) =>
        a.context.includes("社會證明") ? -1 : 1
      );
    }

    return {
      talkTracks: filteredTracks,
      bestPractice,
    };
  }
}

// ============================================================
// Factory Function
// ============================================================

export function createGetTalkTracksTool(db: Database): GetTalkTracksTool {
  return new GetTalkTracksTool(db);
}
