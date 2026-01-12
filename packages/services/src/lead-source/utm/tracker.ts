/**
 * UTM Campaign Tracker
 * 追蹤和統計 UTM 活動效果
 */

import { db, utmCampaigns } from "@Sales_ai_automation_v3/db";
import type { UTMCampaign } from "@Sales_ai_automation_v3/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { CampaignStats, UTMParams } from "../types";
import { hasUTMParams, normalizeUTMParams } from "./parser";

/**
 * 追蹤 UTM Campaign
 */
export async function trackUTMCampaign(options: {
  userId: string;
  utm: UTMParams;
  isConversion?: boolean;
}): Promise<void> {
  const { userId, utm, isConversion = false } = options;

  // 正規化 UTM 參數
  const normalizedUTM = normalizeUTMParams(utm);

  // 檢查是否有 UTM 參數
  if (!hasUTMParams(normalizedUTM)) {
    return;
  }

  // 查找現有的 campaign
  const [existingCampaign] = await db
    .select()
    .from(utmCampaigns)
    .where(
      and(
        eq(utmCampaigns.userId, userId),
        eq(utmCampaigns.utmSource, normalizedUTM.utmSource || ""),
        sql`COALESCE(${utmCampaigns.utmMedium}, '') = ${normalizedUTM.utmMedium || ""}`,
        sql`COALESCE(${utmCampaigns.utmCampaign}, '') = ${normalizedUTM.utmCampaign || ""}`
      )
    )
    .limit(1);

  if (existingCampaign) {
    // 更新現有 campaign
    const newLeads = (existingCampaign.totalLeads || 0) + 1;
    const newConversions = isConversion
      ? (existingCampaign.totalConversions || 0) + 1
      : existingCampaign.totalConversions || 0;
    const conversionRate =
      newLeads > 0 ? ((newConversions / newLeads) * 100).toFixed(2) : "0";

    await db
      .update(utmCampaigns)
      .set({
        totalLeads: newLeads,
        totalConversions: newConversions,
        conversionRate,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(utmCampaigns.id, existingCampaign.id));
  } else {
    // 建立新的 campaign
    const campaignId = `utm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    await db.insert(utmCampaigns).values({
      id: campaignId,
      userId,
      utmSource: normalizedUTM.utmSource || "",
      utmMedium: normalizedUTM.utmMedium,
      utmCampaign: normalizedUTM.utmCampaign,
      utmTerm: normalizedUTM.utmTerm,
      utmContent: normalizedUTM.utmContent,
      name: generateCampaignName(normalizedUTM),
      totalLeads: 1,
      totalConversions: isConversion ? 1 : 0,
      conversionRate: isConversion ? "100.00" : "0",
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

/**
 * 更新 Campaign 轉換統計
 */
export async function recordConversion(options: {
  userId: string;
  utm: UTMParams;
}): Promise<void> {
  const { userId, utm } = options;
  const normalizedUTM = normalizeUTMParams(utm);

  if (!hasUTMParams(normalizedUTM)) {
    return;
  }

  // 查找 campaign
  const [campaign] = await db
    .select()
    .from(utmCampaigns)
    .where(
      and(
        eq(utmCampaigns.userId, userId),
        eq(utmCampaigns.utmSource, normalizedUTM.utmSource || ""),
        sql`COALESCE(${utmCampaigns.utmMedium}, '') = ${normalizedUTM.utmMedium || ""}`,
        sql`COALESCE(${utmCampaigns.utmCampaign}, '') = ${normalizedUTM.utmCampaign || ""}`
      )
    )
    .limit(1);

  if (campaign) {
    const newConversions = (campaign.totalConversions || 0) + 1;
    const totalLeads = campaign.totalLeads || 1;
    const conversionRate = ((newConversions / totalLeads) * 100).toFixed(2);

    await db
      .update(utmCampaigns)
      .set({
        totalConversions: newConversions,
        conversionRate,
        updatedAt: new Date(),
      })
      .where(eq(utmCampaigns.id, campaign.id));
  }
}

/**
 * 取得 Campaign 統計
 */
export async function getCampaignStats(
  userId: string,
  campaignId?: string
): Promise<CampaignStats[]> {
  let query = db
    .select()
    .from(utmCampaigns)
    .where(eq(utmCampaigns.userId, userId));

  if (campaignId) {
    query = db
      .select()
      .from(utmCampaigns)
      .where(
        and(eq(utmCampaigns.userId, userId), eq(utmCampaigns.id, campaignId))
      );
  }

  const campaigns = await query;

  return campaigns.map((c: UTMCampaign) => ({
    campaignId: c.id,
    utmSource: c.utmSource,
    utmMedium: c.utmMedium || undefined,
    utmCampaign: c.utmCampaign || undefined,
    totalLeads: c.totalLeads || 0,
    conversions: c.totalConversions || 0,
    conversionRate: Number.parseFloat(c.conversionRate || "0"),
    costPerLead: c.costPerLead || undefined,
    roi: calculateROI(c.spent, c.totalConversions),
  }));
}

/**
 * 計算 ROI
 */
function calculateROI(
  spent: number | null,
  conversions: number | null
): number | undefined {
  if (!(spent && conversions) || conversions === 0) {
    return undefined;
  }
  // 簡化的 ROI 計算（需要知道平均客戶價值才能準確計算）
  return undefined;
}

/**
 * 產生可讀的 Campaign 名稱
 */
function generateCampaignName(utm: UTMParams): string {
  const parts: string[] = [];

  if (utm.utmSource) {
    parts.push(capitalizeFirst(utm.utmSource));
  }

  if (utm.utmCampaign) {
    parts.push(utm.utmCampaign.replace(/_/g, " "));
  } else if (utm.utmMedium) {
    parts.push(capitalizeFirst(utm.utmMedium));
  }

  return parts.length > 0 ? parts.join(" - ") : "Unknown Campaign";
}

/**
 * 首字母大寫
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * 取得來源歸因分析
 */
export async function getSourceAttribution(userId: string): Promise<{
  bySource: Array<{ source: string; leads: number; conversions: number }>;
  byMedium: Array<{ medium: string; leads: number; conversions: number }>;
  topCampaigns: Array<{
    campaign: string;
    leads: number;
    conversionRate: number;
  }>;
}> {
  const campaigns = await db
    .select()
    .from(utmCampaigns)
    .where(eq(utmCampaigns.userId, userId));

  // 按來源分組
  const sourceMap = new Map<string, { leads: number; conversions: number }>();
  const mediumMap = new Map<string, { leads: number; conversions: number }>();

  for (const c of campaigns) {
    // 來源統計
    const sourceKey = c.utmSource || "direct";
    const sourceData = sourceMap.get(sourceKey) || { leads: 0, conversions: 0 };
    sourceData.leads += c.totalLeads || 0;
    sourceData.conversions += c.totalConversions || 0;
    sourceMap.set(sourceKey, sourceData);

    // 媒介統計
    const mediumKey = c.utmMedium || "none";
    const mediumData = mediumMap.get(mediumKey) || { leads: 0, conversions: 0 };
    mediumData.leads += c.totalLeads || 0;
    mediumData.conversions += c.totalConversions || 0;
    mediumMap.set(mediumKey, mediumData);
  }

  // 轉換為陣列並排序
  const bySource = Array.from(sourceMap.entries())
    .map(([source, data]) => ({ source, ...data }))
    .sort((a, b) => b.leads - a.leads);

  const byMedium = Array.from(mediumMap.entries())
    .map(([medium, data]) => ({ medium, ...data }))
    .sort((a, b) => b.leads - a.leads);

  // Top campaigns
  const topCampaigns = campaigns
    .filter((c: UTMCampaign) => c.utmCampaign)
    .map((c: UTMCampaign) => ({
      campaign: c.utmCampaign || "",
      leads: c.totalLeads || 0,
      conversionRate: Number.parseFloat(c.conversionRate || "0"),
    }))
    .sort((a: { leads: number }, b: { leads: number }) => b.leads - a.leads)
    .slice(0, 10);

  return { bySource, byMedium, topCampaigns };
}
