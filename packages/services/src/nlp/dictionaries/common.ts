/**
 * 共用模式字典
 * 適用於所有產品線的標籤和模式
 */

export interface ObjectionTag {
  keywords: string[];
}

/**
 * 異議標籤 - 所有產品線共用
 */
export const OBJECTION_TAGS: Record<string, ObjectionTag> = {
  price: {
    keywords: [
      "太貴",
      "預算",
      "成本",
      "便宜",
      "划不划算",
      "值不值得",
      "CP值",
      "價格",
    ],
  },
  switching_cost: {
    keywords: [
      "很麻煩",
      "要重來",
      "資料搬",
      "員工學",
      "習慣了",
      "適應",
      "轉換",
    ],
  },
  timing: {
    keywords: [
      "現在不行",
      "等一下",
      "過完年",
      "之後再說",
      "忙季",
      "淡季",
      "年底",
    ],
  },
  authority: {
    keywords: [
      "問老闆",
      "做不了主",
      "要討論",
      "股東",
      "合夥人",
      "老婆",
      "家人",
    ],
  },
  competitor_preference: {
    keywords: ["已經用", "在比較", "別人", "其他家", "朋友推薦", "比較看看"],
  },
  trust: {
    keywords: ["不確定", "怕", "擔心", "萬一", "保障", "售後"],
  },
};

/**
 * 「看起來重要」的啟發式模式
 * 用於判斷句子是否值得送 AI 分析
 */
export const IMPORTANCE_PATTERNS = {
  // 描述客戶行為/需求
  customerNeed: [
    /客人(問|說|要|想|希望|反應|抱怨|建議)/,
    /有沒有.*(功能|辦法|方式|可以)/,
    /可不可以/,
    /能不能/,
    /怎麼.*[？?]/,
    /如果.*就好了/,
    /希望/,
    /需要/,
    /想要/,
  ] as RegExp[],

  // 外部平台提及
  externalPlatform: [
    /LINE|FB|Facebook|IG|Instagram|Google|Uber|foodpanda/i,
    /蝦皮|PChome|momo|Yahoo/,
    /Excel|Word|紙本|手寫/,
  ] as RegExp[],

  // 問題情境
  problemContext: [
    /常常/,
    /每次/,
    /都會/,
    /一直/,
    /很麻煩/,
    /不知道/,
    /找不到/,
    /忘記/,
    /來不及/,
  ] as RegExp[],

  // 量化描述
  quantification: /\d+[次小時分鐘天週月年萬元塊%筆個位]/,

  // 情緒強烈
  strongEmotion: [
    /很|超|太|非常|真的|實在/,
    /煩|累|痛苦|受不了|頭痛|崩潰/,
    /爽|讚|方便|省|快/,
  ] as RegExp[],
};

/**
 * 跳過模式
 * 用於過濾無意義的短句或回應詞
 */
export const SKIP_PATTERNS = {
  responseWords: [
    "好",
    "嗯",
    "對",
    "是",
    "OK",
    "了解",
    "知道了",
    "謝謝",
    "好的",
    "沒問題",
    "ok",
    "Ok",
    "喔",
    "哦",
    "欸",
    "ㄜ",
    "ㄟ",
    "恩",
    "恩恩",
    "嗯嗯",
    "對對",
    "對對對",
    "好好",
    "好好好",
  ],
  minLength: 6,
  maxLength: 150,
};

/**
 * 獲取異議標籤列表（用於 AI Prompt）
 */
export function getObjectionTagList(): string {
  const lines: string[] = ["異議 (objection):"];
  for (const [tag, config] of Object.entries(OBJECTION_TAGS)) {
    lines.push(`- ${tag}: ${config.keywords.slice(0, 3).join("/")}`);
  }
  return lines.join("\n");
}
