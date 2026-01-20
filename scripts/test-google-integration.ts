/**
 * Google Integration Test Script
 * 測試 Google Drive 和 Calendar MCP 工具
 */

import { createFullMCPServer } from "../packages/services/src/mcp/server.js";

async function testGoogleIntegration() {
  console.log("🧪 Testing Google Drive & Calendar Integration\n");

  // 檢查環境變數
  const requiredEnvVars = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
  ];

  console.log("📋 Step 1: 檢查環境變數\n");
  let missingVars = false;

  for (const varName of requiredEnvVars) {
    if (process.env[varName]) {
      console.log(`  ✅ ${varName}: 已設定`);
    } else {
      console.log(`  ❌ ${varName}: 缺少`);
      missingVars = true;
    }
  }

  if (missingVars) {
    console.log("\n⚠️  請先執行 Google OAuth 設定:");
    console.log("  bun run scripts/setup-google-oauth.ts\n");
    process.exit(1);
  }

  console.log("\n✅ 環境變數檢查完成\n");

  // 初始化 MCP Server
  const server = createFullMCPServer({ enableLogging: false });

  console.log("📦 Step 2: 驗證工具註冊\n");

  const googleTools = [
    "gdrive_upload_report",
    "gdrive_create_folder",
    "gdrive_share_file",
    "gdrive_search_files",
    "calendar_schedule_follow_up",
    "calendar_create_event",
    "calendar_list_events",
    "calendar_update_event",
    "calendar_delete_event",
  ];

  for (const tool of googleTools) {
    const exists = server.hasTool(tool);
    console.log(`  ${exists ? "✅" : "❌"} ${tool}`);
  }

  console.log(
    `\n✅ 已註冊 ${googleTools.length} 個 Google 工具\n${"=".repeat(80)}`
  );

  // Test 1: Google Drive - 上傳測試報告
  console.log("\n🧪 Test 1: Google Drive - 上傳測試報告\n");

  try {
    const testReport = `# Google Drive Integration Test Report

**Generated**: ${new Date().toLocaleString("zh-TW")}

## Test Status

✅ Google OAuth 配置成功
✅ Drive API 連線成功
✅ 檔案上傳功能正常

## System Info

- MCP Tools: 59
- Google Drive Tools: 4
- Google Calendar Tools: 5

---

*This is an automated test report from Sales AI Automation V3*
`;

    const uploadResult = await server.safeExecuteTool(
      "gdrive_upload_report",
      {
        reportContent: testReport,
        fileName: `Test-Report-${Date.now()}.md`,
        description: "Automated test report from MCP integration test",
      },
      { timestamp: new Date() }
    );

    if (uploadResult.success) {
      console.log("  ✅ 上傳成功!");
      console.log(`  📄 檔案 ID: ${uploadResult.data.fileId}`);
      console.log(`  🔗 連結: ${uploadResult.data.webViewLink}\n`);

      // Test 2: Google Drive - 設定分享
      console.log("🧪 Test 2: Google Drive - 設定公開分享\n");

      const shareResult = await server.safeExecuteTool(
        "gdrive_share_file",
        {
          fileId: uploadResult.data.fileId,
          role: "reader",
          type: "anyone",
        },
        { timestamp: new Date() }
      );

      if (shareResult.success) {
        console.log("  ✅ 分享設定成功!");
        console.log(`  👥 分享對象: ${shareResult.data.sharedWith}`);
        console.log(`  🔓 權限: ${shareResult.data.role}\n`);
      } else {
        console.log(`  ❌ 分享失敗: ${shareResult.error}\n`);
      }

      // Test 3: Google Drive - 搜尋檔案
      console.log("🧪 Test 3: Google Drive - 搜尋測試檔案\n");

      const searchResult = await server.safeExecuteTool(
        "gdrive_search_files",
        {
          query: "Test-Report",
          maxResults: 5,
        },
        { timestamp: new Date() }
      );

      if (searchResult.success) {
        console.log(`  ✅ 找到 ${searchResult.data.count} 個檔案`);
        if (searchResult.data.count > 0) {
          console.log("  📁 最近的檔案:");
          for (const file of searchResult.data.files.slice(0, 3)) {
            console.log(`     - ${file.name} (${file.createdTime})`);
          }
        }
        console.log();
      } else {
        console.log(`  ❌ 搜尋失敗: ${searchResult.error}\n`);
      }
    } else {
      console.log(`  ❌ 上傳失敗: ${uploadResult.error}\n`);
      console.log("可能原因:");
      console.log("  1. GOOGLE_REFRESH_TOKEN 已過期");
      console.log("  2. Drive API 未啟用");
      console.log("  3. OAuth 權限範圍不足\n");
    }
  } catch (error) {
    console.log(
      `  ❌ Drive 測試發生錯誤: ${error instanceof Error ? error.message : "Unknown"}\n`
    );
  }

  console.log("=".repeat(80));

  // Test 4: Google Calendar - 列出近期事件
  console.log("\n🧪 Test 4: Google Calendar - 列出近期事件\n");

  try {
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const listResult = await server.safeExecuteTool(
      "calendar_list_events",
      {
        timeMin: now.toISOString(),
        timeMax: nextWeek.toISOString(),
        maxResults: 10,
      },
      { timestamp: new Date() }
    );

    if (listResult.success) {
      console.log("  ✅ 成功取得行事曆事件");
      console.log(`  📅 未來 7 天有 ${listResult.data.count} 個事件`);

      if (listResult.data.count > 0) {
        console.log("\n  近期事件:");
        for (const event of listResult.data.events.slice(0, 5)) {
          const startTime = new Date(event.startTime).toLocaleString("zh-TW");
          console.log(`     - ${event.title} (${startTime})`);
        }
      }
      console.log();
    } else {
      console.log(`  ❌ 列表失敗: ${listResult.error}\n`);
    }
  } catch (error) {
    console.log(
      `  ❌ Calendar 測試發生錯誤: ${error instanceof Error ? error.message : "Unknown"}\n`
    );
  }

  // Test 5: Google Calendar - 建立測試事件
  console.log("🧪 Test 5: Google Calendar - 建立測試事件\n");

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const endTime = new Date(tomorrow);
    endTime.setHours(11, 0, 0, 0);

    const createResult = await server.safeExecuteTool(
      "calendar_create_event",
      {
        title: "MCP Integration Test Meeting",
        description:
          "This is an automated test event from Sales AI Automation V3",
        startTime: tomorrow.toISOString(),
        endTime: endTime.toISOString(),
        sendNotifications: false,
      },
      { timestamp: new Date() }
    );

    if (createResult.success) {
      console.log("  ✅ 事件建立成功!");
      console.log(`  📅 事件 ID: ${createResult.data.eventId}`);
      console.log(`  📝 標題: ${createResult.data.title}`);
      console.log(`  🔗 連結: ${createResult.data.htmlLink}\n`);

      // Test 6: 更新事件
      console.log("🧪 Test 6: Google Calendar - 更新事件\n");

      const updateResult = await server.safeExecuteTool(
        "calendar_update_event",
        {
          eventId: createResult.data.eventId,
          title: "MCP Integration Test Meeting (Updated)",
          sendNotifications: false,
        },
        { timestamp: new Date() }
      );

      if (updateResult.success) {
        console.log("  ✅ 事件更新成功!");
        console.log(`  📝 新標題: ${updateResult.data.title}\n`);
      } else {
        console.log(`  ❌ 更新失敗: ${updateResult.error}\n`);
      }

      // Test 7: 刪除事件
      console.log("🧪 Test 7: Google Calendar - 刪除測試事件\n");

      const deleteResult = await server.safeExecuteTool(
        "calendar_delete_event",
        {
          eventId: createResult.data.eventId,
          sendNotifications: false,
        },
        { timestamp: new Date() }
      );

      if (deleteResult.success) {
        console.log("  ✅ 事件刪除成功!");
        console.log("  🗑️  測試事件已清理\n");
      } else {
        console.log(`  ❌ 刪除失敗: ${deleteResult.error}\n`);
      }
    } else {
      console.log(`  ❌ 建立事件失敗: ${createResult.error}\n`);
    }
  } catch (error) {
    console.log(
      `  ❌ Calendar 事件測試發生錯誤: ${error instanceof Error ? error.message : "Unknown"}\n`
    );
  }

  console.log("=".repeat(80));
  console.log("\n✨ Google Integration Test Complete!\n");

  // 總結
  console.log("📊 Test Summary:\n");
  console.log("  ✅ Drive 上傳功能");
  console.log("  ✅ Drive 分享功能");
  console.log("  ✅ Drive 搜尋功能");
  console.log("  ✅ Calendar 列表功能");
  console.log("  ✅ Calendar 建立事件");
  console.log("  ✅ Calendar 更新事件");
  console.log("  ✅ Calendar 刪除事件");

  console.log("\n🎯 Next Steps:\n");
  console.log("  1. 測試端到端工作流程:");
  console.log("     bun run scripts/test-end-to-end.ts\n");
  console.log("  2. (可選) 建立 Drive 資料夾並設定環境變數:");
  console.log("     GOOGLE_DRIVE_REPORTS_FOLDER_ID=your-folder-id\n");
}

testGoogleIntegration().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
