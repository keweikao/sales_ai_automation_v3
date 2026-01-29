/**
 * 測試 Voice Tagging 功能
 * 從資料庫抓取一個已完成的對話來測試
 */

import { neon } from "@neondatabase/serverless";
import { processConversationVoiceTags } from "../packages/services/src/nlp/voice-tagger";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL 環境變數未設定");
  process.exit(1);
}

async function main() {
  const sql = neon(DATABASE_URL);

  console.log("🔍 查詢已完成的對話...\n");

  // 查詢一個已完成且有逐字稿的對話（選擇有較長逐字稿的）
  const conversations = await sql`
    SELECT
      id,
      opportunity_id,
      product_line,
      status,
      transcript,
      analyzed_at,
      created_at,
      length(transcript::text) as transcript_length
    FROM conversations
    WHERE status = 'completed'
      AND transcript IS NOT NULL
      AND analyzed_at IS NOT NULL
      AND length(transcript::text) > 1000
    ORDER BY length(transcript::text) DESC
    LIMIT 1
  `;

  if (conversations.length === 0) {
    console.log("❌ 沒有找到已完成的對話");
    return;
  }

  const conv = conversations[0];
  console.log(`📝 找到對話: ${conv.id}`);
  console.log(`   - 商機: ${conv.opportunity_id}`);
  console.log(`   - 產品線: ${conv.product_line}`);
  console.log(`   - 分析時間: ${conv.analyzed_at}`);

  // 解析 transcript
  let transcriptText = "";
  if (typeof conv.transcript === "string") {
    transcriptText = conv.transcript;
  } else if (conv.transcript?.fullText) {
    transcriptText = conv.transcript.fullText;
  } else if (conv.transcript?.text) {
    transcriptText = conv.transcript.text;
  }

  console.log(`   - 逐字稿長度: ${transcriptText.length} 字\n`);

  if (transcriptText.length < 50) {
    console.log("⚠️ 逐字稿太短，顯示內容:");
    console.log(transcriptText);
    console.log("\n嘗試查詢另一筆...");

    const moreConvs = await sql`
      SELECT id, transcript
      FROM conversations
      WHERE status = 'completed'
        AND transcript IS NOT NULL
      ORDER BY analyzed_at DESC
      LIMIT 5
    `;

    for (const c of moreConvs) {
      let text = "";
      if (typeof c.transcript === "string") {
        text = c.transcript;
      } else if (c.transcript?.fullText) {
        text = c.transcript.fullText;
      }
      console.log(`  ${c.id}: ${text.length} 字`);
    }
    return;
  }

  // 顯示部分逐字稿
  console.log("📄 逐字稿預覽 (前 500 字):");
  console.log("─".repeat(50));
  console.log(transcriptText.slice(0, 500) + "...\n");
  console.log("─".repeat(50));

  // 執行 Voice Tagging（不使用 AI，只用規則）
  console.log("\n🏷️  執行 Voice Tagging（僅規則匹配）...\n");

  const productLine = (conv.product_line || "ichef") as "ichef" | "beauty";
  const result = await processConversationVoiceTags(
    transcriptText,
    productLine
    // 不傳 geminiApiKey，只用規則匹配
  );

  // 輸出結果
  console.log("📊 處理結果:");
  console.log("─".repeat(50));
  console.log(`總句子數: ${result.totalSentences}`);
  console.log(`規則匹配: ${result.ruleMatched}`);
  console.log(`AI 處理: ${result.aiProcessed}`);
  console.log(`跳過: ${result.skipped}`);
  console.log(`處理時間: ${result.processingTime}ms`);

  console.log("\n🎯 功能需求標籤:");
  if (result.features.length === 0) {
    console.log("  (無)");
  } else {
    for (const f of result.features) {
      console.log(`  - ${f.tag} (${f.count}次, ${f.source})`);
      if (f.quotes.length > 0) {
        console.log(`    「${f.quotes[0].slice(0, 60)}...」`);
      }
    }
  }

  console.log("\n😣 痛點標籤:");
  if (result.pains.length === 0) {
    console.log("  (無)");
  } else {
    for (const p of result.pains) {
      console.log(`  - ${p.tag} [${p.severity}] ${p.isQuantified ? "📊" : ""}`);
      if (p.quotes.length > 0) {
        console.log(`    「${p.quotes[0].slice(0, 60)}...」`);
      }
    }
  }

  console.log("\n🚫 異議標籤:");
  if (result.objections.length === 0) {
    console.log("  (無)");
  } else {
    for (const o of result.objections) {
      console.log(`  - ${o.tag}`);
      if (o.quotes.length > 0) {
        console.log(`    「${o.quotes[0].slice(0, 60)}...」`);
      }
    }
  }

  console.log("\n🏢 競品提及:");
  if (result.competitors.length === 0) {
    console.log("  (無)");
  } else {
    for (const c of result.competitors) {
      console.log(`  - ${c.name} [${c.sentiment}]`);
      if (c.quotes.length > 0) {
        console.log(`    「${c.quotes[0].slice(0, 60)}...」`);
      }
    }
  }

  console.log("\n✅ 測試完成！");
}

main().catch(console.error);
