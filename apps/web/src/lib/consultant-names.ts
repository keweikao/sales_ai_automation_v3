/**
 * 顧問名稱映射配置
 * 將 Slack ID 映射到中文顯示名稱和聯繫資訊
 */

export interface ConsultantInfo {
  name: string;
  email: string;
  phone: string;
}

/**
 * Slack ID -> 顧問資訊映射表
 */
const consultantInfoMap: Record<string, ConsultantInfo> = {
  U0BU3PESX: {
    name: "高克瑋",
    email: "stephen.kao@ichef.com.tw",
    phone: "0937-621894",
  },
  UCPDC51A4: {
    name: "鍾志杰",
    email: "solo.chung@ichef.com.tw",
    phone: "0908-918867",
  },
  UEVG3HUF4: {
    name: "陳晉廷",
    email: "kevin.chen@ichef.com.tw",
    phone: "0908-918836",
  },
  U07K188QJFQ: {
    name: "陳可諠",
    email: "belle.chen@ichef.com.tw",
    phone: "0963-037079",
  },
  U8TC4Q7HB: {
    name: "李艾凌",
    email: "eileen.lee@ichef.com.tw",
    phone: "0968-201861",
  },
  U06U7HUEZFT: {
    name: "劉貞妘",
    email: "ariel.liu@ichef.com.tw",
    phone: "0970-536257",
  },
  U028Q69EKF1: {
    name: "梁明凱",
    email: "kim.liang@ichef.com.tw",
    phone: "0979-379239",
  },
  U01FS5DQT0T: {
    name: "劉鈺羚",
    email: "bonnie.liu@ichef.com.tw",
    phone: "0909-062186",
  },
  U015SA8USQ1: {
    name: "楊雅雯",
    email: "anna.yang@ichef.com.tw",
    phone: "0901-051607",
  },
  U0MATRQ2U: {
    name: "詹承峰",
    email: "eddie.chan@ichef.com.tw",
    phone: "0911-579160",
  },
  U041VGKJGA1: {
    name: "巫喬婷",
    email: "joy.wu@ichef.com.tw",
    phone: "0909-736719",
  },
  US97EGHJ5: {
    name: "張苡芃",
    email: "mai.chang@ichef.com.tw",
    phone: "0901-001291",
  },
};

/**
 * 取得顧問的中文顯示名稱
 * @param slackUserId Slack User ID
 * @param slackUsername Slack username (fallback)
 * @returns 中文名稱
 */
export function getConsultantDisplayName(
  slackUserId: string | null | undefined,
  slackUsername?: string | null
): string {
  // 優先使用 Slack ID 查詢
  if (slackUserId && consultantInfoMap[slackUserId]) {
    return consultantInfoMap[slackUserId].name;
  }

  // 如果沒有 Slack ID 映射，返回 username 或預設值
  if (slackUsername) {
    return slackUsername.split("@")[0];
  }

  return "iCHEF 顧問團隊";
}

/**
 * 取得顧問的完整資訊
 * @param slackUserId Slack User ID
 * @returns 顧問資訊或 undefined
 */
export function getConsultantInfo(
  slackUserId: string | null | undefined
): ConsultantInfo | undefined {
  if (!slackUserId) {
    return undefined;
  }
  return consultantInfoMap[slackUserId];
}

/**
 * 檢查是否有顧問的映射資料
 */
export function hasConsultantMapping(
  slackUserId: string | null | undefined
): boolean {
  if (!slackUserId) {
    return false;
  }
  return slackUserId in consultantInfoMap;
}

/**
 * Email -> 顧問名稱映射表（從上方 consultantInfoMap 建立）
 */
const emailToNameMap: Record<string, string> = Object.values(
  consultantInfoMap
).reduce(
  (acc, info) => {
    acc[info.email.toLowerCase()] = info.name;
    return acc;
  },
  {} as Record<string, string>
);

/**
 * 根據 email 取得顧問的中文顯示名稱
 * @param email 用戶 email
 * @param fallbackName 備用名稱（如果沒有映射）
 * @returns 中文名稱
 */
export function getDisplayNameByEmail(
  email: string | null | undefined,
  fallbackName?: string | null
): string {
  if (email) {
    const name = emailToNameMap[email.toLowerCase()];
    if (name) {
      return name;
    }
  }

  // 使用備用名稱或從 email 提取
  if (fallbackName) {
    return fallbackName;
  }
  if (email) {
    return email.split("@")[0];
  }

  return "未知用戶";
}
