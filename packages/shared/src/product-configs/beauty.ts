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
        { value: "hair_salon", label: "美髮沙龍", emoji: "💇" },
        { value: "nail_salon", label: "美甲店", emoji: "💅" },
        { value: "beauty_spa", label: "美容SPA", emoji: "🧖" },
        { value: "tattoo", label: "刺青", emoji: "🎨" },
        { value: "massage", label: "按摩", emoji: "💆" },
        { value: "other", label: "其他", emoji: "✨" },
      ],
    },

    staffCount: {
      label: "員工數量",
      required: true,
      options: [
        { value: "1-3", label: "1-3人", emoji: "👤" },
        { value: "4-10", label: "4-10人", emoji: "👥" },
        { value: "11-20", label: "11-20人", emoji: "👨‍👩‍👧" },
        { value: "20+", label: "20人以上", emoji: "👨‍👩‍👧‍👦" },
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
    demoMetaFields: ["beautyType", "staffCount", "currentBeautySystem"],
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
