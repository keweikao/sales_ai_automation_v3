/**
 * 直接查詢資料庫中的對話記錄
 */

import { neon } from "@neondatabase/serverless";
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { conversations } from "./packages/db/src/schema/index.js";

const DATABASE_URL =
  process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

async function checkConversations() {
  console.log("🔍 Checking database for conversations...\n");

  try {
    const results = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(10);

    console.log(`Found ${results.length} conversations:\n`);

    for (const conv of results) {
      const transcript = conv.transcript as any;
      const hasTranscript = transcript?.fullText;
      const transcriptLength = hasTranscript ? transcript.fullText.length : 0;

      console.log(`📝 ${conv.caseNumber}`);
      console.log(`   ID: ${conv.id}`);
      console.log(`   Status: ${conv.status}`);
      console.log(`   Created: ${conv.createdAt}`);
      console.log(
        `   Transcript: ${hasTranscript ? `${transcriptLength} chars` : "None"}`
      );

      if (conv.status === "transcribed" && hasTranscript) {
        console.log("   ✅ Can use this for testing!");
      }
      console.log();
    }

    // 找出第一個可測試的對話
    const testable = results.find(
      (c) => c.status === "transcribed" && (c.transcript as any)?.fullText
    );

    if (testable) {
      console.log("\n🎯 Recommended test conversation:");
      console.log(`   Case Number: ${testable.caseNumber}`);
      console.log(`   ID: ${testable.id}`);
      console.log("   Use this ID for testing MEDDIC analysis\n");

      // 輸出可以直接用的測試指令
      console.log("Test command:");
      console.log(
        `curl -X POST "https://sales-ai-server.salesaiautomationv3.workers.dev/rpc/conversations/analyze" \\`
      );
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -H "Authorization: Bearer YOUR_API_TOKEN" \\`);
      console.log(`  -d '{"json":{"conversationId":"${testable.id}"}}'`);
    } else {
      console.log("\n⚠️ No transcribed conversations found for testing");
      console.log("Please upload an audio file first\n");
    }
  } catch (error) {
    console.error("❌ Database query failed:", error);
  }
}

checkConversations().catch(console.error);
