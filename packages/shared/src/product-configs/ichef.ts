import type { ProductLineConfig } from "./types";

export const ichefConfig: ProductLineConfig = {
  id: "ichef",
  name: "ichef",
  displayName: "iCHEF POS 系統",

  formFields: {
    storeType: {
      label: "店型",
      required: true,
      options: [
        {
          value: "light_food_cafe_drink",
          label: "輕食/咖啡/飲料",
          emoji: "☕",
        },
        { value: "general_restaurant", label: "一般餐廳", emoji: "🍽️" },
        { value: "fast_food", label: "快餐", emoji: "🍟" },
        { value: "hotpot_bbq_nightclub", label: "火鍋/燒肉/夜場", emoji: "🔥" },
        { value: "non_food", label: "非餐飲", emoji: "🏢" },
      ],
    },

    serviceType: {
      label: "營運型態",
      required: true,
      options: [
        { value: "dine_in", label: "內用為主", emoji: "🪑" },
        { value: "takeout", label: "外帶為主", emoji: "🥡" },
        { value: "delivery", label: "外送為主", emoji: "🛵" },
        { value: "mixed", label: "混合經營", emoji: "🔄" },
      ],
    },

    currentSystem: {
      label: "現有POS系統",
      required: true,
      options: [
        { value: "none", label: "無", emoji: "🆕" },
        { value: "ichef_old", label: "iCHEF舊版", emoji: "📟" },
        { value: "dudoo", label: "Dudoo", emoji: "🦆" },
        { value: "365", label: "365", emoji: "📱" },
        { value: "damai", label: "大麥", emoji: "💳" },
        { value: "other", label: "其他", emoji: "❓" },
      ],
    },
  },

  prompts: {
    globalContext: "iCHEF POS System for Restaurant",
    productContext: "F&B Industry, Independent Owners",
    commitmentEvents: [
      {
        id: "CE1",
        name: "Time",
        definition: "Schedule install/onboarding meeting (預約安裝時間)",
      },
      {
        id: "CE2",
        name: "Data",
        definition: "Submit menu/table/inventory data for setup (提交菜單資料)",
      },
      {
        id: "CE3",
        name: "Money",
        definition: "Sign contract/Pay deposit (簽約/付訂金)",
      },
    ],
    demoMetaFields: ["storeType", "serviceType", "currentPos"],
  },

  talkTracks: {
    situations: [
      { id: "price_objection", name: "價格異議", description: "客戶認為太貴" },
      {
        id: "competitor_comparison",
        name: "競品比較",
        description: "與其他POS比較",
      },
      { id: "feature_inquiry", name: "功能詢問", description: "詢問特定功能" },
      {
        id: "implementation_concern",
        name: "導入顧慮",
        description: "擔心實施困難",
      },
      {
        id: "contract_negotiation",
        name: "合約協商",
        description: "合約條款討論",
      },
      { id: "decision_delay", name: "決策拖延", description: "想要再考慮" },
      { id: "staff_resistance", name: "員工抗拒", description: "員工不想用" },
      { id: "data_migration", name: "資料轉移", description: "擔心資料轉移" },
    ],
  },
};
