/**
 * Phase 3 Ops Tools 測試腳本
 * 測試所有 Phase 3 Ops 工具是否正確註冊
 */

import { createFullMCPServer } from "./packages/services/src/mcp/server.js";

async function testPhase3Tools() {
  console.log("=".repeat(60));
  console.log("Phase 3 Ops Tools 測試");
  console.log("=".repeat(60));
  console.log("");

  // 建立 MCP Server
  const mcpServer = createFullMCPServer({ enableLogging: true });

  console.log("\n📊 註冊工具統計:");
  console.log(`   總工具數: ${mcpServer.toolCount}`);
  console.log("");

  // 列出所有工具
  const allTools = mcpServer.listTools();

  // 分類統計
  const categories = {
    phase1: [] as string[],
    phase2: [] as string[],
    phase3_slack: [] as string[],
    phase3_transcription: [] as string[],
    phase3_storage: [] as string[],
    phase3_analysis: [] as string[],
  };

  for (const tool of allTools) {
    if (
      tool.name.startsWith("postgres_") ||
      tool.name.startsWith("filesystem_") ||
      tool.name.startsWith("slack_post_")
    ) {
      categories.phase1.push(tool.name);
    } else if (
      tool.name.startsWith("groq_") ||
      tool.name.startsWith("r2_") ||
      tool.name.startsWith("gemini_")
    ) {
      categories.phase2.push(tool.name);
    } else if (tool.name.startsWith("slack_")) {
      categories.phase3_slack.push(tool.name);
    } else if (tool.name.startsWith("transcription_")) {
      categories.phase3_transcription.push(tool.name);
    } else if (tool.name.startsWith("storage_")) {
      categories.phase3_storage.push(tool.name);
    } else if (tool.name.startsWith("analysis_")) {
      categories.phase3_analysis.push(tool.name);
    }
  }

  console.log("✅ Phase 1: Core MCP Tools");
  console.log(
    `   PostgreSQL: ${categories.phase1.filter((t) => t.startsWith("postgres_")).length} 工具`
  );
  console.log(
    `   Filesystem: ${categories.phase1.filter((t) => t.startsWith("filesystem_")).length} 工具`
  );
  console.log(
    `   Slack: ${categories.phase1.filter((t) => t.startsWith("slack_post_")).length} 工具`
  );
  console.log(`   小計: ${categories.phase1.length} 工具\n`);

  console.log("✅ Phase 2: External Service Tools");
  console.log(
    `   Groq Whisper: ${categories.phase2.filter((t) => t.startsWith("groq_")).length} 工具`
  );
  console.log(
    `   R2 Storage: ${categories.phase2.filter((t) => t.startsWith("r2_")).length} 工具`
  );
  console.log(
    `   Gemini LLM: ${categories.phase2.filter((t) => t.startsWith("gemini_")).length} 工具`
  );
  console.log(`   小計: ${categories.phase2.length} 工具\n`);

  console.log("✅ Phase 3: Ops Tools");
  console.log(`   Slack Ops: ${categories.phase3_slack.length} 工具`);
  console.log(
    `   Transcription Ops: ${categories.phase3_transcription.length} 工具`
  );
  console.log(`   Storage Ops: ${categories.phase3_storage.length} 工具`);
  console.log(`   Analysis Ops: ${categories.phase3_analysis.length} 工具`);
  console.log(
    `   小計: ${categories.phase3_slack.length + categories.phase3_transcription.length + categories.phase3_storage.length + categories.phase3_analysis.length} 工具\n`
  );

  // 詳細列表
  console.log("\n📋 Phase 3 Ops 工具詳細列表:\n");

  console.log("🔹 Slack Ops (10 tools):");
  for (const tool of categories.phase3_slack) {
    console.log(`   - ${tool}`);
  }

  console.log("\n🔹 Transcription Ops (6 tools):");
  for (const tool of categories.phase3_transcription) {
    console.log(`   - ${tool}`);
  }

  console.log("\n🔹 Storage Ops (6 tools):");
  for (const tool of categories.phase3_storage) {
    console.log(`   - ${tool}`);
  }

  console.log("\n🔹 Analysis Ops (6 tools):");
  for (const tool of categories.phase3_analysis) {
    console.log(`   - ${tool}`);
  }

  // 驗證預期工具數量
  console.log(`\n${"=".repeat(60)}`);
  console.log("驗證結果:");
  console.log("=".repeat(60));

  const expectedCounts = {
    phase1: 7, // 2 postgres + 3 filesystem + 2 slack_post
    phase2: 11, // 3 groq + 5 r2 + 3 gemini
    phase3: 28, // 10 slack + 6 transcription + 6 storage + 6 analysis
  };

  const actualCounts = {
    phase1: categories.phase1.length,
    phase2: categories.phase2.length,
    phase3:
      categories.phase3_slack.length +
      categories.phase3_transcription.length +
      categories.phase3_storage.length +
      categories.phase3_analysis.length,
  };

  let allPassed = true;

  for (const [phase, expected] of Object.entries(expectedCounts)) {
    const actual = actualCounts[phase as keyof typeof actualCounts];
    const passed = actual === expected;
    allPassed = allPassed && passed;

    const status = passed ? "✅" : "❌";
    console.log(`${status} ${phase}: ${actual}/${expected} 工具`);
  }

  const total = actualCounts.phase1 + actualCounts.phase2 + actualCounts.phase3;
  const expectedTotal =
    expectedCounts.phase1 + expectedCounts.phase2 + expectedCounts.phase3;
  const totalPassed = total === expectedTotal;
  allPassed = allPassed && totalPassed;

  console.log(
    `\n${totalPassed ? "✅" : "❌"} 總計: ${total}/${expectedTotal} 工具`
  );

  console.log(`\n${"=".repeat(60)}`);
  if (allPassed) {
    console.log("🎉 所有測試通過！Phase 3 Ops 工具已成功註冊");
  } else {
    console.log("⚠️ 部分測試失敗，請檢查工具註冊");
  }
  console.log("=".repeat(60));
}

testPhase3Tools().catch(console.error);
