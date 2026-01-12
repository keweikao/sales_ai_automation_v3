/**
 * Lead Source Types
 * 潛客來源追蹤系統的類型定義
 */

// UTM 參數
export interface UTMParams {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

// 來源歸因
export interface SourceAttribution {
  source: string; // squarespace, manual, import, api
  sourceId?: string;
  landingPage?: string;
  referrer?: string;
  firstTouchAt?: Date;
  utm: UTMParams;
}

// 解析後的表單資料
export interface ParsedFormData {
  companyName: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  utm: UTMParams;
  rawData: Record<string, unknown>;
}

// Webhook 處理結果
export interface WebhookResult {
  success: boolean;
  opportunityId?: string;
  message: string;
  isDuplicate?: boolean;
}

// 來源統計
export interface SourceStats {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  totalLeads: number;
  thisMonth: number;
  lastMonth: number;
  growthRate: number; // 百分比
  topCampaigns: Array<{
    campaign: string;
    leads: number;
  }>;
}

// UTM 活動統計
export interface CampaignStats {
  campaignId: string;
  utmSource: string;
  utmMedium?: string;
  utmCampaign?: string;
  totalLeads: number;
  conversions: number;
  conversionRate: number;
  costPerLead?: number;
  roi?: number;
}

// 欄位映射設定
export interface FieldMapping {
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  [key: string]: string | undefined;
}
