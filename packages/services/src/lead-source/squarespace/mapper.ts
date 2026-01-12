/**
 * Squarespace Form Mapper
 * 解析 Squarespace 表單資料並映射到標準格式
 */

import type { ParsedFormData, UTMParams, FieldMapping } from "../types";
import type { SquarespaceFormData, SquarespaceFormPayload } from "./types";

// 預設欄位映射
const DEFAULT_FIELD_MAPPING: FieldMapping = {
  companyName: "company",
  contactName: "name",
  contactEmail: "email",
  contactPhone: "phone",
  notes: "message",
};

/**
 * 從表單資料中提取 UTM 參數
 */
export function extractUTMParams(data: SquarespaceFormData): UTMParams {
  return {
    utmSource: data.utm_source || data.utmSource,
    utmMedium: data.utm_medium || data.utmMedium,
    utmCampaign: data.utm_campaign || data.utmCampaign,
    utmTerm: data.utm_term || data.utmTerm,
    utmContent: data.utm_content || data.utmContent,
  };
}

/**
 * 組合姓名（如果分開提供）
 */
function combineName(data: SquarespaceFormData): string | undefined {
  if (data.name) return data.name;

  const parts = [data.fname, data.lname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/**
 * 根據欄位映射提取值
 */
function getFieldValue(
  data: SquarespaceFormData,
  fieldMapping: FieldMapping,
  fieldName: keyof FieldMapping
): string | undefined {
  const mappedField = fieldMapping[fieldName];
  if (!mappedField) return undefined;

  // 支援多個可能的欄位名稱（用逗號分隔）
  const possibleFields = mappedField.split(",").map((f) => f.trim());

  for (const field of possibleFields) {
    const value = data[field];
    if (value) return value;
  }

  return undefined;
}

/**
 * 解析 Squarespace 表單 payload
 */
export function parseSquarespaceForm(
  payload: SquarespaceFormPayload,
  customMapping?: Partial<FieldMapping>
): ParsedFormData {
  const data = payload.data;
  const mapping: FieldMapping = { ...DEFAULT_FIELD_MAPPING, ...customMapping };

  // 提取公司名稱（必填）
  const companyName =
    getFieldValue(data, mapping, "companyName") ||
    data.company ||
    "未提供公司名稱";

  // 提取聯絡人姓名
  const contactName =
    getFieldValue(data, mapping, "contactName") || combineName(data);

  // 提取其他欄位
  const contactEmail =
    getFieldValue(data, mapping, "contactEmail") || data.email;
  const contactPhone =
    getFieldValue(data, mapping, "contactPhone") || data.phone;
  const notes = getFieldValue(data, mapping, "notes") || data.message;

  // 提取 UTM 參數
  const utm = extractUTMParams(data);

  return {
    companyName,
    contactName,
    contactEmail,
    contactPhone,
    notes,
    utm,
    rawData: data as Record<string, unknown>,
  };
}

/**
 * 檢查是否為重複提交
 * 基於 email 或 company + phone 組合判斷
 */
export function generateDeduplicationKey(data: ParsedFormData): string {
  if (data.contactEmail) {
    return `email:${data.contactEmail.toLowerCase()}`;
  }

  if (data.companyName && data.contactPhone) {
    return `company-phone:${data.companyName.toLowerCase()}:${data.contactPhone}`;
  }

  // 如果沒有足夠資訊，使用公司名稱
  return `company:${data.companyName.toLowerCase()}`;
}

/**
 * 驗證必填欄位
 */
export function validateFormData(
  data: ParsedFormData
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.companyName || data.companyName === "未提供公司名稱") {
    errors.push("缺少公司名稱");
  }

  if (!data.contactEmail && !data.contactPhone) {
    errors.push("至少需要提供 email 或電話");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
