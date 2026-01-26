/**
 * 解析會議摘要的 Markdown 內容
 * 將 markdown 格式轉換為結構化資料
 */

export interface ParsedSummary {
  greeting?: string;
  challenges: SummaryItem[];
  solutions: SummaryItem[];
  agreements: string[];
  actionItems: {
    ichef: string[];
    customer: string[];
  };
  closing?: string;
}

export interface SummaryItem {
  title: string;
  description?: string;
}

/**
 * 解析會議摘要的 Markdown 內容
 */
export function parseSummaryMarkdown(
  markdown: string | null
): ParsedSummary | null {
  if (!markdown) {
    return null;
  }

  const result: ParsedSummary = {
    challenges: [],
    solutions: [],
    agreements: [],
    actionItems: {
      ichef: [],
      customer: [],
    },
  };

  // 移除標題行（# [店名] x iCHEF 會議記錄）
  let content = markdown.replace(/^#\s*[^\n]*x\s*iCHEF\s*會議記錄\s*\n*/i, "");

  // 移除最後的簽名區塊
  content = content.replace(/---[\s\S]*?(iCHEF|銷售顧問|POS)[\s\S]*$/i, "");
  content = content.replace(/如有任何問題[\s\S]*$/i, "");
  content = content.replace(/祝\s*生意興隆[\s\S]*$/i, "");

  // 解析問候語
  const greetingMatch = content.match(/^(親愛的[^\n]*\n?\n?感謝您[^\n]*)/);
  if (greetingMatch) {
    result.greeting = greetingMatch[1].trim();
    content = content.replace(greetingMatch[0], "");
  }

  // 分割各區塊
  const sections = content.split(/##\s*/);

  for (const section of sections) {
    if (!section.trim()) {
      continue;
    }

    // 解析挑戰/痛點區塊
    if (
      section.includes("挑戰") ||
      section.includes("痛點") ||
      section.includes("🔍")
    ) {
      result.challenges = parseListItems(section);
    }
    // 解析解決方案區塊
    else if (
      section.includes("協助") ||
      section.includes("解決") ||
      section.includes("💡")
    ) {
      result.solutions = parseListItems(section);
    }
    // 解析共識區塊
    else if (
      section.includes("共識") ||
      section.includes("決議") ||
      section.includes("✅")
    ) {
      result.agreements = parseSimpleList(section);
    }
    // 解析待辦事項區塊
    else if (section.includes("待辦") || section.includes("📋")) {
      const ichefMatch = section.match(/【iCHEF[^】]*】([\s\S]*?)(?=【|$)/i);
      const customerMatch = section.match(
        /【[老闆您這邊|客戶][^】]*】([\s\S]*?)(?=【|$)/i
      );

      if (ichefMatch) {
        result.actionItems.ichef = parseSimpleList(ichefMatch[1]);
      }
      if (customerMatch) {
        result.actionItems.customer = parseSimpleList(customerMatch[1]);
      }

      // 如果沒有明確分組，嘗試從整個區塊解析
      if (
        result.actionItems.ichef.length === 0 &&
        result.actionItems.customer.length === 0
      ) {
        const items = parseSimpleList(section);
        // 預設全部歸為 iCHEF 待辦
        result.actionItems.ichef = items;
      }
    }
  }

  return result;
}

/**
 * 解析帶有標題和描述的列表項目
 */
function parseListItems(text: string): SummaryItem[] {
  const items: SummaryItem[] = [];
  // 匹配 "- **標題**: 描述" 或 "- **標題**：描述" 格式
  const matches = text.matchAll(/[-•]\s*\*\*([^*]+)\*\*[：:]\s*([^\n]+)/g);

  for (const match of matches) {
    items.push({
      title: match[1].trim(),
      description: match[2].trim(),
    });
  }

  // 如果沒有找到帶描述的格式，嘗試解析簡單列表
  if (items.length === 0) {
    const simpleMatches = text.matchAll(/[-•]\s*\*\*([^*]+)\*\*/g);
    for (const match of simpleMatches) {
      items.push({ title: match[1].trim() });
    }
  }

  // 最後嘗試解析純文字列表
  if (items.length === 0) {
    const lines = text.split("\n");
    for (const line of lines) {
      const match = line.match(/^[-•]\s*(.+)/);
      if (match) {
        items.push({ title: match[1].trim() });
      }
    }
  }

  return items;
}

/**
 * 解析簡單列表（沒有標題/描述區分）
 */
function parseSimpleList(text: string): string[] {
  const items: string[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    // 匹配 "- 內容" 或 "• 內容" 格式
    const match = line.match(/^[-•]\s*(.+)/);
    if (match) {
      // 移除 markdown 格式
      let item = match[1].trim();
      item = item.replace(/\*\*/g, "").replace(/\*/g, "");
      items.push(item);
    }
  }

  return items;
}

/**
 * 清理並格式化摘要文字（移除 markdown 符號）
 */
export function cleanMarkdownText(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/#+\s*/g, "")
    .replace(/`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}
