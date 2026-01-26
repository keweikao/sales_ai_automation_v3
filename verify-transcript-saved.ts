/**
 * 驗證轉錄是否成功儲存到資料庫
 */

import { neon } from "@neondatabase/serverless";
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { conversations } from "./packages/db/src/schema/index.js";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_2XSWsKNxeU3w@ep-sparkling-band-a130c5ks-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

async function verifyLatestConversation() {
  console.log("🔍 Checking latest conversation in database...\n");

  const latest = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.createdAt))
    .limit(1);

  if (latest.length === 0) {
    console.log("❌ No conversations found");
    return;
  }

  const conv = latest[0];
  const transcript = conv.transcript as any;
  const hasTranscript = transcript?.fullText;

  console.log(`📝 Latest Conversation: ${conv.caseNumber}`);
  console.log(`   ID: ${conv.id}`);
  console.log(`   Status: ${conv.status}`);
  console.log(`   Created: ${conv.createdAt}\n`);

  if (hasTranscript) {
    console.log("✅ Transcript SAVED successfully!");
    console.log(
      `   Full Text Length: ${transcript.fullText.length} characters`
    );
    console.log(`   Language: ${transcript.language || "unknown"}`);
    console.log(`   Segments: ${transcript.segments?.length || 0}`);
    console.log("\n   Preview (first 200 chars):");
    console.log(`   "${transcript.fullText.substring(0, 200)}..."\n`);

    if (conv.status === "transcribed") {
      console.log(`✅ Status is "transcribed" - waiting for MEDDIC analysis`);
    } else if (conv.status === "completed") {
      console.log(`✅ Status is "completed" - MEDDIC analysis finished!`);
      if (conv.meddicAnalysis) {
        const analysis = conv.meddicAnalysis as any;
        console.log(`   MEDDIC Score: ${analysis.overallScore}/100`);
        console.log(`   Status: ${analysis.status}`);
      }
    }
  } else {
    console.log("❌ No transcript found");
    console.log("   This might be an old record from before the fix");
  }
}

verifyLatestConversation().catch(console.error);
