import type { ProductLineConfig } from "./types";

export const beautyConfig: ProductLineConfig = {
  id: "beauty",
  name: "beauty",
  displayName: "美業管理系統",

  formFields: {
    storeType: {
      label: "店鋪類型",
      required: true,
      options: [
        { value: "nail_salon", label: "美甲沙龍", emoji: "💅" },
        { value: "eyelash_salon", label: "美睫沙龍", emoji: "👁️" },
        { value: "facial_skincare", label: "美容護膚", emoji: "🧖" },
        { value: "body_spa", label: "美體SPA", emoji: "💆" },
        { value: "massage_therapy", label: "按摩整復", emoji: "🙌" },
        { value: "hair_salon", label: "美髮沙龍", emoji: "💇" },
        { value: "mens_barber", label: "男士理髮", emoji: "✂️" },
        { value: "brow_tattoo", label: "霧眉紋繡", emoji: "🎨" },
        { value: "ear_cleaning", label: "採耳", emoji: "👂" },
        { value: "hair_removal", label: "除毛", emoji: "🪒" },
        { value: "fitness_yoga", label: "健身瑜伽", emoji: "🧘" },
        { value: "pet_grooming", label: "寵物美容", emoji: "🐾" },
        { value: "medical_aesthetics", label: "醫學美容", emoji: "💉" },
        { value: "counseling", label: "身心諮商", emoji: "🧠" },
        { value: "fortune_telling", label: "命理占卜", emoji: "🔮" },
        { value: "other", label: "其他", emoji: "✨" },
      ],
    },

    serviceType: {
      label: "經營型態",
      required: true,
      options: [
        { value: "solo_studio", label: "個人工作室 (1–2人)", emoji: "👤" },
        { value: "small_shop", label: "小型單店 (3–5人)", emoji: "👥" },
        { value: "medium_shop", label: "中型單店 (6–9人)", emoji: "👨‍👩‍👧" },
        {
          value: "multi_shop",
          label: "多店多人經營 (多店組織或10人以上)",
          emoji: "🏢",
        },
      ],
    },

    currentSystem: {
      label: "現有系統",
      required: true,
      options: [
        { value: "none", label: "無", emoji: "🆕" },
        { value: "excel", label: "Excel", emoji: "📊" },
        { value: "line", label: "LINE預約", emoji: "💬" },
        { value: "other_beauty", label: "其他美業系統", emoji: "📱" },
        { value: "handwritten", label: "手寫本", emoji: "📓" },
      ],
    },
  },

  prompts: {
    globalContext: "Beauty Industry Management System",
    productContext: "Beauty Salons, Independent Owners",
    commitmentEvents: [
      {
        id: "CE1",
        name: "Time",
        definition:
          "Schedule system demo/staff training (預約系統示範/員工培訓)",
      },
      {
        id: "CE2",
        name: "Data",
        definition:
          "Submit client list/service menu/pricing (提交客戶名單/服務項目/定價)",
      },
      {
        id: "CE3",
        name: "Money",
        definition: "Sign contract/Pay first month fee (簽約/付首月費用)",
      },
    ],
    demoMetaFields: ["storeType", "serviceType", "currentSystem"],
  },

  talkTracks: {
    situations: [
      { id: "price_objection", name: "價格異議", description: "客戶認為太貴" },
      {
        id: "competitor_comparison",
        name: "競品比較",
        description: "與其他系統比較",
      },
      {
        id: "feature_inquiry",
        name: "功能詢問",
        description: "詢問預約/佣金功能",
      },
      {
        id: "implementation_concern",
        name: "導入顧慮",
        description: "擔心員工不會用",
      },
      {
        id: "contract_negotiation",
        name: "合約協商",
        description: "合約條款討論",
      },
      { id: "decision_delay", name: "決策拖延", description: "想要再考慮" },
      {
        id: "staff_resistance",
        name: "員工抗拒",
        description: "員工不想用新系統",
      },
      {
        id: "data_migration",
        name: "客戶資料轉移",
        description: "擔心客戶資料轉移",
      },
    ],
  },
};
