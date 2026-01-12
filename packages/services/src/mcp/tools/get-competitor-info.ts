import { db } from "@Sales_ai_automation_v3/db";
import { competitorInfo } from "@Sales_ai_automation_v3/db/schema";
import { ilike } from "drizzle-orm";

/**
 * get-competitor-info Tool
 * 取得競品資訊，用於 AI 教練提供競品應對策略
 */

// ============================================================
// Types
// ============================================================

export interface GetCompetitorInfoInput {
  competitorName: string;
}

export interface GetCompetitorInfoOutput {
  found: boolean;
  competitor?: {
    name: string;
    strengths: string[];
    weaknesses: string[];
    ourAdvantages: string[];
    counterTalkTracks: string[];
  };
}

// ============================================================
// Main Function
// ============================================================

/**
 * 取得競品資訊
 */
export async function getCompetitorInfo(
  input: GetCompetitorInfoInput
): Promise<GetCompetitorInfoOutput> {
  const { competitorName } = input;

  // 使用 ilike 進行模糊匹配（大小寫不敏感）
  const competitor = await db.query.competitorInfo.findFirst({
    where: ilike(competitorInfo.competitorName, `%${competitorName}%`),
  });

  if (!competitor) {
    return {
      found: false,
    };
  }

  return {
    found: true,
    competitor: {
      name: competitor.competitorName,
      strengths: competitor.strengths ?? [],
      weaknesses: competitor.weaknesses ?? [],
      ourAdvantages: competitor.ourAdvantages ?? [],
      counterTalkTracks: competitor.counterTalkTracks ?? [],
    },
  };
}

/**
 * 取得所有競品列表（輔助功能）
 */
export async function listAllCompetitors(): Promise<string[]> {
  const competitors = await db
    .select({ name: competitorInfo.competitorName })
    .from(competitorInfo);

  return competitors.map((c) => c.name);
}

/**
 * MCP Tool Definition
 */
export const getCompetitorInfoTool = {
  name: "get-competitor-info",
  description:
    "取得競品資訊，包含競品優劣勢、我方優勢、反制話術等，用於銷售對話中的競品應對",
  inputSchema: {
    type: "object" as const,
    properties: {
      competitorName: {
        type: "string",
        description: "競品公司名稱（支援模糊匹配）",
      },
    },
    required: ["competitorName"],
  },
  execute: getCompetitorInfo,
};
