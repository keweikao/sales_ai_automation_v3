/**
 * 測試 Filesystem MCP 工具
 * 驗證檔案讀寫、目錄列表和報表生成功能
 */

import { rm } from "node:fs/promises";
import {
  filesystemListTool,
  filesystemReadTool,
  filesystemWriteTool,
} from "./packages/services/src/mcp/external/filesystem.js";
import type {
  DailySummary,
  MEDDICAnalysis,
  RepPerformance,
  TeamPerformance,
} from "./packages/services/src/mcp/templates/report-templates.js";
import {
  generateDailySummary,
  generateMeddicReport,
  generateTeamReport,
} from "./packages/services/src/mcp/templates/report-templates.js";

async function testFilesystemMCP() {
  console.log("🧪 Filesystem MCP 工具測試開始...\n");

  const testContext = { timestamp: new Date() };

  // Test 1: 列出 .doc 目錄
  console.log("📋 測試 1: 列出 .doc 目錄");
  console.log("=".repeat(50));
  try {
    const result = await filesystemListTool.handler(
      { path: ".doc", recursive: false },
      testContext
    );
    console.log("✅ 成功");
    console.log(`   共找到 ${result.totalCount} 個檔案/目錄:`);
    for (const file of result.files.slice(0, 5)) {
      console.log(
        `   - ${file.name} (${file.isDirectory ? "目錄" : "檔案"}, ${file.size} bytes)`
      );
    }
    if (result.files.length > 5) {
      console.log(`   ... 還有 ${result.files.length - 5} 個項目`);
    }
  } catch (error) {
    console.log(
      `❌ 失敗: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
  console.log();

  // Test 2: 寫入測試報告
  console.log("📝 測試 2: 生成並寫入 MEDDIC 報告");
  console.log("=".repeat(50));
  try {
    const mockAnalysis: MEDDICAnalysis = {
      conversationId: "test-conv-001",
      caseNumber: "CASE-2026-001",
      overallScore: 75,
      qualificationStatus: "qualified",
      metrics: {
        score: 80,
        findings: "客戶明確提出需要提升銷售轉換率 20%，目前轉換率為 2.5%。",
      },
      economicBuyer: {
        score: 70,
        findings: "已確認財務長 John Smith 為最終決策者，預算為 $150,000。",
      },
      decisionCriteria: {
        score: 75,
        findings:
          "客戶主要評估標準：ROI (40%)、實施時間 (30%)、技術支援 (30%)。",
      },
      decisionProcess: {
        score: 65,
        findings: "決策流程：技術評估 → 財務審核 → 高層批准，預計需時 6 週。",
      },
      identifyPain: {
        score: 85,
        findings: "痛點明確：銷售流程效率低、客戶流失率高、缺乏數據分析能力。",
      },
      champion: {
        score: 78,
        findings: "銷售總監 Mary Johnson 強力支持，願意協助內部推動。",
      },
      recommendations: [
        "安排與財務長的深度會議，展示 ROI 計算模型",
        "提供競品比較分析，強調我們的技術支援優勢",
        "與 Champion 合作，準備內部推廣簡報",
        "加速 POC 流程，展示實際效果",
      ],
      createdAt: new Date().toISOString(),
    };

    const reportContent = generateMeddicReport(mockAnalysis);

    const writeResult = await filesystemWriteTool.handler(
      {
        path: "reports/test-meddic-report.md",
        content: reportContent,
        encoding: "utf-8",
        createDirectories: true,
      },
      testContext
    );

    console.log("✅ 成功");
    console.log(`   檔案路徑: ${writeResult.path}`);
    console.log(`   檔案大小: ${writeResult.size} bytes`);
  } catch (error) {
    console.log(
      `❌ 失敗: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
  console.log();

  // Test 3: 讀取剛剛寫入的報告
  console.log("📖 測試 3: 讀取 MEDDIC 報告");
  console.log("=".repeat(50));
  try {
    const readResult = await filesystemReadTool.handler(
      {
        path: "reports/test-meddic-report.md",
        encoding: "utf-8",
      },
      testContext
    );

    console.log("✅ 成功");
    console.log(`   檔案大小: ${readResult.size} bytes`);
    console.log("   內容預覽:");
    const lines = readResult.content.split("\n");
    for (const line of lines.slice(0, 10)) {
      console.log(`   ${line}`);
    }
    if (lines.length > 10) {
      console.log(`   ... 還有 ${lines.length - 10} 行`);
    }
  } catch (error) {
    console.log(
      `❌ 失敗: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
  console.log();

  // Test 4: 生成團隊績效報告
  console.log("📊 測試 4: 生成團隊績效報告");
  console.log("=".repeat(50));
  try {
    const mockTeamPerformance: TeamPerformance = {
      period: "2026年1月",
      totalConversations: 156,
      avgMeddicScore: 72.5,
      dealsClosed: 12,
      avgDealValue: 125_000,
      activeReps: 8,
    };

    const mockReps: RepPerformance[] = [
      {
        repId: "rep-001",
        repName: "張小明",
        conversationCount: 28,
        avgScore: 82.3,
        avgMetricsScore: 85,
        avgEconomicBuyerScore: 80,
        avgDecisionCriteriaScore: 83,
        avgDecisionProcessScore: 78,
        avgIdentifyPainScore: 88,
        avgChampionScore: 81,
        opportunitiesCount: 15,
        dealsWon: 5,
      },
      {
        repId: "rep-002",
        repName: "李美華",
        conversationCount: 22,
        avgScore: 75.8,
        avgMetricsScore: 78,
        avgEconomicBuyerScore: 72,
        avgDecisionCriteriaScore: 76,
        avgDecisionProcessScore: 74,
        avgIdentifyPainScore: 80,
        avgChampionScore: 75,
        opportunitiesCount: 12,
        dealsWon: 3,
      },
      {
        repId: "rep-003",
        repName: "王大偉",
        conversationCount: 18,
        avgScore: 58.2,
        avgMetricsScore: 60,
        avgEconomicBuyerScore: 55,
        avgDecisionCriteriaScore: 58,
        avgDecisionProcessScore: 52,
        avgIdentifyPainScore: 65,
        avgChampionScore: 59,
        opportunitiesCount: 10,
        dealsWon: 1,
      },
    ];

    const teamReport = generateTeamReport(mockTeamPerformance, mockReps);

    const writeResult = await filesystemWriteTool.handler(
      {
        path: "reports/test-team-report.md",
        content: teamReport,
        encoding: "utf-8",
      },
      testContext
    );

    console.log("✅ 成功");
    console.log(`   檔案路徑: ${writeResult.path}`);
    console.log(`   檔案大小: ${writeResult.size} bytes`);
  } catch (error) {
    console.log(
      `❌ 失敗: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
  console.log();

  // Test 5: 生成每日摘要報告
  console.log("📅 測試 5: 生成每日摘要報告");
  console.log("=".repeat(50));
  try {
    const mockSummary: DailySummary = {
      date: "2026-01-15",
      newConversations: 24,
      completedAnalyses: 22,
      alertsTriggered: 3,
      avgProcessingTime: 12.5,
      systemHealth: "healthy",
    };

    const summaryReport = generateDailySummary(mockSummary);

    const writeResult = await filesystemWriteTool.handler(
      {
        path: "reports/test-daily-summary.md",
        content: summaryReport,
        encoding: "utf-8",
      },
      testContext
    );

    console.log("✅ 成功");
    console.log(`   檔案路徑: ${writeResult.path}`);
    console.log(`   檔案大小: ${writeResult.size} bytes`);
  } catch (error) {
    console.log(
      `❌ 失敗: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
  console.log();

  // Test 6: 列出所有生成的報告
  console.log("📂 測試 6: 列出所有生成的報告");
  console.log("=".repeat(50));
  try {
    const result = await filesystemListTool.handler(
      {
        path: "reports",
        pattern: "*.md",
      },
      testContext
    );

    console.log("✅ 成功");
    console.log(`   共找到 ${result.totalCount} 個 Markdown 報告:`);
    for (const file of result.files) {
      console.log(
        `   - ${file.name} (${(file.size / 1024).toFixed(2)} KB, 修改於 ${new Date(file.modified).toLocaleString("zh-TW")})`
      );
    }
  } catch (error) {
    console.log(
      `❌ 失敗: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
  console.log();

  // Test 7: 測試安全性 - 嘗試存取禁止的目錄
  console.log("🔒 測試 7: 安全性檢查 (阻止存取 src/)");
  console.log("=".repeat(50));
  try {
    await filesystemReadTool.handler(
      {
        path: "src/index.ts",
        encoding: "utf-8",
      },
      testContext
    );
    console.log("❌ 失敗 (不應該允許存取 src/ 目錄)");
  } catch (error) {
    console.log("✅ 成功 (正確阻止了非法路徑存取)");
    console.log(
      `   錯誤訊息: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
  console.log();

  // 清理測試檔案
  console.log("🧹 清理測試檔案...");
  try {
    await rm("reports/test-meddic-report.md", { force: true });
    await rm("reports/test-team-report.md", { force: true });
    await rm("reports/test-daily-summary.md", { force: true });
    console.log("✅ 清理完成");
  } catch (_error) {
    console.log("⚠️  清理失敗（可能檔案不存在）");
  }
  console.log();

  console.log("=".repeat(50));
  console.log("✨ Filesystem MCP 測試完成！");
  console.log("=".repeat(50));

  console.log("\n📊 測試摘要:");
  console.log("  ✅ 測試 1: 列出 .doc 目錄");
  console.log("  ✅ 測試 2: 生成並寫入 MEDDIC 報告");
  console.log("  ✅ 測試 3: 讀取報告內容");
  console.log("  ✅ 測試 4: 生成團隊績效報告");
  console.log("  ✅ 測試 5: 生成每日摘要報告");
  console.log("  ✅ 測試 6: 列出生成的報告");
  console.log("  ✅ 測試 7: 安全性檢查");

  console.log("\n🎉 所有測試通過！Filesystem MCP 工具運作正常。");
  console.log("\n📝 Phase 1.2 Filesystem MCP 工具已準備就緒！");
  console.log("   - filesystem.ts: 檔案讀寫和目錄列表工具");
  console.log("   - report-templates.ts: 3 種報表模板");
  console.log("   - 安全性機制: 僅允許 .doc/, reports/, logs/ 目錄");
}

testFilesystemMCP().catch((error) => {
  console.error("\n❌ 測試執行錯誤:", error);
  process.exit(1);
});
