/**
 * Agent 4 (Summary Agent) 修復驗證測試
 * 測試新的 Agent4Output 類型和 JSON 輸出格式
 */

import { createSummaryAgent } from "../packages/services/src/llm/agents.js";
import { GeminiClient } from "../packages/services/src/llm/gemini.js";
import type {
  Agent4Output,
  AnalysisState,
} from "../packages/services/src/llm/types.js";

async function testAgent4Fix() {
  console.log("🧪 測試 Agent 4 修復");
  console.log("=".repeat(80));
  console.log();

  // 1. 檢查環境變數
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ 錯誤: 缺少 GEMINI_API_KEY 環境變數");
    process.exit(1);
  }

  // 2. 建立 Gemini client
  const geminiClient = new GeminiClient(process.env.GEMINI_API_KEY, {
    defaultModel: "gemini-2.5-flash",
  });

  // 3. 建立 Summary Agent
  const summaryAgent = createSummaryAgent(geminiClient);

  // 4. 準備測試資料
  const testState: AnalysisState = {
    transcript: [
      {
        speaker: "業務",
        text: "王老闆您好,今天想跟您介紹我們 iCHEF 的 POS 系統",
        timestamp: 0,
        start: 0,
        end: 5,
      },
      {
        speaker: "客戶",
        text: "好的,我現在用的是 XX 品牌,最近報表功能很慢,想了解看看",
        timestamp: 5,
        start: 5,
        end: 10,
      },
      {
        speaker: "業務",
        text: "了解,我們的報表是即時的,您隨時都可以在手機上查看營業狀況",
        timestamp: 10,
        start: 10,
        end: 15,
      },
      {
        speaker: "客戶",
        text: "這個不錯!員工訓練會不會很麻煩?",
        timestamp: 15,
        start: 15,
        end: 20,
      },
      {
        speaker: "業務",
        text: "我們有專業的客服團隊,會一對一教學,大概 2-3 小時就能上手",
        timestamp: 20,
        start: 20,
        end: 25,
      },
      {
        speaker: "客戶",
        text: "好的,那月費大概多少?",
        timestamp: 25,
        start: 25,
        end: 30,
      },
      {
        speaker: "業務",
        text: "基本方案是 3000 元/月,包含基本功能和客服支援",
        timestamp: 30,
        start: 30,
        end: 35,
      },
      {
        speaker: "客戶",
        text: "了解,讓我考慮一下",
        timestamp: 35,
        start: 35,
        end: 40,
      },
    ],
    metadata: {
      leadId: "test-lead-1",
      conversationId: "test-conv-1",
      salesRep: "張業務",
      conversationDate: new Date(),
    },
    contextData: {
      meetingType: "Demo",
      decisionMakers: [
        {
          name: "王老闆",
          role: "Owner",
          present: true,
        },
      ],
      constraints: {
        budget: "3000-5000/月",
        timeline: "1個月內決定",
      },
      storeInfo: {
        name: "王記餐廳",
        type: "餐廳",
      },
      competitorMentions: ["XX 品牌"],
    },
    buyerData: {
      meddicScores: {
        metrics: 70,
        economicBuyer: 90,
        decisionCriteria: 60,
        decisionProcess: 50,
        identifyPain: 80,
        champion: 60,
      },
      dimensions: "identifyPain",
      overallScore: 68,
      qualificationStatus: "Medium",
      needsIdentified: true,
      painPoints: ["報表功能慢", "員工訓練成本"],
      trustAssessment: {
        level: "Medium",
        indicators: ["初次接觸", "有興趣了解"],
      },
    },
    sellerData: {
      salesPerformance: {
        strengths: ["清楚說明報表功能", "回應客戶訓練疑慮"],
        weaknesses: ["未強調 ROI", "未建立急迫性"],
        missedOpportunities: ["未追問現有系統痛點"],
      },
      recommendedActions: [
        {
          action: "追蹤報表痛點細節",
          priority: "High",
          rationale: "客戶提到報表慢是主要痛點",
        },
      ],
    },
    refinementCount: 0,
    maxRefinements: 2,
    hasCompetitor: true,
    competitorKeywords: ["XX 品牌"],
  };

  console.log("📝 測試資料準備完成");
  console.log(`  - 對話片段: ${testState.transcript.length} 句`);
  console.log(`  - 痛點: ${testState.buyerData?.painPoints.join(", ")}`);
  console.log();

  // 5. 執行 Summary Agent
  console.log("🤖 執行 Summary Agent...");
  const startTime = Date.now();

  try {
    const updatedState = await summaryAgent.execute(testState);
    const executionTime = Date.now() - startTime;

    console.log(`✅ 執行成功 (${executionTime}ms)`);
    console.log();

    // 6. 驗證結果
    if (!updatedState.summaryData) {
      throw new Error("summaryData 為空");
    }

    const summaryData: Agent4Output = updatedState.summaryData;

    console.log("📊 驗證結果:");
    console.log();

    // 6.1 檢查必要欄位
    const requiredFields = [
      "sms_text",
      "hook_point",
      "tone_used",
      "character_count",
      "markdown",
      "pain_points",
      "solutions",
      "key_decisions",
      "action_items",
    ];

    let allFieldsPresent = true;
    for (const field of requiredFields) {
      const present = field in summaryData;
      console.log(
        `  ${present ? "✅" : "❌"} ${field}: ${present ? "存在" : "缺少"}`
      );
      if (!present) allFieldsPresent = false;
    }
    console.log();

    if (!allFieldsPresent) {
      throw new Error("缺少必要欄位");
    }

    // 6.2 驗證 SMS 內容
    console.log("📱 SMS 驗證:");
    console.log(`  內容: ${summaryData.sms_text}`);
    console.log(`  字數: ${summaryData.character_count} 字`);
    console.log("  目標: 50-60 字 (不含 [SHORT_URL])");

    const smsWithoutUrl = summaryData.sms_text.replace(/\[SHORT_URL\]/g, "");
    const actualCharCount = smsWithoutUrl.length;
    const inRange = actualCharCount >= 50 && actualCharCount <= 60;

    console.log(`  實際字數: ${actualCharCount} 字 ${inRange ? "✅" : "⚠️"}`);
    console.log();

    // 6.3 驗證 Hook Point
    console.log("🎯 Hook Point:");
    console.log(`  興趣點: ${summaryData.hook_point.customer_interest}`);
    console.log(`  客戶原話: "${summaryData.hook_point.customer_quote}"`);
    console.log();

    // 6.4 驗證 Markdown
    console.log("📝 Markdown 摘要:");
    const markdownLines = summaryData.markdown.split("\n").length;
    console.log(`  行數: ${markdownLines}`);
    console.log(
      `  包含標題: ${summaryData.markdown.includes("#") ? "✅" : "❌"}`
    );
    console.log(
      `  包含待辦: ${summaryData.markdown.includes("待辦") ? "✅" : "❌"}`
    );
    console.log();

    // 6.5 驗證陣列欄位
    console.log("📋 陣列欄位:");
    console.log(`  痛點: ${summaryData.pain_points.length} 項`);
    summaryData.pain_points.forEach((p, i) =>
      console.log(`    ${i + 1}. ${p}`)
    );
    console.log(`  解決方案: ${summaryData.solutions.length} 項`);
    summaryData.solutions.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
    console.log(`  決議: ${summaryData.key_decisions.length} 項`);
    summaryData.key_decisions.forEach((d, i) =>
      console.log(`    ${i + 1}. ${d}`)
    );
    console.log();

    // 6.6 驗證待辦事項
    console.log("✅ 待辦事項:");
    console.log(`  iCHEF: ${summaryData.action_items.ichef.length} 項`);
    summaryData.action_items.ichef.forEach((a, i) =>
      console.log(`    ${i + 1}. ${a}`)
    );
    console.log(`  客戶: ${summaryData.action_items.customer.length} 項`);
    summaryData.action_items.customer.forEach((a, i) =>
      console.log(`    ${i + 1}. ${a}`)
    );
    console.log();

    // 7. 總結
    console.log("=".repeat(80));
    console.log("🎉 測試通過!");
    console.log();
    console.log("✅ Agent 4 修復驗證成功:");
    console.log("  - 新的 Agent4Output 類型定義正確");
    console.log("  - JSON 輸出格式符合預期");
    console.log("  - 所有必要欄位都存在");
    console.log("  - Gemini 2.5 Flash 正確返回 JSON");
    console.log();
  } catch (error) {
    console.error("❌ 測試失敗:");
    console.error(error);
    process.exit(1);
  }
}

// 執行測試
testAgent4Fix().catch((error) => {
  console.error("💥 未預期的錯誤:", error);
  process.exit(1);
});
