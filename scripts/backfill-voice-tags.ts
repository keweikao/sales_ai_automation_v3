/**
 * Backfill Voice Tags for conversations before 1/28
 * 執行方式: bun run scripts/backfill-voice-tags.ts
 */

import { processConversationVoiceTags } from "../packages/services/src/nlp/voice-tagger";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

interface ConversationToProcess {
  id: string;
  transcript: string | { fullText?: string } | null;
  opportunityId: string | null;
  productLine: string | null;
  salesRepId: string | null;
  conversationDate: string | null;
  analyzedAt: string | null;
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("[VoiceTagging] 開始處理 1/28 之前的對話...");

  // 查詢待處理對話（包含所有未處理的）
  const conversations = (await sql`
    SELECT
      c.id,
      c.transcript,
      c.opportunity_id as "opportunityId",
      c.product_line as "productLine",
      c.created_by as "salesRepId",
      c.conversation_date as "conversationDate",
      c.analyzed_at as "analyzedAt"
    FROM conversations c
    LEFT JOIN customer_voice_tags cvt ON cvt.conversation_id = c.id
    WHERE c.status = 'completed'
      AND c.transcript IS NOT NULL
      AND cvt.id IS NULL
    ORDER BY c.analyzed_at DESC NULLS LAST
  `) as ConversationToProcess[];

  console.log(`找到 ${conversations.length} 筆待處理對話`);

  if (conversations.length === 0) {
    console.log("沒有待處理的對話");
    return;
  }

  let processed = 0;
  let failed = 0;

  for (const conv of conversations) {
    try {
      console.log(`\n處理: ${conv.id}`);

      const productLine = (conv.productLine || "ichef") as "ichef" | "beauty";
      const geminiApiKey = process.env.GEMINI_API_KEY!;

      // 處理逐字稿
      const result = await processConversationVoiceTags(
        conv.transcript || "",
        productLine,
        geminiApiKey
      );

      // 儲存結果
      const tagId = randomUUID();
      const dateStr = conv.analyzedAt
        ? new Date(conv.analyzedAt).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];
      const conversationDate = conv.conversationDate || dateStr;

      await sql`
        INSERT INTO customer_voice_tags (
          id, conversation_id, opportunity_id, product_line,
          features_mentioned, pain_tags, objection_tags,
          competitor_mentions, decision_factors,
          total_sentences, rule_matched_count, ai_processed_count, skipped_count,
          conversation_date, sales_rep_id, processing_time_ms
        ) VALUES (
          ${tagId},
          ${conv.id},
          ${conv.opportunityId},
          ${productLine},
          ${JSON.stringify(result.features)}::jsonb,
          ${JSON.stringify(result.pains)}::jsonb,
          ${JSON.stringify(result.objections)}::jsonb,
          ${JSON.stringify(result.competitors)}::jsonb,
          ${JSON.stringify(result.decisionFactors)}::jsonb,
          ${result.totalSentences},
          ${result.ruleMatched},
          ${result.aiProcessed},
          ${result.skipped},
          ${conversationDate}::date,
          ${conv.salesRepId},
          ${result.processingTime}
        )
      `;

      processed++;
      console.log(
        `  ✅ 完成: ${result.features.length} features, ${result.pains.length} pains, ${result.objections.length} objections`
      );
    } catch (error) {
      failed++;
      console.error(
        `  ❌ 失敗: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  console.log(`\n=== 完成 ===`);
  console.log(`處理成功: ${processed}`);
  console.log(`處理失敗: ${failed}`);
}

main().catch(console.error);
