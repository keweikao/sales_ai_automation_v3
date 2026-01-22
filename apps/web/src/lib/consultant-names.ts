/**
 * 顧問名稱映射配置
 * 將 Slack username 映射到中文顯示名稱
 */

const consultantNameMap: Record<string, string> = {
  // 在此添加 Slack username -> 中文名稱的映射
  // 例如：
  // "john.doe": "王大明",
  // "jane.smith": "李小華",
};

/**
 * 取得顧問的中文顯示名稱
 * @param slackUsername Slack username
 * @returns 中文名稱，如果沒有映射則返回原始 username
 */
export function getConsultantDisplayName(
  slackUsername: string | null | undefined
): string {
  if (!slackUsername) {
    return "iCHEF 顧問團隊";
  }

  // 如果有中文名稱映射，使用映射名稱
  const chineseName = consultantNameMap[slackUsername];
  if (chineseName) {
    return chineseName;
  }

  // 否則返回原始 username（去除可能的 email 後綴）
  return slackUsername.split("@")[0];
}

/**
 * 檢查是否有顧問的中文名稱映射
 */
export function hasConsultantMapping(
  slackUsername: string | null | undefined
): boolean {
  if (!slackUsername) return false;
  return slackUsername in consultantNameMap;
}
