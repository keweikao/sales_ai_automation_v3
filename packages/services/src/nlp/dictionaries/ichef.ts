/**
 * iCHEF 產品線標籤字典
 * 用於客戶聲音分析的規則匹配
 */

export interface FeatureTag {
  keywords: string[];
  category: string;
}

export interface PainTag {
  keywords: string[];
  severityBoost: string[];
}

export interface CompetitorAliases {
  [key: string]: string[];
}

/**
 * iCHEF 功能標籤
 * 按照功能分類，包含關鍵詞和類別
 */
export const ICHEF_FEATURE_TAGS: Record<string, FeatureTag> = {
  // 核心功能
  pos_basic: {
    keywords: ["收銀", "結帳", "POS", "點餐", "買單", "開單"],
    category: "核心功能",
  },
  order_management: {
    keywords: ["訂單", "出單", "廚房", "KDS", "列印", "叫號", "出餐"],
    category: "核心功能",
  },
  inventory: {
    keywords: ["庫存", "進貨", "盤點", "原物料", "進銷存", "採購"],
    category: "核心功能",
  },
  reporting: {
    keywords: ["報表", "營收", "分析", "數據", "統計", "業績", "營業額"],
    category: "報表",
  },

  // 整合功能
  delivery_integration: {
    keywords: [
      "外送",
      "Uber",
      "UberEats",
      "foodpanda",
      "熊貓",
      "接單",
      "外送平台",
      "外帶",
    ],
    category: "整合",
  },
  payment: {
    keywords: [
      "行動支付",
      "Line Pay",
      "街口",
      "刷卡",
      "Apple Pay",
      "悠遊付",
      "信用卡",
      "支付",
    ],
    category: "整合",
  },
  einvoice: {
    keywords: ["電子發票", "載具", "歸戶", "發票", "雲端發票", "統編"],
    category: "整合",
  },

  // 管理功能
  staff_management: {
    keywords: ["員工", "排班", "打卡", "權限", "薪資", "人事"],
    category: "管理",
  },
  multi_store: {
    keywords: ["分店", "總部", "多店", "連鎖", "跨店", "總公司"],
    category: "管理",
  },
  crm: {
    keywords: ["會員", "集點", "儲值", "回購", "顧客", "VIP", "熟客", "常客"],
    category: "行銷",
  },
  reservation: {
    keywords: ["訂位", "預約", "候位", "排隊", "預訂"],
    category: "整合",
  },

  // 進階功能
  table_management: {
    keywords: ["桌位", "座位", "翻桌", "桌號", "併桌", "換桌"],
    category: "核心功能",
  },
  menu_management: {
    keywords: ["菜單", "品項", "套餐", "加購", "客製化", "口味"],
    category: "核心功能",
  },

  // 從 AI 分析學習的新標籤 (2026-01-31)
  stamp_card: {
    keywords: ["記杯", "集點", "點數", "會員點數", "印花", "累積"],
    category: "行銷",
  },
  multi_pot: {
    keywords: ["多鍋", "分鍋", "雙鍋", "鴛鴦鍋", "兩個鍋", "三個鍋"],
    category: "核心功能",
  },
  online_booking: {
    keywords: ["線上訂位", "網路訂位", "線上預約", "網路預約", "Google 訂位"],
    category: "整合",
  },
  qr_ordering: {
    keywords: ["掃碼點餐", "QR", "手機點餐", "自助點餐", "掃描點餐"],
    category: "核心功能",
  },
};

/**
 * iCHEF 痛點標籤
 * 包含關鍵詞和嚴重度增強詞
 */
export const ICHEF_PAIN_TAGS: Record<string, PainTag> = {
  manual_reconciliation: {
    keywords: ["對帳", "核帳", "算帳", "帳對不起來", "差額", "收支"],
    severityBoost: ["每天", "花很久", "好幾個小時", "很累", "對到很晚"],
  },
  order_errors: {
    keywords: ["漏單", "錯單", "出錯", "送錯", "key錯", "打錯", "少做"],
    severityBoost: ["常常", "一直", "每次", "客人罵", "客訴"],
  },
  slow_service: {
    keywords: ["很慢", "等很久", "排隊", "來不及", "忙不過來", "塞住"],
    severityBoost: ["客人抱怨", "客人罵", "尖峰", "午餐"],
  },
  staff_training: {
    keywords: ["教不會", "新人", "流動率", "離職", "不會用", "學很久"],
    severityBoost: ["每次", "一直", "又要教"],
  },
  data_management: {
    keywords: ["資料", "找不到", "沒記錄", "不知道", "查不到", "忘記"],
    severityBoost: ["重要", "客人問", "老闆要"],
  },
  manual_input: {
    keywords: ["手動", "手key", "手寫", "紙本", "抄", "登記"],
    severityBoost: ["每筆", "全部", "很多"],
  },
  system_issues: {
    keywords: ["當機", "卡住", "跑很慢", "不穩", "斷線", "連不上"],
    severityBoost: ["常常", "一直", "尖峰時"],
  },

  // 從 AI 分析學習的新標籤 (2026-01-31)
  platform_commission: {
    keywords: ["抽成", "平台費", "佣金", "手續費", "趴數", "平台抽"],
    severityBoost: ["太高", "很高", "吃掉", "划不來"],
  },
  no_show: {
    keywords: ["no show", "放鴿子", "訂位沒來", "爽約", "沒出現", "空桌"],
    severityBoost: ["常常", "週末", "假日", "很多"],
  },
  learning_curve: {
    keywords: ["學習曲線", "不會用", "太複雜", "要學很久", "操作複雜", "難學"],
    severityBoost: ["員工", "新人", "每次"],
  },
  hardware_cost: {
    keywords: ["機器錢", "設備費", "硬體", "買iPad", "買機器", "設備成本"],
    severityBoost: ["額外", "還要", "加上去"],
  },
};

/**
 * iCHEF 競品別名映射
 * 用於識別客戶提到的競爭品牌
 */
export const ICHEF_COMPETITORS: CompetitorAliases = {
  肚肚: ["肚肚", "dudu", "DUDU", "Dudu"],
  Eats365: ["eats365", "Eats365", "EATS365", "365"],
  微碧: ["微碧", "weiby", "WEIBY", "Weiby"],
  客立樂: ["客立樂", "KLOOK", "klook"],
  POS365: ["pos365", "POS365"],
  快一點: ["快一點", "kuaiyidian"],
  饗賓: ["饗賓", "inwin"],
  振樺: ["振樺", "posiflex"],
  NEC: ["NEC", "nec"],
};

/**
 * 獲取所有功能標籤列表（用於 AI Prompt）
 */
export function getFeatureTagList(): string {
  const lines: string[] = ["功能 (feature):"];
  for (const [tag, config] of Object.entries(ICHEF_FEATURE_TAGS)) {
    lines.push(`- ${tag}: ${config.keywords.slice(0, 3).join("/")}`);
  }
  return lines.join("\n");
}

/**
 * 獲取所有痛點標籤列表（用於 AI Prompt）
 */
export function getPainTagList(): string {
  const lines: string[] = ["痛點 (pain):"];
  for (const [tag, config] of Object.entries(ICHEF_PAIN_TAGS)) {
    lines.push(`- ${tag}: ${config.keywords.slice(0, 3).join("/")}`);
  }
  return lines.join("\n");
}
