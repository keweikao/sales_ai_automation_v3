/**
 * 手動創建一筆測試對話記錄,用於測試 MEDDIC 分析
 * 不需要實際上傳音檔
 */

import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { conversations } from "./packages/db/src/schema/index.js";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_ZkASu5qnc9vB@ep-sparkling-band-a130c5ks-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

// 測試用的轉錄文字稿
const SAMPLE_TRANSCRIPT = `
業務：您好，我是 iCHEF 的業務代表。今天想跟您介紹我們的餐廳管理系統。請問您目前店裡有使用 POS 系統嗎？

客戶：有，我們現在用的是傳統的收銀機，但功能很陽春，只能記帳而已。

業務：了解。那請問您目前在營運上有遇到什麼困擾嗎？

客戶：最大的問題是庫存管理很麻煩，每次盤點都要花很多時間。還有員工排班也不好管理。

業務：這些確實是很多餐廳的痛點。我們的系統可以自動追蹤庫存，每次出餐都會自動扣除食材，月底盤點只需要核對差異就好。排班的部分也有專門的模組，可以設定員工的可用時段，系統會自動排班。

客戶：聽起來不錯。但我們是連鎖店，有三家分店，可以統一管理嗎？

業務：當然可以！我們有雲端後台，您可以在一個介面看到所有分店的營業數據、庫存狀況。而且可以設定不同的權限給各店店長。

客戶：價格大概多少？

業務：我們有不同的方案。基本方案是每月 3,000 元，包含 POS 系統和基礎功能。如果需要多店管理和進階分析，是專業方案每月 8,000 元。

客戶：嗯...我需要跟老闆討論一下。老闆比較重視成本效益。

業務：完全理解。我可以幫您準備一份 ROI 分析報告，說明導入系統後可以節省的人力成本和減少的庫存損耗。通常三個月就能回本。

客戶：好，那你先給我資料，我下週跟老闆開會時會提出來討論。

業務：沒問題！我明天就把資料寄給您。請問決策的時程大概是？

客戶：我們每個月月初會開經營會議，下個月初應該會有結果。

業務：太好了，那我會在會議前再跟您確認一次。還有什麼問題我可以協助的嗎？

客戶：目前沒有了，謝謝你的說明。
`;

async function createTestConversation(opportunityId: string) {
  console.log("🧪 Creating test conversation with transcript...\n");

  const conversationId = randomUUID();
  const caseNumber = `202601-TEST-${Math.floor(Math.random() * 1000)}`;

  try {
    const result = await db
      .insert(conversations)
      .values({
        id: conversationId,
        opportunityId,
        caseNumber,
        title: "測試對話 - 直接插入",
        type: "discovery_call",
        status: "transcribed", // 設為 transcribed 可以直接測試分析
        audioUrl: "https://fake-url.com/test-audio.mp3",
        transcript: {
          fullText: SAMPLE_TRANSCRIPT.trim(),
          language: "zh",
          segments: [
            {
              speaker: "unknown",
              text: SAMPLE_TRANSCRIPT.trim(),
              start: 0,
              end: 120,
            },
          ],
        },
        duration: 120,
        conversationDate: new Date(),
        createdBy: "test-user",
      })
      .returning();

    console.log("✅ Test conversation created!\n");
    console.log(`📝 Case Number: ${result[0].caseNumber}`);
    console.log(`🆔 Conversation ID: ${result[0].id}`);
    console.log(`📊 Status: ${result[0].status}\n`);

    console.log("🎯 Next steps:");
    console.log("1. Use this conversation ID to test MEDDIC analysis");
    console.log("2. Call /rpc/conversations/analyze with this ID\n");

    console.log("Test command:");
    console.log(
      `curl -X POST "https://sales-ai-server.salesaiautomationv3.workers.dev/rpc/conversations/analyze" \\`
    );
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -H "Authorization: Bearer YOUR_API_TOKEN" \\`);
    console.log(`  -d '{"json":{"conversationId":"${result[0].id}"}}'`);
  } catch (error) {
    console.error("❌ Failed to create test conversation:", error);
  }
}

// 使用方式: npx tsx create-test-conversation.ts <opportunity-id>
const opportunityId = process.argv[2];

if (!opportunityId) {
  console.error("Usage: npx tsx create-test-conversation.ts <opportunity-id>");
  console.log("\nYou can get an opportunity ID from the database:");
  console.log("SELECT id, company_name FROM opportunities LIMIT 1;");
  process.exit(1);
}

createTestConversation(opportunityId).catch(console.error);
