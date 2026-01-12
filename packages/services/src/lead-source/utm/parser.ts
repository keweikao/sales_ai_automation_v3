/**
 * UTM Parameter Parser
 * 解析 URL 或物件中的 UTM 參數
 */

import type { UTMParams } from "../types";

// UTM 參數名稱對應
const UTM_PARAM_NAMES = {
  utmSource: ["utm_source", "utmSource", "source"],
  utmMedium: ["utm_medium", "utmMedium", "medium"],
  utmCampaign: ["utm_campaign", "utmCampaign", "campaign"],
  utmTerm: ["utm_term", "utmTerm", "term"],
  utmContent: ["utm_content", "utmContent", "content"],
} as const;

/**
 * 從 URL 解析 UTM 參數
 */
export function parseUTMFromUrl(url: string): UTMParams {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    return {
      utmSource: getParamValue(params, UTM_PARAM_NAMES.utmSource),
      utmMedium: getParamValue(params, UTM_PARAM_NAMES.utmMedium),
      utmCampaign: getParamValue(params, UTM_PARAM_NAMES.utmCampaign),
      utmTerm: getParamValue(params, UTM_PARAM_NAMES.utmTerm),
      utmContent: getParamValue(params, UTM_PARAM_NAMES.utmContent),
    };
  } catch {
    return {};
  }
}

/**
 * 從物件解析 UTM 參數
 */
export function parseUTMFromObject(
  obj: Record<string, string | undefined>
): UTMParams {
  return {
    utmSource: getObjectValue(obj, UTM_PARAM_NAMES.utmSource),
    utmMedium: getObjectValue(obj, UTM_PARAM_NAMES.utmMedium),
    utmCampaign: getObjectValue(obj, UTM_PARAM_NAMES.utmCampaign),
    utmTerm: getObjectValue(obj, UTM_PARAM_NAMES.utmTerm),
    utmContent: getObjectValue(obj, UTM_PARAM_NAMES.utmContent),
  };
}

/**
 * 從 URLSearchParams 中取得參數值
 */
function getParamValue(
  params: URLSearchParams,
  names: readonly string[]
): string | undefined {
  for (const name of names) {
    const value = params.get(name);
    if (value) return value;
  }
  return undefined;
}

/**
 * 從物件中取得值
 */
function getObjectValue(
  obj: Record<string, string | undefined>,
  names: readonly string[]
): string | undefined {
  for (const name of names) {
    const value = obj[name];
    if (value) return value;
  }
  return undefined;
}

/**
 * 將 UTM 參數轉換為 URL query string
 */
export function utmToQueryString(utm: UTMParams): string {
  const params = new URLSearchParams();

  if (utm.utmSource) params.set("utm_source", utm.utmSource);
  if (utm.utmMedium) params.set("utm_medium", utm.utmMedium);
  if (utm.utmCampaign) params.set("utm_campaign", utm.utmCampaign);
  if (utm.utmTerm) params.set("utm_term", utm.utmTerm);
  if (utm.utmContent) params.set("utm_content", utm.utmContent);

  return params.toString();
}

/**
 * 檢查是否有任何 UTM 參數
 */
export function hasUTMParams(utm: UTMParams): boolean {
  return !!(
    utm.utmSource ||
    utm.utmMedium ||
    utm.utmCampaign ||
    utm.utmTerm ||
    utm.utmContent
  );
}

/**
 * 產生 UTM Campaign 的唯一識別碼
 */
export function generateUTMCampaignKey(utm: UTMParams): string {
  const parts = [
    utm.utmSource || "_",
    utm.utmMedium || "_",
    utm.utmCampaign || "_",
  ];
  return parts.join(":").toLowerCase();
}

/**
 * 正規化 UTM 參數（轉小寫、去除空白）
 */
export function normalizeUTMParams(utm: UTMParams): UTMParams {
  return {
    utmSource: utm.utmSource?.trim().toLowerCase(),
    utmMedium: utm.utmMedium?.trim().toLowerCase(),
    utmCampaign: utm.utmCampaign?.trim().toLowerCase(),
    utmTerm: utm.utmTerm?.trim().toLowerCase(),
    utmContent: utm.utmContent?.trim().toLowerCase(),
  };
}

/**
 * 從常見來源推斷 UTM 參數
 */
export function inferUTMFromReferrer(referrer: string): UTMParams {
  if (!referrer) return {};

  try {
    const url = new URL(referrer);
    const hostname = url.hostname.toLowerCase();

    // Google
    if (hostname.includes("google.")) {
      return {
        utmSource: "google",
        utmMedium: hostname.includes("ads") ? "cpc" : "organic",
      };
    }

    // Facebook
    if (hostname.includes("facebook.") || hostname.includes("fb.")) {
      return {
        utmSource: "facebook",
        utmMedium: "social",
      };
    }

    // LinkedIn
    if (hostname.includes("linkedin.")) {
      return {
        utmSource: "linkedin",
        utmMedium: "social",
      };
    }

    // Instagram
    if (hostname.includes("instagram.")) {
      return {
        utmSource: "instagram",
        utmMedium: "social",
      };
    }

    // Twitter/X
    if (hostname.includes("twitter.") || hostname.includes("x.com")) {
      return {
        utmSource: "twitter",
        utmMedium: "social",
      };
    }

    // YouTube
    if (hostname.includes("youtube.") || hostname.includes("youtu.be")) {
      return {
        utmSource: "youtube",
        utmMedium: "video",
      };
    }

    // 其他來源
    return {
      utmSource: hostname.replace("www.", ""),
      utmMedium: "referral",
    };
  } catch {
    return {};
  }
}
