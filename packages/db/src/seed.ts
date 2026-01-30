/**
 * 資料庫 Seed 腳本
 *
 * 用於建立測試環境的初始資料
 * 使用方式：bun run db:seed
 */

import { eq } from "drizzle-orm";
import { getDb } from "./index";
import {
  alerts,
  competitorInfo,
  conversations,
  meddicAnalyses,
  opportunities,
  salesTodos,
  talkTracks,
  user,
} from "./schema";
import { generateCaseNumber } from "./utils/id-generator";

// 設定測試環境
process.env.NODE_ENV = "test";

// 測試資料 ID（使用固定 ID 以便測試時參照）
const TEST_USER_ID = "test-user-001";
const TEST_USER_2_ID = "test-user-002";
const TEST_MANAGER_ID = "test-manager-001";

// 生成 UUID
function generateId(): string {
  return crypto.randomUUID();
}

// 清理測試資料
async function cleanDatabase(db: Awaited<ReturnType<typeof getDb>>) {
  console.log("🧹 清理現有測試資料...");

  // 按照外鍵關係的相反順序刪除
  await db.delete(alerts);
  await db.delete(salesTodos);
  await db.delete(meddicAnalyses);
  await db.delete(conversations);
  await db.delete(opportunities);
  await db.delete(talkTracks);
  await db.delete(competitorInfo);

  // 刪除測試用戶（會級聯刪除相關資料）
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
  await db.delete(user).where(eq(user.id, TEST_USER_2_ID));
  await db.delete(user).where(eq(user.id, TEST_MANAGER_ID));

  console.log("✅ 清理完成");
}

// 建立測試用戶
async function seedUsers(db: Awaited<ReturnType<typeof getDb>>) {
  console.log("👤 建立測試用戶...");

  await db.insert(user).values([
    {
      id: TEST_USER_ID,
      name: "測試業務員",
      email: "test-sales@example.com",
      emailVerified: true,
    },
    {
      id: TEST_USER_2_ID,
      name: "測試業務員二號",
      email: "test-sales-2@example.com",
      emailVerified: true,
    },
    {
      id: TEST_MANAGER_ID,
      name: "測試經理",
      email: "test-manager@example.com",
      emailVerified: true,
    },
  ]);

  console.log("✅ 用戶建立完成");
}

// 建立測試機會
async function seedOpportunities(db: Awaited<ReturnType<typeof getDb>>) {
  console.log("💼 建立測試機會...");

  const opportunityData = [
    {
      id: generateId(),
      userId: TEST_USER_ID,
      productLine: "ichef",
      customerNumber: "202601-000001",
      companyName: "測試餐廳 A",
      contactName: "王老闆",
      contactPhone: "0912345678",
      status: "qualified",
      storeType: "restaurant",
      currentSystem: "none",
    },
    {
      id: generateId(),
      userId: TEST_USER_ID,
      productLine: "ichef",
      customerNumber: "202601-000002",
      companyName: "測試咖啡廳 B",
      contactName: "李老闆",
      contactPhone: "0923456789",
      status: "proposal",
      storeType: "cafe",
      currentSystem: "competitor",
    },
    {
      id: generateId(),
      userId: TEST_USER_2_ID,
      productLine: "beauty",
      customerNumber: "202601-000003",
      companyName: "測試美甲店 C",
      contactName: "陳老闆",
      contactPhone: "0934567890",
      status: "new",
      storeType: "nail_salon",
      currentSystem: "excel",
    },
    {
      id: generateId(),
      userId: TEST_USER_ID,
      productLine: "ichef",
      customerNumber: "202601-000004",
      companyName: "高分機會餐廳",
      contactName: "張老闆",
      contactPhone: "0945678901",
      status: "negotiation",
      storeType: "restaurant",
      currentSystem: "none",
      meddicScore: {
        overall: 85,
        dimensions: {
          metrics: 4,
          economicBuyer: 5,
          decisionCriteria: 4,
          decisionProcess: 4,
          identifyPain: 5,
          champion: 4,
        },
      },
    },
    {
      id: generateId(),
      userId: TEST_USER_ID,
      productLine: "ichef",
      customerNumber: "202601-000005",
      companyName: "低分機會餐廳",
      contactName: "林老闆",
      contactPhone: "0956789012",
      status: "contacted",
      storeType: "fast_food",
      currentSystem: "other",
      meddicScore: {
        overall: 35,
        dimensions: {
          metrics: 2,
          economicBuyer: 1,
          decisionCriteria: 2,
          decisionProcess: 2,
          identifyPain: 2,
          champion: 1,
        },
      },
    },
  ];

  await db.insert(opportunities).values(opportunityData);
  console.log(`✅ 建立 ${opportunityData.length} 個測試機會`);

  return opportunityData;
}

// 建立測試對話
async function seedConversations(
  db: Awaited<ReturnType<typeof getDb>>,
  opportunityList: Array<{ id: string; productLine: string }>
) {
  console.log("💬 建立測試對話...");

  const conversationData = [];

  for (let i = 0; i < Math.min(3, opportunityList.length); i++) {
    const opp = opportunityList[i];
    const productLine = opp.productLine as "ichef" | "beauty";

    conversationData.push({
      id: generateId(),
      opportunityId: opp.id,
      caseNumber: generateCaseNumber("202601", i + 1, productLine),
      productLine,
      status: "completed" as const,
      transcriptStatus: "completed" as const,
      analysisStatus: "completed" as const,
      transcript: {
        segments: [
          {
            speaker: "sales",
            text: "您好，我是 iCHEF 的業務代表。",
            start: 0,
            end: 3,
          },
          {
            speaker: "customer",
            text: "你好，我想了解一下你們的系統。",
            start: 3,
            end: 7,
          },
          {
            speaker: "sales",
            text: "好的，請問您目前餐廳使用什麼系統呢？",
            start: 7,
            end: 11,
          },
        ],
        fullText:
          "您好，我是 iCHEF 的業務代表。你好，我想了解一下你們的系統。好的，請問您目前餐廳使用什麼系統呢？",
        language: "zh-TW",
      },
      audioUrl: `https://test-bucket.r2.dev/test-audio-${i + 1}.mp3`,
      durationSeconds: 180,
    });
  }

  await db.insert(conversations).values(conversationData);
  console.log(`✅ 建立 ${conversationData.length} 個測試對話`);

  return conversationData;
}

// 建立測試 MEDDIC 分析
async function seedMeddicAnalyses(
  db: Awaited<ReturnType<typeof getDb>>,
  conversationList: Array<{ id: string }>
) {
  console.log("📊 建立測試 MEDDIC 分析...");

  const analysisData = conversationList.map((conv, index) => ({
    id: generateId(),
    conversationId: conv.id,
    version: 1,

    // MEDDIC 六維度
    metricsScore: 3 + (index % 2),
    metricsEvidence: "客戶提到每月營業額約 50 萬，希望提升 10%",
    metricsQuestions: ["具體的 KPI 目標是什麼？", "如何衡量成功？"],

    economicBuyerScore: 2 + index,
    economicBuyerEvidence: "老闆本人出席會議",
    economicBuyerQuestions: ["是否還有其他決策者？"],

    decisionCriteriaScore: 3,
    decisionCriteriaEvidence: "重視穩定性和售後服務",
    decisionCriteriaQuestions: ["價格在決策中的權重？"],

    decisionProcessScore: 3,
    decisionProcessEvidence: "預計下個月做決定",
    decisionProcessQuestions: ["有沒有評估其他方案？"],

    identifyPainScore: 4,
    identifyPainEvidence: "目前手寫單據容易出錯，結帳慢",
    identifyPainQuestions: ["這個問題造成多少損失？"],

    championScore: 2 + (index % 3),
    championEvidence: "店長對新系統很有興趣",
    championQuestions: ["店長能影響老闆的決定嗎？"],

    // 整體評分
    overallScore: 55 + index * 10,
    overallSummary: `這是第 ${index + 1} 個測試對話的 MEDDIC 分析摘要。`,
    nextActions: ["安排產品演示", "提供報價單", "確認決策時程"],

    // 競品分析
    competitorAnalysis: {
      mentioned: ["競品 A"],
      threats: ["價格較低"],
      counterStrategies: ["強調服務品質"],
    },
  }));

  await db.insert(meddicAnalyses).values(analysisData);
  console.log(`✅ 建立 ${analysisData.length} 個測試 MEDDIC 分析`);
}

// 建立測試警示
async function seedAlerts(
  db: Awaited<ReturnType<typeof getDb>>,
  opportunityList: Array<{ id: string }>
) {
  console.log("🚨 建立測試警示...");

  const alertData = [
    {
      id: generateId(),
      opportunityId: opportunityList[3]?.id, // 高分機會
      type: "close_now" as const,
      severity: "high" as const,
      title: "立即成交機會",
      description: "MEDDIC 分數達 85 分，Champion 積極，建議立即安排簽約會議",
      status: "pending" as const,
    },
    {
      id: generateId(),
      opportunityId: opportunityList[4]?.id, // 低分機會
      type: "missing_dm" as const,
      severity: "medium" as const,
      title: "缺少決策者",
      description: "已進行 2 次對話但尚未接觸到經濟決策者",
      status: "pending" as const,
    },
  ];

  const validAlerts = alertData.filter((a) => a.opportunityId);
  if (validAlerts.length > 0) {
    await db.insert(alerts).values(validAlerts);
  }
  console.log(`✅ 建立 ${validAlerts.length} 個測試警示`);
}

// 建立測試待辦
async function seedTodos(
  db: Awaited<ReturnType<typeof getDb>>,
  opportunityList: Array<{ id: string }>
) {
  console.log("📝 建立測試待辦...");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const todoData = [
    {
      id: generateId(),
      opportunityId: opportunityList[0]?.id,
      userId: TEST_USER_ID,
      title: "跟進報價單",
      description: "確認客戶是否收到報價單，回答疑問",
      priority: "high" as const,
      status: "pending" as const,
      dueDate: tomorrow,
    },
    {
      id: generateId(),
      opportunityId: opportunityList[1]?.id,
      userId: TEST_USER_ID,
      title: "安排產品演示",
      description: "與客戶約定產品演示時間",
      priority: "medium" as const,
      status: "pending" as const,
      dueDate: nextWeek,
    },
    {
      id: generateId(),
      opportunityId: opportunityList[2]?.id,
      userId: TEST_USER_2_ID,
      title: "首次聯繫",
      description: "打電話給新客戶進行初步了解",
      priority: "medium" as const,
      status: "pending" as const,
      dueDate: tomorrow,
    },
  ];

  const validTodos = todoData.filter((t) => t.opportunityId);
  if (validTodos.length > 0) {
    await db.insert(salesTodos).values(validTodos);
  }
  console.log(`✅ 建立 ${validTodos.length} 個測試待辦`);
}

// 建立測試話術
async function seedTalkTracks(db: Awaited<ReturnType<typeof getDb>>) {
  console.log("🎤 建立測試話術...");

  const talkTrackData = [
    {
      id: generateId(),
      productLine: "ichef",
      situation: "price_objection",
      customerType: "calculating",
      storeType: "restaurant",
      talkTrack:
        "我理解您對價格的考量。讓我們算一筆帳：假設每天少 5 筆點錯單的情況，一個月就能省下...",
      successRate: 65,
      usageCount: 42,
      isActive: true,
    },
    {
      id: generateId(),
      productLine: "ichef",
      situation: "competitor_comparison",
      customerType: "impulsive",
      storeType: "cafe",
      talkTrack:
        "您提到的那個系統確實價格較低，但我們有幾個他們沒有的功能，特別是在報表分析方面...",
      successRate: 58,
      usageCount: 28,
      isActive: true,
    },
    {
      id: generateId(),
      productLine: "beauty",
      situation: "need_to_ask_boss",
      customerType: "conservative",
      storeType: "nail_salon",
      talkTrack:
        "完全理解！要不這樣，我準備一份簡報讓您帶回去給老闆看，上面有我們客戶的實際案例...",
      successRate: 52,
      usageCount: 15,
      isActive: true,
    },
  ];

  await db.insert(talkTracks).values(talkTrackData);
  console.log(`✅ 建立 ${talkTrackData.length} 個測試話術`);
}

// 建立測試競品資訊
async function seedCompetitorInfo(db: Awaited<ReturnType<typeof getDb>>) {
  console.log("🏢 建立測試競品資訊...");

  const competitorData = [
    {
      id: generateId(),
      productLine: "ichef",
      competitorName: "競品 A",
      strengths: ["價格較低", "介面簡單"],
      weaknesses: ["功能較少", "客服回應慢"],
      ourAdvantages: ["完整報表功能", "24/7 客服支援", "穩定性高"],
      counterTalkTracks: [
        "雖然他們價格較低，但我們的報表功能每月能幫您省下會計費用...",
        "我們有 24 小時客服，營業時間遇到問題不用等...",
      ],
      switchingCases: [
        {
          customerName: "某知名連鎖店",
          reason: "原系統不穩定導致營業損失",
          outcome: "切換後穩定運行一年",
        },
      ],
      isActive: true,
    },
    {
      id: generateId(),
      productLine: "beauty",
      competitorName: "競品 B",
      strengths: ["專注美業", "預約功能強"],
      weaknesses: ["沒有庫存管理", "報表不完整"],
      ourAdvantages: ["完整庫存管理", "會員經營工具", "多店管理"],
      counterTalkTracks: [
        "我們的庫存管理功能能幫您追蹤產品使用量，避免缺貨...",
      ],
      switchingCases: [],
      isActive: true,
    },
  ];

  await db.insert(competitorInfo).values(competitorData);
  console.log(`✅ 建立 ${competitorData.length} 個測試競品資訊`);
}

// 主程式
async function main() {
  console.log("🌱 開始 Seed 資料庫...\n");

  try {
    const db = await getDb();

    // 清理舊資料
    await cleanDatabase(db);

    // 依序建立測試資料
    await seedUsers(db);
    const opportunityList = await seedOpportunities(db);
    const conversationList = await seedConversations(db, opportunityList);
    await seedMeddicAnalyses(db, conversationList);
    await seedAlerts(db, opportunityList);
    await seedTodos(db, opportunityList);
    await seedTalkTracks(db);
    await seedCompetitorInfo(db);

    console.log("\n🎉 Seed 完成！");
    console.log("=====================================");
    console.log("👤 用戶：3 個");
    console.log(`💼 機會：${opportunityList.length} 個`);
    console.log(`💬 對話：${conversationList.length} 個`);
    console.log(`📊 MEDDIC 分析：${conversationList.length} 個`);
    console.log("🚨 警示：2 個");
    console.log("📝 待辦：3 個");
    console.log("🎤 話術：3 個");
    console.log("🏢 競品資訊：2 個");
    console.log("=====================================\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed 失敗:", error);
    process.exit(1);
  }
}

main();
